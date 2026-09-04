import MegafontFrame from '../components/MegafontFrame';
import { STAY_DAYS } from '../lib/wall';

interface Props {
  onRestart: () => void;
  /** Firebase 미연결일 때만 뜨는 개발 참고줄 */
  devNote?: string | null;
}

// 06 Docking — 마지막 화면. 화면 밖으로 사용자를 내보낸다.
// 글이 아니라 *동작*을 지시해야 해서, 문장 옆에 폰이 홈에 들어가는
// 픽토그램을 반복 재생한다. (모션은 prefers-reduced-motion에서 멈춘다)
export default function PhaseDocking({ onRestart, devNote }: Props) {
  return (
    <MegafontFrame phaseLabel="도킹">
      <div className="guide-hero">
        <h1>이제 홈에 꽂아주세요</h1>
        <p>
          폰을 가로로 눕혀 가만히 밀어 넣으면,<br />
          당신의 한 줄이 외벽 한가운데 떠올라요.
        </p>

        <DockGuide />

        <p>외벽엔 {STAY_DAYS}일간 머무릅니다. 그 뒤에는 남지 않아요.</p>

        {devNote && <p className="dev-note">{devNote}</p>}

        <button className="done-home-link" onClick={onRestart}>
          처음으로
        </button>
      </div>
    </MegafontFrame>
  );
}

// 폰 → 홈. 말로 설명하기 어려운 동작이라 그림이 대신한다.
function DockGuide() {
  return (
    <div className="dock-guide" aria-hidden>
      <svg viewBox="0 0 160 150" width="150" height="141">
        {/* 본체 윗면과 홈(슬롯) */}
        <rect x="18" y="104" width="124" height="38" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <rect x="44" y="112" width="72" height="7" rx="3.5" fill="currentColor" />

        {/* 내려가는 폰 — 가로로 눕힌 상태 */}
        <g className="dock-phone">
          <rect
            x="44"
            y="30"
            width="72"
            height="38"
            rx="5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <line x1="52" y1="49" x2="56" y2="49" stroke="currentColor" strokeWidth="1.8" />
        </g>

        {/* 방향 */}
        <g className="dock-arrow" stroke="currentColor" strokeWidth="1.5" fill="none">
          <line x1="80" y1="76" x2="80" y2="94" />
          <polyline points="73,87 80,94 87,87" />
        </g>
      </svg>
    </div>
  );
}
