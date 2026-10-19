import { useEffect, useRef } from 'react';
import { arrange, boundsOf, gapsOf, kindOf, tailOf, type Item, type Kind, type Tail, type Dot } from '../lib/aggregate';
import { paintBody } from '../lib/dotPaint';
import { says } from '../character/says';
import { easeOf, tokenS } from '../lib/motion';

/**
 * 홈의 말풍선(2026-10-20 디자이너 — 옛 홈 구도에, 큰 메가폰트에서 떠오르는 말풍선). 흐르던 글자(HomeVoices)의 자리다.
 *
 * 차례는 옛 홈 그대로다: 사람이 들어와 메가폰트 앞에 서서 빨개지면(HomeCrowd → says) — 그때 **큰 메가폰트의 나팔 입에서 말풍선 하나가
 * 작게 나와 스르륵 떠오른다.** 소리가 나가는 쪽 위로 커지며 올라가 부제 밑 — 입이 향한 쪽, 몸 위끝보다 위 — 에서 멎고, 한 박 머물다
 * 꼬리 끝부터 터진다(벽과 같은 paintBody). 꼬리는 늘 지금 입을 겨눈다 — 메가폰트가 돌아서면 따라 돈다(결정 16, 2026-10-20). 점을 쏘아 짓던 것과 부채꼴로 둘러 앉히던 것은 둘 다 튀어서 걷었다(10-20) — 배경은 눈을 끌지 않는다.
 * 형상은 네 성격의 점 말풍선 한 칸(lib/aggregate) — 당당 사각형 · 다정 원 · 차분 육각형 · 유머 별 차례로. 글자는 없고 --grey-300으로
 * 물러나 배경이 된다(옛 흐르는 말과 같은 색). 주인공은 가운데 큰 메가폰트다. 한꺼번에 셋까지(says가 셋까지만 든다).
 *
 * 나팔 입은 화면에 그려진 큰 메가폰트(HomeCharacter의 몸 · 꼭지 두 조각)에서 그때그때 읽는다 — 꼭지 반대편 넓은 변의 가운데.
 * 층은 캐릭터와 구경꾼 뒤(옛 흐르는 말처럼 배경)라, 갓 나온 말은 나팔 뒤에서 빠져나온다. 움직임 줄이기면 띄우지 않는다.
 */

type Pt = [number, number];
/** 덩어리 모양을 낼 말(글자는 그리지 않는다) — 한 글자 = 모듈 한 칸(2026-10-20 디자이너: 형상은 한 칸짜리로만). 네 성격 차례로 */
const VOICES: readonly { font: string; lines: readonly string[] }[] = ['ttoryeot', 'doran', 'chabun', 'deulseok'].map((font) => ({ font, lines: ['말'] }));
interface Bubble {
  kd: Kind; items: Item[]; tail: Tail; gaps: Dot[]; S: number; bc: Pt; from: Pt; to: Pt; born: number; end: number; popAt: number; ph: number;
  popOf: (x: number, y: number) => number
}

