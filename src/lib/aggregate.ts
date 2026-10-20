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

/* ─── 4/5 모양 — 네 성격 모두 셋: 기본 · 미소 · 단호(결정 31, 2026-10-20 디자이너 — "징검다리 · 하이킥은 읽기 힘들고 도킹 때 그 효과가
   정상적으로 나오지도 않는다 → 최대한 단순하게"). 그전의 열두 칸(결정 3 F · 결정 7 — 계단 · 단상 · 아치 · 탑 · 내리막 · 징검다리 · 하이킥)은
   지웠다 — 옛 글의 그 값은 arrangeOf가 기본으로 그린다 ─── */
const SHAPES: readonly Align[] = ['center', 'smile', 'slant'];
const ARRANGEMENTS: Record<string, readonly Align[]> = { ttoryeot: SHAPES, doran: SHAPES, chabun: SHAPES, deulseok: SHAPES };
/** 단호 — 덩어리째 오른쪽 위로 기우는 각(글자 · 모듈도 함께 돈다, 견본 B) */
const SLANT = 12;
export const arrangementsFor = (font: string | undefined): readonly Align[] => ARRANGEMENTS[keyOf(font)] ?? ['center'];
/** 4/5에 처음 들어왔을 때 골라져 있는 칸 — 넷 모두 '기본' */
export const defaultAlign = (_font?: string): Align => 'center';
/** 그 성격의 칸이 아닌 값(옛 글의 휘기 · 올리기 · 둥실 …, 다른 성격에서 고른 값)은 기본으로 그린다(결정 3 F) */
export const arrangeOf = (font: string | undefined, align?: Align): Align => (align && arrangementsFor(font).includes(align) ? align : 'center');
/** 낱개 자리 · 휭을 가로세로 같은 배율로 벌리는 모양 — 미소 · 단호(가로만 벌리면 단호의 기울기가 눕는다, 결정 31). 기본은 가로만 */
export const evenSpread = (align: Align) => align === 'smile' || align === 'slant';

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
 * 글 → 글자들의 자리. 두 줄 이상은 줄마다 같은 규칙. 미소 — 줄이 아래로 볼록한 호를 따라(반지름 = 가장 긴 줄 × 1.3, 4u 이상, 아래 줄은
 * 바깥으로), 글자 · 모듈이 호를 따라 돈다. 단호 — 기본의 덩어리를 통째로 SLANT°만큼 오른쪽 위로 돌린다(글자 · 모듈도 함께).
 * 낱개 자리 — 기본은 가로 벌림 + 세로 1.3배, 미소 · 단호는 가로세로 같이 벌림(벽 큰 말은 도킹 내내 낱개로 퍼져 있다 — 세로만 덜 벌리면
 * 단호의 기울기가 눕는다, 결정 31)
 */
export function arrange(lines: readonly string[], align: Align, kd: Kind): Item[] {
  const adv = kd.adv * G, spread = (adv + kd.arrive * G) / adv, lh = kd.rows * ROW;
  const L = lines.map((ln) => { const cs = [...ln], av = cs.map((ch) => (ch === ' ' ? G : adv)); return { cs, av, len: av.reduce((a, b) => a + b, 0) }; });
  const Lmax = Math.max(0, ...L.map((l) => l.len)), pts: { ch: string; li: number; x: number; y: number; a: number }[] = [];
  if (align === 'smile') {
    const R0 = Math.max(Lmax * 1.3, 4);
    L.forEach((l, li) => {
      const R = R0 + li * lh, a0 = -l.len / R / 2;
      let s = 0;
      l.cs.forEach((ch, k) => {
        const ph = a0 + (s + l.av[k] / 2) / R;
        s += l.av[k];
        if (ch !== ' ') pts.push({ ch, li, x: R * Math.sin(ph), y: R * Math.cos(ph), a: -ph });
      });
    });
  } else {
    const th = align === 'slant' ? deg(SLANT) : 0, c = Math.cos(th), sn = Math.sin(th);
    L.forEach((l, li) => {
      let s = -l.len / 2;
      l.cs.forEach((ch, k) => {
        const x = s + l.av[k] / 2, y = (li - (L.length - 1) / 2) * lh;
        s += l.av[k];
        if (ch !== ' ') pts.push({ ch, li, x: x * c + y * sn, y: -x * sn + y * c, a: -th });
      });
    });
  }
  if (!pts.length) return [];
  const cx = (Math.min(...pts.map((q) => q.x)) + Math.max(...pts.map((q) => q.x))) / 2, cy = (Math.min(...pts.map((q) => q.y)) + Math.max(...pts.map((q) => q.y))) / 2;
  const kx = spread, ky = evenSpread(align) ? spread : 1.3;
  return pts.map((q) => { const [x, y, p] = snap(q.x - cx, q.y - cy); return { ...q, x, y, p, ax: (q.x - cx) * kx, ay: (q.y - cy) * ky }; });
}

