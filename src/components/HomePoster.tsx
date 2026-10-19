import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { LINEAL_CAP as CAP, RING_R as R, RING_SUB as SUB } from './RingBadge';
import HomeScene, { type SceneLay } from './HomeScene';
import { BODY, CLIP_H, EYE_FAR_DX, EYE_LOOK, EYE_SHUT, EYE_WHITE, HEAD, WALK } from '../character/walker';
import { easeOf, tokenMs } from '../lib/motion';

/**
 * 홈 — 포스터와 스플래시(2026-10-06, 디자이너와 격자로 고름 · 견본 design/home-splash.html).
 *
 * 왼쪽 위 원은 부제가 두 바퀴 돌고(천천히 회전) 그 안에 Mega / Font. 바닥에는 --grey-200 땅과 튜토리얼과 같은 빨강 기운
 * (app.css .info-overlay::after를 같이 쓴다). 물음표 대신 오른쪽 세로쓰기 '메가폰트에 대해 / 더 알아보기'.
 *
 * 2026-10-20 디자이너: 구도는 그대로 두고 풍경(소나무 · 구름 · 바위 · 조약돌)을 걷었다. 바위 자리에 메가폰트(사람 키의 2배 · 오른쪽 여백)가
 * 서서 하늘에 심볼 말풍선을 하나씩 쏘아 짓고, 곁의 두 사람이 반응한다 — HomeScene. 앉아서 이야기하던 장면과 사람 끌기는 빠졌다.
 *
 * 처음 열 때 한 번: 큰 빨강 사람이 화면을 채우고 껌뻑껌뻑 → 옆으로 돌아 8걸음 뚜벅뚜벅 오른쪽 밖으로 — 그 사이 원 글이
 * 그려지고 땅이 드러난다 → Mega · Font → 세로쓰기 → 버튼 → 메가폰트와 두 사람의 장면이 서서히. 누르면 끝 장면으로. 움직임 줄이기면 끝 장면만.
 */

const PLAYED_KEY = 'megafont.splash.v1';

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, p: number) => a + (b - a) * p;

/**
 * 손으로 옮기기(2026-10-06 사용자) — 원(원 글 + Mega Font) · '더 알아보기'. 스플래시가 끝난 뒤부터.
 * 2026-09-20에 '홈이 장난감이 되면 안 된다'며 좌우로 옮기기를 걷었던 것을 디자이너가 다시 열었다.
 * 두 사람 끌기는 2026-10-20에 뺐다 — 심볼에 반응해야 해서(디자이너)
 */
const DRAG_SLOP = 6;          // 이만큼 움직여야 끌기 — 짧게 누르면 링크는 소개로 간다
/** 움직일 수 있다는 기미(2026-10-06 사용자) — 올리면 살짝, 누르면 손에 들린 만큼 커진다 */
const LIFT_HOVER = 1.03, LIFT_PRESS = 1.06;
const MOVED: { badge: [number, number]; badgeScale: number; about: [number, number] } = { badge: [0, 0], badgeScale: 1, about: [0, 0] };
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

interface Lay extends SceneLay { cx: number; cy: number; fs: number; lh: number }

/**
 * 구도 A(design/home-splash.html) — 원이 왼쪽 위, 땅은 버튼 묶음 위. 메가폰트는 옛 바위 자리 — 땅에 서고 오른쪽 끝에서 --pad-x 안쪽,
 * 키는 작은 사람(창 높이의 6.5%)의 2배(디자이너 10-20)
 */
function layout(frame: HTMLElement): Lay | null {
  const gate = frame.querySelector('.home-gate'), layer = frame.querySelector('.home-layer');
  if (!gate || !layer) return null;
  const fr = frame.getBoundingClientRect();
  const W = fr.width, H = fr.height;
  const css = getComputedStyle(layer), root = getComputedStyle(document.documentElement);
  const safeTop = parseFloat(css.paddingTop) || 16;
  const cx = 16 + 14 + R, cy = safeTop + 14 + R;   // 바깥 글자 높이 14
  const G = gate.getBoundingClientRect().top - fr.top - 24;   // --space-section: 땅과 버튼은 다른 섹션
  const pad = parseFloat(root.getPropertyValue('--pad-x')) || 16;
  const mfH = 2 * 0.065 * H, mfW = (mfH * (1169.17 - 787.57)) / 582;   // 작가 'left' 그림의 실루엣 폭 · 키
  return {
    W, H, G, cx, cy,
    fs: parseFloat(root.getPropertyValue('--fs-home-mark')) || 44,
    lh: parseFloat(root.getPropertyValue('--lh-home-mark')) || 0.83,
    skyTop: cy + R + 14,
    mf: { left: W - pad - mfW, top: G + 2 - mfH, w: mfW, h: mfH }
  };
}

