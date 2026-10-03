import { useEffect, useRef } from 'react';
import type { Cloud, StoneTex } from '../lib/cloud';
import { STONE_PHOTOS, type StoneShape } from '../lib/stonePhoto.data';

/** 캔버스의 해상도 상한(기기 px 배수) — 나무와 같다 */
const DPR_MAX = 2;
/** 그늘을 셈하는 칸 격자 — 벽 한 변에 몇 칸인가(벽 1920×1080에서 css 1px에 0.8칸). 그늘은 3칸 넘게 뭉개 쓰니 이 정도면 된다 */
const GRID_PER_SIDE = 320;
/** 기울기가 이만큼(라디안) 바뀌어야 그늘을 다시 셈한다 — 벽 기계(파이)가 매 순간 셈하지 않게 */
const TURN_STEP = (2 * Math.PI) / 180;
/** 한 프레임에 다시 셈하는 데 쓰는 시간(ms) — 여럿이 한꺼번에 기울어도 그 프레임이 무거워지지 않게 나눈다(적어도 하나는 한다) */
const FRAME_BUDGET = 5;

/* ─── 결 재료(scripts/stones/export.py — R 잔 결 + 128 · G 큰 명암 · B 돌 안) ───────────────────────────── */
type Tex = { w: number; h: number; det: Float32Array; low: Float32Array };
const TEX = new Map<string, Promise<Tex>>();
function texOf(url: string): Promise<Tex> {
  let p = TEX.get(url);
  if (!p) {
    p = new Promise<Tex>((ok, no) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(img, 0, 0);
        const d = x.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height;
        const det = new Float32Array(n), low = new Float32Array(n);
        for (let i = 0; i < n; i++) { det[i] = d[i * 4] - 128; low[i] = d[i * 4 + 1]; }
        ok({ w: c.width, h: c.height, det, low });
      };
      img.onerror = no;
      img.src = url;
    });
    TEX.set(url, p);
  }
  return p;
}
/** 토큰 색(--ink 등)을 [r, g, b](0~255)로 — '#rrggbb' · 'rgb(r g b)' · 'rgb(r, g, b)' */
function cssRgb(v: string): [number, number, number] {
  const t = v.trim();
  if (/^#[0-9a-f]{6}$/i.test(t)) return [parseInt(t.slice(1, 3), 16), parseInt(t.slice(3, 5), 16), parseInt(t.slice(5, 7), 16)];
  const m = t.match(/\d+(\.\d+)?/g);
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : [0, 0, 0];
}
/** 0~1 자리에서 겹선형으로 */
function sample(a: Float32Array, w: number, h: number, u: number, v: number): number {
  const x = Math.min(w - 1, Math.max(0, u * (w - 1))), y = Math.min(h - 1, Math.max(0, v * (h - 1)));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = x - x0, fy = y - y0;
  return (a[y0 * w + x0] * (1 - fx) + a[y0 * w + x1] * fx) * (1 - fy) + (a[y1 * w + x0] * (1 - fx) + a[y1 * w + x1] * fx) * fy;
}

/* ─── 잡음 · 뭉개기 · 조각 ─────────────────────────────────────────────────────────────── */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** 가우스 뭉개기 — 상자 흐림 세 번(제자리) */
function blur(a: Float32Array, w: number, h: number, sigma: number) {
  const r = Math.max(0, Math.round((Math.sqrt((12 * sigma * sigma) / 3 + 1) - 1) / 2));
  if (!r) return;
  const tmp = new Float32Array(Math.max(w, h)), n = 2 * r + 1;
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < h; y++) {
      const o = y * w; let s = 0;
      for (let k = -r; k <= r; k++) s += a[o + Math.min(w - 1, Math.max(0, k))];
      for (let x = 0; x < w; x++) { tmp[x] = s / n; s += a[o + Math.min(w - 1, x + r + 1)] - a[o + Math.max(0, x - r)]; }
      for (let x = 0; x < w; x++) a[o + x] = tmp[x];
    }
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let k = -r; k <= r; k++) s += a[Math.min(h - 1, Math.max(0, k)) * w + x];
      for (let y = 0; y < h; y++) { tmp[y] = s / n; s += a[Math.min(h - 1, y + r + 1) * w + x] - a[Math.max(0, y - r) * w + x]; }
      for (let y = 0; y < h; y++) a[y * w + x] = tmp[y];
    }
  }
}
/** 결의 폭 sigma(칸)의 잡음 — 표준편차 1 */
function noise(w: number, h: number, sigma: number, seed: number): Float32Array {
  const R = rng(seed), a = new Float32Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = R() + R() + R() - 1.5;
  blur(a, w, h, sigma);
  let s = 0;
  for (const v of a) s += v * v;
  const k = 1 / Math.max(1e-6, Math.sqrt(s / a.length));
  for (let i = 0; i < a.length; i++) a[i] *= k;
  return a;
}
/** 이어진 덩이(네 방향)마다 넓이를 세어 min보다 작은 것을 판단한다 — keep(덩이 넓이, 가장자리에 닿았나) */
function pieces(on: Uint8Array, w: number, h: number, edge: Uint8Array | null, keep: (n: number, touch: boolean) => boolean): Uint8Array {
  const out = new Uint8Array(on.length), seen = new Uint8Array(on.length), q = new Int32Array(on.length);
  for (let i = 0; i < on.length; i++) {
    if (!on[i] || seen[i]) continue;
    let head = 0, tail = 0, touch = false; q[tail++] = i; seen[i] = 1;
    while (head < tail) {
      const j = q[head++], x = j % w, y = (j - x) / w;
      if (edge && edge[j]) touch = true;
      if (x > 0 && on[j - 1] && !seen[j - 1]) { seen[j - 1] = 1; q[tail++] = j - 1; }
      if (x < w - 1 && on[j + 1] && !seen[j + 1]) { seen[j + 1] = 1; q[tail++] = j + 1; }
      if (y > 0 && on[j - w] && !seen[j - w]) { seen[j - w] = 1; q[tail++] = j - w; }
      if (y < h - 1 && on[j + w] && !seen[j + w]) { seen[j + w] = 1; q[tail++] = j + w; }
    }
    if (keep(tail, touch)) for (let k = 0; k < tail; k++) out[q[k]] = 1;
  }
  return out;
}
function quantile(v: number[], p: number): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
}

