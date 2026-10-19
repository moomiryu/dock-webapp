/**
 * 도트 집합체(2026-10-20, 디자이너 확정 — 결정 3). 말풍선은 글자마다 성격의 작은 모듈 하나 — 당당 사각형 · 다정 원 · 차분 육각형 ·
 * 유머 별을 벌집 격자의 점으로 짓고 윤곽 안을 같은 색으로 메운다. 처음엔 낱개로 벌어져 서고(꼬리 없음), 안주하면 모듈들이 모여
 * 한 덩어리가 되고 꼬리가 밑동부터 솟아 기기 쪽을 가리킨다. 차분은 2026-10-20(결정 7)에 마름모에서 육각형으로 바뀌었다. 나무 · 돌 · 구름 · 비눗방울(사진 윤곽 · 빗금 · 10-17의 점 결)을 대체한다.
 * 견본은 정하는 세션의 kv/aggregate.html · arrange.html(칸 이름은 결정문의 F 표가 최신). 길이는 모두 그 말의 글자 크기 u의 배수 —
 * 폰과 벽이 같은 모양이다. 여기는 셈만 한다(그리기는 DotBubble).
 */
import type { Align } from '../types';

type P = readonly [number, number];
export type Module = 'square' | 'circle' | 'hexagon' | 'star';

/** 점 간격(u, 10-17의 0.45u에서 — 모듈이 커져 자간이 벌어졌다) · 줄 높이 · 메움 동그라미 반지름 · 모듈 크기(1.45u × 1.1 — 글자 둘레가 빡빡했다) */
export const G = 0.3, ROW = (G * Math.sqrt(3)) / 2, RF = G / Math.sqrt(3) + 0.02 * G, M = 1.45 * 1.1;
/** 점 반지름 — 날아오는 점은 메움 없이 이것만(붙은 점은 메움 RF가 덮는다) */
export const RD = 0.46 * G;

/** 성격 — 모듈 · 크기 배율(별만 1.3배 — 작으면 글자가 빈약 · 위태로워 보인다) · 모인 글자 간격(G) · 줄 간격(줄) · 낱개일 때 더 벌어지는 폭(G) */
export interface Kind { mod: Module; k: number; adv: number; rows: number; arrive: number }
const KIND: Record<string, Kind> = {
  ttoryeot: { mod: 'square', k: 1, adv: 4, rows: 6, arrive: 3.3 },
  doran: { mod: 'circle', k: 1, adv: 4, rows: 6, arrive: 3.3 },
  chabun: { mod: 'hexagon', k: 1, adv: 4, rows: 6, arrive: 3.3 },
  deulseok: { mod: 'star', k: 1.3, adv: 5, rows: 8, arrive: 5.3 }
};
/** 옛 서체 키(cloud.ts BY_FONT와 같다) */
const LEGACY: Record<string, string> = { gothic: 'ttoryeot', myeongjo: 'chabun', song: 'deulseok', botong: 'chabun' };
const keyOf = (font?: string) => LEGACY[font ?? ''] ?? font ?? '';
export const kindOf = (font?: string): Kind => KIND[keyOf(font)] ?? KIND.chabun;

/* ─── 4/5 모양 — 열두 칸(결정 3 F · 결정 7). 배치의 선 = 모듈의 선(사각형 직각 · 원 곡선 · 육각형 반 칸 맞물림 · 별 튐), 첫 칸은 넷 모두 '기본' ─── */
const ARRANGEMENTS: Record<string, readonly Align[]> = {
  ttoryeot: ['center', 'stairs', 'podium'],
  doran: ['center', 'arch', 'smile'],
  chabun: ['center', 'stack', 'descend'],
  deulseok: ['center', 'stepping', 'highkick']
};
export const arrangementsFor = (font: string | undefined): readonly Align[] => ARRANGEMENTS[keyOf(font)] ?? ['center'];
/** 4/5에 처음 들어왔을 때 골라져 있는 칸 — 넷 모두 '기본' */
export const defaultAlign = (_font?: string): Align => 'center';
/** 그 성격의 칸이 아닌 값(옛 글의 휘기 · 올리기 · 둥실 …, 다른 성격에서 고른 값)은 기본으로 그린다(결정 3 F) */
export const arrangeOf = (font: string | undefined, align?: Align): Align => (align && arrangementsFor(font).includes(align) ? align : 'center');

