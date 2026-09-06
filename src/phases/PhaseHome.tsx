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
        <div className="home-intro">
          <h1 className="home-headline"><span>MegaFont.</span></h1>
          <p className="home-subtitle">밤에만 보이는 조용한 공공발화.</p>
        </div>
        <div className="home-gate">
          <div className="home-actions">
            <button className="home-cta" onClick={() => setInfo(true)}>처음이에요</button>
            <button className="home-info-btn" onClick={onStart}>써봤어요</button>
          </div>
        </div>
      </div>
    </div>
  );
}
