import { useState } from 'react';
import BackButton from '../components/BackButton';
import { fontMap } from '../lib/palettes';
import { type PartialTone } from '../lib/tone';
interface Props {
    initialTone: PartialTone;
    onBack: (tone: PartialTone) => void;
    onNext: (tone: PartialTone) => void;
}
/**
 * 견본 글자 크기 = 크기 값 × 이것.
 *
 * 스케치의 '발화'는 잉크로 224.2×120.1 — 133px쯤이다. 그 크기를 기본값(44)에
 * 맞추면 슬라이더를 끝(60)까지 밀었을 때 장평까지 겹쳐 글자가 화면 밖으로
 * 나간다. 그래서 *끝에서 간신히 들어가는* 값으로 잡았다:
 *   2 글자 × 0.853em × (60 × k) × 장평 1.3 ≤ 390 − 좌우 40  →  k ≤ 2.63
 */
const GLYPH_SCALE = 2.6;
export default function PhaseTone({ initialTone, onBack, onNext }: Props) {
    const [tone, setTone] = useState(initialTone);
    return <div className="z-frame z1 tone-adjust">
 <div className="z-glyph-stage has-face">
  <div className="z-header"><BackButton label="성격 다시 고르기" onClick={() => onBack(tone)}/></div>
  <div className="z-glyph" style={{ fontFamily: fontMap[tone.font], fontWeight: tone.wght, fontVariationSettings: '"wght" ' + tone.wght, transform: 'scaleX(' + tone.tone + ')', fontSize: tone.size * GLYPH_SCALE + 'px' }}><span>발화</span><span className="glyph-latin" lang="en">Public<br />Voice</span></div>
 </div>
 <div className="z-axes">
 <Axis label="크기" left="작게" right="크게" min={28} max={60} step={1} value={tone.size} onChange={size => setTone(t => ({ ...t, size }))}/>
 <Axis label="무게" left="가볍게" right="묵직하게" min={300} max={700} step={1} value={tone.wght} onChange={wght => setTone(t => ({ ...t, wght }))}/>
 <Axis label="빠르기" left="천천히" right="빠르게" min={0} max={100} step={1} value={Math.round((1.3 - tone.tone) / 0.6 * 100)} onChange={v => setTone(t => ({ ...t, tone: Number((1.3 - v * 0.006).toFixed(3)) }))}/>
 </div><button className="primary-action" onClick={() => onNext(tone)}>다음</button></div>;
}
function Axis({ label, left, right, min, max, step, value, onChange }: {
    label: string;
    left: string;
    right: string;
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (v: number) => void;
}) {
    return <label className="tone-slider"><span>{label}</span><span className="tone-slider-control"><span className="tone-slider-labels"><span>{left}</span><span>{right}</span></span><input type="range" aria-label={label} min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}/></span></label>;
}
