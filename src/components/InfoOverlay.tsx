import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { EMPHASIS_SEC, STAY_DAYS, WALL_H_M, WALL_W_M } from '../lib/wall';

interface Props {
  onClose: () => void;
}

// 프로젝트 정보 — 명세서가 아니라 한 장씩 넘기며 이해하는 자리.
//
// 규칙을 표로 늘어놓으면 읽는 사람이 순서를 스스로 세워야 한다. 이 장치는
// 순서가 곧 내용이므로(쓴다 → 꽂는다 → 크게 뜬다 → 뺀다 → 사흘 → 사라진다)
// 그 순서대로 한 장에 하나씩 둔다. 규칙은 마지막 장에만 모은다.
//
// 넘기기는 브라우저의 가로 스크롤 스냅에 맡긴다 — 미는 감각을 직접 구현하면
// 기기마다 어긋난다.
export default function InfoOverlay({ onClose }: Props) {
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
    <div className="info-overlay" role="dialog" aria-modal="true" aria-label="프로젝트 정보">
      <div className="info-head">
        <span>
          {idx + 1} / {SLIDES.length}
        </span>
        <button type="button" className="info-close" onClick={onClose}>
          닫기
        </button>
      </div>

      <div className="info-track" ref={trackRef} onScroll={onScroll}>
        {SLIDES.map((s, i) => (
          <section className="info-slide" key={i} aria-label={s.title}>
            <div className="info-art" aria-hidden>
              {s.art}
            </div>
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
          <button type="button" className="primary-action" onClick={onClose}>
            <span>알겠어요</span>
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

const SLIDES: Array<{ title: string; body: ReactNode; art: ReactNode }> = [
  {
    title: '벽에 화면이 하나 있습니다',
    body: (
      <p>
        캠퍼스 건물에 걸린 {WALL_W_M} × {WALL_H_M} m짜리 화면입니다.
        지나는 사람이면 누구나 읽습니다.
      </p>
    ),
    art: <ArtWall />
  },
  {
    title: '거기에 한 줄을 둡니다',
    body: <p>폰으로 씁니다. 한 번에 60자까지.</p>,
    art: <ArtLine />
  },
  {
    title: '말투도 당신이 정합니다',
    body: (
      <p>
        무엇을 말할지만이 아니라 <b>어떻게 말할지</b>까지.
        자형과 색을 골라 목소리를 만듭니다.
      </p>
    ),
    art: <ArtGlyphs />
  },
  {
    title: '폰을 꽂으면 크게 떠오릅니다',
    body: (
      <p>
        홈에 폰을 세로로 꽂는 동안, 그 한 줄이 화면을 통째로 차지합니다.
        최대 {EMPHASIS_SEC}초.
      </p>
    ),
    art: <ArtDock />
  },
  {
    title: '빼면 메아리로 남습니다',
    body: (
      <p>
        큰 목소리는 거기서 끝나고, 그 한 줄은 다른 말들 사이로 들어가
        {STAY_DAYS}일간 천천히 떠다닙니다.
      </p>
    ),
    art: <ArtEcho />
  },
  {
    title: '그리고 사라집니다',
    body: (
      <>
        <p>보관함은 없습니다. {STAY_DAYS}일 동안 떠 있는 동안이 이 말의 전부입니다.</p>
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
    art: <ArtFade />
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
      <rect x="30" y="18" width="180" height="92" strokeWidth="1.8" />
      <g strokeWidth="7">
        <line x1="62" y1="58" x2="118" y2="58" />
        <line x1="126" y1="58" x2="150" y2="58" />
        <line x1="158" y1="58" x2="178" y2="58" />
      </g>
      <g strokeWidth="1" opacity="0.35">
        <line x1="30" y1="38" x2="210" y2="38" />
        <line x1="30" y1="88" x2="210" y2="88" />
      </g>
    </Art>
  );
}

function ArtGlyphs() {
  return (
    <Art>
      {/* 네 칸, 네 획 — 같은 말이 네 얼굴을 가진다 */}
      <g strokeWidth="1">
        <rect x="14" y="30" width="50" height="66" />
        <rect x="70" y="30" width="50" height="66" />
        <rect x="126" y="30" width="50" height="66" />
        <rect x="182" y="30" width="50" height="66" />
      </g>
      <path d="M26 74 C34 50 44 76 52 54" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M82 76 L96 46 L108 76 M86 62 L104 62" strokeWidth="2.4" />
      <line x1="140" y1="63" x2="162" y2="63" strokeWidth="7" />
      <g strokeWidth="1.6">
        <line x1="196" y1="46" x2="196" y2="80" />
        <line x1="190" y1="46" x2="202" y2="46" />
        <line x1="188" y1="80" x2="204" y2="80" />
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

function ArtEcho() {
  return (
    <Art>
      <rect x="30" y="18" width="180" height="92" strokeWidth="1.8" />
      <line x1="86" y1="44" x2="154" y2="44" strokeWidth="6" />
      <g strokeWidth="3" opacity="0.6">
        <line x1="46" y1="70" x2="88" y2="70" />
        <line x1="150" y1="70" x2="192" y2="70" />
      </g>
      <g strokeWidth="2" opacity="0.35">
        <line x1="60" y1="92" x2="92" y2="92" />
        <line x1="112" y1="92" x2="136" y2="92" />
        <line x1="156" y1="92" x2="180" y2="92" />
      </g>
    </Art>
  );
}

function ArtFade() {
  return (
    <Art>
      <rect x="30" y="18" width="180" height="92" strokeWidth="1.8" />
      <g strokeWidth="5">
        <line x1="52" y1="42" x2="128" y2="42" opacity="0.8" />
        <line x1="52" y1="64" x2="112" y2="64" opacity="0.4" />
        <line x1="52" y1="86" x2="96" y2="86" opacity="0.15" />
      </g>
    </Art>
  );
}
