import DockFrame from '../components/DockFrame';

export default function Phase05bDock() {
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
    </DockFrame>
  );
}
