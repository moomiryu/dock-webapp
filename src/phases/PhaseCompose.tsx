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
/**
 * 막막할 때 여는 힌트.
 *
 * **예시는 정답이 아니다.** 그래서 눌러도 입력창에 들어가지 않는다 — 누르면
 * 들어가게 해 두면 그중 하나를 고르는 일이 되고, 무엇을 쓸지 정하는 권한이
 * 화면으로 넘어간다. 여기 있는 것은 "이런 것도 말이 된다"는 예일 뿐이다.
 *
 * 주제는 넷 다 다른 결이다 — 관찰 · 바람 · 건넴 · 외침. 하나로 쏠리면
 * 그 결이 권장되는 것으로 읽힌다.
 */
const HINTS: Array<{ topic: string; line: string }> = [
    { topic: '오늘 발견한 것', line: '이 시간의 캠퍼스는 생각보다 다정하다.' },
    { topic: '이곳에 바라는 것', line: '잠깐 앉아 쉴 벤치가 더 있으면 좋겠다.' },
    { topic: '누군가에게 건네는 말', line: '아직 작업 중인 사람, 나도 여기 있어요.' },
    { topic: '그냥 외쳐보고 싶은 말', line: '과제도 광합성으로 끝낼 수 있으면 좋겠다.' }
];

export default function PhaseCompose({ initialText, onBack, onSubmit }: Props) {
    const [text, setText] = useState(initialText);
    /** 힌트가 펼쳐져 있는가. 글과 따로 사는 값이라 열고 닫아도 글은 그대로다 */
    const [hint, setHint] = useState(false);
    const input = useRef<HTMLTextAreaElement>(null);
    const empty = !text.trim();
    const left = 60 - text.length;
    const full = left === 0;
    /**
     * 붙여넣다 **잘린 글자 수.**
     *
     * maxLength는 넘치는 만큼을 조용히 버린다. 한 줄쯤 더 써서 붙여넣은
     * 사람은 제 문장이 어디서 끊겼는지 모른 채 다음으로 넘어간다 — 벽에
     * 반쯤 남은 말이 사흘 걸린다. 몇 자가 안 들어갔는지 말해 준다.
     *
     * 지우는 것은 **자판을 누를 때**다. change에서 지우면 붙여넣기가 만든
     * 그 change가 제 메시지를 바로 지워 버리고, 깃발로 그것만 건너뛰게
     * 하면 붙여넣기가 아무것도 안 넣은 경우에 깃발이 남아 다음 편집을
     * 먹는다. 자판과 붙여넣기는 서로 다른 사건이라 엇갈릴 일이 없다.
     */
    const [cut, setCut] = useState(0);
    useEffect(() => { input.current?.focus({ preventScroll: true }); }, []);
    /* 닫으면 쓰던 자리로 돌려보낸다. 힌트를 보고 나서 다시 입력창을 찾아
       누르게 하면, 힌트를 연 것이 작성을 끊은 것이 된다. */
    const close = () => { setHint(false); input.current?.focus({ preventScroll: true }); };
    return <div className="z-frame z1 write-screen">
  <div className="z-header">
   <BackButton label="처음으로" onClick={() => onBack(text)}/>
   <span className="z-step-of">1 / 5 · 한 줄</span>
  </div>
  <div className="z-ask">
   <h1>어떤 발화를<br />시작해볼까요?</h1>
   <p>혼잣말도, 함께 나누고 싶은 생각도 좋아요.</p>
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
      value={text} maxLength={60} spellCheck={false} placeholder="지금, 이곳에서 하고 싶은 말은?"
      onPaste={e => {
        const el = e.currentTarget;
        /* 고른 만큼은 덮어써지므로 자리가 그만큼 더 있다 */
        const room = 60 - text.length + Math.abs(el.selectionEnd - el.selectionStart);
        const over = e.clipboardData.getData('text').length - room;
        if (over > 0) setCut(over);
      }}
      onKeyDown={() => { if (cut) setCut(0); }}
      onChange={e => setText(e.target.value.slice(0, 60))}/>
  </div>
  {/* 다 찼다는 말을 **숫자와 글자 둘로** 한다. 색만 바꾸면 색을 못 보는
      사람에게는 아무 일도 안 일어난 화면이다. */}
  <span className={'compose-count' + (full ? ' is-full' : '')}>
    {text.length}<span>/60</span>
    {full && <b>다 찼어요</b>}
  </span>
  {/* 잘린 것은 그 자리에서 말한다. 다음 글자를 치면 사라진다 */}
  {cut > 0 && <span className="compose-cut" role="status">{cut}자는 들어가지 않았어요</span>}
  {/* 낭독기에는 **마지막 열 자**만 알린다. 한 자마다 읽어 주면 쓰는 것을
      방해하고, 안 알리면 한도가 있다는 것조차 모른다. */}
  <span className="sr-only" aria-live="polite">
    {full ? '다 찼어요' : left <= 10 ? `${left}자 남았어요` : ''}
  </span>

  {/* 힌트는 **부르면 온다.** 저절로 뜨거나 돌아가지 않는다 — 보고 있지
      않은 자리에서 글이 바뀌면, 쓰던 사람은 제 글이 바뀐 줄 안다. */}
  <button type="button" className={'hint-open' + (hint ? ' on' : '')}
    aria-expanded={hint} aria-controls="write-hint"
    onClick={() => {
      if (hint) { close(); return; }
      /* 펼치면서 자판을 내린다. 자판이 올라와 있으면 남는 높이가 절반이라
         힌트도 쓰던 글도 둘 다 눌린다 — 640 화면에서 입력창이 71px까지
         내려앉았다. 닫으면 다시 초점을 돌려주므로 자판도 같이 돌아온다. */
      input.current?.blur();
      setHint(true);
    }}>무슨 말을 쓸지 막막하다면</button>
  {hint && (
    <div className="write-hint" id="write-hint">
      <div className="write-hint-head">
        <span>이런 말도 좋아요</span>
        <button type="button" className="hint-close" onClick={close}>닫기</button>
      </div>
      {/* 주제와 예시는 읽는 결이 다르다. 목록의 이름과 설명으로 둔다 —
          예시가 버튼이 아니라는 것도 이 꼴이 말한다. */}
      <dl className="write-hint-list">
        {HINTS.map(h => (
          <div key={h.topic}>
            <dt>{h.topic}</dt>
            <dd>{h.line}</dd>
          </div>
        ))}
      </dl>
    </div>
  )}

  <button className="primary-action" disabled={empty} onClick={() => onSubmit(text.trim())}>다 썼어요</button>
 </div>;
}
