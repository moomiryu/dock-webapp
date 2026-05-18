import { useEffect, useState } from 'react';
import { moods } from '../lib/palettes-v2';

interface Props {
  onStartWrite: () => void;
}

// Home cycles through moods slowly as a "breathing" identity.
// Each mood lingers ~6s before crossfading to the next.
const MOOD_CYCLE_MS = 6000;

export default function PhaseHome({ onStartWrite }: Props) {
  const [moodIdx, setMoodIdx] = useState(0);
  const mood = moods[moodIdx];

  useEffect(() => {
    document.body.classList.add('themed');
    document.body.style.setProperty('--bg-outer', mood.bg);
  }, [mood.bg]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMoodIdx((i) => (i + 1) % moods.length);
    }, MOOD_CYCLE_MS);
    return () => clearInterval(interval);
  }, []);

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

        <h1 className="home-wordmark" data-glyph="DOCK">
          DOCK
        </h1>

        <div className="home-tagline">
          한 줄을 외벽으로 보낸다.<br />
          60자, 당신이 결정하는 형식.<br />
          7일간 풍경의 일부.
        </div>

        <div className="home-mood-tag">
          현재 톤 · {mood.nameLatin}
        </div>

        <div className="home-actions">
          <button className="home-cta" onClick={onStartWrite}>
            <span>메시지 쓰기 시작 →</span>
          </button>
          <a className="home-link" href="/admin">
            외벽 미리보기
          </a>
        </div>
      </div>

      <div className="home-footer">
        <span>DOCK v0.1</span>
        <span>· · ·</span>
        <span>모르겠다면 R2 거치대에 폰을 올리세요</span>
      </div>
    </div>
  );
}
