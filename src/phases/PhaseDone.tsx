import MegafontFrame from '../components/MegafontFrame';
import { STAY_DAYS } from '../lib/wall';
interface Props {
    stillDocked: boolean;
    onRestart: () => void;
}
/**
 * 발화 종료. 튜토리얼 마지막 장('그러면 끝입니다')이 여기로 왔다(2026-09-24).
 * 사라지는 날짜와 익명·삭제 원칙은 **다 하고 난 뒤**에 읽혀야 제 뜻이 선다 —
 * 시작도 전에 들으면 규칙 목록일 뿐이다. 3일은 wall.ts에서 받아 온다.
 *
 * 불변성('보낸 뒤에는 수정할 수 없습니다')은 여기 두지 않는다. 행동 **전에**
 * 알아야 하는 것이라 5/5 확인 화면이 들고 있다 — 다 보낸 뒤에 말하면 늦다.
 */
export default function PhaseDone({ onRestart }: Props) {
    return <MegafontFrame phaseLabel="완료"><div className="done done-simple">
      <h1>발화 종료</h1>
      <p className="done-after">메아리처럼 화면을 맴돌며,<br /><b>{STAY_DAYS}일 후에 사라집니다.</b></p>
      <dl className="info-rules">
        <div>
          <dt>익명성</dt>
          <dd>누가 썼는지는 남지 않습니다.</dd>
        </div>
        <div>
          <dt>운영 원칙</dt>
          <dd>타인에게 피해를 주거나 문제가 되는 글은 관리자가 삭제할 수 있습니다.</dd>
        </div>
      </dl>
      <button className="done-home-link" onClick={onRestart}>한 줄 더 쓰기</button>
    </div></MegafontFrame>;
}
