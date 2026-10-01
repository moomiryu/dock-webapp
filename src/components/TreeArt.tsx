import { useEffect, useRef } from 'react';
import type { Cloud } from '../lib/cloud';
import { TreePainter, rgb01, treeImage } from '../lib/treeGL';

/** 바람을 다시 그리는 간격 — 30fps(띠 구름과 같다). 잎이 --t-hold × 2에 한 결 지나갈 만큼 느려서 더 촘촘할 까닭이 없다 */
const FRAME_MS = 33;
/** 캔버스의 해상도 상한(기기 px 배수) — 레티나 3배까지 그리면 벽 나무 여럿을 파이가 못 따라온다 */
const DPR_MAX = 2;

/** 씨앗 → 0~1 (cloud.ts rng와 같은 꼴) */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
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
      for (const r of t.zones) rect(r, lr, lr);
      zc.filter = 'none'; zc.globalCompositeOperation = 'source-over';
      // 그릴 캔버스 — 상자 왼쪽 위에서 둘레 여유만큼 밖으로
      cv.width = tw + 2 * Math.round(M * dpr); cv.height = th + 2 * Math.round(M * dpr);
      Object.assign(cv.style, { left: `${-M}px`, top: `${-M}px`, width: `${cv.width / dpr}px`, height: `${cv.height / dpr}px` });
      painter?.dispose();
      painter = new TreePainter({
        tree, zone, out: cv, margin: Math.round(M * dpr), color: col, willow: t.species === 'willow',
        flutter: flutter * dpr, sway: sway * dpr, grain: pr.wind.grain * side * dpr,
        hatchPeriod: pr.hatch.period * side * dpr, hatchWidth: pr.hatch.width * side * dpr,
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
