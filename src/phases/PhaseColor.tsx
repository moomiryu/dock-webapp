import { useState } from 'react';
import BackButton from '../components/BackButton';
import VoiceBubble from '../components/VoiceBubble';
import { fontMap } from '../lib/palettes';
import { MESSAGE_COLORS, messageColors } from '../lib/messageStyle';
import type { ToneState } from '../types';
interface Props {
    text: string;
    tone: ToneState;
    onBack: (tone: ToneState) => void;
    onNext: (tone: ToneState) => void;
}
export default function PhaseColor({ text, tone, onBack, onNext }: Props) {
    const initial = messageColors(tone);
    const [bg, setBg] = useState(initial.bg);
    const [fg, setFg] = useState(initial.text);
    const current = { ...tone, backgroundColor: bg, textColor: fg };
    return <div className="z-frame color-choice"><div className="z-header"><BackButton label="한 줄 다시 쓰기" onClick={() => onBack(current)}/><span className="z-step-of">4 / 5 · 색</span></div>
 <div className="z-ask"><h1>발화의 색을 골라주세요.</h1></div>
 <div className="color-preview-stage"><div className="color-preview"><VoiceBubble text={text} bg={bg} color={fg} fontFamily={fontMap[tone.font]} weight={tone.wght} width={tone.tone} slant={tone.slnt} align={tone.align} size={tone.size}/></div><p className="screen-ratio-note">실제 스크린 비율이에요.</p></div>
 <div className="color-reels"><ColorReel label="글자색" value={fg} blocked={bg} onChange={setFg}/><ColorReel label="배경색" value={bg} blocked={fg} noBlack onChange={setBg}/></div>
 <button className="primary-action" onClick={() => onNext(current)}>이 색으로 할게요</button></div>;
}
function ColorReel({ label, value, blocked, noBlack = false, onChange }: {
    label: string;
    value: string;
    blocked: string;
    noBlack?: boolean;
    onChange: (v: string) => void;
}) {
    return <fieldset className="color-reel"><legend>{label}</legend><div className="color-reel-track" role="group" aria-label={label}>{MESSAGE_COLORS.filter(c => !noBlack || c !== '#000000').map(c => <button type="button" key={c} className="color-reel-option" style={{ backgroundColor: c }} disabled={c === blocked} aria-label={label + ' ' + c} aria-pressed={c === value} onClick={e => { onChange(c); e.currentTarget.scrollIntoView({ block: "nearest", behavior: "smooth" }); }}><span className="swatch-mark" style={{ color: ['#000000', '#1E2A52', '#0033FF', '#E4002B'].includes(c) ? '#FFFFFF' : '#000000' }}>{c === value ? '✓' : c === blocked ? '×' : ''}</span></button>)}</div></fieldset>;
}
