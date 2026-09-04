import { useState } from 'react';
import InfoOverlay from '../components/InfoOverlay';
import { STAY_DAYS } from '../lib/wall';

interface Props {
  onStart: () => void;
}

// 01 Intro — 이름이 화면을 차지하고, 조작은 그 위에 얹힌 얇은 층으로 온다.
// 타입 파운드리 홈페이지의 위계: 글자가 먼저고 인터페이스는 나중이다.
export default function PhaseHome({ onStart }: Props) {
  const [info, setInfo] = useState(false);

  if (info) return <InfoOverlay onClose={() => setInfo(false)} />;

  return (
    <div className="home-frame">
      {/* 아래층 — 이름. 화면 폭에 꽉 차고 가장자리에서 잘린다 */}
      <h1 className="home-mark" aria-label="MEGAFONT">
        <span aria-hidden>MEGA</span>
        <span aria-hidden>FONT</span>
      </h1>

      {/* 위층 — 조작 */}
      <div className="home-layer">
        <div className="home-top">
          <span className="home-eyebrow">캠퍼스 공공 발화 시스템</span>
        </div>

        <div className="home-bottom">
          <div className="home-headline">
            공공의 한 줄,<br />
            당신의 형식
          </div>

          <div className="home-tagline">
            캠퍼스 외벽에 한 줄을 둡니다.<br />
            {STAY_DAYS}일간 머무르고 사라집니다.
          </div>

          <div className="home-actions">
            <button className="home-cta" onClick={onStart}>
              시작하기
            </button>
            <button className="home-link" onClick={() => setInfo(true)}>
              프로젝트 정보
            </button>
          </div>

          <div className="home-footer">
            <span>MEGAFONT v0.1</span>
            <span>거치대에 폰을 올려도 시작돼요</span>
          </div>
        </div>
      </div>
    </div>
  );
}
