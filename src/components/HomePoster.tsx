import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import pine from '../assets/trees/pine-764.png';
import { CLOUD_PHOTOS } from '../lib/cloudPhoto.data';
import { STONE_PHOTOS } from '../lib/stonePhoto.data';
import { LINEAL_CAP as CAP, RING_R as R, RING_SUB as SUB } from './RingBadge';
import { BODY, CLIP_H, EYE_FAR_DX, EYE_LOOK, EYE_SHUT, EYE_SMILE, EYE_WHITE, EYE_WIDE, HEAD, SIT, WALK } from '../character/walker';

/**
 * 홈 — 풍경 포스터와 스플래시(2026-10-06, 디자이너와 격자로 고름 · 견본 design/home-splash.html).
 *
 * 벽의 한 장면을 첫 화면에 건다: 왼쪽 가장자리로 잘리는 소나무 · 구름 · 바위를 --grey-200 면으로(윤곽 · 빗금 없음),
 * 땅도 같은 회색으로 화면 끝까지. 바닥에는 튜토리얼과 같은 빨강 기운(app.css .info-overlay::after를 같이 쓴다). 왼쪽 위 원은 부제가 두 바퀴 돌고(천천히 회전) 그 안에 Mega / Font.
 * 물음표 대신 오른쪽 아래 세로쓰기 '메가폰트에 대해 / 더 알아보기'.
 *
 * 처음 열 때 한 번: 큰 빨강 사람이 화면을 채우고 껌뻑껌뻑 → 옆으로 돌아 8걸음 뚜벅뚜벅 오른쪽 밖으로 — 그 사이 원 글이
 * 그려지고 풍경이 드러난다 → Mega · Font → 세로쓰기 → 버튼. 빨강이 작게 돌아와 바위 옆에 앉고, 하늘이 왼쪽에서 와
 * 발견하고 곁에 앉아 이야기한다(WallWalkers와 같은 몸짓). 누르면 끝 장면으로. 움직임 줄이기면 끝 장면만.
 */

/** 소나무 764 — 재료 png 안의 그림 영역과 밑동 자리(가로 몫). 검은 바탕을 뺀 상자 */
const PINE = { w: 1535, h: 1280, box: [9, 18, 1447, 1256] as const, base: 0.5052 };
const CLOUD = CLOUD_PHOTOS.find((c) => c.id === 'b03')!;
const ROCK = STONE_PHOTOS.find((s) => s.id === 'stone-a')!;
const PEBBLE = STONE_PHOTOS.find((s) => s.id === 'stone-moon')!;
const SINK = 8;   // 나무 · 바위를 땅 물결(±3.6) 아래까지 묻는다 — 안 묻으면 오목한 곳에서 떠 보였다
const PLAYED_KEY = 'megafont.splash.v1';

/** 시간 토큰(ms) — 단위를 보고 읽는다: 빌드가 700ms를 .7s로 고쳐 적는다 */
function tokenMs(name: string, fallback: number): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return /ms$/.test(v) ? n : n * 1000;
}
function easeOf(name: string): (p: number) => number {
  const nums = getComputedStyle(document.documentElement).getPropertyValue(name).match(/-?[\d.]+/g)?.map(Number);
  const [x1, y1, x2, y2] = nums && nums.length === 4 ? nums : [0.2, 0, 0, 1];
  const f = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (p) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let lo = 0, hi = 1, t = p;
    for (let i = 0; i < 22; i++) { t = (lo + hi) / 2; if (f(x1, x2, t) < p) lo = t; else hi = t; }
    return f(y1, y2, t);
  };
}
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/**
 * 손으로 옮기기(2026-10-06 사용자) — 원(원 글 + Mega Font) · '더 알아보기' · 두 캐릭터. 스플래시가 끝난 뒤부터.
 * 2026-09-20에 '홈이 장난감이 되면 안 된다'며 좌우로 옮기기를 걷었던 것을 디자이너가 다시 열었다.
 * 캐릭터는 집으면 옆모습으로 매달려 눈을 동그랗게 뜨고 버둥거린다 — 옛 큰 메가폰트(HomeCharacter)의 들어 올리기와 같은
 * 두 박자(2.6 · 4.1Hz 기울기, 3.3Hz 옆 흔들림). 작은 몸이라 진폭은 그보다 크게. 놓으면 그 자리 땅으로 떨어져 앉고,
 * 서로를 향해 돌아앉아 이야기를 잇는다
 */
const DRAG_SLOP = 6;          // 이만큼 움직여야 끌기 — 짧게 누르면 링크는 소개로 간다
const WIGGLE_DEG = 8;         // 옛 메가폰트 5°보다 크게 — 작은 몸의 버둥거림
const WIGGLE_SWAY = 0.03;     // 키에 대한 옆 흔들림
/** 움직일 수 있다는 기미(2026-10-06 사용자) — 올리면 살짝, 누르면 손에 들린 만큼 커진다. 캐릭터는 올리면 들썩 · 누르면 바로 들린다 */
const LIFT_HOVER = 1.03, LIFT_PRESS = 1.06, PEEK = 0.05;
type Held = { x: number; feet: number; held: boolean; dropT: number; dropFrom: number; walk?: { from: number; to: number; t0: number; n: number } };
const MOVED: { badge: [number, number]; badgeScale: number; about: [number, number]; chars: Partial<Record<'red' | 'cyan', Held>> } = { badge: [0, 0], badgeScale: 1, about: [0, 0], chars: {} };
/** 원은 두 손가락으로 벌려 키운다(2026-10-06 사용자) — 가장 크게는 '화면 폭 − 양옆 여백'의 이만큼, 가장 작게는 처음 크기 */
const BADGE_MAX_OF_WIDTH = 0.94;

