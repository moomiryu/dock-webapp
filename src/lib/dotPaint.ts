/**
 * 도트 집합체를 캔버스에 칠하는 손(2026-10-20, 결정 3 · 4 — 셈은 aggregate.ts). 폰 4/5 · 5/5(DotBubble)와 벽(WallSky)이 같이 쓴다 —
 * 미리보기와 벽이 어긋나지 않게. 좌표는 말 좌표(u)다: 부르는 쪽이 ctx의 변환으로 1 = 1u가 되게 두고, 칠할 색도 정해 둔다.
 * 글자는 칠하지 않는다(DOM 글자 — VoiceBubble). 대신 글자마다 자리 · 보이는 정도 · 몸짓을 돌려준다.
 */
import { RD, RF, TAIL_FIRST, backOut, flutter, follow, modulesAt, type Dot, type Item, type Kind, type Plan, type Tail } from './aggregate';

type P = readonly [number, number];
/** 글자 하나 — 자리(u) · 보이는 정도 · 내려앉는 몸짓([가로 배율, 세로 배율, 회전]) */
export interface Glyph { x: number; y: number; op: number; q: readonly [number, number, number] | null }
const clamp = (k: number) => Math.min(1, Math.max(0, k));
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const circle = (ctx: CanvasRenderingContext2D, x: number, y: number, r: number) => { if (r <= 0.004) return; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 2 * Math.PI); };
const polygon = (ctx: CanvasRenderingContext2D, Q: readonly P[]) => { ctx.beginPath(); Q.forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fill(); };

/** 터짐 — 하늘이 차거나 사흘이 지난 말이 꼬리 끝부터 연쇄로(점마다 0.18초에 1.6배로 부풀며 사라진다). at(x, y) = 그 자리가 터지기 시작하는 때 */
export interface Pop { now: number; at: (x: number, y: number) => number }
const POP_T = 0.18;

/** 꼬리의 점 — g = 솟은 정도(0.15에 걸쳐 커진다). tipFirst면 기기 쪽 끝부터 밑동으로(결정 9 도킹), 아니면 밑동부터. 나부낌 */
function tailDots(tail: Tail, g: number, sec: number, ph: number, still: boolean, tipFirst = false): Dot[] {
  const out: Dot[] = [];
  if (g > 0) for (const d of tail.dots) {
    const t = d.t ?? 0, front = clamp((g * 1.15 - (tipFirst ? 1 - t : t)) / 0.15);
    if (!front) continue;
    const sw = still ? 0 : flutter(t, sec, ph);
    out.push({ ...d, x: d.x + tail.perp[0] * sw, y: d.y + tail.perp[1] * sw, r: d.r * front });
  }
  return out;
}

/**
 * 모인(모이는 중의) 말 — m = 모이는 정도(모듈 1 → 1.12배, 틈 메움은 m³), g = 꼬리 솟음(밑동부터), sec · ph = 나부낌 시각 · 박자.
 * 꼬리는 붙은 글자의 지금 자리를 따라간다(모인 자리에선 그대로). 돌려주는 값 = 글자 자리(모듈 가운데)
 */
export function paintBody(ctx: CanvasRenderingContext2D, items: readonly Item[], kd: Kind, gaps: readonly Dot[], m: number,
  tail: Tail | null, g: number, sec: number, ph: number, still = false, pop?: Pop): Glyph[] {
  const { pos, dots, polys } = modulesAt(items, kd, m);
  const gone = pop ? pos.map(([x, y]) => pop.now - pop.at(x, y)) : null;
  polys.forEach((Q, i) => { if (!gone || gone[i] < 0) polygon(ctx, Q); });
  const all: Dot[] = [...dots];
  if (m > 0) { const kk = m ** 3; for (const d of gaps) all.push({ ...d, r: d.r * kk }); }
  if (tail) all.push(...tailDots(follow(tail, items, pos[tail.from]), g, sec, ph, still));
  ctx.beginPath();
  const popping: [number, number, number, number][] = [];
  for (const d of all) {
    const p = pop ? (pop.now - pop.at(d.x, d.y)) / POP_T : -1;
    if (p >= 1) continue;
    if (p > 0) { popping.push([d.x, d.y, d.r, p]); continue; }
    circle(ctx, d.x, d.y, RF * d.r);
  }
  ctx.fill();
  // 터지는 점 — 메움 없이, 부풀며 옅어진다
  for (const [x, y, r, p] of popping) { ctx.globalAlpha = 1 - p; ctx.beginPath(); circle(ctx, x, y, RD * r * (1 + 0.6 * p)); ctx.fill(); }
  ctx.globalAlpha = 1;
  return pos.map(([x, y], i) => ({ x, y, op: gone ? clamp(1 - gone[i] / POP_T) : 1, q: null }));
}

