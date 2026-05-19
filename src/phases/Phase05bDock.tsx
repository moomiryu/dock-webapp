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
    <DockFrame phaseLabel="다시 한 번 거치대에 올려주세요">
      <div className="guide-hero">
        <div className="glyph" aria-hidden>📡</div>
        <h1>다시 한 번<br />거치대에 올려주세요</h1>
        <p>
          폰을 R2 거치대 후면에<br />
          한 번 더 안착시키면<br />
          메시지가 외벽으로 떠나요.
        </p>
      </div>

      <button
        className="primary-action dock-sim-btn"
        onClick={simulateSecondTap}
        style={{ marginTop: 16 }}
      >
        <span>(개발) 바로 보내기</span>
      </button>
      <p className="dock-sim-note">
        NFC 태그 없이 흐름을 끝까지 보기 위한 임시 버튼이에요.
      </p>
    </DockFrame>
  );
}
