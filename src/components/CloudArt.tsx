import { useEffect, useRef } from 'react';
import { photoWave, type Cloud, type CloudTex, type Photo } from '../lib/cloud';
import { blur, cssRgb, dequeue, distance, enqueue, hash, noise, pieces, quantile } from '../lib/hatch';

/** 캔버스의 해상도 상한(기기 px 배수) — 나무 · 돌과 같다 */
const DPR_MAX = 2;
/** 그늘을 셈하는 칸 격자 — 벽 한 변에 몇 칸인가. 그늘은 3.75px로 뭉개 쓰고 테두리는 칠할 때 곱게 이으니 돌(320)보다 성겨도 된다 —
    구름은 꼬리 · 떠가는 조각까지 품어 판이 넓다 */
const GRID_PER_SIDE = 200;
/** 윤곽을 다시 그리는 간격(ms) — CloudBubble의 한 색 구름과 같다 */
const FRAME_MS = 33;
/** 벽에서는 이 배율로 그려 둔다 — 카메라가 확대해 들어가면(.wall-world, WallSimulation ZOOM_K) 1배로 그린 그림을 늘리니 가장자리 ·
    빗금이 흐렸다(한 색 구름은 SVG라 늘 또렷했다). 카메라가 없는 벽에서는 1배 */
const WALL_ZOOM = 3;

type Ring = readonly (readonly [number, number])[];
type Bit = { img: HTMLCanvasElement; ox: number; oy: number; c0: readonly [number, number]; s0: number };
type Prep = {
  cw: number; ch: number; dpr: number; uPx: number; minX: number; minY: number;
  body: HTMLCanvasElement | null; bits: (Bit | null)[];
};

const mean = (r: Ring): [number, number] => [r.reduce((a, q) => a + q[0], 0) / r.length, r.reduce((a, q) => a + q[1], 0) / r.length];
const spread = (r: Ring, c: readonly [number, number]) => Math.sqrt(r.reduce((a, q) => a + (q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2, 0) / r.length);

/** 칸 판에 윤곽들을 칠해 안(1)을 안다 — at = u → 칸 좌표 */
function rasterize(rings: readonly Ring[], gw: number, gh: number, at: (x: number, y: number) => [number, number]): Uint8Array {
  const c = document.createElement('canvas'); c.width = gw; c.height = gh;
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.fillStyle = '#fff';
  x.beginPath();
  for (const r of rings) r.forEach(([u, v], i) => { const [a, b] = at(u, v); if (i) x.lineTo(a, b); else x.moveTo(a, b); });
  x.fill();
  const d = x.getImageData(0, 0, gw, gh).data, on = new Uint8Array(gw * gh);
  for (let i = 0; i < on.length; i++) on[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  return on;
}

/**
 * 밑 띠의 어두움(0~1) — 빛이 위에서 올 때: 기둥마다 위 · 옆 윤곽까지의 거리 ÷ (그것 + 밑까지의 거리). 판(m)은 빛이 위로 오게
 * 돌려 둔 것(격자 c1 · c2의 shade_up 그대로)
 */
function bandUp(m: Uint8Array, w: number, h: number, sigma: number, band: readonly [number, number]): Float32Array {
  const ext = new Uint8Array(w * h), base = new Int32Array(w).fill(-1);
  for (let x = 0; x < w; x++) {
    let top = -1;
    for (let y = 0; y < h; y++) if (m[y * w + x]) { if (top < 0) top = y; base[x] = y; }
    if (top >= 0) for (let y = top; y < h; y++) ext[y * w + x] = 1;
  }
  const dtop = distance(ext, w, h), t = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!ext[i]) continue;
    const db = Math.max(0, base[x] - y);
    t[i] = dtop[i] / (dtop[i] + db + 1e-3);
  }
  blur(t, w, h, sigma);
  const d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) {
    if (!m[i]) continue;
    const z = Math.min(1, Math.max(0, (t[i] - band[0]) / band[1]));
    d[i] = z * z * (3 - 2 * z);
  }
  return d;
}

