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
  size: 80   // larger default — Z1 is about big type
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

// Z1 always uses NIGHT mood as canvas — the discovery state.
// User picks final palette in Z2.
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

  // First character — not last. Skip leading whitespace.
  const firstChar = useMemo(() => {
    const trimmed = text.replace(/^\s+/u, '');
    return trimmed.length > 0 ? trimmed[0] : '말';
  }, [text]);

  return (
    <div
      className="z-frame"
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

      <div className="z-controls">
        <ControlRow
          label="FONT"
          options={FONT_OPTIONS.map((o) => ({ val: o.val as unknown as number, label: o.label, active: tone.font === o.val }))}
          onPick={(_v, i) => setTone((t) => ({ ...t, font: FONT_OPTIONS[i].val }))}
        />
        <ControlRow
          label="WGHT"
          options={WGHT_OPTIONS.map((o) => ({ val: o.val, label: o.label, active: tone.wght === o.val }))}
          onPick={(v) => setTone((t) => ({ ...t, wght: v }))}
        />
        <ControlRow
          label="TONE"
          options={TONE_OPTIONS.map((o) => ({ val: o.val, label: o.label, active: tone.tone === o.val }))}
          onPick={(v) => setTone((t) => ({ ...t, tone: v }))}
        />
        <ControlRow
          label="SLNT"
          options={SLNT_OPTIONS.map((o) => ({ val: o.val, label: o.label, active: tone.slnt === o.val }))}
          onPick={(v) => setTone((t) => ({ ...t, slnt: v }))}
        />
      </div>

      <div className="z-glyph-stage">
        <div
          className="z-glyph"
          data-glyph={firstChar}
          style={{
            fontFamily: fontMap[tone.font],
            fontWeight: tone.wght,
            fontVariationSettings: `"wght" ${tone.wght}`,
            transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)`,
            color: Z1_MOOD.text
          }}
        >
          {firstChar}
        </div>
      </div>

      <div className="z-size-row">
        <span className="z-axis-mini-label">SIZE</span>
        <input
          type="range"
          min={40}
          max={180}
          step={2}
          value={tone.size}
          onChange={(e) => setTone((t) => ({ ...t, size: parseInt(e.target.value, 10) }))}
        />
        <span className="z-axis-mini-val">{tone.size}</span>
      </div>

      <textarea
        ref={textareaRef}
        className="z-input"
        value={text}
        maxLength={MAX}
        placeholder="여기에 적어주세요 — 첫 글자가 위에 떠올라요"
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        autoFocus
      />

      <div className="z-input-meta">
        <span>{text.length} / {MAX}</span>
        <span>첫 글자만 미리보기 · 색·그래픽은 다음 화면</span>
      </div>

      <button
        className="primary-action"
        disabled={!text.trim()}
        onClick={() => onNext(text.trim().slice(0, MAX), tone)}
      >
        <span>다음 — 톤·구성</span>
      </button>
    </div>
  );
}

function ControlRow({
  label,
  options,
  onPick
}: {
  label: string;
  options: Array<{ val: number; label: string; active: boolean }>;
  onPick: (v: number, i: number) => void;
}) {
  return (
    <div className="z-ctrl">
      <div className="z-ctrl-label">{label}</div>
      <div className="z-ctrl-row">
        {options.map((o, i) => (
          <button
            key={i}
            className={'pill ' + (o.active ? 'on' : '')}
            onClick={() => onPick(o.val, i)}
          >
            <span>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
