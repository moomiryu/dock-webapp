import { useState } from 'react';
import BackButton from '../components/BackButton';
import StepRail from '../components/StepRail';
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

// 말투 4종 — 고르는 근거는 태도(형용사)다.
//
// 카드의 이름은 그 서체로 찍는다. 그래서 라벨이 곧 견본이다 — '다정한'이
// 손글씨로, '당당한'이 고딕으로 쓰여 있으면 설명 없이도 넷이 왜 다른지 보인다.
// 계열명은 늘 같이 둔다. 한 번 고른 뒤에야 보이면 고르기 전에는 단서가 없다.
//
// 어휘 (2026-09-06 2차 피드백 반영):
//   '정갈한'은 음식에 붙는 말이라 어색하다는 지적 → 차분한
//   '짓궂은'은 어감이 애매하고 너무 특정하다는 지적 → 발랄한
//   넷은 따뜻함×기운의 2×2로 선다: 다정(따뜻·낮음) 발랄(따뜻·높음)
//   당당(차가움·높음) 차분(차가움·낮음). 뼈대는 손·둥근고딕·고딕·명조.
//
// ⚠ 발랄한(Sunflower)과 당당한(seoul-namsan)은 둘 다 네모틀 산세리프라
//   골격이 겹친다. 서체 교체 전까지의 정직한 이름이 '둥근고딕'이다.
const STYLE_OPTIONS: Array<{ val: ToneState['font']; label: string; kind: string }> = [
  { val: 'doran', label: '다정한', kind: '손글씨' },
  { val: 'deulseok', label: '발랄한', kind: '둥근고딕' },
  { val: 'ttoryeot', label: '당당한', kind: '고딕' },
  { val: 'chabun', label: '차분한', kind: '명조' }
];

// 세 축은 전부 버튼이다.
// 슬라이더로 두면 '연속으로 조절되는 것'을 약속하는데 실제로는 눈금 셋에
// 걸리는 구조였다 — 그 어긋남이 당황을 불렀다. 종류를 고르는 카드와
// 정도를 고르는 축이 같은 손짓(누르기)이면 화면 전체가 한 문법이 된다.
const WGHT_STOPS = [
  { val: 300, label: '여리게' },
  { val: 500, label: '보통' },
  { val: 700, label: '세게' }
];
const TONE_STOPS = [
  { val: 1.3, label: '느긋하게' },
  { val: 1.0, label: '보통' },
  { val: 0.7, label: '날렵하게' }
];
// 기울기 — 저장값은 음수 skewX (예전 방향 그대로)
const SLNT_STOPS = [
  { val: 0, label: '또박또박' },
  { val: -12, label: '기울여' },
  { val: -24, label: '흘려' }
];

const AXIS_LABELS = {
  WGHT: '굵기',
  TONE: '너비',
  SLNT: '기울기'
} as const;

export default function PhaseGlyph({ initialTone, onBack, onNext }: Props) {
  // 처음에는 아무것도 고르지 않은 상태로 연다 — 고르는 일이 이 화면의 과제다.
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
        <span>1 / 3 · 말투</span>
      </div>
      <StepRail step={1} />

      {/* 무엇을 정하는 화면인지 제목이 먼저 말한다.
          카드가 갑자기 나오면 '다정한'이 무엇의 다정함인지 알 수 없다. */}
      <div className="z-ask">
        <h1>어떤 말투로 말할까요?</h1>
        <p>같은 말도 얼굴에 따라 다르게 들립니다.</p>
      </div>

      <div className="style-cards" role="group" aria-label="말투 고르기">
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
              <span className="style-card-name" style={{ fontFamily: fontMap[s.val] }}>
                {s.label}
              </span>
              <span className="style-card-kind">{s.kind}</span>
            </button>
          );
        })}
      </div>

      {/* 무대 — 고른 말투에 굵기·너비·기울기를 얹어 보는 자리.
          테두리를 두지 않는다: 빈 상자는 입력창으로 읽힌다.
          고르기 전에는 중립 서체를 옅게 두어 '여기에 뜬다'만 알린다. */}
      <div className={'z-glyph-stage ' + (font ? 'has-face' : 'no-face')} aria-live="polite">
        {/* 고르기 전에는 이 글자가 아무것도 말하지 않는다 (옅은 중립 서체).
            그때의 정보는 아래 힌트 줄이 지므로 낭독기에서는 숨긴다. */}
        <div
          className="z-glyph"
          aria-hidden={!font}
          style={{
            fontFamily: font ? fontMap[font] : undefined,
            fontWeight: tone.wght,
            fontVariationSettings: `"wght" ${tone.wght}`,
            transform: `scaleX(${tone.tone}) skewX(${tone.slnt}deg)`,
            fontSize: Math.round(tone.size * 2.6) + 'px'
          }}
        >
          {SAMPLE_TEXT}
        </div>
        {!font && <span className="z-glyph-hint">위에서 말투를 고르면 여기에 뜹니다</span>}
      </div>

      <div className="z-axes">
        <StepPicker
          label={AXIS_LABELS.WGHT}
          stops={WGHT_STOPS}
          value={tone.wght}
          onPick={(v) => setTone((t) => ({ ...t, wght: v }))}
        />
        <StepPicker
          label={AXIS_LABELS.TONE}
          stops={TONE_STOPS}
          value={tone.tone}
          onPick={(v) => setTone((t) => ({ ...t, tone: v }))}
        />
        <StepPicker
          label={AXIS_LABELS.SLNT}
          stops={SLNT_STOPS}
          value={tone.slnt}
          onPick={(v) => setTone((t) => ({ ...t, slnt: v }))}
        />
      </div>

      {/* 버튼이 다음이 무엇인지 같이 말한다 — '이 다음은 뭐예요?'에 미리 답한다 */}
      <button
        className="primary-action"
        disabled={!font}
        onClick={() => font && onNext({ font, ...tone })}
      >
        <span>
          다음<em>한 줄 쓰기</em>
        </span>
      </button>

    </div>
  );
}

function StepPicker({
  label,
  stops,
  value,
  onPick
}: {
  label: string;
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
    <div className="z-axis-line" role="group" aria-label={label}>
      <span className="z-axis-label">{label}</span>
      <div className="z-steps">
        {stops.map((s, i) => (
          <button
            key={i}
            type="button"
            className={'z-step ' + (i === idx ? 'on' : '')}
            aria-pressed={i === idx}
            onClick={() => onPick(s.val)}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
