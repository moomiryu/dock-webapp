import { useEffect, useState, type CSSProperties } from 'react';
import InfoOverlay from '../components/InfoOverlay';
import LangDialog from '../components/LangDialog';
import HomeCharacter from '../character/HomeCharacter';
import HomeCrowd from '../character/HomeCrowd';
import HomeBubbles from '../components/HomeBubbles';
import { LANG_OPEN, pick, useLang } from '../lib/lang';
import { tokenMs } from '../lib/motion';
import { campusPath } from '../lib/ground';

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
 * 10-06 ~ 10-20은 풍경 포스터 HomePoster였다). 큰 메가폰트의 입에서 소리 결이 숨 쉬듯 퍼지고, 사람이 빨개질 때마다 굵은 결이
 * 한 번 나간다(HomeBubbles, 2026-10-21 결정 51 — 그전엔 큰 회색 말풍선이 떠올랐고, 더 전엔 글이 흘렀다. 결정 51의 작은 점 말풍선은
 * 10-22 결정 56에 뺐다).
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
      {/* 학교가 맨 뒤 — 그 앞으로 소리 결이 퍼진다(둘 다 층 번호 없음, 문서 차례) */}
      <Campus />
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

/** 학교의 꼴 — 폭 390 좌표, 땅 윗선이 y 0(그 위로 솟은 만큼이 음수). 한 번만 짓는다 */
const CAMPUS = campusPath(0);
/**
 * 홈 뒤의 학교(2026-11-03 디자이너 — Step 3의 학교를 홈 같은 자리에 얹은 미리보기를 보고 "좋다, 근데 위계 좀 낮추고, 캐릭터들도 그
 * 수평선 아래에서 걷게"). 꼴은 Step 3과 같다(lib/ground campusPath — 벽 건물 양 끝 2.5배). 밑변은 메가폰트가 액자에 적는 --horizon
 * (charPos.horizon — 그림자 줄에서 키의 HORIZON_K 위)에 서고, 폭은 화면 폭. 색은 app.css .home-campus
 */
function Campus() {
  return (
    <svg className="home-campus" viewBox={`0 ${CAMPUS.top} 390 ${-CAMPUS.top}`} style={{ aspectRatio: `390 / ${-CAMPUS.top}` }} aria-hidden="true" focusable="false">
      <path d={CAMPUS.d} />
    </svg>
  );
}

const BOOT_KEY = 'megafont.splash.v1';
let booted = false;   // 세션 저장을 못 쓰는 창(사파리 비공개 등)에서도 이번 방문엔 한 번만
/** 여는 장면의 느림 — 최소 대기 · 머물기 · 접혀 꺼지기를 모두 이 배율로(app.css .home-boot가 --boot-k로 받는다).
    2026-10-21 디자이너 "지금 너무 빠르다" → 1 · 1.5 · 2 · 2.5배 영상 중 2배 */
const BOOT_K = 2;
/**
 * 처음 열 때 한 번 — 빨강 화면이 앱이 준비되는 동안 홈을 덮고, 가운데 점 셋이 차례로 살짝 튀어 오르며 켜진다(로딩의 '…' —
 * 2026-11-03 디자이너가 견본 넷 중 '라'. 점 모양은 쓰기 단계 글자 수 점을 참고했다. 그전엔 07의 두 눈이 깜빡이다 감았다, 결정 26).
 * 준비되면 옛 TV처럼 꺼진다: 위아래로 접혀 가로 한 줄이 됐다가 그 줄이 사라지며 홈이 드러난다. 준비가 아무리 빨라도 점이
 * 한 바퀴는 돌고, 누르면 바로 꺼진다. 움직임 줄이기면 띄우지 않는다
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
    // 준비 = 글꼴과 첫 화면(load). 그리고 점 셋이 한 바퀴(--t-hold × 1.6 — app.css .boot-dots)는 돌도록 (--t-hold + --t-return) × BOOT_K
    const t0 = performance.now(), least = (tokenMs('--t-hold', 700) + tokenMs('--t-return', 220)) * BOOT_K;
    const loaded = document.readyState === 'complete' ? Promise.resolve() : new Promise((r) => window.addEventListener('load', r, { once: true }));
    let alive = true, timer = 0;
    void Promise.all([document.fonts?.ready, loaded]).then(() => {
      if (alive) timer = window.setTimeout(() => setPhase('shut'), Math.max(0, least - (performance.now() - t0)));
    });
    return () => { alive = false; window.clearTimeout(timer); };
  }, [phase]);
  // --t-return 더 머문 뒤에 꺼진다(접힘은 CSS — 끝나면 걷힌다)
  useEffect(() => {
    if (phase !== 'shut') return;
    const id = window.setTimeout(() => setPhase('off'), tokenMs('--t-return', 220) * BOOT_K);
    return () => window.clearTimeout(id);
  }, [phase]);
  if (phase === 'gone') return null;
  return (
    /* 누르면 바로 걷힌다(2026-10-29 점검 — 위 주석대로. 그전엔 누른 뒤에도 눈 감기 · 접히기가 1.3초 이어졌다) */
    <div className={'onwall-screen home-boot is-' + phase} style={{ '--boot-k': BOOT_K } as CSSProperties} onClick={() => setPhase('gone')}
      onAnimationEnd={(e) => { if (e.target === e.currentTarget && phase === 'off') setPhase('gone'); }}>
      <span className="sr-only" role="status">{pick(T.boot, lang)}</span>
      <div className="boot-dots" aria-hidden="true">
        {[0, 1, 2].map((i) => <i key={i} style={{ '--i': i } as CSSProperties} />)}
      </div>
    </div>
  );
}