let playedThisLoad = false;
function wasPlayed() {
  if (playedThisLoad) return true;
  try { return sessionStorage.getItem(PLAYED_KEY) === '1'; } catch { return false; }
}
function markPlayed() {
  playedThisLoad = true;
  try { sessionStorage.setItem(PLAYED_KEY, '1'); } catch { /* 저장 못 해도 이번 방문엔 한 번만 */ }
}

interface Lay {
  W: number; H: number; G: number; u: number; cx: number; cy: number; fs: number; lh: number;
  cloud: { x: number; y: number; k: number }; tree: { x: number; y: number; w: number; h: number };
  rock: { cx: number; w: number; h: number }; pebble: { cx: number; w: number; h: number };
}

/** 구도 A(design/home-splash.html) — 원이 왼쪽 위, 풍경은 원 밑에서 땅까지. 덩어리는 가장자리에 붙고 크기는 u = min(풍경 높이, 폭) */
function layout(frame: HTMLElement): Lay | null {
  const gate = frame.querySelector('.home-gate'), layer = frame.querySelector('.home-layer');
  if (!gate || !layer) return null;
  const fr = frame.getBoundingClientRect();
  const W = fr.width, H = fr.height;
  const css = getComputedStyle(layer), root = getComputedStyle(document.documentElement);
  const safeTop = parseFloat(css.paddingTop) || 16;
  const cx = 16 + 14 + R, cy = safeTop + 14 + R;   // 바깥 글자 높이 14
  const top = cy + R + 14 + 8;
  const G = gate.getBoundingClientRect().top - fr.top - 24;   // --space-section: 풍경과 버튼은 다른 섹션
  const Z = G - top, u = Math.min(Z, W);
  const ch = Math.min(0.2 * u, 0.5 * Z), k = ch / CLOUD.h, cw = CLOUD.w * k;
  const th = Math.min(u, 0.92 * Z), tw = th * ((PINE.box[2] - PINE.box[0]) / (PINE.box[3] - PINE.box[1]));
  const rh = 0.14 * u, ph = 0.045 * u;
  return {
    W, H, G, u, cx, cy,
    fs: parseFloat(root.getPropertyValue('--fs-home-mark')) || 44,
    lh: parseFloat(root.getPropertyValue('--lh-home-mark')) || 0.83,
    cloud: { x: Math.max(W - 0.16 * u - cw / 2, cx + R + 14 + 12), y: cy - ch / 2, k },
    tree: { x: 0.08 * u - PINE.base * tw, y: G + SINK - th, w: tw, h: th },
    rock: { cx: W - 0.03 * u, w: rh * ROCK.aspect, h: rh },
    pebble: { cx: 0.6 * u, w: ph * PEBBLE.aspect, h: ph }
  };
}

const groundY = (G: number, x: number) => G + 2.2 * Math.sin(x / 23) + 1.4 * Math.sin(x / 9.5);
const pts = (list: readonly (readonly [number, number])[], f: (x: number, y: number) => [number, number]) =>
  list.map(([x, y]) => f(x, y).map((v) => v.toFixed(1)).join(',')).join(' ');
const stonePts = (s: typeof ROCK, cx: number, w: number, h: number, G: number) =>
  pts(s.pts, (x, y) => [cx - w / 2 + x * w, G + SINK - h + y * h]);

