import { useEffect, useRef, useState, type CSSProperties } from 'react';
import BackButton from '../components/BackButton';
import VoiceBubble from '../components/VoiceBubble';
import { WaveRing } from '../components/WaveBox';
import { DRAFT_COLORS, messageColors } from '../lib/messageStyle';
import type { ToneState } from '../types';

interface Props {
    initialText: string;
    onBack: (text: string) => void;
    onSubmit: (text: string) => void;
}

/**
 * 01 한 줄 — **맨 처음 화면이다.**
 *
 * 2026-09-19까지는 성격·조율을 다 거친 뒤 세 번째로 오는 화면이었다. 그
 * 순서에서는 발화자가 '발화' 두 글자라는 **남의 글**로 형식을 먼저 정하고,
 * 그다음에 제 말을 그 틀에 부어 넣었다. 뒤집는다 — 재료를 먼저 준비하고
 * 그다음에 요리한다.
 *
 * ── 여기엔 형식이 없다 ────────────────────────────────────────────────
 * 아직 성격을 안 골랐으니 **그릴 도형도 입힐 서체도 없다.** 화면 서체 그대로,
 * 작업용 바탕 위의 맨 글이다. 두 가지가 여기서 나온다.
 *
 * 하나 — 폰 폭에 열두 자를 넣으면서 말풍선 윤곽까지 두르면 글자가 30%
 * 깎인다(28.6px → 20.2px). 쓰는 동안은 제 글이 읽히는 것이 먼저다.
 *
 * 둘 — 이 맨 글이 **원본**이 된다. 성격을 고르는 순간 얼굴이 바뀌고, 그게
 * 형식이 입혀지는 순간으로 읽힌다. 비교할 원본이 없으면 그 순간도 없다.
 */

/** 형식을 고르기 전의 글. 무게도 장평도 기울기도 없는 기본값이다 */
const BARE: ToneState = {
    font: 'ttoryeot',          // 쓰이지 않는다 — 아래에서 화면 서체로 덮는다
    tone: 1, wght: 400, slnt: 0, size: 44,
    align: 'center', paletteIdx: 0, graphicIdx: -1,
    ...DRAFT_COLORS
};

export default function PhaseCompose({ initialText, onBack, onSubmit }: Props) {
    const [text, setText] = useState(initialText);
    const input = useRef<HTMLTextAreaElement>(null);
    const colors = messageColors(BARE);
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
    return <div className={'z-frame compose-screen' + (pulled ? ' is-pulled' : '')}
      style={{ '--pane-bg': colors.bg, '--chrome-ink': colors.text } as CSSProperties}>
  <div className="proj-stage is-bleed"><div className="proj-fit"><div className={'proj-frame compose-editor' + (pulled ? ' is-pulled' : '')} onPointerDown={e => { if (e.target !== input.current) {
        e.preventDefault();                           // 눌러도 지금 초점이 풀리지 않게
        input.current?.focus({ preventScroll: true }); // 누르면 다시 들어간다(줌인)
    } }}>
   <div className="compose-chrome">
    <BackButton label="처음으로" onClick={() => onBack(text)}/>
    <span className="z-step-of">1 / 5 · 한 줄</span>
   </div>
   {/* 자판을 내리면 그제야 제목이 선다. 쓰는 동안은 화면이 통째로 종이라
       제목이 설 자리가 없고, 물러선 뒤에는 뒤 화면들과 같은 자리(머리줄
       아래)에 같은 얼굴로 온다. 항상 그려 두고 투명도만 바꾼다 — 화면이
       물러서는 420ms에 같이 떠오르려면 그 순간에 이미 자리에 있어야 한다. */}
   <div className="z-ask compose-ask" aria-hidden={!pulled}>
    <h1>어떤 발화를<br />시작해볼까요?</h1>
   </div>
   <div className="compose-pane">
    <WaveRing color={colors.bg}/>
    {/* 화면 서체 그대로다. 서체를 고르는 일은 다음 화면이 한다 —
        여기서 넷 중 하나를 기본으로 깔면 시스템이 이미 하나를 고른 셈이다. */}
    <VoiceBubble text={empty ? '여기를 눌러 쓰세요' : text} bg={colors.bg} color={colors.text}
      fontFamily="var(--ui-font)" weight={BARE.wght} width={1} slant={0} align="center"
      size={BARE.size} fontSize={composeFontSize(text.length || 1, BARE)} fill={pulled}>
    <textarea ref={input} className="live-input compose-input" aria-label="벽에 올릴 한 줄" value={text} maxLength={60} spellCheck={false}
      onFocus={() => setPulled(false)} onBlur={() => setPulled(true)}
      onChange={e => setText(e.target.value.slice(0, 60))}/></VoiceBubble>
   </div>
   <span className={'compose-count' + (full ? ' is-full' : '')}>{text.length}<span>/60</span></span>
  </div></div></div>
  <button className="primary-action" disabled={empty} onClick={() => onSubmit(text.trim())}>다 썼어요</button>
 </div>;
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
 * 벽에서 정말 어떻게 보이는지는 미리보기가 16:10 액자로 맡는다.
 */
export function composeFontSize(length: number, tone: ToneState): string {
    const perLine = 88 / Math.min(length, 20);          // cqw — 액자 폭의 88%
    const scale = Math.min(60, Math.max(28, tone.size)) / 44;
    const widen = Math.max(1, tone.tone);               // 장평이 넓어지면 그만큼 줄인다
    return `max(18px, calc(min(${perLine.toFixed(2)}cqw, 32px) * ${(scale / widen).toFixed(3)}))`;
}
