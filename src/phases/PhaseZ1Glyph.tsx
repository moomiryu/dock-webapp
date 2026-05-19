import { useEffect, useMemo, useRef, useState } from 'react';
import { clearDraft } from '../lib/draft';
import { fontMap } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import type { ToneState } from '../types';

interface Props {
  initialText: string;
  initialTone?: ToneState | null;
  onNext: (text: string, partialTone: Omit<ToneState, 'paletteIdx' | 'graphicIdx'>) => void;
}

const MAX = 60;
const DEFAULT = {
  font: 'gothic' as const,
  tone: 1.0,
  wght: 400,
  slnt: 0,
  size: 80
};

// FONT options labeled by *mode of utterance* — DOCK's voice-first framing.
// The internal key ('gothic', 'mono', ...) stays for data compatibility.
const FONT_OPTIONS: Array<{ val: ToneState['font']; label: string }> = [
  { val: 'gothic', label: '외침' },   // CRY — Pretendard
  { val: 'mono', label: '선언' },     // STATE — Orbit
  { val: 'myeongjo', label: '속삭임' }, // HUSH — Noto Serif KR
  { val: 'song', label: '노래' }       // SONG — Sunflower (탈네모틀)
];
const TONE_OPTIONS = [
  { val: 0.7, label: '장체' },
  { val: 1.0, label: '평' },
  { val: 1.3, label: '평체' }
];
const WGHT_OPTIONS = [
  { val: 100, label: 'THIN' },
  { val: 400, label: 'RGLR' },
  { val: 700, label: 'BOLD' },
  { val: 900, label: 'BLAK' }
];
const SLNT_OPTIONS = [
  { val: 0, label: '정' },
  { val: -8, label: '경사' }
];

// Korean-English label pairing (Sulki-and-Min idea-pairing).
// VOICE replaces FONT as the axis name — the *choice* is what kind of voice,
// not which typographic family.
const AXIS_LABELS: Record<string, { kr: string; en: string }> = {
  FONT: { kr: '발화', en: 'VOICE' },
  WGHT: { kr: '무게', en: 'WGHT' },
  TONE: { kr: '결', en: 'TONE' },
  SLNT: { kr: '기울기', en: 'SLNT' },
  SIZE: { kr: '크기', en: 'SIZE' }
};

const Z1_MOOD = moods.find((m) => m.id === 'night')!;