/* ─── 준비 — 돌 하나의 판(크기가 바뀔 때만) ─────────────────────────────────────────────── */
type Prep = {
  tx: StoneTex; gw: number; gh: number; gs: number; cw: number; ch: number; dpr: number;
  inside: Uint8Array; rim: Uint8Array; Lrest: Float32Array; fx: Float32Array; fy: Float32Array; fade: Float32Array; edge: Float32Array;
  lo: number; hi: number; kL: number; thr: number; areaUp: number; sigma: number;
  path: Path2D; color: string; ink: readonly [number, number, number]; ctx: CanvasRenderingContext2D;
  P: number; wp: number; n1: Float32Array; n2: Float32Array; n3: Float32Array; A1: number; A2: number; wv: number;
};

/**
 * 그늘을 셈한다 — 쉬는 밝기에 기울기만큼 빛을 고쳐 얹고(벽의 빛 하나), 뭉개서 어두운 q를 그늘로, 작은 조각을 걷고 작은 틈을 메우고,
 * 글 둘레를 걷는다(scripts의 격자와 같은 차례 — 디자이너가 고른 판)
 */
function region(p: Prep, a: number): Uint8Array {
  const { tx, gw, gh } = p, n = gw * gh, c = Math.cos(a), s = Math.sin(a), [lx, ly] = tx.light;
  const d = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!p.inside[i]) continue;
    const fx = p.fx[i], fy = p.fy[i];
    const L = p.Lrest[i] + p.kL * ((c * fx - s * fy - fx) * lx + (s * fx + c * fy - fy) * ly);
    d[i] = Math.min(1, Math.max(0, (p.hi - L) / (p.hi - p.lo))) ** tx.gamma;
  }
  blur(d, gw, gh, p.sigma);
  const on = new Uint8Array(n);
  for (let i = 0; i < n; i++) on[i] = p.inside[i] && d[i] + tx.edge * p.edge[i] > p.thr ? 1 : 0;
  const lim = tx.drop * p.areaUp;
  let r = pieces(on, gw, gh, null, (k) => k >= lim);
  // 틈 메우기 — 그늘 안의 작은 빈 곳(돌 가장자리에 닿지 않은 것만)
  const hole = new Uint8Array(n);
  for (let i = 0; i < n; i++) hole[i] = p.inside[i] && !r[i] ? 1 : 0;
  const fill = pieces(hole, gw, gh, p.rim, (k, touch) => k < lim && !touch);
  for (let i = 0; i < n; i++) r[i] = r[i] || fill[i] ? (p.fade[i] > 0.5 ? 1 : 0) : 0;
  r = pieces(r, gw, gh, null, (k) => k >= lim * 0.5);
  return r;
}

