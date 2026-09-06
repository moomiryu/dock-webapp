import { useState } from 'react';
import InfoOverlay from '../components/InfoOverlay';
import HomeCharacter from '../components/HomeCharacter';
interface Props { onStart: () => void; }
export default function PhaseHome({ onStart }: Props) {
  const [info, setInfo] = useState(false);
  if (info) return <InfoOverlay onClose={() => setInfo(false)} onStart={onStart} />;
  return (
    <div className="home-frame">
      <HomeCharacter />
      <div className="home-layer">
        <h1 className="home-headline">안녕하세요.<br />메가폰트입니다.</h1>
        <div className="home-gate">
          <p className="home-gate-q">메가폰트, 처음이세요?</p>
          <div className="home-actions">
            <button className="home-cta" onClick={() => setInfo(true)}>처음이에요</button>
            <button className="home-info-btn" onClick={onStart}>써봤어요</button>
          </div>
        </div>
      </div>
    </div>
  );
}
