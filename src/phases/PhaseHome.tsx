import { useState } from 'react';
import InfoOverlay from '../components/InfoOverlay';
import HomeCharacter from '../character/HomeCharacter';
import HomeCrowd from '../character/HomeCrowd';
import HomeVoices from '../components/HomeVoices';
interface Props { onStart: () => void; }
export default function PhaseHome({ onStart }: Props) {
  const [info, setInfo] = useState(false);
  if (info) return <InfoOverlay onClose={() => setInfo(false)} onStart={onStart} />;
  return (
    <div className="home-frame">
      {/* 구경꾼이 먼저 그려져야 메가폰트 뒤에 선다 */}
      <HomeCrowd />
      {/* 나팔에서 나오는 말은 캐릭터 뒤, 배경으로 흩어진다 */}
      <HomeVoices />
      <HomeCharacter />
      <div className="home-layer">
        <div className="home-intro">
          <h1 className="home-headline"><span>MegaFont</span></h1>
          <p className="home-subtitle">대학 내 공공발화를 위한 카트, 메가폰트</p>
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