function draw(p: Prep, a: number) {
  const { ctx, cw, ch, dpr, gw, gh, gs } = p;
  const r = region(p, a);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = p.color;
  ctx.fill(p.path);
  // 그늘이 있는 칸의 테두리만 훑는다(돌 전체를 훑으면 셈이 두 배)
  let ga = gw, gb = -1, ha = gh, hb = -1;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (r[y * gw + x]) { if (x < ga) ga = x; if (x > gb) gb = x; if (y < ha) ha = y; if (y > hb) hb = y; }
  if (gb < 0) return;
  const xa = Math.max(0, Math.floor(((ga - 1) / gs) * dpr)), xb = Math.min(cw, Math.ceil(((gb + 2) / gs) * dpr));
  const ya = Math.max(0, Math.floor(((ha - 1) / gs) * dpr)), yb = Math.min(ch, Math.ceil(((hb + 2) / gs) * dpr)), bw = xb - xa;
  if (bw <= 0 || yb <= ya) return;
  const img = ctx.getImageData(xa, ya, bw, yb - ya), px = img.data;
  const c = Math.cos(a), s = Math.sin(a), ox = cw / 2, oy = ch / 2, cell = dpr / gs, P = p.P, SQ = Math.SQRT1_2;
  for (let y = ya; y < yb; y++) {
    const gy = ((y + 0.5) / dpr) * gs - 0.5, y0 = Math.max(0, Math.min(gh - 1, Math.floor(gy))), y1 = Math.min(gh - 1, y0 + 1), fy = Math.min(1, Math.max(0, gy - y0));
    for (let x = xa; x < xb; x++) {
      const i = ((y - ya) * bw + (x - xa)) * 4;
      if (!px[i + 3]) continue;
      const gx = ((x + 0.5) / dpr) * gs - 0.5, x0 = Math.max(0, Math.min(gw - 1, Math.floor(gx))), x1 = Math.min(gw - 1, x0 + 1), fx = Math.min(1, Math.max(0, gx - x0));
      const v = (r[y0 * gw + x0] * (1 - fx) + r[y0 * gw + x1] * fx) * (1 - fy) + (r[y1 * gw + x0] * (1 - fx) + r[y1 * gw + x1] * fx) * fy;
      const rc = Math.min(1, Math.max(0, (v - 0.5) * cell + 0.5));
      if (!rc) continue;
      // 빗금은 화면에 늘 ／ — 돌이 기운 만큼 거꾸로 돌린 자리에서 줄을 긋는다
      const dx = x - ox, dy = y - oy, k = y * cw + x;
      const u = c * dx - s * dy + s * dx + c * dy + p.A1 * p.n1[k] + p.A2 * p.n2[k];
      const ph = ((u % P) + P) % P, wl = p.wp * (1 + p.wv * p.n3[k]);
      const sd = (ph >= wl ? Math.min(ph - wl, P - ph) : -Math.min(wl - ph, ph)) * SQ;
      const cut = rc * Math.min(1, Math.max(0, sd + 0.5));
      // 빗금의 검은 줄은 오려 낸 틈이 아니라 칠한 검정(--ink) — 뒤의 나무 기둥이 비치지 않는다(2026-10-04, 디자이너)
      if (cut) { const k = 1 - cut; px[i] = px[i] * k + p.ink[0] * cut; px[i + 1] = px[i + 1] * k + p.ink[1] * cut; px[i + 2] = px[i + 2] * k + p.ink[2] * cut; }
    }
  }
  ctx.putImageData(img, xa, ya);
}