/* ─── 한 말의 점들 ────────────────────────────────────────────────────────────────────────────────────────── */
/** 점 하나 — 자리(u) · 배율 · 모듈 차례(-1 = 틈 메움 · 꼬리, -2 = 꼬리 밑동의 핀홀 메움 — 입 셈에서 뺀다) · 꼬리 진행(꼬리 점만) */
export interface Dot { x: number; y: number; r: number; mod: number; t?: number }
/** 꼬리 — 점들 · 나부끼는 방향(꼬리에 수직) · 붙은 글자 · 끝(터질 때 여기서부터) */
export interface Tail { dots: Dot[]; perp: P; from: number; tip: P; L: number }
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
/**
 * 핀홀(2026-10-20, 셋째 점검 3번 — 288장면에 0.15칸보다 작은 닫힌 점이 1 ~ 7개, 유머는 1.5 ~ 2px 검은 점) — 원들([가운데 x, y, 반지름], u)과
 * 칠한 다각형의 합집합 안에 갇힌 빈 곳을 크기와 상관없이 찾아 덮는 점을 돌려준다. 빈 곳의 귀퉁이는 반드시 두 원이(또는 원과 다각형 변이)
 * 엇갈린 꼭짓점이니 그 바로 바깥만 본다 — 덮이지 않았고, 거기서 32방향 어디로 가도 메움 반지름 RF 안에 덮인 곳이 나오면 갇힌 것이다(바깥
 * 홈 · 별 사이 홈은 어느 쪽으론가 빠져나가 그대로 열려 있다). 덮는 점 = 가장 먼 방향까지 + 한 걸음. 귀퉁이 하나에서 다 못 덮었으면 덮는 점까지
 * 넣고 여덟 번까지 다시 본다(새로 넣은 점이 낀 곳만). 거의 맞닿은 두 원(틈이 TOL = 0.01u보다 좁다 — 큰 화면에서도 1px 남짓)은 먼저 그 틈에 아주 작은 다리 점을 놓아
 * 잇는다 — 칠하면 이어져 보이는 틈이라 그 너머가 갇힌 곳이면 그대로 점으로 남았다(다리 점은 그 틈 안에만 있어 윤곽은 그대로).
 * lead — 이 원이 낀 짝(꼭짓점)만 본다. want(i, j, bridge) — lead인 i와 짝 j(다각형이면 −1)를 볼지(bridge = 다리를 놓을 짝인가). 덮는 점이 낀 짝은
 * 늘 보고, 다리 점은 덮기만 한다(그 둘레에서 빈 곳을 찾지 않는다 — 다리는 가르는 것이지 메우는 것이 아니다)
 */