/** 0~1 자리에서 겹선형으로(칸 좌표) */
function at2(a: Float32Array | Uint8Array, w: number, h: number, x: number, y: number): number {
  if (x < 0 || y < 0 || x > w - 1 || y > h - 1) return 0;
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), fx = x - x0, fy = y - y0;
  return (a[y0 * w + x0] * (1 - fx) + a[y0 * w + x1] * fx) * (1 - fy) + (a[y1 * w + x0] * (1 - fx) + a[y1 * w + x1] * fx) * fy;
}

/**
 * 결을 셈해 빗금 그림(몸통 하나 · 떨어진 조각마다 하나)으로 — 쉬는 윤곽에서 한 번. 차례는 격자(c1 · c4)와 같다: 밑 띠 → 뭉개기 + 테두리 잡음
 * → 어두운 q → 작은 조각 걷기 · 틈 메우기 → 글 둘레 걷기. 몸통 그늘은 윤곽이 부푸는 만큼 바깥으로 넓혀 둔다(그리는 순간의 윤곽으로 자른다)
 */
function build(cloud: Cloud, ph: Photo, tx: CloudTex, swell: number, uPx: number, side: number, dpr: number, minX: number, minY: number, cw: number, ch: number): Prep {
  const rings: Ring[] = [ph.pts, ...(ph.extra ?? [])];
  const seed = hash(`${cloud.text.w}|${cloud.text.h}|${ph.id}`);
  const gs = GRID_PER_SIDE / side, gw = Math.max(2, Math.ceil((cw / dpr) * gs)), gh = Math.max(2, Math.ceil((ch / dpr) * gs)), n = gw * gh;
  const G = (u: number, v: number): [number, number] => [(u * uPx - minX) * gs, (v * uPx - minY) * gs];
  const inside = rasterize(rings, gw, gh, G);
  const own = rings.map((r) => rasterize([r], gw, gh, G));
  // 빛이 위로 오게 돌린 판에서 밑 띠를 셈하고 되읽는다 — 돌린 판은 윤곽의 돌린 상자 + 둘레 2칸
  const th = Math.atan2(tx.light[0], -tx.light[1]), c = Math.cos(th), s = Math.sin(th);
  const R = (x: number, y: number): [number, number] => [x * c + y * s, -x * s + y * c];
  let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
  for (const r of rings) for (const [u, v] of r) { const [a, b] = R(...G(u, v)); rx0 = Math.min(rx0, a); rx1 = Math.max(rx1, a); ry0 = Math.min(ry0, b); ry1 = Math.max(ry1, b); }
  rx0 -= 3; ry0 -= 3; rx1 += 3; ry1 += 3;
  const rw = Math.ceil(rx1 - rx0), rh = Math.ceil(ry1 - ry0);
  const rm = rasterize(rings, rw, rh, (u, v) => { const [a, b] = R(...G(u, v)); return [a - rx0, b - ry0]; });
  const dr = bandUp(rm, rw, rh, tx.bandBlur * side * gs, tx.band);
  const d = new Float32Array(n);
  let area = 0;
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x;
    if (!inside[i]) continue;
    area++;
    const [a, b] = R(x + 0.5, y + 0.5);
    d[i] = at2(dr, rw, rh, a - rx0 - 0.5, b - ry0 - 0.5);
  }
  // 뭉개고 테두리를 거칠게, 어두운 q를 그늘로
  blur(d, gw, gh, tx.blur * side * gs);
  const edge = noise(gw, gh, tx.edgeGrain * side * gs, seed + 7), dd: number[] = [];
  for (let i = 0; i < n; i++) if (inside[i]) { d[i] += tx.edge * edge[i]; dd.push(d[i]); }
  const thr = Math.max(1e-3, quantile(dd, 1 - tx.q)), lim = tx.drop * area;
  const on = new Uint8Array(n);
  for (let i = 0; i < n; i++) on[i] = inside[i] && d[i] > thr ? 1 : 0;
  let r = pieces(on, gw, gh, null, (k) => k >= lim);
  // 틈 메우기 — 그늘 안의 작은 빈 곳(구름 가장자리에 닿지 않은 것만)
  const rim = new Uint8Array(n), hole = new Uint8Array(n);
  for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
    const i = y * gw + x;
    if (inside[i] && (x === 0 || y === 0 || x === gw - 1 || y === gh - 1 || !inside[i - 1] || !inside[i + 1] || !inside[i - gw] || !inside[i + gw])) rim[i] = 1;
    hole[i] = inside[i] && !r[i] ? 1 : 0;
  }
  const fill = pieces(hole, gw, gh, rim, (k, touch) => k < lim && !touch);
  // 글 둘레 — 글자 한 자씩의 네모(가운데 ± 0.45em)에서 em으로 잰 거리
  const em = ph.ink?.em ?? 1, glyph = new Uint8Array(n).fill(1), hw = 0.45 * em;
  for (const [u, v] of ph.chars) {
    const [a0, b0] = G(u - hw, v - hw), [a1, b1] = G(u + hw, v + hw);
    for (let y = Math.max(0, Math.floor(b0)); y <= Math.min(gh - 1, Math.ceil(b1)); y++)
      for (let x = Math.max(0, Math.floor(a0)); x <= Math.min(gw - 1, Math.ceil(a1)); x++) glyph[y * gw + x] = 0;
  }
  const gd = distance(glyph, gw, gh), emCells = em * uPx * gs, [f0, f1] = tx.fade;
  const far = (i: number) => { const z = Math.min(1, Math.max(0, (gd[i] / emCells - f0) / f1)); return z * z * (3 - 2 * z) > 0.5; };
  for (let i = 0; i < n; i++) r[i] = (r[i] || fill[i]) && far(i) ? 1 : 0;
  r = pieces(r, gw, gh, null, (k) => k >= lim * 0.5);

  // 빗금 — 줄 간격 · 칠 줄. 검은 틈은 가장 굵게 gap, 글자 획의 ink배를 넘지 않게(x + y로 잰다 — 격자 c3 · c4 그대로)
  const wallPx = (side * dpr) / 401.76, P = tx.hatch.period * side * dpr;
  const gap = Math.min(tx.hatch.gap * side * dpr, tx.hatch.ink * (ph.ink?.ink ?? 0.05 * em) * uPx * dpr);
  const wp = Math.max(0.2 * wallPx, P - gap), [g1, g2, g3] = tx.hatch.grain, [a1, a2, wv] = tx.hatch.wob;
  const A1 = a1 * side * dpr, A2 = a2 * side * dpr, ink = cssRgb(getComputedStyle(document.documentElement).getPropertyValue('--ink'));
  const cell = dpr / gs, SQ = Math.SQRT1_2;
  /** 칸 판 reg의 그늘을 빗금 그림으로 — 그 그늘의 상자만큼(기기 px) */
  let nth = 0;
  const paint = (reg: Uint8Array): { img: HTMLCanvasElement; ox: number; oy: number } | null => {
    let ga = gw, gb = -1, ha = gh, hb = -1;
    for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) if (reg[y * gw + x]) { if (x < ga) ga = x; if (x > gb) gb = x; if (y < ha) ha = y; if (y > hb) hb = y; }
    if (gb < 0) return null;
    const xa = Math.max(0, Math.floor(((ga - 1) / gs) * dpr)), xb = Math.min(cw, Math.ceil(((gb + 2) / gs) * dpr));
    const ya = Math.max(0, Math.floor(((ha - 1) / gs) * dpr)), yb = Math.min(ch, Math.ceil(((hb + 2) / gs) * dpr)), bw = xb - xa, bh = yb - ya;
    if (bw <= 0 || bh <= 0) return null;
    const img = document.createElement('canvas'); img.width = bw; img.height = bh;
    const ctx = img.getContext('2d')!, id = ctx.createImageData(bw, bh), px = id.data, sd0 = seed + 11 + 3 * nth++;
    // 줄의 흔들림 잡음 — 이 그늘 상자만큼만(판 전체로 만들면 벽의 3배 그림에서 무거웠다)
    const n1 = noise(bw, bh, g1 * side * dpr, sd0), n2 = noise(bw, bh, g2 * side * dpr, sd0 + 1), n3 = noise(bw, bh, g3 * side * dpr, sd0 + 2);
    for (let y = ya; y < yb; y++) {
      const gy = ((y + 0.5) / dpr) * gs - 0.5;
      for (let x = xa; x < xb; x++) {
        const gx = ((x + 0.5) / dpr) * gs - 0.5, v = at2(reg, gw, gh, gx, gy);
        const rc = Math.min(1, Math.max(0, (v - 0.5) * cell + 0.5));
        if (!rc) continue;
        const k = (y - ya) * bw + (x - xa), u = x + y + A1 * n1[k] + A2 * n2[k];
        const ph2 = ((u % P) + P) % P, wl = wp * (1 + wv * n3[k]);
        const sd = (ph2 >= wl ? Math.min(ph2 - wl, P - ph2) : -Math.min(wl - ph2, ph2)) * SQ;
        const cut = rc * Math.min(1, Math.max(0, sd + 0.5));
        if (!cut) continue;
        // 검은 줄은 칠한 검정(--ink) — 돌과 같다
        const o = ((y - ya) * bw + (x - xa)) * 4;
        px[o] = ink[0]; px[o + 1] = ink[1]; px[o + 2] = ink[2]; px[o + 3] = Math.round(255 * cut);
      }
    }
    ctx.putImageData(id, 0, 0);
    return { img, ox: xa, oy: ya };
  };
  // 몸통 — 부푸는 만큼(swell u) 바깥으로 넓혀 둔다: 쉬는 윤곽 밖에서 그늘에 가까운 칸
  const bodyR = new Uint8Array(n);
  for (let i = 0; i < n; i++) bodyR[i] = r[i] && own[0][i] ? 1 : 0;
  const notR = new Uint8Array(n);
  for (let i = 0; i < n; i++) notR[i] = bodyR[i] ? 0 : 1;
  const toR = distance(notR, gw, gh), reach = swell * uPx * gs;
  for (let i = 0; i < n; i++) if (!bodyR[i] && !inside[i] && toR[i] <= reach) bodyR[i] = 1;
  const body = paint(bodyR);
  const bits = rings.slice(1).map((ring, j): Bit | null => {
    const reg = new Uint8Array(n);
    for (let i = 0; i < n; i++) reg[i] = r[i] && own[j + 1][i] ? 1 : 0;
    const got = paint(reg);
    if (!got) return null;
    const c0 = mean(ring);
    return { ...got, c0, s0: spread(ring, c0) };
  });
  // 몸통 그림은 판 전체 크기로 옮겨 둔다(그릴 때 0, 0에)
  let bodyImg: HTMLCanvasElement | null = null;
  if (body) { bodyImg = document.createElement('canvas'); bodyImg.width = cw; bodyImg.height = ch; bodyImg.getContext('2d')!.drawImage(body.img, body.ox, body.oy); }
  return { cw, ch, dpr, uPx, minX, minY, body: bodyImg, bits };
}