/** 윤곽의 구불구불 — 변을 step마다 촘촘히 하고 바깥 · 안으로 민다(낮은 결 + 0.35 × 잔 결). 밑변(배가 없을 때 y = base)과 그 둘레는 곧게 */
function wobble(pts: readonly (readonly [number, number])[], base: number, belly: boolean, amp: number, step: number, g1: number, g2: number, seed: number): [number, number][] {
  const P: [number, number][] = [], flat: boolean[] = [];
  for (let i = 0; i < pts.length; i++) {
    const A = pts[i], B = pts[(i + 1) % pts.length], L = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.max(1, Math.round(L / step));
    const onBase = !belly && Math.abs(A[1] - base) < 1e-3 && Math.abs(B[1] - base) < 1e-3;
    for (let k = 0; k < n; k++) { P.push([A[0] + ((B[0] - A[0]) * k) / n, A[1] + ((B[1] - A[1]) * k) / n]); flat.push(onBase); }
  }
  const N = P.length, R = rng(seed);
  const line = (sig: number) => {
    const a = new Float32Array(N), k = Math.max(1, Math.round(sig / step));
    const raw = Float32Array.from({ length: N }, () => R() + R() + R() - 1.5);
    for (let i = 0; i < N; i++) { let s = 0; for (let j = -2 * k; j <= 2 * k; j++) s += raw[(i + j + N) % N] * Math.exp(-0.5 * (j / k) ** 2); a[i] = s; }
    let v = 0; for (const x of a) v += x * x; const f = 1 / Math.max(1e-6, Math.sqrt(v / N));
    return a.map((x) => x * f);
  };
  const n1 = line(g1), n2 = line(g2);
  return P.map(([x, y], i): [number, number] => {
    if (flat[i] || (!belly && base - y < 2 * step)) return [x, y];
    const a = P[(i - 1 + N) % N], b = P[(i + 1) % N], tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty) || 1;
    const off = (n1[i] + 0.35 * n2[i]) * amp;
    return [x + (ty / l) * off, y - (tx / l) * off];
  });
}

