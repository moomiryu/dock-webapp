import { useEffect, useState } from 'react';
import { fontMap } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import type { ToneState } from '../types';

interface Props {
  text: string;                                   // already typed in Z1
  initialTone?: ToneState | null;
  onBack: () => void;
  onNext: (partialTone: Omit<ToneState, 'paletteIdx' | 'graphicIdx'>) => void;
}

const DEFAULT = {
  font: 'gothic' as const,
  tone: 1.0,
  wght: 400,
  slnt: 0,
  size: 80
};

const FONT_OPTIONS: Array<{ val: ToneState['font']; label: string }> = [
  { val: 'gothic', label: '외침' },
  { val: 'mono', label: '선언' },
  { val: 'myeongjo', label: '속삭임' },
  { val: 'song', label: '노래' }
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

const AXIS_LABELS: Record<string, { kr: string; en: string }> = {
  FONT: { kr: '발화', en: 'VOICE' },
  WGHT: { kr: '무게', en: 'WGHT' },
  TONE: { kr: '결', en: 'TONE' },
  SLNT: { kr: '기울기', en: 'SLNT' },
  SIZE: { kr: '크기', en: 'SIZE' }
};

const Z_MOOD = moods.find((m) => m.id === 'night')!;

export default function PhaseZ2Glyph({ text, initialTone, onBack, onNext }: Props) {
  const [tone, setTone] = useState({
    font: initialTone?.font ?? DEFAULT.font,
    tone: initialTone?.tone ?? DEFAULT.tone,
    wght: initialTone?.wght ?? DEFAULT.wght,
    slnt: initialTone?.slnt ?? DEFAULT.slnt,
    size: initialTone?.size ?? DEFAULT.size
  });

  useEffect(() => {
    document.body.classList.add('themed');
    document.body.style.setProperty('--bg-outer', Z_MOOD.bg);
  }, []);

  // First character of the (Z1-typed) message — the protagonist for axes tuning.
  const firstChar = (() => {
    const trimmed = text.replace(/^\s+/u, '');
    return trimmed.length > 0 ? trimmed[0] : '음';
  })();

  return (
    <div
      className="z-frame z1 has-content"
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
        <button className="z-back" onClick={onBack} aria-label="글로 돌아가기">
          ← 글 다시
        </button>
        <span>2 / 3 · 자형 정하기</span>
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
            fontSize: tone.size * 3 + 'px',
            color: Z_MOOD.text
          }}
        >
          {firstChar}
        </div>
        <div className="z-glyph-caption">첫 글자로 자형을 정해요</div>
      </div>

      <div className="z-axes">
        <CompactRow
          axisKey="FONT"
          options={FONT_OPTIONS.map((o) => ({
            val: o.val as unknown as number,
            label: o.label,
            active: tone.font === o.val
          }))}
          onPick={(_v, i) => setTone((t) => ({ ...t, font: FONT_OPTIONS[i].val }))}
        />
        <CompactRow
          axisKey="WGHT"
          options={WGHT_OPTIONS.map((o) => ({
            val: o.val,
            label: o.label,
            active: tone.wght === o.val
          }))}
          onPick={(v) => setTone((t) => ({ ...t, wght: v }))}
        />
        <CompactRow
          axisKey="TONE"
          options={TONE_OPTIONS.map((o) => ({
            val: o.val,
            label: o.label,
            active: tone.tone === o.val
          }))}
          onPick={(v) => setTone((t) => ({ ...t, tone: v }))}
        />
        <CompactRow
          axisKey="SLNT"
          options={SLNT_OPTIONS.map((o) => ({
            val: o.val,
            label: o.label,
            active: tone.slnt === o.val
          }))}
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

      <button className="primary-action" onClick={() => onNext(tone)}>
        <span>이 자형으로, 다음 →</span>
      </button>

      <div className="z-progress">
        <span className="dot on" />
        <span className="dot on" />
        <span className="dot" />
        <span className="z-progress-label">자형 → 색·그래픽</span>
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
