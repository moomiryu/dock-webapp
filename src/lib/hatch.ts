/**
 * 빗금 결의 부품 — 사진 형상(돌 StoneArt · 구름 CloudArt) 위에 나무와 같은 ／ 빗금으로 음영을 입힐 때 같이 쓴다(2026-10-04,
 * 스킬 photo-hatch). 칸 격자 위의 셈(뭉개기 · 잡음 · 덩이 · 거리)과, 무거운 셈을 프레임마다 나눠 하는 줄.
 */

/** 토큰 색(--ink 등)을 [r, g, b](0~255)로 — '#rrggbb' · 'rgb(r g b)' · 'rgb(r, g, b)' */
export function cssRgb(v: string): [number, number, number] {
  const t = v.trim();
  if (/^#[0-9a-f]{6}$/i.test(t)) return [parseInt(t.slice(1, 3), 16), parseInt(t.slice(3, 5), 16), parseInt(t.slice(5, 7), 16)];
  const m = t.match(/\d+(\.\d+)?/g);
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : [0, 0, 0];
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
/** 가우스 뭉개기 — 상자 흐림 세 번(제자리) */
export function blur(a: Float32Array, w: number, h: number, sigma: number) {
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
export function noise(w: number, h: number, sigma: number, seed: number): Float32Array {
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
export function pieces(on: Uint8Array, w: number, h: number, edge: Uint8Array | null, keep: (n: number, touch: boolean) => boolean): Uint8Array {
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
export function quantile(v: number[], p: number): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))];
}
/** 칸마다 '꺼진 칸'까지의 거리(칸) — 켜진 칸(on)이 꺼진 칸에서 얼마나 떨어져 있나. 판 밖은 꺼진 칸으로 치지 않는다(Felzenszwalb) */
export function distance(on: Uint8Array, w: number, h: number): Float32Array {
  const INF = 1e12, f = new Float64Array(Math.max(w, h)), d = new Float64Array(Math.max(w, h)), v = new Int32Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1);
  const g = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) g[i] = on[i] ? INF : 0;
  const pass = (n: number, get: (k: number) => number, set: (k: number, x: number) => void) => {
    for (let k = 0; k < n; k++) f[k] = get(k);
    let j = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q] + q * q) - (f[v[j]] + v[j] * v[j])) / (2 * q - 2 * v[j]);
      while (s <= z[j]) { j--; s = ((f[q] + q * q) - (f[v[j]] + v[j] * v[j])) / (2 * q - 2 * v[j]); }
      j++; v[j] = q; z[j] = s; z[j + 1] = INF;
    }
    j = 0;
    for (let q = 0; q < n; q++) { while (z[j + 1] < q) j++; d[q] = (q - v[j]) * (q - v[j]) + f[v[j]]; }
    for (let k = 0; k < n; k++) set(k, d[k]);
  };
  for (let x = 0; x < w; x++) pass(h, (k) => g[k * w + x], (k, s) => { g[k * w + x] = s; });
  for (let y = 0; y < h; y++) pass(w, (k) => g[y * w + k], (k, s) => { g[y * w + k] = s; });
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(Math.min(g[i], INF));
  return out;
}

/* ─── 무거운 셈을 프레임마다 나눠서 — 여럿이 한꺼번에 셈해도 그 프레임이 무거워지지 않게(적어도 하나는 한다) ───── */
const FRAME_BUDGET = 5;
const QUEUE = new Set<() => void>();
let qRaf = 0;
function drain() {
  qRaf = 0;
  const t0 = performance.now();
  for (const f of QUEUE) { QUEUE.delete(f); f(); if (performance.now() - t0 >= FRAME_BUDGET) break; }
  if (QUEUE.size) qRaf = requestAnimationFrame(drain);
}
export function enqueue(f: () => void) { QUEUE.add(f); if (!qRaf) qRaf = requestAnimationFrame(drain); }
export function dequeue(f: () => void) { QUEUE.delete(f); }
