import { useEffect, useRef } from 'react';
import type { Cloud } from '../lib/cloud';
import { TreePainter, rgb01, treeImage } from '../lib/treeGL';
import { blur } from '../lib/hatch';

/** 바람을 다시 그리는 간격 — 30fps(띠 구름과 같다). 잎이 --t-hold × 2에 한 결 지나갈 만큼 느려서 더 촘촘할 까닭이 없다 */
const FRAME_MS = 33;
/** 캔버스의 해상도 상한(기기 px 배수) — 레티나 3배까지 그리면 벽 나무 여럿을 파이가 못 따라온다 */
const DPR_MAX = 2;

/** 씨앗 → 0~1 (cloud.ts rng와 같은 꼴) */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** 행마다 켜진 칸에서 가장 가까운 꺼진 칸까지의 가로 거리 */
function runH(on: Uint8Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let c = 0;
    for (let x = 0; x < w; x++) { const i = y * w + x; c = on[i] ? c + 1 : 0; out[i] = c; }
    c = 0;
    for (let x = w - 1; x >= 0; x--) { const i = y * w + x; c = on[i] ? c + 1 : 0; out[i] = Math.min(out[i], c); }
  }
  return out;
}
/** 열마다 — 그 세로 토막의 아래 끝까지 거리(below) · 토막 길이(len) */
function runV(on: Uint8Array, w: number, h: number): { below: Float32Array; len: Float32Array } {
  const below = new Float32Array(w * h), len = new Float32Array(w * h);
  for (let x = 0; x < w; x++) {
    let c = 0;
    for (let y = h - 1; y >= 0; y--) { const i = y * w + x; c = on[i] ? c + 1 : 0; below[i] = c; }
    c = 0;
    for (let y = 0; y < h; y++) { const i = y * w + x; c = on[i] ? c + 1 : 0; len[i] = on[i] ? c + below[i] - 1 : 0; }
  }
  return { below, len };
}
/**
 * 그늘 띠의 마감(2026-10-04, 디자이너 — "'직선형'으로 마감되는 부분이 너무 거슬린다", 격자 design/landscape-tree-tex-ends.png ·
 * -fill.png에서 '다 둥글게' + "그 위에서 시작했으면 그 밑에는 모두 빗금"). 재료의 그늘(빨강)은 세로줄마다 칠해 띠 끝이 세로로, 윗변이 밑선을
 * 그대로 올린 가로로 끊겼다. 나무를 그릴 때 한 번:
 *   ① 윗변을 둥근 봉우리로 잇고(dd × 1.3 간격) 띠 끝을 반원으로
 *   ② 큰 띠(칠의 1% 넘는)에서 덩이 밑자락(작은 틈을 메운 칠의 세로 토막에서 아래 끝까지 dd × 봉우리)을 따라 실루엣 끝까지 잇는다.
 *      밑자락이 그 띠의 윗선보다 위에서 끝나는 가지는 통째로 뺀다(윗선에서 가로로 자르면 다시 직선이 났다)
 *   ③ 띠에서 아래로 끊기지 않고 이어진 칠(잎 끝)도 그늘 — 버드나무 가닥은 이 뒤에 늘어뜨려 그늘을 이어받는다
 *   ④ 칠 안에서 끝나는 곳(줄기와 만나는 자리)만 둥글게 — 실루엣 바깥 끝은 끝까지(빈틈을 남기지 않는다)
 * 땅에 닿는 열(줄기)은 건드리지 않는다. dd = 수관 키의 7%(재료의 '덩이 밑선 위 키의 7%'), close = 작은 틈을 메우는 뭉갬(px)
 */
