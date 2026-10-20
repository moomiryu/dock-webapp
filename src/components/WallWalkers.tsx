import { useEffect, useRef, type CSSProperties } from 'react';
import { BODY, CLIP_H, EYE_LOOK, EYE_SAD, EYE_SHUT, EYE_SMILE, EYE_UP, EYE_WHITE, EYE_WIDE, FOOT_Y, HEAD, SIT, VIEW, WALK } from '../character/walker';
import { groundPx } from '../lib/ground';
import { easeOf, tokenS } from '../lib/motion';
import type { Perch, SkyPerch } from './WallSky';

/**
 * 벽의 작은 사람 둘(2026-10-04, 디자이너가 움직이는 견본 design/landscape-character-wall.html에서 골랐다) — 빨강(이미 말을 한 사람)과
 * 파랑(아직 메가폰트를 만나기 전). 생김새 · 색 · 크기(벽 높이의 6.5%) · 앉은 자세(walker.ts SIT) · 웃기 · 깜빡이기는 그대로.
 *
 * 2026-10-20(결정 6, 디자이너 — 견본 kv/wall-life.html): 벽의 구도는 역삼각이라 둘은 **로고 바로 양옆**에서만 산다 — 빨강은 가운데에서
 * 왼쪽으로 폭의 8~25%, 파랑은 오른쪽 8~25%. 로고 앞(가운데 폭 16%)에는 서지 않는다(지나가기만). 땅 띠 위를 평평하게 걷는다(부스러기
 * 더미는 그 뒤 배경). "아무 생각 없는 바보들 — 둘이 만나 수다, 앉아서 하늘 풍경 바라보기":
 * - 혼자 — 다음 일을 고를 때 걷기 45% · 땅에 앉아 하늘 올려다보기 35%(7~13초, 검은자가 위에서 좌우로 천천히 오간다) · 서 있기 20%(1.5~4초)
 * - 만남(20~30초에 한 번) — 한 명이 앉고 다른 한 명이 두 배 걸음으로 와 몸 1.9개 거리에 마주 앉아 수다 9초: 1.6초마다 말하는 쪽이 바뀌고,
 *   말하는 쪽은 키의 3% 들썩 + 머리 위(말하는 방향)에 점 세 알이 차례로(그 사람 색, 지름 키의 9%), 듣는 쪽은 2% 끄덕. 그다음 나란히
 *   앉은 채 함께 하늘 8초, 그리고 각자 자리로
 * - 도킹 — 수다든 앉기든 멈추고 일어나 큰 말 쪽(가운데)으로 돌아서 올려다본다(EYE_UP). 글자가 한 박씩 설 때마다 0.32초 폴짝. 새 말이
 *   하늘로 오르기 시작하면 다시 제 일로(beat — WallSky가 적는다). 2026-10-21부터 호들갑스럽게(아래 FUSS — 화들짝 뛰고, 도킹마다 둘이
 *   깜짝 폴짝 · 동동 · 우왕좌왕 중 서로 다른 하나씩. 그전엔 글자마다 키의 0.22만큼 폴짝뿐이었다)
 * - 하늘 나들이(2026-10-20, 디자이너가 견본 셋 — 나들이 · 징검다리 · 통통 — 중 나들이 + 징검다리를 이어 붙여, 둘 다) — 30~50초에 한 번
 *   서 있거나 앉아 있던 이가 가까운(낮은) 말풍선 끝 옆까지 종종걸음으로 가서 옆으로 솟아 윗선에 오른다 → 이웃 말풍선으로 2~4번 건너다니고
 *   (건너기 전 1~2.5초 서 있거나 윗선을 몇 걸음) → 마지막 말풍선에서 12~18초 앉아 함께 떠다니며 하늘을 본다 → 가까운 끝까지 걸어가 바깥으로
 *   뛰어내려 제 구역으로. 글자를 가리지 않게 윗선 위, 사람 상자가 다른 말의 몸통과 안 겹치는 곳만 딛는다(자리 · 윗선은 WallSky가 내준다).
 *   다음에 터질 말엔 오르지 않고, 딛던 말이 터지거나 도킹이 오면 눈이 동그래져 땅으로 떨어진다
 * 그전(10-04 ~ 10-19)의 돌에 맞아 넘어지기 · 큰 돌 피해 달아나기 · 큰 나무 올려다보기는 돌 · 나무와 함께 걷었다.
 * 움직임 줄이기를 켠 화면에서는 제 구역에 앉아 가만히 있다.
 */

/** 키 = 벽 높이의 6.5%(실물 약 9cm) — 4.5 · 6.5 · 9% 중 */
const SIZE = 0.065;
/** 둘의 색 — 빨강(이미 말을 한 사람) · 파랑(홈에서 메가폰트를 만나기 전의 색) */
const COLORS = ['--brand-main', '--char-cyan'];
const TOP = 4, STAND_H = FOOT_Y - TOP, CX = HEAD.cx, BODY_W = 2 * HEAD.r;
/** 그림 둘레의 여유(화판 좌표) — 앉으면 발이 앞으로 나온다 */
const VB = { x: -240, y: -170, w: VIEW.w + 480, h: VIEW.h + 230 };
/** 구역 — 화면 폭의 몫(빨강 왼쪽 · 파랑 오른쪽) */
const ZONES: readonly (readonly [number, number])[] = [[0.25, 0.42], [0.58, 0.75]];
/** 로고 앞을 지나던 중 도킹이 오면 비켜 설 띠 — 가까운 쪽 칸 끝 바깥 이 폭(화면 폭의 몫) 안 아무 데나, 끝에서 그 폭의 20%는 띄운다(점검 둘째:
 *  늘 칸 끝 한 점에 서서 — 걸음이 2px 앞에서 멈춰 칸 안쪽이었다 — 그대로 앉아 파랑은 합 49.9초 · 빨강은 62.3초를 로고 칸 경계에 있었다) */
