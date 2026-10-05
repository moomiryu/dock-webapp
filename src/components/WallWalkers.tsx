import { useEffect, useRef, type CSSProperties } from 'react';
import { BODY, CLIP_H, EYE_LOOK, EYE_SAD, EYE_SHUT, EYE_SMILE, EYE_WHITE, EYE_WIDE, FOOT_Y, HEAD, SIT, VIEW, WALK } from '../character/walker';
import { groundPx } from '../lib/ground';

/**
 * 벽의 작은 사람 둘(2026-10-04, 디자이너가 움직이는 견본 design/landscape-character-wall.html에서 골랐다).
 *
 * 홈에서 걸어 다니던 작은 사람이 벽의 땅 위에 산다 — 빨강(이미 말을 한 사람)과 파랑(아직 메가폰트를 만나기 전).
 * - 땅 위만 걷는다. 돌에 오르지 않고 돌 **앞**을 지나간다. 겹은 돌 → 작은 사람 → 풀(땅 · 풀 = WallGround가 이 위에 그린다)
 * - 빈 땅에 앉는다(앉은 자세 = walker.ts SIT). **글 앞에는 앉지 않는다** — 지나가며 잠깐 가리는 건 괜찮다(디자이너).
 *   앉은 뒤 돌이 떨어져 글이 뒤에 오면 일어나 옮긴다
 * - 아주 자주 웃는다(작가의 아치 눈). 빠르게 떨어지는 돌이 몸에 닿으면 놀라며 넘어지고, 일어나면 3초 동안 슬픈 눈
 * - 가끔 한 명이 뛰어와(걸음 2배) 앉아 있는 다른 한 명 곁에 앉고, 마주 보고 몸짓으로 이야기한다(글자 · 말풍선 없음)
 *
 * 돌 · 글의 자리는 화면에서 읽는다(WallGround와 같다) — 벽 속 계산과 엮이지 않아 큰 돌 · 발화 · 확대에서도 그대로 맞는다.
 * 땅처럼 화면에 고정이다(확대해도 커지지 않는다). 물리 엔진은 쓰지 않는다 — 땅에만 닿고 돌과 부딪히지 않으니 넘어짐만 몸짓으로 짓는다.
 * 움직임 줄이기를 켠 화면에서는 빈 땅에 앉아 가만히 있다.
 */

/** 시간 토큰(초) — 단위를 보고 읽는다: 빌드가 700ms를 .7s로 고쳐 적는다(CloudBubble · holdS와 같은 까닭) */
function tokenS(name: string, fallback: number): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return /ms$/.test(v) ? n / 1000 : n;
}
/** 이징 토큰(cubic-bezier) → 0~1 함수 */
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

/** 키 = 벽 높이의 6.5%(실물 약 9cm) — 4.5 · 6.5 · 9% 중(벽 돌이 높이 8~10%라 그 3분의 2쯤) */
const SIZE = 0.065;
/** 둘의 색 — 빨강(이미 말을 한 사람) · 파랑(홈에서 메가폰트를 만나기 전의 색) */
const COLORS = ['--brand-main', '--char-cyan'];
const TOP = 4, STAND_H = FOOT_Y - TOP, SIT_H = STAND_H - SIT.drop, CX = HEAD.cx, BODY_W = 2 * HEAD.r;
/** 그림 둘레의 여유(화판 좌표) — 앉으면 발이 앞으로 나오고, 넘어지면 몸이 눕는다 */
const VB = { x: -240, y: -170, w: VIEW.w + 480, h: VIEW.h + 230 };
/** 시간은 --t-hold의 배수(H). 슬픈 눈만 디자이너가 준 초 */
const T = {
  popAt: [7, 12], sit: [10, 16], tired: 20, smileGap: [2.5, 4], smileDur: 3, blink: [3, 7], flip: [4, 9],
  meetFirst: 12, meetAfter: [14, 22], meetTry: 1, talk: [12, 18], turn: [2, 4], kick: 4
};
const SAD_S = 3;
/** 만남 — 한 명이 앉아 있고 다른 한 명이 걸으면(벽 폭 80% 안) 70%로, 곁 몸 1.9개 떨어진 자리로 뛰어온다(마주 내민 발이 안 닿게) */
const MEET = { chance: 0.7, reach: 0.8, gap: 1.9 };
/** 맞았다고 보는 돌의 아래로 빠르기(벽 높이/초 — 1080 벽에서 초당 120px). 천천히 내려앉는 돌은 안 맞힌다 */
const HIT_VY = 120 / 1080;