function prepare(cloud: Cloud, shape: StoneShape, tex: Tex, tx: StoneTex, uPx: number, side: number, dpr: number, color: string, cv: HTMLCanvasElement): Prep {
  const st = cloud.stone!, ph = st.photo!, seed = hash(`${cloud.text.w}|${cloud.text.h}|${ph.id}|${ph.flip}`);
  const base = ph.base, upper = st.pts.filter(([, y]) => y <= base + 1e-6);
  const X0 = Math.min(...upper.map((p) => p[0])), X1 = Math.max(...upper.map((p) => p[0])), Y0 = Math.min(...upper.map((p) => p[1]));
  const maxY = Math.max(...st.pts.map((p) => p[1])), belly = maxY > base + 1e-3, ratio = belly ? (maxY - base) / (base - Y0) : 0;
  // 윤곽 — 구불구불은 벽 한 변에 대한 길이라 u로 바꿔 민다
  const toU = side / uPx, out = wobble(st.pts, base, belly, tx.outline.amp * toU, tx.outline.step * toU, tx.outline.grain[0] * toU, tx.outline.grain[1] * toU, seed);
  // 캔버스 — 윤곽을 다 품게(css px, 상자 왼쪽 위 기준), 둘레 2px
  const xs = out.map((p) => p[0] * uPx), ys = out.map((p) => p[1] * uPx), M = 2;
  const minX = Math.min(...xs) - M, minY = Math.min(...ys) - M, maxX = Math.max(...xs) + M, maxYp = Math.max(...ys) + M;
  const cw = Math.max(2, Math.ceil((maxX - minX) * dpr)), ch = Math.max(2, Math.ceil((maxYp - minY) * dpr));
  cv.width = cw; cv.height = ch;
  Object.assign(cv.style, { left: `${minX}px`, top: `${minY}px`, width: `${cw / dpr}px`, height: `${ch / dpr}px` });
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  const path = new Path2D();
  out.forEach(([x, y], i) => (i ? path.lineTo : path.moveTo).call(path, (x * uPx - minX) * dpr, (y * uPx - minY) * dpr));
  path.closePath();

  // 칸 격자 — 같은 윤곽을 칸으로 칠해 돌 안을 안다
  const gs = GRID_PER_SIDE / side, gw = Math.max(2, Math.ceil((maxX - minX) * gs)), gh = Math.max(2, Math.ceil((maxYp - minY) * gs)), n = gw * gh;
  const mc = document.createElement('canvas'); mc.width = gw; mc.height = gh;
  const mx = mc.getContext('2d', { willReadFrequently: true })!;
  mx.setTransform(gs / dpr, 0, 0, gs / dpr, 0, 0); mx.fillStyle = '#fff'; mx.fill(path);
  const md = mx.getImageData(0, 0, gw, gh).data, inside = new Uint8Array(n), rim = new Uint8Array(n);
  for (let i = 0; i < n; i++) inside[i] = md[i * 4 + 3] > 127 ? 1 : 0;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x;
    if (inside[i] && (x === 0 || y === 0 || x === gw - 1 || y === gh - 1 || !inside[i - 1] || !inside[i + 1] || !inside[i - gw] || !inside[i + gw])) rim[i] = 1;
  }
  const U = (gx: number) => (minX + (gx + 0.5) / gs) / uPx, V = (gy: number) => (minY + (gy + 0.5) / gs) / uPx;
  // 윗부분의 무게중심 · 열마다 윗선
  let sx = 0, sy = 0, sn = 0;
  const top = new Float32Array(gw).fill(Infinity);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x, v = V(y);
    if (!inside[i] || v > base) continue;
    sx += U(x); sy += v; sn++; if (v < top[x]) top[x] = v;
  }
  const cx = sx / Math.max(1, sn), cy = sy / Math.max(1, sn), D = 0.5 * (base - Y0);
  // 사진 밝기 — 잔 결은 돌과 함께 뒤집고, 큰 명암은 사진 빛이 벽과 같으면 그대로 · 반대면 거울로(벽의 빛은 오른쪽)
  const wallR = tx.light[0] > 0, mirrorLow = (shape.light === 'R') !== wallR;
  const Lsrc = new Float32Array(n), fxA = new Float32Array(n), fyA = new Float32Array(n), Lrest = new Float32Array(n), fsx = new Float32Array(n), fsy = new Float32Array(n);
  const ups: number[] = [];
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x;
    if (!inside[i]) continue;
    const u = U(x), v = V(y), under = v > base;
    const vs = under ? base - (v - base) / Math.max(1e-6, ratio) : v;
    const nx = (u - X0) / (X1 - X0), ny = (vs - Y0) / (base - Y0);
    Lsrc[i] = sample(tex.det, tex.w, tex.h, ph.flip ? 1 - nx : nx, ny) + sample(tex.low, tex.w, tex.h, mirrorLow ? 1 - nx : nx, ny);
    fsx[i] = (u - cx) / D; fsy[i] = (vs - cy) / D;
    if (!under) ups.push(Lsrc[i]);
  }
  const lo = quantile(ups, tx.lo), hi = Math.max(lo + 1, quantile(ups, tx.hi)), kL = tx.turn * (hi - lo), [lx, ly] = tx.light;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x;
    if (!inside[i]) continue;
    const v = V(y);
    // 배 — 밑변에서 비춘 윗자리의 '향하는 쪽'에서 시작해 깊어질수록 아래(0, 1)로(배는 바닥을 보는 면)
    const depth = ratio * (base - (Number.isFinite(top[x]) ? top[x] : Y0));
    const k = v > base ? Math.min(1, Math.max(0, (v - base) / Math.max(1e-6, 0.5 * depth))) : 0;
    fxA[i] = (1 - k) * fsx[i]; fyA[i] = (1 - k) * fsy[i] + k;
    Lrest[i] = Lsrc[i] + kL * ((fxA[i] - fsx[i]) * lx + (fyA[i] - fsy[i]) * ly);
  }
  // 글 둘레 — 줄마다 잉크 자리(글 상자 안, 걸기만큼 기운다)에서 em으로 잰 거리
  const t = cloud.text, rot = cloud.layout?.rotate ?? 0, rc = Math.cos(-rot), rs = Math.sin(-rot), tcx = t.x + t.w / 2, tcy = t.y + t.h / 2;
  const fade = new Float32Array(n), [f0, f1] = tx.fade;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x;
    if (!inside[i]) continue;
    const du = U(x) - tcx, dv = V(y) - tcy, qx = rc * du - rs * dv + t.w / 2, qy = rs * du + rc * dv + t.h / 2;
    let dmin = Infinity;
    for (const [a0, b0, a1, b1] of ph.lines) dmin = Math.min(dmin, Math.hypot(Math.max(a0 - qx, 0, qx - a1), Math.max(b0 - qy, 0, qy - b1)));
    const z = Math.min(1, Math.max(0, (dmin / ph.em - f0) / f1));
    fade[i] = z * z * (3 - 2 * z);
  }
  const edge = noise(gw, gh, tx.edgeGrain * side * gs, seed + 7), sigma = tx.blur * side * gs;
  // 그늘 문턱 — 쉬는 자세의 윗부분에서 어두운 q
  const p0 = { tx, gw, gh, inside, Lrest, fx: fxA, fy: fyA, lo, hi, kL } as Prep;
  const d0 = new Float32Array(n);
  for (let i = 0; i < n; i++) if (inside[i]) d0[i] = Math.min(1, Math.max(0, (hi - Lrest[i]) / (hi - lo))) ** tx.gamma;
  blur(d0, gw, gh, sigma);
  const dd: number[] = [];
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) { const i = y * gw + x; if (inside[i] && V(y) <= base) dd.push(d0[i] + tx.edge * edge[i]); }
  const thr = Math.max(1e-3, quantile(dd, 1 - tx.q));
  // 빗금 — 줄 간격 · 칠 줄(검은 틈은 가장 굵게 gap, 글자 획의 ink배를 넘지 않게: 가는 글은 결도 가늘다)
  const wallPx = (side * dpr) / 401.76, P = tx.hatch.period * side * dpr;
  const gap = Math.min(tx.hatch.gap * side * dpr, Math.SQRT2 * tx.hatch.ink * ph.ink * uPx * dpr);
  const [g1, g2, g3] = tx.hatch.grain, [a1, a2, wv] = tx.hatch.wob;
  return {
    ...p0, gs, cw, ch, dpr, rim, fade, edge, thr, areaUp: sn, sigma, path, color, ctx,
    ink: cssRgb(getComputedStyle(document.documentElement).getPropertyValue('--ink')),
    P, wp: Math.max(0.2 * wallPx, P - gap), n1: noise(cw, ch, g1 * side * dpr, seed + 11), n2: noise(cw, ch, g2 * side * dpr, seed + 12),
    n3: noise(cw, ch, g3 * side * dpr, seed + 13), A1: a1 * side * dpr, A2: a2 * side * dpr, wv
  };
}

