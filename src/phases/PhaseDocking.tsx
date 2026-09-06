import MegafontFrame from '../components/MegafontFrame';
import { raiseShowTrigger } from '../lib/firebase';
import { EMPHASIS_SEC, STAY_DAYS } from '../lib/wall';

interface Props {
  /** 방금 보낸 글의 id — 벽이 '어느 글을 띄울지' 알아야 한다 */
  messageId: string;
  /** 폰이 홈에 꽂혔을 때. 실제 설치에서는 NFC·센서가 이걸 부른다 */
  onDocked: () => void;
  /** Firebase 미연결일 때만 뜨는 개발 참고줄 */
  devNote?: string | null;
}

// 06 Docking — 화면 밖으로 사용자를 내보내는 자리.
//
// 지시만 하고 끝내면 사용자는 꽂은 뒤 무슨 일이 생기는지 모른 채 서 있게 된다.
// 그래서 '무엇을 하라'와 '그러면 무엇이 일어난다'를 한 화면에 같이 둔다.
export default function PhaseDocking({ messageId, onDocked, devNote }: Props) {
  // 꽂힌 순간 벽에 신호를 보낸다. 실패해도 화면은 넘어간다 —
  // 벽이 못 받았다고 사용자를 여기 붙잡아 둘 이유는 없다.
  function handleDocked() {
    void raiseShowTrigger(messageId);
    onDocked();
  }

  return (
    <MegafontFrame phaseLabel="도킹">
      <div className="guide-hero">
        {/* 결과를 제목으로 올린다. 무엇이 일어날지 알면 지시는 한 줄이면 된다. */}
        <h1>꽂으면, 저 벽에 크게 떠오릅니다</h1>

        <p>
          벽을 보고 서서, 폰 위쪽이 먼저 들어가도록<br />
          홈에 세로로 밀어 넣어주세요.
        </p>

        <DockGuide />

        {/* 행동 다음에 결과 — 꽂기 전에 무엇이 일어날지 미리 안다.
            그리고 끝내는 것도 사람이라는 것까지 미리 말해준다: 꽂아 두는 동안
            크게 떠 있고, 빼면 거기서 큰 목소리가 끝난다. */}
        <div className="dock-next">
          <div className="dock-next-row">
            <span className="dock-next-label">빼면</span>
            <p>
              큰 목소리가 거기서 끝나고, <b>{STAY_DAYS}일간 메아리</b>로 남습니다.
            </p>
          </div>
          <span className="dock-next-cap">
            그대로 두면 {EMPHASIS_SEC}초 뒤 저절로 메아리가 됩니다
          </span>
        </div>

        <button className="primary-action" onClick={handleDocked}>
          <span>꽂았어요</span>
        </button>

        <p className="dev-note">
          실제 설치에서는 꽂는 순간 저절로 넘어갑니다. 지금은 장치가 없어 버튼으로 대신해요.
        </p>

        {devNote && <p className="dev-note">{devNote}</p>}
      </div>
    </MegafontFrame>
  );
}

// 폰 → 홈. 말로 설명하기 어려운 동작이라 그림이 대신한다.
// 그리는 순서가 곧 앞뒤다: 폰을 먼저 두고 본체를 바탕색으로 덮어,
// 내려간 폰이 본체 뒤로 사라지게 한다 — 페이드 없이 '들어갔다'가 읽힌다.
function DockGuide() {
  return (
    <div className="dock-guide" aria-hidden>
      <svg viewBox="0 0 140 190" width="112" height="152">
        {/* 내려가는 폰 — 세로로, 위쪽(스피커 쪽)이 아래를 향한다 */}
        <g className="dock-phone">
          <rect
            x="50"
            y="8"
            width="40"
            height="76"
            rx="6"
            fill="var(--paper)"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          {/* 스피커 — 이게 아래에 있다는 게 '거꾸로 잡는다'는 표시 */}
          <rect x="62" y="74" width="16" height="2.6" rx="1.3" fill="currentColor" />
        </g>

        {/* 방향 */}
        <g className="dock-arrow" stroke="currentColor" strokeWidth="1.5" fill="none">
          <line x1="70" y1="94" x2="70" y2="114" />
          <polyline points="63,107 70,114 77,107" />
        </g>

        {/* 본체 윗면과 홈(슬롯) — 바탕색으로 채워 폰을 가린다 */}
        <rect
          x="14"
          y="124"
          width="112"
          height="62"
          fill="var(--paper)"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <rect x="46" y="132" width="48" height="7" rx="3.5" fill="currentColor" />
      </svg>
    </div>
  );
}
