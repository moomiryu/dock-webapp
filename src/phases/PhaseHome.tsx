import { useState } from 'react';
import InfoOverlay from '../components/InfoOverlay';
import HomePoster from '../components/HomePoster';
import { pick, useLang } from '../lib/lang';

/* 홈의 말. 영어는 초안이다 — 3단계(문구)에서 다시 본다 */
const T = {
  subtitle: { ko: '대학 내 공공발화를 위한 카트, 메가폰트', en: 'MegaFont, a cart for speaking out on campus' },
  about: { ko: '메가폰트에 대해 더 알아보기', en: 'About MegaFont' },
  first: { ko: '처음이에요', en: 'First time' },
  again: { ko: '써봤어요', en: "I've used it" }
};

interface Props { onStart: () => void; }
export default function PhaseHome({ onStart }: Props) {
  /** 소개 판 — 세로쓰기 '메가폰트에 대해 / 더 알아보기'는 About 한 장, '처음이에요'는 사용 안내 세 장 */
  const [info, setInfo] = useState<'about' | 'guide' | null>(null);
  const lang = useLang();
  if (info) return <InfoOverlay about={info === 'about'} onClose={() => setInfo(null)} onStart={onStart} />;
  /* 2026-10-06 풍경 포스터 + 스플래시로 다시 지었다(HomePoster). 큰 메가폰트 · 구경꾼 · 흐르는 말은
     08 완료 화면(PhaseDone)이 계속 쓴다. 워드마크와 부제는 그림(원 글)이 되어 낭독기에는 숨긴 글로 준다 */
  return (
    <div className="home-frame is-poster">
      <HomePoster onAbout={() => setInfo('about')} aboutLabel={pick(T.about, lang)} />
      <div className="home-layer">
        <div className="sr-only">
          <h1>MegaFont</h1>
          <p>{pick(T.subtitle, lang)}</p>
        </div>
        <div className="home-gate">
          <div className="home-actions">
            <button className="home-cta" onClick={() => setInfo('guide')}>{pick(T.first, lang)}</button>
            <button className="home-info-btn" onClick={onStart}>{pick(T.again, lang)}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
