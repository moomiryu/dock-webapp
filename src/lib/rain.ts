/**
 * 유머있는 = 비(2026-10-04, 디자이너). 새 → 말을 거쳐 실루엣을 따라가지 않기로 했다 — 글자 하나하나를 선 원에 담아(①처럼) 구름에서
 * 내리는 빗방울로. 줄기는 75°로 오르는 계단(당당한 사선처럼 글자는 똑바로 선다 — 맨 앞 글자가 가장 아래여야 땅에 첫 글자부터 잠긴다).
 * 고른 값과 견본은 design/landscape.md '비' · design/landscape-drops.html. 모양(낱알)과 굵기는 palettes.ts의 RAIN_FACE · formFor.
 *
 * 여기에 있는 것: 빗방울의 치수 · 글자를 원 안에 놓는 자리(시각 보정) · 원 선과 명암을 그린 캔버스. 폰 미리보기(RainPreview)와
 * 벽이 같이 쓴다.
 */
import { cssRgb, noise } from './hatch';
import { RAIN_FACE, type RainShape } from './palettes';

/** 빗방울 — 원 지름 1.5em(글자 1em), 원 선 = 글자 획 0.078em(×1), 줄기 위 원 사이 0.06em, 띄어쓰기는 반 칸 */
export const DROP = { d: 1.5, ring: 0.078, gap: 0.06, space: 0.5 } as const;
/**
 * 줄기 — 각도 75°(A판: 빠르기와 상관없이 나란하다 — 각도까지 바꾸는 B판은 산만했다), 글자 하나가 지나는 시간 보통 0.6초 → 빠르게 0.35초
 * (빠르기 막대는 보통 ~ 빠르게, palettes.ts speedBarFor). 벽 글자는 28px(1080 높이 기준 — 22px은 프로젝터 흉내에서 선과 획이 녹았다)
 */
export const STREAM = { angle: 75, sec: [0.6, 0.35] as const, wallFs: 28 / 1080 } as const;
/** 글의 색 — 검정 위 선 · 글자로 어두웠던 옛 일렉트릭 · 마젠타(palettes-v2.ts가 2026-10-04에 밝혔다)를 벽에 떠 있는 옛 글에서도 밝힌 값으로 */
const LIFTED: Record<string, string> = { '#3A50A5': '#7591EC', '#86437F': '#C57DBC' };
export const rainColor = (bg: string) => LIFTED[bg.toUpperCase()] ?? bg;
/** speed(0.5 보통 ~ 1 빠르게)의 몫 0 ~ 1 */
export const fastOf = (speed?: number) => Math.min(1, Math.max(0, ((speed ?? 0.5) - 0.5) / 0.5));
export const secPerChar = (speed?: number) => STREAM.sec[0] + (STREAM.sec[1] - STREAM.sec[0]) * fastOf(speed);
/** 줄기가 내려가는 쪽(화면 좌표, y 아래로) — 왼쪽 아래 */
export const streamDir = (): [number, number] => { const r = (STREAM.angle * Math.PI) / 180; return [-Math.cos(r), Math.sin(r)]; };
/** 글의 빗방울 자리 — 줄기 위 거리(em). 맨 앞 글자가 0, 띄어쓰기는 반 칸만 비운다 */
export function slotsOf(text: string): { ch: string; at: number }[] {
  const step = DROP.d + DROP.gap, out: { ch: string; at: number }[] = [];
  let at = 0;
  for (const ch of text.replace(/\s+/g, ' ').trim()) {
    if (ch === ' ') { at += DROP.space * step; continue; }
    out.push({ ch, at }); at += step;
  }
  return out;
}

/**
 * 비눗방울(2026-10-06, 디자이너). 비의 줄기를 사선 덩어리로 바꿔 보다가 — 기울기 없이 왼쪽에서 오른쪽으로 읽히면 비 · 눈이 아니라
 * 비눗방울이라고 정했다(칠하지 않은 선 원 · 한쪽 음영 · 검은 바탕이 이미 그렇다. 장난 · 가벼움 · 덧없음). 글은 가로줄 — 왼쪽 위에서
 * 시작해 한 줄 7자 안에서 낱말 끝에 넘기고(그보다 긴 낱말만 끊는다), 방울 사이 0.15em(떠다녀도 서로 덜 닿게), 줄 간격 1.9em.
 * 미리보기는 멈춰서 글 전체를 한 화면에 담는다(그전 줄기는 위에서 계속 내려와 긴 글이 한 번에 안 보였다)
 */