export default function PhaseZ1Glyph({ initialText, initialTone, onNext }: Props) {
  const [text, setText] = useState(initialText);
  const [tone, setTone] = useState({
    font: initialTone?.font ?? DEFAULT.font,
    tone: initialTone?.tone ?? DEFAULT.tone,
    wght: initialTone?.wght ?? DEFAULT.wght,
    slnt: initialTone?.slnt ?? DEFAULT.slnt,
    size: initialTone?.size ?? DEFAULT.size
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    document.body.classList.add('themed');
    document.body.style.setProperty('--bg-outer', Z1_MOOD.bg);
  }, []);

  useEffect(() => {
    // Auto-focus textarea on mount so the user can just start typing
    textareaRef.current?.focus();
  }, []);

  const firstChar = useMemo(() => {
    const trimmed = text.replace(/^\s+/u, '');
    return trimmed.length > 0 ? trimmed[0] : null;
  }, [text]);

  const hasContent = firstChar !== null;

  return (
    <div
      className={'z-frame z1 ' + (hasContent ? 'has-content' : 'empty')}
      style={{
        ['--bg' as string]: Z1_MOOD.bg,
        ['--text' as string]: Z1_MOOD.text,
        ['--graphic' as string]: Z1_MOOD.graphic,
        ['--blend' as string]: Z1_MOOD.blend,
        background: Z1_MOOD.bg,
        color: Z1_MOOD.text
      }}
    >
      <div className="z-header">
        <span>DOCK</span>
        <span>1 / 2 · 음성 정하기</span>
      </div>

      <div className="z-glyph-stage">
        {hasContent && firstChar ? (
          <>
            <div
              className="z-glyph"
              data-glyph={firstChar}
              style={{
                fontFamily: fontMap[tone.font],
                fontWeight: tone.wght,
                fontVariationSettings: `"wght" ${tone.wght}`,
                transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)`,
                fontSize: tone.size * 3 + 'px',
                color: Z1_MOOD.text
              }}
            >
              {firstChar}
            </div>
            <div className="z-glyph-caption">첫 글자로 음성의 모양을 정해요</div>
          </>
        ) : (
          <div className="z-glyph-hint">
            <div className="z-glyph-hint-line">한 줄을</div>
            <div className="z-glyph-hint-line">적어보세요</div>
          </div>
        )}
      </div>

      {/* Full-message preview removed — was redundant with textarea.
          Giant glyph shows typography on the first char (the protagonist);
          textarea below is the input itself. */}

      <div className="z-axes">
        <CompactRow
          axisKey="FONT"
          options={FONT_OPTIONS.map((o) => ({ val: o.val as unknown as number, label: o.label, active: tone.font === o.val }))}
          onPick={(_v, i) => setTone((t) => ({ ...t, font: FONT_OPTIONS[i].val }))}
        />
        <CompactRow
          axisKey="WGHT"
          options={WGHT_OPTIONS.map((o) => ({ val: o.val, label: o.label, active: tone.wght === o.val }))}
          onPick={(v) => setTone((t) => ({ ...t, wght: v }))}
        />
        <CompactRow
          axisKey="TONE"
          options={TONE_OPTIONS.map((o) => ({ val: o.val, label: o.label, active: tone.tone === o.val }))}
          onPick={(v) => setTone((t) => ({ ...t, tone: v }))}
        />
        <CompactRow
          axisKey="SLNT"
          options={SLNT_OPTIONS.map((o) => ({ val: o.val, label: o.label, active: tone.slnt === o.val }))}
          onPick={(v) => setTone((t) => ({ ...t, slnt: v }))}
        />
        <div className="z-axis-line">
          <span className="z-axis-label">
            <span className="z-axis-label-kr">{AXIS_LABELS.SIZE.kr}</span>
            <span className="z-axis-label-en">{AXIS_LABELS.SIZE.en}</span>
          </span>
          <input
            type="range"
            min={40}
            max={180}
            step={2}
            value={tone.size}
            onChange={(e) => setTone((t) => ({ ...t, size: parseInt(e.target.value, 10) }))}
          />
          <span className="z-axis-val">{tone.size}</span>
        </div>
      </div>

      <div className="z-write-row">
        <textarea
          ref={textareaRef}
          className="z-input"
          value={text}
          maxLength={MAX}
          placeholder="60자 안에서 한 줄"
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
        />
        <div className="z-write-meta">
          <button
            type="button"
            className="z-clear-btn"
            onClick={() => {
              setText('');
              clearDraft();
              textareaRef.current?.focus();
            }}
            aria-label="지우기"
            disabled={!text}
          >
            지우기
          </button>
          <div className="z-counter-inline">{text.length}<span>/{MAX}</span></div>
        </div>
      </div>

      <button
        className="primary-action"
        disabled={!text.trim()}
        onClick={() => onNext(text.trim().slice(0, MAX), tone)}
      >
        <span>이 음성으로, 다음 →</span>
      </button>

      <div className="z-progress">
        <span className="dot on" /><span className="dot" />
        <span className="z-progress-label">음성 → 색·그래픽</span>
      </div>
    </div>
  );
}

function CompactRow({
  axisKey,
  options,
  onPick
}: {
  axisKey: keyof typeof AXIS_LABELS;
  options: Array<{ val: number; label: string; active: boolean }>;
  onPick: (v: number, i: number) => void;
}) {
  const { kr, en } = AXIS_LABELS[axisKey];
  return (
    <div className="z-axis-line">
      <span className="z-axis-label">
        <span className="z-axis-label-kr">{kr}</span>
        <span className="z-axis-label-en">{en}</span>
      </span>
      <div className="z-axis-options">
        {options.map((o, i) => (
          <button
            key={i}
            className={'z-axis-opt ' + (o.active ? 'on' : '')}
            onClick={() => onPick(o.val, i)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
