import { useEffect, useRef } from 'react';
import { arrange, boundsOf, gapsOf, kindOf, tailOf, type Item, type Kind, type Tail, type Dot } from '../lib/aggregate';
import { paintBody } from '../lib/dotPaint';
import { idleWavesAt, waveAlpha } from '../lib/sky';
import { says } from '../character/says';
import { easeOf, tokenS } from '../lib/motion';

/**
 * 홈의 소리(2026-10-21, 결정 51 — 디자이너 "초기화면에 말풍선 기믹 없애주세요 … 동심원 + 작은 말풍선 등 우리가 사용하는 걸로 대체").
 * 견본 셋(결만 · 결 + 가끔 작은 말풍선 · 결 + 늘 떠 있는 작은 말풍선 셋) 중 가운데를 골랐다 — 함께 "빛은 삭제"(메가폰트의 노란 속도선, morph.ts).
 *
 * 큰 메가폰트의 나팔 입에서 소리 결(동심원)이 숨 쉬듯 퍼진다 — 벽의 평소 결(결정 49)과 같은 박자 · 같은 꼴(lib/sky idleWavesAt),
 * 나팔이 향한 쪽으로만 부채꼴. 사람이 메가폰트 앞에서 빨개지면(HomeCrowd → says) 굵은 결이 한 번 나가고, 입에서 작은 점 말풍선이
 * 퐁 나와 조금 떠올랐다가 한 박 머물고 꼬리 끝부터 터진다(벽과 같은 paintBody). 꼬리는 늘 입을 겨눈다.
 * 결은 맨 뒤(사람 · 메가폰트 뒤), 말풍선은 메가폰트 바로 앞(결정 27-1). 색은 둘 다 --grey-300 — 배경으로 물러난다.
 * 형상은 네 성격의 점 말풍선 한 칸(lib/aggregate) — 당당 사각형 · 다정 원 · 차분 육각형 · 유머 별 차례로, 글자는 없다.
 *
 * 나팔 입은 화면에 그려진 큰 메가폰트(HomeCharacter의 몸 · 꼭지 두 조각)에서 그때그때 읽는다 — 꼭지 반대편 넓은 변의 가운데.
 * 메가폰트가 돌아서면 옛 쪽 결은 잦아들고 말풍선은 터지고, 새 쪽에서 다시 퍼진다. 움직임 줄이기면 띄우지 않는다(메가폰트가 정면으로 서 있다).
 */

type Pt = [number, number];
/** 덩어리 모양을 낼 말(글자는 그리지 않는다) — 한 글자 = 모듈 한 칸. 네 성격 차례로 */
const VOICES: readonly { font: string; lines: readonly string[] }[] = ['ttoryeot', 'doran', 'chabun', 'deulseok'].map((font) => ({ font, lines: ['말'] }));
/** 결 — 입을 중심으로 나팔 쪽 ±span°의 호. 반지름 = k × reach × 화면 폭, 선 = line px × 세기, 진하기 = 벽 결의 alpha배 */
const RING = { reach: 0.42, span: 50, line: 1.5, alpha: 2 } as const;
/** 빨개진 사람마다 한 번 — 굵게 · 단숨에(벽의 '글자가 설 때' 한 방처럼 처음에 빠르고 끝으로 느리게) */
const HIT = { s: 2, dur: 1.5, a: 0.5 } as const;
/** 작은 말풍선 — 1u = 폭의 size */
const SMALL = 0.05;
/** 말풍선이 멎는 자리 셋 — (나팔 쪽: 몸에서 한 칸 띈 곳 ~ 화면 끝 사이의 몇 할 · 음수면 몸 위로 reach의 몇 배, 위로 reach의 몇 배).
    입 앞은 화면 끝까지 100px 남짓이라 하나는 몸 위 빈 하늘에 둔다. 노란 소리 줄기 자리보다 위(견본 때 잰 자리 그대로) */
const SEATS: readonly Pt[] = [[0.85, 0.4], [0.2, 0.8], [-0.35, 0.95]];

interface Side { at: Pt; right: boolean }
interface Bubble { kd: Kind; items: Item[]; tail: Tail; gaps: Dot[]; bc: Pt; side: Side; off: Pt; born: number; popAt: number; end: number; ph: number }

