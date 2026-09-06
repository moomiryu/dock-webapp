import { useLayoutEffect, useRef, useState } from 'react';
import InfoOverlay from '../components/InfoOverlay';
import HomeCharacter from '../components/HomeCharacter';
interface Props { onStart: () => void; }
export default function PhaseHome({ onStart }: Props) {
  const [info, setInfo] = useState(false);
  const wordmark = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const text = wordmark.current;
    const parent = text?.parentElement;
    if (!text || !parent) return;
    let live = true;
    let lastWidth = 0;
    const fit = () => {
      if (!live) return;
      text.style.fontSize = '100px';
      const width = text.getBoundingClientRect().width;
      text.style.fontSize = ((parent.clientWidth - 2) / width * 100) + 'px';
    };
    const observer = new ResizeObserver(() => {
      if (parent.clientWidth !== lastWidth) { lastWidth = parent.clientWidth; fit(); }
    });
    observer.observe(parent);
    fit();
    document.fonts.load('900 100px "Lineal VF"').then(fit);
    document.fonts.addEventListener('loadingdone', fit);
    return () => { live = false; observer.disconnect(); document.fonts.removeEventListener('loadingdone', fit); };
  }, [info]);
  if (info) return <InfoOverlay onClose={() => setInfo(false)} onStart={onStart} />;
  return (
    <div className="home-frame">
      <HomeCharacter />
      <div className="home-layer">
        <div className="home-intro">
          <h1 className="home-headline"><span ref={wordmark}>MegaFont.</span></h1>
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
