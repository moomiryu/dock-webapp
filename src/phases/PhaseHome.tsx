import { useState } from 'react';
import InfoOverlay from '../components/InfoOverlay';
import LangDialog from '../components/LangDialog';
import HomeCharacter from '../character/HomeCharacter';
import HomeCrowd from '../character/HomeCrowd';
import HomeVoices from '../components/HomeVoices';
import { LANG_OPEN, pick, useLang } from '../lib/lang';

/* 홈의 말. 영어는 초안이다 — 3단계(문구)에서 다시 본다 */
const T = {
  first: { ko: '처음이에요', en: 'First time' },
  again: { ko: '써봤어요', en: "I've used it" }
};

interface Props { onStart: () => void; }
export default function PhaseHome({ onStart }: Props) {
  /** 소개 판 — 'Info'는 About 한 장, '처음이에요'는 사용 안내 세 장(2026-09-27) */
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
          {/* 부제('대학 내 공공발화를 위한 카트, 메가폰트') 자리에 About으로 가는
              한 단어를 둔다(2026-09-27 사용자). 꼴은 1/5의 힌트와 같다 — 평소엔 옅은
              밑줄, 닿으면 가운데서 진한 선이 자란다(app.css · .hint-open) */}
          <button type="button" className="hint-open home-about" lang="en"
            onClick={() => setInfo('about')}>Info</button>
        </div>
        <div className="home-gate">
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
