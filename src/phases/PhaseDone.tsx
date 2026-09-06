import DockedFrame from '../components/DockedFrame';
import MegafontFrame from '../components/MegafontFrame';
import { STAY_DAYS } from '../lib/wall';

interface Props {
  /** 폰이 아직 홈에 꽂혀 있는가 — 그렇다면 아래 절반만 보인다 */
  stillDocked: boolean;
  onRestart: () => void;
}

// 08 — 끝. 목표가 이뤄졌음을 확인해주고, 사용자를 이 앱 밖으로 내보낸다.
//
// 07이 '지금 벌어지는 일'이었다면 여기는 '이제 어떻게 되었는가'다.
// 이 화면을 보고서야 폰을 빼는 사람이 있으므로, 아직 꽂혀 있다면 07과 같은
// 틀을 쓴다 — 꽂힌 채로도 읽혀야 한다. 첫 줄이 손에 관한 지시인 것도 그래서다.
export default function PhaseDone({ stillDocked, onRestart }: Props) {
  // 07에서 '폰을 뺐어요'를 누르고 온 사람은 화면 전체를 보고 있다.
  // 시간이 다 되어 저절로 넘어온 사람은 아직 꽂혀 있으므로 아래 절반뿐이다.
  const Frame = stillDocked ? DockedFrame : MegafontFrame;
  return (
    <Frame phaseLabel="완료">
      <div className="done">
        {/* 두 급의 활자가 한 문장을 나눠 쥔다. '두고.'로 흘리는 종결은
            이 앱에서 허용하는 유일한 예외다 — 몸을 돌려 걸어 나가는
            동작과 문장이 같이 끝나는 자리라서. */}
        <h1>폰만 가져가세요</h1>

        <p className="done-lead">한 줄은 저 벽에 두고.</p>

        <div className="done-after">
          <p>
            그 한 줄은 다른 말들 사이를 천천히 흘러다닙니다.
            지나는 사람은 누가 썼는지 모른 채 읽습니다.
          </p>
          <p>
            {STAY_DAYS}일 뒤에는 사라집니다. 따로 보관되지 않으니,
            벽에 있는 동안이 이 말의 전부입니다.
          </p>
        </div>

        <button className="done-home-link" onClick={onRestart}>
          한 줄 더 쓰기
        </button>
      </div>
    </Frame>
  );
}
