import { useEffect, useState } from 'react';
import { moods } from '../lib/palettes-v2';

interface Props {
  onStartWrite: () => void;
}

export default function PhaseHome({ onStartWrite }: Props) {
  // First-time visitor sees a random mood — but it stays fixed once chosen
  // (no auto-cycling: accessibility + brand consistency + screenshot stability)
  const [moodIdx, setMoodIdx] = useState(() => Math.floor(Math.random() * moods.length));
  const mood = moods[moodIdx];

  useEffect(() => {
    document.body.classList.add('themed');
    document.body.style.setProperty('--bg-outer', mood.bg);
  }, [mood.bg]);

  function cycleMood() {
    setMoodIdx((i) => (i + 1) % moods.length);
  }

  return (
    <div
      className="home-frame"
      style={{
        ['--bg' as string]: mood.bg,
        ['--text' as string]: mood.text,
        ['--graphic' as string]: mood.graphic,
        ['--blend' as string]: mood.blend,
        background: mood.bg,
        color: mood.text
      }}
    >
      <div className="home-stage">
        <div className="home-eyebrow">
          캠퍼스 공공 발화 시스템
        </div>

        <button
          className="home-wordmark"
          data-glyph="DOCK"
          onClick={cycleMood}
          aria-label="톤 바꾸기"
          title="탭하여 톤 바꾸기"
        >
          DOCK
        </button>

        <div className="home-headline">
          공공의 한 줄,<br />
          당신의 형식
        </div>

        <div className="home-tagline">
          캠퍼스 외벽에 한 줄을 둡니다.<br />
          7일간 머무릅니다.
        </div>

        <button className="home-mood-tag" onClick={cycleMood}>
          현재 톤 · {mood.nameLatin}
          <span className="home-mood-hint">탭하여 변경</span>
        </button>

        <div className="home-actions">
          <button className="home-cta" onClick={onStartWrite}>
            <span>메시지 쓰러 가기 →</span>
          </button>
          <a className="home-link" href="/wall">
            외벽 미리보기 →
          </a>
          <a className="home-link home-link-secondary" href="/admin">
            관리자 목록
          </a>
        </div>
      </div>

      <div className="home-footer">
        <span>DOCK v0.1</span>
        <span>· · ·</span>
        <span>R2 거치대에 폰을 올려도 시작돼요</span>
      </div>
    </div>
  );
}