function plugs(cs0: readonly (readonly [number, number, number])[], polys: readonly (readonly P[])[], lead?: (i: number) => boolean, want?: (i: number, j: number, bridge: boolean) => boolean): Dot[] {
  const STEP = RF / 24, DIRS = 32, EPS = 1e-4, TOL = 0.01, out: Dot[] = [], cs = cs0.map(([x, y, r]): [number, number, number] => [x, y, r]);
  if (!cs.length) return out;
  const n0 = cs.length;
  let nb = Infinity;   // 다리 뒤 — 여기부터가 덮는 점
  const pick = (i: number) => i >= nb || (i < n0 && (!lead || lead(i)));
  const ok = (i: number, j: number, br = false) => i >= nb || j >= nb || (i < n0 && j < n0 && (!want || want(i, j, br)));
  // 칸 C(덮였나는 둘레 한 칸 — 반지름 ≤ C, 짝은 둘레 두 칸 — 겹침 ≤ 2C)로 나눈 판. 칸마다 원은 이어 달기(head → next), 다각형은 목록
  const C = RF + TOL, xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]);
  const gx = Math.floor(Math.min(...xs) / C) - 3, gy = Math.floor(Math.min(...ys) / C) - 3, GW = Math.floor(Math.max(...xs) / C) + 4 - gx, GH = Math.floor(Math.max(...ys) / C) + 4 - gy;
  const head = new Int32Array(GW * GH).fill(-1), next: number[] = [], pg: number[][] = [];
  const cx = (x: number) => Math.floor(x / C) - gx, cy = (y: number) => Math.floor(y / C) - gy;
  const put = (i: number) => { const a = cx(cs[i][0]), b = cy(cs[i][1]); if (a >= 0 && b >= 0 && a < GW && b < GH) { next[i] = head[b * GW + a]; head[b * GW + a] = i; } };
  cs.forEach((_, i) => put(i));
  const boxes = polys.map((Q) => [Math.min(...Q.map((q) => q[0])), Math.min(...Q.map((q) => q[1])), Math.max(...Q.map((q) => q[0])), Math.max(...Q.map((q) => q[1]))]);
  boxes.forEach((b, q) => {
    for (let j = Math.max(0, cy(b[1])); j <= Math.min(GH - 1, cy(b[3])); j++) for (let i = Math.max(0, cx(b[0])); i <= Math.min(GW - 1, cx(b[2])); i++) (pg[j * GW + i] ??= []).push(q);
  });
  /** 둘레 (2w + 1)² 칸의 원마다 f — f가 참이면 멈추고 참 */
  const around = (x: number, y: number, w: number, f: (k: number) => boolean | void) => {
    const a = cx(x), b = cy(y);
    for (let j = Math.max(0, b - w); j <= Math.min(GH - 1, b + w); j++) for (let i = Math.max(0, a - w); i <= Math.min(GW - 1, a + w); i++)
      for (let k = head[j * GW + i]; k >= 0; k = next[k]) if (f(k)) return true;
    return false;
  };
  const covered = (x: number, y: number) => {
    if (around(x, y, 1, (k) => (x - cs[k][0]) ** 2 + (y - cs[k][1]) ** 2 < cs[k][2] * cs[k][2])) return true;
    const a = cx(x), b = cy(y), p = a >= 0 && b >= 0 && a < GW && b < GH ? pg[b * GW + a] : undefined;
    return !!p && p.some((q) => { const o = boxes[q]; return x >= o[0] && x <= o[2] && y >= o[1] && y <= o[3] && inPoly(polys[q], x, y); });
  };
  /** (x, y)가 갇힌 빈 곳이면 덮을 반지름, 아니면 0 — a0(바깥일 법한 쪽)부터 번갈아 본다 */
  const trapped = (x: number, y: number, a0: number) => {
    let far = 0;
    for (let d = 0; d < DIRS; d++) {
      const a = a0 + (d & 1 ? -1 : 1) * Math.ceil(d / 2) * ((2 * Math.PI) / DIRS), ux = Math.cos(a), uy = Math.sin(a);
      let t = STEP;
      while (t <= RF && !covered(x + ux * t, y + uy * t)) t += STEP;
      if (t > RF) return 0;
      far = Math.max(far, t);
    }
    return far + STEP;
  };
  const add = (x: number, y: number, r: number) => { out.push({ x, y, r: r / RF, mod: -1 }); cs.push([x, y, r]); put(cs.length - 1); };
  const plug = (x: number, y: number, a0: number) => { if (!covered(x, y)) { const r = trapped(x, y, a0); if (r) add(x, y, r); } };
  /** i의 이웃 j(n 앞) — 겹치거나 TOL 안으로 다가선 원. i는 부르는 쪽이 고르고 j는 아무 원 — 둘 다 고를 원(lo 뒤 · pick)이면 한 번만 */
  const pairs = (i: number, n: number, lo: number, f: (j: number, d: number) => void, br = false) => {
    const [xi, yi, ri] = cs[i];
    around(xi, yi, 2, (j) => {
      if (j === i || j >= n || (j < i && j >= lo && pick(j)) || !ok(i, j, br)) return;
      const d = Math.hypot(cs[j][0] - xi, cs[j][1] - yi);
      if (d < ri + cs[j][2] + TOL) f(j, d);
    });
  };
  // 다리 — 거의 맞닿은 두 원
  for (let i = 0; i < n0; i++) if (pick(i)) pairs(i, n0, 0, (j, d) => {
    const [xi, yi, ri] = cs[i], [xj, yj, rj] = cs[j], gap = d - ri - rj;
    if (gap >= 0) add(xi + ((xj - xi) * (ri + gap / 2)) / d, yi + ((yj - yi) * (ri + gap / 2)) / d, gap / 2 + EPS);
  }, true);
  nb = cs.length;
  for (let pass = 0, from = 0; pass < 8; pass++) {   // 첫 번째는 처음 원들 · 다리 뒤(덮는 점)는 다음부터
    const n0 = out.length, n = cs.length;
    for (let i = from; i < n; i++) {   // 다시 볼 때는 새로 넣은 점 둘레만
      if (!pick(i)) continue;
      const [xi, yi, ri] = cs[i];
      // 원이 다각형 변과 엇갈린 꼭짓점 바로 바깥(원 바깥쪽 · 변 양쪽으로 EPS) — 다각형이 한 변을 두른 빈 곳
      const a = cx(xi), b = cy(yi), qs = new Set<number>();
      for (let j = Math.max(0, b - 2); j <= Math.min(GH - 1, b + 2); j++) for (let k = Math.max(0, a - 2); k <= Math.min(GW - 1, a + 2); k++) for (const q of pg[j * GW + k] ?? []) qs.add(q);
      if (ok(i, -1)) for (const q of qs) {
        const Q = polys[q], o = boxes[q];
        if (xi + ri < o[0] || xi - ri > o[2] || yi + ri < o[1] || yi - ri > o[3]) continue;
        Q.forEach(([x0, y0], e) => {
          const [x1, y1] = Q[(e + 1) % Q.length], dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy, fx = x0 - xi, fy = y0 - yi;
          const bq = fx * dx + fy * dy, disc = bq * bq - L2 * (fx * fx + fy * fy - ri * ri);
          if (disc < 0) return;
          for (let r = -1; r <= 1; r += 2) {
            const t = (-bq + r * Math.sqrt(disc)) / L2;
            if (t < 0 || t > 1) continue;
            const qx = x0 + dx * t, qy = y0 + dy * t, L = Math.sqrt(L2), nx = -dy / L, ny = dx / L, rx = (qx - xi) / ri, ry = (qy - yi) / ri;
            for (let s = 1; s >= -1; s -= 2) plug(qx + EPS * (rx + s * nx), qy + EPS * (ry + s * ny), Math.atan2(ry, rx));
          }
        });
      }
      // 두 원이 엇갈린 꼭짓점 바로 바깥(엇갈림 축을 따라 두 원에서 멀어지는 쪽으로 EPS)
      pairs(i, n, from, (j, d) => {
        const [xj, yj, rj] = cs[j];
        if (d >= ri + rj || d <= Math.abs(ri - rj)) return;
        const e = (d * d + ri * ri - rj * rj) / (2 * d), h = Math.sqrt(Math.max(0, ri * ri - e * e)), ex = (xj - xi) / d, ey = (yj - yi) / d;
        for (let s = 1; s >= -1; s -= 2) plug(xi + e * ex - s * (h + EPS) * ey, yi + e * ey + s * (h + EPS) * ex, Math.atan2(s * ex, -s * ey));
      });
    }
    if (out.length === n0) break;
    from = n;
  }
  return out;
}
/**
 * 모인 덩어리의 모듈 사이 좁은 틈 — '한 칸 부풀렸다 한 칸 깎기'로 메울 점(모인 자리에서 한 번 셈한다. 모이는 정도의 세제곱으로 나타난다).
 * 덩어리 안에 갇힌 빈칸도 크기와 상관없이 메운다(10-20 점검 둘째 — 여러 줄 단상에서 줄 사이에 갇힌 칸이 검은 얼룩으로 남았다)
 */