function finishShade(tc: CanvasRenderingContext2D, tw: number, th: number, dd: number, close: number) {
  const img = tc.getImageData(0, 0, tw, th), d = img.data, n = tw * th;
  const m = new Uint8Array(n), sh = new Uint8Array(n);
  let area = 0;
  for (let i = 0; i < n; i++) { const g = d[i * 4 + 1], r = d[i * 4]; m[i] = g > 127 ? 1 : 0; sh[i] = r > 0.5 * g && g > 51 ? 1 : 0; area += m[i]; }
  const ground = new Uint8Array(tw);
  for (let x = 0; x < tw; x++) for (let y = Math.max(0, th - 3); y < th; y++) if (m[y * tw + x]) { ground[x] = 1; break; }
  const bump = (x: number) => { const p = ((x / (1.3 * dd)) % 1) * 2 - 1; return 0.55 + 0.45 * Math.sqrt(Math.max(0, 1 - p * p)); };
  const cap = (dx: number) => { const q = 1 - Math.min(1, dx / dd); return Math.sqrt(Math.max(0, 1 - q * q)); };
  // ① 윗변 · 띠 끝
  { const dx = runH(sh, tw, th), { below, len } = runV(sh, tw, th);
    for (let i = 0; i < n; i++) if (sh[i] && below[i] - 1 > len[i] * cap(dx[i]) * bump(i % tw) + 0.5) sh[i] = 0; }
  // ② 밑자락
  const cf = new Float32Array(n);
  for (let i = 0; i < n; i++) cf[i] = m[i];
  blur(cf, tw, th, close);
  const closed = new Uint8Array(n);
  for (let i = 0; i < n; i++) closed[i] = m[i] || cf[i] > 0.5 ? 1 : 0;
  const cb = runV(closed, tw, th).below, zone = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const x = i % tw; zone[i] = m[i] && !ground[x] && cb[i] <= dd * bump(x) ? 1 : 0; }
  // 띠 덩이(여덟 방향) — 넓이와 윗선
  const lab = new Int32Array(n).fill(-1), q = new Int32Array(n), tops: number[] = [], sizes: number[] = [];
  for (let i = 0; i < n; i++) {
    if (!sh[i] || lab[i] >= 0) continue;
    const id = sizes.length; let head = 0, tail = 0, top = th; q[tail++] = i; lab[i] = id;
    while (head < tail) {
      const j = q[head++], x = j % tw, y = (j - x) / tw; top = Math.min(top, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy, k = yy * tw + xx;
        if ((dx || dy) && xx >= 0 && yy >= 0 && xx < tw && yy < th && sh[k] && lab[k] < 0) { lab[k] = id; q[tail++] = k; }
      }
    }
    sizes.push(tail); tops.push(top);
  }
  const out = new Uint8Array(n), seen = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (sh[i] && sizes[lab[i]] < 0.01 * area) out[i] = 1;   // 작은 조각은 그대로
  for (let c = 0; c < sizes.length; c++) {
    if (sizes[c] < 0.01 * area) continue;
    seen.fill(0);
    let head = 0, tail = 0;
    for (let i = 0; i < n; i++) if (lab[i] === c) { q[tail++] = i; seen[i] = 1; }
    while (head < tail) {
      const j = q[head++]; out[j] = 1;
      const x = j % tw, y = (j - x) / tw;
      for (const k of [x > 0 ? j - 1 : -1, x < tw - 1 ? j + 1 : -1, y > 0 ? j - tw : -1, y < th - 1 ? j + tw : -1]) {
        if (k < 0 || seen[k]) continue;
        const ky = (k - (k % tw)) / tw;
        if ((zone[k] || lab[k] === c) && ky + cb[k] - 1 >= tops[c]) { seen[k] = 1; q[tail++] = k; }
      }
    }
  }
  // ③ 아래로 이어진 칠 · 줄기는 그대로
  for (let x = 0; x < tw; x++) {
    let carry = 0;
    for (let y = 0; y < th; y++) { const i = y * tw + x; carry = out[i] || (carry && m[i]) ? 1 : 0; if (carry && m[i]) out[i] = 1; }
    if (ground[x]) for (let y = 0; y < th; y++) out[y * tw + x] = sh[y * tw + x];
  }
  // ④ 칠 안에서 끝나는 곳만 둥글게
  const open = new Uint8Array(n);
  for (let i = 0; i < n; i++) open[i] = out[i] || !m[i] ? 1 : 0;
  const dx2 = runH(open, tw, th), { below: b2, len: l2 } = runV(out, tw, th);
  for (let i = 0; i < n; i++) {
    const keep = out[i] && b2[i] - 1 <= l2[i] * cap(dx2[i]) + 0.5;
    d[i * 4] = keep ? d[i * 4 + 1] : 0;
  }
  tc.putImageData(img, 0, 0);
}
/**
 * 버드나무 가닥 — 수관을 가닥(한 가닥 1~2 CSS px, 사이 0~1px) 단위로 아래로 끌어내린다. 글이 씨앗이라 같은 글은 같은 가닥
 * (2026-09-30, 디자이너 — 격자에서 고른 scripts/trees/shape.py drape를 옮겼다). 가닥 길이 = 가장 긴 길이(L × 나무 키) ×
 * 줄기에서 멀수록(가까우면 짧다 — 커튼이 열려 기둥이 보인다) × 가닥마다 0.35~1 × 무리(느린 흔들림, 5px 결). 땅에 닿는
 * 열(줄기)은 늘어뜨리지 않는다. 가닥은 그 위 칠의 그늘을 이어받는다(그늘 띠 아래로 늘어진 가닥은 빗금 — 끝까지)
 */