interface Props { onAbout: () => void; aboutLabel: string; }
export default function HomePoster({ onAbout, aboutLabel }: Props) {
  const raw = useId().replace(/:/g, '');
  const id = (s: string) => `hp${raw}${s}`;
  const host = useRef<HTMLDivElement>(null);
  const [lay, setLay] = useState<Lay | null>(null);
  const [skippable, setSkippable] = useState(() => !wasPlayed());
  const start = useRef<number | null>(null);

  // 자리 — 틀 크기와 버튼 묶음의 높이에서
  useLayoutEffect(() => {
    const frame = host.current?.closest('.home-frame') as HTMLElement | null;
    if (!frame) return;
    const gate = frame.querySelector('.home-gate') as HTMLElement | null;
    if (gate && !wasPlayed()) { gate.style.opacity = '0'; gate.style.pointerEvents = 'none'; }
    const measure = () => setLay(layout(frame));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    document.fonts?.ready.then(measure);
    return () => ro.disconnect();
  }, []);

  // 움직임 — 한 번 짠 시간표를 프레임마다 읽는다(React를 다시 그리지 않는다)
  useEffect(() => {
    const el = host.current, frame = el?.closest('.home-frame') as HTMLElement | null;
    if (!lay || !el || !frame) return;
    const svg = el.querySelector('svg')!;
    const q = <E extends Element>(s: string) => svg.querySelector(s) as E;
    const qa = (s: string) => [...svg.querySelectorAll(s)] as SVGElement[];
    const land = q<SVGGElement>('[data-p="land"]'), arc = q<SVGCircleElement>('[data-p="arc"]'), spin = q<SVGGElement>('[data-p="spin"]');
    const m1 = q<SVGTSpanElement>('[data-p="m1"]'), m2 = q<SVGTSpanElement>('[data-p="m2"]');
    // 두 줄의 기준 높이는 원 가운데에서 계산한다 — 화면에서 읽으면 안 된다. 서체가 늦게 오거나 크기가 바뀌어 이 계산을
    // 다시 할 때 글자가 떠오르는 중(10px 아래)이면 그 값을 기준으로 읽어 다시 할 때마다 10px씩 쌓였다(2026-10-06,
    // 크롬 20px · 아이폰은 더 — 기기마다 다시 하는 횟수가 달라 어긋남도 달랐다)
    const m1y = lay.cy - ((lay.lh - CAP) * lay.fs) / 2, m2y = m1y + lay.lh * lay.fs;
    const red = q<SVGGElement>('[data-p="red"]'), cyan = q<SVGGElement>('[data-p="cyan"]');
    const rFront = red.querySelector('[data-p="front"]') as SVGGElement, rFrontEyes = red.querySelector('[data-p="front-eyes"]') as SVGGElement;
    const rSide = red.querySelector('[data-p="side"]') as SVGGElement, rSit = red.querySelector('[data-p="sit"]') as SVGGElement;
    const cSide = cyan.querySelector('[data-p="side"]') as SVGGElement, cSit = cyan.querySelector('[data-p="sit"]') as SVGGElement;
    const badge = q<SVGGElement>('[data-p="badge"]');
    const about = el.querySelector('[data-p="about"]') as HTMLElement, gate = frame.querySelector('.home-gate') as HTMLElement;
    const eyeSet = (g: SVGGElement) => ({ p: [...g.querySelectorAll('[data-p="pupil"]')] as SVGCircleElement[], s: [...g.querySelectorAll('[data-p="smile"]')] as SVGElement[] });
    const rEyes = eyeSet(red), cEyes = eyeSet(cyan);
    const shutFront = qa('[data-p="shut"]'), openFront = qa('[data-p="open"]');
    const setEye = (E: ReturnType<typeof eyeSet>, kind: 'look' | 'wide' | 'smile') => {
      E.p.forEach((c) => {
        c.style.display = kind === 'smile' ? 'none' : '';
        c.setAttribute('r', String(kind === 'wide' ? EYE_WIDE.r : EYE_LOOK.r));
        c.setAttribute('cx', String(kind === 'wide' ? EYE_WIDE.cx : EYE_LOOK.cx));
      });
      E.s.forEach((p) => { p.style.display = kind === 'smile' ? '' : 'none'; });
    };

    const IDLE = tokenMs('--t-home-idle', 5000);   // 이만큼 안 만지면 옮긴 것들이 제자리로(2026-10-06 사용자 '5초')
    const HOLD = tokenMs('--t-hold', 700), SLOW = tokenMs('--t-slow', 400), RET = tokenMs('--t-return', 220), TURN = tokenMs('--t-home-ring', 40000);
    const STD = easeOf('--ease-standard'), EMPH = easeOf('--ease-emphasized');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { W, H, G, cx, cy } = lay;
    // 시간표(ms) — 걷기 2.8초(8걸음), 그 뒤 움직임은 두 배 길게(디자이너). 글은 걸어 나가기 시작할 때부터 그려진다
    const WALK_MS = 4 * HOLD, STEPS = 8, STEP = WALK_MS / STEPS, ESTEPS = 6, ENTER = STEP * ESTEPS;
    const T = { blink: SLOW, turn: SLOW + 2 * HOLD, run: 0, ring: 0, mega: 0, font: 0, vert: 0, gate: 0, back: 0, sat: 0, cy: 0, found: 0, go: 0, csat: 0, all: 0 };
    T.run = T.turn + RET; T.ring = T.run; T.mega = T.ring + 4 * SLOW; T.font = T.mega + SLOW; T.vert = T.font + 2 * SLOW; T.gate = T.vert + SLOW;
    T.back = T.run + WALK_MS; T.sat = T.back + ENTER; T.cy = T.sat + RET; T.found = T.cy + 5 * STEP; T.go = T.found + HOLD; T.csat = T.go + 3 * STEP; T.all = T.csat + SLOW;

    const K0 = (W * 1.17) / 390, FEET0 = H + (541.8 - 470) * K0, XOUT = W + HEAD.r * 2 * K0 + 20;   // 처음: 폭을 꽉, 다리는 화면 밖
    const KS = (0.065 * H) / 541.8;   // 작은 사람 = 벽과 같은 키(창 높이의 6.5%)
    const XR = lay.rock.cx - lay.rock.w / 2 - 22, XC = XR - (62 * W) / 390, XD = 0.4 * W;
    const C = 2 * Math.PI * (R + 7);
    const place = (g: SVGGElement, k: number, fx: number, feet: number, sx = 1, tilt = 0) =>
      g.setAttribute('transform', `translate(${fx.toFixed(1)} ${feet.toFixed(1)}) rotate(${tilt.toFixed(2)}) translate(${(-HEAD.cx * k * sx).toFixed(2)} ${(-541.8 * k).toFixed(2)}) scale(${(k * sx).toFixed(4)} ${k.toFixed(4)})`);
    // 이야기 — WallWalkers와 같은 몸짓: 말하는 쪽 키의 3% 들썩 · 쳐다봄과 가끔 웃음, 듣는 쪽 2% 끄덕 · 대개 웃음. 차례는 3×HOLD마다
    const talk = (t: number, who: 0 | 1): [number, 'look' | 'smile' | null] => {
      if (t < T.csat) return [0, null];
      if (reduce) return [0, 'smile'];
      const speaking = Math.floor((t - T.csat) / (3 * HOLD)) % 2 === who;
      if (speaking) return [Math.abs(Math.sin((t / (HOLD * 0.5)) * Math.PI)) * 0.03, Math.floor(t / (HOLD * 0.6)) % 3 === 2 ? 'smile' : 'look'];
      return [-(Math.max(0, Math.sin((t / (HOLD * 1.5)) * 2 * Math.PI) - 0.6) / 0.4) * 0.02, Math.floor(t / (HOLD * 2.2)) % 4 === 3 ? 'look' : 'smile'];
    };
    const walkPhase = (t: number, from: number, dur: number, n: number) => {
      const w = clamp((t - from) / dur), i = Math.min(n - 1, Math.floor(w * n)), s = w >= 1 ? 1 : w * n - i;
      return { w, i, p: w >= 1 ? 1 : (i + STD(s)) / n, lift: w > 0 && w < 1 ? Math.sin(Math.PI * s) : 0 };
    };

    const draw = (t: number) => {
      // 큰 빨강 — 등장 · 껌뻑껌뻑 · 돌아섬 · 8걸음으로 오른쪽 밖
      const pin = EMPH(clamp(t / SLOW));
      const shut = [[T.blink + HOLD * 0.6, RET], [T.blink + HOLD * 1.3, RET]].some(([a, d]) => t >= a && t < a + d);
      openFront.forEach((e) => { e.style.display = shut ? 'none' : ''; });
      shutFront.forEach((e) => { e.style.display = shut ? '' : 'none'; });
      const pt = clamp((t - T.turn) / RET), squash = 1 - 0.18 * Math.sin(pt * Math.PI), turned = pt >= 0.5;
      const ex = walkPhase(t, T.run, WALK_MS, STEPS);
      if (ex.w < 1) {
        red.style.opacity = String(pin);
        rFront.style.display = turned ? 'none' : ''; rFrontEyes.style.display = turned ? 'none' : '';
        rSide.style.display = turned ? '' : 'none'; rSit.style.display = 'none';
        place(red, K0 * (0.92 + 0.08 * pin), lerp(W / 2, XOUT, ex.p), FEET0 - ex.lift * 0.06 * 541.8 * K0, (turned ? -1 : 1) * squash, (ex.i % 2 ? 1 : -1) * 4 * ex.lift);
      } else {   // 작게 오른쪽에서 돌아와 바위 옆에 왼쪽을 보며 앉는다
        const en = walkPhase(t, T.back, ENTER, ESTEPS), sitting = en.w >= 1;
        const [dy, eye] = talk(t, 0);
        red.style.opacity = '1'; rFront.style.display = 'none'; rSide.style.display = sitting ? 'none' : ''; rSit.style.display = sitting ? '' : 'none';
        setEye(rEyes, eye ?? 'look');
        place(red, KS, lerp(W + HEAD.cx * KS + 10, XR, en.p), G + 3 - (en.lift * 0.06 + dy) * 541.8 * KS, 1, (en.i % 2 ? 1 : -1) * 4 * en.lift);
      }
      // 풍경 · 원 글 · 로고 · 세로쓰기 · 버튼
      const landP = STD(clamp((t - T.run) / WALK_MS));
      land.style.opacity = String(landP);
      arc.setAttribute('stroke-dashoffset', (C * (1 - STD(clamp((t - T.ring) / (4 * SLOW))))).toFixed(1));
      if (!reduce) spin.setAttribute('transform', `rotate(${(t > T.ring ? ((t - T.ring) / TURN) * 360 : 0) % 360} ${cx} ${cy})`);
      const a1 = EMPH(clamp((t - T.mega) / (2 * SLOW))), a2 = EMPH(clamp((t - T.font) / (2 * SLOW)));
      m1.style.opacity = String(a1); m1.setAttribute('y', (m1y + 10 * (1 - a1)).toFixed(1));
      m2.style.opacity = String(a2); m2.setAttribute('y', (m2y + 10 * (1 - a2)).toFixed(1));
      const v = EMPH(clamp((t - T.vert) / (2 * SLOW))), g = STD(clamp((t - T.gate) / (2 * SLOW)));
      about.style.opacity = String(v); about.style.transform = `translateY(${(12 * (1 - v)).toFixed(1)}px)`; about.style.pointerEvents = v > 0.5 ? '' : 'none';
      if (gate) { gate.style.opacity = String(g); gate.style.pointerEvents = g > 0.5 ? '' : 'none'; }
      const n0 = performance.now(), f = 1 - Math.exp(-Math.min(0.1, (n0 - lastT) / 1000) * 14); lastT = n0;
      for (const k of ['badge', 'about', 'red', 'cyan'] as const) {
        const want = k === 'badge' && pinch ? 1 : hand?.kind === k ? LIFT_PRESS : hoverKind === k ? LIFT_HOVER : 1;   // 벌리는 동안은 손가락 크기 그대로 — 여백을 넘지 않게
        grow[k] += (want - grow[k]) * (reduce ? 1 : f);
      }
      badge.setAttribute('transform', `translate(${(MOVED.badge[0] + cx).toFixed(1)} ${(MOVED.badge[1] + cy).toFixed(1)}) scale(${(grow.badge * MOVED.badgeScale).toFixed(4)}) translate(${-cx} ${-cy})`);
      about.style.translate = `${MOVED.about[0].toFixed(1)}px ${MOVED.about[1].toFixed(1)}px`;
      about.style.scale = grow.about.toFixed(4);
      // 하늘 — 왼쪽에서 와 멈칫 발견(눈 동그랗게 · 살짝 뜀), 곁에 와서 오른쪽을 보며 앉는다
      if (t < T.found - 5 * STEP) { cyan.style.display = 'none'; return; }
      cyan.style.display = '';
      let x = XD, lift = 0, step = 0, hop = 0, sitting = false, wide = false;
      if (t < T.found) { const a = walkPhase(t, T.cy, 5 * STEP, 5); x = lerp(-40, XD, a.p); lift = a.lift; step = a.i; }
      else if (t < T.go) { wide = true; hop = Math.sin(Math.PI * clamp((t - T.found) / (HOLD * 0.5))); }
      else if (t < T.csat) { const a = walkPhase(t, T.go, 3 * STEP, 3); x = lerp(XD, XC, a.p); lift = a.lift; step = a.i; }
      else { x = XC; sitting = true; }
      const [dy, eye] = talk(t, 1);
      cSide.style.display = sitting ? 'none' : ''; cSit.style.display = sitting ? '' : 'none';
      setEye(cEyes, wide ? 'wide' : eye ?? 'look');
      place(cyan, KS, x, G + 3 - (lift * 0.06 + hop * 0.12 + dy) * 541.8 * KS, -1, (step % 2 ? 1 : -1) * 4 * lift);
      if (t >= T.all) {
        MOVED.chars.red ??= { x: XR, feet: G + 3, held: false, dropT: 0, dropFrom: G + 3 };
        MOVED.chars.cyan ??= { x: XC, feet: G + 3, held: false, dropT: 0, dropFrom: G + 3 };
        movedChar('red', t); movedChar('cyan', t);
      }
    };
    // 옮긴 캐릭터 — 들려 있으면 매달려 버둥 · 놓으면 떨어져 앉는다 · 서로를 향해 돌아앉는다(그림은 왼쪽을 본다)
    const FALL_MS = 2 * RET;
    const movedChar = (who: 'red' | 'cyan', t: number) => {
      const o = MOVED.chars[who];
      if (!o) return;
      const [g, sd, st, E] = who === 'red' ? [red, rSide, rSit, rEyes] : [cyan, cSide, cSit, cEyes];
      const otherX = MOVED.chars[who === 'red' ? 'cyan' : 'red']?.x ?? (who === 'red' ? XC : XR);
      const face = otherX < o.x ? 1 : -1, n = performance.now();
      g.style.display = ''; g.style.opacity = '1';
      if (o.walk) {   // 제자리로 걸어간다 — 스플래시와 같은 뚜벅뚜벅, 걸어가는 쪽을 본다
        const w = o.walk, a = reduce ? 1 : clamp((n - w.t0) / (w.n * STEP));
        const i = Math.min(w.n - 1, Math.floor(a * w.n)), sx = a >= 1 ? 1 : a * w.n - i;
        const lift = a < 1 ? Math.sin(Math.PI * sx) : 0;
        o.x = lerp(w.from, w.to, a >= 1 ? 1 : (i + STD(sx)) / w.n);
        sd.style.display = ''; st.style.display = 'none'; setEye(E, 'look');
        place(g, KS, o.x, G + 3 - lift * 0.06 * 541.8 * KS, w.to < w.from ? 1 : -1, (i % 2 ? 1 : -1) * 4 * lift);
        if (a >= 1) { o.x = w.to; o.walk = undefined; }
        return;
      }
      if (o.held) {
        const s = n / 1000, k = reduce ? 0 : 1;
        const tilt = k * WIGGLE_DEG * (Math.sin(s * 2 * Math.PI * 2.6) + 0.35 * Math.sin(s * 2 * Math.PI * 4.1 + 1));
        const sway = k * WIGGLE_SWAY * 541.8 * KS * Math.sin(s * 2 * Math.PI * 3.3 + 0.5);
        sd.style.display = ''; st.style.display = 'none'; setEye(E, 'wide');
        place(g, KS, o.x + sway, o.feet, face, tilt);
        return;
      }
      const p = clamp((n - o.dropT) / FALL_MS);
      if (p < 1) { sd.style.display = ''; st.style.display = 'none'; setEye(E, 'wide'); place(g, KS, o.x, lerp(o.dropFrom, G + 3, p * p), face, 0); return; }
      const [dy, eye] = talk(t, who === 'red' ? 0 : 1);
      const peek = (grow[who] - 1) / (LIFT_HOVER - 1);   // 올리면 0→1 — 들썩하며 눈을 동그랗게
      sd.style.display = 'none'; st.style.display = ''; setEye(E, peek > 0.5 ? 'wide' : eye ?? 'look');
      place(g, KS, o.x, G + 3 - (dy + PEEK * Math.min(1, peek)) * 541.8 * KS, face, 0);
    };

    const now = () => performance.now();
    if (start.current === null) start.current = wasPlayed() || reduce ? now() - T.all : now();
    type Kind = 'badge' | 'about' | 'red' | 'cyan';
    let hand: { kind: Kind; id: number; x0: number; y0: number; ox: number; oy: number; moved: boolean; box: DOMRect } | null = null;
    let hoverKind: Kind | null = null, lastT = performance.now();
    let lastTouch = performance.now(), back: { t0: number; badge: [number, number]; scale: number; about: [number, number] } | null = null;
    const HOME_X = { red: XR, cyan: XC } as const;
    const displaced = () => MOVED.badge.some((v) => Math.abs(v) > 0.5) || Math.abs(MOVED.badgeScale - 1) > 0.005 || MOVED.about.some((v) => Math.abs(v) > 0.5)
      || (['red', 'cyan'] as const).some((k) => { const o = MOVED.chars[k]; return !!o && (Math.abs(o.x - HOME_X[k]) > 1 || o.feet < G + 2); });
    /** 5초 안 만지면 제자리로 — 원 · 링크는 미끄러지고(2 × --t-slow), 캐릭터는 걸어간다 */
    const settleBack = (n: number) => {
      if (!back) {
        if (hand || pinch || n - lastTouch < IDLE || !displaced()) return;
        back = { t0: n, badge: [...MOVED.badge], scale: MOVED.badgeScale, about: [...MOVED.about] };
        for (const k of ['red', 'cyan'] as const) {
          const o = MOVED.chars[k];
          if (!o || o.held) continue;
          const d = Math.abs(o.x - HOME_X[k]);
          o.feet = G + 3;
          if (d > 1) o.walk = { from: o.x, to: HOME_X[k], t0: n, n: Math.max(1, Math.round(d / (0.07 * W))) };
        }
      }
      const pb = reduce ? 1 : EMPH(clamp((n - back.t0) / (2 * SLOW)));
      MOVED.badge = [lerp(back.badge[0], 0, pb), lerp(back.badge[1], 0, pb)];
      MOVED.badgeScale = lerp(back.scale, 1, pb);
      MOVED.about = [lerp(back.about[0], 0, pb), lerp(back.about[1], 0, pb)];
      if (pb >= 1 && !MOVED.chars.red?.walk && !MOVED.chars.cyan?.walk) back = null;
    };
    const grow: Record<Kind, number> = { badge: 1, about: 1, red: 1, cyan: 1 };
    let raf = 0, done = false;
    const tick = () => {
      const t = reduce ? T.all : now() - start.current!;
      if (t >= T.all) settleBack(now());
      draw(t);
      if (!done && t >= T.all) { done = true; markPlayed(); setSkippable(false); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const skip = () => { start.current = Math.min(start.current!, now() - T.all); };
    el.addEventListener('megafont-skip', skip);

    let swallowClick = false;
    const ROUT = R + 14;   // 원의 바깥 반지름(바깥 글자까지)
    const SMAX = Math.max(1, ((W - 2 * 16) * BADGE_MAX_OF_WIDTH) / (2 * ROUT));
    /** 키운 원이 화면 밖으로 넘치면 안쪽으로 민다 */
    const keepBadgeIn = () => {
      const r = ROUT * MOVED.badgeScale;
      const x = Math.max(16 + r, Math.min(W - 16 - r, cx + MOVED.badge[0]));
      const y = Math.max(16 + r, Math.min(H - r, cy + MOVED.badge[1]));
      MOVED.badge = [x - cx, y - cy];
    };
    const fingers = new Map<number, [number, number]>();
    let pinch: { d0: number; s0: number } | null = null;
    const spread = () => { const [a, b] = [...fingers.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
    const onPinchDown = (e: PointerEvent) => {
      if (e.pointerType !== 'touch' || (!reduce && now() - start.current! < T.all)) return;
      const onBadge = !!(e.target as Element).closest?.('[data-drag="badge"]');
      if (fingers.size === 0 && !onBadge) return;   // 첫 손가락은 원 위여야
      if (fingers.size >= 2) return;
      fingers.set(e.pointerId, [e.clientX, e.clientY]);
      if (fingers.size === 2) {
        pinch = { d0: Math.max(1, spread()), s0: MOVED.badgeScale };
        hand = null;   // 옮기기는 멈추고 키우기로
        lastTouch = now(); back = null;
      }
    };
    const onPinchMove = (e: PointerEvent) => {
      if (!fingers.has(e.pointerId)) return;
      fingers.set(e.pointerId, [e.clientX, e.clientY]);
      if (!pinch || fingers.size < 2) return;
      e.preventDefault();
      MOVED.badgeScale = Math.max(1, Math.min(SMAX, pinch.s0 * (spread() / pinch.d0)));
      keepBadgeIn();
      lastTouch = now();
    };
    const onPinchUp = (e: PointerEvent) => {
      if (!fingers.delete(e.pointerId)) return;
      if (fingers.size < 2) pinch = null;
      lastTouch = now();
    };
    const fr = () => frame.getBoundingClientRect();
    const onDown = (e: PointerEvent) => {
      if (!e.isPrimary || pinch || (!reduce && now() - start.current! < T.all)) return;
      const tgt = (e.target as Element).closest('[data-drag]');
      if (!tgt || !el.contains(tgt)) return;
      const kind = tgt.getAttribute('data-drag') as Kind;
      lastTouch = now(); back = null;
      for (const k of ['red', 'cyan'] as const) { const c = MOVED.chars[k]; if (c) c.walk = undefined; }
      let ox: number, oy: number;
      if (kind === 'badge' || kind === 'about') [ox, oy] = MOVED[kind];
      else {
        const o = MOVED.chars[kind] ?? (MOVED.chars[kind] = { x: kind === 'red' ? XR : XC, feet: G + 3, held: false, dropT: 0, dropFrom: G + 3 });
        ox = o.x; oy = o.feet;
      }
      hand = { kind, id: e.pointerId, x0: e.clientX, y0: e.clientY, ox, oy, moved: false, box: tgt.getBoundingClientRect() };
      if (kind === 'red' || kind === 'cyan') {   // 누르는 순간 집힌다 — 키의 6%만큼 들리며 버둥거리기 시작
        const o = MOVED.chars[kind]!;
        o.held = true; o.feet = Math.min(o.feet, G + 3 - 0.06 * 541.8 * KS); hand.oy = o.feet;
      }
    };
    // 마우스를 올리면 — 폰에는 없다(누르는 순간이 그 몫)
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse' || (!reduce && now() - start.current! < T.all)) return;
      const tgt = (e.target as Element).closest('[data-drag]');
      hoverKind = tgt && el.contains(tgt) ? (tgt.getAttribute('data-drag') as Kind) : null;
    };
    const onLeave = () => { hoverKind = null; };
    const onMove = (e: PointerEvent) => {
      if (!hand || pinch || e.pointerId !== hand.id) return;
      const dx = e.clientX - hand.x0, dy = e.clientY - hand.y0;
      if (!hand.moved && Math.hypot(dx, dy) > DRAG_SLOP) {
        hand.moved = true;
        const o = hand.kind === 'red' || hand.kind === 'cyan' ? MOVED.chars[hand.kind] : null;
        if (o) o.held = true;
      }
      if (!hand.moved) return;
      e.preventDefault();
      lastTouch = now();
      const f = fr(), b = hand.box;
      // 화면 밖으로는 못 나간다 — 잡은 덩어리의 상자가 틀 안에 남게
      const cdx = Math.max(f.left - b.left, Math.min(f.right - b.right, dx));
      const cdy = Math.max(f.top - b.top, Math.min(f.bottom - b.bottom, dy));
      if (hand.kind === 'badge' || hand.kind === 'about') MOVED[hand.kind] = [hand.ox + cdx, hand.oy + cdy];
      else {
        const o = MOVED.chars[hand.kind]!;
        o.x = hand.ox + cdx;
        o.feet = Math.min(G + 3, hand.oy + cdy);   // 땅 밑으로는 안 들어간다
      }
    };
    const onUp = (e: PointerEvent) => {
      if (!hand || e.pointerId !== hand.id) return;
      lastTouch = now();
      if (hand.moved && hand.kind === 'about') swallowClick = true;   // 끌었으면 소개로 가지 않는다
      const o = hand.kind === 'red' || hand.kind === 'cyan' ? MOVED.chars[hand.kind] : null;
      if (o && o.held) { o.held = false; o.dropT = now(); o.dropFrom = o.feet; }
      hand = null;
    };
    const onClickCapture = (e: MouseEvent) => { if (swallowClick) { swallowClick = false; e.stopPropagation(); e.preventDefault(); } };
    window.addEventListener('pointerdown', onPinchDown, true);
    window.addEventListener('pointermove', onPinchMove, { passive: false });
    window.addEventListener('pointerup', onPinchUp); window.addEventListener('pointercancel', onPinchUp);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerover', onOver);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    about.addEventListener('click', onClickCapture, true);
    return () => {
      cancelAnimationFrame(raf); el.removeEventListener('megafont-skip', skip);
      window.removeEventListener('pointerdown', onPinchDown, true); window.removeEventListener('pointermove', onPinchMove);
      window.removeEventListener('pointerup', onPinchUp); window.removeEventListener('pointercancel', onPinchUp);
      el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointerover', onOver); el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); window.removeEventListener('pointercancel', onUp);
      about.removeEventListener('click', onClickCapture, true);
    };
  }, [lay]);

  const L = lay;
  const y1 = L ? L.cy - ((L.lh - CAP) * L.fs) / 2 : 0;
  const soil = L ? Array.from({ length: Math.ceil(L.W / 6) + 1 }, (_, i) => Math.min(i * 6, L.W)).map((x) => `${x},${groundY(L.G, x).toFixed(1)}`).join(' ') + ` ${L.W},${L.H} 0,${L.H}` : '';
  const ringD = L ? `M ${L.cx - R} ${L.cy} A ${R} ${R} 0 1 1 ${L.cx + R} ${L.cy} A ${R} ${R} 0 1 1 ${L.cx - R} ${L.cy}` : '';
  const eye = (dx: number) => (
    <g>
      <circle className="hp-eye" cx={EYE_WHITE.cx + dx} cy={EYE_WHITE.cy} r={EYE_WHITE.r} />
      <circle data-p="pupil" fill="currentColor" cx={EYE_LOOK.cx + dx} cy={EYE_LOOK.cy} r={EYE_LOOK.r} />
      <path data-p="smile" d={EYE_SMILE.d} transform={`translate(${dx} 0) ${EYE_SMILE.transform}`} fill="currentColor" style={{ display: 'none' }} />
    </g>
  );
  const frontEye = (dx: number) => (
    <g>
      <circle className="hp-eye" cx={EYE_WHITE.cx + dx} cy={EYE_WHITE.cy} r={EYE_WHITE.r} />
      <circle data-p="open" fill="currentColor" cx={EYE_WHITE.cx + dx} cy={EYE_WHITE.cy} r={EYE_LOOK.r} />
      <path data-p="shut" d={EYE_SHUT} transform={`translate(${dx} 0)`} fill="none" stroke="currentColor" strokeWidth="20" strokeLinecap="round" style={{ display: 'none' }} />
    </g>
  );
  const [px, py] = SIT.pivot;
  const side = (
    <g data-p="side" style={{ display: 'none' }}>
      <g clipPath={`url(#${id('clip')})`}>
        <circle fill="currentColor" cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} />
        <path fill="currentColor" d={BODY} />
        {eye(0)}
      </g>
      <path fill="currentColor" d={WALK.farRest} />
      <path fill="currentColor" d={WALK.nearRest} />
    </g>
  );
  const sit = (
    <g data-p="sit" style={{ display: 'none' }}>
      <path fill="currentColor" d={SIT.far} transform={`rotate(${SIT.farDeg} ${px} ${py})`} />
      <g transform={`translate(0 ${SIT.drop})`}>
        <circle fill="currentColor" cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} />
        <path fill="currentColor" d={SIT.body} />
        {eye(0)}
      </g>
      <path fill="currentColor" d={SIT.near} transform={`rotate(${SIT.nearDeg} ${px} ${py})`} />
    </g>
  );

  return (
    <div ref={host} className="home-poster">
      {L && (
        <svg className="home-poster-art" width={L.W} height={L.H} viewBox={`0 0 ${L.W} ${L.H}`} aria-hidden focusable="false">
          <defs>
            <filter id={id('tree')} x="0" y="0" width="1" height="1" colorInterpolationFilters="sRGB">
              {/* 재료는 검은 바탕에 초록 · 노랑 — 검정이 아닌 곳을 그림으로 */}
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  3 3 3 0 -0.3" result="a" />
              <feFlood className="hp-flood" result="c" />
              <feComposite in="c" in2="a" operator="in" />
            </filter>
            <mask id={id('ring')} maskUnits="userSpaceOnUse" x="0" y="0" width={L.W} height={L.H}>
              <circle data-p="arc" cx={L.cx} cy={L.cy} r={R + 7} fill="none" stroke="#fff" strokeWidth="34"
                strokeDasharray={2 * Math.PI * (R + 7)} strokeDashoffset={2 * Math.PI * (R + 7)} transform={`rotate(180 ${L.cx} ${L.cy})`} />
            </mask>
            <clipPath id={id('clip')}><rect width="533.26" height={CLIP_H + 7} /></clipPath>
            <path id={id('path')} d={ringD} fill="none" />
          </defs>
          <g data-p="land" style={{ opacity: 0 }}>
            <polygon className="hp-land hp-soil" points={soil} />
            {[CLOUD.pts, ...(CLOUD.extra ?? [])].map((s, i) => (
              <polygon key={i} className="hp-land" points={pts(s, (x, y) => [L.cloud.x + x * L.cloud.k, L.cloud.y + y * L.cloud.k])} />
            ))}
            <svg x={L.tree.x} y={L.tree.y} width={L.tree.w} height={L.tree.h} preserveAspectRatio="none"
              viewBox={`${PINE.box[0]} ${PINE.box[1]} ${PINE.box[2] - PINE.box[0]} ${PINE.box[3] - PINE.box[1]}`}>
              <image href={pine} width={PINE.w} height={PINE.h} filter={`url(#${id('tree')})`} />
            </svg>
            <polygon className="hp-land" points={stonePts(PEBBLE, L.pebble.cx, L.pebble.w, L.pebble.h, L.G)} />
            <polygon className="hp-land" points={stonePts(ROCK, L.rock.cx, L.rock.w, L.rock.h, L.G)} />
          </g>
          <g data-p="badge" data-drag="badge">
          <g mask={`url(#${id('ring')})`}>
            <g data-p="spin">
              {[0, 1].map((k) => (
                <text key={k} className="hp-sub"><textPath href={`#${id('path')}`} startOffset={k * Math.PI * R}>{SUB}</textPath></text>
              ))}
            </g>
          </g>
          <text className="hp-mark" textAnchor="middle" transform={`rotate(-15 ${L.cx} ${L.cy})`}>
            <tspan data-p="m1" x={L.cx} y={y1} style={{ opacity: 0 }}>Mega</tspan>
            <tspan data-p="m2" x={L.cx} y={y1 + L.lh * L.fs} style={{ opacity: 0 }}>Font</tspan>
          </text>
          {/* 원 안 빈 곳도 잡히게 — 글자만 잡히면 너무 가늘다 */}
          <circle cx={L.cx} cy={L.cy} r={R + 12} fill="transparent" />
          </g>
          <g data-p="cyan" data-drag="cyan" className="hp-cyan" style={{ display: 'none' }}>{side}{sit}</g>
          <g data-p="red" data-drag="red" className="hp-red" style={{ opacity: 0 }}>
            <g data-p="front">
              <circle fill="currentColor" cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} />
              <path fill="currentColor" d={BODY} />
            </g>
            <g data-p="front-eyes">{frontEye(0)}{frontEye(EYE_FAR_DX)}</g>
            {side}{sit}
          </g>
        </svg>
      )}
      {L && (
        <button type="button" data-p="about" data-drag="about" className="home-poster-about" style={{ bottom: L.H - (L.G - L.rock.h - 12), opacity: 0 }}
          aria-label={aboutLabel} onClick={onAbout}>
          <span>메가폰트에 대해</span><span>더 알아보기</span>
        </button>
      )}
      {skippable && (
        <button type="button" className="home-poster-skip" aria-label="건너뛰기"
          onClick={() => host.current?.dispatchEvent(new Event('megafont-skip'))} />
      )}
    </div>
  );
}