/* ─── 벽에서 기울 때 — 프레임 루프(WallSimulation)가 돌의 각도를 알려 준다 ───────────────────────── */
const LEAN = new WeakMap<Element, (a: number) => void>();
/** 벽의 돌 요소(.wall-block)가 기운 각도(라디안, 시계 방향 +) — 그 안의 결이 2° 넘게 바뀌었을 때만 다시 셈한다 */
export function stoneLean(el: Element, a: number) { LEAN.get(el)?.(a); }
const QUEUE = new Set<() => void>();
let qRaf = 0;
function drain() {
  qRaf = 0;
  const t0 = performance.now();
  for (const f of QUEUE) { QUEUE.delete(f); f(); if (performance.now() - t0 >= FRAME_BUDGET) break; }
  if (QUEUE.size) qRaf = requestAnimationFrame(drain);
}
function enqueue(f: () => void) { QUEUE.add(f); if (!qRaf) qRaf = requestAnimationFrame(drain); }

/**
 * 차분한의 사진 돌을 그린다(2026-10-04 빗금 결) — 칠 한 색 위에 사진의 어두운 면을 나무와 같은 ／ 빗금으로(검은 줄은 --ink로
 * 칠한다 — 나무처럼 오려 내면 뒤의 나무 기둥이 비쳤다), 윤곽은 미세하게
 * 구불구불. 상자 크기는 재서 안다(나무와 같다 — 글자 한 칸 u = 상자 폭 ÷ cloud.w). 벽에서 돌이 기울면 그늘이 빛을 따라 옮겨 간다
 */
