import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import BackButton from './BackButton';
import { morphSvg, scopeSvg } from '../lib/svgAsset';
import { EMPHASIS_SEC, STAY_DAYS, WALL_H_M, WALL_W_M } from '../lib/wall';

// 작가가 삽화를 짝으로 준다 — 한 군데만 다른 두 컷이다. 그 사이를 오간다.
//
//   Step 1  크기 손잡이가 아래→위, 그에 따라 '가'가 작게→크게
//   Step 3  느낌표가 없다→있다
//
//   About   벽이 꺼졌다(_3) 켜진다(_1). 켜지면 "내 생각은…"이 뜨고 발광이 돈다.
//
// About의 짝은 _1과 _3이다. _2는 같은 장면을 다른 화판(416×360)에 다시 그린
// 것이라 대응할 요소가 없다 — 모프에는 못 쓴다.
//
// 어느 컷이 '나중'인지는 작가가 같은 폴더에 넣어 둔 example_full.svg
// (소개 여섯 장을 통째로 그린 시안)가 정한다. 그 시안 자체는 번들에 넣지
// 않는다 — 268KB짜리고, 화면이 아니라 지시서다.
import artAboutFrom from '../../by_moomiryu/Renewal_v1/example_about_3.svg?raw';
import artAboutTo from '../../by_moomiryu/Renewal_v1/example_about_1.svg?raw';
import artGlyphsFrom from '../../by_moomiryu/Renewal_v1/example_step1_2.svg?raw';
import artGlyphsTo from '../../by_moomiryu/Renewal_v1/example_step1_1.svg?raw';
import artDockFrom from '../../by_moomiryu/Renewal_v1/example_step3_1.svg?raw';
import artDockTo from '../../by_moomiryu/Renewal_v1/example_step3_2.svg?raw';

interface Props { onClose: () => void; onStart: () => void; }

