import { useEffect, useRef, useState, type CSSProperties } from 'react';
import BackButton from '../components/BackButton';
import VoiceBubble from '../components/VoiceBubble';
import { fontMap } from '../lib/palettes';
import { DRAFT_COLORS, messageColors } from '../lib/messageStyle';
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
    // 아직 한 번도 색을 고르지 않았을 때만 작업용 바탕을 깐다. 04에서
    // 고르고 돌아오면 partialTone이 그 색을 들고 있으므로 건드리지 않는다.
    const untouched = initialPaletteIdx === undefined && !partialTone.backgroundColor;
    const tone: ToneState = { ...partialTone, align, slnt, paletteIdx: initialPaletteIdx ?? 0, graphicIdx: -1,
        ...(untouched ? DRAFT_COLORS : null) };
    const colors = messageColors(tone);
    const empty = !text.trim();
    // 물러서는 계기는 **자판을 내리는 것**이다.
    //
    // 스케치 04a→04c가 말하는 건 한 문장이다: "글을 적던 그 화면이, 자판을
    // 내리고 보니 파동하고 있는 소리였다." 그러니 물러섬은 특별한 사건이
    // 아니라 쓰기를 멈추는 동작에 딸려 와야 한다 — 자판이 내려가면 가려져
    // 있던 아래쪽이 드러나고, 그제야 형태가 통째로 보인다.
    //
    // 2026-09-15까지는 '정확히 60자'가 유일한 계기였다. 59자에서는 아무 일도
    // 없고 60자에서 갑자기 물러서니, 흐름이 아니라 경고로 읽혔다. 60자는
    // 이제 계기가 아니라 **자판을 내리는 손**이다 — 다 찼으니 자판을 내려
    // 주고, 물러서는 일은 그 뒤에 저절로 따라온다. 결과는 같고 이유가 다르다.
    const full = text.length === 60;
    const [pulled, setPulled] = useState(false);
    useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
    useEffect(() => { if (full) input.current?.blur(); }, [full]);
    const cycle = () => setAlign(a => a === 'left' ? 'center' : a === 'center' ? 'right' : 'left');
    // 색은 액자가 아니라 **화면**이 입는다 — 버튼이 서는 아래 띠까지가
    // 그 색이고, 빨강 그라데이션은 그 위에 얹힌다. 물러서면 화면째 검정이
    // 되고, 그제야 한 덩이만 색으로 남는다.
    return <div className={'z-frame compose-screen' + (pulled ? ' is-pulled' : '')}
      style={{ '--pane-bg': colors.bg, '--chrome-ink': colors.text } as CSSProperties}>
  <div className="proj-stage is-bleed"><div className="proj-fit"><div className={'proj-frame compose-editor' + (pulled ? ' is-pulled' : '')} onPointerDown={e => { if (e.target !== input.current) {
        e.preventDefault();                           // 눌러도 지금 초점이 풀리지 않게
        input.current?.focus({ preventScroll: true }); // 누르면 다시 들어간다(줌인)
    } }}>
   <div className="compose-chrome">
    <BackButton label="특성 조절로" onClick={() => onBack(text, tone)}/>
    <span className="z-step-of">3 / 5 · 한 줄</span>
    <div className="compose-toolbar">
     <button type="button" className="format-button" onPointerDown={e => e.preventDefault()} onClick={cycle} aria-label={`정렬: ${align === 'left' ? '왼쪽' : align === 'right' ? '오른쪽' : '중앙'}. 다음 정렬로 변경`}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18M3 13h18"/><path d={align === 'left' ? 'M3 9h11M3 17h11' : align === 'right' ? 'M10 9h11M10 17h11' : 'M6.5 9h11M6.5 17h11'}/></svg></button>
     <button type="button" className="format-button" onPointerDown={e => e.preventDefault()} aria-label="기울기" aria-pressed={slnt !== 0} onClick={() => setSlnt(s => s ? 0 : -12)}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 4h10M4 20h10M15 4L9 20"/></svg></button>
    </div>
   </div>
   <div className="compose-pane">
    <Ripple color={colors.bg}/>
    <VoiceBubble text={empty ? '여기를 눌러 쓰세요' : text} bg={colors.bg} color={colors.text} fontFamily={fontMap[tone.font]} weight={tone.wght} width={tone.tone} slant={tone.slnt} align={align} size={tone.size} fontSize={composeFontSize(text.length || 1, tone)}>
    <textarea ref={input} className="live-input compose-input" aria-label="벽에 올릴 한 줄" value={text} maxLength={60} spellCheck={false}
      onFocus={() => setPulled(false)} onBlur={() => setPulled(true)}
      onChange={e => setText(e.target.value.slice(0, 60))}/></VoiceBubble>
   </div>
   <span className={'compose-count' + (full ? ' is-full' : '')}>{text.length}<span>/60</span></span>
  </div></div></div>
  <button className="primary-action" disabled={empty} onClick={() => onSubmit(text.trim(), tone)}>다음</button>
 </div>;
}

