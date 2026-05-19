import { useEffect, useRef, useState } from 'react';
import { classify, modeToTone, startRecording } from '../lib/voice';
import type { VoiceMode } from '../lib/voice';
import type { ToneState } from '../types';

type PartialTone = Pick<ToneState, 'font' | 'wght' | 'tone' | 'slnt' | 'size'>;

interface Props {
  onDone: (partialTone: PartialTone | null) => void;
}

type Stage = 'intro' | 'recording' | 'result' | 'error';

const RECORD_MS = 5500;

export default function PhaseZ0Voice({ onDone }: Props) {
  const [stage, setStage] = useState<Stage>('intro');
  const [level, setLevel] = useState(0);
  const [remainingMs, setRemainingMs] = useState(RECORD_MS);
  const [mode, setMode] = useState<VoiceMode | null>(null);
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
    try {
      const rec = await startRecording(RECORD_MS);
      recorderRef.current = rec;
      rec.onLevel((l) => setLevel(l));

      const startedAt = Date.now();
      tickRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startedAt;
        setRemainingMs(Math.max(0, RECORD_MS - elapsed));
      }, 100);

      const analysis = await rec.stop();
      if (tickRef.current) clearInterval(tickRef.current);
      const m = classify(analysis as Parameters<typeof classify>[0]);
      setMode(m);
      setStage('result');
    } catch (err) {
      setErrorMsg((err as Error).message || '음성 입력에 실패했어요.');
      setStage('error');
    }
  }

  function accept() {
    if (!mode) return;
    onDone(modeToTone(mode));
  }

  function skip() {
    onDone(null);
  }

  function retry() {
    setMode(null);
    setStage('intro');
  }

  return (
    <div className="dock-frame brand voice-frame">
      <div className="dock-header">
        <span>DOCK</span>
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
          <div className="voice-wave" aria-hidden>
            <span style={{ transform: `scaleY(${0.2 + Math.min(level * 5, 1) * 0.8})` }} />
            <span style={{ transform: `scaleY(${0.2 + Math.min(level * 4.5, 1) * 0.85})` }} />
            <span style={{ transform: `scaleY(${0.2 + Math.min(level * 5.5, 1) * 0.75})` }} />
            <span style={{ transform: `scaleY(${0.2 + Math.min(level * 4.8, 1) * 0.9})` }} />
            <span style={{ transform: `scaleY(${0.2 + Math.min(level * 5.2, 1) * 0.8})` }} />
            <span style={{ transform: `scaleY(${0.2 + Math.min(level * 4.5, 1) * 0.85})` }} />
            <span style={{ transform: `scaleY(${0.2 + Math.min(level * 5.5, 1) * 0.75})` }} />
          </div>
          <h1 className="voice-h1">듣고 있어요</h1>
          <p className="voice-body">
            아무 말이나, 자유롭게.
          </p>
          <div className="voice-countdown">
            {Math.ceil(remainingMs / 1000)}초
          </div>
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

      {stage === 'result' && mode && (
        <div className="voice-stage">
          <div className="voice-result-label">{mode.labelEn}</div>
          <h1 className="voice-h1 voice-mode-name">{mode.labelKr}</h1>
          <p className="voice-body">
            {mode.description}이네요.<br />
            이 음성으로 시작할게요.
          </p>
          <div className="voice-actions">
            <button className="primary-action" onClick={accept}>
              <span>이대로 시작 →</span>
            </button>
            <button className="voice-skip" onClick={retry}>
              다시 녹음
            </button>
            <button className="voice-skip" onClick={skip}>
              직접 정하기 →
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
