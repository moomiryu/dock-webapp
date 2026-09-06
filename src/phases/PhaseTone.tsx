import { useState } from 'react';
import BackButton from '../components/BackButton';
import StepRail from '../components/StepRail';
import { fontMap } from '../lib/palettes';
import { STYLE_OPTIONS, type PartialTone } from '../lib/tone';
interface Props {
  initialTone: PartialTone;
  onBack: (tone: PartialTone) => void;
  onNext: (tone: PartialTone) => void;
}
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


export default function PhaseTone({ initialTone, onBack, onNext }: Props) {
  const [tone, setTone] = useState(initialTone);
  const label = STYLE_OPTIONS.find(s => s.val === tone.font)?.label;
  return (
    <div className="z-frame z1 tone-adjust">
      <div className="z-header">
        <BackButton label="말투 다시 고르기" onClick={() => onBack(tone)} />
        <span>2 / 4 · 다듬기</span>
      </div>
      <StepRail step={2} />
      <div className="z-ask">
        <h1>말투를 조금 다듬어볼까요?</h1>
        <p>지금 모습 그대로 넘어가도 좋아요.</p>
      </div>
      <div className="tone-selected">
        <span>{label} 말투</span>
        <button type="button" onClick={() => onBack(tone)}>바꾸기</button>
      </div>
      <div className="z-glyph-stage has-face">
        <div className="z-glyph" style={{ fontFamily: fontMap[tone.font], fontWeight: tone.wght,
          fontVariationSettings: '"wght" ' + tone.wght,
          transform: 'scaleX(' + tone.tone + ') skewX(' + tone.slnt + 'deg)',
          fontSize: 'min(' + Math.round(tone.size * 3) + 'px, 28cqw)' }}>발화</div>
      </div>
      <div className="z-axes">
        <StepPicker label={AXIS_LABELS.WGHT} stops={WGHT_STOPS} value={tone.wght} onPick={wght => setTone(t => ({ ...t, wght }))} />
        <StepPicker label={AXIS_LABELS.TONE} stops={TONE_STOPS} value={tone.tone} onPick={value => setTone(t => ({ ...t, tone: value }))} />
        <StepPicker label={AXIS_LABELS.SLNT} stops={SLNT_STOPS} value={tone.slnt} onPick={slnt => setTone(t => ({ ...t, slnt }))} />
      </div>
      <button className="primary-action" onClick={() => onNext(tone)}>다음</button>
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
