import { useEffect, useRef, type CSSProperties } from 'react';
import { BODY, CLIP_H, EYE_LOOK, EYE_SAD, EYE_SHUT, EYE_SMILE, EYE_UP, EYE_WHITE, EYE_WIDE, FOOT_Y, HEAD, SIT, VIEW, WALK } from '../character/walker';
import { groundPx } from '../lib/ground';
import { easeOf, tokenS } from '../lib/motion';

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
 * - 도킹 — 수다든 앉기든 멈추고 일어나 큰 말 쪽(가운데)으로 돌아서 올려다본다(EYE_UP). 글자가 한 박씩 설 때마다 키의 0.22만큼 0.32초
 *   폴짝. 새 말이 하늘로 오르기 시작하면 다시 제 일로(beat — WallSky가 적는다)
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
const HOP = { h: 0.22, t: 0.32 };
/** 시간은 --t-hold의 배수(H) — 웃기 · 깜빡이기 · 발 까딱(옛 값 그대로) · 나오는 때(초) */
const T = { popAt: [1, 3], smileGap: [2.5, 4], smileDur: 3, blink: [3, 7], kick: 4 };

/** 도킹의 박자 — 큰 말이 선 때 · 글자마다 다 쌓인 때 · 하늘로 오르기 시작하는 때(초, performance.now 기준. 아직 모르면 Infinity) */
export type DockBeat = { start: number; letters: readonly number[]; rise: number };
type Mode = 'off' | 'pop' | 'walk' | 'sit' | 'idle';
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
};

const rnd = (r: readonly number[]) => r[0] + Math.random() * (r[1] - r[0]);

export default function WallWalkers({ beat }: { beat?: { current: DockBeat | null } }) {
  const root = useRef<HTMLDivElement>(null);
  const beatRef = useRef(beat);
  beatRef.current = beat;

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
        sitT: 0, pop: 0, walking: false, anim: false, pace: 0, ph: i * 1.3, nextBlink: 0, blinkUntil: 0, nextSmile: 0, smileUntil: 0, eye: 'look'
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

    // ── 만남 — 한 명(v)이 앉은 다른 이(h)에게 가서 마주 앉아 수다, 그다음 나란히 하늘, 그리고 각자 자리로
    let meet: { v: Walker; h: Walker; phase: 'go' | 'chat' | 'sky'; t: number } | null = null, nextMeet = start + rnd(MEET.first);
    const docking = (now: number) => { const b = beatRef.current?.current; return !!b && now >= b.start && now < b.rise; };
    /** 이번 도킹에 로고 앞에서 비켜서는 중인 사람 — 띠를 벗어나도 고른 자리에 닿을 때까지 걷는다(결정 20) */
    const aside = new Set<Walker>();
    const brain = (now: number) => {
      if (docking(now)) { meet = null; return; }
      if (!meet && now > nextMeet && ws.length > 1 && ws.every((w) => w.mode !== 'off' && w.mode !== 'pop')) {
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
      for (const w of ws) {   // 혼자 — 걷다 · 서다 · 앉아 하늘 바라보기
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
    const step = (w: Walker, now: number, dt: number) => {
      if (w.mode === 'off') {
        if (reduce.matches || now > w.t0) { w.x = inZone(w); w.tx = w.x; w.mode = 'pop'; w.t0 = now; w.pop = 0; w.el.style.display = ''; }
        return;
      }
      if (reduce.matches) { w.mode = 'sit'; w.pop = w.sitT = 1; w.walking = false; w.until = Infinity; w.look = 'ahead'; return; }
      if (w.mode === 'pop') { w.pop = Math.min(1, (now - w.t0) / SLOW); if (w.pop >= 1) { w.mode = 'idle'; w.until = now + rnd(DAY.rest); } return; }
      if ((w.mode === 'walk' || w.mode === 'sit') && now >= w.nextSmile) {
        if (w.nextSmile) w.smileUntil = now + HOLD * T.smileDur;
        w.nextSmile = Math.max(now, w.smileUntil) + HOLD * rnd(T.smileGap);
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
      const still = reduce.matches, dk = !still && docking(now), b = beatRef.current?.current;
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
      // 눈 — 도킹이면 올려다봄 · 하늘을 볼 땐 검은자가 위에서 좌우로 천천히 · 수다 중엔 말하는 쪽 쳐다봄↔웃음 · 평소 자주 웃음
      const up = dk || w.look === 'sky';
      const talking = !!meet && meet.phase === 'chat' && !dk && (w === meet.v || w === meet.h);
      const e: Eye = up ? (!dk && now < w.blinkUntil ? 'shut' : 'up')
        : talking ? (w === speaker ? (Math.floor(now / (HOLD * 0.6)) % 3 === 2 ? 'smile' : 'look') : (Math.floor(now / (HOLD * 2.2)) % 4 === 3 ? 'look' : 'smile'))
        : now < w.smileUntil && (w.mode === 'walk' || w.mode === 'sit') ? 'smile'
        : now < w.blinkUntil ? 'shut' : 'look';
      setEye(w, e);
      if (e === 'up') w.p.eyes.up.setAttribute('cx', (EYE_UP.cx + (still ? 0 : 10 * Math.sin(now * 0.35 + w.ph))).toFixed(1));
      // 몸짓 — 말하는 쪽은 들썩(키의 3%), 듣는 쪽은 끄덕(2%) · 도킹의 폴짝(글자마다)
      const talkDy = !talking ? 0 : w === speaker ? Math.abs(Math.sin(now * 9)) * hc * 0.03 : Math.abs(Math.sin(now * 3.5)) * hc * 0.02;
      let hop = 0;
      if (dk && b) for (const t of b.letters) { const k = (now - t) / HOP.t; if (k >= 0 && k < 1) hop = Math.max(hop, Math.sin(Math.PI * k)); }
      const lift = hop * HOP.h * hc + talkDy;
      const ox = (CX - VB.x) * s, oy = (FOOT_Y - VB.y) * s, pop = Math.max(0.001, easeEmph(w.pop));
      w.el.style.transform = `translate3d(${(w.x - ox).toFixed(1)}px, ${(floor - oy - lift).toFixed(1)}px, 0) scale(${pop.toFixed(3)})`;
      // 수다의 점 세 알 — 말하는 쪽 머리 위, 말하는 방향으로 차례로
      const n = w === speaker ? Math.floor((now * 3.5) % 4) : 0, dir = w.face > 0 ? -1 : 1;
      const hy = floor - lift - (FOOT_Y - SIT.drop * easeStd(w.sitT)) * s - 0.1 * hc, hx = w.x + dir * 0.42 * hc;
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
      if (!reduce.matches) brain(now);
      ws.forEach((w) => step(w, now, dt));
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
