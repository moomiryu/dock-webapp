import { useEffect, useRef, useState } from 'react';
import BackButton from '../components/BackButton';
import StepRail from '../components/StepRail';
import VoiceBubble from '../components/VoiceBubble';
import { fontMap } from '../lib/palettes';
import { messageColors } from '../lib/messageStyle';
import type { ToneState } from '../types';
type PartialTone = Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;
interface Props {
    initialText: string;
    partialTone: PartialTone;
    initialPaletteIdx?: number;
    onBack: (text: string, tone: ToneState) => void;
    onSubmit: (text: string, tone: ToneState) => void;
}
export default function PhaseCompose({ initialText, partialTone, initialPaletteIdx, onBack, onSubmit }: Props) {
    const [text, setText] = useState(initialText);
    const [align, setAlign] = useState<ToneState['align']>(partialTone.align ?? 'center');
    const [slnt, setSlnt] = useState(partialTone.slnt ? -12 : 0);
    const input = useRef<HTMLTextAreaElement>(null);
    const tone: ToneState = { ...partialTone, align, slnt, paletteIdx: initialPaletteIdx ?? 0, graphicIdx: -1 };
    const colors = messageColors(tone);
    const empty = !text.trim();
    useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
    const cycle = () => setAlign(a => a === 'left' ? 'center' : a === 'center' ? 'right' : 'left');
    return <div className="z-frame compose-screen">
  <div className="z-header"><BackButton label="특성 조절로" onClick={() => onBack(text, tone)}/><span>3 / 5 · 한 줄</span></div><StepRail step={3}/>
  <div className="compose-toolbar">
   <button type="button" className="format-button" onClick={cycle} aria-label={`정렬: ${align === 'left' ? '왼쪽' : align === 'right' ? '오른쪽' : '중앙'}. 다음 정렬로 변경`}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18M3 13h18"/><path d={align === 'left' ? 'M3 9h11M3 17h11' : align === 'right' ? 'M10 9h11M10 17h11' : 'M6.5 9h11M6.5 17h11'}/></svg></button>
   <button type="button" className="format-button" aria-label="기울기" aria-pressed={slnt !== 0} onClick={() => setSlnt(s => s ? 0 : -12)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 4h10M4 20h10M15 4L9 20"/></svg></button>
  </div>
  <div className="proj-stage is-bleed"><div className="proj-fit"><div className="proj-frame compose-editor" onPointerDown={e => { if (e.target !== input.current) {
        e.preventDefault();
        input.current?.focus({ preventScroll: true });
    } }}>
   <VoiceBubble text={empty ? '여기를 눌러 쓰세요' : text} bg={colors.bg} color={colors.text} fontFamily={fontMap[tone.font]} weight={tone.wght} width={tone.tone} slant={tone.slnt} align={align} size={tone.size}>
   <textarea ref={input} className="live-input compose-input" aria-label="벽에 올릴 한 줄" value={text} maxLength={60} spellCheck={false} onChange={e => setText(e.target.value.slice(0, 60))}/></VoiceBubble>
  </div></div><div className="proj-meta"><span>실제 스크린 비율이에요.</span><span className="proj-meta-end">{text.length}<span>/60</span>{text.length === 60 && <span> 여기까지예요</span>}</span></div></div>
  <button className="primary-action" disabled={empty} onClick={() => onSubmit(text.trim(), tone)}>다음</button>
 </div>;
}
