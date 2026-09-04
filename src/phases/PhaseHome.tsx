import { useEffect, useRef, useState } from 'react';
import InfoOverlay from '../components/InfoOverlay';
import { STAY_DAYS } from '../lib/wall';

interface Props {
  onStart: () => void;
}

/** 워드마크가 화면 밖으로 나갈 수 있는 거리. 이 선에서 튕긴다 (px) */
const BOUND = 140;
/** 가만히 뒀을 때의 표류 속도 (px/s) */
const DRIFT = 22;
/** 던졌을 때 낼 수 있는 최고 속도 (px/s) */
const FLING_MAX = 760;

// 01 Intro — 이름이 화면을 차지하고, 조작은 그 위에 얹힌 얇은 층으로 온다.
// 워드마크는 가만히 있지 않는다: 천천히 표류하다 화면 밖 테두리에서 튕기고,
// 손으로 잡으면 따라오고, 던지면 그 속도로 날아가 다시 튕긴다.
// 이 앱이 다루는 게 '움직일 수 있는 글자'라는 걸 첫 화면이 먼저 보여준다.
export default function PhaseHome({ onStart }: Props) {
  const [info, setInfo] = useState(false);
  const markRef = useRef<HTMLHeadingElement>(null);

  // 위치·속도는 매 프레임 바뀌므로 state가 아니라 ref에 두고 DOM을 직접 만진다.
  // (state로 두면 60fps로 리렌더가 돈다)
  const body = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    held: false,
    pointerId: -1,
    grabX: 0,
    grabY: 0,
    lastX: 0,
    lastY: 0,
    lastT: 0
  });

  useEffect(() => {
    const b = body.current;

    // 처음 방향은 무작위로. 매번 같은 궤적이면 살아 있지 않다.
    const angle = Math.random() * Math.PI * 2;
    b.vx = Math.cos(angle) * DRIFT;
    b.vy = Math.sin(angle) * DRIFT;

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      if (!b.held && !still) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // 테두리에서 반사
        if (b.x < -BOUND) {
          b.x = -BOUND;
          b.vx = Math.abs(b.vx);
        } else if (b.x > BOUND) {
          b.x = BOUND;
          b.vx = -Math.abs(b.vx);
        }
        if (b.y < -BOUND) {
          b.y = -BOUND;
          b.vy = Math.abs(b.vy);
        } else if (b.y > BOUND) {
          b.y = BOUND;
          b.vy = -Math.abs(b.vy);
        }

        // 던져서 빨라진 만큼은 서서히 잃고, 표류 속도 아래로는 내려가지 않는다
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > DRIFT) {
          const k = Math.max(DRIFT, sp * Math.exp(-dt / 1.4)) / sp;
          b.vx *= k;
          b.vy *= k;
        } else if (sp > 0.001) {
          const k = DRIFT / sp;
          b.vx *= k;
          b.vy *= k;
        }
      }

      if (markRef.current) {
        markRef.current.style.transform = `translate(${b.x.toFixed(1)}px, ${b.y.toFixed(1)}px)`;
      }
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [info]); // 정보 덮개에서 돌아오면 워드마크가 다시 생기므로 루프도 다시 건다

  if (info) return <InfoOverlay onClose={() => setInfo(false)} />;

  function handleDown(e: React.PointerEvent<HTMLHeadingElement>) {
    const b = body.current;
    e.currentTarget.setPointerCapture(e.pointerId);
    b.held = true;
    b.pointerId = e.pointerId;
    b.grabX = e.clientX - b.x;
    b.grabY = e.clientY - b.y;
    b.lastX = e.clientX;
    b.lastY = e.clientY;
    b.lastT = performance.now();
    e.currentTarget.classList.add('is-dragging');
  }

  function handleMove(e: React.PointerEvent<HTMLHeadingElement>) {
    const b = body.current;
    if (!b.held || b.pointerId !== e.pointerId) return;

    b.x = e.clientX - b.grabX;
    b.y = e.clientY - b.grabY;

    // 던진 속도를 알려면 마지막 움직임의 기울기를 재둬야 한다
    const now = performance.now();
    const dt = (now - b.lastT) / 1000;
    if (dt > 0.008) {
      b.vx = (e.clientX - b.lastX) / dt;
      b.vy = (e.clientY - b.lastY) / dt;
      b.lastX = e.clientX;
      b.lastY = e.clientY;
      b.lastT = now;
    }
  }

  function handleUp(e: React.PointerEvent<HTMLHeadingElement>) {
    const b = body.current;
    if (b.pointerId !== e.pointerId) return;
    b.held = false;
    b.pointerId = -1;
    e.currentTarget.classList.remove('is-dragging');

    // 너무 세게 던지면 눈으로 못 따라가니 상한을 둔다
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > FLING_MAX) {
      const k = FLING_MAX / sp;
      b.vx *= k;
      b.vy *= k;
    } else if (sp < DRIFT) {
      const angle = Math.random() * Math.PI * 2;
      b.vx = Math.cos(angle) * DRIFT;
      b.vy = Math.sin(angle) * DRIFT;
    }
  }

  return (
    <div className="home-frame">
      {/* 아래층 — 이름. 화면 폭에 꽉 차고 가장자리에서 잘린다.
          위치는 rAF가 직접 쓰고, 안쪽 span은 아주 약한 기울임만 맡는다 */}
      <h1
        ref={markRef}
        className="home-mark"
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