export const BUBBLE = { line: 7, gap: 0.15, pitch: 1.9 } as const;
/** 글을 가로줄로 — 방울 가운데 자리(em, 첫 글자가 0 · 0, y 아래로). 띄어쓰기는 반 칸 */
export function bubbleLayout(text: string): { ch: string; x: number; y: number }[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' '), lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if ([...next].length <= BUBBLE.line) { cur = next; continue; }
    if (cur) lines.push(cur);
    cur = w;
    while ([...cur].length > BUBBLE.line) { lines.push([...cur].slice(0, BUBBLE.line).join('')); cur = [...cur].slice(BUBBLE.line).join(''); }
  }
  if (cur) lines.push(cur);
  const step = DROP.d + BUBBLE.gap, out: { ch: string; x: number; y: number }[] = [];
  lines.forEach((ln, j) => {
    let at = 0;
    for (const ch of ln) {
      if (ch === ' ') { at += DROP.space * step; continue; }
      out.push({ ch, x: at, y: j * BUBBLE.pitch });
      at += step;
    }
  });
  return out;
}
/**
 * 떠다니기 — 4/5 모양 칸(2026-10-06, 디자이너): 기본 · 둥실 · 흔들. 모든 방울이 **살랑**을 기본으로 갖고(읽는 차례를 따라 물결이
 * 지나간다 — 바람이 글을 훑는 것처럼), 둥실은 방울마다 따로 천천히 오르내림을, 흔들은 비눗방울 막처럼 가로 · 세로가 번갈아 늘었다
 * 줄었다 하는 떨림을 그 위에 더한다. 통통(차례로 튀기)은 뺐다. 박자는 --t-hold의 배수, 빠르기 막대가 빠를수록 박자가 빨라진다(빠르게 끝 1.6배).
 * 저장 값: 기본 = center(옛 왼쪽 · 가운데 · 오른쪽과 2026-10-04 ~ 06의 둥글 · 네모 · 뾰족도 기본으로 떠다닌다), 둥실 = float, 흔들 = wobble
 */
export type BubbleMotion = 'center' | 'float' | 'wobble';
export const bubbleMotionOf = (align?: string): BubbleMotion => (align === 'float' || align === 'wobble' ? align : 'center');
/** 방울 하나의 움직임 — i = 읽는 차례, t = 초, ph = 방울마다 다른 위상 둘, T = --t-hold(초). [가로 · 세로 밀림(em), 가로 · 세로 늘임] */
export function bubbleMove(m: BubbleMotion, i: number, t: number, ph: readonly [number, number], T: number, speed?: number): [number, number, number, number] {
  const k = 1 + 0.6 * fastOf(speed), w = (2 * Math.PI * t * k) / T;
  let dx = 0.04 * Math.cos(w / 4 - i * 0.55), dy = 0.14 * Math.sin(w / 4 - i * 0.55), sx = 1, sy = 1;
  if (m === 'float') { dx += 0.05 * Math.sin(w / 7 + ph[1]); dy += 0.13 * Math.sin(w / 4.5 + ph[0]); }
  if (m === 'wobble') { const q = Math.sin(w / 1.6 + ph[0]); sx = 1 + 0.05 * q; sy = 1 - 0.05 * q; }
  return [dx, dy, sx, sy];
}

/**
 * 명암 — 굵기 그러데이션(2026-10-04, 디자이너 '라' · 양 '나'). 우리 빗금 그대로(／, 줄 자리 흔들림 · 굵기 떨림 — cloud.ts tex.hatch와 같은 값)
 * 을 바탕이 검정이라 글의 색으로 긋고, 빛은 벽에 하나(오른쪽 위)라 왼쪽 아래가 굵고 오른쪽 위로 가며 가늘어져 사라진다.
 * 길이는 글자 크기의 몫이라 폰 · 벽이 같은 결이다 — 벽 28px에서 5px 칸 · 1.7px 줄. reach = 빛 쪽으로 더 들어오는 몫, gain = 가장 굵은 줄 배수.
 * 글자 잉크 상자 둘레 clear(em)는 비운다
 */
export const SHADE = {
  period: 5 / 28, width: 1.7 / 28, wob: [0.7 / 28, 0.2 / 28, 0.1] as const, grain: [6 / 28, 0.7 / 28, 4 / 28] as const,
  reach: 0.35, gain: 1.15, light: [0.6, -0.8] as const, clear: 0.08
} as const;