const groundY = (G: number, x: number) => G + 2.2 * Math.sin(x / 23) + 1.4 * Math.sin(x / 9.5);

interface Props { onAbout: () => void; aboutLabel: string; }
export default function HomePoster({ onAbout, aboutLabel }: Props) {
  const raw = useId().replace(/:/g, '');
  const id = (s: string) => `hp${raw}${s}`;
  const host = useRef<HTMLDivElement>(null);
  const [lay, setLay] = useState<Lay | null>(null);
  const [skippable, setSkippable] = useState(() => !wasPlayed());
  const start = useRef<number | null>(null);
  const sceneAt = useRef<number | null>(null);   // 메가폰트 장면이 시작하는 때(performance.now) — HomeScene이 프레임마다 읽는다

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
    const red = q<SVGGElement>('[data-p="red"]');
    const rFront = red.querySelector('[data-p="front"]') as SVGGElement, rFrontEyes = red.querySelector('[data-p="front-eyes"]') as SVGGElement;
    const rSide = red.querySelector('[data-p="side"]') as SVGGElement;
    const badge = q<SVGGElement>('[data-p="badge"]');
    const about = el.querySelector('[data-p="about"]') as HTMLElement, gate = frame.querySelector('.home-gate') as HTMLElement;
    const shutFront = qa('[data-p="shut"]'), openFront = qa('[data-p="open"]');

    const IDLE = tokenMs('--t-home-idle', 5000);   // 이만큼 안 만지면 옮긴 것들이 제자리로(2026-10-06 사용자 '5초')
    const HOLD = tokenMs('--t-hold', 700), SLOW = tokenMs('--t-slow', 400), RET = tokenMs('--t-return', 220), TURN = tokenMs('--t-home-ring', 40000);
    const STD = easeOf('--ease-standard'), EMPH = easeOf('--ease-emphasized');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const { W, H, cx, cy } = lay;
    // 시간표(ms) — 걷기 2.8초(8걸음), 그 뒤 움직임은 두 배 길게(디자이너). 글은 걸어 나가기 시작할 때부터 그려진다.
    // 큰 빨강이 오른쪽 밖으로 나가면(back) 메가폰트와 두 사람의 장면이 2 × --t-slow에 걸쳐 드러난다
    const WALK_MS = 4 * HOLD, STEPS = 8;
    const T = { blink: SLOW, turn: SLOW + 2 * HOLD, run: 0, ring: 0, mega: 0, font: 0, vert: 0, gate: 0, back: 0, all: 0 };
    T.run = T.turn + RET; T.ring = T.run; T.mega = T.ring + 4 * SLOW; T.font = T.mega + SLOW; T.vert = T.font + 2 * SLOW; T.gate = T.vert + SLOW;
    T.back = T.run + WALK_MS; T.all = Math.max(T.gate, T.back) + 2 * SLOW;

    const K0 = (W * 1.17) / 390, FEET0 = H + (541.8 - 470) * K0, XOUT = W + HEAD.r * 2 * K0 + 20;   // 처음: 폭을 꽉, 다리는 화면 밖
    const C = 2 * Math.PI * (R + 7);
    const place = (g: SVGGElement, k: number, fx: number, feet: number, sx = 1, tilt = 0) =>
      g.setAttribute('transform', `translate(${fx.toFixed(1)} ${feet.toFixed(1)}) rotate(${tilt.toFixed(2)}) translate(${(-HEAD.cx * k * sx).toFixed(2)} ${(-541.8 * k).toFixed(2)}) scale(${(k * sx).toFixed(4)} ${k.toFixed(4)})`);
    const walkPhase = (t: number, from: number, dur: number, n: number) => {
      const w = clamp((t - from) / dur), i = Math.min(n - 1, Math.floor(w * n)), s = w >= 1 ? 1 : w * n - i;
      return { w, i, p: w >= 1 ? 1 : (i + STD(s)) / n, lift: w > 0 && w < 1 ? Math.sin(Math.PI * s) : 0 };
    };

    const draw = (t: number) => {
      // 큰 빨강 — 등장 · 껌뻑껌뻑 · 돌아섬 · 8걸음으로 오른쪽 밖. 나가면 끝(작은 두 사람은 HomeScene이 그린다)
      const pin = EMPH(clamp(t / SLOW));
      const shut = [[T.blink + HOLD * 0.6, RET], [T.blink + HOLD * 1.3, RET]].some(([a, d]) => t >= a && t < a + d);
      openFront.forEach((e) => { e.style.display = shut ? 'none' : ''; });
      shutFront.forEach((e) => { e.style.display = shut ? '' : 'none'; });
      const pt = clamp((t - T.turn) / RET), squash = 1 - 0.18 * Math.sin(pt * Math.PI), turned = pt >= 0.5;
      const ex = walkPhase(t, T.run, WALK_MS, STEPS);
      if (ex.w < 1) {
        red.style.display = ''; red.style.opacity = String(pin);
        rFront.style.display = turned ? 'none' : ''; rFrontEyes.style.display = turned ? 'none' : '';
        rSide.style.display = turned ? '' : 'none';
        place(red, K0 * (0.92 + 0.08 * pin), lerp(W / 2, XOUT, ex.p), FEET0 - ex.lift * 0.06 * 541.8 * K0, (turned ? -1 : 1) * squash, (ex.i % 2 ? 1 : -1) * 4 * ex.lift);
      } else red.style.display = 'none';
      // 땅 · 원 글 · 로고 · 세로쓰기 · 버튼
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
      for (const k of ['badge', 'about'] as const) {
        const want = k === 'badge' && pinch ? 1 : hand?.kind === k ? LIFT_PRESS : hoverKind === k ? LIFT_HOVER : 1;   // 벌리는 동안은 손가락 크기 그대로 — 여백을 넘지 않게
        grow[k] += (want - grow[k]) * (reduce ? 1 : f);
      }
      badge.setAttribute('transform', `translate(${(MOVED.badge[0] + cx).toFixed(1)} ${(MOVED.badge[1] + cy).toFixed(1)}) scale(${(grow.badge * MOVED.badgeScale).toFixed(4)}) translate(${-cx} ${-cy})`);
      about.style.translate = `${MOVED.about[0].toFixed(1)}px ${MOVED.about[1].toFixed(1)}px`;
      about.style.scale = grow.about.toFixed(4);
    };

    const now = () => performance.now();
    if (start.current === null) start.current = wasPlayed() || reduce ? now() - T.all : now();
    sceneAt.current = start.current + T.back;
    type Kind = 'badge' | 'about';
    let hand: { kind: Kind; id: number; x0: number; y0: number; ox: number; oy: number; moved: boolean; box: DOMRect } | null = null;
    let hoverKind: Kind | null = null, lastT = performance.now();
    let lastTouch = performance.now(), back: { t0: number; badge: [number, number]; scale: number; about: [number, number] } | null = null;
    const displaced = () => MOVED.badge.some((v) => Math.abs(v) > 0.5) || Math.abs(MOVED.badgeScale - 1) > 0.005 || MOVED.about.some((v) => Math.abs(v) > 0.5);
    /** 5초 안 만지면 제자리로 — 원 · 링크가 미끄러진다(2 × --t-slow) */
    const settleBack = (n: number) => {
      if (!back) {
        if (hand || pinch || n - lastTouch < IDLE || !displaced()) return;
        back = { t0: n, badge: [...MOVED.badge], scale: MOVED.badgeScale, about: [...MOVED.about] };
      }
      const pb = reduce ? 1 : EMPH(clamp((n - back.t0) / (2 * SLOW)));
      MOVED.badge = [lerp(back.badge[0], 0, pb), lerp(back.badge[1], 0, pb)];
      MOVED.badgeScale = lerp(back.scale, 1, pb);
      MOVED.about = [lerp(back.about[0], 0, pb), lerp(back.about[1], 0, pb)];
      if (pb >= 1) back = null;
    };
    const grow: Record<Kind, number> = { badge: 1, about: 1 };
    let raf = 0, done = false;
    const tick = () => {
      const t = reduce ? T.all : now() - start.current!;
      if (t >= T.all) settleBack(now());
      draw(t);
      if (!done && t >= T.all) { done = true; markPlayed(); setSkippable(false); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const skip = () => { start.current = Math.min(start.current!, now() - T.all); sceneAt.current = start.current + T.back; };
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
      const [ox, oy] = MOVED[kind];
      hand = { kind, id: e.pointerId, x0: e.clientX, y0: e.clientY, ox, oy, moved: false, box: tgt.getBoundingClientRect() };
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
      if (!hand.moved && Math.hypot(dx, dy) > DRAG_SLOP) hand.moved = true;
      if (!hand.moved) return;
      e.preventDefault();
      lastTouch = now();
      const f = fr(), b = hand.box;
      // 화면 밖으로는 못 나간다 — 잡은 덩어리의 상자가 틀 안에 남게
      const cdx = Math.max(f.left - b.left, Math.min(f.right - b.right, dx));
      const cdy = Math.max(f.top - b.top, Math.min(f.bottom - b.bottom, dy));
      MOVED[hand.kind] = [hand.ox + cdx, hand.oy + cdy];
    };
    const onUp = (e: PointerEvent) => {
      if (!hand || e.pointerId !== hand.id) return;
      lastTouch = now();
      if (hand.moved && hand.kind === 'about') swallowClick = true;   // 끌었으면 소개로 가지 않는다
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
  const frontEye = (dx: number) => (
    <g>
      <circle className="hp-eye" cx={EYE_WHITE.cx + dx} cy={EYE_WHITE.cy} r={EYE_WHITE.r} />
      <circle data-p="open" fill="currentColor" cx={EYE_WHITE.cx + dx} cy={EYE_WHITE.cy} r={EYE_LOOK.r} />
      <path data-p="shut" d={EYE_SHUT} transform={`translate(${dx} 0)`} fill="none" stroke="currentColor" strokeWidth="20" strokeLinecap="round" style={{ display: 'none' }} />
    </g>
  );
  const side = (
    <g data-p="side" style={{ display: 'none' }}>
      <g clipPath={`url(#${id('clip')})`}>
        <circle fill="currentColor" cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} />
        <path fill="currentColor" d={BODY} />
        <circle className="hp-eye" cx={EYE_WHITE.cx} cy={EYE_WHITE.cy} r={EYE_WHITE.r} />
        <circle fill="currentColor" cx={EYE_LOOK.cx} cy={EYE_LOOK.cy} r={EYE_LOOK.r} />
      </g>
      <path fill="currentColor" d={WALK.farRest} />
      <path fill="currentColor" d={WALK.nearRest} />
    </g>
  );

  return (
    <div ref={host} className="home-poster">
      {L && (
        <svg className="home-poster-art" width={L.W} height={L.H} viewBox={`0 0 ${L.W} ${L.H}`} aria-hidden focusable="false">
          <defs>
            <mask id={id('ring')} maskUnits="userSpaceOnUse" x="0" y="0" width={L.W} height={L.H}>
              <circle data-p="arc" cx={L.cx} cy={L.cy} r={R + 7} fill="none" stroke="#fff" strokeWidth="34"
                strokeDasharray={2 * Math.PI * (R + 7)} strokeDashoffset={2 * Math.PI * (R + 7)} transform={`rotate(180 ${L.cx} ${L.cy})`} />
            </mask>
            <clipPath id={id('clip')}><rect width="533.26" height={CLIP_H + 7} /></clipPath>
            <path id={id('path')} d={ringD} fill="none" />
          </defs>
          <g data-p="land" style={{ opacity: 0 }}>
            <polygon className="hp-land hp-soil" points={soil} />
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
          <g data-p="red" className="hp-red" style={{ opacity: 0 }}>
            <g data-p="front">
              <circle fill="currentColor" cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} />
              <path fill="currentColor" d={BODY} />
            </g>
            <g data-p="front-eyes">{frontEye(0)}{frontEye(EYE_FAR_DX)}</g>
            {side}
          </g>
        </svg>
      )}
      {L && <HomeScene lay={L} clock={sceneAt} />}
      {L && (
        <button type="button" data-p="about" data-drag="about" className="home-poster-about" style={{ bottom: L.H - (L.mf.top - 12), opacity: 0 }}
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