/* ─── 모듈 ─────────────────────────────────────────────────────────────────────────────────────────────── */
const ngon = (n: number, R: number, r: number, a0 = -Math.PI / 2): P[] => Array.from({ length: n * 2 }, (_, i): P => {
  const t = a0 + (i * Math.PI) / n, q = i % 2 ? r : R;
  return [Math.cos(t) * q, Math.sin(t) * q];
});
export function inPoly(Q: readonly P[], x: number, y: number): boolean {
  let c = false;
  for (let i = 0, j = Q.length - 1; i < Q.length; j = i++) {
    const [xi, yi] = Q[i], [xj, yj] = Q[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
/**
 * 꼭짓점 있는 모듈의 윤곽(모듈 가운데 기준, s = 크기) — 사각형 반변 0.44s · 오각 별 0.62s / 0.3s ·
 * 육각형(결정 7 — 윗변 · 아랫변 수평, 옆변 60°로 점 격자의 결과 같다. 반폭 R = 0.56s, 반높이 h = 0.36s, 위아래 변 반폭 a = R − h/√3)
 */
const hexagon = (s: number): P[] => { const R = 0.56 * s, h = 0.36 * s, a = R - h / Math.sqrt(3); return [[-a, -h], [a, -h], [R, 0], [a, h], [-a, h], [-R, 0]]; };
const OUTLINE: Partial<Record<Module, (s: number) => P[]>> = {
  square: (s) => { const a = 0.44 * s; return [[-a, -a], [a, -a], [a, a], [-a, a]]; },
  hexagon,
  star: (s) => ngon(5, 0.62 * s, 0.3 * s)
};
const INSIDE: Record<Module, (x: number, y: number, s: number) => boolean> = {
  circle: (x, y, s) => x * x + y * y <= (s / 2) ** 2,
  square: (x, y, s) => Math.abs(x) <= 0.44 * s && Math.abs(y) <= 0.44 * s,
  hexagon: (x, y, s) => inPoly(hexagon(s), x, y),
  star: (x, y, s) => inPoly(OUTLINE.star!(s), x, y)
};
/** 모듈이 가운데에서 가장 멀리 나간 거리(s의 몫) — 맞춰 넣을 때 */
const REACH: Record<Module, number> = { circle: 0.5, square: 0.63, hexagon: 0.56, star: 0.62 };
const rot = (x: number, y: number, a: number): P => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/** 모듈 하나의 격자점 — 모양은 a만큼 돌고 점은 말의 격자 그대로(p = 모듈 가운데가 앉은 줄이 홀수인가) */
const LAT = new Map<string, P[]>();
function lattice(mod: Module, s: number, a: number, p: number): P[] {
  const key = `${mod}|${s.toFixed(3)}|${a.toFixed(3)}|${p}`, had = LAT.get(key);
  if (had) return had;
  const out: P[] = [], n = Math.ceil(s / G) + 1;
  for (let j = -n; j <= n; j++) for (let i = -n; i <= n; i++) {
    const x = i * G + ((p + j) & 1 ? G / 2 : 0) - (p ? G / 2 : 0), y = j * ROW, [u, v] = rot(x, y, -a);
    if (INSIDE[mod](u, v, s)) out.push([x, y]);
  }
  if (LAT.size > 600) LAT.delete(LAT.keys().next().value!);
  LAT.set(key, out);
  return out;
}
/** 윤곽을 꿰는 점 — 꼭짓점 · 안쪽 꺾임마다 하나, 변을 따라 간격 ≈ G. 격자점만 찍으면 꼭짓점이 깎여 낱개일 때 육각형 · 별로 안 읽힌다(결정 3 때는 마름모) */
function beads(mod: Module, s: number, a: number): P[] {
  const Q = OUTLINE[mod]?.(s).map(([x, y]) => rot(x, y, a)), out: P[] = [];
  if (!Q) return out;
  Q.forEach(([x0, y0], i) => {
    const [x1, y1] = Q[(i + 1) % Q.length], n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / G));
    for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n]);
  });
  return out;
}
const snap = (x: number, y: number): [number, number, number] => {
  const j = Math.round(y / ROW), i = Math.round((x - (j & 1 ? G / 2 : 0)) / G);
  return [i * G + (j & 1 ? G / 2 : 0), j * ROW, j & 1];
};
const cell = (x: number, y: number): [number, number] => { const j = Math.round(y / ROW); return [Math.round((x - (j & 1 ? G / 2 : 0)) / G), j]; };
const nb = (i: number, j: number): [number, number][] => (j & 1
  ? [[i - 1, j], [i + 1, j], [i, j - 1], [i + 1, j - 1], [i, j + 1], [i + 1, j + 1]]
  : [[i - 1, j], [i + 1, j], [i - 1, j - 1], [i, j - 1], [i - 1, j + 1], [i, j + 1]]);