const GAPS = new WeakMap<readonly Item[], { kd: Kind; out: Dot[] }>();
export function gapsOf(items: readonly Item[], kd: Kind): Dot[] {
  const had = GAPS.get(items);   // 말마다 한 번 — 꼬리 밑동도 이 메움을 둘레로 본다(tailOf)
  if (had && had.kd === kd) return had.out;
  const s = sizeAt(kd, 1), key = (i: number, j: number) => `${i},${j}`, has = new Set<string>();
  items.forEach((it) => { for (const [x, y] of lattice(kd.mod, s, it.a, it.p)) has.add(key(...cell(it.x + x, it.y + y))); });
  const grown = new Set(has);
  for (const q of has) { const [i, j] = q.split(',').map(Number); for (const [a, c] of nb(i, j)) grown.add(key(a, c)); }
  const fill = new Set<string>();
  for (const q of grown) {
    if (has.has(q)) continue;
    const [i, j] = q.split(',').map(Number);
    if (nb(i, j).every(([a, c]) => grown.has(key(a, c)))) fill.add(q);
  }
  if (has.size) {
    // 갇힌 빈칸 — 덩어리를 한 칸 넓게 두른 테두리에서 빈칸을 따라 번져, 닿지 않은 빈칸이 갇힌 칸이다. 벽은 화면에 칠해지는 것 그대로 — 모듈 칸 +
    // 윤곽 점 + 위에서 메운 한 칸 틈. 앞의 둘을 빼면 별 · 육각 사이 틈을 타고 번져 하이킥 · 내리막 · 징검다리 안의 구멍을 바깥으로 셌다(점검 둘째 확인)
    const rim = new Set<string>();
    items.forEach((it) => { for (const [x, y] of beads(kd.mod, s, it.a)) rim.add(key(...cell(it.x + x, it.y + y))); });
    const wall = (q: string) => has.has(q) || rim.has(q) || fill.has(q), IJ = [...has, ...rim].map((q) => q.split(',').map(Number)), I = IJ.map((q) => q[0]), J = IJ.map((q) => q[1]);
    const i0 = Math.min(...I) - 1, i1 = Math.max(...I) + 1, j0 = Math.min(...J) - 1, j1 = Math.max(...J) + 1, seen = new Set([key(i0, j0)]), todo = [[i0, j0]];
    while (todo.length) {
      const [i, j] = todo.pop()!;
      for (const [a, c] of nb(i, j)) { const q = key(a, c); if (a >= i0 && a <= i1 && c >= j0 && c <= j1 && !seen.has(q) && !wall(q)) { seen.add(q); todo.push([a, c]); } }
    }
    // 안쪽(바깥 칸과 맞닿지 않은) 윤곽 점 자리도 메운다 — 윤곽 점은 칸에서 반 칸까지 비켜 있어 그 칸을 다 덮지 못한다
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const q = key(i, j);
      if (!has.has(q) && !fill.has(q) && !seen.has(q) && (!rim.has(q) || nb(i, j).every(([a, c]) => !seen.has(key(a, c))))) fill.add(q);
    }
  }
  const out = [...fill].map((q): Dot => { const [i, j] = q.split(',').map(Number); return { x: i * G + (j & 1 ? G / 2 : 0), y: j * ROW, r: 1, mod: -1 }; });
  // 핀홀 — 모듈 점 · 윤곽 점 · 다각형 · 위의 메움이 남긴, 한 칸에 훨씬 못 미치는 갇힌 곳(plugs). 격자 위의 점끼리는 서로 사이를 늘 덮으니(RF >
  // G/√3) 격자를 벗어난 점(윤곽 점)이 낀 곳만 본다
  const body = modulesAt(items, kd, 1), all = [...body.dots, ...out];
  const off = all.map((d) => { const j = Math.round(d.y / ROW), i = (d.x - (j & 1 ? G / 2 : 0)) / G; return Math.abs(d.y - j * ROW) > 1e-6 || Math.abs(i - Math.round(i)) > 1e-6; });
  const done = out.concat(plugs(all.map((d) => [d.x, d.y, RF * d.r] as const), body.polys, (i) => i >= all.length || off[i]));
  GAPS.set(items, { kd, out: done });
  return done;
}
/**
 * 꼬리 — 맨 아래 줄에서 기기(dev, 덩어리 좌표 u)에 가장 가까운 글자의 가장자리(0.45s)에서 나와 기기를 가리킨다(모인 자리에서 셈한다).
 * 꼬리 '더 날렵'(결정 24, 2026-10-20 디자이너 — "너무 둔해 보인다"): 밑동 반폭 0.38u, 길이 max(0.28 × 덩어리 폭, 3.3u), 점 크기는 밑동부터
 * 끝까지 가늘어져 아주 작은 점으로 맺힌다(max(0.12, 1 − 0.88 t^0.85)). 예전 값은 반폭 max(0.055 × 폭, 0.77) · 길이 max(0.2 × 폭, 2.25) ·
 * 끝 절반만 1 − 1.3(t − 0.5). 폰 · 벽 · 홈 · 튜토 모든 말풍선이 함께 바뀐다.
 * max — 길이의 상한(옛 길이 2.25 아래로는 안 줄인다, fitTail). room — 옛 꼴(예전 반폭 · 길이) 그대로: 글자 크기를 잡는 자리로만 쓴다
 */
