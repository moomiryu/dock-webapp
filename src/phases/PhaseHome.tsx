import { useEffect, useState, type CSSProperties } from 'react';
import InfoOverlay from '../components/InfoOverlay';
import LangDialog from '../components/LangDialog';
import HomeCharacter from '../character/HomeCharacter';
import HomeCrowd from '../character/HomeCrowd';
import HomeBubbles from '../components/HomeBubbles';
import { LANG_OPEN, pick, useLang } from '../lib/lang';
import { tokenMs } from '../lib/motion';
import { Eyes } from './PhaseOnWall';

/* 홈의 말. 영어는 초안이다 — 3단계(문구)에서 다시 본다 */
const T = {
  subtitle: { ko: '대학 내 공공발화를 위한 카트, 메가폰트', en: 'MegaFont, a cart for speaking out on campus' },
  about: { ko: '자세히 보기', en: 'Learn more' },
  first: { ko: '처음이에요', en: 'First time' },
  again: { ko: '써봤어요', en: "I've used it" },
  boot: { ko: 'MegaFont 불러오는 중', en: 'Loading MegaFont' }
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
      <Boot />
    </div>
  );
}

const BOOT_KEY = 'megafont.splash.v1';
let booted = false;   // 세션 저장을 못 쓰는 창(사파리 비공개 등)에서도 이번 방문엔 한 번만
/** 여는 장면의 느림 — 첫 깜빡임까지 · 깜빡임 · 눈 감고 있기 · 접혀 꺼지기를 모두 이 배율로(app.css .home-boot가 --boot-k로 받는다).
    2026-10-21 디자이너 "지금 너무 빠르다" → 1 · 1.5 · 2 · 2.5배 영상 중 2배(꺼지기까지 약 1.6초 → 3.3초) */
const BOOT_K = 2;
/**
 * 처음 열 때 한 번 — 07의 '30초 기다리는 창'(빨강 화면에 두 눈, 숫자 없이)이 앱이 준비되는 동안 홈을 덮고 깜빡이다가,
 * 눈을 감고 옛 TV처럼 꺼진다: 위아래로 접혀 가로 한 줄이 됐다가 그 줄이 사라지며 홈이 드러난다(2026-10-20 결정 26, 디자이너 —
 * "눈 깜빡이다가, 그 창이 꺼지는 걸로"). 준비가 아무리 빨라도 한 번은 깜빡이고(첫 깜빡임은 --t-hold에 — app.css .home-boot),
 * 누르면 바로 꺼진다. 움직임 줄이기면 띄우지 않는다
 */
function Boot() {
  const lang = useLang();
  const [phase, setPhase] = useState<'on' | 'shut' | 'off' | 'gone'>(() => {
    let seen = booted;
    try { seen ||= sessionStorage.getItem(BOOT_KEY) === '1'; } catch { /* 비공개 창 */ }
    return seen || matchMedia('(prefers-reduced-motion: reduce)').matches ? 'gone' : 'on';
  });
  useEffect(() => {
    if (phase !== 'on') return;
    booted = true;
    try { sessionStorage.setItem(BOOT_KEY, '1'); } catch { /* 이번 방문엔 booted가 든다 */ }
    // 준비 = 글꼴과 첫 화면(load). 그리고 한 번은 깜빡인다 — 첫 깜빡임(--t-hold에 와서 0.09초)이 지나고 --t-return 한 박 뒤
    const t0 = performance.now(), least = (tokenMs('--t-hold', 700) + 90 + tokenMs('--t-return', 220)) * BOOT_K;
    const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true }));
    let alive = true, timer = 0;
    void Promise.all([document.fonts?.ready, loaded]).then(() => {
      if (alive) timer = window.setTimeout(() => setPhase('shut'), Math.max(0, least - (performance.now() - t0)));
    });
    return () => { alive = false; window.clearTimeout(timer); };
  }, [phase]);
  // 눈을 감고 --t-return 뒤에 꺼진다(접힘은 CSS — 끝나면 걷힌다)
  useEffect(() => {
    if (phase !== 'shut') return;
    const id = window.setTimeout(() => setPhase('off'), tokenMs('--t-return', 220) * BOOT_K);
    return () => window.clearTimeout(id);
  }, [phase]);
  if (phase === 'gone') return null;
  return (
    <div className={'onwall-screen home-boot is-' + phase} style={{ '--boot-k': BOOT_K } as CSSProperties} onClick={() => phase === 'on' && setPhase('shut')}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget && phase === 'off') setPhase('gone'); }}>
      <span className="sr-only" role="status">{pick(T.boot, lang)}</span>
      <div className="onwall-floor"><Eyes /></div>
    </div>
  );
}
