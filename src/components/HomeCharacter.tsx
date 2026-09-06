import { useEffect, useMemo, useRef } from 'react';
import charSvg from '@assets/MF_demo_1.svg?raw';
import { scopeSvg } from '../lib/svgAsset';

/** 가로로 떠다닐 수 있는 거리 (px) */
const BOUND_X = 105;
/** 세로로 떠다닐 수 있는 거리 (px) */
const BOUND_Y = 75;
/** 표류 속도 (px/s). 워드마크(22)보다 느리다 — 이쪽은 헤엄치는 쪽이다 */
const DRIFT = 16;

// 홈에 사는 캐릭터.
//
// 화면 가운데를 천천히 유영한다. 워드마크 위를 지나가기도 한다 — 글자를 피해
// 좁은 띠에 가둬 두면 헤엄이 아니라 진열이 된다. 아래 조작층까지는 내려가지 않는다.
//
// 워드마크는 손으로 잡아 던질 수 있지만 이쪽은 건드리지 않는다 —
// 한 화면에 잡히는 것이 둘이면 무엇을 잡아야 하는지가 흐려진다.
//
// 눈은 CSS가 깜빡인다. 이 그림에서 원은 눈(흰자 둘·눈동자 둘)뿐이라
// `circle`을 통째로 세로로 눌러 감으면 두 눈이 같이 감긴다.
export default function HomeCharacter() {
  const ref = useRef<HTMLDivElement>(null);
  // 클래스·id 이름을 이 에셋 전용으로 바꿔 둔다. 에셋이 늘어도 서로 안 덮는다.
  const svg = useMemo(() => scopeSvg(charSvg, 'mfchar'), []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // 매번 같은 궤적이면 살아 있지 않다
    const angle = Math.random() * Math.PI * 2;
    let x = 0;
    let y = 0;
    let vx = Math.cos(angle) * DRIFT;
    let vy = Math.sin(angle) * DRIFT;
    let raf = 0;
    let last = performance.now();

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      x += vx * dt;
      y += vy * dt;
      if (x < -BOUND_X) {
        x = -BOUND_X;
        vx = Math.abs(vx);
      } else if (x > BOUND_X) {
        x = BOUND_X;
        vx = -Math.abs(vx);
      }
      if (y < -BOUND_Y) {
        y = -BOUND_Y;
        vy = Math.abs(vy);
      } else if (y > BOUND_Y) {
        y = BOUND_Y;
        vy = -Math.abs(vy);
      }
      // 위치는 매 프레임 바뀌므로 state가 아니라 DOM을 직접 만진다
      el.style.transform =
        `translate(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px))`;
      raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      className="home-char"
      ref={ref}
      aria-hidden
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
