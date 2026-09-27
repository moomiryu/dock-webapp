import { useState } from 'react';
import InfoOverlay from '../components/InfoOverlay';
import LangDialog from '../components/LangDialog';
import HomeCharacter from '../character/HomeCharacter';
import HomeCrowd from '../character/HomeCrowd';
import HomeVoices from '../components/HomeVoices';
import { LANG_OPEN, pick, useLang } from '../lib/lang';

/* 홈의 말. 영어는 초안이다 — 3단계(문구)에서 다시 본다 */
const T = {
  subtitle: { ko: '대학 내 공공발화를 위한 카트, 메가폰트', en: 'MegaFont, a cart for speaking out on campus' },
  about: { ko: '메가폰트 소개', en: 'About MegaFont' },
  first: { ko: '처음이에요', en: 'First time' },
  again: { ko: '써봤어요', en: "I've used it" }
};

interface Props { onStart: () => void; }
export default function PhaseHome({ onStart }: Props) {
  /** 소개 판 — 물음표는 About 한 장, '처음이에요'는 사용 안내 세 장(2026-09-27) */
  const [info, setInfo] = useState<'about' | 'guide' | null>(null);
  /** 캐릭터를 누르면 뜨는 언어 창(2026-09-26) */
  const [dialog, setDialog] = useState(false);
  const lang = useLang();
  if (info) return <InfoOverlay about={info === 'about'} onClose={() => setInfo(null)} onStart={onStart} />;
  return (
    <div className="home-frame">
      {/* 구경꾼이 먼저 그려져야 메가폰트 뒤에 선다 */}
      <HomeCrowd />
      {/* 나팔에서 나오는 말은 캐릭터 뒤, 배경으로 흩어진다 */}
      <HomeVoices />
      {/* 영문판이 닫힌 배포본에서는 캐릭터에 누를 일이 없다(lib/lang.ts · LANG_OPEN) */}
      <HomeCharacter onTap={LANG_OPEN ? () => setDialog(true) : undefined} />
      <div className="home-layer">
        <div className="home-intro">
          <h1 className="home-headline"><span>MegaFont</span></h1>
          <p className="home-subtitle">{pick(T.subtitle, lang)}</p>
        </div>
        <div className="home-gate">
          {/* About으로 가는 물음표(2026-09-27 사용자). 부제 자리에 'Info' 글자를 두었던
              것을 되돌리고, 첫 화면에만 떠 있는 원형 아이콘으로 옮겼다 — 마플(marpple.com)
              폰 화면의 '하단 메뉴 바로 위 오른쪽에 떠 있는 검은 원' 형식만 가져왔다.
              떠 있어서 홈의 배치를 밀지 않는다(app.css · .home-help) */}
          <button type="button" className="home-help" aria-label={pick(T.about, lang)}
            onClick={() => setInfo('about')}>
            <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden focusable="false">
              <path d="M8.3 8.6a3.7 3.7 0 1 1 5.4 3.3c-1.1.6-1.7 1.4-1.7 2.7v.7" fill="none"
                stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="19.2" r="1.35" fill="currentColor" />
            </svg>
          </button>
          <div className="home-actions">
            <button className="home-cta" onClick={() => setInfo('guide')}>{pick(T.first, lang)}</button>
            <button className="home-info-btn" onClick={onStart}>{pick(T.again, lang)}</button>
          </div>
        </div>
      </div>
      {dialog && <LangDialog onClose={() => setDialog(false)} />}
    </div>
  );
}
