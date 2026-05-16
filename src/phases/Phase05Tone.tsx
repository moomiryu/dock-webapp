import { useEffect, useRef, useState } from 'react';
import DockFrame from '../components/DockFrame';
import { fontMap, graphics, palettes } from '../lib/palettes';
import type { ToneState } from '../types';

interface Props {
  initialText: string;
  initialTone?: ToneState | null;
  onSubmit: (text: string, tone: ToneState) => void;
}

const DEFAULT_TONE: ToneState = {
  font: 'gothic',
  tone: 1.0,
  wght: 400,
  slnt: 0,
  size: 40,
  paletteIdx: 0,
  graphicIdx: -1
};

export default function Phase05Tone({ initialText, initialTone, onSubmit }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const txtRef = useRef<HTMLDivElement>(null);
  const gfxRef = useRef<HTMLDivElement>(null);
  const vuBarRef = useRef<HTMLDivElement>(null);
  const voiceBtnRef = useRef<HTMLButtonElement>(null);
  const szRef = useRef<HTMLInputElement>(null);
  const szNumRef = useRef<HTMLSpanElement>(null);
  const charNRef = useRef<HTMLSpanElement>(null);

  // st mirrors prototype state; we keep it as ref to avoid re-renders.
  const stRef = useRef<ToneState>({ ...DEFAULT_TONE, ...(initialTone ?? {}) });
  const [, forceRerender] = useState(0);

  useEffect(() => {
    const app = frameRef.current!;
    const txt = txtRef.current!;
    const gfx = gfxRef.current!;
    const vuBar = vuBarRef.current!;
    const voiceBtn = voiceBtnRef.current!;
    const sz = szRef.current!;
    const szN = szNumRef.current!;
    const charN = charNRef.current!;
    const body = document.body;
    const st = stRef.current;

    txt.innerText = initialText || '저는 과기대를 사랑하는데 총장님은 아니신가봐요';

    let pulseTimer: number | null = null;
    let pulseLineIdx = 0;
    let lineCount = 0;
    let isEditing = false;

    function buildSpans() {
      const text = txt.innerText.trim();
      if (!text) return;
      const words = text.split(/\s+/);
      txt.innerHTML = words.map((w) => `<span class="word">${escapeHtml(w)}</span>`).join(' ');
    }

    function escapeHtml(s: string) {
      return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    }

    function detectLines() {
      const spans = txt.querySelectorAll<HTMLSpanElement>('.word');
      if (!spans.length) {
        lineCount = 0;
        return;
      }
      let curTop: number | null = null;
      let curLine = -1;
      spans.forEach((s) => {
        const top = Math.round(s.getBoundingClientRect().top);
        if (curTop === null || Math.abs(top - curTop) > 5) {
          curLine++;
          curTop = top;
        }
        s.dataset.line = String(curLine);
      });
      lineCount = curLine + 1;
    }

    function pulseTick() {
      if (lineCount === 0) return;
      const spans = txt.querySelectorAll<HTMLSpanElement>('.word');
      spans.forEach((s) => {
        s.classList.toggle('active', parseInt(s.dataset.line ?? '-1', 10) === pulseLineIdx);
      });
      pulseLineIdx = (pulseLineIdx + 1) % lineCount;
    }

    function startPulse() {
      if (isEditing) return;
      if (pulseTimer) {
        clearInterval(pulseTimer);
        pulseTimer = null;
      }
      buildSpans();
      requestAnimationFrame(() => {
        detectLines();
        pulseLineIdx = 0;
        pulseTick();
        pulseTimer = window.setInterval(pulseTick, 2400);
      });
    }

    function stopPulse() {
      if (pulseTimer) {
        clearInterval(pulseTimer);
        pulseTimer = null;
      }
      txt.innerHTML = txt.innerText;
    }

    function applyStyle() {
      txt.style.fontFamily = fontMap[st.font];
      txt.style.fontSize = st.size + 'px';
      txt.style.transform = `scaleX(${st.tone}) skewX(${st.slnt}deg)`;
      if (isEditing) {
        txt.style.setProperty('--wght-base', String(st.wght));
        txt.style.setProperty('--wght-active', String(st.wght));
      } else {
        const low = Math.max(100, Math.round(st.wght * 0.5));
        txt.style.setProperty('--wght-base', String(low));
        txt.style.setProperty('--wght-active', String(st.wght));
      }
      if (!isEditing && pulseTimer) {
        requestAnimationFrame(() => detectLines());
      }
    }

    function applyPalette(i: number) {
      const p = palettes[i];
      app.style.setProperty('--bg', p.bg);
      app.style.setProperty('--text', p.text);
      app.style.setProperty('--graphic', p.graphic);
      body.style.setProperty('--bg-outer', p.bg);
      body.classList.add('themed');
      st.paletteIdx = i;
    }

    function updateCharCount() {
      const len = txt.innerText.length;
      charN.textContent = String(len);
      if (len > 60) {
        txt.innerText = txt.innerText.slice(0, 60);
        const range = document.createRange();
        range.selectNodeContents(txt);
        range.collapse(false);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
        charN.textContent = '60';
      }
    }

    function updateUIFromState() {
      app.querySelectorAll<HTMLDivElement>('.btn-row').forEach((g) => {
        const ax = g.dataset.axis as keyof ToneState | undefined;
        if (!ax) return;
        g.querySelectorAll<HTMLButtonElement>('.pill').forEach((b) => {
          const raw = b.dataset.val ?? '';
          const val = ax === 'font' ? raw : parseFloat(raw);
          b.classList.toggle('on', val === st[ax]);
        });
      });
      sz.value = String(st.size);
      szN.textContent = String(st.size);
    }

    // --- control wiring ---
    const groupCleanups: Array<() => void> = [];
    app.querySelectorAll<HTMLDivElement>('.btn-row').forEach((g) => {
      const ax = g.dataset.axis as keyof ToneState;
      g.querySelectorAll<HTMLButtonElement>('.pill').forEach((b) => {
        const handler = () => {
          g.querySelectorAll<HTMLButtonElement>('.pill').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          const v = b.dataset.val ?? '';
          if (ax === 'font') {
            st.font = v as ToneState['font'];
          } else {
            (st as unknown as Record<string, number>)[ax] = parseFloat(v);
          }
          applyStyle();
        };
        b.addEventListener('click', handler);
        groupCleanups.push(() => b.removeEventListener('click', handler));
      });
    });

    const sizeHandler = (e: Event) => {
      st.size = parseInt((e.target as HTMLInputElement).value, 10);
      szN.textContent = String(st.size);
      applyStyle();
    };
    sz.addEventListener('input', sizeHandler);

    // --- voice ---
    let audioCtx: AudioContext | null = null;
    let mediaStream: MediaStream | null = null;
    let analyser: AnalyserNode | null = null;
    let isRecording = false;
    let recStart = 0;
    const recDuration = 12000;
    let samples: Array<{ volume: number; centroid: number; bandwidth: number }> = [];

    function applyVoiceMapping(volume: number, centroid: number, bw: number) {
      const wghts = [200, 300, 400, 600, 800, 900];
      const wIdx = Math.min(5, Math.floor(volume * 6));
      st.wght = wghts[wIdx];
      st.slnt = centroid > 0.13 ? -8 : 0;
      if (bw < 0.05) st.tone = 0.7;
      else if (bw > 0.10) st.tone = 1.3;
      else st.tone = 1.0;
      updateUIFromState();
      applyStyle();
    }

    function analyzeLoop() {
      if (!isRecording || !analyser) return;
      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const timeData = new Float32Array(analyser.fftSize);
      analyser.getByteFrequencyData(freqData);
      analyser.getFloatTimeDomainData(timeData);

      let rms = 0;
      for (let i = 0; i < timeData.length; i++) rms += timeData[i] * timeData[i];
      rms = Math.sqrt(rms / timeData.length);
      const volume = Math.min(1, rms * 6);

      let cSum = 0;
      let aSum = 0;
      for (let i = 0; i < freqData.length; i++) {
        cSum += i * freqData[i];
        aSum += freqData[i];
      }
      const centroid = aSum > 100 ? cSum / aSum / freqData.length : 0;

      let bw = 0;
      if (aSum > 100) {
        for (let i = 0; i < freqData.length; i++) {
          bw += Math.pow(i - centroid * freqData.length, 2) * freqData[i];
        }
        bw = Math.sqrt(bw / aSum) / freqData.length;
      }

      if (volume > 0.02) {
        samples.push({ volume, centroid, bandwidth: bw });
      }
      vuBar.style.width = volume * 100 + '%';
      applyVoiceMapping(volume, centroid, bw);

      const elapsed = performance.now() - recStart;
      if (elapsed < recDuration) {
        requestAnimationFrame(analyzeLoop);
      } else {
        finalizeVoice();
      }
    }

    async function startVoice() {
      if (isRecording) return;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const Ctx: typeof AudioContext =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtx = new Ctx();
        const source = audioCtx.createMediaStreamSource(mediaStream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.6;
        source.connect(analyser);

        isRecording = true;
        samples = [];
        recStart = performance.now();
        voiceBtn.classList.add('rec');
        voiceBtn.querySelector('span')!.innerHTML =
          '<span class="rec-dot"></span>녹음 중... 다시 누르면 즉시 완료';
        vuBar.classList.add('show');
        stopPulse();
        analyzeLoop();
      } catch (err) {
        alert('마이크 권한이 필요해요: ' + (err as Error).message);
      }
    }

    function finalizeVoice() {
      if (!isRecording) return;
      isRecording = false;
      if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
        mediaStream = null;
      }
      if (audioCtx) {
        audioCtx.close().catch(() => {});
        audioCtx = null;
      }
      analyser = null;

      if (samples.length > 5) {
        const avg = samples.reduce(
          (a, s) => ({
            volume: a.volume + s.volume,
            centroid: a.centroid + s.centroid,
            bandwidth: a.bandwidth + s.bandwidth
          }),
          { volume: 0, centroid: 0, bandwidth: 0 }
        );
        avg.volume /= samples.length;
        avg.centroid /= samples.length;
        avg.bandwidth /= samples.length;
        applyVoiceMapping(avg.volume, avg.centroid, avg.bandwidth);
      }
      samples = [];

      voiceBtn.classList.remove('rec');
      voiceBtn.querySelector('span')!.innerHTML = '🎤 다시 녹음';
      vuBar.classList.remove('show');
      vuBar.style.width = '0%';
      setTimeout(() => startPulse(), 200);
    }

    const voiceClick = () => {
      if (isRecording) finalizeVoice();
      else startVoice();
    };
    voiceBtn.addEventListener('click', voiceClick);

    const focusHandler = () => {
      isEditing = true;
      stopPulse();
      applyStyle();
    };
    const blurHandler = () => {
      isEditing = false;
      updateCharCount();
      setTimeout(() => {
        applyStyle();
        startPulse();
      }, 100);
    };
    const inputHandler = () => updateCharCount();
    txt.addEventListener('focus', focusHandler);
    txt.addEventListener('blur', blurHandler);
    txt.addEventListener('input', inputHandler);

    const starBtn = app.querySelector('#starBtn') as HTMLButtonElement;
    const colorBtn = app.querySelector('#colorBtn') as HTMLButtonElement;
    const resetBtn = app.querySelector('#resetBtn') as HTMLButtonElement;

    const starClick = () => {
      let n = st.graphicIdx;
      do {
        n = Math.floor(Math.random() * graphics.length);
      } while (n === st.graphicIdx && graphics.length > 1);
      if (st.graphicIdx !== -1 && Math.random() < 0.15) {
        gfx.classList.remove('active');
        setTimeout(() => {
          gfx.innerHTML = '';
        }, 500);
        st.graphicIdx = -1;
      } else {
        st.graphicIdx = n;
        gfx.innerHTML = graphics[n];
        gfx.classList.add('active');
      }
    };
    starBtn.addEventListener('click', starClick);

    const colorClick = () => {
      let n = st.paletteIdx;
      do {
        n = Math.floor(Math.random() * palettes.length);
      } while (n === st.paletteIdx && palettes.length > 1);
      applyPalette(n);
    };
    colorBtn.addEventListener('click', colorClick);

    const resetClick = () => {
      st.font = 'gothic';
      st.tone = 1.0;
      st.wght = 400;
      st.slnt = 0;
      st.size = 40;
      sz.value = '40';
      szN.textContent = '40';
      app.querySelectorAll<HTMLDivElement>('.btn-row').forEach((g) => {
        const ax = g.dataset.axis as keyof ToneState;
        const dv: Record<string, string> = { font: 'gothic', tone: '1.0', wght: '400', slnt: '0' };
        g.querySelectorAll<HTMLButtonElement>('.pill').forEach((b) => b.classList.toggle('on', b.dataset.val === dv[ax]));
      });
      gfx.classList.remove('active');
      setTimeout(() => {
        gfx.innerHTML = '';
      }, 500);
      st.graphicIdx = -1;
      applyPalette(0);
      applyStyle();
      voiceBtn.querySelector('span')!.innerHTML = '🎤 음성으로 톤 결정 (최대 12초)';
    };
    resetBtn.addEventListener('click', resetClick);

    const resizeHandler = () => {
      if (!isEditing && pulseTimer) {
        requestAnimationFrame(() => detectLines());
      }
    };
    window.addEventListener('resize', resizeHandler);

    // initial apply
    applyPalette(st.paletteIdx);
    if (st.graphicIdx >= 0) {
      gfx.innerHTML = graphics[st.graphicIdx];
      gfx.classList.add('active');
    }
    updateUIFromState();
    applyStyle();
    updateCharCount();
    startPulse();

    forceRerender((n) => n + 1); // so submit button reflects current text

    return () => {
      if (pulseTimer) clearInterval(pulseTimer);
      window.removeEventListener('resize', resizeHandler);
      sz.removeEventListener('input', sizeHandler);
      voiceBtn.removeEventListener('click', voiceClick);
      txt.removeEventListener('focus', focusHandler);
      txt.removeEventListener('blur', blurHandler);
      txt.removeEventListener('input', inputHandler);
      starBtn.removeEventListener('click', starClick);
      colorBtn.removeEventListener('click', colorClick);
      resetBtn.removeEventListener('click', resetClick);
      groupCleanups.forEach((fn) => fn());
      if (mediaStream) mediaStream.getTracks().forEach((t) => t.stop());
      if (audioCtx) audioCtx.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSubmit() {
    const txt = txtRef.current!;
    const text = txt.innerText.trim().slice(0, 60);
    if (!text) return;
    onSubmit(text, { ...stRef.current });
  }

  return (
    <DockFrame phaseLabel="PHASE 05 / 톤 결정">
      <div ref={frameRef}>
        <div className="preview-box">
          <div className="graphic-layer" ref={gfxRef} />
          <div className="preview-text" ref={txtRef} contentEditable spellCheck={false} />
          <div className="vu-bar" ref={vuBarRef} />
        </div>
        <div className="char-counter">
          <span ref={charNRef}>0</span> / 60
        </div>

        <div className="ctrl" style={{ marginTop: 14 }}>
          <button className="pill voice-btn" ref={voiceBtnRef}>
            <span>🎤 음성으로 톤 결정 (최대 12초)</span>
          </button>
        </div>

        <div className="ctrl">
          <div className="ctrl-label">FONT — 폰트</div>
          <div className="btn-row" data-axis="font">
            <button className="pill" data-val="mono"><span>모노</span></button>
            <button className="pill on" data-val="gothic"><span>고딕</span></button>
            <button className="pill" data-val="myeongjo"><span>명조</span></button>
          </div>
        </div>

        <div className="ctrl">
          <div className="ctrl-label">
            TONE — 장체 ↔ 평체 <span className="voice-hint">← 음성: 음역 폭</span>
          </div>
          <div className="btn-row" data-axis="tone">
            <button className="pill" data-val="0.7"><span>장체</span></button>
            <button className="pill on" data-val="1.0"><span>평</span></button>
            <button className="pill" data-val="1.3"><span>평체</span></button>
          </div>
        </div>

        <div className="ctrl">
          <div className="ctrl-label">
            WGHT — 굵기 <span className="voice-hint">← 음성: 볼륨</span>
          </div>
          <div className="btn-row" data-axis="wght">
            <button className="pill" data-val="100"><span>THIN</span></button>
            <button className="pill" data-val="300"><span>LGHT</span></button>
            <button className="pill on" data-val="400"><span>RGLR</span></button>
            <button className="pill" data-val="600"><span>SEMI</span></button>
            <button className="pill" data-val="800"><span>BOLD</span></button>
            <button className="pill" data-val="900"><span>BLAK</span></button>
          </div>
        </div>

        <div className="ctrl">
          <div className="ctrl-label">
            SLNT — 기울기 <span className="voice-hint">← 음성: 음 높이</span>
          </div>
          <div className="btn-row" data-axis="slnt">
            <button className="pill on" data-val="0"><span>UPRT</span></button>
            <button className="pill" data-val="-8"><span>OBLQ</span></button>
          </div>
        </div>

        <div className="ctrl">
          <div className="ctrl-label">SIZE — 크기</div>
          <div className="slider-row">
            <input type="range" ref={szRef} min={18} max={72} defaultValue={40} step={1} />
            <span className="num" ref={szNumRef}>40</span>
          </div>
        </div>

        <div className="actions">
          <button className="pill" id="starBtn"><span><span className="star-glyph">★</span> STAR</span></button>
          <button className="pill" id="colorBtn"><span>COLOR</span></button>
          <button className="pill" id="resetBtn"><span>RESET</span></button>
        </div>

        <button className="primary-action" onClick={handleSubmit}>
          <span>맡기기</span>
        </button>
      </div>
    </DockFrame>
  );
}
