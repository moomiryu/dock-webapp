import { useEffect, useState } from 'react';
import DockedFrame from '../components/DockedFrame';
import { releaseDock } from '../lib/firebase';
import { EMPHASIS_SEC } from '../lib/wall';

interface Props {
  /** pulled=true면 사용자가 폰을 이미 뺐다는 뜻 — 08이 화면 전체를 쓸 수 있다 */
  onDone: (pulled: boolean) => void;
}

// 07 — 꽂은 다음. 행동의 *결과*를 알리는 화면.
//
// 여기까지 앱은 "이렇게 하세요"만 말했다. 무엇을 했는지, 지금 무슨 일이
// 벌어지는지를 말해주지 않으면 사용자는 자기 행동이 통했는지 알 수 없다
// (Norman의 '평가의 간극' — 지각·해석·비교의 세 단계).
//
// 그래서 이 화면의 역할은 폰을 보게 하는 게 아니라 *벽을 보게* 하는 것이다.
// 읽을 게 많으면 고개를 들지 않는다. 남은 초와 한 문장만 둔다.
//
// 그리고 이 시간은 정해진 길이가 아니라 상한이다. 끝내는 것은 사람이다 —
// 폰을 빼면 거기서 큰 목소리가 끝난다.
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
        // 시간이 다 됐을 뿐 폰은 아직 꽂혀 있다
        onDone(false);
      }
    }, 100);
    return () => clearInterval(id);
  }, [onDone]);

  const pct = ((EMPHASIS_SEC - left) / EMPHASIS_SEC) * 100;

  // 실제 설치에서는 홈의 센서가 이걸 알아챈다. 지금은 버튼이 대신한다.
  function handlePulled() {
    void releaseDock();
    onDone(true);
  }

  return (
    <DockedFrame phaseLabel="벽에 표시 중">
      <div className="onwall">
        <h1>지금 벽에 떠 있어요</h1>
        <p className="onwall-look">고개를 들어 보세요.</p>

        <div className="onwall-meter">
          <div className="onwall-count" aria-live="off">
            {Math.ceil(left)}
          </div>
          <span className="onwall-cap">최대 {EMPHASIS_SEC}초</span>
        </div>

        <div
          className="onwall-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
          aria-label="벽에 크게 떠 있는 시간"
        >
          <i style={{ width: `${pct}%` }} />
        </div>

        {/* 끝내는 사람은 당신이다 — 이걸 말해주지 않으면 그냥 기다리게 된다 */}
        <p className="onwall-note">
          폰을 빼면 거기서 큰 목소리가 끝나고,<br />
          그 뒤로는 메아리로 남습니다.
        </p>

        <button className="primary-action" onClick={handlePulled}>
          <span>폰을 뺐어요</span>
        </button>
      </div>
    </DockedFrame>
  );
}
