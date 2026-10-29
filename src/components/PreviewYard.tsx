import { useEffect, useRef, type CSSProperties } from 'react';
import { G, RD, ROW } from '../lib/aggregate';
import { FOOT_Y } from '../character/walker';
import { easeOf, tokenS } from '../lib/motion';
import { SKY } from '../lib/sky';
import { BODY_W, COLORS, CX, JUMP, SIZE, STAND_H, VB, WalkerArt } from './WallWalkers';

/** 작은 사람의 키 = 무대 짧은 변의 이 몫. 무대 높이로만 재면 작은 폰(320 × 568)에서 키가 21px로 줄었다 */
const TALL = 0.1;
/** 꼬리 끝이 비켜 둘 땅 위(px, DotBubble tail.room) — 작은 사람 키와 폴짝 높이만큼 */
export const roomOf = (W: number, H: number) => Math.min(W, H) * TALL * 1.8;
/**
 * 마당의 값 — 흘리는 몫(말 점 중, 벽과 같다) · 더미 가운데(무대 가운데에서 폭의 몫) · 퍼짐(폭의 몫, σ) · 서는 자리(가운데에서 폭의 몫) ·
 * 중력(무대 높이/초²) · 말풍선에서 튕겨 나가며 솟는 높이(높이의 몫 — 더 솟으면 글자 위를 지났다) · 튕겨 나가는 동안(--t-hold의 배수) ·
 * 기뻐 폴짝 높이(키의 몫) · 뛰어드는 정점(키의 몫)
 */
const YARD = { share: 0.28, pile: 0.24, spread: 0.035, stand: 0.08, gravity: 2.2, hop: 0.012, pops: 1.6, cheer: 0.45, leap: 0.9 };

/** 말의 점 수 · 몸통 아랫가장자리 점들 · 땅(px, 말풍선 상자 기준 — 말풍선 위 끝 ~ 땅이 무대 세로 가운데) — DotBubble tail.onRim이 적는다 */
export type Rim = { dots: number; at: [number, number][]; floor: number };
type Eye = 'look' | 'smile' | 'up';
type Fall = { x: number; y: number; vx: number; vy: number; at: number; side: 0 | 1; c: number };

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/**
 * 5/5 '이렇게 보여요'의 마당(2026-10-29, 디자이너 — "우리 캐릭터들이 작은 크기로 등장해서 즐거워하는 모습 + 실제 wall의 기믹처럼,
 * 부스러기가 떨어져서"). 벽의 작은 사람 둘(WallWalkers의 그림 · 색)과 벽의 부스러기(결정 55)를 한 번만, 짧게:
 * 1. 꼬리가 자라기 시작할 때(--t-slow) 두 사람이 무대 양옆 밖에서 가운데 곁으로 뛰어든다
 * 2. 꼬리가 다 자라면(--t-slow + --t-hold) 말풍선 아랫가장자리에서 그 말 색 부스러기가 하나씩 튕튕 튀어 떨어져(같은 날 — 꼬리 끝 밑
 *    빈자리에서 나오던 것을 "말풍선 자체에서 튕튕") 양쪽 땅에 소복이 쌓이고, 둘은 두 번 폴짝 기뻐한다. 다 쌓이면 웃으며 가운데를 보고 선다
 * 부스러기의 크기는 벽과 같은 비례 — 사람 키에 대한 점 크기가 벽 그대로다(같은 날 디자이너 "티끌이 캐릭터에 비해 너무 크다, 실제 wall은
 * 그렇지 않다". 처음엔 말풍선 점 크기였다). 처음엔 더미를 눈덩이로 굴려 화면 밖으로 내보냈는데 굴리러 가는 움직임이 어색해 뺐다(같은 날).
 * 되풀이하지 않는다 — 마지막 확인 화면이라 버튼에서 눈을 뺏지 않게. 움직임 줄이기면 두 사람이 제자리에 서 있기만 한다.
 */