/** 그 순간의 윤곽들(u)을 그린다 — 칠 한 색, 그 안에서만 빗금(몸통은 제자리, 조각은 제 빗금을 들고 떠간다) */
function drawAt(ctx: CanvasRenderingContext2D, rings: readonly Ring[], base: readonly Ring[], g: { cw: number; ch: number; dpr: number; uPx: number; minX: number; minY: number }, color: string, p: Prep | null) {
  const { cw, ch, dpr, uPx, minX, minY } = g, X = (u: number) => (u * uPx - minX) * dpr, Y = (v: number) => (v * uPx - minY) * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, cw, ch);
  const path = new Path2D();
  for (const r of rings) { r.forEach(([u, v], i) => (i ? path.lineTo(X(u), Y(v)) : path.moveTo(X(u), Y(v)))); path.closePath(); }
  ctx.fillStyle = color;
  ctx.fill(path);
  if (!p) return;
  ctx.save();
  ctx.clip(path);
  if (p.body) ctx.drawImage(p.body, 0, 0);
  p.bits.forEach((b, j) => {
    const now = rings[j + 1], was = base[j + 1];
    if (!b || !now || !was) return;
    const ct = mean(now), k = b.s0 > 1e-6 ? spread(now, ct) / b.s0 : 1;
    ctx.setTransform(k, 0, 0, k, X(ct[0]) - k * X(b.c0[0]), Y(ct[1]) - k * Y(b.c0[1]));
    ctx.drawImage(b.img, b.ox, b.oy);
  });
  ctx.restore();
}

