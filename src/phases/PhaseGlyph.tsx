import { useState } from 'react';
import BackButton from '../components/BackButton';
import { fontMap } from '../lib/palettes';
import type { ToneState } from '../types';

type PartialTone = Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;

interface Props {
  initialTone?: PartialTone | null;
  onBack: () => void;
  onNext: (partialTone: PartialTone) => void;
}

// 글을 쓰기 전이라 한 글자 대신 짧은 대표 낱말로 형태를 본다.
const SAMPLE_TEXT = '발화';

const DEFAULT = {
  tone: 1.0,
  wght: 500,
  slnt: 0,
  size: 44
};

// 자형 4종 — 고르는 근거는 태도(형용사)다.
// 서체 계열은 고른 칸에만 뜬다: 먼저 마음을 정하고, 그게 무엇이었는지 나중에 안다.
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

// 최소 버전 — 한글 라벨만. (영문 병기는 최종 디자인 단계에서 다시 판단)
const AXIS_LABELS: Record<string, string> = {
  WGHT: '굵기',
  TONE: '너비',
  SLNT: '기울기'
};

export default function PhaseGlyph({ initialTone, onBack, onNext }: Props) {
  // 처음에는 아무것도 고르지 않은 상태로 연다 — 무대가 비어 있어야
  // '고르는 일'이 이 화면의 과제라는 게 보인다.
  const [font, setFont] = useState<ToneState['font'] | null>(initialTone?.font ?? null);
  const [tone, setTone] = useState({
    tone: initialTone?.tone ?? DEFAULT.tone,
    wght: initialTone?.wght ?? DEFAULT.wght,
    slnt: initialTone?.slnt ?? DEFAULT.slnt,
    size: initialTone?.size ?? DEFAULT.size
  });

  return (
    <div className="z-frame z1">
      <div className="z-header">
        <BackButton label="처음으로" onClick={onBack} />
        <span>1 / 3 · 자형</span>
      </div>

      <div className="z-glyph-stage">
        {font ? (
          <div
            className="z-glyph"
            style={{
              fontFamily: fontMap[font],
              fontWeight: tone.wght,
              fontVariationSettings: `"wght" ${tone.wght}`,
              transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)`,
              fontSize: Math.round(tone.size * 3) + 'px'
            }}
          >
            {SAMPLE_TEXT}
          </div>
        ) : (
          <div className="z-glyph-ask">원하는 스타일을 택해주세요</div>
        )}
      </div>

      <div className="style-cards" role="group" aria-label="자형 고르기">
        {STYLE_OPTIONS.map((s) => {
          const on = s.val === font;
          return (
            <button
              key={s.val}
              type="button"
              className={'style-card ' + (on ? 'on' : '')}
              aria-pressed={on}
              onClick={() => setFont(s.val)}
            >
              <span className="style-card-name" style={{ fontFamily: on ? fontMap[s.val] : undefined }}>
                {s.label}
              </span>
              {on && <span className="style-card-kind">{s.kind}</span>}
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

      <button
        className="primary-action"
        disabled={!font}
        onClick={() => font && onNext({ font, ...tone })}
      >
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
  // 저장된 값이 정확히 눈금에 없을 수 있어 가장 가까운 눈금으로 맞춘다.
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
