import { useEffect, useRef, useState } from 'react';
import { classify, isSilent, modeToTone, startRecording, SILENCE_THRESHOLD, VOICE_MODES } from '../lib/voice';
import type { VoiceMode } from '../lib/voice';
import type { ToneState } from '../types';

type PartialTone = Pick<ToneState, 'font' | 'wght' | 'tone' | 'slnt' | 'size'>;

interface Props {
  onDone: (partialTone: PartialTone | null) => void;
  onHome?: () => void;
}

type Stage = 'intro' | 'recording' | 'result' | 'silent' | 'error';

const RECORD_MS = 5500;
const WAVE_BARS = 40;
const MODE_ORDER: VoiceMode['id'][] = ['cry', 'state', 'hush', 'song'];

export default function PhaseVoice({ onDone, onHome }: Props) {
  const [stage, setStage] = useState<Stage>('intro');
  const [levels, setLevels] = useState<number[]>([]);
  const [remainingMs, setRemainingMs] = useState(RECORD_MS);
  const [detected, setDetected] = useState<VoiceMode | null>(null);
  const [selectedId, setSelectedId] = useState<VoiceMode['id'] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const recorderRef = useRef<{ stop: () => Promise<unknown> } | null>(null);
  const tickRef = useRef<number | null>(null);

  useEffect(() => {
    document.body.classList.add('themed');
    document.body.style.setProperty('--bg-outer', '#F5E1B5');
    return () => {
      document.body.classList.remove('themed');
      document.body.style.removeProperty('--bg-outer');
      if (tickRef.current) clearInterval(tickRef.current);
      void recorderRef.current?.stop().catch(() => {});
    };
  }, []);

  async function beginRecording() {
    setStage('recording');
    setRemainingMs(RECORD_MS);
    setLevels([]);
    try {
      const rec = await startRecording(RECORD_MS);
      recorderRef.current = rec;
      rec.onLevel((l) => setLevels((prev) => [...prev.slice(-(WAVE_BARS - 1)), l]));

      const startedAt = Date.now();
      tickRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        setRemainingMs(Math.max(0, RECORD_MS - elapsed));
      }, 100);

      const analysis = await rec.stop();
      if (tickRef.current) clearInterval(tickRef.current);
      const a = analysis as Parameters<typeof classify>[0];
      if (isSilent(a)) {
        setStage('silent');
        return;
      }
      const m = classify(a);
      setDetected(m);
      setSelectedId(m.id);
      setStage('result');
    } catch (err) {
      setErrorMsg((err as Error).message || '음성 입력에 실패했어요.');
      setStage('error');
    }
  }

  function accept() {
    const id = selectedId ?? detected?.id;
    if (!id) return;
    onDone(modeToTone(VOICE_MODES[id]));
  }

  function skip() {
    onDone(null);
  }

  function retry() {
    setDetected(null);
    setSelectedId(null);
    setLevels([]);
    setStage('intro');
  }

  // Live "is the mic hearing me" feedback during recording.
  const recentPeak = levels.length ? Math.max(...levels.slice(-10)) : 0;
  const hearing = recentPeak > SILENCE_THRESHOLD;

  return (
    <div className="mf-frame brand voice-frame">
      <div className="mf-header">
        {onHome ? (
          <button type="button" className="mf-home-btn" onClick={onHome}>
            MEGAFONT
          </button>
        ) : (
          <span>MEGAFONT</span>
        )}
        <span>음성으로 시작</span>
      </div>

      {stage === 'intro' && (
        <div className="voice-stage">
          <div className="voice-mic" aria-hidden>
            <div className="voice-mic-ring" />
            <span>🎤</span>
          </div>
          <h1 className="voice-h1">음성으로 시작해볼까요?</h1>
          <p className="voice-body">
            아무 말이나 5초 정도 들려주세요.<br />
            목소리의 결로 글의 음성을 정해요.
          </p>
          <div className="voice-actions">
            <button className="primary-action" onClick={beginRecording}>
              <span>녹음 시작</span>
            </button>
            <button className="voice-skip" onClick={skip}>
              건너뛰고 직접 정하기 →
            </button>
          </div>
          <p className="voice-fineprint">
            마이크 권한이 필요해요. 음성은 폰 안에서만 분석되고 저장되지 않아요.
          </p>
        </div>
      )}

      {stage === 'recording' && (
        <div className="voice-stage">
          <div className="voice-wave-live" aria-hidden>
            {Array.from({ length: WAVE_BARS }).map((_, i) => {
              const l = levels[levels.length - WAVE_BARS + i] ?? 0;
              const hgt = Math.max(0.06, Math.min(1, l * 6));
              return <span key={i} style={{ transform: `scaleY(${hgt})` }} />;
            })}
          </div>
          <div className={'voice-meter ' + (hearing ? 'on' : '')}>
            {hearing ? '잘 들려요' : '더 크게 말해보세요'}
          </div>
          <h1 className="voice-h1">듣고 있어요</h1>
          <p className="voice-body">아무 말이나, 자유롭게.</p>
          <div className="voice-countdown">{Math.ceil(remainingMs / 1000)}초</div>
          <button
            className="voice-skip"
            onClick={async () => {
              await recorderRef.current?.stop();
            }}
          >
            지금 멈추기
          </button>
        </div>
      )}

      {stage === 'result' && detected && (
        <div className="voice-stage">
          <div className="voice-result-label">고른 음성</div>
          <h1 className="voice-h1 voice-mode-name">
            {selectedId ? VOICE_MODES[selectedId].labelKr : detected.labelKr}
          </h1>
          <p className="voice-body">
            목소리는 <b>{detected.labelKr}</b>으로 들렸어요.<br />
            맞으면 그대로, 아니면 아래에서 바꿔주세요.
          </p>

          <div className="voice-mode-grid">
            {MODE_ORDER.map((id) => {
              const m = VOICE_MODES[id];
              const on = (selectedId ?? detected.id) === id;
              return (
                <button
                  key={id}
                  className={'voice-mode-card ' + (on ? 'on' : '')}
                  onClick={() => setSelectedId(id)}
                >
                  <span className="voice-mode-card-kr">{m.labelKr}</span>
                  <span className="voice-mode-card-desc">{m.description}</span>
                  {detected.id === id && <span className="voice-mode-card-tag">추천</span>}
                </button>
              );
            })}
          </div>

          <div className="voice-actions">
            <button className="primary-action" onClick={accept}>
              <span>이대로 시작 →</span>
            </button>
            <button className="voice-skip" onClick={retry}>
              다시 녹음
            </button>
            <button className="voice-skip" onClick={skip}>
              음성 없이 직접 정하기 →
            </button>
          </div>
        </div>
      )}

      {stage === 'silent' && (
        <div className="voice-stage">
          <div className="voice-mic" aria-hidden>
            <span>···</span>
          </div>
          <h1 className="voice-h1">소리가 너무 작아요</h1>
          <p className="voice-body">
            마이크가 목소리를 못 들었어요.<br />
            조금만 더 크게, 가까이서 다시 해볼까요?
          </p>
          <div className="voice-actions">
            <button className="primary-action" onClick={retry}>
              <span>다시 녹음 →</span>
            </button>
            <button className="voice-skip" onClick={skip}>
              건너뛰고 직접 정하기 →
            </button>
          </div>
        </div>
      )}

      {stage === 'error' && (
        <div className="voice-stage">
          <div className="voice-mic" aria-hidden>
            <span>!</span>
          </div>
          <h1 className="voice-h1">음성을 받지 못했어요</h1>
          <p className="voice-body">{errorMsg}</p>
          <div className="voice-actions">
            <button className="primary-action" onClick={skip}>
              <span>건너뛰고 직접 정하기 →</span>
            </button>
            <button className="voice-skip" onClick={retry}>
              다시 시도
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
