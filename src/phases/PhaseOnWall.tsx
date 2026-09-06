import { useEffect, useState } from 'react';
import MegafontFrame from '../components/MegafontFrame';
import { EMPHASIS_SEC } from '../lib/wall';

interface Props {
  onDone: () => void;
}

// 07 — 꽂은 다음. 행동의 *결과*를 알리는 화면.
//
// 여기까지 앱은 "이렇게 하세요"만 말했다. 무엇을 했는지, 지금 무슨 일이
// 벌어지는지를 말해주지 않으면 사용자는 자기 행동이 통했는지 알 수 없다
// (Norman의 '평가의 간극' — 지각·해석·비교의 세 단계).
//
// 그래서 이 화면의 역할은 폰을 보게 하는 게 아니라 *외벽을 보게* 하는 것이다.
// 화면에는 남은 초만 크게 둔다. 읽을 게 많으면 고개를 들지 않는다.
export default function PhaseOnWall({ onDone }: Props) {
  const [left, setLeft] = useState(EMPHASIS_SEC);

  useEffect(() => {
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const passed = (Date.now() - startedAt) / 1000;
      const remain = Math.max(0, EMPHASIS_SEC - passed);
      setLeft(remain);
      if (remain <= 0) {
        clearInterval(id);
        onDone();
      }
    }, 100);
    return () => clearInterval(id);
  }, [onDone]);

  const pct = ((EMPHASIS_SEC - left) / EMPHASIS_SEC) * 100;

  return (
    <MegafontFrame phaseLabel="외벽에 표시 중">
      <div className="onwall">
        <div className="onwall-head">
          <h1>지금 외벽에 떠 있어요</h1>
          <p>고개를 들어 외벽을 보세요.</p>
        </div>

        <div className="onwall-count" aria-live="off">
          {Math.ceil(left)}
        </div>

        <div
          className="onwall-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label="외벽에 크게 떠 있는 시간"
        >
          <i style={{ width: `${pct}%` }} />
        </div>

        <p className="onwall-note">
          이 시간이 지나면 다른 말들 사이로 들어가<br />
          함께 흘러다닙니다.
        </p>

        <p className="onwall-hold">폰은 홈에 그대로 두세요</p>
      </div>
    </MegafontFrame>
  );
}