/* ─── 배치 ─────────────────────────────────────────────────────────────────────────────────────────────── */
/** 글자 하나 — 모인 자리(x · y, 격자 위) · 낱개 자리(ax · ay) · 기울기(a, 아치 · 미소 · 하이킥) · 줄 · 격자 줄의 홀짝(p). 원점 = 덩어리 가운데, u */
export interface Item { ch: string; li: number; x: number; y: number; a: number; p: number; ax: number; ay: number }
const deg = (d: number) => (d * Math.PI) / 180;

/**
 * 글 → 글자들의 자리. 두 줄 이상은 줄마다 같은 규칙(징검다리는 줄마다 엇갈리고, 탑은 줄바꿈과 상관없이 낱말마다 한 줄).
 * 낱개 자리 — 곧은 줄 계열은 가로 벌림 + 세로 1.3배, 아치 · 미소는 가로세로 같이 벌림
 */
export function arrange(lines: readonly string[], align: Align, kd: Kind): Item[] {
  const adv = kd.adv * G, ms = M * kd.k, spread = (adv + kd.arrive * G) / adv;
  let src = lines, lh = kd.rows * ROW;
  if (align === 'stack') { src = lines.join(' ').split(/\s+/).filter(Boolean); lh = 0.66 * ms; }   // 탑 — 낱말마다 한 줄, 가운데 맞춰 차곡차곡
  const L = src.map((ln) => { const cs = [...ln], av = cs.map((ch) => (ch === ' ' ? G : adv)); return { cs, av, len: av.reduce((a, b) => a + b, 0) }; });
  const Lmax = Math.max(0, ...L.map((l) => l.len)), pts: { ch: string; li: number; x: number; y: number; a: number }[] = [];
  if (align === 'arch' || align === 'smile') {
    // 아치(위로 볼록) · 미소(아래로 볼록) — 반지름 = 가장 긴 줄 × 1.3(4u 이상), 아래 줄은 아치에선 안으로 · 미소에선 바깥으로. 글자 · 모듈이 호를 따라 돈다
    const R0 = Math.max(Lmax * 1.3, 4), up = align === 'arch';
    L.forEach((l, li) => {
      const R = up ? R0 - li * lh : R0 + li * lh, a0 = -l.len / R / 2;
      let s = 0;
      l.cs.forEach((ch, k) => {
        const ph = a0 + (s + l.av[k] / 2) / R;
        s += l.av[k];
        if (ch !== ' ') pts.push({ ch, li, x: R * Math.sin(ph), y: up ? -R * Math.cos(ph) : R * Math.cos(ph), a: up ? ph : -ph });
      });
    });
  } else {
    L.forEach((l, li) => {
      let s = -l.len / 2, n = 0, word = 0;
      const nl = l.cs.filter((c) => c !== ' ').length, nWords = l.cs.filter((c) => c === ' ').length + 1;
      const firstOfLast = l.cs.slice(0, l.cs.lastIndexOf(' ') + 1).filter((c) => c !== ' ').length;
      l.cs.forEach((ch, k) => {
        const x0 = s + l.av[k] / 2;
        s += l.av[k];
        if (ch === ' ') { word++; return; }
        let y = (li - (L.length - 1) / 2) * lh, a = 0;
        // 계단 — 낱말마다 0.6s씩 직각으로 오른다
        if (align === 'stairs') y -= word * 0.6 * ms;
        // 단상 — 가운데 낱말이 통째로 0.6s 솟는다. 낱말 셋 이상: 높이 = min(낱말 차례, 끝에서 차례) 최대 2칸 · 둘 이하: 글자를 셋으로 나눠 가운데 몫
        if (align === 'podium') y -= (nWords >= 3 ? Math.min(2, word, nWords - 1 - word) : +(n >= Math.floor(nl / 3) && n < nl - Math.floor(nl / 3))) * 0.6 * ms;
        // 내리막(결정 7) — 낱말마다 육각형 반높이(0.36s)씩 가라앉는다. 벌집처럼 맞물리는 완만한 비탈(당당 계단과 반대 결).
        // 낱말 하나뿐이면 글자를 셋으로 나눠 뒤 몫일수록 반 칸씩(단상과 같은 꼴). 그전의 고드름(∨)은 '혼자 너무 튀어' 뺐다
        if (align === 'descend') y += (nWords > 1 ? word : Math.min(2, Math.floor((n * 3) / Math.max(1, nl)))) * 0.36 * ms;
        // 징검다리 — 글자마다 ±0.4s 위아래로 엇갈림
        if (align === 'stepping') y += (n % 2 ? 1 : -1) * 0.4 * ms;
        // 하이킥 — 마지막 낱말이 통째로 0.85s(+ 그 낱말 안 차례마다 0.12s) 솟으며 12° 젖혀짐. 낱말 하나뿐이면 글자를 반으로 나눠 뒷부분 절반이
        if (align === 'highkick') {
          const from = nWords > 1 ? firstOfLast : Math.floor(nl / 2);
          if (n >= from) { y -= 0.85 * ms + 0.12 * ms * (n - from); a = deg(12); }
        }
        n++;
        pts.push({ ch, li, x: x0, y, a });
      });
    });
  }
  if (!pts.length) return [];
  const cx = (Math.min(...pts.map((q) => q.x)) + Math.max(...pts.map((q) => q.x))) / 2, cy = (Math.min(...pts.map((q) => q.y)) + Math.max(...pts.map((q) => q.y))) / 2;
  const both = align === 'arch' || align === 'smile', kx = spread, ky = both ? spread : 1.3;
  return pts.map((q) => { const [x, y, p] = snap(q.x - cx, q.y - cy); return { ...q, x, y, p, ax: (q.x - cx) * kx, ay: (q.y - cy) * ky }; });
}