/* ─── 글자를 원 안에 놓는 자리 ───────────────────────────────────────────────────────────────────────────────
   핸드젯 한글은 탈네모틀이라 글자마다 잉크 높이가 0.49em(고 · 도) ~ 0.93em(늘 · 일)로 다르다. 글자 상자 가운데에 두면 위아래로 들쭉날쭉해서
   잉크를 재서 놓는다(2026-10-04, 디자이너가 고른 B): 가로 = 잉크 상자 가운데와 넓이 무게중심의 가운데, 세로도 같되 원의 광학 중심(지름의 2%
   위)에 둔다. **받침 글자(자소 셋)는 세로를 잉크 상자 가운데에**(②) — 받침 쪽이 무거워 무게중심 · 들어올림이 둘 다 위로 밀어 쏠렸다.
   기울인 글자는 기울인 모양으로 잰다. 재는 곳은 보이지 않는 캔버스 — 모양마다 낱알 축을 든 글꼴(FontFace)로 그려 화소를 센다. 글꼴 파일로
   잰 값과 0.005em 안(2026-10-04). 낱알 축을 캔버스에 주지 못하는 브라우저는 기본 낱알로 재는데, 그 차이는 0.02em 안이다 */
const FONT_URL = '/fonts/HandjetVF.woff2';
const FAMILY: Record<RainShape, string> = { round: 'MF Rain Round', square: 'MF Rain Square', pointy: 'MF Rain Pointy' };
let ready: Promise<void> | null = null;
/** 재는 글꼴 셋을 들인다 — 한 번만 */
export function rainFontsReady(): Promise<void> {
  if (ready) return ready;
  ready = Promise.all((Object.keys(FAMILY) as RainShape[]).map(async (k) => {
    const f = RAIN_FACE[k];
    const face = new FontFace(FAMILY[k], `url(${FONT_URL})`, { weight: '100 900', variationSettings: `"ELSH" ${f.elsh}, "ELGR" ${f.elgr}` } as FontFaceDescriptors);
    await face.load();
    document.fonts.add(face);
  })).then(() => document.fonts.load("100px 'Handjet'", '가')).then(() => undefined);
  return ready;
}
/** 줄 높이 1일 때 글자 상자 위에서 기준선까지(em) — 브라우저가 실제로 놓는 자리 */
let BASE = 0;
export function rainBaseline(family: string): number {
  if (BASE) return BASE;
  const box = document.createElement('div'), mark = document.createElement('span');
  box.style.cssText = `position:absolute;visibility:hidden;font:1000px/1 ${family};white-space:nowrap`;
  box.textContent = '가'; mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  box.append(mark); document.body.append(box);
  BASE = (mark.getBoundingClientRect().top - box.getBoundingClientRect().top) / 1000;
  box.remove();
  return BASE;
}
export interface Placed {
  /** 글자 원점(기준선 왼끝)이 원 상자(한 변 1.5em) 안에 놓일 자리(em) */
  tx: number; ty: number;
  /** 놓인 잉크 상자(원 상자 좌표, em) — 명암이 비울 자리 */
  box: [number, number, number, number];
}
const PLACED = new Map<string, Placed>();
let cv: OffscreenCanvas | HTMLCanvasElement | null = null;
const S = 120;
export function placeGlyph(ch: string, shape: RainShape, wght: number, slant: number): Placed {
  const key = `${shape}|${wght}|${slant}|${ch}`, had = PLACED.get(key);
  if (had) return had;
  if (!cv) cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(S * 2.4, S * 2.4) : Object.assign(document.createElement('canvas'), { width: S * 2.4, height: S * 2.4 });
  const N = S * 2.4, ctx = cv.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  const t = Math.tan((slant * Math.PI) / 180), ox = 0.6 * S, oy = 1.6 * S;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, N, N);
  // 기준선 왼끝을 축으로 오른쪽으로 기운다 — x' = x - t·(y - 기준선)(CSS skewX(-a), transform-origin = 기준선 왼끝과 같다)
  ctx.setTransform(1, 0, -t, 1, t * oy, 0);
  ctx.font = `${wght} ${S}px '${FAMILY[shape]}', 'Handjet'`; ctx.fillStyle = '#000'; ctx.fillText(ch, ox, oy);
  const d = ctx.getImageData(0, 0, N, N).data;
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, sa = 0, sx = 0, sy = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const a = d[(y * N + x) * 4 + 3];
    if (!a) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    sa += a; sx += a * (x + 0.5); sy += a * (y + 0.5);
  }
  let p: Placed;
  if (x1 < 0) p = { tx: DROP.d / 2 - 0.3, ty: DROP.d / 2 + 0.3, box: [0, 0, 0, 0] };   // 잉크가 없는 글자(공백 따위)
  else {
    const bx0 = (x0 - ox) / S, by0 = (y0 - oy) / S, bx1 = (x1 + 1 - ox) / S, by1 = (y1 + 1 - oy) / S, cx = (sx / sa - ox) / S, cy = (sy / sa - oy) / S;
    const code = ch.charCodeAt(0), jong = code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
    const mx = (bx0 + bx1) / 2, my = (by0 + by1) / 2;
    const vx = mx + 0.5 * (cx - mx), vy = jong ? my : my + 0.5 * (cy - my), lift = jong ? 0 : 0.02 * DROP.d;
    const tx = DROP.d / 2 - vx, ty = DROP.d / 2 - lift - vy;
    p = { tx, ty, box: [bx0 + tx, by0 + ty, bx1 + tx, by1 + ty] };
  }
  if (PLACED.size > 4000) PLACED.delete(PLACED.keys().next().value!);
  PLACED.set(key, p);
  return p;
}