export default function StoneArt({ cloud, unit, color }: { cloud: Cloud; unit: number; color: string }) {
  const wrap = useRef<HTMLDivElement>(null), out = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = wrap.current, cv = out.current, ph = cloud.stone?.photo, tx = cloud.persona.stone?.photo?.tex;
    const shape = ph && STONE_PHOTOS.find((s) => s.id === ph.id);
    if (!el || !cv || !ph || !tx || !shape) return;
    let alive = true, prep: Prep | null = null, tex: Tex | null = null, key = '', angle = 0, drawn = NaN;
    const host = el.closest('.wall-block');
    const paint = () => { if (!alive || !prep) return; draw(prep, angle); drawn = angle; };
    const lean = (a: number) => {
      angle = a;
      if (prep && !(Math.abs(Math.atan2(Math.sin(a - drawn), Math.cos(a - drawn))) < TURN_STEP)) enqueue(paint);
    };
    if (host) LEAN.set(host, lean);
    const build = () => {
      const w = el.clientWidth;
      if (!tex || w < 2) return;
      const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1), k = `${w}|${dpr}`;
      if (k === key) return;
      key = k;
      const uPx = w / cloud.w;
      prep = prepare(cloud, shape, tex, tx, uPx, uPx / unit, dpr, color, cv);
      paint();
    };
    const ro = new ResizeObserver(() => build());
    ro.observe(el);
    texOf(shape.tex).then((t) => { if (!alive) return; tex = t; build(); }).catch(() => {});
    return () => { alive = false; ro.disconnect(); QUEUE.delete(paint); if (host && LEAN.get(host) === lean) LEAN.delete(host); };
  }, [cloud, unit, color]);
  return <div ref={wrap} className="stone-art" aria-hidden="true"><canvas ref={out} /></div>;
}