/* ─── 한 말의 점들 ────────────────────────────────────────────────────────────────────────────────────────── */
/** 점 하나 — 자리(u) · 배율 · 모듈 차례(-1 = 틈 메움 · 꼬리) · 꼬리 진행(꼬리 점만) */
export interface Dot { x: number; y: number; r: number; mod: number; t?: number }
/** 꼬리 — 점들 · 나부끼는 방향(꼬리에 수직) · 붙은 글자 · 끝(터질 때 여기서부터) */
export interface Tail { dots: Dot[]; perp: P; from: number; tip: P }
/** 모듈 크기(u) — 모일수록 1.12배로 */
export const sizeAt = (kd: Kind, m: number) => M * kd.k * (1 + 0.12 * m);

/** 모듈들 — m(0 낱개 → 1 모임)의 자리와 그 자리의 점 · 윤곽 */
export function modulesAt(items: readonly Item[], kd: Kind, m: number): { pos: P[]; dots: Dot[]; polys: P[][] } {
  const s = sizeAt(kd, m), pos = items.map((it): P => [it.ax + (it.x - it.ax) * m, it.ay + (it.y - it.ay) * m]), dots: Dot[] = [], polys: P[][] = [];
  const outline = OUTLINE[kd.mod];
  pos.forEach(([px, py], i) => {
    const it = items[i];
    for (const [x, y] of lattice(kd.mod, s, it.a, it.p)) dots.push({ x: px + x, y: py + y, r: 1, mod: i });
    for (const [x, y] of beads(kd.mod, s, it.a)) dots.push({ x: px + x, y: py + y, r: 1, mod: i });
    if (outline) polys.push(outline(s).map(([x, y]) => { const [rx, ry] = rot(x, y, it.a); return [px + rx, py + ry]; }));
  });
  return { pos, dots, polys };
}
/** 모인 덩어리의 모듈 사이 좁은 틈 — '한 칸 부풀렸다 한 칸 깎기'로 메울 점(모인 자리에서 한 번 셈한다. 모이는 정도의 세제곱으로 나타난다) */
export function gapsOf(items: readonly Item[], kd: Kind): Dot[] {
  const s = sizeAt(kd, 1), key = (i: number, j: number) => `${i},${j}`, has = new Set<string>();
  items.forEach((it) => { for (const [x, y] of lattice(kd.mod, s, it.a, it.p)) has.add(key(...cell(it.x + x, it.y + y))); });
  const grown = new Set(has);
  for (const q of has) { const [i, j] = q.split(',').map(Number); for (const [a, c] of nb(i, j)) grown.add(key(a, c)); }
  const out: Dot[] = [];
  for (const q of grown) {
    if (has.has(q)) continue;
    const [i, j] = q.split(',').map(Number);
    if (nb(i, j).every(([a, c]) => grown.has(key(a, c)))) out.push({ x: i * G + (j & 1 ? G / 2 : 0), y: j * ROW, r: 1, mod: -1 });
  }
  return out;
}
/**
 * 꼬리 — 맨 아래 줄에서 기기(dev, 덩어리 좌표 u)에 가장 가까운 글자의 가장자리(0.45s)에서 나와 기기를 가리킨다(모인 자리에서 셈한다).
 * 길이 max(0.2 × 덩어리 폭, 2.25u), 밑동 반폭 max(0.055 × 폭, 0.77u). 끝 절반에서만 점이 작아진다(1 − 1.3(t − 0.5), 끝 0.35배)
 */
