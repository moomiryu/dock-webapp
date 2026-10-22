import { useEffect, useRef } from 'react';
import { idleWavesAt, waveAlpha, waveArc } from '../lib/sky';
import { says } from '../character/says';
import { easeOf, tokenS } from '../lib/motion';

/**
 * 홈의 소리(2026-10-21, 결정 51 — 디자이너 "초기화면에 말풍선 기믹 없애주세요 … 동심원 + 작은 말풍선 등 우리가 사용하는 걸로 대체").
 * 견본 셋(결만 · 결 + 가끔 작은 말풍선 · 결 + 늘 떠 있는 작은 말풍선 셋) 중 가운데를 골랐다 — 함께 "빛은 삭제"(메가폰트의 노란 속도선, morph.ts).
 * 2026-10-22 결정 56 — 작은 말풍선을 뺐다(폰의 말엔 꼬리가 없다 — 꼬리 단 말은 벽 하늘에만). 결만 남는다.
 *
 * 큰 메가폰트의 나팔 입에서 소리 결(동심원)이 숨 쉬듯 퍼진다 — 벽의 평소 결(결정 49)과 같은 박자 · 같은 꼴(lib/sky idleWavesAt),
 * 나팔이 향한 쪽으로만 부채꼴. 사람이 메가폰트 앞에서 빨개지면(HomeCrowd → says) 굵은 결이 한 번 나간다.
 * 결은 맨 뒤(사람 · 메가폰트 뒤), 색은 --grey-300 — 배경으로 물러난다.
 *
 * 나팔 입은 화면에 그려진 큰 메가폰트(HomeCharacter의 몸 · 꼭지 두 조각)에서 그때그때 읽는다 — 꼭지 반대편 넓은 변의 가운데.
 * 메가폰트가 돌아서면 옛 쪽 결은 잦아들고, 새 쪽에서 다시 퍼진다. 움직임 줄이기면 띄우지 않는다(메가폰트가 정면으로 서 있다).
 */

type Pt = [number, number];
/** 결 — 입을 중심으로 나팔 쪽 ±span°의 호. 반지름 = k × reach × 화면 폭, 선 = line px × 세기, 진하기 = 벽 결의 alpha배 */
const RING = { reach: 0.42, span: 50, line: 1.5, alpha: 2 } as const;
/** 빨개진 사람마다 한 번 — 굵게 · 단숨에(벽의 '글자가 설 때' 한 방처럼 처음에 빠르고 끝으로 느리게) */
const HIT = { s: 2, dur: 1.5, a: 0.5 } as const;

interface Side { at: Pt; right: boolean }

export default function HomeBubbles() {
  const backRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const back = backRef.current, bg = back?.getContext('2d');
    const frame = back?.closest('.home-frame') as HTMLElement | null;
    if (!back || !bg || !frame) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // 메가폰트가 정면으로 멈춰 서서 입이 없다
    const GREY = getComputedStyle(document.documentElement).getPropertyValue('--grey-300').trim();
    const EASE = easeOf('--ease-standard');
    const HOLD = tokenS('--t-hold', 0.7), SLOW = tokenS('--t-slow', 0.4);
    let W = 0, DPR = 1, raf = 0;
    const size = () => {
      W = frame.clientWidth; DPR = Math.max(2, window.devicePixelRatio || 1);
      back.width = Math.round(W * DPR); back.height = Math.round(frame.clientHeight * DPR);
    };

    /** 나팔 입 — 몸(빨강) 상자에서 꼭지(하늘색) 반대편 변의 가운데 · 입이 오른쪽을 보나. 정면(꼭지가 위)이면 없다 */
    const bell = (): Side | null => {
      const [body, hat] = frame.querySelectorAll<SVGPathElement>('.home-char-motion > svg > path');
      if (!body || !hat) return null;
      const f = frame.getBoundingClientRect(), b = body.getBoundingClientRect(), h = hat.getBoundingClientRect();
      if (!b.width || h.bottom < b.top + b.height * 0.25) return null;
      const right = h.left + h.width / 2 < b.left + b.width / 2;   // 꼭지가 왼쪽이면 입은 오른쪽
      return { at: [(right ? b.right : b.left) - f.left, b.top + b.height / 2 - f.top], right };
    };
    /** 지금 결이 퍼지는 입 — 돌아서면 옛 쪽 결이 잦아든 뒤 새 입으로 넘어간다 */
    let side: Side | null = null, amp = 0, last = NaN;
    const hits: number[] = [];

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = performance.now() / 1000, m = bell(), dt = Number.isNaN(last) ? 1 : t - last;
      last = t;
      // 입 — 같은 쪽이면 따라가고, 돌아섰거나 정면이면 결이 --t-slow에 잦아든 뒤 새 입으로
      if (m && side && m.right === side.right) { side.at = m.at; amp = Math.min(1, amp + dt / SLOW); }
      else if (m && (!side || amp <= 0)) side = m;
      else amp = Math.max(0, amp - dt / SLOW);
      while (says.queue.length) { says.queue.shift(); says.count++; if (side) hits.push(t); }   // 빨개진 사람마다(셋을 넘으면 says가 버린다)
      for (let i = hits.length - 1; i >= 0; i--) if (t - hits[i] >= HIT.dur) hits.splice(i, 1);

      bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, back.width, back.height); bg.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (side && amp > 0) {
        const R = RING.reach * W, sp = (RING.span * Math.PI) / 180, a0 = side.right ? 0 : Math.PI;
        const ws = [...idleWavesAt(t, HOLD, EASE), ...hits.map((h) => { const q = (t - h) / HIT.dur; return { k: 0.92 * (1 - (1 - q) ** 3), s: HIT.s, a: HIT.a * (1 - q) }; })];
        bg.strokeStyle = GREY;
        for (const w of ws) {
          const a = Math.min(1, amp * RING.alpha * waveAlpha(w));
          if (a <= 0) continue;
          bg.globalAlpha = a;
          waveArc(bg, side.at[0], side.at[1], w.k * R, w.k * R, a0, sp, RING.line * w.s);
        }
        bg.globalAlpha = 1;
      }
    };
    size();
    const ro = new ResizeObserver(size); ro.observe(frame);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={backRef} className="home-waves" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}
