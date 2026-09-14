import { useEffect, useState } from 'react';
import { releaseDock } from '../lib/firebase';
import { EMPHASIS_SEC } from '../lib/wall';
interface Props {
    onDone: (pulled: boolean) => void;
}
/**
 * 눈이 숫자 쪽으로 기우는 시각.
 *
 * 30초 내내 같은 얼굴이면 화면이 그냥 타이머다. 끝이 가까워졌다는 것을
 * 숫자가 아니라 **몸짓**이 먼저 말하게 한다 — 열을 남기고 눈이 숫자를
 * 쳐다본다. 남은 시간을 읽지 않아도 '이제 곧'이 전해진다.
 */
const KEEN_SEC = 10;
export default function PhaseOnWall({ onDone }: Props) {
    const [left, setLeft] = useState(EMPHASIS_SEC);
    useEffect(() => { const start = Date.now(); const id = window.setInterval(() => { const remaining = Math.max(0, EMPHASIS_SEC - (Date.now() - start) / 1000); setLeft(remaining); if (remaining <= 0) {
        clearInterval(id);
        onDone(false);
    } }, 100); return () => clearInterval(id); }, [onDone]);
    return <div className="onwall-screen">
 <div className="onwall"><button className="onwall-release" onClick={() => { void releaseDock(); onDone(true); }}>폰을 뺐어요</button></div>
 {/* 바닥 한 줄 — 왼쪽에 눈, 오른쪽에 남은 초.
     '최대 30초'는 걷어냈다. 숫자가 이만큼 커지면 그게 무엇인지는 줄어드는
     것만 봐도 알고, 상한은 이미 첫 숫자가 말하고 있다. */}
 <div className={'onwall-floor' + (left <= KEEN_SEC ? ' is-keen' : '')}>
  <Eye/>
  <div className="onwall-count" aria-label="남은 발화 시간">{Math.ceil(left)}</div>
 </div>
</div>;
}

/**
 * 눈 하나.
 *
 * 도형은 작가의 것을 그대로 가져왔다 (`by_moomiryu/Renewal_v1/eye_general.svg`,
 * `eye_twinkle.svg`). 화판이 412.12×172.43에 눈이 둘이라, 왼쪽 눈 한 짝만
 * 172.43 정사각으로 잘라 쓴다 — 좌표는 원본 그대로다(가운데 86.21, 반지름 86.21).
 *
 * 깜빡임은 눈을 **누르는** 것이 아니라 **갈아 끼우는** 것이다. 동그란
 * 눈동자(general)가 아래로 굽은 활(twinkle)로 한 순간 바뀌었다 돌아온다.
 * 세로로 눌러 감으면 눈이 감긴 게 아니라 도형이 납작해진 것으로 보인다.
 *
 * 흰자는 흰색 붙박이, 눈동자는 화면 색이다 — 눈동자가 뚫린 자리처럼 보여야
 * 이 화면(빨강) 위에 얹힌 한 짝의 눈으로 읽힌다.
 */
function Eye() {
    return <svg className="onwall-eye" viewBox="0 0 172.43 172.43" aria-hidden focusable="false">
  <circle className="onwall-eye-white" cx="86.21" cy="86.21" r="86.21"/>
  <g className="onwall-eye-pupil">
   <circle className="onwall-eye-open" cx="86.21" cy="86.21" r="52.48"/>
   <path className="onwall-eye-shut" d="M129.96,86.21c5.01,0,8.77,4.55,7.87,9.48-4.46,24.46-25.87,43-51.63,43s-47.16-18.54-51.62-43c-.9-4.93,2.86-9.48,7.87-9.48h0c3.86,0,7.17,2.76,7.86,6.56,3.1,17,18.01,29.92,35.88,29.92s32.79-12.92,35.89-29.92c.69-3.8,4-6.56,7.86-6.56h0Z"/>
  </g>
 </svg>;
}