/** 꼬리 밑동의 핀홀 메움 — 말(items)마다, 밑동 점 배치마다 한 번만 셈한다 */
const TAIL_PLUGS = new WeakMap<readonly Item[], Map<string, Dot[]>>();
export function tailOf(items: readonly Item[], kd: Kind, dev: P, max = Infinity, room = false): Tail {
  const s = sizeAt(kd, 1), last = Math.max(...items.map((i) => i.li));
  let fi = 0, best = Infinity;
  items.forEach((it, i) => { const d = Math.hypot(it.x - dev[0], it.y - dev[1]); if (it.li === last && d < best) { best = d; fi = i; } });
  const it = items[fi], du = Math.hypot(dev[0] - it.x, dev[1] - it.y) || 1, ux = (dev[0] - it.x) / du, uy = (dev[1] - it.y) / du, xs = items.map((i) => i.x);
  const span = Math.max(...xs) - Math.min(...xs) + s, w = room ? Math.max(0.055 * span, 0.77) : 0.38;
  const L = room ? Math.max(0.2 * span, 2.25) : Math.max(2.25, Math.min(Math.max(0.28 * span, 3.3), max));
  const ax = ux * s * 0.45, ay = uy * s * 0.45, b: P = [ax - ux * w, ay - uy * w];
  const T: P[] = [[b[0] - uy * w, b[1] + ux * w], [ax + ux * L, ay + uy * L], [b[0] + uy * w, b[1] - ux * w]];
  const tx = T.map((q) => q[0]), ty = T.map((q) => q[1]), dots: Dot[] = [];
  for (let j = Math.floor(Math.min(...ty) / ROW) - 1; j <= Math.max(...ty) / ROW + 1; j++) for (let i = Math.floor(Math.min(...tx) / G) - 1; i <= Math.max(...tx) / G + 1; i++) {
    const x = i * G + ((it.p + j) & 1 ? G / 2 : 0) - (it.p ? G / 2 : 0), y = j * ROW, [u, v] = rot(x, y, -it.a);
    if (!inPoly(T, x, y) || INSIDE[kd.mod](u, v, s)) continue;
    const t = Math.max(0, Math.min(1, ((x - b[0]) * ux + (y - b[1]) * uy) / (L + w)));
    dots.push({ x: it.x + x, y: it.y + y, r: Math.max(0.12, 1 - 0.88 * t ** 0.85), mod: -1, t });
  }
  // 밑동 핀홀 — 꼬리 첫 점들(몸통에 닿은 점 — 몸통과 한 덩어리로 보인다)이 낀, 갇힌 아주 작은 곳(plugs). 첫 점과 모듈 사이 · 첫 점과 둘째
  // 줄 사이의 세모가 몸통 아래 가장자리의 검은 점으로 보였다. 첫 점끼리 거의 맞닿은 틈엔 다리를 놓는다. 둘째 줄부터의 꼬리 점끼리 틈은 꼬리의
  // 점 결이라 그대로 둔다 — 그것까지 메우면 밑동이 한 덩어리가 됐다. 꼬리는 그림마다 다시 셈하니 밑동 1.2u 안만 본다. 밑동이라 나부끼지 않고 가장 먼저 솟는다(t = 0)
  const ro: P = [it.x + ax, it.y + ay], close = (d: Dot) => Math.hypot(d.x - ro[0], d.y - ro[1]) < 1.2, tc = dots.filter(close);
  const memo = TAIL_PLUGS.get(items) ?? new Map<string, Dot[]>(), k = `${fi}|${tc.map((d) => `${d.x.toFixed(3)},${d.y.toFixed(3)},${d.r.toFixed(2)}`).join(';')}`;
  let got = memo.get(k);
  if (!got) {
    const body = modulesAt(items.filter((o) => Math.hypot(o.x - it.x, o.y - it.y) < 2 * s), kd, 1), bc = [...body.dots, ...gapsOf(items, kd)].filter(close);
    const B = bc.length, first = tc.map((d) => bc.some((b) => Math.hypot(b.x - d.x, b.y - d.y) < RF * (b.r + d.r)));
    got = plugs([...bc, ...tc].map((d) => [d.x, d.y, RF * d.r] as const), body.polys, (i) => i >= B, (i, j, br) => j < B || (br ? first[i - B] && first[j - B] : first[i - B] || first[j - B]))
      .map((d) => ({ ...d, mod: -2, t: 0 }));
    if (memo.size > 48) memo.delete(memo.keys().next().value!);
    memo.set(k, got); TAIL_PLUGS.set(items, memo);
  }
  dots.push(...got);
  return { dots, perp: [-uy, ux], from: fi, tip: [it.x + ax + ux * L, it.y + ay + uy * L], L };
}
/**
 * 무대 안에 드는 꼬리(2026-10-20 점검 둘째) — 결정 24로 꼬리가 길어지자 폰 무대가 그 꼬리까지 담느라 글자가 3.5 ~ 14% 작아졌고(5/5),
 * 낱개 단계는 꼬리를 아예 셈하지 않아 끝이 무대 밖으로 나갔다(4/5). 글자 크기는 옛 꼬리 자리(tailOf … room)로 그대로 잡고, 꼬리가
 * 양보한다 — 꼬리가 그려질 자리들(at = [1u의 px, 원점 x, y, 붙은 글자 x, y(u)]) 모두에서 끝(+ 점 반지름 · 나부낌 폭)이 W × H 안에
 * 드는 만큼만 길다. 옛 길이 2.25까지만 줄인다
 */