/** 큰 돌(차분한의 발화) 앞에서 — 놀람(제자리 폴짝) → 달아남(오른쪽으로 뜀) → 돌 가장자리에 모여 섬 · 돌이 밀려 나갈 땐 화면 밖으로(away) */
const GIANT = { startle: 0.5, flee: 4, run: 2.5, gap: 1.1, spread: 1.3, reach: 6, huddleWide: 2 };
type State = 'off' | 'pop' | 'walk' | 'sit' | 'knock' | 'down' | 'getup' | 'startle' | 'flee' | 'huddle' | 'away';
type Eye = 'look' | 'wide' | 'shut' | 'smile' | 'sad';
type Parts = {
  svg: SVGSVGElement; flip: SVGGElement; walkLegs: SVGGElement; sitLegs: SVGGElement; far: SVGGElement; near: SVGGElement;
  drop: SVGGElement; stand: SVGPathElement; seat: SVGPathElement; eyes: Record<Eye, SVGElement>; anims: SVGAnimationElement[];
};
type Walker = {
  el: HTMLDivElement; p: Parts; state: State; t0: number; x: number; dir: 1 | -1; face: 1 | -1; tx: number;
  until: number; sitT: number; sitGoal: number; pop: number; walkSince: number; walking: boolean; anim: boolean; pace: number;
  nextBlink: number; blinkUntil: number; nextFlip: number; nextSmile: number; smileUntil: number; sadUntil: number; coverAt: number;
  meeting: boolean; talking: boolean; speaking: boolean; side: number; vx: number; ang: number; ang0: number; eye: Eye;
};

const rnd = (r: readonly number[]) => r[0] + Math.random() * (r[1] - r[0]);

