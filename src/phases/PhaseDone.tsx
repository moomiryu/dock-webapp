import MegafontFrame from '../components/MegafontFrame';
import { STAY_DAYS } from '../lib/wall';

interface Props {
  onRestart: () => void;
}

// 08 — 끝. 목표가 이뤄졌음을 확인해주고, 사용자를 이 앱 밖으로 내보낸다.
//
// 07이 '지금 벌어지는 일'이었다면 여기는 '이제 어떻게 되었는가'다.
// 마지막 지시는 화면이 아니라 손에 관한 것 — 폰을 도로 가져가라는 말이
// 먼저 오고, 남은 이야기는 그다음이다.
export default function PhaseDone({ onRestart }: Props) {
  return (
    <MegafontFrame phaseLabel="완료">
      <div className="guide-hero">
        <h1>외벽에 남았습니다</h1>

        <p className="done-lead">이제 폰을 가져가세요.</p>

        <div className="done-after">
          <p>
            방금 그 한 줄은 다른 말들 사이를 천천히 흘러다닙니다.
            지나는 사람은 누가 썼는지 모른 채 읽습니다.
          </p>
          <p>
            {STAY_DAYS}일 뒤에는 사라집니다. 따로 보관되지 않으니,
            지금 외벽에 있는 동안이 이 말의 전부입니다.
          </p>
        </div>

        <button className="done-home-link" onClick={onRestart}>
          한 줄 더 쓰기
        </button>
      </div>
    </MegafontFrame>
  );
}