export function tailOf(items: readonly Item[], kd: Kind, dev: P): Tail {
  const s = sizeAt(kd, 1), last = Math.max(...items.map((i) => i.li));
  let fi = 0, best = Infinity;
  items.forEach((it, i) => { const d = Math.hypot(it.x - dev[0], it.y - dev[1]); if (it.li === last && d < best) { best = d; fi = i; } });
  const it = items[fi], du = Math.hypot(dev[0] - it.x, dev[1] - it.y) || 1, ux = (dev[0] - it.x) / du, uy = (dev[1] - it.y) / du, xs = items.map((i) => i.x);
  const span = Math.max(...xs) - Math.min(...xs) + s, w = Math.max(0.055 * span, 0.77), L = Math.max(0.2 * span, 2.25);
  const ax = ux * s * 0.45, ay = uy * s * 0.45, b: P = [ax - ux * w, ay - uy * w];
  const T: P[] = [[b[0] - uy * w, b[1] + ux * w], [ax + ux * L, ay + uy * L], [b[0] + uy * w, b[1] - ux * w]];
  const tx = T.map((q) => q[0]), ty = T.map((q) => q[1]), dots: Dot[] = [];
  for (let j = Math.floor(Math.min(...ty) / ROW) - 1; j <= Math.max(...ty) / ROW + 1; j++) for (let i = Math.floor(Math.min(...tx) / G) - 1; i <= Math.max(...tx) / G + 1; i++) {
    const x = i * G + ((it.p + j) & 1 ? G / 2 : 0) - (it.p ? G / 2 : 0), y = j * ROW, [u, v] = rot(x, y, -it.a);
    if (!inPoly(T, x, y) || INSIDE[kd.mod](u, v, s)) continue;
    const t = Math.max(0, Math.min(1, ((x - b[0]) * ux + (y - b[1]) * uy) / (L + w)));
    dots.push({ x: it.x + x, y: it.y + y, r: t < 0.5 ? 1 : 1 - 1.3 * (t - 0.5), mod: -1, t });
  }
  return { dots, perp: [-uy, ux], from: fi, tip: [it.x + ax + ux * L, it.y + ay + uy * L] };
}
/** 꼬리를 붙은 글자의 지금 자리로(꼬리는 모인 자리에서 셈한다 — 퍼져 있는 동안 · 모이는 동안엔 첫 글자에 붙어 다닌다, 결정 9) */
export function follow(tail: Tail, items: readonly Item[], at: readonly number[]): Tail {
  const dx = at[0] - items[tail.from].x, dy = at[1] - items[tail.from].y;
  return dx || dy ? { ...tail, dots: tail.dots.map((d) => ({ ...d, x: d.x + dx, y: d.y + dy })), tip: [tail.tip[0] + dx, tail.tip[1] + dy] } : tail;
}
/** 입 = 꼬리 밑동 — t가 가장 작은 꼬리 점 셋의 가운데. 큰 말의 점들이 기기가 아니라 여기서 나간다(결정 9) */
export function mouthOf(tail: Tail): P {
  const ds = [...tail.dots].sort((a, b) => (a.t ?? 0) - (b.t ?? 0)).slice(0, 3);
  return [ds.reduce((s, d) => s + d.x, 0) / ds.length, ds.reduce((s, d) => s + d.y, 0) / ds.length];
}
/** 꼬리가 먼저(결정 9) — 도킹하면 꼬리가 기기 쪽 끝부터 밑동으로 이 초에 솟고(easeOut), 그 뒤에 첫 글자가 나간다 */
export const TAIL_FIRST = 0.45;
/** 나부낌 — 진폭 1.2G · t^1.6, 꼬리에 수직, sin + 0.35 sin(2.3ω), 주기 3.8초(말마다 박자 ph가 다르다) */
export const flutter = (t: number, sec: number, ph: number) => {
  const om = (2 * Math.PI) / 3.8;
  return 1.2 * G * t ** 1.6 * (Math.sin(om * sec + ph) + 0.35 * Math.sin(2.3 * om * sec + ph));
};
/** 상자 [x0, y0, x1, y1](u) — 낱개(m = 0) 또는 모임(m = 1, 꼬리 포함)의 모듈 끝까지 */
export function boundsOf(items: readonly Item[], kd: Kind, m: 0 | 1, tail?: Tail | null): [number, number, number, number] {
  const e = REACH[kd.mod] * sizeAt(kd, m) + RF, xs = items.map((i) => (m ? i.x : i.ax)), ys = items.map((i) => (m ? i.y : i.ay));
  const b: [number, number, number, number] = [Math.min(...xs) - e, Math.min(...ys) - e, Math.max(...xs) + e, Math.max(...ys) + e];
  for (const d of tail?.dots ?? []) { b[0] = Math.min(b[0], d.x - 2 * G); b[1] = Math.min(b[1], d.y - 2 * G); b[2] = Math.max(b[2], d.x + 2 * G); b[3] = Math.max(b[3], d.y + 2 * G); }
  return b;
}

