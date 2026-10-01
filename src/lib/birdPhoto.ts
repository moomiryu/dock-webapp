// ─── 유머있는 — 사진에서 딴 새 (2026-10-01) ─────────────────────────────
// 말투가 무리를 고른다: 귀여운 = 배가 둥근 작은 새 9, 시니컬한 = 까마귀 12(birdPhoto.data.ts). 앉은 옆모습 · 다리 없음.
// 글이 먼저다: 글 + 여백(PAD) 네모가 드는 가장 큰 자리를 칸 격자로 찾고(구름의 photoFit과 같은 길), 새는 그 크기로.
// 그다음 글만 text배(1.65) — 새 밖으로 나간 글자는 새 윤곽으로 잘린다(클리핑, CloudBubble). 새는 그대로라 글이 '넘친다'.
// 날 때(벽): 날갯짓 세 장면(올림 · 수평 · 내림). 작은 새는 앉은 몸에 종다리 날개를 붙인 판이라 몸과 글 자리가 그대로,
// 까마귀는 큰까마귀 연속 사진 한 벌을 세 장면이 모두 덮는 몸에 글이 들게 맞춘다 — 글자 크기는 앉을 때와 같다.
// 고른 과정과 버린 것은 design/landscape.md '새', 기억 bird-photo-silhouette. 재료는 design/bird-photo.
//
// cloud.ts에 기대지 않는다(cloud.ts가 이것을 부른다) — 여백 · 값은 인자로 받는다.
import { BIRD_PHOTOS, RAVEN_FLY, type BirdShape } from './birdPhoto.data';

type Pt = [number, number];
type Pts = readonly (readonly [number, number])[];

export interface BirdOptions {
  /** 글만 키우는 배수 — 새가 품는 네모 = (글 + 여백) ÷ text. 1.6 ~ 1.9 격자에서 1.65(디자이너) */
  text: number;
  /** 새의 긴 쪽 상한(글자 칸 1배 기준 u) — 넘는 새는 벽 한 칸에 맞추느라 글이 작아진다. 구름과 같은 18 */
  cap: number;
  /** 후보 — 상한 안의 새, 그리고 벽 글자가 가장 큰 새의 이 몫 아래로 줄지 않는 새(긴 쪽 ≤ 가장 짧은 긴 쪽 ÷ near).
      구름처럼 '상한 안, 모자라면 가장 짧은 넷'으로 두니 글 200개에서 넷이 90%를 썼다(까마귀 c470은 0번) — 0.7에서
      고른 새가 거의 다 쓰이고 벽 글자 가운데는 1~1.6px만 작다(2026-10-01, 디자이너 '중간') */
  near: number;
}

export interface BirdBuilt {
  id: string;
  kind: 'round' | 'crow';
  /** 머리가 오른쪽이면 1(뒤집은 뒤) */
  face: 1 | -1;
  /** 상자 = 앉은 새 전체(u, 글자 칸 text배 기준) */
  w: number; h: number;
  /** 앉은 윤곽(u, 상자 왼쪽 위가 원점) */
  pts: Pt[];
  /** 글 상자(u) — 글 + 여백을 품는 자리의 가운데 */
  text: { x: number; y: number; w: number; h: number };
  /** 날갯짓 세 장면(u, 같은 원점). 상자 밖으로 나간다 */
  fly: { up: Pt[]; mid: Pt[]; down: Pt[] };
  /** 글자 칸 배수(= text) — cloudShape의 scale로 넘긴다 */
  scale: number;
}

// 칸 격자 — 윤곽 점으로 칠한다(칸의 가운데가 안이면 안). 한 칸 깎은 안의 누적합으로 '네모 안에 밖이 몇 칸인가'를 잰다
type Grid = { W: number; H: number; sat: Int32Array; cx: number; cy: number; x0: number; y0: number; x1: number; y1: number };
const GRIDS = new Map<string, Grid>();

function raster(polys: readonly Pts[], W: number, H: number): Uint8Array {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    const yc = y + 0.5;
    let first = true, row: Uint8Array | null = null;
    for (const P of polys) {
      const xs: number[] = [];
      for (let i = 0, n = P.length; i < n; i++) {
        const [ax, ay] = P[i], [bx, by] = P[(i + 1) % n];
        if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      const r = new Uint8Array(W);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const a = Math.max(0, Math.ceil(xs[k] - 0.5)), b = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
        for (let x = a; x <= b; x++) r[x] = 1;
      }
      // 여러 윤곽이면 모두가 덮는 칸만(큰까마귀 세 장면의 겹친 몸)
      if (first) { row = r; first = false; } else for (let x = 0; x < W; x++) row![x] &= r[x];
    }
    if (row) out.set(row, y * W);
  }
  return out;
}