function drape(tc: CanvasRenderingContext2D, tw: number, th: number, seed: number, L: number, s: number) {
  const img = tc.getImageData(0, 0, tw, th), d = img.data, R = rng(seed);
  const paint = new Uint8Array(tw * th), shade = new Uint8Array(tw * th);
  let top = th;
  for (let i = 0; i < tw * th; i++) { paint[i] = d[i * 4 + 1] > 127 ? 1 : 0; shade[i] = d[i * 4] > 127 ? 1 : 0; if (paint[i]) top = Math.min(top, Math.floor(i / tw)); }
  const ground = new Uint8Array(tw);
  let gs = 0, gn = 0;
  for (let x = 0; x < tw; x++) for (let y = Math.max(0, th - 3); y < th; y++) if (paint[y * tw + x]) { ground[x] = 1; gs += x; gn++; break; }
  const xt = gn ? gs / gn : tw / 2, Ht = th - top;
  // 무리 — 열마다 난수를 5px 결로 흐리게(상자 흐림 세 번 ≈ 가우스), 0~1로
  let env = Float32Array.from({ length: tw }, () => R());
  const r = Math.max(1, Math.round(5 * s * 1.1));
  for (let pass = 0; pass < 3; pass++) {
    const nx = new Float32Array(tw);
    for (let x = 0; x < tw; x++) { let a = 0, n = 0; for (let k = x - r; k <= x + r; k++) if (k >= 0 && k < tw) { a += env[k]; n++; } nx[x] = a / n; }
    env = nx;
  }
  let lo = Infinity, hi = -Infinity;
  for (const v of env) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const len = new Float32Array(tw), int = (a: number, b: number) => a + Math.floor(R() * (b - a + 1));
  for (let x = 0; x < tw;) {
    const ww = int(Math.max(1, Math.round(s)), Math.max(1, Math.round(2 * s)));
    const near = Math.min(1, Math.abs(x - xt) / tw / 0.22) ** 1.5;
    const v = L * Ht * near * (0.35 + 0.65 * R()) * (0.5 + 0.5 * ((env[x] - lo) / Math.max(1e-6, hi - lo)));
    for (let k = x; k < Math.min(tw, x + ww); k++) len[k] = ground[k] ? 0 : v;
    x += ww + int(0, Math.max(0, Math.round(s)));
  }
  for (let x = 0; x < tw; x++) {
    if (!len[x]) continue;
    let run = 1e9, sh = 0;
    for (let y = 0; y < th; y++) {
      const i = y * tw + x;
      if (paint[i]) { run = 0; sh = shade[i]; continue; }
      run++;
      if (run <= len[x] && y > top) { d[i * 4 + 1] = 255; d[i * 4] = sh ? 255 : 0; }
    }
  }
  tc.putImageData(img, 0, 0);
}

/**
 * 당당한의 사진 나무(cloud.ts · treeFor)를 그린다 — 말풍선 상자(.cloud-bubble)를 가득 채우는 자리에 캔버스 하나를 두고,
 * 나무 전체(상자 밑으로 이어지는 줄기까지)를 그린다. 상자 크기는 재서 안다(한 변이 CSS 길이라 JS가 모른다) — 글자 한 칸(u)이
 * 몇 px인가 = 상자 폭 ÷ cloud.w. 칠 · 빗금 · 바람은 treeGL. 움직임을 끈 사람 · still(4/5 설명 장의 시연)에서는 멈춘 한 장.
 */