/** 꼬리가 먼저 솟을 때 — 모인 자리의 꼬리 · 글자들 · 나부낌 시각 · 박자 · 움직임 줄임 */
export interface TailFirst { tail: Tail; items: readonly Item[]; sec: number; ph: number; still: boolean }

/**
 * 큰 말의 등장(결정 3 E · 결정 4 휭 · 결정 9) — age = 큰 말이 서기 시작한 뒤 초. rest = 낱개 자리의 모듈(modulesAt(items, kd, 0)),
 * dev = 점이 나가는 곳(u — 꼬리가 먼저면 입, 아니면 기기). 꼬리가 먼저면 첫 글자의 퍼진 자리에 붙어 기기 쪽 끝부터 TAIL_FIRST초에 솟고,
 * 휭 퍼짐 동안에도 첫 글자를 따라간다. 날아오는 점은 메움 없이 작은 점(곧게, 다정은 휘어서), 다 쌓인 글자는 제 가운데를 축으로 내려앉는
 * 몸짓. 다 서면 휭 — 가로 F배, 세로 Fy배(미소 · 단호만 — 기본은 1)
 */
export function paintEntrance(ctx: CanvasRenderingContext2D, rest: ReturnType<typeof modulesAt>, plan: Plan, dev: P, age: number,
  land: (t: number) => [number, number, number], whoosh: number, first?: TailFirst): Glyph[] {
  const k = backOut(clamp((age - plan.whoosh) / whoosh)), f = 1 + (plan.F - 1) * k, fy = 1 + (plan.Fy - 1) * k;
  const cx = (i: number) => rest.pos[i][0] * f, cy = (i: number) => rest.pos[i][1] * fy;
  const q = plan.modDone.map((t) => (age >= t ? land(age - t) : null));
  const tf = (i: number, x: number, y: number): [number, number] => {
    const Q = q[i], [mx, my] = rest.pos[i];
    if (!Q) return [x + cx(i) - mx, y + cy(i) - my];
    const a = (x - mx) * Q[0], b = (y - my) * Q[1];
    return [cx(i) + a * Math.cos(Q[2]) - b * Math.sin(Q[2]), cy(i) + a * Math.sin(Q[2]) + b * Math.cos(Q[2])];
  };
  rest.polys.forEach((Q, i) => { if (q[i]) polygon(ctx, Q.map(([x, y]) => tf(i, x, y))); });
  ctx.beginPath();
  if (first) {
    const i = first.tail.from, T = follow(first.tail, first.items, [cx(i), cy(i)]);
    for (const d of tailDots(T, easeOut(clamp(age / TAIL_FIRST)), first.sec, first.ph, first.still, true)) circle(ctx, d.x, d.y, RF * d.r);
  }
  const [ex, ey] = dev;
  for (const d of plan.shots) {
    if (age < d.e) continue;
    if (age < d.arrive) {
      const s = easeOut((age - d.e) / (d.arrive - d.e)), v = 1 - s;
      circle(ctx, d.cp ? v * v * ex + 2 * v * s * d.cp[0] + s * s * d.x : ex + (d.x - ex) * s, d.cp ? v * v * ey + 2 * v * s * d.cp[1] + s * s * d.y : ey + (d.y - ey) * s, RD);
    } else {
      const Q = q[d.mod], [x, y] = tf(d.mod, d.x, d.y);
      circle(ctx, x, y, RF * (Q ? Math.sqrt(Q[0] * Q[1]) : 1));
    }
  }
  ctx.fill();
  return rest.pos.map((_, i) => ({ x: cx(i), y: cy(i), op: age >= plan.modDone[i] ? clamp((age - plan.modDone[i]) / 0.08) : 0, q: q[i] }));
}

/** 글자들을 제자리로 — glyphs는 VoiceBubble의 .arc-glyph들(차례가 같다). (x, y) u → px = o + x · u */
export function placeGlyphs(els: readonly HTMLElement[], gs: readonly Glyph[], u: number, ox = 0, oy = 0) {
  gs.forEach((g, i) => {
    const e = els[i];
    if (!e) return;
    e.style.left = `${(ox + g.x * u).toFixed(2)}px`; e.style.top = `${(oy + g.y * u).toFixed(2)}px`; e.style.opacity = g.op < 1 ? g.op.toFixed(3) : '';
    const ch = e.firstElementChild as HTMLElement | null, q = g.q;
    if (ch) ch.style.transform = q && (q[0] !== 1 || q[1] !== 1 || q[2]) ? `rotate(${q[2].toFixed(4)}rad) scale(${q[0].toFixed(4)}, ${q[1].toFixed(4)})` : '';
  });
}
