import { useEffect, useRef, useState } from 'react';
import { clearDraft } from '../lib/draft';
import { fontMap } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import type { ToneState } from '../types';

interface Props {
  initialText: string;
  /** Tone preset from Z0 voice intro (or null if skipped). Used to render
      a small voice badge so the user remembers what voice they chose. */
  voicePreset?: Pick<ToneState, 'font' | 'wght'> | null;
  onNext: (text: string) => void;
}

const MAX = 60;
const Z_MOOD = moods.find((m) => m.id === 'night')!;

// Same mapping as Z0/Z2 — kept for displaying which voice was set.
const VOICE_LABELS: Record<ToneState['font'], { kr: string; en: string }> = {
  gothic: { kr: '외침', en: 'CRY' },
  mono: { kr: '선언', en: 'STATE' },
  myeongjo: { kr: '속삭임', en: 'HUSH' },
  song: { kr: '노래', en: 'SONG' }
};

export default function PhaseZ1Write({ initialText, voicePreset, onNext }: Props) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.body.classList.add('themed');
    document.body.style.setProperty('--bg-outer', Z_MOOD.bg);
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const voiceLabel = voicePreset ? VOICE_LABELS[voicePreset.font] : null;

  return (
    <div
      className="z-frame z-write"
      style={{
        ['--bg' as string]: Z_MOOD.bg,
        ['--text' as string]: Z_MOOD.text,
        ['--graphic' as string]: Z_MOOD.graphic,
        ['--blend' as string]: Z_MOOD.blend,
        background: Z_MOOD.bg,
        color: Z_MOOD.text
      }}
    >
      <div className="z-header">
        <span>DOCK</span>
        <span>1 / 3 · 한 줄 적기</span>
      </div>

      {voiceLabel && (
        <div className="z-voice-badge">
          <span className="z-voice-badge-label">지금 음성</span>
          <span
            className="z-voice-badge-value"
            style={{ fontFamily: fontMap[voicePreset!.font] }}
          >
            {voiceLabel.kr} <span className="z-voice-badge-en">{voiceLabel.en}</span>
          </span>
        </div>
      )}

      <div className="z-write-stage">
        <textarea
          ref={textareaRef}
          className="z-input z-input-big"
          value={text}
          maxLength={MAX}
          placeholder="한 줄 적어보세요"
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
        />
      </div>

      <div className="z-write-meta-row">
        <button
          type="button"
          className="z-clear-btn"
          onClick={() => {
            setText('');
            clearDraft();
            textareaRef.current?.focus();
          }}
          disabled={!text}
        >
          지우기
        </button>
        <div className="z-counter-inline">
          {text.length}
          <span>/{MAX}</span>
        </div>
      </div>

      <button
        className="primary-action"
        disabled={!text.trim()}
        onClick={() => onNext(text.trim().slice(0, MAX))}
      >
        <span>이대로, 자형 정하기 →</span>
      </button>

      <div className="z-progress">
        <span className="dot on" />
        <span className="dot" />
        <span className="dot" />
        <span className="z-progress-label">쓰기 → 자형 → 색·그래픽</span>
      </div>
    </div>
  );
}
