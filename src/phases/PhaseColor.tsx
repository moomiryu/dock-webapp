import { useState, type CSSProperties } from 'react';
import BackButton from '../components/BackButton';
import VoiceBubble from '../components/VoiceBubble';
import { Ripple, composeFontSize } from './PhaseCompose';
import { fontMap } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { messageColors } from '../lib/messageStyle';
import type { ToneState } from '../types';
interface Props {
    text: string;
    tone: ToneState;
    onBack: (tone: ToneState) => void;
    onNext: (tone: ToneState) => void;
}
/**
 * 04 색.
 *
 * 화면은 03이 **물러선 그 모습** 그대로다 — 검은 화면에 한 덩이가 놓이고
 * 가장자리에서 물결이 번진다. 03에서 자판을 내려 그 형태를 보고 있었는데,
 * 04로 넘어왔다고 다른 액자로 갈아타면 방금 본 것이 사라진다. 여기서는
 * 쓰지 않으니 자판이 올라올 일도 없다 — 물러선 상태가 이 화면의 기본이다.
 *
 * 16:10 액자에 줄여 보여 주던 '실제 스크린 비율'은 걷어냈다. 그건 벽에서
 * 어떻게 보이는지를 묻는 화면(05)이 할 일인데 여기서 먼저 답해 버리면,
 * 색을 고르는 동안 글이 손톱만 해져서 정작 고르려는 색이 안 보인다.
 *
 * 이 단계에서 달라지는 것은 하나뿐이다: **색판이 아래에서 올라온다.**
 * 그래서 단계가 넘어간 게 아니라 색만 꺼내 든 것으로 읽힌다.
 */
export default function PhaseColor({ text, tone, onBack, onNext }: Props) {
    const initial = messageColors(tone);
    const [bg, setBg] = useState(initial.bg);
    const [fg, setFg] = useState(initial.text);
    const current = { ...tone, backgroundColor: bg, textColor: fg };
    return <div className="z-frame compose-screen color-choice is-pulled"
      style={{ '--pane-bg': bg, '--chrome-ink': fg } as CSSProperties}>
 <div className="proj-stage is-bleed"><div className="proj-fit">
  <div className="proj-frame compose-editor is-pulled">
   <div className="compose-chrome">
    <BackButton label="한 줄 다시 쓰기" onClick={() => onBack(current)}/>
    <span className="z-step-of">4 / 5 · 색</span>
   </div>
   <div className="compose-pane">
    <Ripple color={bg}/>
    <VoiceBubble text={text} bg={bg} color={fg} fontFamily={fontMap[tone.font]} weight={tone.wght} width={tone.tone} slant={tone.slnt} align={tone.align} size={tone.size} fontSize={composeFontSize(text.length || 1, tone)}/>
   </div>
  </div>
 </div></div>
 {/* 열 조합. 배경과 글자가 한 짝이라 따로 고르지 않는다 — 네모 하나가
     그 짝을 통째로 보여 준다(바탕은 배경색, 안의 '가'는 글자색). */}
 <div className="color-tray" role="group" aria-label="색 고르기">
  {moods.map(m => {
      const on = m.bg.toUpperCase() === bg.toUpperCase() && m.text.toUpperCase() === fg.toUpperCase();
      return <button key={m.id} type="button" className={'color-chip' + (on ? ' on' : '')}
        style={{ background: m.bg, color: m.text }} aria-pressed={on} aria-label={m.name}
        onClick={() => { setBg(m.bg); setFg(m.text); }}>가</button>;
  })}
 </div>
 <button className="primary-action" onClick={() => onNext(current)}>이 색으로 할게요</button></div>;
}
