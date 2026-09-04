import { useState } from 'react';
import BackButton from '../components/BackButton';
import { fontMap } from '../lib/palettes';
import type { ToneState } from '../types';

type PartialTone = Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;

interface Props {
  initialTone?: PartialTone | null;
  /** Tone preset from the voice intro (or null if skipped). Shows a small badge. */
  voicePreset?: Pick<ToneState, 'font' | 'wght'> | null;
  /** 이 화면에 어디서 들어왔는지 — 뒤로 가기 라벨이 그걸 그대로 말한다. */
  backLabel: string;
  onBack: () => void;
  onNext: (partialTone: PartialTone) => void;
}

// Glyph tuning happens before the message is written, so we shape a short
// representative sample word ("발화") instead of a lone character.
const SAMPLE_TEXT = '발화';

const DEFAULT = {
  font: 'ttoryeot' as const,
  tone: 1.0,
  wght: 500,
  slnt: 0,
  size: 44
};

// 자형 4종 — 태도(형용사)로 고르고, 아래에 서체 계열을 병기한다.
// 정도가 아니라 종류라서 슬라이더가 아니라 선택이다.
const STYLE_OPTIONS: Array<{ val: ToneState['font']; label: string; kind: string }> = [
  { val: 'doran', label: '다정한', kind: '손글씨' },
  { val: 'deulseok', label: '짓궂은', kind: '탈네모' },
  { val: 'ttoryeot', label: '당당한', kind: '고딕' },
  { val: 'chabun', label: '정갈한', kind: '명조' }
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
// 기울기 is a continuous slant, 0° (또박또박) → 28° (흘림). Stored as a negative
// skewX so the text leans the same direction as before.
const SLNT_MAX = 28;

const FONT_LABELS: Record<ToneState['font'], string> = {
  doran: '다정한',
  chabun: '정갈한',
  botong: '보통',
  ttoryeot: '당당한',
  deulseok: '짓궂은'
};

// 최소 버전 — 한글 라벨만. (영문 병기는 최종 디자인 단계에서 다시 판단)
const AXIS_LABELS: Record<string, string> = {
  WGHT: '굵기',
  TONE: '너비',
  SLNT: '기울기'
};

export default function PhaseGlyph({ initialTone, voicePreset, backLabel, onBack, onNext }: Props) {
  const [tone, setTone] = useState({
    font: initialTone?.font ?? DEFAULT.font,
    tone: initialTone?.tone ?? DEFAULT.tone,
    wght: initialTone?.wght ?? DEFAULT.wght,
    slnt: initialTone?.slnt ?? DEFAULT.slnt,
    size: initialTone?.size ?? DEFAULT.size
  });

  const presetLabel = voicePreset ? FONT_LABELS[voicePreset.font] : null;

  return (
    <div className="z-frame z1">
      <div className="z-header">
        <BackButton label={backLabel} onClick={onBack} />
        <span>1 / 3 · 자형</span>
      </div>

      {presetLabel && (
        <div className="z-voice-badge">
          <span className="z-voice-badge-label">음성 추천</span>
          <span className="z-voice-badge-value" style={{ fontFamily: fontMap[voicePreset!.font] }}>
            {presetLabel}
          </span>
        </div>
      )}

      <div className="z-glyph-stage">
        <div
          className="z-glyph"
          style={{
            fontFamily: fontMap[tone.font],
            fontWeight: tone.wght,
            fontVariationSettings: `"wght" ${tone.wght}`,
            transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)`,
            fontSize: Math.round(tone.size * 3) + 'px'
          }}
        >
          {SAMPLE_TEXT}
        </div>
        <div className="z-glyph-caption">예시 ‘발화’로 형태를 정해요</div>
      </div>

      <div className="style-cards" role="group" aria-label="자형 고르기">
        {STYLE_OPTIONS.map((s) => {
          const on = s.val === tone.font;
          return (
            <button
              key={s.val}
              type="button"
              className={'style-card ' + (on ? 'on' : '')}
              aria-pressed={on}
              onClick={() => setTone((t) => ({ ...t, font: s.val }))}
            >
              <span className="style-card-name" style={{ fontFamily: fontMap[s.val] }}>
                {s.label}
              </span>
              <span className="style-card-kind">{s.kind}</span>
            </button>
          );
        })}
      </div>

      <div className="z-axes">
        <StepSlider axisKey="WGHT" stops={WGHT_STOPS} value={tone.wght} onPick={(v) => setTone((t) => ({ ...t, wght: v }))} />
        <StepSlider axisKey="TONE" stops={TONE_STOPS} value={tone.tone} onPick={(v) => setTone((t) => ({ ...t, tone: v }))} />
        <div className="z-axis-line z-slider-line">
          <span className="z-axis-label">{AXIS_LABELS.SLNT}</span>
          <div className="z-slider-wrap">
            <input
              type="range"
              min={0}
              max={SLNT_MAX}
              step={1}
              value={-tone.slnt}
              onChange={(e) => setTone((t) => ({ ...t, slnt: -parseInt(e.target.value, 10) }))}
            />
            <div className="z-slider-stops">
              <span className={'z-slider-stop ' + (tone.slnt === 0 ? 'on' : '')}>또박또박</span>
              <span className={'z-slider-stop ' + (tone.slnt !== 0 ? 'on' : '')}>흘림 {Math.round(-tone.slnt)}°</span>
            </div>
          </div>
        </div>
      </div>

      <button className="primary-action" onClick={() => onNext(tone)}>
        <span>이 자형으로, 다음</span>
      </button>

      <div className="z-progress">
        <span className="dot on" />
        <span className="dot" />
        <span className="dot" />
        <span className="z-progress-label">자형 · 색 · 미리보기</span>
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
  // Snap the current value to the nearest stop (handles voice presets that
  // don't land exactly on a stop value).
  const idx = stops.reduce(
    (best, s, i) => (Math.abs(s.val - value) < Math.abs(stops[best].val - value) ? i : best),
    0
  );
  return (
    <div className="z-axis-line z-slider-line">
      <span className="z-axis-label">{AXIS_LABELS[axisKey]}</span>
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