export default function WallWalkers() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = root.current;
    if (!host) return;
    const HOLD = tokenS('--t-hold', 0.7), SLOW = tokenS('--t-slow', 0.4), RET = tokenS('--t-return', 0.22);
    const easeStd = easeOf('--ease-standard'), easeEmph = easeOf('--ease-emphasized');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');

    const els = [...host.querySelectorAll<HTMLDivElement>('.wall-walker')];
    const ws: Walker[] = els.map((el) => {
      const q = <E extends Element>(s: string) => el.querySelector(s) as E;
      const p: Parts = {
        svg: q('svg'), flip: q('[data-p="flip"]'), walkLegs: q('[data-p="walk"]'), sitLegs: q('[data-p="sit"]'),
        far: q('[data-p="far"]'), near: q('[data-p="near"]'), drop: q('[data-p="drop"]'), stand: q('[data-p="stand"]'), seat: q('[data-p="seat"]'),
        eyes: { look: q('[data-eye="look"]'), wide: q('[data-eye="wide"]'), shut: q('[data-eye="shut"]'), smile: q('[data-eye="smile"]'), sad: q('[data-eye="sad"]') },
        anims: [...el.querySelectorAll<SVGAnimationElement>('animate, animateTransform')]
      };
      p.svg.pauseAnimations();
      return {
        el, p, state: 'off', t0: 0, x: 0, dir: 1, face: 1, tx: 0, until: 0, sitT: 0, sitGoal: 0, pop: 0, walkSince: 0, walking: false, anim: false, pace: 0,
        nextBlink: 0, blinkUntil: 0, nextFlip: 0, nextSmile: 0, smileUntil: 0, sadUntil: 0, coverAt: 0,
        meeting: false, talking: false, speaking: false, side: 1, vx: 0, ang: 0, ang0: 0, eye: 'look'
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
      }
    };

    // ── 화면에서 읽는 것 — 글자 자리 · 돌 자리(떨어지는 빠르기를 재려고 지난 자리를 기억한다)
    let texts: [number, number, number, number][] = [], textsAt = -1;
    const readTexts = (t: number) => {
      if (t - textsAt < 0.15) return;
      textsAt = t; texts = [];
      document.querySelectorAll('.wall .message-line-fill').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width >= 1) texts.push([r.left - 4, r.top - 4, r.right + 4, r.bottom + 4]);
      });
    };
    const lastStone = new WeakMap<Element, { y: number; t: number }>();
    const hits = new WeakMap<Element, Set<Walker>>();
    // 확대 · 훑기 중에는 따지지 않는다 — 카메라가 움직이면 돌이 화면에서 빠르게 움직여 떨어지는 것처럼 보인다
    const cameraStill = () => !(document.querySelector('.wall-world') as HTMLElement | null)?.style.transform;
    const fallingOn = (w: Walker, t: number): DOMRect | null => {
      if (!cameraStill()) return null;
      const x0 = w.x - cw / 2, x1 = w.x + cw / 2, y0 = floor - (w.state === 'sit' ? SIT_H : STAND_H) * s;
      for (const el of document.querySelectorAll('.wall-block.is-stone')) {
        const r = el.getBoundingClientRect(), prev = lastStone.get(el);
        const vy = prev && t > prev.t ? (r.top - prev.y) / (t - prev.t) : 0;
        if (vy > HIT_VY * Hh && r.left < x1 && r.right > x0 && r.top < floor && r.bottom > y0) {
          const done = hits.get(el) ?? new Set<Walker>();
          if (!done.has(w)) { done.add(w); hits.set(el, done); return r; }
        }
      }
      return null;
    };
    const markStones = (t: number) => {
      document.querySelectorAll('.wall-block.is-stone').forEach((el) => lastStone.set(el, { y: el.getBoundingClientRect().top, t }));
    };

    // ── 앉을 자리
    const sitBox = (x: number): [number, number, number, number] => {
      const half = cw / 2 + 90 * s;   // 앞으로 나온 두 발까지
      return [x - half, floor - SIT_H * s, x + half, floor];
    };
    const coversText = (x: number) => {
      const [a, b, c, d] = sitBox(x);
      return texts.some((q) => a < q[2] && c > q[0] && b < q[3] && d > q[1]);
    };
    const spotTaken = (w: Walker, x: number) => ws.some((o) => o !== w && o.state !== 'off' && o.state !== 'away'
      && Math.abs((o.state === 'sit' ? o.x : o.tx) - x) < cw * MEET.gap * 0.95);
    const clampX = (x: number) => Math.min(W - cw, Math.max(cw, x));
    const pickTarget = (w: Walker) => {
      for (let i = 0; i < 40; i++) {
        const tx = clampX(w.x + (Math.random() < 0.5 ? -1 : 1) * W * (0.08 + Math.random() * 0.3));
        if (!coversText(tx) && !spotTaken(w, tx)) { w.tx = tx; return; }
      }
      for (let tx = cw; tx < W - cw; tx += cw) if (!coversText(tx) && !spotTaken(w, tx)) { w.tx = tx; return; }
      w.tx = w.x;
    };
    const freeX = (w: Walker) => {
      for (let i = 0; i < 40; i++) { const x = cw + Math.random() * (W - 2 * cw); if (!coversText(x) && !spotTaken(w, x)) return x; }
      return W / 2;
    };

    // ── 상태 바꾸기
    const toWalk = (w: Walker, t: number) => { w.state = 'walk'; w.walkSince = t; w.sitGoal = 0; if (!w.meeting) pickTarget(w); };
    const toSit = (w: Walker, t: number) => {
      w.state = 'sit'; w.sitGoal = 1; w.until = t + HOLD * rnd(T.sit);
      w.nextBlink = t + HOLD * rnd([2, 5]); w.nextFlip = t + HOLD * rnd(T.flip);
    };
    const popIn = (w: Walker, t: number) => {
      w.x = freeX(w); w.tx = w.x; w.state = 'pop'; w.t0 = t; w.pop = 0; w.el.style.display = '';
    };
    const knock = (w: Walker, t: number, r: DOMRect) => {
      if (meet && (ws[meet.a] === w || ws[meet.b] === w)) endMeet(t);
      w.sitGoal = 0; w.sitT = 0; w.state = 'knock'; w.t0 = t;
      w.side = Math.sign(w.x - (r.left + r.right) / 2) || (Math.random() < 0.5 ? -1 : 1);
      w.vx = w.side * hc * 1.6;
    };

    // ── 만남
    type Meet = { a: number; b: number; phase: 'approach' | 'talk'; sx: number; limit: number; until: number; speaker: number; nextTurn: number };
    let meet: Meet | null = null, meetCool = 0, meetTry = 0;
    const endMeet = (t: number) => {
      for (const w of ws) { w.meeting = w.talking = w.speaking = false; }
      meet = null; meetCool = t + HOLD * rnd(T.meetAfter);
    };
    const meetStep = (t: number) => {
      const [p, q] = ws;
      if (!p || !q) return;
      if (!meet) {
        if (t < meetCool || t - meetTry < HOLD * T.meetTry) return;
        meetTry = t;
        if (Math.random() > MEET.chance) return;
        const pair = p.state === 'sit' && q.state === 'walk' ? [0, 1] : q.state === 'sit' && p.state === 'walk' ? [1, 0] : null;
        if (!pair) return;
        const A = ws[pair[0]], B = ws[pair[1]];
        if (t < A.sadUntil || t < B.sadUntil || Math.abs(B.x - A.x) > W * MEET.reach) return;
        const first = Math.sign(B.x - A.x) || 1;
        for (const side of [first, -first]) {
          const sx = A.x + side * cw * MEET.gap;
          if (sx > cw && sx < W - cw && !coversText(sx)) {
            const limit = t + Math.abs(B.x - sx) / (speed * 2) + HOLD * 6;   // 뛰어올 만큼 + 여유 — 앉은 쪽은 기다린다
            meet = { a: pair[0], b: pair[1], phase: 'approach', sx, limit, until: 0, speaker: 0, nextTurn: 0 };
            B.tx = sx; B.meeting = true; A.until = Math.max(A.until, limit + HOLD);
            return;
          }
        }
        return;
      }
      const m = meet, A = ws[m.a], B = ws[m.b];
      if (A.state !== 'sit' || (m.phase === 'approach' && ((B.state !== 'walk' && B.state !== 'sit') || t > m.limit))
        || (m.phase === 'talk' && B.state !== 'sit')) return endMeet(t);
      if (m.phase === 'approach' && B.state === 'sit') {   // 닿았다 — 마주 보고 이야기
        m.phase = 'talk'; m.until = t + HOLD * rnd(T.talk); m.speaker = Math.random() < 0.5 ? m.a : m.b; m.nextTurn = t + HOLD * rnd(T.turn);
        A.until = B.until = m.until; A.talking = B.talking = true;
        A.face = B.x > A.x ? -1 : 1; B.face = A.x > B.x ? -1 : 1;   // 그림은 왼쪽을 본다 — 오른쪽을 보려면 뒤집는다
      }
      if (m.phase === 'talk') {
        if (t > m.nextTurn) { m.speaker = m.speaker === m.a ? m.b : m.a; m.nextTurn = t + HOLD * rnd(T.turn); }
        A.speaking = m.speaker === m.a; B.speaking = m.speaker === m.b;
        if (t > m.until) endMeet(t);
      }
    };

    // ── 큰 돌 — 화면에서 읽는다(오른쪽 끝 · 오른쪽 끝의 빠르기 px/초). 밀려오는 동안 → 가만히 섬(held) → 밀려 나감을 가른다
    let giant: { l: number; r: number; v: number } | null = null, gPrevR = NaN, gMoved = false, gHeld = false;
    const GV = 0.02;   // 이보다 느리면 선 것(벽 높이/초)
    const readGiant = (dt: number) => {
      const el = document.querySelector('.wall-calm');
      const r = el?.getBoundingClientRect();
      if (!r || r.right <= 0 || r.left >= W) { giant = null; gPrevR = NaN; gMoved = gHeld = false; return; }
      const v = Number.isNaN(gPrevR) || dt <= 0 ? 0 : (r.right - gPrevR) / dt;
      gPrevR = r.right;
      if (v > GV * Hh) gMoved = true; else if (gMoved && v > -GV * Hh) gHeld = true;
      giant = { l: r.left, r: r.right, v };
    };

    // ── 한 걸음
    const step = (w: Walker, i: number, t: number, dt: number) => {
      const still = reduce.matches;
      if (w.state === 'off') {
        if (giant) return;   // 큰 돌이 있는 동안은 나오지 않는다
        if (still || t > HOLD * T.popAt[i]) { popIn(w, t); if (still) { w.pop = 1; toSit(w, t); w.sitT = 1; w.until = Infinity; } }
        return;
      }
      // 움직임 줄이기를 도중에 켜도 앉은 자세로 멈춘다. 글이 뒤에 생기면 빈자리로만 옮긴다.
      if (still) {
        if (meet) endMeet(t);
        w.state = 'sit'; w.sitGoal = w.sitT = w.pop = 1; w.ang = 0; w.walking = false; w.el.style.display = '';
        w.smileUntil = w.blinkUntil = w.sadUntil = 0;
        w.until = t + HOLD * T.sit[0];
        if (coversText(w.x)) w.x = freeX(w);
        return;
      }
      if ((w.state === 'walk' || w.state === 'sit' || w.state === 'getup') && !still) {
        const r = fallingOn(w, t);
        if (r) return knock(w, t, r);
      }
      if (giant && (w.state === 'walk' || w.state === 'sit')) {   // 큰 돌이 나타났다 — 놀란다
        if (meet) endMeet(t);
        w.state = 'startle'; w.t0 = t; w.sitGoal = 0; w.walking = false;
        w.face = (giant.l + giant.r) / 2 < w.x ? 1 : -1;
      }
      if ((w.state === 'walk' || w.state === 'sit') && t >= w.sadUntil && !still) {
        if (!w.nextSmile) w.nextSmile = t + HOLD * rnd(T.smileGap);
        if (t > w.nextSmile) { w.smileUntil = t + HOLD * T.smileDur; w.nextSmile = w.smileUntil + HOLD * rnd(T.smileGap); }
      }
      switch (w.state) {
        case 'pop':
          w.pop = Math.min(1, (t - w.t0) / SLOW);
          if (w.pop >= 1) toWalk(w, t);
          break;
        case 'walk': {
          const near = Math.abs(w.x - w.tx) < (w.meeting ? 3 : hc * 0.3);   // 만나러 갈 땐 그 자리에 정확히
          if (near) {
            if (w.meeting) { w.x = w.tx; toSit(w, t); w.until = t + HOLD * 30; break; }   // 곁에 앉는다 — 이야기 길이는 만남이 정한다
            if (coversText(w.x) || spotTaken(w, w.x)) pickTarget(w); else toSit(w, t);
            break;
          }
          if (!w.meeting && t - w.walkSince > HOLD * T.tired && !coversText(w.x) && !spotTaken(w, w.x)) { toSit(w, t); break; }
          w.dir = w.tx > w.x ? 1 : -1; w.face = w.dir > 0 ? -1 : 1;
          const pace = w.meeting ? 2 : 1;   // 만나러 갈 땐 뛰어간다(걸음 · 다리 2배)
          if (w.pace !== pace) { w.pace = pace; for (const a of w.p.anims) a.setAttribute('dur', `${Math.round(walkMs / pace)}ms`); }
          w.x += w.dir * Math.min(speed * pace * dt, Math.abs(w.tx - w.x));
          w.walking = true;
          break;
        }
        case 'sit':
          // 다 쉬었거나, 돌이 떨어져 글이 뒤에 왔으면(글을 가리고 앉아 있게 되면) 일어나 옮긴다
          if (t - w.coverAt > 0.2) {
            w.coverAt = t;
            if (coversText(w.x)) {
              if (meet && (ws[meet.a] === w || ws[meet.b] === w)) endMeet(t);
              if (still) { w.x = freeX(w); break; }
              toWalk(w, t); break;
            }
          }
          if (t > w.until) { toWalk(w, t); break; }
          if (t > w.nextBlink && t >= w.smileUntil) { w.blinkUntil = t + RET; w.nextBlink = t + HOLD * rnd(T.blink); }
          if (t > w.nextFlip && !w.talking && !still) { w.face = w.face === 1 ? -1 : 1; w.nextFlip = t + HOLD * rnd(T.flip); }
          break;
        case 'startle':
          if (t - w.t0 > HOLD * GIANT.startle) { w.state = 'flee'; w.t0 = t; }
          break;
        case 'flee':
        case 'huddle': {
          if (!giant) { toWalk(w, t); break; }   // 돌이 가고 나면 다시 제 걸음
          const exiting = gHeld && giant.v > GV * Hh;
          // 모일 자리 = 큰 돌 오른쪽 가장자리 바로 옆(둘이 나란히). 밀려오는 동안엔 돌 앞에 든 사람이 앞서 뛴다
          const lim = W - cw - (ws.length - 1 - i) * cw * GIANT.spread;
          const raw = Math.min(giant.r + cw * GIANT.gap + i * cw * GIANT.spread, lim);
          const tx = exiting ? W + 2 * cw : !gHeld && w.x - giant.r < hc * GIANT.reach ? Math.min(lim, Math.max(raw, w.x + cw)) : raw;
          const d = tx - w.x;
          if (d > 3 && (w.state === 'flee' || exiting || d > cw * 0.5)) {
            w.state = 'flee'; w.dir = 1; w.face = -1;
            if (w.pace !== GIANT.flee) { w.pace = GIANT.flee; for (const a of w.p.anims) a.setAttribute('dur', `${Math.round(walkMs / GIANT.flee)}ms`); }
            w.x += Math.min(Math.max(speed * GIANT.flee, hc * GIANT.run) * dt, d); w.walking = true;
            if (exiting && w.x >= W + cw) { w.state = 'away'; w.walking = false; w.el.style.display = 'none'; }
          } else {
            if (w.state === 'flee') { w.state = 'huddle'; w.t0 = t; w.face = (giant.l + giant.r) / 2 < w.x ? 1 : -1; w.nextBlink = t + HOLD * rnd([2, 5]); }
            if (t > w.nextBlink) { w.blinkUntil = t + RET; w.nextBlink = t + HOLD * rnd(T.blink); }
          }
          break;
        }
        case 'away':   // 큰 돌이 다 지나갔다 — 오른쪽 끝에서 걸어 들어온다
          if (!giant) { w.x = W + cw * (1 + i * 3); w.pop = 1; w.el.style.display = ''; toWalk(w, t); }
          break;
        case 'knock': {   // 놀라며 넘어진다 — 옆으로 밀리며 SLOW에 눕는다
          const p = Math.min(1, (t - w.t0) / SLOW);
          w.ang = w.side * 80 * easeEmph(p);
          w.x = clampX(w.x + w.vx * dt); w.vx *= Math.exp(-6 * dt);
          if (p >= 1) { w.state = 'down'; w.t0 = t; }
          break;
        }
        case 'down':
          if (t - w.t0 > HOLD) { w.state = 'getup'; w.t0 = t; w.ang0 = w.ang; }
          break;
        case 'getup': {   // 일어난다 — HOLD에 바로 서고, 3초 동안 슬픈 눈
          const p = Math.min(1, (t - w.t0) / HOLD);
          w.ang = w.ang0 * (1 - easeStd(p));
          if (p >= 1) { w.ang = 0; w.sadUntil = t + SAD_S; toWalk(w, t); }
          break;
        }
      }
    };

    // ── 그리기
    const setEye = (w: Walker, e: Eye) => {
      if (w.eye === e) return;
      w.p.eyes[w.eye].style.display = 'none'; w.p.eyes[e].style.display = ''; w.eye = e;
    };
    const draw = (w: Walker, t: number, dt: number) => {
      if (w.state === 'off' || w.state === 'away') return;
      const motionT = reduce.matches ? 0 : t;
      w.sitT += Math.sign(w.sitGoal - w.sitT) * Math.min(Math.abs(w.sitGoal - w.sitT), dt / RET);
      const seated = w.sitT > 0.5;
      w.p.walkLegs.style.display = seated ? 'none' : ''; w.p.sitLegs.style.display = seated ? '' : 'none';
      w.p.stand.style.display = seated ? 'none' : ''; w.p.seat.style.display = seated ? '' : 'none';
      w.p.drop.setAttribute('transform', `translate(0 ${(SIT.drop * easeStd(w.sitT)).toFixed(1)})`);
      if (seated) {
        const k = Math.sin((motionT / (HOLD * T.kick)) * 2 * Math.PI);
        w.p.far.setAttribute('transform', `rotate(${(SIT.farDeg + SIT.farSwing * k).toFixed(1)} ${SIT.pivot[0]} ${SIT.pivot[1]})`);
        w.p.near.setAttribute('transform', `rotate(${(SIT.nearDeg + SIT.nearSwing * Math.sin((motionT / (HOLD * T.kick)) * 2 * Math.PI + 1.7)).toFixed(1)} ${SIT.pivot[0]} ${SIT.pivot[1]})`);
      }
      w.p.flip.setAttribute('transform', w.face === -1 ? `matrix(-1 0 0 1 ${2 * CX} 0)` : '');
      // 눈 — 넘어지는 동안 놀람 → 일어나며 질끈 → 3초 슬픔 · 이야기 중엔 말하는 쪽 쳐다봄↔웃음, 듣는 쪽 대개 웃음 · 평소 자주 웃음
      const e: Eye = w.state === 'knock' || w.state === 'down' || w.state === 'startle' || w.state === 'flee' ? 'wide'
        : w.state === 'huddle' && t - w.t0 < HOLD * GIANT.huddleWide ? 'wide'
        : w.state === 'getup' ? (t - w.t0 < HOLD * 0.35 ? 'shut' : 'sad')
        : t < w.sadUntil ? 'sad'
        : w.talking ? (w.speaking ? (Math.floor(t / (HOLD * 0.6)) % 3 === 2 ? 'smile' : 'look') : (Math.floor(t / (HOLD * 2.2)) % 4 === 3 ? 'look' : 'smile'))
        : t < w.smileUntil && (w.state === 'walk' || w.state === 'sit') ? 'smile'
        : t < w.blinkUntil ? 'shut' : 'look';
      setEye(w, e);
      // 몸짓 — 말하는 쪽은 작게 들썩(키의 3%), 듣는 쪽은 끄덕(키의 2% 내려앉음)
      const talkDy = !w.talking ? 0 : w.speaking ? -Math.abs(Math.sin((t / (HOLD * 0.5)) * Math.PI)) * hc * 0.03
        : (Math.max(0, Math.sin((t / (HOLD * 1.5)) * 2 * Math.PI) - 0.6) / 0.4) * hc * 0.02;
      const hop = w.state === 'startle' ? Math.sin(Math.min(1, (t - w.t0) / (HOLD * GIANT.startle)) * Math.PI) * hc * 0.18 : 0;   // 놀라 폴짝
      const rad = (w.ang * Math.PI) / 180, lift = (cw / 2) * Math.abs(Math.sin(rad)) + hop;   // 누워도 아래 모서리가 땅 위에
      const ox = (CX - VB.x) * s, oy = (FOOT_Y - VB.y) * s, pop = Math.max(0.001, easeEmph(w.pop));
      w.el.style.transform = `translate3d(${(w.x - ox).toFixed(1)}px, ${(floor - oy - lift + talkDy).toFixed(1)}px, 0) rotate(${w.ang.toFixed(1)}deg) scale(${pop.toFixed(3)})`;
      const anim = w.walking && !reduce.matches;
      if (anim !== w.anim) {
        w.anim = anim;
        if (anim) w.p.svg.unpauseAnimations(); else { w.p.svg.setCurrentTime(0); w.p.svg.pauseAnimations(); }   // 0프레임이 곧 서 있는 자세
      }
      w.walking = false;
    };

    let raf = 0, last = performance.now();
    const t0 = last;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000), t = (now - t0) / 1000;
      last = now;
      readTexts(t);
      readGiant(dt);
      if (!reduce.matches) meetStep(t);
      ws.forEach((w, i) => step(w, i, t, dt));
      markStones(t);
      ws.forEach((w) => draw(w, t, dt));
    };
    meetCool = HOLD * T.meetFirst;
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
    </div>
  );
}