/* ─── 큰 말 — 성격별 등장(결정 3 E) · 휭 퍼짐(결정 4) ──────────────────────────────────────────────────────────── */
/**
 * 성격별 등장 — 규칙: 모듈의 선 = 움직임의 결. 한 박(글자마다, 되풀이) · 점 속도(1280 폭 기준 px/초) · 한 글자를 쌓는 시간 · 차례 ·
 * 날아오는 길(다정만 휘어서) · 내려앉기(그 글자가 다 쌓인 뒤 t초의 [가로 배율, 세로 배율, 회전])
 */
export interface Entrance { beat: readonly number[]; speed: number; burst: number; order: 'far' | 'edge' | 'random'; curve: boolean; land: (t: number) => [number, number, number] }
export const ENTRANCE: Record<Module, Entrance> = {
  // 당당 = 쿵 — 0.42초 고르게, 먼 점부터 곧게, 눌렸다 바로 선다(되튐 없음)
  square: { beat: [0.42], speed: 1700, burst: 0.08, order: 'far', curve: false, land: (t) => { const k = Math.exp(-12 * t); return [1 + 0.1 * k, 1 - 0.16 * k, 0]; } },
  // 다정 = 몽글 — 0.3초, 먼 점부터 휘어서(2차 곡선, 조절점 = 중점 + 수직 0.3 × 거리, 글자마다 좌우 번갈아), 살짝 작게 와서 부푼다
  circle: { beat: [0.3], speed: 900, burst: 0.45, order: 'far', curve: true, land: (t) => { const b = 1 - 0.18 * Math.exp(-5 * t); return [b, b, 0]; } },
  // 차분 = 착 — 0.55초 고르게, 테두리부터 안쪽으로(결정이 맺히듯) 곧게, 딱 선다
  hexagon: { beat: [0.55], speed: 1000, burst: 0.35, order: 'edge', curve: false, land: () => [1, 1, 0] },
  // 유머 = 뿅 — 엇박, 제멋대로 곧게, 튀었다 흔들리며 선다
  star: { beat: [0.22, 0.48, 0.18, 0.4, 0.3], speed: 1300, burst: 0.3, order: 'random', curve: false,
    land: (t) => { const b = 1 + 0.2 * Math.exp(-7 * t) * Math.sin(16 * t); return [b, b, 0.15 * Math.exp(-6 * t) * Math.sin(14 * t)]; } }
};
/** 긴 글 — 첫 점이 기기에서 나간 때부터 마지막 글자가 다 서기까지 이 초를 넘지 않는다(결정 8). 넘을 글이면 글자마다의 박자만 같은 비율로 줄인다 */
export const RISE_MAX = 8;
/** 휭 — 살짝 넘쳤다 돌아온다(결정 4: 1 + 2.2(t − 1)³ + 1.2(t − 1)²) */
export const backOut = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
/** 날아오는 점 하나 — 붙을 자리(낱개 자리, u) · 모듈 · 떠나는 때 · 닿는 때(초) · 휘는 길의 조절점 */
export interface Shot { x: number; y: number; mod: number; e: number; arrive: number; cp?: P }
/** 등장 계획 — 점들 · 글자마다 다 쌓이는 때 · 휭이 시작하는 때 · 휭의 배율(가로) · 모든 점이 닿는 때 */
export interface Plan { shots: Shot[]; modDone: number[]; whoosh: number; F: number; landed: number }