export function fitTail(items: readonly Item[], kd: Kind, dev: P, at: readonly (readonly number[])[], W: number, H: number): Tail {
  const tail = tailOf(items, kd, dev), [nx, ny] = tail.perp, ux = ny, uy = -nx;
  let cut = 0;
  for (const place of at) {
    const [tx, ty, px, py] = tipAt(tail, items, place), u = place[0];
    if (ux > 0) cut = Math.max(cut, (tx + px - W) / (u * ux));
    if (ux < 0) cut = Math.max(cut, (px - tx) / (u * -ux));
    if (uy > 0) cut = Math.max(cut, (ty + py - H) / (u * uy));
    if (uy < 0) cut = Math.max(cut, (py - ty) / (u * -uy));
  }
  return cut > 0 ? tailOf(items, kd, dev, tail.L - cut) : tail;
}
/** 꼬리 끝의 화면 자리(px)와 덧(점 반지름 + 나부낌 최대 1.2G × 1.35의 가로 · 세로 몫) — place = [1u의 px, 원점 x, y, 붙은 글자 x, y(u)] */
export function tipAt(tail: Tail, items: readonly Item[], [u, ox, oy, x, y]: readonly number[]): [number, number, number, number] {
  const it = items[tail.from], sway = 1.62 * G * u;
  return [ox + (tail.tip[0] - it.x + x) * u, oy + (tail.tip[1] - it.y + y) * u, RF * u + sway * Math.abs(tail.perp[0]), RF * u + sway * Math.abs(tail.perp[1])];
}
/** 꼬리를 붙은 글자의 지금 자리로(꼬리는 모인 자리에서 셈한다 — 퍼져 있는 동안 · 모이는 동안엔 첫 글자에 붙어 다닌다, 결정 9) */
export function follow(tail: Tail, items: readonly Item[], at: readonly number[]): Tail {
  const dx = at[0] - items[tail.from].x, dy = at[1] - items[tail.from].y;
  return dx || dy ? { ...tail, dots: tail.dots.map((d) => ({ ...d, x: d.x + dx, y: d.y + dy })), tip: [tail.tip[0] + dx, tail.tip[1] + dy] } : tail;
}
/** 입 = 꼬리 밑동 — t가 가장 작은 꼬리 점 셋의 가운데. 큰 말의 점들이 기기가 아니라 여기서 나간다(결정 9) */
export function mouthOf(tail: Tail): P {
  const ds = tail.dots.filter((d) => d.mod === -1).sort((a, b) => (a.t ?? 0) - (b.t ?? 0)).slice(0, 3);
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
/**
 * 도킹한 큰 말의 차례(결정 3 · 9) — W × H 화면에서 크게 선 1u(px) · 기기(u, 말 원점 기준, drop = 화면 아래 바깥 높이의 몫) · 꼬리 ·
 * 낱개 자리 · 입(꼬리 밑동 — 점이 여기서 나간다) · 등장 계획. 벽(WallSky)이 그리고, 폰 07이 글자마다 서는 시각(소리의 결 박자)을 같은
 * 셈으로 읽는다 — 따로 근사하면 둘이 어긋난다(결정 11). 화면비가 같으면 시각은 크기와 상관없다(점 속도가 폭에 비례)
 */
export function dockPlanOf(items: readonly Item[], kd: Kind, W: number, H: number, drop: number, even = false) {
  const S = bigScale(items, kd, W, H), dev: P = [0, (H / 2 + H * drop) / S], tail = tailOf(items, kd, dev), rest = modulesAt(items, kd, 0);
  const mouth = mouthOf(follow(tail, items, rest.pos[tail.from])), plan = planEntrance(items, kd, mouth, S, W, H, even, tail);
  return { S, dev, tail, rest, mouth, plan };
}
/**
 * 일찍 뗀 도킹(결정 21) — 등장 at초에 폰이 빠졌는데 아직 쏘기 시작하지 않은 글자가 있으면, 그 글자들을 차례대로 당겨 세운다 — 간격은
 * min(원래 간격, gap초)(점검 둘째: 60자 글은 RISE_MAX로 박자가 이미 0.15초보다 짧아, 0.15초로 고르면 오히려 0.7초 늦었다). 점 속도 · 한
 * 글자 쌓는 시간은 그대로, 이미 날아오는 글자는 그대로. 휭은 없다(F = 1) — 다 서면 곧장 모인다
 */
export const HURRY = 0.15;
export function hurry(plan: Plan, at: number, gap = HURRY): Plan {
  const start = plan.modDone.map((_, i) => Math.min(...plan.shots.filter((s) => s.mod === i).map((s) => s.e)));
  const shift = new Map<number, number>();
  let t = at, prev = 0;
  start.map((s, i) => [s, i] as const).filter(([s]) => s > at).sort((a, b) => a[0] - b[0]).forEach(([s, i], k) => {
    if (k) t += Math.min(s - prev, gap);
    prev = s;
    shift.set(i, t - s);
  });
  const shots = plan.shots.map((d) => { const k = shift.get(d.mod) ?? 0; return k ? { ...d, e: d.e + k, arrive: d.arrive + k } : d; });
  const modDone = plan.modDone.map((d, i) => d + (shift.get(i) ?? 0));
  return { shots, modDone, whoosh: Math.max(...modDone) + 0.15, F: 1, Fy: 1, landed: Math.max(...shots.map((d) => d.arrive)) };
}
/** 휭 — 살짝 넘쳤다 돌아온다(결정 4: 1 + 2.2(t − 1)³ + 1.2(t − 1)²) */
export const backOut = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
/** 날아오는 점 하나 — 붙을 자리(낱개 자리, u) · 모듈 · 떠나는 때 · 닿는 때(초) · 휘는 길의 조절점 */
export interface Shot { x: number; y: number; mod: number; e: number; arrive: number; cp?: P }
/** 등장 계획 — 점들 · 글자마다 다 쌓이는 때 · 휭이 시작하는 때 · 휭의 배율(가로 F · 세로 Fy — 세로는 미소 · 단호만, 기본은 1) · 모든 점이 닿는 때 */
export interface Plan { shots: Shot[]; modDone: number[]; whoosh: number; F: number; Fy: number; landed: number }

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
 * 휭 — 글자가 다 서면(마지막 글자 + 0.15초) 줄이 화면 가로 94%까지(F배, 1 아래로는 안 줄인다) 퍼진다(미소 · 단호는 세로도 같은 배율로, 화면 안에 드는 만큼 — Fy). 모듈 크기는 그대로
 */
export function planEntrance(items: readonly Item[], kd: Kind, dev: P, pxPerU: number, W: number, H: number, even = false, tail?: Tail): Plan {
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
  const done = { shots, modDone, whoosh: Math.max(...modDone) + 0.15, landed: Math.max(...shots.map((d) => d.arrive)) };
  const ax = items.map((i) => i.ax), arrW = Math.max(...ax) - Math.min(...ax) + 1.2 * M * kd.k, F = Math.max(1, (0.94 * W) / (pxPerU * arrW));
  if (!even) return { ...done, F, Fy: 1 };
  // 미소 · 단호 — 세로도 같은 배율로 벌려 기울기 · 호를 지킨다. 대신 몸통 점과 꼬리 점(나부낌 최대 1.62G · t^1.6까지)이 화면 위아래(bigScale의
  // 여백) 안에 드는 만큼까지만 — 점마다 제 글자 자리를 따라 움직이니(배율 k에서 y + (k − 1) · 글자 y) 한 점씩 상한을 잰다
  const lim = (H / 2 - (12 * H) / 720) / pxPerU, room = (y: number, p: number) => (p > 0 ? 1 + (lim - y) / p : p < 0 ? 1 + (lim + y) / -p : Infinity);
  let k = F;
  for (const d of dots) k = Math.min(k, room(d.y + RF * Math.sign(pos[d.mod][1]), pos[d.mod][1]));
  if (tail) {
    const py = pos[tail.from][1], dy = py - items[tail.from].y;
    for (const d of tail.dots) k = Math.min(k, room(d.y + dy + (RF * d.r + 1.62 * G * (d.t ?? 0) ** 1.6) * Math.sign(py), py));
  }
  k = Math.max(1, k);
  return { ...done, F: k, Fy: k };
}