export default function HomeBubbles() {
  const backRef = useRef<HTMLCanvasElement>(null), frontRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const back = backRef.current, front = frontRef.current, bg = back?.getContext('2d'), fg = front?.getContext('2d');
    const frame = front?.closest('.home-frame') as HTMLElement | null;
    if (!back || !front || !bg || !fg || !frame) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;   // 메가폰트가 정면으로 멈춰 서서 입이 없다
    const root = getComputedStyle(document.documentElement), col = (v: string) => root.getPropertyValue(v).trim();
    const GREY = col('--grey-300'), EDGE = parseFloat(col('--pad-box')) || 0, GAP = parseFloat(col('--space-in-group')) || 0;
    const EASE = easeOf('--ease-standard');
    const HOLD = tokenS('--t-hold', 0.7), SLOW = tokenS('--t-slow', 0.4), RET = tokenS('--t-return', 0.22);
    let W = 0, H = 0, DPR = 1, raf = 0;
    const size = () => {
      W = frame.clientWidth; H = frame.clientHeight; DPR = Math.max(2, window.devicePixelRatio || 1);
      for (const c of [back, front]) { c.width = Math.round(W * DPR); c.height = Math.round(H * DPR); }
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
    /** 지금 결이 퍼지는 입 — 돌아서면 옛 입은 그 자리에 두고(터지는 말풍선이 거기 남는다) 새 입으로 넘어간다 */
    let side: Side | null = null, amp = 0, last = NaN;

    const hits: number[] = [], live: Bubble[] = [];
    let turn = 0, seed = 7;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    /** 떠오르는 시간 — 처음에 빠져나오고 끝으로 갈수록 느려진다(--ease-standard) */
    const RISE = 4 * HOLD;
    /** 터짐 — 꼬리 끝부터 퍼진다(벽과 같은 속도) */
    const popOf = (b: Bubble, x: number, y: number) => b.popAt + (SMALL * W * Math.hypot(x - b.tail.tip[0], y - b.tail.tip[1])) / (420 * (W / 390));
    const pop = (b: Bubble, at: number) => {
      if (b.popAt <= at) return;
      b.popAt = at;
      const [x0, y0, x1, y1] = boundsOf(b.items, b.kd, 1, b.tail);
      b.end = Math.max(...[[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => popOf(b, x, y))) + RET;
    };
    /** 빨개진 사람 하나 — 굵은 결 한 번, 그리고 셋 중 떠 있는 말들과 가장 먼 자리로 작은 말풍선(한꺼번에 셋까지) */
    const speak = (t: number) => {
      if (!side) return;
      hits.push(t);
      if (live.filter((b) => t < b.popAt).length >= 3) return;
      let off: Pt = SEATS[0], far = -1;
      for (const o of SEATS) {
        const d = Math.min(Infinity, ...live.map((b) => Math.hypot(b.off[0] - o[0], b.off[1] - o[1])));
        if (d > far) { far = d; off = o; }
      }
      const v = VOICES[turn++ % VOICES.length], kd = kindOf(v.font), items = arrange(v.lines, 'center', kd);
      const [x0, y0, x1, y1] = boundsOf(items, kd, 1, null), bc: Pt = [(x0 + x1) / 2, (y0 + y1) / 2];
      const b: Bubble = { kd, items, tail: tailOf(items, kd, [bc[0], y1 + 2]), gaps: gapsOf(items, kd), bc, side,
        off: [off[0] + (rnd() - 0.5) * 0.2, off[1] + (rnd() - 0.5) * 0.1], born: t, popAt: Infinity, end: Infinity, ph: rnd() * 6 };
      live.push(b);
      pop(b, t + RISE + HOLD);   // 다 떠오르고 한 박 뒤
    };
    /** 말풍선 자리 — 입에서 off만큼(나팔 쪽 · 위), 화면 안으로 · 부제 밑으로. 멎은 뒤엔 숨 쉬듯 조금 오르내린다 */
    const placeOf = (b: Bubble, p: number, t: number): Pt => {
      const s = b.side, R = RING.reach * W, hw = SMALL * W * 0.7, near = hw * 1.6, far = Math.max(near, (s.right ? W - s.at[0] : s.at[0]) - EDGE - hw);
      const dx = (b.off[0] >= 0 ? near + b.off[0] * (far - near) : b.off[0] * R) * p;
      const bob = Math.sin(((t + b.ph) * 2 * Math.PI) / (8 * HOLD)) * 0.08 * SMALL * W * p;
      const x = s.at[0] + (s.right ? dx : -dx), intro = frame.querySelector('.home-intro')?.getBoundingClientRect();
      const roof = intro ? intro.bottom - frame.getBoundingClientRect().top + GAP + hw : 0;   // 320에서 몸 위 자리가 '자세히 보기' 10px 밑까지 왔다
      return [Math.min(W - EDGE - hw, Math.max(EDGE + hw, x)), Math.max(roof, s.at[1] - b.off[1] * R * p + bob)];
    };
    // 한 말 — 입에서 작게(0.35배) 나와 커지며 멎는 자리로. 말 좌표(u)로 칠한다(ctx를 1 = 1u로)
    const paint = (b: Bubble, t: number) => {
      const S = SMALL * W, p = EASE(Math.min(1, (t - b.born) / RISE)), k = 0.35 + 0.65 * p, at = placeOf(b, p, t), m = b.side.at;
      // 꼬리는 늘 입을 겨눈다 — 터지기 시작하면 그 꼬리로 둔다
      if (t < b.popAt) b.tail = tailOf(b.items, b.kd, [b.bc[0] + (m[0] - at[0]) / (S * k), b.bc[1] + (m[1] - at[1]) / (S * k)]);
      fg.save();
      fg.translate(at[0], at[1]);
      fg.scale(S * k, S * k); fg.translate(-b.bc[0], -b.bc[1]);
      fg.globalAlpha = Math.min(1, (t - b.born) / SLOW); fg.fillStyle = GREY;
      paintBody(fg, b.items, b.kd, b.gaps, 1, b.tail, 1, t, b.ph, false, { now: t, at: (x, y) => popOf(b, x, y) });
      fg.restore();
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const t = performance.now() / 1000, m = bell(), dt = Number.isNaN(last) ? 1 : t - last;
      last = t;
      // 입 — 같은 쪽이면 따라가고, 돌아섰거나 정면이면 결이 --t-slow에 잦아든 뒤 새 입으로(옛 쪽 말풍선은 그 자리에서 터진다)
      if (m && side && m.right === side.right) { side.at = m.at; amp = Math.min(1, amp + dt / SLOW); }
      else if (m && (!side || amp <= 0)) { for (const b of live) pop(b, t); side = m; }
      else amp = Math.max(0, amp - dt / SLOW);
      while (says.queue.length) { says.queue.shift(); says.count++; speak(t); }   // 빨개진 사람마다(셋을 넘으면 says가 버린다)
      for (let i = live.length - 1; i >= 0; i--) if (t >= live[i].end) live.splice(i, 1);
      for (let i = hits.length - 1; i >= 0; i--) if (t - hits[i] >= HIT.dur) hits.splice(i, 1);

      bg.setTransform(1, 0, 0, 1, 0, 0); bg.clearRect(0, 0, back.width, back.height); bg.setTransform(DPR, 0, 0, DPR, 0, 0);
      if (side && amp > 0) {
        const R = RING.reach * W, sp = (RING.span * Math.PI) / 180, a0 = side.right ? 0 : Math.PI;
        const ws = [...idleWavesAt(t, HOLD, EASE), ...hits.map((h) => { const q = (t - h) / HIT.dur; return { k: 0.92 * (1 - (1 - q) ** 3), s: HIT.s, a: HIT.a * (1 - q) }; })];
        bg.strokeStyle = GREY;
        for (const w of ws) {
          const a = Math.min(1, amp * RING.alpha * waveAlpha(w));
          if (a <= 0) continue;
          bg.globalAlpha = a; bg.lineWidth = RING.line * w.s;
          bg.beginPath(); bg.arc(side.at[0], side.at[1], w.k * R, a0 - sp, a0 + sp); bg.stroke();
        }
        bg.globalAlpha = 1;
      }
      fg.setTransform(1, 0, 0, 1, 0, 0); fg.clearRect(0, 0, front.width, front.height); fg.setTransform(DPR, 0, 0, DPR, 0, 0);
      for (const b of live) paint(b, t);
    };
    size();
    const ro = new ResizeObserver(size); ro.observe(frame);
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  const fill = { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' } as const;
  return (
    <>
      <canvas ref={backRef} className="home-waves" aria-hidden style={fill} />
      <canvas ref={frontRef} className="home-bubbles" aria-hidden style={fill} />
    </>
  );
}
