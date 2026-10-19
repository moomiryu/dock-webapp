import { useState } from 'react';
import InfoOverlay from '../components/InfoOverlay';
import LangDialog from '../components/LangDialog';
import HomeCharacter from '../character/HomeCharacter';
import HomeCrowd from '../character/HomeCrowd';
import HomeBubbles from '../components/HomeBubbles';
import { LANG_OPEN, pick, useLang } from '../lib/lang';

/* 홈의 말. 영어는 초안이다 — 3단계(문구)에서 다시 본다 */
const T = {
  subtitle: { ko: '대학 내 공공발화를 위한 카트, 메가폰트', en: 'MegaFont, a cart for speaking out on campus' },
  about: { ko: '자세히 보기', en: 'Learn more' },
  first: { ko: '처음이에요', en: 'First time' },
  again: { ko: '써봤어요', en: "I've used it" }
};

interface Props { onStart: () => void; }
/**
 * 홈 — 워드마크 · 부제 · 소개 글자 · 가운데 큰 메가폰트 · 걸어와 그 앞에 서면 빨개지는 사람들 · 버튼(2026-10-20 디자이너가 이 구도로 되돌렸다.
 * 10-06 ~ 10-20은 풍경 포스터 HomePoster였다). 사람이 빨개질 때마다 큰 메가폰트가 회색 점 말풍선을 쏘아 짓는다(HomeBubbles — 그전엔
 * 그 자리에 글이 흘렀다, HomeVoices).
 */
export default function PhaseHome({ onStart }: Props) {
  /** 소개 판 — '자세히 보기'는 About 한 장, '처음이에요'는 사용 안내 세 장(2026-09-27) */
  const [info, setInfo] = useState<'about' | 'guide' | null>(null);
  /** 캐릭터를 누르면 뜨는 언어 창(2026-09-26) */
  const [dialog, setDialog] = useState(false);
  const lang = useLang();
  if (info) return <InfoOverlay about={info === 'about'} onClose={() => setInfo(null)} onStart={onStart} />;
  return (
    <div className="home-frame">
      {/* 말풍선은 맨 뒤 — 캐릭터와 구경꾼 뒤로 지나가는 배경이다 */}
      <HomeBubbles />
      {/* 구경꾼이 먼저 그려져야 메가폰트 뒤에 선다 */}
      <HomeCrowd />
      {/* 영문판이 닫힌 배포본에서는 캐릭터에 누를 일이 없다(lib/lang.ts · LANG_OPEN).
          첫인사(끔뻑 → '!' → 환영 세 마디)는 하지 않는다 — 2026-10-20 사용자 '자기소개 기믹 없애셈'. 눈을 뜬 채 옆모습으로 시작한다 */}
      <HomeCharacter greet={false} onTap={LANG_OPEN ? () => setDialog(true) : undefined} />
      <div className="home-layer">
        <div className="home-intro">
          <h1 className="home-headline"><span>MegaFont</span></h1>
          <p className="home-subtitle">{pick(T.subtitle, lang)}</p>
          {/* About으로 — 부제 바로 밑 글자(2026-10-20 사용자, 물음표 대신) */}
          <button type="button" className="hint-open home-about" onClick={() => setInfo('about')}>{pick(T.about, lang)}</button>
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