const ASIDE = 0.06;
/** 하는 일의 몫 · 길이(초) — 견본 값 */
const DAY = { walk: 0.45, sky: 0.35, sit: [7, 13], stand: [1.5, 4], rest: [0.5, 2] };
/** 만남 — 첫 만남 · 간격(초) · 거리(몸 폭의 배수) · 수다 · 말하는 쪽이 바뀌는 간격 · 함께 하늘 보기(초) */
const MEET = { first: [8, 14], every: [20, 30], gap: 1.9, talk: 9, turn: 1.6, sky: 8 };
/** 도킹의 폴짝 — 키의 몫 · 초 */
const HOP = { t: 0.32 };
/**
 * 도킹 호들갑(2026-10-21 디자이너 "도킹 때의 리액션이 더 호들갑" → 견본 셋 '다 좋다' → 도킹마다 두 사람이 셋 중 하나씩, 서로 다르게):
 * a 깜짝 폴짝 · b 동동(내내 제자리에서 뛰며 몸을 흔들고 눈은 올려다봄 ↔ 웃음) · c 우왕좌왕(좌우로 종종 뛰어다니다 선다). 셋 다 도킹 순간
 * 눈이 동그래지며 화들짝 뛴다(--t-hold). 화들짝 높이 · 글자마다 폴짝 높이(키의 몫) · 동동 높이(키의 몫) · 몸 흔들기(라디안) · 뛰어다니는
 * 시간(초) · 한 번 오가는 시간(초) · 오가는 폭(몸 폭의 배수)
 */
type Fuss = 'a' | 'b' | 'c';
const FUSS = { jump: { a: 0.85, b: 0.5, c: 0.85 }, hop: { a: 0.45, b: 0.5, c: 0.45 }, bob: 0.2, sway: 0.14, dash: 3.5, lap: 1.4, reach: 1.6 } as const;
/** 시간은 --t-hold의 배수(H) — 웃기 · 깜빡이기 · 발 까딱(옛 값 그대로) · 나오는 때(초) */
const T = { popAt: [1, 3], smileGap: [2.5, 4], smileDur: 3, blink: [3, 7], kick: 4 };
/**
 * 하늘 나들이 — 나서는 간격(초, 한 번에 한 명이 나서고 이미 하늘에 있어도 다른 이가 나설 수 있다) · 나설 수 없을 때 다시 보는 간격 · 건너기 수 ·
 * 건너기 전 머묾 · 끝에 앉아 있기 · 윗선에 묻히는 깊이(u) · 다른 말과 띄울 여유(u — 떠다님만큼) · 건너갈 거리(화면 폭의 몫)
 */
const TRIP = { every: [30, 50], retry: 3, hops: [2, 4], stay: [1, 2.5], sit: [12, 18], sink: 0.1, clear: 1.3, reach: 0.35 };
/** 뛰기 — 웅크림 · 늘어남 · 착지 눌림(키의 몫) */
const JUMP = { crouch: 0.18, stretch: 0.1, land: 0.2 };

/** 도킹의 박자 — 큰 말이 선 때 · 글자마다 다 쌓인 때 · 하늘로 오르기 시작하는 때(초, performance.now 기준. 아직 모르면 Infinity) */
export type DockBeat = { start: number; letters: readonly number[]; rise: number };
type Mode = 'off' | 'pop' | 'walk' | 'sit' | 'idle' | 'jump';
type P = [number, number];
/** 하늘 말 위의 자리 — 말 id · 말 좌표의 가로(u) · 걸어갈 곳(u) */
type Spot = { id: string; lx: number; tx: number };
/**
 * 공중 — 뛴 때 · 웅크림(초) · 날아가는 시간 · 뛴 자리(px) · 닿을 곳(하늘 자리 또는 땅의 가로 px) · 정점 높이(px) · 뛸 때 기울기 · 놀라 떨어지나 ·
 * 길(up = 말 옆으로 솟았다 넘어가 앉는다 — 가로는 늦게, down = 바깥으로 먼저 나가 떨어진다 — 가로는 일찍. 말 앞을 지나며 글자를 덮지 않게)
 */
type Air = { t0: number; crouch: number; dur: number; from: P; to: Spot | number; h: number; rot0: number; scared: boolean; path: 'up' | 'down' | 'arc' };
/** 나들이 — 남은 건너기 · 머물렀나 · 앉았나 · 땅에서 뛰어오를 자리(말 옆까지 걸어가서 뛴다) · 내려갈 끝(왼 −1 · 오른 1, 정하면 그대로) */
type Trip = { hops: number; stayed: boolean; sat: boolean; board: Spot | null; down?: number };
type Look = 'ahead' | 'sky' | 'friend';
type Eye = 'look' | 'wide' | 'shut' | 'smile' | 'sad' | 'up';
type Parts = {
  svg: SVGSVGElement; flip: SVGGElement; walkLegs: SVGGElement; sitLegs: SVGGElement; far: SVGGElement; near: SVGGElement;
  drop: SVGGElement; stand: SVGPathElement; seat: SVGPathElement; eyes: Record<Eye, SVGElement>; anims: SVGAnimationElement[]; dots: HTMLElement[];
};
type Walker = {
  el: HTMLDivElement; p: Parts; mode: Mode; zone: readonly [number, number]; t0: number; x: number; face: 1 | -1; tx: number; fast: number;
  until: number; look: Look; sitT: number; pop: number; walking: boolean; anim: boolean; pace: number; ph: number;
  nextBlink: number; blinkUntil: number; nextSmile: number; smileUntil: number; eye: Eye;
  /** 하늘 놀이 — 딛고 선 하늘 자리 · 공중 · 나들이 · 내려선 때 · 그 순간 발 자리(px) · 기울기 */
  on: Spot | null; air: Air | null; trip: Trip | null; land: number; fx: number; fy: number; rot: number;
  /** 이번 도킹의 호들갑 · 그걸 고른 도킹(큰 말이 선 때) */
  fuss: Fuss; fussAt: number;
};

