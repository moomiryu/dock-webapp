import { useEffect, useState } from 'react';
import { fontMap } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import type { ToneState } from '../types';

type PartialTone = Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;

interface Props {
  initialTone?: PartialTone | null;
  /** Tone preset from the voice intro (or null if skipped). Shows a small badge. */
  voicePreset?: Pick<ToneState, 'font' | 'wght'> | null;
  onBack: () => void;
  onNext: (partialTone: PartialTone) => void;
}

// Glyph tuning happens before the message is written, so we shape a short
// representative sample word ("발화") instead of a lone character.
const SAMPLE_TEXT = '발화';

const DEFAULT = {
  font: 'gothic' as const,
  tone: 1.0,
  wght: 500,
  slnt: 0,
  size: 80
};

const FONT_OPTIONS: Array<{ val: ToneState['font']; label: string }> = [
  { val: 'gothic', label: '외침' },
  { val: 'mono', label: '선언' },
  { val: 'myeongjo', label: '속삭임' },
  { val: 'song', label: '노래' }
];
// Slider stops — left → right. Each maps to a discrete tone value.
const WGHT_STOPS = [
  { val: 300, label: '여리게' },
  { val: 500, label: '보통' },
  { val: 700, label: '세게' }
];
// Width (scaleX): leisurely/wide ↔ nimble/narrow
const TONE_STOPS = [
  { val: 1.3, label: '느긋하게' },
  { val: 1.0, label: '보통' },
  { val: 0.7, label: '날렵하게' }
];
const SLNT_STOPS = [
  { val: 0, label: '또박또박' },
  { val: -8, label: '툭툭' }
];

const VOICE_LABELS: Record<ToneState['font'], { kr: string; en: string }> = {
  gothic: { kr: '외침', en: 'CRY' },
  mono: { kr: '선언', en: 'STATE' },
  myeongjo: { kr: '속삭임', en: 'HUSH' },
  song: { kr: '노래', en: 'SONG' }
};

const AXIS_LABELS: Record<string, { kr: string; en: string }> = {
  FONT: { kr: '형태', en: 'FONT' },
  WGHT: { kr: '굵기', en: 'WGHT' },
  TONE: { kr: '너비', en: 'WDTH' },
  SLNT: { kr: '기울기', en: 'SLNT' },
  SIZE: { kr: '크기', en: 'SIZE' }
};

const Z_MOOD = moods.find((m) => m.id === 'night')!;

export default function PhaseGlyph({ initialTone, voicePreset, onBack, onNext }: Props) {
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

  const voiceLabel = voicePreset ? VOICE_LABELS[voicePreset.font] : null;

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
        <button className="z-back" onClick={onBack} aria-label="음성으로 돌아가기">
          ← 음성 다시
        </button>
        <span>1 / 3 · 자형 정하기</span>
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

      <div className="z-glyph-stage">
        <div
          className="z-glyph"
          data-glyph={SAMPLE_TEXT}
          style={{
            fontFamily: fontMap[tone.font],
            fontWeight: tone.wght,
            fontVariationSettings: `"wght" ${tone.wght}`,
            transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)`,
            fontSize: Math.round(tone.size * 1.8) + 'px',
            color: Z_MOOD.text
          }}
        >
          {SAMPLE_TEXT}
        </div>
        <div className="z-glyph-caption">예시 ‘발화’로 형태를 정해요</div>
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
        <StepSlider axisKey="WGHT" stops={WGHT_STOPS} value={tone.wght} onPick={(v) => setTone((t) => ({ ...t, wght: v }))} />
        <StepSlider axisKey="TONE" stops={TONE_STOPS} value={tone.tone} onPick={(v) => setTone((t) => ({ ...t, tone: v }))} />
        <StepSlider axisKey="SLNT" stops={SLNT_STOPS} value={tone.slnt} onPick={(v) => setTone((t) => ({ ...t, slnt: v }))} />
        <div className="z-axis-line">
          <span className="z-axis-label">
            <span className="z-axis-label-kr">{AXIS_LABELS.SIZE.kr}</span>
            <span className="z-axis-label-en">{AXIS_LABELS.SIZE.en}</span>
          </span>
          <span className="z-size-end">작게</span>
          <input
            type="range"
            min={40}
            max={180}
            step={2}
            value={tone.size}
            onChange={(e) => setTone((t) => ({ ...t, size: parseInt(e.target.value, 10) }))}
          />
          <span className="z-size-end">크게</span>
        </div>
      </div>

      <button className="primary-action" onClick={() => onNext(tone)}>
        <span>이 자형으로, 다음 →</span>
      </button>

      <div className="z-progress">
        <span className="dot on" />
        <span className="dot" />
        <span className="dot" />
        <span className="z-progress-label">자형 → 효과 → 미리보기</span>
      </div>
    </div>
  );
}

function StepSlider({
  axisKey,
  stops,
  value,
  onPick
}: {
  axisKey: keyof typeof AXIS_LABELS;
  stops: Array<{ val: number; label: string }>;
  value: number;
  onPick: (v: number) => void;
}) {
  const { kr, en } = AXIS_LABELS[axisKey];
  // Snap the current value to the nearest stop (handles voice presets that
  // don't land exactly on a stop value).
  const idx = stops.reduce(
    (best, s, i) => (Math.abs(s.val - value) < Math.abs(stops[best].val - value) ? i : best),
    0
  );
  return (
    <div className="z-axis-line z-slider-line">
      <span className="z-axis-label">
        <span className="z-axis-label-kr">{kr}</span>
        <span className="z-axis-label-en">{en}</span>
      </span>
      <div className="z-slider-wrap">
        <input
          type="range"
          min={0}
          max={stops.length - 1}
          step={1}
          value={idx}
          onChange={(e) => onPick(stops[parseInt(e.target.value, 10)].val)}
        />
        <div className="z-slider-stops">
          {stops.map((s, i) => (
            <button
              key={i}
              type="button"
              className={'z-slider-stop ' + (i === idx ? 'on' : '')}
              onClick={() => onPick(s.val)}
            >
              {s.label}
            </button>
          ))}
        </div>
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