export default function TreeArt({ cloud, unit, color, quiet, hold }: { cloud: Cloud; unit: number; color: string; quiet: boolean; hold: number }) {
  const wrap = useRef<HTMLDivElement>(null), out = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const el = wrap.current, cv = out.current, t = cloud.tree, pr = cloud.persona.tree;
    if (!el || !cv || !t || !pr) return;
    let alive = true, raf = 0, painter: TreePainter | null = null, img: HTMLImageElement | null = null, key = '';
    const col = rgb01(color);
    // 나무마다 다른 시작 — 벽의 나무들이 한 바람에 똑같이 흔들리지 않게(글 상자 크기 · 나무 번호에서)
    const phase = (cloud.text.w * 7.31 + cloud.text.h * 3.17 + t.id.length * 1.7 + t.id.charCodeAt(t.id.length - 1) * 0.37) % (Math.PI * 2);

    const build = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!img || w < 2 || h < 2) return;
      const dpr = Math.min(DPR_MAX, window.devicePixelRatio || 1);
      const uPx = w / cloud.w, side = uPx / unit, fullPx = uPx * t.full;
      const flutter = pr.wind.flutter * side, sway = pr.wind.sway * fullPx;
      const M = quiet ? 2 : Math.ceil(flutter + sway) + 4;                    // 캔버스 둘레 여유(CSS px)
      const k = `${w}|${h}|${dpr}|${quiet}`;
      if (k === key && painter) return;
      key = k;
      // 나무 판 — 받은 판(키 1280)을 이 나무의 크기로 한 번 줄여 둔다
      const tw = Math.max(1, Math.round(w * dpr)), th = Math.max(1, Math.round(fullPx * dpr));
      const tree = document.createElement('canvas'); tree.width = tw; tree.height = th;
      const tc = tree.getContext('2d', { willReadFrequently: true })!;
      tc.imageSmoothingEnabled = true; tc.imageSmoothingQuality = 'high';
      // 뒤집기 · 폭 늘이기(cloud.ts treeFor) — 상자 폭이 곧 늘인 나무 폭이라 그대로 채우면 늘어난다
      if (t.flip) tc.setTransform(-1, 0, 0, 1, tw, 0);
      // 줄기만 늘이기(cloud.ts treeFor) — 판을 세 토막으로: 줄기 구간(y0~y1)만 k배로 늘여 그리고, 그 위아래는 그대로
      const iw = img.width, ih = img.height, row = (v: number) => (v / t.base) * ih, dev = (v: number) => Math.round(v * uPx * dpr);
      const { y0, y1, k: kT } = t.trunk, d0 = dev(y0), d1 = dev(y0 + (y1 - y0) * kT);
      tc.drawImage(img, 0, 0, iw, row(y0), 0, 0, tw, d0);
      tc.drawImage(img, 0, row(y0), iw, row(y1) - row(y0), 0, d0, tw, d1 - d0);
      tc.drawImage(img, 0, row(y1), iw, ih - row(y1), 0, d1, tw, th - d1);
      tc.setTransform(1, 0, 0, 1, 0, 0);
      // 그늘 띠의 마감(둥근 봉우리 · 밑자락 끝까지) — 가닥을 늘어뜨리기 전에(가닥이 그늘을 이어받는다). 수관의 세로 배율로 잰다
      const sv = row(y0) > 0 ? d0 / row(y0) : th / ih;
      finishShade(tc, tw, th, 0.07 * ih * sv, 0.012 * ih * sv);
      // 가닥 길이는 늘이기 전의 키에 대어(줄기가 길어져도 가닥이 따라 길어지지 않게)
      if (t.drape) drape(tc, tw, th, t.drape.seed, (t.drape.L * t.base) / t.full, dpr);
      // 글자 자리 판 — 초록 = 바람을 멈추는 곳(글자 + 여백 + 가장 크게 밀리는 만큼, 흐리게), 빨강 = 빗금을 걷는 곳(둥글게)
      const zone = document.createElement('canvas'); zone.width = tw; zone.height = th;
      const zc = zone.getContext('2d', { willReadFrequently: true })!, s = uPx * dpr;
      const rect = (r: readonly number[], e: number, rad: number) => { zc.beginPath(); zc.roundRect(r[0] * s - e, r[1] * s - e, (r[2] - r[0]) * s + 2 * e, (r[3] - r[1]) * s + 2 * e, rad); zc.fill(); };
      if (!quiet) {
        const e = (pr.gap * uPx + flutter + sway) * dpr;
        zc.filter = `blur(${(8 * side * dpr) / 401.76}px)`; zc.fillStyle = 'rgb(0,255,0)';
        for (const r of t.zones) rect(r, e, 0);
      }
      const lr = pr.lift * s;
      zc.globalCompositeOperation = 'lighter'; zc.filter = `blur(${(0.6 * lr).toFixed(2)}px)`; zc.fillStyle = 'rgb(255,0,0)';
      // 빗금을 걷는 곳 — 글자마다 원을 이은 둥근 물결(2026-10-04, 디자이너 '다 둥글게'). 둥근 네모였을 때 빗금 위가 가로로 끊겼다.
      // 줄 네모(t.zones)를 줄 높이만큼씩 나눠 그 가운데에 원 하나 — 글자 하나에 원 하나쯤
      for (const r of t.zones) {
        const em = r[3] - r[1], k = Math.max(1, Math.round((r[2] - r[0]) / (0.9 * em))), cy = ((r[1] + r[3]) / 2) * s;
        for (let j = 0; j < k; j++) { zc.beginPath(); zc.arc((r[0] + ((j + 0.5) * (r[2] - r[0])) / k) * s, cy, 0.62 * em * s + lr, 0, 2 * Math.PI); zc.fill(); }
      }
      zc.filter = 'none'; zc.globalCompositeOperation = 'source-over';
      // 그릴 캔버스 — 상자 왼쪽 위에서 둘레 여유만큼 밖으로
      cv.width = tw + 2 * Math.round(M * dpr); cv.height = th + 2 * Math.round(M * dpr);
      Object.assign(cv.style, { left: `${-M}px`, top: `${-M}px`, width: `${cv.width / dpr}px`, height: `${cv.height / dpr}px` });
      painter?.dispose();
      painter = new TreePainter({
        tree, zone, out: cv, margin: Math.round(M * dpr), color: col, willow: t.species === 'willow',
        flutter: flutter * dpr, sway: sway * dpr, grain: pr.wind.grain * side * dpr,
        hatchPeriod: pr.hatch.period * side * dpr, hatchWidth: pr.hatch.width * side * dpr,
        hatchWob: [(pr.hatch.wob?.[0] ?? 0) * side * dpr, (pr.hatch.wob?.[1] ?? 0) * side * dpr, pr.hatch.wob?.[2] ?? 0],
        hatchGrain: [(pr.hatch.grain?.[0] ?? 1) * side * dpr, (pr.hatch.grain?.[1] ?? 1) * side * dpr, (pr.hatch.grain?.[2] ?? 1) * side * dpr],
        hold, pass: pr.wind.pass, swayTurn: pr.wind.swayTurn, gust: pr.wind.gust, phase
      });
      painter.draw(0, !quiet);
    };

    const t0 = performance.now();
    let last = -Infinity;
    const tick = (now: number) => {
      if (painter?.moving && now - last >= FRAME_MS) { last = now; painter.draw((now - t0) / 1000); }
      raf = requestAnimationFrame(tick);
    };
    const ro = new ResizeObserver(() => build());
    ro.observe(el);
    treeImage(t.img).then((i) => { if (!alive) return; img = i; build(); if (!quiet) raf = requestAnimationFrame(tick); }).catch(() => {});
    return () => { alive = false; ro.disconnect(); cancelAnimationFrame(raf); painter?.dispose(); };
  }, [cloud, unit, color, quiet, hold]);
  return <div ref={wrap} className="tree-art" aria-hidden="true"><canvas ref={out} /></div>;
}