export default function HomeBubbles() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext('2d'), frame = cv?.closest('.home-frame') as HTMLElement | null;
    if (!cv || !ctx || !frame) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = getComputedStyle(document.documentElement), col = (v: string) => root.getPropertyValue(v).trim();
    const GREY = col('--grey-300'), EDGE = parseFloat(col('--pad-box')) || 0, GAP = parseFloat(col('--space-in-group')) || 0;
    const EASE = easeOf('--ease-standard');
    // ponytail: 임시 손잡이(개발 서버만) — ?bubtest=<크기> 면 사람 없이도 그 크기로 2.4초마다 하나씩 띄운다(실제는 평균 4.6초, 몰릴 때 0.4초). 확정되면 지운다
    const TEST = import.meta.env.DEV ? Number(new URLSearchParams(location.search).get('bubtest')) || 0 : 0;
    let nextTest = 0;
    const HOLD = tokenS('--t-hold', 0.7), SLOW = tokenS('--t-slow', 0.4), RET = tokenS('--t-return', 0.22);
    let W = 0, H = 0, DPR = 1;
    const size = () => {
      W = frame.clientWidth; H = frame.clientHeight; DPR = Math.max(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    };
    size();
    const ro = new ResizeObserver(size); ro.observe(frame);

    /** 나팔 입 — 몸(빨강) 상자에서 꼭지(하늘색) 반대편 변의 가운데 · 입이 오른쪽을 보나 · 몸의 위끝. 정면(꼭지가 위)이면 없다 */
    const bell = (): { at: Pt; right: boolean; top: number } | null => {
      const [body, hat] = frame.querySelectorAll<SVGPathElement>('.home-char-motion > svg > path');
      if (!body || !hat) return null;
      const f = frame.getBoundingClientRect(), b = body.getBoundingClientRect(), h = hat.getBoundingClientRect();
      if (!b.width || h.bottom < b.top + b.height * 0.25) return null;
      const right = h.left + h.width / 2 < b.left + b.width / 2;   // 꼭지가 왼쪽이면 입은 오른쪽
      return { at: [(right ? b.right : b.left) - f.left, b.top + b.height / 2 - f.top], right, top: b.top - f.top };
    };
    /** 꼬리가 겨눌 입 — 매 장면 다시 읽고, 정면이라 없으면 마지막 자리(결정 16) */
    let mouth: Pt | null = null;

    const live: Bubble[] = [];
    let turn = 0, seed = 7;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    /** 떠오르는 시간 — 처음에 빠져나오고 끝으로 갈수록 느려진다(--ease-standard) */
    const RISE = 8 * HOLD;
    const spawn = (now: number): boolean => {
      const m = bell();
      if (!m || live.length >= 3) return false;
      const from = m.at;
      const v = VOICES[turn++ % VOICES.length], kd = kindOf(v.font), items = arrange(v.lines, 'center', kd);
      // 크기 — 1u = 폭의 0.09(디자이너 10-20 '꽤 볼륨 있게' — 여러 칸일 때 고른 0.022는 한 칸이 되자 점처럼 작았다)
      const [x0, y0, x1, y1] = boundsOf(items, kd, 1, null), S = (TEST || 0.09) * W, bc: Pt = [(x0 + x1) / 2, (y0 + y1) / 2];
      const hw = ((x1 - x0) * S) / 2, hh = ((y1 - y0) * S) / 2;
      // 멎는 자리 — 부제 밑 띠에서, 입이 향한 쪽만(결정 16 — 띠 어디든 멎으니 메가폰트와 따로 놀았다). 입 뒤로는 폭의 0.12까지만 넘어가고,
      // 아래끝은 몸 위끝보다 위(그 범위만 두니 견본에서 몸 위로 뭉쳤다). 그 칸이 모자라면 예전 띠 전체로 물러난다. 후보 열둘 중 떠 있는
      // 말들과 가장 먼 곳
      const intro = frame.querySelector('.home-intro')?.getBoundingClientRect(), fTop = frame.getBoundingClientRect().top;
      const roof = (intro ? intro.bottom - fTop : 0.18 * H) + GAP * 2 + hh, lo0 = EDGE + hw, hi0 = W - EDGE - hw, reach = 0.12 * W;
      const [sLo, sHi] = m.right ? [Math.max(lo0, from[0] - reach), hi0] : [lo0, Math.min(hi0, from[0] + reach)];
      const low = Math.min(roof + Math.max(0, from[1] - roof) * 0.45, m.top - GAP - hh), side = sHi > sLo && low > roof;
      const [xLo, xHi, yHi] = side ? [sLo, sHi, low] : [lo0, hi0, roof + Math.max(0, from[1] - roof) * 0.45];
      let to: Pt = [from[0], roof], far = -1;
      for (let k = 0; k < 12; k++) {
        const x = xLo + rnd() * Math.max(0, xHi - xLo), y = roof + rnd() * Math.max(0, yHi - roof);
        const d = Math.min(Infinity, ...live.map((o) => Math.hypot(o.to[0] - x, o.to[1] - y)));
        if (d > far) { far = d; to = [x, y]; }
      }
      const tail = tailOf(items, kd, [bc[0] + (from[0] - to[0]) / S, bc[1] + (from[1] - to[1]) / S]), gaps = gapsOf(items, kd);   // 꼬리 — 멎은 자리에서 입을 겨눈다
      // 터짐 — 다 떠오르고 한 박 뒤, 꼬리 끝부터 퍼진다(벽과 같은 속도). 꼬리는 매 장면 다시 겨누므로 터짐도 그때의 꼬리 끝에서
      const popAt = now + RISE + HOLD, speed = 420 * (W / 390), [bx0, by0, bx1, by1] = boundsOf(items, kd, 1, tail);
      const b: Bubble = { kd, items, tail, gaps, S, bc, from, to, born: now, end: 0, popAt, ph: rnd() * 6,
        popOf: (x, y) => popAt + (S * Math.hypot(x - b.tail.tip[0], y - b.tail.tip[1])) / speed };
      b.end = Math.max(...[[bx0, by0], [bx1, by0], [bx0, by1], [bx1, by1]].map(([x, y]) => b.popOf(x, y))) + RET;
      live.push(b);
      return true;
    };
    // 한 말 — 입에서 작게(0.35배) 나와 커지며 멎는 자리로. 말 좌표(u)로 칠한다(ctx를 1 = 1u로)
    const paint = (b: Bubble, t: number) => {
      const p = EASE(Math.min(1, (t - b.born) / RISE)), k = 0.35 + 0.65 * p;
      const at: Pt = [b.from[0] + (b.to[0] - b.from[0]) * p, b.from[1] + (b.to[1] - b.from[1]) * p];
      // 꼬리는 늘 지금 입을 겨눈다(결정 16 — 나온 뒤 메가폰트가 돌아서면 등을 가리켰다). 터지기 시작하면 그 꼬리로 둔다
      if (mouth && t < b.popAt) b.tail = tailOf(b.items, b.kd, [b.bc[0] + (mouth[0] - at[0]) / (b.S * k), b.bc[1] + (mouth[1] - at[1]) / (b.S * k)]);
      ctx.save();
      ctx.translate(at[0], at[1]);
      ctx.scale(b.S * k, b.S * k); ctx.translate(-b.bc[0], -b.bc[1]);
      ctx.globalAlpha = Math.min(1, (t - b.born) / SLOW); ctx.fillStyle = GREY;
      paintBody(ctx, b.items, b.kd, b.gaps, 1, b.tail, 1, t, b.ph, false, { now: t, at: b.popOf });
      ctx.restore();
    };

    let raf = 0;
    const tick = () => {
      const t = performance.now() / 1000, m = bell();
      if (m) mouth = m.at;
      if (TEST) { says.queue.length = 0; if (t >= nextTest && spawn(t)) nextTest = t + 2.4; }
      while (says.queue.length) { says.queue.shift(); says.count++; spawn(t); }   // 빨개진 사람마다 한 말(셋을 넘으면 버린다)
      for (let i = live.length - 1; i >= 0; i--) if (t >= live[i].end) live.splice(i, 1);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      for (const b of live) paint(b, t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} className="home-bubbles" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />;
}
