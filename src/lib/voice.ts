// Voice analysis — records mic for N seconds and returns a 4-quadrant
// classification that maps to DOCK's voice modes (외침/선언/속삭임/노래).
//
// Privacy: all analysis happens on-device. The MediaStream is torn down
// immediately after recording. No audio buffer is retained or transmitted.
//
// Axes:
//   volume (loud × soft)   — RMS over recording window
//   tempo  (fast × slow)   — peak count per second in volume envelope
//
// Mapping:
//   loud × fast  →  외침 (gothic, BOLD)
//   loud × slow  →  선언 (mono, RGLR)
//   soft × slow  →  속삭임 (myeongjo, RGLR)
//   soft × fast  →  노래 (song, THIN-RGLR)

import type { ToneState } from '../types';

export interface VoiceAnalysis {
  loud: boolean;
  fast: boolean;
  /** Normalized 0..1, average RMS over recording */
  volume: number;
  /** Peaks per second */
  tempo: number;
  /** Actual recording duration (ms) */
  durationMs: number;
  /** Sample of envelope levels for live preview (last N points) */
  envelope: number[];
}

export interface VoiceMode {
  id: 'cry' | 'state' | 'hush' | 'song';
  labelKr: string;
  labelEn: string;
  description: string;
  font: ToneState['font'];
  wght: number;
}

export const VOICE_MODES: Record<VoiceMode['id'], VoiceMode> = {
  cry: {
    id: 'cry',
    labelKr: '외침',
    labelEn: 'CRY',
    description: '크고 빠른 목소리',
    font: 'gothic',
    wght: 700
  },
  state: {
    id: 'state',
    labelKr: '선언',
    labelEn: 'STATE',
    description: '크고 느린 목소리',
    font: 'mono',
    wght: 600
  },
  hush: {
    id: 'hush',
    labelKr: '속삭임',
    labelEn: 'HUSH',
    description: '작고 느린 목소리',
    font: 'myeongjo',
    wght: 400
  },
  song: {
    id: 'song',
    labelKr: '노래',
    labelEn: 'SONG',
    description: '작고 빠른 목소리',
    font: 'song',
    wght: 300
  }
};

/** Decide voice mode from analysis. */
export function classify(v: VoiceAnalysis): VoiceMode {
  if (v.loud && v.fast) return VOICE_MODES.cry;
  if (v.loud && !v.fast) return VOICE_MODES.state;
  if (!v.loud && v.fast) return VOICE_MODES.song;
  return VOICE_MODES.hush;
}

/** Convert a VoiceMode into a partial tone the user can adjust further in Z1. */
export function modeToTone(m: VoiceMode): Pick<ToneState, 'font' | 'wght' | 'tone' | 'slnt' | 'size'> {
  return {
    font: m.font,
    wght: m.wght,
    tone: 1.0,
    slnt: 0,
    size: 80
  };
}

/** Thresholds — calibrated for a typical phone mic at normal listening distance. */
const LOUD_THRESHOLD = 0.12;     // RMS above this = loud
const FAST_THRESHOLD = 3.5;      // peaks/sec above this = fast

/** Below this, treat as silence — don't classify, ask user to retry. */
export const SILENCE_THRESHOLD = 0.018;

/** Voice was too quiet to analyze meaningfully. */
export function isSilent(v: VoiceAnalysis): boolean {
  return v.volume < SILENCE_THRESHOLD;
}

interface RecorderHandle {
  stop: () => Promise<VoiceAnalysis>;
  /** Subscribe to live envelope samples (for waveform UI). Called ~30fps. */
  onLevel: (cb: (level: number) => void) => void;
}

export async function startRecording(maxDurationMs = 6000): Promise<RecorderHandle> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('이 브라우저는 음성 입력을 지원하지 않아요.');
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Web Audio context for analysis only — no playback.
  type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };
  const w = window as WindowWithWebkit;
  const Ctx = window.AudioContext ?? w.webkitAudioContext;
  if (!Ctx) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('AudioContext를 지원하지 않는 브라우저예요.');
  }
  const ctx = new Ctx();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const buf = new Uint8Array(analyser.fftSize);
  const samples: number[] = [];
  const startedAt = Date.now();
  let stopped = false;
  let levelCb: ((l: number) => void) | null = null;

  function tick() {
    if (stopped) return;
    analyser.getByteTimeDomainData(buf);
    // RMS for this frame (samples are 0..255, center 128)
    let sumSq = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sumSq += v * v;
    }
    const rms = Math.sqrt(sumSq / buf.length);
    samples.push(rms);
    levelCb?.(rms);
    requestAnimationFrame(tick);
  }
  tick();

  // Auto-stop after maxDurationMs
  const autoStopId = window.setTimeout(() => {
    if (!stopped) void handle.stop();
  }, maxDurationMs);

  async function teardown(): Promise<VoiceAnalysis> {
    stopped = true;
    clearTimeout(autoStopId);
    stream.getTracks().forEach((t) => t.stop());
    try {
      await ctx.close();
    } catch {
      /* noop */
    }

    const durationMs = Date.now() - startedAt;
    const volume = average(samples);

    // Tempo estimation: count peaks in the smoothed envelope.
    // 'peak' = local max above the running average by some delta.
    const smoothed = smooth(samples, 4);
    const mean = average(smoothed);
    const delta = Math.max(0.025, mean * 0.6);
    let peaks = 0;
    let prev = 0;
    let rising = false;
    const refractoryFrames = 6;
    let frameSincePeak = 0;
    for (let i = 1; i < smoothed.length - 1; i++) {
      const cur = smoothed[i];
      frameSincePeak++;
      if (cur > prev + 0.005) rising = true;
      else if (rising && cur < prev - 0.005 && cur > mean + delta && frameSincePeak > refractoryFrames) {
        peaks++;
        frameSincePeak = 0;
        rising = false;
      }
      prev = cur;
    }
    const tempo = peaks / (durationMs / 1000);

    return {
      loud: volume > LOUD_THRESHOLD,
      fast: tempo > FAST_THRESHOLD,
      volume,
      tempo,
      durationMs,
      envelope: samples
    };
  }

  const handle: RecorderHandle = {
    stop: teardown,
    onLevel: (cb) => {
      levelCb = cb;
    }
  };
  return handle;
}

function average(arr: number[]): number {
  if (arr.length === 0) return 0;
  let s = 0;
  for (const v of arr) s += v;
  return s / arr.length;
}

function smooth(arr: number[], window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    const start = Math.max(0, i - window);
    const end = Math.min(arr.length, i + window + 1);
    let s = 0;
    for (let j = start; j < end; j++) s += arr[j];
    out.push(s / (end - start));
  }
  return out;
}