export default function PreviewYard({ rim, color }: { rim: { current: Rim | null }; color: string }) {
  const root = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const colorRef = useRef(color);
  colorRef.current = color;

  useEffect(() => {
    const host = root.current, c = cv.current;
    if (!host || !c) return;
    const SLOW = tokenS('--t-slow', 0.4), HOLD = tokenS('--t-hold', 0.7), RET = tokenS('--t-return', 0.22), easeStd = easeOf('--ease-standard');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ws = [...host.querySelectorAll<HTMLDivElement>('.preview-walker')].map((el, i) => {
      const svg = el.querySelector('svg')!, q = (s: string) => el.querySelector(s) as SVGElement;
      svg.pauseAnimations(); svg.setCurrentTime(0);   // 걷지 않는다 — 0프레임이 서 있는 자세
      return {
        el, flip: q('[data-p="flip"]'), eye: 'look' as Eye, out: i ? 1 : -1, spot: 0,
        eyes: { look: q('[data-eye="look"]'), smile: q('[data-eye="smile"]'), up: q('[data-eye="up"]') } as Record<Eye, SVGElement>
      };
    });
    let W = 0, H = 0, hc = 0, s = 0, cw = 0, dpr = 1, ground = 0, raf = 0;
    /** 땅(px, 이 상자 기준) — 말풍선이 정한 줄. 제목이 접혀 무대가 커지면 따라 움직인다 */
    const groundOf = () => { const R = rim.current, bb = host.parentElement?.querySelector('.dot-bubble')?.getBoundingClientRect(); return R && bb ? bb.top - host.getBoundingClientRect().top + R.floor : H; };
    /** 부스러기의 1u(px) — 벽에서 작은 사람 키(SIZE)와 하늘 u(SKY.u)의 비례 그대로 */
    const geo = () => { const u = (hc * SKY.u) / SIZE; return { g: G * u, row: ROW * u, rd: RD * u }; };
    const layout = () => {
      W = host.clientWidth; H = host.clientHeight; hc = Math.min(W, H) * TALL; s = hc / STAND_H; cw = BODY_W * s;
      dpr = Math.min(3, window.devicePixelRatio || 1);
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      for (const w of ws) {
        const svg = w.el.firstElementChild as SVGSVGElement;
        svg.style.width = `${VB.w * s}px`; svg.style.height = `${VB.h * s}px`;
        w.el.style.transformOrigin = `${(CX - VB.x) * s}px ${(FOOT_Y - VB.y) * s}px`;
        w.spot = W / 2 + w.out * YARD.stand * W;
      }
      if (!raf) raf = requestAnimationFrame(frame);   // 다 끝난 뒤에 무대가 바뀌어도(제목이 접힘 · 회전) 한 장 다시 — 땅은 말풍선이 먼저 정한 뒤에 읽는다
    };
    const setEye = (w: (typeof ws)[number], e: Eye) => { if (w.eye !== e) { w.eyes[w.eye].style.display = 'none'; w.eyes[e].style.display = ''; w.eye = e; } };
    /** 그리기 — 발 자리(x, 땅) · 들림(px) · 눌림 · 보는 쪽(1 = 왼쪽, 그림의 기본) */
    const place = (w: (typeof ws)[number], x: number, lift: number, sq: number, face: 1 | -1) => {
      const ox = (CX - VB.x) * s, oy = (FOOT_Y - VB.y) * s;
      w.el.style.transform = `translate3d(${(x - ox).toFixed(1)}px, ${(ground - oy - lift).toFixed(1)}px, 0) scale(${(1 + 0.7 * sq).toFixed(3)}, ${(1 - sq).toFixed(3)})`;
      w.flip.setAttribute('transform', face === -1 ? `matrix(-1 0 0 1 ${2 * CX} 0)` : '');
    };

    // 튕겨 떨어지는 알 · 더미(쪽마다 칸 → 쌓인 알 수)
    const falls: Fall[] = [], piles: Map<number, number>[] = [new Map(), new Map()];
    let spilled = false, lastLand = Infinity;
    const pileLand = (side: 0 | 1, col: number) => {   // 옆 칸보다 두 줄 이상 높으면 낮은 쪽으로 굴러 소복이(벽과 같은 규칙)
      const p = piles[side], h = (k: number) => p.get(k) ?? 0;
      for (let i = 0; i < 64; i++) {
        const opts = [col - 1, col + 1].filter((k) => h(k) < h(col) - 1);
        if (!opts.length) break;
        col = opts.sort((a, b) => h(a) - h(b) || Math.random() - 0.5)[0];
      }
      p.set(col, h(col) + 1);
    };
    /** 말풍선에서 튕겨 나간다 — 아랫가장자리의 한 점에서 하나씩 차례로(튕튕) 살짝 솟았다 떨어져, 그 점이 선 쪽(왼 · 오른)의 더미로(정규 분포) */
    const spill = (t: number) => {
      const R = rim.current, bb = host.parentElement?.querySelector('.dot-bubble')?.getBoundingClientRect(), hr = host.getBoundingClientRect();
      if (!R || !R.at.length || !bb) return;
      const { g, rd } = geo(), gr = YARD.gravity * H, dx = bb.left - hr.left, dy = bb.top - hr.top, n = Math.round(R.dots * YARD.share);
      const sides = [R.at.filter(([x]) => x + dx < W / 2), R.at.filter(([x]) => x + dx >= W / 2)], gap = (HOLD * YARD.pops) / Math.max(1, n);
      for (let i = 0; i < n; i++) {
        const side = (i & 1) as 0 | 1, from = sides[side].length ? sides[side] : R.at, [px, py] = from[Math.floor(Math.random() * from.length)];
        const gauss = Math.sqrt(-2 * Math.log(1 - Math.random())) * Math.cos(2 * Math.PI * Math.random()), x0 = px + dx, y0 = py + dy;
        const col = Math.round((W / 2 + (side ? 1 : -1) * YARD.pile * W + gauss * YARD.spread * W) / g);
        const vy = -Math.sqrt(2 * gr * YARD.hop * H), fallT = -vy / gr + Math.sqrt((2 * Math.max(1, ground - rd - (y0 - YARD.hop * H))) / gr);
        falls.push({ x: x0, y: y0, vx: (col * g - x0) / fallT, vy, at: t + i * gap + Math.random() * 0.3 * gap, side, c: col });
      }
    };
    const paint = (t: number) => {
      const ctx = c.getContext('2d');
      if (!ctx) return;
      const { g, row, rd } = geo();
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = colorRef.current;
      ctx.beginPath();
      const dot = (x: number, y: number) => { ctx.moveTo(x + rd, y); ctx.arc(x, y, rd, 0, 2 * Math.PI); };
      for (const p of piles) for (const [col, k] of p) for (let j = 0; j < k; j++) dot(col * g + (j & 1 ? g / 2 : 0), ground - rd - j * row);
      for (const q of falls) if (t >= q.at) dot(q.x, q.y);   // 아직 안 튕긴 알은 말풍선의 제 점이다
      ctx.fill();
    };

    const t0 = performance.now() / 1000, leapAt = SLOW, leapDur = HOLD * 1.2, landAt = leapAt + leapDur, grown = SLOW + HOLD;
    const hopT = HOLD * 0.6, cheerAt = landAt + RET, cheerEnd = cheerAt + 2 * hopT;
    let last = t0;
    function frame(ms: number) {
      raf = requestAnimationFrame(frame);
      const now = ms / 1000, t = now - t0, dt = Math.min(0.05, now - last);
      last = now;
      ground = groundOf();
      if (reduced) {   // 제자리에서 가운데를 보고 선다
        for (const w of ws) { setEye(w, 'look'); place(w, w.spot, 0, 0, w.out < 0 ? -1 : 1); }
        cancelAnimationFrame(raf); raf = 0; return;
      }
      if (!spilled && t >= grown) { spilled = true; spill(t); }
      // 떨어지는 알 — 떠날 때가 된 것만, 제 칸의 더미 꼭대기에 닿으면 내려앉는다
      const { row, rd } = geo(), gr = YARD.gravity * H;
      for (let i = falls.length - 1; i >= 0; i--) {
        const q = falls[i];
        if (t < q.at) continue;
        q.vy += gr * dt; q.x += q.vx * dt; q.y += q.vy * dt;
        if (q.vy > 0 && q.y >= ground - rd - (piles[q.side].get(q.c) ?? 0) * row) { pileLand(q.side, q.c); falls.splice(i, 1); }
      }
      if (spilled && !falls.length && lastLand > t) lastLand = t;
      let busy = !spilled || falls.length > 0;
      for (const w of ws) {
        const into: 1 | -1 = w.out < 0 ? -1 : 1;   // 가운데를 보는 쪽(왼쪽 사람은 오른쪽을 본다 = -1)
        if (t < leapAt) { place(w, -1e4, 0, 0, into); busy = true; continue; }
        if (t < landAt) {   // 양옆 밖에서 뛰어든다 — 웃으며
          const k = (t - leapAt) / leapDur, x = lerp(W / 2 + w.out * (W / 2 + cw), w.spot, easeStd(k));
          setEye(w, 'smile');
          place(w, x, 4 * YARD.leap * hc * k * (1 - k), k < 0.12 ? JUMP.crouch * Math.sin((Math.PI * k) / 0.12) : 0, into);
          busy = true; continue;
        }
        // 내려서며 눌리고 — 두 번 폴짝 기뻐하고 — 부스러기가 다 내려앉기를 올려다보고 — 다 쌓이면 한동안 웃는다
        const sq = t < cheerAt ? JUMP.land * Math.sin((Math.PI * (t - landAt)) / RET) : 0;
        const lift = t >= cheerAt && t < cheerEnd ? Math.abs(Math.sin((Math.PI * (t - cheerAt)) / hopT)) * YARD.cheer * hc : 0;
        const after = Math.max(cheerEnd, lastLand);
        setEye(w, t < cheerEnd ? 'smile' : t < lastLand ? 'up' : t < after + HOLD * 2 ? 'smile' : 'look');
        place(w, w.spot, lift, sq, into);
        if (t < after + HOLD * 2) busy = true;
      }
      paint(t);
      if (!busy) { cancelAnimationFrame(raf); raf = 0; }
    }
    const ro = new ResizeObserver(layout);
    ro.observe(host);
    layout();
    for (const w of ws) w.el.style.display = '';
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);

  return (
    <div ref={root} className="preview-yard" aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 'var(--z-elevated)' } as CSSProperties}>
      <canvas ref={cv} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      {COLORS.map((col, i) => (
        <div key={i} className="preview-walker" style={{ position: 'absolute', left: 0, top: 0, display: 'none', willChange: 'transform' }}>
          <WalkerArt i={i} color={col} id="pv" />
        </div>
      ))}
    </div>
  );
}
