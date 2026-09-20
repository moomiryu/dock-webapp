import { useEffect, useRef, useState } from 'react';
import BackButton from '../components/BackButton';
import { foldLines } from '../lib/fit';

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
 * 그다음에 제 말을 그 틀에 부어 넣었다. 뒤집었다 — 재료를 먼저 준비하고
 * 그다음에 요리한다.
 *
 * ── 상자를 걷어냈다 ───────────────────────────────────────────────────
 * 자판을 내리면 화면이 물러서고 글이 정사각 상자에 담기는 연출이 있었다.
 * 그 상자가 글을 제 폭에 맞춰 **다시 접었다** — 발화자가 넣은 줄바꿈이
 * 지워진다는 뜻이다. 줄을 어디서 나눌지가 발화자의 몫이 된 이상 남겨 둘
 * 수 없다.
 *
 * 연출 자체도 여기서는 할 일이 없어졌다. 물러섬은 "적고 있던 것이 실은
 * 형태였다"를 보여주는 장치인데, 이제 이 화면에는 형식이 하나도 없다.
 * 형태가 붙는 자리는 다음 화면(성격)이고, 거기서 처음 얼굴이 생긴다.
 *
 * ── 여기엔 형식이 없다 ────────────────────────────────────────────────
 * 아직 성격을 안 골랐으니 그릴 도형도 입힐 서체도 없다. 화면 서체 그대로,
 * 흰 바탕의 맨 글이다. 이 맨 글이 **원본**이 된다 — 성격을 고르는 순간
 * 얼굴이 바뀌고, 그게 형식이 입혀지는 순간으로 읽힌다. 여기서 넷 중 하나를
 * 기본으로 깔면 시스템이 이미 하나를 고른 셈이 된다.
 */
export default function PhaseCompose({ initialText, onBack, onSubmit }: Props) {
    const [text, setText] = useState(initialText);
    const input = useRef<HTMLTextAreaElement>(null);
    const empty = !text.trim();
    const full = text.length === 60;
    useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
    return <div className="z-frame z1 write-screen">
  <div className="z-header">
   <BackButton label="처음으로" onClick={() => onBack(text)}/>
   <span className="z-step-of">1 / 5 · 한 줄</span>
  </div>
  <div className="z-ask">
   <h1>어떤 발화를<br />시작해볼까요?</h1>
   <p>하고 싶은 말을 적어주세요.</p>
  </div>
  {/* 줄바꿈은 발화자가 정한다 — 자판의 줄바꿈이 그대로 남는다.
      계산도 상자도 끼어들지 않는다.

      쓰는 칸이 곧 **벽의 틀**이다(2.4×1.5). 벽에서 줄을 접는 규칙은
      한 줄 12자·어절 단위인데(foldLines), 12자 × 5줄 × 행간 1.5가
      정확히 그 비율이다. 그래서 칸을 그 비율로 두고 글자를 폭의 12분의
      1로 잡으면, 쓰는 동안 보는 줄모양이 곧 벽의 줄모양이 된다.

      테두리도 바탕도 없다 — 칸이 있다고 말하지 않는다. 글이 어디서
      접히는지로만 보인다. */}
  <div className="write-fit">
    <textarea ref={input} className="write-input" aria-label="벽에 올릴 한 줄"
      style={{ '--rows': Math.max(1, foldLines(text || ' ').length) } as React.CSSProperties}
      value={text} maxLength={60} spellCheck={false} placeholder="여기를 눌러 쓰세요"
      onChange={e => setText(e.target.value.slice(0, 60))}/>
  </div>
  <span className={'compose-count' + (full ? ' is-full' : '')}>{text.length}<span>/60</span></span>
  <button className="primary-action" disabled={empty} onClick={() => onSubmit(text.trim())}>다 썼어요</button>
 </div>;
}
