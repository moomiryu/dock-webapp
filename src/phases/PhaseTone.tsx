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
export default function PhaseTone({ initialTone, onBack, onNext }: Props) {
    const [tone, setTone] = useState(initialTone);
    const label = STYLE_OPTIONS.find(s => s.val === tone.font)?.label;
    return <div className="z-frame z1 tone-adjust"><div className="z-header"><BackButton label="성격 다시 고르기" onClick={() => onBack(tone)}/><span>2 / 5 · 특성</span></div><StepRail step={2}/>
 <div className="z-ask"><h1>세세한 특성들을 조율해주세요.</h1><p>발화의 크기, 무게, 빠르기를 정해봐요.</p></div>
 <div className="tone-selected"><span>{label} 성격</span><button type="button" onClick={() => onBack(tone)}>바꾸기</button></div>
 <div className="z-glyph-stage has-face"><div className="z-glyph" style={{ fontFamily: fontMap[tone.font], fontWeight: tone.wght, fontVariationSettings: '"wght" ' + tone.wght, transform: 'scaleX(' + tone.tone + ')', fontSize: tone.size * 1.4 + 'px' }}><span>발화</span><span className="glyph-latin" lang="en">Public Voice</span></div></div>
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