/**
 * 큰 말의 한 변 — 화면 정중앙에, 낱개 상태가 폭의 80%까지(벽의 '돌' 등장만큼), 단 꼬리 끝이 화면 아래 안에 드는 만큼
 * (말 반높이 + 꼬리 ≤ 화면 반높이, 견본의 여백 12px@720). 돌려주는 값 = 그 화면에서 1u의 px
 */
export function bigScale(items: readonly Item[], kd: Kind, W: number, H: number): number {
  const s = M * kd.k, pad = 1.2 * s, ax = items.map((i) => i.ax), ay = items.map((i) => i.ay), xs = items.map((i) => i.x);
  const arrW = Math.max(...ax) - Math.min(...ax) + pad, arrH = Math.max(...ay) - Math.min(...ay) + pad;
  const tail = Math.max(0.2 * (Math.max(...xs) - Math.min(...xs) + s), 2.25) + 0.45 * s;
  return Math.min((0.8 * W) / arrW, (H / 2 - (12 * H) / 720) / (arrH / 2 + tail));
}
/**
 * 등장 — 낱개 자리(m = 0)의 모듈 점들이 기기(dev, 말 좌표 u)에서 쏘아 올라 붙는다(easeOut). 글자마다 한 박, 한 글자의 점은 burst초에
 * 걸쳐 차례로. 점 속도는 화면 폭에 비례(px = u × pxPerU). 시각 0 = 큰 말이 서기 시작한 때(첫 점은 0.5초에 떠난다).
 * 휭 — 글자가 다 서면(마지막 글자 + 0.15초) 줄이 화면 가로 94%까지(F배, 1 아래로는 안 줄인다) 퍼진다. 모듈 크기는 그대로
 */