/**
 * 다정한의 띠 구름을 그린다(2026-10-04 빗금 결) — 칠 한 색 위에 밑 띠의 그늘을 나무 · 돌과 같은 ／ 빗금으로(검은 줄은 --ink로
 * 칠한다). 결은 쉬는 윤곽에서 한 번 셈해(프레임마다 나눠 — hatch.ts의 줄) 그려 두고, 숨 쉬듯 부푸는 윤곽(photoWave)으로 그 순간마다
 * 자른다 — 그늘이 있는 밑은 거의 안 움직이는 자리라 결이 제자리에 있다. 떨어진 조각은 제 빗금을 들고 떠간다. 상자 크기는 재서 안다
 * (돌과 같다 — 글자 한 칸 u = 상자 폭 ÷ cloud.w). 꼬리 · 조각은 상자 밖으로 그려진다
 */
export default function CloudArt({ cloud, unit, color, quiet, hold }: { cloud: Cloud; unit: number; color: string; quiet: boolean; hold: number }) {
  const wrap = useRef<HTMLDivElement>(null), out = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = wrap.current, cv = out.current, ph = cloud.photo, tx = cloud.persona.photo?.tex, motion = cloud.persona.photo?.motion;
    if (!el || !cv || !ph || !tx) return;
    const base: Ring[] = [ph.pts, ...(ph.extra ?? [])];
    let alive = true, key = '', prep: Prep | null = null, geo: Omit<Prep, 'body' | 'bits'> | null = null, now: readonly Ring[] = base, job: (() => void) | null = null;
    const ctx = cv.getContext('2d')!;
    const paint = () => { if (alive && geo) drawAt(ctx, now, base, geo, color, prep); };
    const size = () => {
      const w = el.clientWidth;
      if (w < 2) return;
      const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1) * (el.closest('.wall-world') ? WALL_ZOOM : 1), k = `${w}|${dpr}`;
      if (k === key) return;
      key = k;
      const uPx = w / cloud.w, side = uPx / unit, M = ((motion?.billow ?? 0) + 0.5) * uPx;
      // 판 — 꼬리 · 떠가는 조각(photo.x0 · x1) · 부풂까지 품게(css px, 상자 왼쪽 위 기준)
      const ys = base.flat().map((q) => q[1] * uPx);
      const minX = Math.min(ph.x0 * uPx, ...base.flat().map((q) => q[0] * uPx)) - M, maxX = Math.max(ph.x1 * uPx, ...base.flat().map((q) => q[0] * uPx)) + M;
      const minY = Math.min(...ys) - M, maxY = Math.max(...ys) + M;
      const cw = Math.max(2, Math.ceil((maxX - minX) * dpr)), ch = Math.max(2, Math.ceil((maxY - minY) * dpr));
      cv.width = cw; cv.height = ch;
      Object.assign(cv.style, { left: `${minX}px`, top: `${minY}px`, width: `${cw / dpr}px`, height: `${ch / dpr}px` });
      geo = { cw, ch, dpr, uPx, minX, minY };
      prep = null;
      paint();                                                       // 결을 셈하는 동안에도 칠은 보인다
      if (job) dequeue(job);
      job = () => { if (!alive || !geo) return; prep = build(cloud, ph, tx, motion?.billow ?? 0, uPx, side, dpr, minX, minY, cw, ch); paint(); };
      enqueue(job);
    };
    const ro = new ResizeObserver(() => size());
    ro.observe(el);
    size();
    // 움직임 — CloudBubble의 한 색 구름과 같은 박자(시작 박자는 구름마다 글 상자 · 띠 번호에서)
    let raf = 0;
    if (motion && !quiet) {
      const phase = (cloud.text.w * 7.31 + cloud.text.h * 3.17 + ph.id.charCodeAt(ph.id.length - 1) * 1.7) % (Math.PI * 2);
      const wave = photoWave(ph, cloud.w, motion, phase), t0 = performance.now();
      let last = -Infinity;
      const tick = (t: number) => {
        if (t - last >= FRAME_MS) { last = t; now = wave((t - t0) / 1000, hold); paint(); }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    return () => { alive = false; ro.disconnect(); cancelAnimationFrame(raf); if (job) dequeue(job); };
  }, [cloud, unit, color, quiet, hold]);
  return <div ref={wrap} className="cloud-hatch" aria-hidden="true"><canvas ref={out} /></div>;
}
