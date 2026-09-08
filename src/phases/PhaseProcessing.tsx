import MegafontFrame from '../components/MegafontFrame';

interface Props {
  /** 0..1 — 실제 완료율이 아니라 경과 시간 기반 추정치 */
  progress: number;
}

const R = 44;
const CIRC = 2 * Math.PI * R;

// 05 Processing — 보내는 중.
//
// 스플래시(00)와 같은 가로 막대를 쓰면 두 화면이 같은 사건으로 읽힌다.
// 00은 '앱이 열리는 중'이고 여기는 '내 말이 벽으로 가는 중'이다. 그래서
// 형태를 아예 다르게 둔다 — 한 점에서 퍼져 나가는 파문. 소리가 가는 모양이다.
// 링은 경과를 채우고, 파문은 그 위에서 계속 퍼진다.
export default function PhaseProcessing({ progress }: Props) {
  const pct = Math.round(progress * 100);
  return (
    <MegafontFrame phaseLabel="벽으로 가는 중">
      <div className="send-hero">
        <div className="send-copy">
          <h1>벽으로 가는 중</h1>
          <p>한 줄이 먼저 도착하고 있어요.</p>
        </div>

        <div
          className="send-ripple"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="벽으로 가는 중"
        >
          <svg viewBox="0 0 120 120" width="176" height="176" aria-hidden>
            <g className="send-waves">
              <circle className="send-wave" cx="60" cy="60" r="11" />
              <circle className="send-wave d2" cx="60" cy="60" r="11" />
              <circle className="send-wave d3" cx="60" cy="60" r="11" />
            </g>
            <circle className="send-track" cx="60" cy="60" r={R} />
            <circle
              className="send-arc"
              cx="60"
              cy="60"
              r={R}
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - progress)}
            />
            <circle className="send-core" cx="60" cy="60" r="4.5" />
          </svg>
        </div>

        <div className="send-pct">{pct}%</div>
      </div>
    </MegafontFrame>
  );
}