/* ─── 원 선과 명암 ─────────────────────────────────────────────────────────────────────────────────────────── */
/** 잡음 판 — 크기마다 한 장을 만들어 두고 물방울마다 다른 자리에서 떠 쓴다(물방울마다 새로 만들면 무겁다) */
const TILES = new Map<string, { T: number; n: Float32Array[] }>();
function tile(px: number): { T: number; n: Float32Array[] } {
  const N = Math.ceil(DROP.d * px), T = Math.max(N + 2, Math.min(512, Math.ceil(px * DROP.d * 3))), key = `${T}|${px.toFixed(1)}`, had = TILES.get(key);
  if (had) return had;
  const [g1, g2, g3] = SHADE.grain, n = [noise(T, T, g1 * px, 11), noise(T, T, g2 * px, 12), noise(T, T, g3 * px, 13)];
  const got = { T, n };
  if (TILES.size > 8) TILES.delete(TILES.keys().next().value!);
  TILES.set(key, got);
  return got;
}
/**
 * 빗방울 하나를 캔버스에 — 원 선 + 명암(글자는 그리지 않는다: 글자는 DOM 글자로 얹는다 — 낱알 축을 모든 브라우저가 그리게).
 * fs = 글자 크기(CSS px), dpr = 화소 배율, color = 글의 색, box = 놓인 잉크 상자(em), seed = 잡음 자리
 */
export function drawDrop(c: HTMLCanvasElement, fs: number, dpr: number, color: string, box: Placed['box'], seed: number) {
  const px = fs * dpr, N = Math.ceil(DROP.d * px);
  if (c.width !== N) { c.width = N; c.height = N; }
  const ctx = c.getContext('2d')!, img = ctx.createImageData(N, N), out = img.data, [r, g, b] = cssRgb(color);
  const R = N / 2, w = DROP.ring * px, ri = R - w, [L0, L1] = SHADE.light;
  const P = SHADE.period * px, LW = SHADE.width * px, A1 = SHADE.wob[0] * px, A2 = SHADE.wob[1] * px, WV = SHADE.wob[2];
  const m = SHADE.clear * px, gx0 = box[0] * px - m, gy0 = box[1] * px - m, gx1 = box[2] * px + m, gy1 = box[3] * px + m;
  const { T, n } = tile(fs * dpr), ox = (seed * 97) % (T - N + 1), oy = (seed * 57) % (T - N + 1);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const X = x + 0.5, Y = y + 0.5, dx = X - R, dy = Y - R, rr = Math.hypot(dx, dy);
    if (rr > R + 1) continue;
    // 원 선 — 바깥 R에서 안쪽으로 w
    let a = Math.min(1, Math.max(0, w / 2 - Math.abs(rr - (R - w / 2)) + 0.5));
    if (rr < ri && !(X > gx0 && X < gx1 && Y > gy0 && Y < gy1)) {
      const lit = (dx * L0 + dy * L1) / R, dark = Math.min(1, Math.max(0, (-lit + SHADE.reach) / (0.75 + SHADE.reach)));
      if (dark > 0.08) {
        const k = (y + oy) * T + (x + ox), u = X + Y + A1 * n[0][k] + A2 * n[1][k], ph = ((u % P) + P) % P;
        const wl = LW * dark * dark * (3 - 2 * dark) * SHADE.gain * (1 + WV * n[2][k]);
        const dd = Math.min(ph, P - ph) * Math.SQRT1_2;
        a = Math.max(a, Math.min(1, Math.max(0, (wl / 2) * Math.SQRT1_2 - dd + 0.5)));
      }
    }
    if (!a) continue;
    const o = (y * N + x) * 4;
    out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = Math.round(255 * a);
  }
  ctx.putImageData(img, 0, 0);
}