export function planEntrance(items: readonly Item[], kd: Kind, dev: P, pxPerU: number, W: number): Plan {
  const E = ENTRANCE[kd.mod], { pos, dots } = modulesAt(items, kd, 0), speed = (E.speed * W) / 1280;
  let seed = items.reduce((a, it) => (a * 31 + it.ch.charCodeAt(0)) >>> 0, 7);
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const far = (d: { x: number; y: number }) => Math.hypot(d.x - dev[0], d.y - dev[1]);
  const t0 = 0.5;
  let t = t0;
  const shots: Shot[] = [], at: number[] = [];
  const modDone = items.map((_, i) => {
    at.push(t - t0);
    const [cx, cy] = pos[i], mine = dots.filter((d) => d.mod === i).map((d) => ({ x: d.x, y: d.y }));
    if (E.order === 'far') mine.sort((p, q) => far(q) - far(p));
    if (E.order === 'edge') mine.sort((p, q) => Math.hypot(q.x - cx, q.y - cy) - Math.hypot(p.x - cx, p.y - cy));
    if (E.order === 'random') for (let k = mine.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); [mine[k], mine[j]] = [mine[j], mine[k]]; }
    let done = t;
    mine.forEach((d, n) => {
      const e = t + (E.burst * n) / Math.max(1, mine.length - 1), arrive = e + (pxPerU * far(d)) / speed, side = i % 2 ? 1 : -1;
      const vx = d.x - dev[0], vy = d.y - dev[1];
      shots.push({ ...d, mod: i, e, arrive, ...(E.curve ? { cp: [(dev[0] + d.x) / 2 - vy * 0.3 * side, (dev[1] + d.y) / 2 + vx * 0.3 * side] as P } : {}) });
      done = Math.max(done, arrive);
    });
    t += E.beat[i % E.beat.length];
    return done;
  });
  // 긴 글(결정 8) — 글자 i가 다 서는 때 = 첫 점 + 박자의 합 at[i] × f + 그 글자 몫(burst · 날기). 가장 늦은 글자가 RISE_MAX에 들도록 f를
  // 고르고 박자의 합만 줄인다 — 박자 꼴(쿵 고르게 · 뿅 들쭉날쭉) · burst · 점 속도는 그대로
  if (Math.max(...modDone) - t0 > RISE_MAX) {
    const f = Math.max(0, Math.min(...modDone.map((d, i) => (at[i] > 0 ? (RISE_MAX - (d - t0 - at[i])) / at[i] : Infinity))));
    for (const s of shots) { s.e -= (1 - f) * at[s.mod]; s.arrive -= (1 - f) * at[s.mod]; }
    modDone.forEach((d, i) => (modDone[i] = d - (1 - f) * at[i]));
  }
  const ax = items.map((i) => i.ax), arrW = Math.max(...ax) - Math.min(...ax) + 1.2 * M * kd.k;
  return { shots, modDone, whoosh: Math.max(...modDone) + 0.15, F: Math.max(1, (0.94 * W) / (pxPerU * arrW)), landed: Math.max(...shots.map((d) => d.arrive)) };
}