function gridOf(key: string, polys: readonly Pts[], W: number, H: number): Grid {
  const had = GRIDS.get(key);
  if (had) return had;
  const inn = raster(polys, W, H);
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : inn[y * W + x]);
  const sat = new Int32Array((W + 1) * (H + 1));
  let sx = 0, sy = 0, n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      const v = at(x, y), safe = v && at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1);
      row += safe ? 0 : 1;
      sat[(y + 1) * (W + 1) + x + 1] = sat[y * (W + 1) + x + 1] + row;
      if (v) { sx += x + 0.5; sy += y + 0.5; n++; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1); }
    }
  }
  const g = { W, H, sat, cx: sx / Math.max(1, n), cy: sy / Math.max(1, n), x0, y0, x1, y1 };
  GRIDS.set(key, g);
  return g;
}

function outsideIn(g: Grid, x: number, y: number, w: number, h: number): number {
  const W1 = g.W + 1;
  return g.sat[(y + h) * W1 + x + w] - g.sat[y * W1 + x + w] - g.sat[(y + h) * W1 + x] + g.sat[y * W1 + x];
}

/** 네모(가로 ÷ 세로 = asp)가 드는 가장 큰 자리 — 무게중심에 가장 가까운 곳. shrink = 칸을 그만큼 줄여 잡는다 */
function fitIn(g: Grid, asp: number, shrink = 0): { x: number; y: number; w: number; h: number } | null {
  const fits = (h: number) => {
    const w = Math.round(h * asp);
    if (w < 1 || w > g.W || h > g.H) return false;
    for (let y = 0; y + h <= g.H; y++) for (let x = 0; x + w <= g.W; x++) if (!outsideIn(g, x, y, w, h)) return true;
    return false;
  };
  let lo = 0, hi = g.H + 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (fits(m)) lo = m; else hi = m; }
  if (lo < 2) return null;
  const h = Math.max(2, Math.floor(lo * 0.97) - shrink), w = Math.max(1, Math.round(h * asp));
  let bx = -1, by = -1, best = Infinity;
  for (let y = 0; y + h <= g.H; y++) for (let x = 0; x + w <= g.W; x++) {
    if (outsideIn(g, x, y, w, h)) continue;
    const d = (x + w / 2 - g.cx) ** 2 + (y + h / 2 - g.cy) ** 2;
    if (d < best) { best = d; bx = x; by = y; }
  }
  return bx < 0 ? null : { x: bx, y: by, w, h };
}

function inside(x: number, y: number, P: Pts): boolean {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** 네모(칸 좌표)의 둘레가 모두 윤곽 안인가 — 칸 격자는 윤곽보다 거칠다(구름에서 200개 중 5~15개가 걸렸다) */
function ringIn(x0: number, y0: number, x1: number, y1: number, polys: readonly Pts[]): boolean {
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    for (const [x, y] of [[x0 + (x1 - x0) * t, y0], [x1, y0 + (y1 - y0) * t], [x0 + (x1 - x0) * t, y1], [x0, y0 + (y1 - y0) * t]] as Pt[])
      if (!polys.every((P) => inside(x, y, P))) return false;
  }
  return true;
}

type Fit = { upp: number; cx: number; cy: number };
/** 글 + 여백 네모(RW × RH, 글자 칸 1배 u)를 윤곽들(모두가 덮는 곳)에 — 칸 하나가 몇 u인가 · 네모의 가운데(칸 좌표) */
function fitBox(key: string, polys: readonly Pts[], W: number, H: number, RW: number, RH: number): Fit | null {
  const g = gridOf(key, polys, W, H);
  for (let shrink = 0; shrink <= 8; shrink++) {
    const f = fitIn(g, RW / RH, shrink);
    if (!f) return null;
    const upp = RH / f.h, cx = f.x + f.w / 2, cy = f.y + f.h / 2, hw = RW / 2 / upp, hh = RH / 2 / upp;
    if (ringIn(cx - hw, cy - hh, cx + hw, cy + hh, polys) || shrink === 8) return { upp, cx, cy };
  }
  return null;
}

