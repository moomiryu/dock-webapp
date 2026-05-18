import { useEffect, useMemo, useRef, useState } from 'react';
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

const FONT_OPTIONS: Array<{ val: ToneState['font']; label: string }> = [
  { val: 'mono', label: '모노' },
  { val: 'gothic', label: '고딕' },
  { val: 'myeongjo', label: '명조' }
];
const TONE_OPTIONS = [
  { val: 0.7, label: '장' },
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
  { val: 0, label: 'UPRT' },
  { val: -8, label: 'OBLQ' }
];

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
        <span>Z1 · 자형 발견</span>
      </div>

      <div className="z-glyph-stage">
        {hasContent ? (
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
            <div className="z-glyph-caption">첫 자 — 발화의 voice</div>
          </>
        ) : (
          <div className="z-glyph-hint">
            <div className="z-glyph-hint-line">메시지를</div>
            <div className="z-glyph-hint-line">적어주세요</div>
          </div>
        )}
      </div>

      {hasContent && text.trim().length > 1 && (
        <div
          className="z-message-preview"
          style={{
            fontFamily: fontMap[tone.font],
            fontWeight: tone.wght,
            fontVariationSettings: `"wght" ${tone.wght}`,
            transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)`,
            color: Z1_MOOD.text
          }}
        >
          {text.trim().slice(0, MAX)}
        </div>
      )}

      <div className="z-axes">
        <CompactRow
          label="FONT"
          options={FONT_OPTIONS.map((o) => ({ val: o.val as unknown as number, label: o.label, active: tone.font === o.val }))}
          onPick={(_v, i) => setTone((t) => ({ ...t, font: FONT_OPTIONS[i].val }))}
        />
        <CompactRow
          label="WGHT"
          options={WGHT_OPTIONS.map((o) => ({ val: o.val, label: o.label, active: tone.wght === o.val }))}
          onPick={(v) => setTone((t) => ({ ...t, wght: v }))}
        />
        <CompactRow
          label="TONE"
          options={TONE_OPTIONS.map((o) => ({ val: o.val, label: o.label, active: tone.tone === o.val }))}
          onPick={(v) => setTone((t) => ({ ...t, tone: v }))}
        />
        <CompactRow
          label="SLNT"
          options={SLNT_OPTIONS.map((o) => ({ val: o.val, label: o.label, active: tone.slnt === o.val }))}
          onPick={(v) => setTone((t) => ({ ...t, slnt: v }))}
        />
        <div className="z-axis-line">
          <span className="z-axis-label">SIZE</span>
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
          placeholder="여기에 적어주세요"
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
        />
        <div className="z-counter-inline">{text.length}<span>/{MAX}</span></div>
      </div>

      <button
        className="primary-action"
        disabled={!text.trim()}
        onClick={() => onNext(text.trim().slice(0, MAX), tone)}
      >
        <span>다음 — 톤·구성</span>
      </button>

      <div className="z-progress">
        <span className="dot on" /><span className="dot" />
        <span className="z-progress-label">자형 → 구성</span>
      </div>
    </div>
  );
}

function CompactRow({
  label,
  options,
  onPick
}: {
  label: string;
  options: Array<{ val: number; label: string; active: boolean }>;
  onPick: (v: number, i: number) => void;
}) {
  return (
    <div className="z-axis-line">
      <span className="z-axis-label">{label}</span>
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
