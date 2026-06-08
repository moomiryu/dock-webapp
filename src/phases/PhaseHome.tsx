import { useEffect } from 'react';

interface Props {
  onStartWrite: () => void;
}

// Home uses the warm brand palette (NOT the user-choice moods).
// MEGAFONT가 사용자에게 말하는 자리 — 따뜻한 액자.
export default function PhaseHome({ onStartWrite }: Props) {
  useEffect(() => {
    document.body.classList.add('themed');
    document.body.style.setProperty('--bg-outer', '#ffffff');
    return () => {
      document.body.classList.remove('themed');
      document.body.style.removeProperty('--bg-outer');
    };
  }, []);

  return (
    <div className="home-frame brand">
      <div className="home-stage">
        <div className="home-eyebrow">
          캠퍼스 공공 발화 시스템
        </div>

        <h1 className="home-wordmark-static" data-glyph="MEGAFONT">
          MEGAFONT
        </h1>

        <div className="home-headline">
          공공의 한 줄,<br />
          당신의 형식
        </div>

        <div className="home-tagline">
          캠퍼스 외벽에 한 줄을 둡니다.<br />
          7일간 머무릅니다.
        </div>

        <div className="home-actions">
          <button className="home-cta" onClick={onStartWrite}>
            <span>START →</span>
          </button>
          <a className="home-link" href="/archive">
            아카이브 보기 →
          </a>
        </div>
      </div>

      <div className="home-footer">
        <span>MEGAFONT v0.1</span>
        <span>· · ·</span>
        <span>R2 거치대에 폰을 올려도 시작돼요</span>
      </div>
    </div>
  );
}