function spanOf(P: Pts): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of P) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return [x0, y0, x1, y1];
}

/**
 * 새 한 마리 — TW × TH = 글 상자(글자 칸 u), pad = 글 둘레 여백(u), manner 0 = 귀여운(둥근 새) · 1 = 시니컬한(까마귀).
 * R = 글이 씨앗인 난수(같은 글은 언제나 같은 새 · 같은 쪽).
 */
export function birdFor(manner: number, TW: number, TH: number, pad: number, R: () => number, o: BirdOptions): BirdBuilt | null {
  const kind = manner === 1 ? 'crow' : 'round';
  const RW = TW + 2 * pad, RH = TH + 2 * pad;
  const each: { s: BirdShape; f: Fit; long: number }[] = [];
  for (const s of BIRD_PHOTOS) {
    if (s.kind !== kind) continue;
    const f = fitBox(s.id, [s.pts], s.w, s.h, RW, RH);
    if (!f) continue;
    const [x0, y0, x1, y1] = spanOf(s.pts);
    each.push({ s, f, long: Math.max(x1 - x0, y1 - y0) * f.upp });
  }
  if (!each.length) return null;
  const shortest = Math.min(...each.map((e) => e.long));
  const pool = each.filter((e) => e.long <= Math.max(o.cap, shortest / o.near));
  const { s, f } = pool[Math.floor(R() * pool.length)];
  const flip = R() < 0.5;

  // 칸 좌표 → u(글자 칸 text배). 상자는 앉은 새 전체, 뒤집기는 글의 가운데를 축으로(글은 제자리 · 새만 거울)
  const k = f.upp / o.text, [bx0, by0, bx1, by1] = spanOf(s.pts);
  const mx = flip ? 2 * f.cx : 0;
  const box0 = flip ? mx - bx1 : bx0;
  const map = (P: Pts): Pt[] => P.map(([x, y]): Pt => [((flip ? mx - x : x) - box0) * k, (y - by0) * k]);
  const tcx = (f.cx - box0) * k, tcy = (f.cy - by0) * k;
  const text = { x: tcx - TW / 2, y: tcy - TH / 2, w: TW, h: TH };
  let fly: BirdBuilt['fly'];
  if (s.fly) fly = { up: map(s.fly.up), mid: map(s.fly.mid), down: map(s.fly.down) };
  else {
    // 까마귀 — 덩치를 지킨다: 큰까마귀 수평 장면의 넓이 = 앉은 까마귀의 넓이. 글을 품게 키웠더니 긴 글에서 날아오르는 순간
    // 새가 1.9배까지 커졌다(글 200개, 2026-10-01 디자이너 '덩치'). 글의 가운데는 세 장면이 모두 덮는 몸에서 글 + 여백이 드는
    // 자리의 가운데에 — 나는 동안 글이 몸 안에 남는 몫은 가운데 94%, 가장 적을 때 61%. 머리는 앉은 새와 같은 쪽
    const r = fitBox('raven', [RAVEN_FLY.up, RAVEN_FLY.mid, RAVEN_FLY.down], RAVEN_FLY.w, RAVEN_FLY.h, RW, RH);
    const area = (P: Pts) => { let a = 0; for (let i = 0, n = P.length; i < n; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % n]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; };
    const kr = k * Math.sqrt(area(s.pts) / area(RAVEN_FLY.mid));
    const rcx = r ? r.cx : RAVEN_FLY.w / 2, rcy = r ? r.cy : RAVEN_FLY.h / 2;
    const face = (flip ? -s.face : s.face) as 1 | -1, turn = face === 1;          // 큰까마귀는 머리가 왼쪽
    const mapR = (P: Pts): Pt[] => P.map(([x, y]): Pt => [tcx + (turn ? rcx - x : x - rcx) * kr, tcy + (y - rcy) * kr]);
    fly = { up: mapR(RAVEN_FLY.up), mid: mapR(RAVEN_FLY.mid), down: mapR(RAVEN_FLY.down) };
  }
  return {
    id: s.id, kind, face: (flip ? -s.face : s.face) as 1 | -1,
    w: (bx1 - bx0) * k, h: (by1 - by0) * k, pts: map(s.pts), text, fly, scale: o.text
  };
}