// Native vertical scrolling keeps every section readable, including enlarged text.
export default function InfoOverlay({ onClose, onStart }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    trackRef.current?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function onScroll() {
    const el = trackRef.current;
    if (!el) return;
    const slides = Array.from(el.children) as HTMLElement[];
    const top = el.getBoundingClientRect().top;
    let active = 0;
    slides.forEach((slide, i) => {
      if (slide.getBoundingClientRect().top - top <= el.clientHeight * 0.45) active = i;
    });
    setIdx(active);
  }
  function next() {
    const el = trackRef.current;
    const target = el?.children[Math.min(idx + 1, SLIDES.length - 1)];
    if (!el || !target) return;
    el.scrollTo({
      top: el.scrollTop + target.getBoundingClientRect().top - el.getBoundingClientRect().top,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
  }
  return (
    <div className="info-overlay" aria-label="메가폰트 소개">
      <div className="info-head">
        <BackButton label="처음으로" onClick={onClose} />
        <span>{idx + 1} / {SLIDES.length}</span>
      </div>
      <div className="info-track" ref={trackRef} onScroll={onScroll} tabIndex={0} role="region" aria-label="메가폰트 사용 안내, 아래로 스크롤">
        {SLIDES.map((s, i) => (
          <section className="info-slide" key={i} aria-label={s.title}>
            <span className="info-step-label">{s.step}</span>
            <h2>{s.title}</h2>
            <div className="info-said">{s.body}</div>
            <div className={'info-art ' + (s.artClass ?? '')} aria-hidden>{s.art}</div>
          </section>
        ))}
      </div>
      <div className="info-nav">
        <button type="button" className="info-scroll" onClick={next} disabled={idx === SLIDES.length - 1} aria-label="아래로 스크롤하여 다음 설명 보기">
          <svg width="48" height="28" viewBox="0 0 48 28" fill="none" aria-hidden="true">
            <path d="M6 8 L24 18 L42 8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" className="primary-action" onClick={onStart}>시작하기</button>
      </div>
    </div>
  );
}

// ─── 슬라이드 ────────────────────────────────────────────────
// 본문은 장당 40자 안쪽. 넘기는 형식은 한 장에 한 생각일 때만 살아 있다.
//
// 삽화는 한동안 선 하나로만 그렸다 — "색은 사용자가 만든 말에만 산다"는
// 이유였다. 2026-09-15에 작가가 About·Step 1·Step 3 셋을 색 있는 그림으로
// 그려 오면서 그 원칙은 이 화면에서 풀렸다. 나머지 셋(Step 2 · On the wall ·
// Afterwards)은 아직 선 그림이라, 지금 이 화면은 두 결이 섞여 있다.


// 짝지어 온 삽화. 한 번 만들어 두고 다시 쓴다 — 매 렌더마다 두 장을 파싱해
// 뼈대를 맞출 이유가 없다. 모션을 끈 사람에게는 나중 컷만 준다.
const morphed = new Map<string, string>();
function Morphing({ from, to, name, crop }: { from: string; to: string; name: string; crop?: string }) {
  const still = typeof matchMedia !== 'undefined'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const key = still ? `${name}-still` : name;
  if (!morphed.has(key)) morphed.set(key, still ? scopeSvg(to, key) : morphSvg(from, to, key, 4.2, crop));
  return <span dangerouslySetInnerHTML={{ __html: morphed.get(key)! }} />;
}

const SLIDES: Array<{ step: string; title: string; body: ReactNode; art: ReactNode; artClass?: string }> = [
  {
    step: 'About',
    title: '학교 벽에 대고 크게 말하는 장치입니다',
    body: (
      <p>
        누구나 한 줄을 캠퍼스 벽에 띄울 수 있습니다.
        무엇을, <b>어떻게</b> 말할지는 당신이 정합니다.
      </p>
    ),
    // 1920×1080 화판에서 장면은 x 318~1603, y 260~820만 쓴다. 나머지는 빈
    // 검정이라, 장면 둘레로 6%만 남기고 당긴다.
    art: <Morphing from={artAboutFrom} to={artAboutTo} name="about" crop="241 183 1439 714" />,
    artClass: 'is-bleed'
  },
  {
    step: 'Step 1',
    title: '성격을 고르고 다듬습니다',
    body: <p>마음에 드는 성격에 크기, 무게, 빠르기를 더해보세요.</p>,
    art: <Morphing from={artGlyphsFrom} to={artGlyphsTo} name="glyphs" />,
    artClass: 'is-wide'
  },
  {
    step: 'Step 2',
    title: '한 줄을 쓰고 색을 고릅니다',
    body: <p>폰으로. 한 번에 60자까지.</p>,
    art: <ArtLine />
  },
  {
    step: 'Step 3',
    title: '폰을 홈에 꽂습니다',
    body: <p>벽을 보고 서서, 위쪽부터 세로로.</p>,
    art: <Morphing from={artDockFrom} to={artDockTo} name="dock" />,
    artClass: 'is-figure'
  },
  {
    step: 'On the wall',
    title: '벽에 크게 떠오릅니다',
    body: (
      <p>
        꽂혀 있는 동안 {WALL_W_M} × {WALL_H_M} m 검정 화면 위에 크게. 최대 {EMPHASIS_SEC}초.
      </p>
    ),
    art: <ArtBig />
  },
  {
    step: 'Afterwards',
    title: '빼면 메아리로 남고, 사라집니다',
    body: (
      <>
        <p>
          {STAY_DAYS}일간 다른 말들 사이를 떠다니다 사라집니다. 보관함은 없습니다.
        </p>
        <dl className="info-rules">
          <div>
            <dt>이름</dt>
            <dd>누가 썼는지 남지 않습니다</dd>
          </div>
          <div>
            <dt>수정</dt>
            <dd>보낸 뒤에는 고칠 수 없습니다</dd>
          </div>
          <div>
            <dt>삭제</dt>
            <dd>문제가 되는 글은 관리자가 내립니다</dd>
          </div>
        </dl>
      </>
    ),
    art: <ArtEcho />
  }
];

// ─── 삽화 ────────────────────────────────────────────────────

function Art({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 240 130" width="100%" height="100%" fill="none" stroke="currentColor">
      {children}
    </svg>
  );
}


function ArtLine() {
  return (
    <Art>
      {/* 폰 화면 안의 한 줄 — 여기서는 아직 벽이 아니라 손 안이다 */}
      <rect x="92" y="8" width="56" height="114" rx="7" strokeWidth="1.8" />
      <line x1="112" y1="116" x2="128" y2="116" strokeWidth="2" />
      <g strokeWidth="5">
        <line x1="104" y1="52" x2="136" y2="52" />
      </g>
      <line x1="104" y1="64" x2="120" y2="64" strokeWidth="1" opacity="0.4" />
    </Art>
  );
}



function ArtBig() {
  return (
    <Art>
      {/* 벽 전체를 한 줄이 차지한다 */}
      <rect x="30" y="18" width="180" height="92" strokeWidth="1.8" />
      <line x1="52" y1="64" x2="188" y2="64" strokeWidth="14" />
    </Art>
  );
}

function ArtEcho() {
  return (
    <Art>
      {/* 굵던 한 줄이 가늘어져 이웃들 사이로 들어간다 */}
      <rect x="30" y="18" width="180" height="92" strokeWidth="1.8" />
      <line x1="96" y1="44" x2="144" y2="44" strokeWidth="4" />
      <g strokeWidth="3" opacity="0.6">
        <line x1="46" y1="70" x2="88" y2="70" />
        <line x1="150" y1="70" x2="192" y2="70" />
      </g>
      <g strokeWidth="2" opacity="0.3">
        <line x1="60" y1="92" x2="92" y2="92" />
        <line x1="112" y1="92" x2="136" y2="92" />
        <line x1="156" y1="92" x2="180" y2="92" />
      </g>
    </Art>
  );
}
