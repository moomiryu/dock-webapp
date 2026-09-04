import { useRef, useState } from 'react';
import InfoOverlay from '../components/InfoOverlay';
import { STAY_DAYS } from '../lib/wall';

interface Props {
  onStart: () => void;
}

/** 워드마크를 손으로 밀어낼 수 있는 한계 (px) */
const DRAG_LIMIT = 140;

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

// 01 Intro — 이름이 화면을 차지하고, 조작은 그 위에 얹힌 얇은 층으로 온다.
// 워드마크는 가만히 있지 않는다: 천천히 떠다니고, 손가락으로 밀면 밀린다.
// 이 앱이 다루는 게 '움직일 수 있는 글자'라는 걸 첫 화면이 먼저 보여준다.
export default function PhaseHome({ onStart }: Props) {
  const [info, setInfo] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const grab = useRef<{ id: number; ox: number; oy: number } | null>(null);

  if (info) return <InfoOverlay onClose={() => setInfo(false)} />;

  function handleDown(e: React.PointerEvent<HTMLHeadingElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = { id: e.pointerId, ox: e.clientX - pos.x, oy: e.clientY - pos.y };
    setDragging(true);
  }

  function handleMove(e: React.PointerEvent<HTMLHeadingElement>) {
    const g = grab.current;
    if (!g || g.id !== e.pointerId) return;
    setPos({
      x: clamp(e.clientX - g.ox, DRAG_LIMIT),
      y: clamp(e.clientY - g.oy, DRAG_LIMIT)
    });
  }

  function handleUp(e: React.PointerEvent<HTMLHeadingElement>) {
    if (grab.current?.id !== e.pointerId) return;
    grab.current = null;
    setDragging(false);
  }

  return (
    <div className="home-frame">
      {/* 아래층 — 이름. 화면 폭에 꽉 차고 가장자리에서 잘린다.
          바깥 h1이 손으로 민 거리를, 안쪽 span이 스스로 떠다니는 움직임을 맡는다. */}
      <h1
        className={'home-mark ' + (dragging ? 'is-dragging' : '')}
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        aria-label="MEGAFONT"
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        onPointerCancel={handleUp}
      >
        <span className="home-mark-float" aria-hidden>
          <span>MEGA</span>
          <span>FONT</span>
        </span>
      </h1>

      {/* 위층 — 조작 */}
      <div className="home-layer">
        <div className="home-top">
          <span className="home-eyebrow">캠퍼스 공공 발화 시스템</span>
        </div>

        <div className="home-bottom">
          <div className="home-headline">
            공공의 한 줄,<br />
            당신의 형식
          </div>

          <div className="home-tagline">
            캠퍼스 외벽에 한 줄을 둡니다.<br />
            {STAY_DAYS}일간 머무르고 사라집니다.
          </div>

          <div className="home-actions">
            <button className="home-cta" onClick={onStart}>
              시작하기
            </button>
            <button className="home-link" onClick={() => setInfo(true)}>
              프로젝트 정보
            </button>
          </div>

          <div className="home-footer">
            <span>MEGAFONT v0.1</span>
          </div>
        </div>
      </div>
    </div>
  );
}