/**
 * 60자에 닿았을 때 몸통에서 번져 나가는 물결 한 겹.
 *
 * 참고 자료(`design sketch/motion reference_2.gif`, 400×400 · 30프레임 · 20ms)를
 * 프레임마다 덩어리로 뜯어 재서 나온 값이다. 도는 게 아니었다 — 날의 각도는
 * 30프레임 내내 44.74°로 붙박이였고, 대신 이런 일이 벌어진다:
 *
 *   · 물결은 몸통 가장자리(r=112, 몸통 반폭 109의 1.028배)에서 태어나
 *     바깥(r=128, 1.174배)까지 번지며 두께가 4.1px → 1.0px로 얇아진다
 *   · 한 겹뿐이다. 한 겹이 사라질 때쯤 다음 겹이 태어난다 — 600ms 주기
 *   · 네 귀퉁이에 걸친 네 토막이고, 변 한가운데가 끊겨 있다
 *   · 몸통은 물결이 떨어져 나가는 순간 넓이가 31660까지 줄었다가
 *     34475로 돌아온다 = 한 변으로 치면 2.2%
 *
 * 끊긴 자리는 점선(stroke-dasharray)으로 낸다. 네 토막을 따로 그리면
 * 모서리 반지름이 바뀔 때마다 네 경로를 다시 계산해야 한다.
 */
export function Ripple({ color }: { color: string }) {
    return <svg className="compose-ripple" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
  <rect className="compose-ripple-ring" x="20" y="20" width="200" height="200" rx="34" fill="none" stroke={color}/>
 </svg>;
}

/**
 * 쓰는 동안의 글자 크기.
 *
 * 벽 비율 액자를 쓰던 동안에는 fit.ts가 '가장 긴 줄을 폭에 맞춘다'로 정했고,
 * 그래서 60자를 채우면 7px까지 내려갔다 — 폰에서 제 글이 안 읽혔다.
 * 스케치가 준 두 점은 8자 32px · 60자 18px이다. 한 줄에 스무 자쯤 담기는
 * 크기를 상한으로 두고, 그 아래로는 18px을 바닥으로 깐다. 스무 자를 넘으면
 * 크기가 그대로 있고 줄이 늘어난다(60자 = 세 줄, 스케치와 같다).
 *
 * 벽에서 정말 어떻게 보이는지는 미리보기(05)가 16:10 액자로 맡는다.
 */
export function composeFontSize(length: number, tone: ToneState): string {
    const perLine = 88 / Math.min(length, 20);          // cqw — 액자 폭의 88%
    const scale = Math.min(60, Math.max(28, tone.size)) / 44;
    const widen = Math.max(1, tone.tone);               // 장평이 넓어지면 그만큼 줄인다
    return `max(18px, calc(min(${perLine.toFixed(2)}cqw, 32px) * ${(scale / widen).toFixed(3)}))`;
}
