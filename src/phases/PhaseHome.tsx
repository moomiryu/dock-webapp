interface Props {
  onStartWrite: () => void;
  onStartVoice: () => void;
}

// 시작 화면. 최소 버전 — 이 앱이 무엇이고, 어디로 들어가는지만 말한다.
export default function PhaseHome({ onStartWrite, onStartVoice }: Props) {
  return (
    <div className="home-frame">
      <div className="home-stage">
        <div className="home-eyebrow">캠퍼스 공공 발화 시스템</div>

        <h1 className="home-wordmark-static">MEGAFONT</h1>

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
            시작하기
          </button>
          <button className="home-link" onClick={onStartVoice}>
            음성으로 시작하기
          </button>
          <a className="home-link" href="/archive">
            아카이브 보기
          </a>
        </div>
      </div>

      <div className="home-footer">
        <span>MEGAFONT v0.1</span>
        <span>거치대에 폰을 올려도 시작돼요</span>
      </div>
    </div>
  );
}
