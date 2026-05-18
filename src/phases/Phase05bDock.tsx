import DockFrame from '../components/DockFrame';

interface Props {
  onSimulateTap?: () => void;
}

export default function Phase05bDock({ onSimulateTap }: Props) {
  function simulateSecondTap() {
    if (onSimulateTap) {
      onSimulateTap();
    } else {
      // Fallback: just navigate to ?stage=submit which the router handles
      const url = new URL(window.location.href);
      url.searchParams.set('stage', 'submit');
      window.location.assign(url.toString());
    }
  }

  return (
    <DockFrame phaseLabel="PHASE 05b / 도킹 안내">
      <div className="guide-hero">
        <div className="glyph" aria-hidden>📡</div>
        <h1>이제 폰을 다시<br />NFC에 태깅해주세요</h1>
        <p>
          폰을 R2 거치대 후면에<br />
          한 번 더 안착시키면<br />
          메시지가 외벽으로 전송됩니다.
        </p>
      </div>

      <button
        className="primary-action dock-sim-btn"
        onClick={simulateSecondTap}
        style={{ marginTop: 16 }}
      >
        <span>(개발) 재태깅 시뮬 — 바로 전송</span>
      </button>
      <p className="dock-sim-note">
        실제 NFC 태그 없이 흐름을 끝까지 보기 위한 임시 버튼이에요.
        프로덕션에선 가려집니다.
      </p>
    </DockFrame>
  );
}