const rnd = (r: readonly number[]) => r[0] + Math.random() * (r[1] - r[0]);
const rndInt = (r: readonly number[]) => Math.floor(r[0] + Math.random() * (r[1] - r[0] + 1));
const clamp = (k: number) => Math.min(1, Math.max(0, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export default function WallWalkers({ beat, sky }: { beat?: { current: DockBeat | null }; sky?: { current: SkyPerch | null } }) {
  const root = useRef<HTMLDivElement>(null);
  const beatRef = useRef(beat), skyRef = useRef(sky);
  beatRef.current = beat;
  skyRef.current = sky;

  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const HOLD = tokenS('--t-hold', 0.7), SLOW = tokenS('--t-slow', 0.4), RET = tokenS('--t-return', 0.22);
    const easeStd = easeOf('--ease-standard'), easeEmph = easeOf('--ease-emphasized');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const start = performance.now() / 1000;

    const els = [...host.querySelectorAll<HTMLDivElement>('.wall-walker')];
    const ws: Walker[] = els.map((el, i) => {
      const q = <E extends Element>(sel: string) => el.querySelector(sel) as E;
      const p: Parts = {
        svg: q('svg'), flip: q('[data-p="flip"]'), walkLegs: q('[data-p="walk"]'), sitLegs: q('[data-p="sit"]'),
        far: q('[data-p="far"]'), near: q('[data-p="near"]'), drop: q('[data-p="drop"]'), stand: q('[data-p="stand"]'), seat: q('[data-p="seat"]'),
        eyes: { look: q('[data-eye="look"]'), wide: q('[data-eye="wide"]'), shut: q('[data-eye="shut"]'), smile: q('[data-eye="smile"]'), sad: q('[data-eye="sad"]'), up: q('[data-eye="up"]') },
        anims: [...el.querySelectorAll<SVGAnimationElement>('animate, animateTransform')],
        dots: [...host.querySelectorAll<HTMLElement>(`.wall-walker-dot[data-w="${i}"]`)]
      };
      p.svg.pauseAnimations();
      return {
        el, p, mode: 'off', zone: ZONES[i] ?? ZONES[0], t0: start + HOLD * rnd(T.popAt), x: 0, face: i ? 1 : -1, tx: 0, fast: 1, until: 0, look: 'ahead',
        sitT: 0, pop: 0, walking: false, anim: false, pace: 0, ph: i * 1.3, nextBlink: 0, blinkUntil: 0, nextSmile: 0, smileUntil: 0, eye: 'look',
        on: null, air: null, trip: null, land: -Infinity, fx: 0, fy: 0, rot: 0, fuss: 'a', fussAt: NaN
      };
    });

    // ── 벽 크기
    let W = 0, Hh = 0, floor = 0, hc = 0, s = 0, cw = 0, speed = 0, walkMs = WALK.ms;
    const layout = () => {
      const prevW = W;
      W = window.innerWidth; Hh = window.innerHeight; floor = Hh - groundPx(Hh);
      hc = Hh * SIZE; s = hc / STAND_H; cw = BODY_W * s;
      // 걸음 = 키의 0.36배/초(홈과 같은 보폭), 초당 30px(1080 벽) 아래로는 안 내려가고 그만큼 발을 빨리(종종걸음)
      const natural = hc * 0.36;
      speed = Math.max(natural, (30 / 1080) * Hh);
      walkMs = WALK.ms * (natural / speed);
      for (const w of ws) {
        w.p.svg.style.width = `${VB.w * s}px`; w.p.svg.style.height = `${VB.h * s}px`;
        w.el.style.transformOrigin = `${(CX - VB.x) * s}px ${(FOOT_Y - VB.y) * s}px`;
        if (prevW) { w.x *= W / prevW; w.tx *= W / prevW; }
        w.pace = 0;   // 다리 박자를 다시 적게
        for (const d of w.p.dots) { d.style.width = d.style.height = `${(0.09 * hc).toFixed(1)}px`; }
      }
    };
    const inZone = (w: Walker) => W * (w.zone[0] + Math.random() * (w.zone[1] - w.zone[0]));
    /** 로고 앞(가운데 폭 16% — 두 구역 사이) — 걸어서 지나가기만 하고, 앉기 · 서기 · 만남 자리로 고르지 않는다(결정 6 · 20) */
    const logo = (x: number) => x > W * ZONES[0][1] && x < W * ZONES[1][0];
    const offLogo = (x: number) => { const d = ASIDE * (0.2 + 0.8 * Math.random()); return x < W / 2 ? W * (ZONES[0][1] - d) : W * (ZONES[1][0] + d); };
    const go = (w: Walker, tx: number, fast = 1) => { w.mode = 'walk'; w.tx = tx; w.fast = fast; };
    const sitFor = (w: Walker, now: number, sec: number, look: Look) => { w.mode = 'sit'; w.until = now + sec; w.look = look; w.nextBlink = now + HOLD * rnd([2, 5]); };

    // ── 하늘 놀이 — 말 위의 발 자리 · 딛을 자리 고르기 · 뛰기 · 놀라 떨어지기
    /** 말 좌표(u)의 가로 lx 위 발 자리(px) — 발 폭 안 가장 높은 윗끝에 조금 묻혀 선다 */
    const spotXY = (p: Perch, lx: number): P => {
      const fw = (0.3 * cw) / p.u, y = (p.top(lx - fw, lx + fw) ?? p.top(lx - 3 * fw, lx + 3 * fw) ?? 0) + TRIP.sink, c = Math.cos(p.rot), sn = Math.sin(p.rot);
      return [p.X + p.u * (lx * c - y * sn), p.Y + p.u * (lx * sn + y * c)];
    };
    /** 말의 몸통이 화면에서 차지하는 상자 — 여유 e(u, 기본은 떠다님만큼)를 두고 */
    const boxOf = (p: Perch, e = TRIP.clear) => {
      const b = p.body, c = Math.cos(p.rot), sn = Math.sin(p.rot);
      const cs = [[b[0], b[1]], [b[2], b[1]], [b[0], b[3]], [b[2], b[3]]].map(([x, y]) => [p.X + p.u * (x * c - y * sn), p.Y + p.u * (x * sn + y * c)]);
      return [Math.min(...cs.map((q) => q[0])) - e * p.u, Math.min(...cs.map((q) => q[1])) - e * p.u, Math.max(...cs.map((q) => q[0])) + e * p.u, Math.max(...cs.map((q) => q[1])) + e * p.u];
    };
    /** 사람이 차지하는 상자 — 발(x, y)에서 몸 폭 × 키, 말과 함께 기울면(rot) 기운 채로 */
    const meBox = (x: number, y: number, rot = 0) => {
      const c = Math.cos(rot), sn = Math.sin(rot), cs = [[-0.6 * cw, 0], [0.6 * cw, 0], [-0.6 * cw, -1.05 * hc], [0.6 * cw, -1.05 * hc]].map(([a, b]) => [x + a * c - b * sn, y + a * sn + b * c]);
      return [Math.min(...cs.map((q) => q[0])), Math.min(...cs.map((q) => q[1])), Math.max(...cs.map((q) => q[0])), Math.max(...cs.map((q) => q[1]))];
    };
    const hit = (a: number[], b: number[]) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    /** 정점 높이 — 오를 땐 닿는 곳보다 위(떨어지며 닿는다), 내릴 땐 살짝 뛰었다 떨어진다, 놀라 떨어질 땐 거의 그대로 */
    const arcH = (R: number, scared = false) => (scared ? 0.1 * hc : R > 0 ? R / 4 + 0.6 * hc : 0.5 * hc);
    /** 가로가 따라가는 정도 — up은 늦게(옆으로 솟았다 넘어간다), down은 일찍(바깥으로 먼저 나간다) */
    const along = (path: Air['path'], k: number) => (path === 'up' ? k * k : path === 'down' ? 1 - (1 - k) ** 2 : k);
    /** 뛸 길이 다른 말 앞을 지나지 않나 — 길 위 아홉 점에서 사람 상자가 떠난 말 · 닿을 말이 아닌 말의 몸통과 겹치지 않는지(글자를 가리지 않게) */
    const clear = (from: P, to: P, path: Air['path'], ps: Map<string, Perch>, skip: readonly string[]) => {
      const h = arcH(from[1] - to[1]), boxes = [...ps.values()].filter((p) => !skip.includes(p.id)).map((p) => boxOf(p, 0));
      for (let i = 1; i < 10; i++) {
        const k = i / 10, me = meBox(lerp(from[0], to[0], along(path, k)), lerp(from[1], to[1], k) - 4 * h * k * (1 - k));
        if (boxes.some((b) => hit(me, b))) return false;
      }
      return true;
    };
    /** 딛을 자리 — 윗선을 몸 반 폭씩 훑어, 사람 상자(몸 폭 × 키)가 화면 안이고 다른 말의 몸통과 안 겹치고(글자를 가리지 않게) 다른 사람과 떨어진 곳.
        다음에 터질 말엔 오르지 않는다 */
    const spots = (w: Walker, ps: Map<string, Perch>, but?: string) => {
      const out: { s: Spot; x: number; y: number; end: number }[] = [], boxes = [...ps.values()].map((p) => [p.id, boxOf(p)] as const);
      const others = ws.filter((o) => o !== w).map((o) => (o.air && typeof o.air.to !== 'number' && ps.has(o.air.to.id) ? spotXY(ps.get(o.air.to.id)!, o.air.to.lx) : [o.fx, o.fy]));
      for (const p of ps.values()) {
        if (p.old || p.id === but) continue;
        const half = (0.45 * cw) / p.u, mid = (p.span[0] + p.span[1]) / 2;
        const xs = p.span[1] - p.span[0] < 2 * half ? [mid] : Array.from({ length: Math.floor((p.span[1] - p.span[0] - 2 * half) / half) + 1 }, (_, i) => p.span[0] + half + i * half);
        xs.forEach((lx, i) => {
          if (p.top(lx - (0.3 * cw) / p.u, lx + (0.3 * cw) / p.u) === null) return;
          const [x, y] = spotXY(p, lx), me = meBox(x, y, p.rot);
          if (me[0] < 0 || me[2] > W || me[1] < 0.02 * Hh) return;
          if (boxes.some(([id, b]) => id !== p.id && hit(me, b))) return;
          if (others.some(([ox, oy]) => Math.abs(ox - x) < 1.3 * cw && Math.abs(oy - y) < hc)) return;
          // 양 끝 자리(왼 −1 · 오른 1) — 땅에서는 끝으로만 오른다
          out.push({ s: { id: p.id, lx, tx: lx }, x, y, end: xs.length < 2 ? 0 : i === 0 ? -1 : i === xs.length - 1 ? 1 : 0 });
        });
      }
      return out;
    };
    /** 가까운 셋 중 하나 — 땅에서 오를 땐 낮은 말일수록 */
    const pick = <Q extends { x: number; y: number }>(w: Walker, list: Q[], up: boolean): Q | null => {
      const cost = (a: Q) => Math.abs(a.x - w.fx) + (up ? 0.5 * (floor - a.y) : Math.abs(a.y - w.fy));
      const best = list.sort((a, b) => cost(a) - cost(b)).slice(0, 3);
      return best.length ? best[Math.floor(Math.random() * best.length)] : null;
    };
    /** 땅에 닿을 가로 — 화면 안, 로고 앞이면 칸 바깥 띠로 */
    const groundX = (x: number) => { const g = Math.min(W * 0.97, Math.max(W * 0.03, x)); return logo(g) ? offLogo(g) : g; };
    /** 뛴다 — 오를 땐 정점이 닿는 곳보다 위(떨어지며 닿는다), 놀라 떨어질 땐 웅크림 없이 */
    const leap = (w: Walker, now: number, to: Spot | number, ps: Map<string, Perch>, o: { scared?: boolean; path?: Air['path'] } = {}) => {
      const p = typeof to === 'number' ? null : ps.get(to.id), [tx, ty] = p ? spotXY(p, (to as Spot).lx) : [to as number, floor];
      const R = w.fy - ty, h = arcH(R, o.scared);
      const d = Math.max(Math.abs(R), Math.abs(tx - w.fx), 2 * h);
      w.air = { t0: now, crouch: o.scared ? 0 : RET, dur: HOLD * (0.7 + 0.25 * Math.sqrt(d / hc)), from: [w.fx, w.fy], to, h, rot0: w.rot, scared: !!o.scared, path: o.path ?? 'arc' };
      w.on = null; w.mode = 'jump';
      if (Math.abs(tx - w.fx) > 2) w.face = tx < w.fx ? 1 : -1;
    };
    /** 딛던 말 · 가던 말이 사라졌다(터짐 · 도킹) — 놀라 땅으로 */
    const fall = (w: Walker, now: number, ps: Map<string, Perch>) => { w.trip = null; leap(w, now, groundX(w.fx), ps, { scared: true }); };
    /** 공중의 한 걸음 — 닿을 곳은 매번 다시 잰다(말이 떠다니니). 닿으면 말 위에 서거나 땅에 내려 제 구역으로 */
    const fly = (w: Walker, now: number, ps: Map<string, Perch>) => {
      const a = w.air!;
      if (typeof a.to !== 'number' && !ps.has(a.to.id)) { fall(w, now, ps); return; }
      const p = typeof a.to === 'number' ? null : ps.get(a.to.id)!, [tx, ty] = p ? spotXY(p, (a.to as Spot).lx) : [a.to as number, floor];
      const k = clamp((now - a.t0 - a.crouch) / a.dur);
      w.fx = lerp(a.from[0], tx, along(a.path, k)); w.fy = lerp(a.from[1], ty, k) - 4 * a.h * k * (1 - k); w.rot = lerp(a.rot0, p ? p.rot : 0, k);
      if (k < 1) return;
      w.air = null; w.land = now; w.mode = 'idle'; w.until = now + RET;
      if (p) { w.on = { ...(a.to as Spot) }; return; }
      w.x = w.tx = a.to as number; w.trip = null; w.until = now + rnd(DAY.rest);
      if (!docking(now) && (w.x < W * w.zone[0] || w.x > W * w.zone[1])) go(w, inZone(w));   // 제 구역 밖에 내렸으면 걸어서 돌아간다
    };
    /** 말 위에서 다음 일 — 건너기 전 머묾(서 있거나 윗선을 몇 걸음) · 이웃 말로 건너기 · 마지막 말에서 앉아 하늘 보기 · 제 구역으로 내려오기 */
    const tripStep = (w: Walker, now: number, ps: Map<string, Perch>) => {
      const t = w.trip!, on = w.on!;
      if (t.hops > 0 && !t.stayed) {
        t.stayed = true;
        const here = Math.random() < 0.5 ? pick(w, spots(w, ps).filter((q) => q.s.id === on.id && Math.abs(q.s.lx - on.lx) > 1), false) : null;
        if (here) { on.tx = here.s.lx; w.mode = 'walk'; } else { w.mode = 'idle'; w.until = now + rnd(TRIP.stay); w.look = 'ahead'; }
        return;
      }
      if (t.hops > 0) {
        const to = pick(w, spots(w, ps, on.id).filter((q) => Math.abs(q.x - w.fx) < TRIP.reach * W && clear([w.fx, w.fy], [q.x, q.y], 'arc', ps, [on.id, q.s.id])), false);
        t.stayed = false;
        if (to) { t.hops--; leap(w, now, to.s, ps); return; }
        t.hops = 0;
      }
      if (!t.sat) { t.sat = true; sitFor(w, now, rnd(TRIP.sit), 'sky'); return; }
      // 내려온다 — 끝까지 윗선을 걸어가서 바깥으로 뛰어내린다(제 구역 밖이면 땅에서 걸어 돌아간다). 가까운 끝부터, 그 길이 다른 말 앞을 지나면 먼 끝
      const p = ps.get(on.id)!, half = (0.45 * cw) / p.u, near = on.lx < (p.span[0] + p.span[1]) / 2 ? -1 : 1;
      if (t.down === undefined) {
        const way = (side: number) => {
          const lx = p.span[1] - p.span[0] < 2 * half ? on.lx : side < 0 ? p.span[0] + half : p.span[1] - half, [x, y] = spotXY(p, lx);
          return clear([x, y], [groundX(x + side * 1.3 * cw), floor], 'down', ps, [on.id]);
        };
        t.down = way(near) || !way(-near) ? near : -near;
      }
      const side = t.down, endLx = p.span[1] - p.span[0] < 2 * half ? on.lx : side < 0 ? p.span[0] + half : p.span[1] - half;
      if (Math.abs(on.lx - endLx) * p.u > 4) { on.tx = endLx; w.mode = 'walk'; return; }
      leap(w, now, groundX(w.fx + side * 1.3 * cw), ps, { path: 'down' });
    };

    // ── 만남 — 한 명(v)이 앉은 다른 이(h)에게 가서 마주 앉아 수다, 그다음 나란히 하늘, 그리고 각자 자리로
    let meet: { v: Walker; h: Walker; phase: 'go' | 'chat' | 'sky'; t: number } | null = null, nextMeet = start + rnd(MEET.first);
    const docking = (now: number) => { const b = beatRef.current?.current; return !!b && now >= b.start && now < b.rise; };
    /** 이번 도킹에 로고 앞에서 비켜서는 중인 사람 — 띠를 벗어나도 고른 자리에 닿을 때까지 걷는다(결정 20) */
    const aside = new Set<Walker>();
    let nextTrip = start + rnd(TRIP.every);
    const brain = (now: number, ps: Map<string, Perch>) => {
      if (docking(now)) { meet = null; for (const w of ws) w.trip = null; return; }
      if (!meet && now > nextMeet && ws.length > 1 && ws.every((w) => w.mode !== 'off' && w.mode !== 'pop' && !w.trip && !w.on && !w.air)) {
        const v = ws[Math.random() < 0.5 ? 0 : 1], h = ws[v === ws[0] ? 1 : 0], side = v.x < h.x ? -1 : 1;
        // 앉을 이가 걷는 중이거나 로고 앞이면 다음에 — 그 자리에 앉혀 버린다(결정 20: 실제 벽에서 빨강이 로고 위에 섰다)
        if (h.mode === 'walk' || logo(h.x)) { nextMeet = now + 1; return; }
        // 곁자리가 로고 앞이면 반대쪽 곁으로 — 구역 안쪽 끝에 앉은 이 곁은 로고 칸에 걸린다
        let to = h.x + side * MEET.gap * cw;
        if (logo(to)) to = h.x - side * MEET.gap * cw;
        meet = { v, h, phase: 'go', t: now };
        sitFor(h, now, Infinity, 'friend'); h.face = v.x < h.x ? 1 : -1;
        go(v, to, 2);
      }
      if (meet) {
        const { v, h } = meet;
        if (meet.phase === 'go' && v.mode !== 'walk') { meet.phase = 'chat'; meet.t = now; sitFor(v, now, Infinity, 'friend'); v.face = h.x < v.x ? 1 : -1; h.face = v.x < h.x ? 1 : -1; }
        if (meet.phase === 'chat' && now > meet.t + MEET.talk) { meet.phase = 'sky'; meet.t = now; v.look = h.look = 'sky'; }   // 수다 뒤엔 나란히 하늘을 본다
        if (meet.phase === 'sky' && now > meet.t + MEET.sky) { go(v, inZone(v)); h.mode = 'idle'; h.until = now + 1; meet = null; nextMeet = now + rnd(MEET.every); }
        return;   // 만나는 동안엔 따로 놀지 않는다
      }
      // 하늘 나들이 — 서 있거나 앉아 있던 이가 가까운(낮은) 말의 끝 옆까지 종종걸음으로 가서 뛰어오른다. 다른 이가 하늘에 있어도 나선다
      if (ps.size && now > nextTrip) {
        nextTrip = now + TRIP.retry;   // 나설 이(걷는 중이면 안 나선다) · 글자를 안 가리는 자리가 없으면 차례를 버리지 않고 곧 다시 본다
        const free = ws.filter((w) => !w.trip && !w.on && !w.air && (w.mode === 'idle' || w.mode === 'sit') && !logo(w.x));
        if (free.length) {
          const w = free[Math.floor(Math.random() * free.length)];
          // 뛰어오를 자리 = 그 끝의 바깥 옆 땅(x) — 가까운 곳 · 낮은 말일수록. 화면을 가로질러 오래 걷지 않게 건너갈 거리 안에서만, 오르는 길이
          // 다른 말 앞을 지나지 않는 곳만
          const to = pick(w, spots(w, ps).filter((q) => q.end).map((q) => ({ ...q, x: groundX(q.x + q.end * 1.3 * cw), top: [q.x, q.y] as P }))
            .filter((q) => Math.abs(q.x - w.fx) < TRIP.reach * W && clear([q.x, floor], q.top, 'up', ps, [q.s.id])), true);
          if (to) {
            w.trip = { hops: rndInt(TRIP.hops), stayed: false, sat: false, board: to.s };
            go(w, to.x, 2);
            nextTrip = now + rnd(TRIP.every);
          }
        }
      }
      for (const w of ws) {   // 혼자 — 걷다 · 서다 · 앉아 하늘 바라보기(말 위에 있으면 나들이의 다음 일)
        if (w.trip) {
          if (w.on && w.mode !== 'walk' && now >= w.until) tripStep(w, now, ps);
          // 뛰어오를 자리에 닿았다 — 말 옆으로 솟았다 넘어가 앉는다. 그새 그 끝을 다른 이가 차지했으면 같은 말의 가까운 끝으로, 말이
          // 사라졌거나 끝이 다 막혔으면 그만둔다
          else if (!w.on && !w.air && w.trip.board && w.mode !== 'walk') {
            const id = w.trip.board.id, b = spots(w, ps).filter((q) => q.s.id === id && q.end).sort((p, q) => Math.abs(p.x - w.fx) - Math.abs(q.x - w.fx))[0];
            w.trip.board = null;
            if (b) leap(w, now, b.s, ps, { path: 'up' }); else w.trip = null;
          }
          continue;
        }
        if (w.on || w.air) continue;
        if (w.mode === 'off' || w.mode === 'pop' || w.mode === 'walk' || now < w.until) continue;
        const r = Math.random();
        if (r < DAY.walk) go(w, inZone(w));
        else if (r < DAY.walk + DAY.sky) sitFor(w, now, rnd(DAY.sit), 'sky');
        else { w.mode = 'idle'; w.until = now + rnd(DAY.stand); w.look = 'ahead'; }
      }
    };
    /** 수다에서 지금 말하는 쪽 */
    const speakerOf = (now: number) => (meet && meet.phase === 'chat' && !docking(now) ? (Math.floor((now - meet.t) / MEET.turn) % 2 ? meet.h : meet.v) : null);

    // ── 한 걸음
    const step = (w: Walker, now: number, dt: number, ps: Map<string, Perch>) => {
      if (w.mode === 'off') {
        if (reduce.matches || now > w.t0) { w.x = inZone(w); w.tx = w.x; w.mode = 'pop'; w.t0 = now; w.pop = 0; w.el.style.display = ''; }
        return;
      }
      if (reduce.matches) {
        if (w.on || w.air) w.x = inZone(w);   // 하늘에 있었으면 제 구역 땅으로
        w.on = w.air = w.trip = null; w.mode = 'sit'; w.pop = w.sitT = 1; w.walking = false; w.until = Infinity; w.look = 'ahead'; return;
      }
      if (w.mode === 'pop') { w.pop = Math.min(1, (now - w.t0) / SLOW); if (w.pop >= 1) { w.mode = 'idle'; w.until = now + rnd(DAY.rest); } return; }
      if ((w.mode === 'walk' || w.mode === 'sit') && now >= w.nextSmile) {
        if (w.nextSmile) w.smileUntil = now + HOLD * T.smileDur;
        w.nextSmile = Math.max(now, w.smileUntil) + HOLD * rnd(T.smileGap);
      }
      // 하늘 놀이 — 공중이면 날아가고, 말 위면 그 말을 따라 떠다닌다(윗선을 걷기도). 딛던 말이 사라지면 놀라 땅으로
      if (w.air) { fly(w, now, ps); return; }
      if (w.on) {
        const p = ps.get(w.on.id);
        if (!p) { fall(w, now, ps); fly(w, now, ps); return; }
        if (w.mode === 'walk') {
          const d = w.on.tx - w.on.lx;
          w.face = d < 0 ? 1 : -1; w.look = 'ahead';
          if (Math.abs(d) * p.u < 2) { w.mode = 'idle'; w.until = now + rnd(TRIP.stay); } else { w.on.lx += Math.sign(d) * Math.min(Math.abs(d), (speed * dt) / p.u); w.walking = true; }
        }
        [w.fx, w.fy] = spotXY(p, w.on.lx); w.rot = p.rot;
        // 머무는 사이 이웃 말이 떠다니다 다가와 사람과 겹치면 일찍 일어나 다음 일로(글자를 가리지 않게)
        if (w.trip && w.mode !== 'walk' && now < w.until && [...ps.values()].some((o) => o.id !== p.id && hit(meBox(w.fx, w.fy, w.rot), boxOf(o, 0)))) w.until = now;
        if (w.mode === 'sit' && now > w.nextBlink && now >= w.smileUntil) { w.blinkUntil = now + RET; w.nextBlink = now + HOLD * rnd(T.blink); }
        return;
      }
      // 도킹 — 제자리에 서서 올려다본다(그리기). 로고 앞을 지나던 중이면 가까운 쪽 칸 바깥 띠까지 걸어 나가서 선다(결정 20) — 자리는 한 번만
      // 고르고, 띠를 벗어난 뒤에도 그 자리까지 걷는다(벗어나는 순간 서면 띠 가장자리 0~2.5px 밖에 섰다 — 셋째 점검)
      if (!docking(now)) aside.delete(w);
      else if (!(w.mode === 'walk' && (logo(w.x) || aside.has(w)))) return;
      else if (!aside.has(w)) { w.tx = offLogo(w.x); aside.add(w); }
      if (w.mode === 'walk') {
        const dx = w.tx - w.x;
        w.face = dx < 0 ? 1 : -1; w.look = 'ahead';
        if (Math.abs(dx) < 2) { w.mode = 'idle'; w.until = now + rnd(DAY.rest); return; }
        if (w.pace !== w.fast) { w.pace = w.fast; for (const a of w.p.anims) a.setAttribute('dur', `${Math.round(walkMs / w.fast)}ms`); }
        w.x += Math.sign(dx) * Math.min(Math.abs(dx), speed * w.fast * dt);
        w.walking = true;
      }
      if (w.mode === 'sit' && now > w.nextBlink && now >= w.smileUntil) { w.blinkUntil = now + RET; w.nextBlink = now + HOLD * rnd(T.blink); }
    };

    // ── 그리기
    const setEye = (w: Walker, e: Eye) => {
      if (w.eye === e) return;
      w.p.eyes[w.eye].style.display = 'none'; w.p.eyes[e].style.display = ''; w.eye = e;
    };
    const draw = (w: Walker, now: number, dt: number, speaker: Walker | null) => {
      if (w.mode === 'off') return;
      if (!w.on && !w.air) { w.fx = w.x; w.fy = floor; w.rot = 0; }
      // 도킹의 몸짓(올려다봄 · 폴짝)은 땅에 선 이만 — 공중이면 떨어지는 중이다
      const still = reduce.matches, dk = !still && docking(now) && !w.air, b = beatRef.current?.current;
      // 도킹이면 일어나 가운데로 돌아선다
      if (dk && !(w.mode === 'walk' && logo(w.x))) { w.face = W / 2 < w.x ? 1 : -1; }   // 로고 앞에서 걸어 나가는 동안엔 가는 쪽을 본다
      const goal = !dk && w.mode === 'sit' ? 1 : 0;
      w.sitT += Math.sign(goal - w.sitT) * Math.min(Math.abs(goal - w.sitT), dt / RET);
      const seated = w.sitT > 0.5;
      w.p.walkLegs.style.display = seated ? 'none' : ''; w.p.sitLegs.style.display = seated ? '' : 'none';
      w.p.stand.style.display = seated ? 'none' : ''; w.p.seat.style.display = seated ? '' : 'none';
      w.p.drop.setAttribute('transform', `translate(0 ${(SIT.drop * easeStd(w.sitT)).toFixed(1)})`);
      if (seated) {
        const k = Math.sin(((still ? 0 : now) / (HOLD * T.kick)) * 2 * Math.PI);
        w.p.far.setAttribute('transform', `rotate(${(SIT.farDeg + SIT.farSwing * k).toFixed(1)} ${SIT.pivot[0]} ${SIT.pivot[1]})`);
        w.p.near.setAttribute('transform', `rotate(${(SIT.nearDeg + SIT.nearSwing * Math.sin(((still ? 0 : now) / (HOLD * T.kick)) * 2 * Math.PI + 1.7)).toFixed(1)} ${SIT.pivot[0]} ${SIT.pivot[1]})`);
      }
      w.p.flip.setAttribute('transform', w.face === -1 ? `matrix(-1 0 0 1 ${2 * CX} 0)` : '');
      // 도킹 호들갑 — 이번 도킹에 처음이면 셋 중 하나를 고른다(다른 이가 이미 골랐으면 그것 말고). 도킹 순간 화들짝 뛰고(눈 동그래짐, 웅크렸다
      // 늘어났다 착지에 눌림), a는 글자마다 큰 폴짝 · b는 내내 동동 뛰며 몸을 흔들고 · c는 좌우로 종종 뛰어다닌다
      let fx = 0, fr = 0, fsq = 0, fl = 0, feye: Eye | null = null;
      if (dk && b) {
        if (w.fussAt !== b.start) {
          const taken = ws.filter((o) => o !== w && o.fussAt === b.start).map((o) => o.fuss), pool = (['a', 'b', 'c'] as const).filter((f) => !taken.includes(f));
          w.fuss = pool[Math.floor(Math.random() * pool.length)]; w.fussAt = b.start;
        }
        const f = w.fuss, e2 = now - b.start, J = HOLD, jk = e2 / J;
        if (jk < 1) { fl = Math.sin(Math.PI * jk) * FUSS.jump[f] * hc; fsq = jk < 0.18 ? JUMP.crouch * Math.sin((Math.PI * jk) / 0.18) : -JUMP.stretch * 1.2 * Math.sin(Math.PI * jk); feye = 'wide'; }
        else if (e2 < J + RET) { fsq = 1.3 * JUMP.land * Math.sin((Math.PI * (e2 - J)) / RET); feye = 'wide'; }
        else if (f === 'b') { fl = Math.abs(Math.sin((Math.PI * (e2 - J)) / (J / 2))) * FUSS.bob * hc; fr = FUSS.sway * Math.sin((2 * Math.PI * (e2 - J)) / J); feye = Math.floor((e2 - J) / J) % 2 ? 'smile' : 'up'; }
        else if (f === 'c' && e2 < J + RET + FUSS.dash) {
          const k = (e2 - J - RET) / FUSS.lap;
          fx = Math.sin(2 * Math.PI * k) * FUSS.reach * cw; w.face = Math.cos(2 * Math.PI * k) > 0 ? -1 : 1; w.walking = true; feye = 'wide';
        }
      }
      // 눈 — 도킹이면 올려다봄 · 하늘을 볼 땐 검은자가 위에서 좌우로 천천히 · 수다 중엔 말하는 쪽 쳐다봄↔웃음 · 평소 자주 웃음
      const up = dk || w.look === 'sky';
      const talking = !!meet && meet.phase === 'chat' && !dk && (w === meet.v || w === meet.h);
      const e: Eye = feye ?? (w.air ? (w.air.scared ? 'wide' : 'smile')   // 뛸 땐 웃고, 놀라 떨어질 땐 동그래진다
        : up ? (!dk && now < w.blinkUntil ? 'shut' : 'up')
        : talking ? (w === speaker ? (Math.floor(now / (HOLD * 0.6)) % 3 === 2 ? 'smile' : 'look') : (Math.floor(now / (HOLD * 2.2)) % 4 === 3 ? 'look' : 'smile'))
        : now < w.smileUntil && (w.mode === 'walk' || w.mode === 'sit') ? 'smile'
        : now < w.blinkUntil ? 'shut' : 'look');
      setEye(w, e);
      if (e === 'up') w.p.eyes.up.setAttribute('cx', (EYE_UP.cx + (still ? 0 : 10 * Math.sin(now * 0.35 + w.ph))).toFixed(1));
      // 몸짓 — 말하는 쪽은 들썩(키의 3%), 듣는 쪽은 끄덕(2%) · 도킹의 폴짝(글자마다)
      const talkDy = !talking ? 0 : w === speaker ? Math.abs(Math.sin(now * 9)) * hc * 0.03 : Math.abs(Math.sin(now * 3.5)) * hc * 0.02;
      let hop = 0;
      if (dk && b) for (const t of b.letters) { const k = (now - t) / HOP.t; if (k >= 0 && k < 1) hop = Math.max(hop, Math.sin(Math.PI * k)); }
      const lift = hop * FUSS.hop[w.fuss] * hc + talkDy + fl;
      // 뛰기의 몸 — 뛰기 전 웅크렸다 · 막 뜨면 늘어났다 · 내려서면 눌린다(발이 축)
      let sq = 0;
      if (w.air && !still) {
        const a = w.air, kc = a.crouch ? (now - a.t0) / a.crouch : 1;
        sq = kc < 1 ? JUMP.crouch * easeStd(kc) : -JUMP.stretch * clamp(1 - (3 * (now - a.t0 - a.crouch)) / a.dur);
      } else if (!still && now - w.land < RET) sq = JUMP.land * Math.sin((Math.PI * (now - w.land)) / RET);
      sq += fsq;
      const ox = (CX - VB.x) * s, oy = (FOOT_Y - VB.y) * s, pop = Math.max(0.001, easeEmph(w.pop));
      w.el.style.transform = `translate3d(${(w.fx + fx - ox).toFixed(1)}px, ${(w.fy - oy - lift).toFixed(1)}px, 0) rotate(${(w.rot + fr).toFixed(4)}rad) scale(${(pop * (1 + 0.7 * sq)).toFixed(3)}, ${(pop * (1 - sq)).toFixed(3)})`;
      // 수다의 점 세 알 — 말하는 쪽 머리 위, 말하는 방향으로 차례로
      const n = w === speaker ? Math.floor((now * 3.5) % 4) : 0, dir = w.face > 0 ? -1 : 1;
      const hy = w.fy - lift - (FOOT_Y - SIT.drop * easeStd(w.sitT)) * s - 0.1 * hc, hx = w.fx + dir * 0.42 * hc;
      w.p.dots.forEach((d, k) => {
        d.style.display = k < n ? '' : 'none';
        if (k < n) d.style.transform = `translate(${(hx + dir * k * 0.13 * hc - 0.045 * hc).toFixed(1)}px, ${(hy - 0.045 * hc).toFixed(1)}px)`;
      });
      const anim = w.walking && !still;
      if (anim !== w.anim) {
        w.anim = anim;
        if (anim) w.p.svg.unpauseAnimations(); else { w.p.svg.setCurrentTime(0); w.p.svg.pauseAnimations(); }   // 0프레임이 곧 서 있는 자세
      }
      w.walking = false;
    };

    let raf = 0, last = performance.now();
    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (ms - last) / 1000), now = ms / 1000;
      last = ms;
      // 하늘 놀이 — 그 순간 딛을 수 있는 하늘 말
      const ps = new Map<string, Perch>((skyRef.current?.current?.at(now) ?? []).map((p) => [p.id, p]));      if (!reduce.matches) brain(now, ps);
      ws.forEach((w) => step(w, now, dt, ps));
      const speaker = speakerOf(now);
      ws.forEach((w) => draw(w, now, dt, speaker));
    };
    layout();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', layout);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', layout); };
  }, []);

  return (
    <div ref={root} className="wall-walkers" aria-hidden="true"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 'var(--z-elevated)' } as CSSProperties}>
      {COLORS.map((color, i) => (
        <div key={i} className="wall-walker" style={{ position: 'absolute', left: 0, top: 0, display: 'none', willChange: 'transform' }}>
          <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true" focusable="false">
            <defs>
              <clipPath id={`wk-body-${i}`}><rect width={VIEW.w} height={CLIP_H} /></clipPath>
              <clipPath id={`wk-legs-${i}`}><rect x={-600} y={-600} width={1600} height={600 + FOOT_Y} /></clipPath>
            </defs>
            <g data-p="flip" style={{ color: `var(${color})` }}>
              {/* 걷는 다리 — 작가가 그린 65프레임(walker.ts WALK). 멈출 땐 0프레임(서 있는 자세)에 재운다 */}
              <g data-p="walk">
                <path fill="currentColor" d={WALK.farRest}>
                  <animate attributeName="d" dur={`${WALK.ms}ms`} repeatCount="indefinite" calcMode="linear" keyTimes={WALK.keyTimes} values={WALK.far} />
                </path>
                <path fill="currentColor" d={WALK.nearRest}>
                  <animate attributeName="d" dur={`${WALK.ms}ms`} repeatCount="indefinite" calcMode="linear" keyTimes={WALK.keyTimes} values={WALK.near} />
                </path>
              </g>
              {/* 앉은 두 발(walker.ts SIT) — 바닥 밑으로는 안 나간다 */}
              <g data-p="sit" clipPath={`url(#wk-legs-${i})`} style={{ display: 'none' }}>
                <g data-p="far"><path fill="currentColor" d={SIT.far} /></g>
                <g data-p="near"><path fill="currentColor" d={SIT.near} /></g>
              </g>
              <g data-p="drop">
                <g transform={`translate(${WALK.bobRest})`}>
                  <animateTransform attributeName="transform" type="translate" dur={`${WALK.ms}ms`} repeatCount="indefinite" calcMode="linear" keyTimes={WALK.keyTimes} values={WALK.bob} />
                  <g transform={`rotate(${WALK.tiltRest})`}>
                    <animateTransform attributeName="transform" type="rotate" dur={`${WALK.ms}ms`} repeatCount="indefinite" calcMode="linear" keyTimes={WALK.keyTimes} values={WALK.tilt} />
                    <g clipPath={`url(#wk-body-${i})`}>
                      <circle fill="currentColor" cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} />
                      <path data-p="stand" fill="currentColor" d={BODY} />
                      <path data-p="seat" fill="currentColor" d={SIT.body} style={{ display: 'none' }} />
                      <circle fill="var(--paper)" cx={EYE_WHITE.cx} cy={EYE_WHITE.cy} r={EYE_WHITE.r} />
                      <circle data-eye="look" fill="currentColor" cx={EYE_LOOK.cx} cy={EYE_LOOK.cy} r={EYE_LOOK.r} />
                      <circle data-eye="wide" fill="currentColor" cx={EYE_WIDE.cx} cy={EYE_WIDE.cy} r={EYE_WIDE.r} style={{ display: 'none' }} />
                      <circle data-eye="up" fill="currentColor" cx={EYE_UP.cx} cy={EYE_UP.cy} r={EYE_UP.r} style={{ display: 'none' }} />
                      <path data-eye="shut" d={EYE_SHUT} fill="none" stroke="currentColor" strokeWidth="20" strokeLinecap="round" style={{ display: 'none' }} />
                      <path data-eye="smile" d={EYE_SMILE.d} transform={EYE_SMILE.transform} fill="currentColor" style={{ display: 'none' }} />
                      <g data-eye="sad" style={{ display: 'none' }}>
                        <circle fill="currentColor" cx={EYE_SAD.pupil.cx} cy={EYE_SAD.pupil.cy} r={EYE_SAD.pupil.r} />
                        <path fill="currentColor" d={EYE_SAD.lid} transform={EYE_SAD.transform} />
                      </g>
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </svg>
        </div>
      ))}
      {/* 수다의 점 세 알 — 말하는 쪽 머리 위(그 사람 색, 지름 키의 9%). 자리는 그리는 시계가 */}
      {COLORS.map((color, i) => [0, 1, 2].map((k) => (
        <i key={`${i}-${k}`} className="wall-walker-dot" data-w={i}
          style={{ position: 'absolute', left: 0, top: 0, display: 'none', borderRadius: 'var(--r-full)', background: `var(${color})` }} />
      )))}
    </div>
  );
}
