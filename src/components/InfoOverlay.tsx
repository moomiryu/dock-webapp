import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { EMPHASIS_SEC, STAY_DAYS, WALL_H_M, WALL_W_M } from '../lib/wall';

interface Props {
  onClose: () => void;
  /** 마지막 장에서 곧바로 쓰러 간다 — 다 읽었으면 홈으로 되돌아올 이유가 없다 */
  onStart: () => void;
}

// 처음 온 사람이 보는 여섯 장.
//
// 순서가 곧 내용이다: 이게 뭔지(의도) → 1 쓴다 → 2 말투와 색을 고른다 →
// 3 꽂는다 → 그러면 크게 뜬다 → 빼면 메아리로 남고 사라진다.
// 의도를 먼저 두는 이유는 그게 납득되면 나머지 단계가 설명 없이 따라오기
// 때문이다. 규칙(익명·수정불가)은 마지막 장에만 모은다.
//
// 넘기기는 브라우저의 가로 스크롤 스냅에 맡긴다 — 미는 감각을 직접 구현하면
// 기기마다 어긋난다.
export default function InfoOverlay({ onClose, onStart }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  const go = useCallback(
    (delta: number) => {
      const el = trackRef.current;
      if (!el) return;
      const next = Math.min(SLIDES.length - 1, Math.max(0, idx + delta));
      el.scrollTo({ left: next * el.clientWidth, behavior: 'smooth' });
    },
    [idx]
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, go]);

  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  const last = idx >= SLIDES.length - 1;

  return (
    <div className="info-overlay" role="dialog" aria-modal="true" aria-label="메가폰트 소개">
      <div className="info-head">
        <span>
          {idx + 1} / {SLIDES.length}
        </span>
        <button type="button" className="info-close" onClick={onClose}>
          닫기
        </button>
      </div>

      {/* 좌우 화살표로도 넘길 수 있지만, 스크롤 영역 자체가 초점을 받아야
          키보드만 쓰는 사람이 여기 들어올 수 있다 */}
      <div className="info-track" ref={trackRef} onScroll={onScroll} tabIndex={0}>
        {SLIDES.map((s, i) => (
          <section className="info-slide" key={i} aria-label={s.title}>
            <div className="info-art" aria-hidden>
              {s.art}
            </div>
            <span className="info-step-label">{s.step}</span>
            <h2>{s.title}</h2>
            <div className="info-said">{s.body}</div>
          </section>
        ))}
      </div>

      <div className="info-dots" aria-hidden>
        {SLIDES.map((_, i) => (
          <span key={i} className={i === idx ? 'on' : ''} />
        ))}
      </div>

      <div className="info-nav">
        <button type="button" className="info-step" onClick={() => go(-1)} disabled={idx === 0}>
          이전
        </button>
        {last ? (
          <button type="button" className="primary-action" onClick={onStart}>
            <span>시작하기</span>
          </button>
        ) : (
          <button type="button" className="primary-action" onClick={() => go(1)}>
            <span>다음</span>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── 슬라이드 ────────────────────────────────────────────────
// 삽화는 선 하나로만 그린다 (흑백 원칙). 색은 사용자가 만든 말에만 산다.
// 본문은 장당 40자 안쪽. 넘기는 형식은 한 장에 한 생각일 때만 살아 있다.

const SLIDES: Array<{ step: string; title: string; body: ReactNode; art: ReactNode }> = [
  {
    step: '이게 뭔가요',
    title: '학교 벽에 대고 크게 말하는 장치입니다',
    body: (
      <p>
        누구나 한 줄을 캠퍼스 벽에 띄울 수 있습니다.
        무엇을, <b>어떻게</b> 말할지는 당신이 정합니다.
      </p>
    ),
    art: <ArtWall />
  },
  {
    step: '1단계',
    title: '한 줄을 씁니다',
    body: <p>폰으로. 한 번에 60자까지.</p>,
    art: <ArtLine />
  },
  {
    step: '2단계',
    title: '말투와 색을 고릅니다',
    body: <p>같은 말도 얼굴에 따라 다르게 들립니다.</p>,
    art: <ArtGlyphs />
  },
  {
    step: '3단계',
    title: '폰을 홈에 꽂습니다',
    body: <p>벽을 보고 서서, 위쪽부터 세로로.</p>,
    art: <ArtDock />
  },
  {
    step: '그러면',
    title: '벽에 크게 떠오릅니다',
    body: (
      <p>
        꽂혀 있는 동안 {WALL_W_M} × {WALL_H_M} m 화면을 통째로. 최대 {EMPHASIS_SEC}초.
      </p>
    ),
    art: <ArtBig />
  },
  {
    step: '그리고',
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

function ArtWall() {
  return (
    <Art>
      {/* 건물, 그 안의 화면, 그리고 사람 — 크기를 짐작하게 하는 유일한 방법 */}
      <rect x="26" y="10" width="150" height="98" strokeWidth="1" />
      <rect x="52" y="30" width="98" height="61" strokeWidth="1.8" />
      <line x1="6" y1="108" x2="234" y2="108" strokeWidth="1" />
      <g strokeWidth="1.4">
        <circle cx="200" cy="76" r="5" />
        <line x1="200" y1="82" x2="200" y2="99" />
        <line x1="200" y1="99" x2="194" y2="108" />
        <line x1="200" y1="99" x2="206" y2="108" />
        <line x1="193" y1="90" x2="207" y2="90" />
      </g>
    </Art>
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

function ArtGlyphs() {
  return (
    <Art>
      {/* 네 칸, 네 획 — 같은 말이 네 얼굴을 가진다. 그리고 색 */}
      <g strokeWidth="1">
        <rect x="14" y="22" width="50" height="60" />
        <rect x="70" y="22" width="50" height="60" />
        <rect x="126" y="22" width="50" height="60" />
        <rect x="182" y="22" width="50" height="60" />
      </g>
      <path d="M26 66 C34 42 44 68 52 46" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M82 68 L96 38 L108 68 M86 54 L104 54" strokeWidth="2.4" />
      <line x1="140" y1="55" x2="162" y2="55" strokeWidth="7" />
      <g strokeWidth="1.6">
        <line x1="196" y1="38" x2="196" y2="72" />
        <line x1="190" y1="38" x2="202" y2="38" />
        <line x1="188" y1="72" x2="204" y2="72" />
      </g>
      {/* 색 — 흑백 원칙 안에서 색을 말하는 법: 채움의 밝기 */}
      <g strokeWidth="1">
        <rect x="14" y="96" width="30" height="16" fill="currentColor" />
        <rect x="50" y="96" width="30" height="16" fill="currentColor" opacity="0.55" />
        <rect x="86" y="96" width="30" height="16" fill="currentColor" opacity="0.25" />
        <rect x="122" y="96" width="30" height="16" />
      </g>
    </Art>
  );
}

function ArtDock() {
  return (
    <Art>
      <rect x="102" y="6" width="36" height="52" rx="5" strokeWidth="1.8" />
      <line x1="112" y1="52" x2="128" y2="52" strokeWidth="2.4" />
      <g strokeWidth="1.4">
        <line x1="120" y1="64" x2="120" y2="80" />
        <polyline points="113,74 120,81 127,74" />
      </g>
      <rect x="52" y="88" width="136" height="34" strokeWidth="1.5" />
      <line x1="104" y1="94" x2="136" y2="94" strokeWidth="5" />
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
