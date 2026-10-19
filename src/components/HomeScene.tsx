import { useEffect, useRef, type MutableRefObject } from 'react';
import mfLeft from '../../by_moomiryu/Renewal_v1/Character/megafont/left.svg';
import eyeGeneral from '../../by_moomiryu/Renewal_v1/Character/eye/eye_general.svg';
import eyeSee from '../../by_moomiryu/Renewal_v1/Character/eye/eye_see right.svg';
import eyeHappy from '../../by_moomiryu/Renewal_v1/Character/eye/eye_happy.svg';
import eyeTwinkle from '../../by_moomiryu/Renewal_v1/Character/eye/eye_twinkle.svg';
import eyeTired from '../../by_moomiryu/Renewal_v1/Character/eye/eye_tired.svg';
import eyeSurprise from '../../by_moomiryu/Renewal_v1/Character/eye/eye_surprise.svg';
import { G as DG, ROW as DROW, RD as DRD, RF as DRF, inPoly } from '../lib/aggregate';
import { BODY, CLIP_H, EYE_LOOK, EYE_SMILE, EYE_WHITE, EYE_WIDE, HEAD, SHADOW, SHADOW_SIDE, WALK } from '../character/walker';
import { easeOf, tokenS } from '../lib/motion';

/**
 * 홈의 장면(2026-10-20 디자이너 — 홈 구도는 풍경 포스터 그대로, 풍경 대신 이 장면. 견본은 그날 세션의 스크래치패드 home3.js).
 *
 * 메가폰트가 하늘에 말풍선을 하나씩 쏘아 짓는다 — 꼬리부터(말의 시작이라), 몸은 입에서 먼 점부터. 형상은 하트 · 별 · 유령 · 음표 · 느낌표처럼
 * 바로 읽히는 심볼이고 글자는 없다. 홈이라 늘 키컬러 레드, 점은 벽의 말과 같은 결(lib/aggregate — 벌집 격자 · 같은 색 메움).
 * 다 지어지면 잠시 머물다 꼬리 끝부터 터지고 다음 심볼로. 곁의 두 사람은 쏘는 순간 깜짝 놀라고, 다 지어진 심볼에 맞춰 반응한다.
 *
 * 메가폰트는 작가 그림 그대로 곧게 서 있다가(입이 왼쪽 — 두 사람 쪽) 쏠 때만 입을 15° 든다. 기울어도 가장 낮은 꼭짓점이 늘 땅에 닿는다.
 * 크기 · 자리는 HomePoster가 정한다(사람 키의 2배, 오른쪽 여백). 움직임 줄이기면 하트가 다 지어져 둘이 웃는 한 장면에 멈춘다.
 */

export interface SceneLay { W: number; H: number; G: number; skyTop: number; mf: { left: number; top: number; w: number; h: number } }
type Pt = [number, number];
type Face = 'general' | 'see right' | 'happy' | 'twinkle' | 'tired' | 'surprise';
type Reaction = 'hop2' | 'jump' | 'scared' | 'sway' | 'startle';
interface Dot { x: number; y: number; r: number; t?: number; e: number; a: number }
interface Sym { inside: (x: number, y: number) => boolean; face: Face; react: Reaction }

const EYE_SRC: Record<Face, string> = { general: eyeGeneral, 'see right': eyeSee, happy: eyeHappy, twinkle: eyeTwinkle, tired: eyeTired, surprise: eyeSurprise };
/** 작가 'left' 그림(1920 × 1080)의 몸 — 가운데(979, 538), 입(넓은 변) x 787.57, 실루엣 꼭짓점 */
const MF_C: Pt = [979, 538], MF_MOUTH = 787.6, MF_H = 582, SIL: readonly Pt[] = [[787.57, 249.03], [787.57, 830.96], [1102, 539.5], [1169.17, 643.11], [1169.17, 436.9]];
const TILT = (15 * Math.PI) / 180;
/** 사람 그림 — 발밑(HEAD.cx, 541.8)이 기준점. 그림은 왼쪽을 본다 → 메가폰트 쪽을 보게 좌우로 뒤집는다 */
const FOOT_Y = 541.8;
const SMILE_T = EYE_SMILE.transform.match(/-?[\d.]+/g)!.map(Number);   // translate(cx cy) scale(s) translate(-x -y)

// 심볼 — 단위 상자(-1 ~ 1). 유령의 두 눈은 구멍(점이 없다)
const HEART: Pt[] = Array.from({ length: 90 }, (_, i) => { const t = (i / 90) * 2 * Math.PI; return [(16 * Math.sin(t) ** 3) / 17, -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17 - 0.05]; });
const STAR: Pt[] = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.45 : 1.02; return [Math.cos(a) * r, Math.sin(a) * r + 0.08]; });
const GHOST: Pt[] = [
  ...Array.from({ length: 25 }, (_, i): Pt => { const a = Math.PI + (i / 24) * Math.PI; return [0.78 * Math.cos(a), -0.12 + 0.78 * Math.sin(a)]; }),
  [0.78, 0.85],
  ...Array.from({ length: 31 }, (_, i): Pt => { const x = 0.78 - (i / 30) * 1.56; return [x, 0.85 - 0.16 * Math.abs(Math.sin((i / 30) * 3 * Math.PI))]; })
];
const FLAG: Pt[] = [[0.16, -0.95], [0.62, -0.55], [0.6, -0.2], [0.16, -0.5]];
const ell = (x: number, y: number, cx: number, cy: number, rx: number, ry: number, rot = 0) => {
  const c = Math.cos(rot), s = Math.sin(rot), dx = x - cx, dy = y - cy, u = (dx * c + dy * s) / rx, v = (-dx * s + dy * c) / ry;
  return u * u + v * v <= 1;
};
const SYMBOLS: readonly Sym[] = [
  { inside: (x, y) => inPoly(HEART, x, y), face: 'happy', react: 'hop2' },   // 하트 — 웃으며 콩콩
  { inside: (x, y) => inPoly(STAR, x, y), face: 'twinkle', react: 'jump' },   // 별 — 웃으며 펄쩍
  { inside: (x, y) => inPoly(GHOST, x, y) && !ell(x, y, -0.3, -0.18, 0.13, 0.2) && !ell(x, y, 0.3, -0.18, 0.13, 0.2), face: 'tired', react: 'scared' },   // 유령 — 놀라 젖히며 떤다
  { inside: (x, y) => ell(x, y, -0.32, 0.62, 0.36, 0.26, -0.35) || (x > 0 && x < 0.16 && y > -0.95 && y < 0.6) || inPoly(FLAG, x, y), face: 'happy', react: 'sway' },   // 음표 — 웃으며 갸웃갸웃
  { inside: (x, y) => (Math.abs(x) < 0.2 && y > -0.95 && y < 0.38) || ell(x, y, 0, 0.76, 0.21, 0.21), face: 'surprise', react: 'startle' }   // 느낌표 — 놀라 펄쩍
];

const clamp = (t: number) => Math.max(0, Math.min(1, t));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export default function HomeScene({ lay, clock }: { lay: SceneLay; clock: MutableRefObject<number | null> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const { W, H, G: GY, mf } = lay, DPR = Math.max(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    const root = getComputedStyle(document.documentElement), col = (v: string) => root.getPropertyValue(v).trim();
    const RED = col('--brand-main'), CYAN = col('--char-cyan'), PAPER = col('--paper'), SHADE = col('--char-shade');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // 시간 — 토큰의 배수(HomePoster와 같은 방식). 겨눔 · 꼬리 = --t-slow, 몸 = 4 × --t-slow, 머묾 = 4 × --t-hold
    const HOLD = tokenS('--t-hold', 0.7), SLOW = tokenS('--t-slow', 0.4), RET = tokenS('--t-return', 0.22);
    const STD = easeOf('--ease-standard'), EMPH = easeOf('--ease-emphasized');

    // 메가폰트 — 몸 가운데 높이를 기울기마다 다시 잡아 가장 낮은 꼭짓점이 땅에
    const k = mf.h / MF_H, GROUND = mf.top + mf.h, PX = mf.left + (MF_C[0] - SIL[0][0]) * k;
    const silBottom = (tl: number) => Math.max(...SIL.map(([x, y]) => ((x - MF_C[0]) * Math.sin(tl) + (y - MF_C[1]) * Math.cos(tl)) * k));
    const pivot = (tl: number): Pt => [PX, GROUND - silBottom(tl)];
    const mouth = (tl: number): Pt => { const [x, y] = pivot(tl), m = (MF_MOUTH - MF_C[0]) * k; return [x + Math.cos(tl) * m, y + Math.sin(tl) * m]; };
    const DEV = mouth(TILT);

    // 점 격자 — 벽의 말과 같은 결. u = 폭 390에서 22.7px
    const U = W * 0.0581, P = DG * U, ROWP = DROW * U, RD = DRD * U, RF = DRF * U;
    // 심볼 반지름 · 가운데 — 원과 메가폰트 사이 하늘. 낮은 화면(320 × 568)에선 하늘 높이 안으로 줄인다(안 줄이면 원 글에 닿는다)
    const R = Math.min(0.24 * W, 0.42 * (GY - mf.h - lay.skyTop)), C: Pt = [0.42 * W, (lay.skyTop + (GY - mf.h)) / 2 + 0.02 * H];
    const SPEED = 900 * (W / 390), POP = 420 * (W / 390);
    const plan = (sym: Sym, T0: number) => {
      const body: Dot[] = [];
      for (let j = Math.floor((-1.15 * R) / ROWP); j <= (1.15 * R) / ROWP; j++) for (let i = Math.floor((-1.15 * R) / P) - 1; i <= (1.15 * R) / P + 1; i++) {
        const x = i * P + (j & 1 ? P / 2 : 0), y = j * ROWP;
        if (sym.inside(x / R, y / R)) body.push({ x: C[0] + x, y: C[1] + y, r: 1, e: 0, a: 0 });
      }
      // 꼬리 — 몸 아래쪽에서 입에 가장 가까운 점에서 입 쪽으로(밑동 반폭 0.2R · 길이 0.5R), 끝 절반에서 점이 작아진다
      const near = (d: Dot) => Math.hypot(d.x - DEV[0], d.y - DEV[1]);
      const a = body.filter((d) => d.y > C[1]).reduce((m, d) => (near(d) < near(m) ? d : m));
      const dl = near(a), ux = (DEV[0] - a.x) / dl, uy = (DEV[1] - a.y) / dl, w = 0.2 * R, L = Math.min(0.5 * R, dl - 14);
      const T: Pt[] = [[a.x - uy * w - ux * w, a.y + ux * w - uy * w], [a.x + ux * L, a.y + uy * L], [a.x + uy * w - ux * w, a.y - ux * w - uy * w]];
      const key = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`, has = new Set(body.map((d) => key(d.x, d.y))), tail: Dot[] = [];
      const tx = T.map((q) => q[0]), ty = T.map((q) => q[1]);
      for (let j = Math.floor((Math.min(...ty) - C[1]) / ROWP) - 1; j <= (Math.max(...ty) - C[1]) / ROWP + 1; j++) for (let i = Math.floor((Math.min(...tx) - C[0]) / P) - 1; i <= (Math.max(...tx) - C[0]) / P + 1; i++) {
        const x = C[0] + i * P + (j & 1 ? P / 2 : 0), y = C[1] + j * ROWP;
        if (!inPoly(T, x, y) || has.has(key(x, y))) continue;
        const t = clamp(((x - a.x) * ux + (y - a.y) * uy) / L);
        tail.push({ x, y, t, r: t < 0.5 ? 1 : 1 - 1.3 * (t - 0.5), e: 0, a: 0 });
      }
      const s0 = T0 + SLOW, fly = (d: Dot) => near(d) / SPEED;
      [...tail].sort((p, q) => q.t! - p.t!).forEach((d, n, arr) => { d.e = s0 + (SLOW * n) / Math.max(1, arr.length - 1); d.a = d.e + fly(d); });   // 꼬리 끝(입 쪽)부터
      [...body].sort((p, q) => fly(q) - fly(p)).forEach((d, n, arr) => { d.e = s0 + SLOW + RET / 2 + (4 * SLOW * n) / Math.max(1, arr.length - 1); d.a = d.e + fly(d); });   // 몸은 먼 점부터
      const all = [...tail, ...body], lastE = Math.max(...all.map((d) => d.e)), formed = Math.max(...all.map((d) => d.a)), popAt = formed + 4 * HOLD;
      const tip: Pt = [a.x + ux * L, a.y + uy * L], popOf = (d: Dot) => popAt + Math.hypot(d.x - tip[0], d.y - tip[1]) / POP;
      const end = Math.max(...all.map(popOf)) + RET;
      return { sym, all, T0, s0, lastE, formed, popAt, popOf, next: end + HOLD + RET };
    };
    const PLAN: ReturnType<typeof plan>[] = [];
    let T0 = HOLD;
    for (const sym of SYMBOLS) { const p = plan(sym, T0); PLAN.push(p); T0 = p.next; }
    const LOOP = T0;

    // 두 사람 — 메가폰트 왼쪽에 선다(사람 키 hh = 창 높이의 6.5%, HomePoster의 작은 사람과 같은 키)
    const hh = 0.065 * H, KS = hh / FOOT_Y, MF_LEFT = mf.left;
    const KIDS = [{ x: MF_LEFT - 0.62 * hh, color: RED, dl: 0, hop: 0.34 }, { x: MF_LEFT - 1.62 * hh, color: CYAN, dl: RET / 3, hop: 0.26 }];
    const BODY_P = new Path2D(BODY), FAR = new Path2D(WALK.farRest), NEAR = new Path2D(WALK.nearRest), SMILE = new Path2D(EYE_SMILE.d);
    const kid = (p: (typeof KIDS)[number], t: number, g: (typeof PLAN)[number] | undefined) => {
      let lift = 0, sq = 0, wide = 0, look: Pt | null = null, smile = false, lean = 0, dx = 0;
      const hopAt = (w: number, amp: number) => { const v = w / (2 * RET); return v > 0 && v < 1 ? amp * 4 * v * (1 - v) : 0; };
      if (g) {
        const w = t - (g.s0 + p.dl);   // 첫 발 — 깜짝 뛰고 놀란 눈 · 젖혀짐, 그다음 심볼을 올려다본다
        lift = hopAt(w, p.hop);
        if (w >= 2 * RET) sq = 0.14 * Math.exp(-14 * (w - 2 * RET));
        if (w >= 0) { wide = w < HOLD + RET ? 1 : Math.exp(-6 * (w - HOLD - RET)); lean = -0.14 * wide; look = C; }
        const r = t - (g.formed + p.dl);   // 다 지어진 심볼에 반응
        if (r >= 0 && t < g.popAt + RET) {
          if (g.sym.react === 'hop2') { smile = true; lift = Math.max(lift, hopAt(r, 0.16), hopAt(r - (HOLD - RET), 0.16)); }
          if (g.sym.react === 'jump') { smile = true; lift = Math.max(lift, hopAt(r, 0.32)); }
          if (g.sym.react === 'startle') { lift = Math.max(lift, hopAt(r, 0.32)); if (r < HOLD + RET) { wide = 1; lean = -0.14; } }
          if (g.sym.react === 'scared') { wide = 1; lean = -0.2; dx = r < HOLD + 2 * RET ? 1.6 * Math.sin(r * 55) : 0; }
          if (g.sym.react === 'sway') { smile = true; lean = 0.13 * Math.sin(r * 2 * Math.PI * 1.4); }
        }
        if (t >= g.popAt + RET) look = null;
      }
      const y = GROUND - lift * FOOT_Y * KS, sh = 1 - 0.35 * lift;
      ctx.fillStyle = SHADE; ctx.beginPath();   // 그림자는 땅에 — 보는 반대쪽(왼쪽)으로 길게 눕는다. 뛰면 작아진다
      ctx.ellipse(p.x - (SHADOW_SIDE.cx - HEAD.cx) * KS, GROUND, SHADOW_SIDE.rx * KS * sh, SHADOW.ry * KS * sh, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(p.x + dx, y); ctx.rotate(lean); ctx.scale(-KS * (1 + 0.7 * sq), KS * (1 - sq)); ctx.translate(-HEAD.cx, -FOOT_Y);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 533.26, CLIP_H + 7); ctx.clip();
      ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(HEAD.cx, HEAD.cy, HEAD.r, 0, 7); ctx.fill(); ctx.fill(BODY_P);
      ctx.fillStyle = PAPER; ctx.beginPath(); ctx.arc(EYE_WHITE.cx, EYE_WHITE.cy, EYE_WHITE.r, 0, 7); ctx.fill();
      ctx.fillStyle = p.color;
      if (smile) { ctx.save(); ctx.translate(SMILE_T[0], SMILE_T[1]); ctx.scale(SMILE_T[2], SMILE_T[2]); ctx.translate(SMILE_T[3], SMILE_T[4]); ctx.fill(SMILE); ctx.restore(); }
      else {
        const pr = lerp(EYE_LOOK.r, EYE_WIDE.r, wide), room = EYE_WHITE.r - pr;
        let ox = EYE_LOOK.cx - EYE_WHITE.cx, oy = 0;   // 평소엔 그림 그대로 — 앞(메가폰트 쪽)
        if (look) {   // 뒤집어 그리므로 화면의 가로는 그림에서 반대
          const ex = p.x - (EYE_WHITE.cx - HEAD.cx) * KS, ey = y - (FOOT_Y - EYE_WHITE.cy) * KS, ddx = look[0] - ex, ddy = look[1] - ey, d = Math.hypot(ddx, ddy) || 1;
          ox = (-ddx / d) * room * 0.75; oy = (ddy / d) * room * 0.75;
        } else if (wide) ox = lerp(ox, 0, wide);
        ctx.beginPath(); ctx.arc(EYE_WHITE.cx + ox, EYE_WHITE.cy + oy, pr, 0, 7); ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = p.color; ctx.fill(FAR); ctx.fill(NEAR);
      ctx.restore();
    };

    const MF = new Image(); MF.src = mfLeft;
    const EYES = Object.fromEntries(Object.entries(EYE_SRC).map(([f, src]) => { const i = new Image(); i.src = src; return [f, i]; })) as Record<Face, HTMLImageElement>;
    const megafont = (t: number, g: (typeof PLAN)[number] | undefined) => {
      let tl = 0, kick = 0, face: Face = 'general';
      if (g) {
        const u = t < g.lastE ? STD(clamp((t - (g.s0 - SLOW)) / SLOW)) : 1 - STD(clamp((t - g.lastE - RET / 2) / HOLD));
        tl = lerp(0, TILT, u);
        for (let b = g.s0; b <= g.lastE; b += RET) if (t >= b) kick = Math.max(kick, Math.exp(-14 * (t - b)));   // 쏘는 동안 박마다 짧게 뒤로 밀렸다 돌아온다
        face = t < g.s0 ? 'see right' : t < g.formed ? g.sym.face : t < g.popAt ? 'happy' : t < g.popAt + HOLD - RET ? 'surprise' : 'general';
      }
      const [x, y] = pivot(tl);
      ctx.save(); ctx.translate(x + Math.cos(tl) * 4 * kick, y + Math.sin(tl) * 4 * kick); ctx.rotate(tl); ctx.scale(k * (1 - 0.08 * kick), k * (1 + 0.05 * kick));
      ctx.drawImage(MF, -MF_C[0], -MF_C[1], 1920, 1080);
      // 표정 — 작가 eye_*.svg(메가폰트 눈의 정확히 2배)를 눈 자리에. 원래 고리 눈은 몸 색으로 덮는다(안 덮으면 가장자리에 흰 실선)
      ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(793.94 - MF_C[0], 537.02 - MF_C[1], 43.6, 0, 7); ctx.arc(913.78 - MF_C[0], 537.02 - MF_C[1], 43.6, 0, 7); ctx.fill();
      ctx.drawImage(EYES[face], 750.83 - MF_C[0], 493.91 - MF_C[1], 412.12 / 2, 172.43 / 2);
      ctx.restore();
    };
    const symbol = (t: number, g: (typeof PLAN)[number]) => {
      ctx.fillStyle = RED;
      const live: { x: number; y: number; r: number; fly: boolean; p: number }[] = [];
      for (const d of g.all) {
        if (t < d.e) continue;
        if (t < d.a) { const u = EMPH((t - d.e) / (d.a - d.e)); live.push({ x: lerp(DEV[0], d.x, u), y: lerp(DEV[1], d.y, u), r: RD * d.r * (0.35 + 0.65 * u), fly: true, p: 0 }); continue; }
        const p = (t - g.popOf(d)) / RET;
        if (p < 1) live.push({ x: d.x, y: d.y, r: d.r, fly: false, p: Math.max(0, p) });
      }
      for (const d of live) if (!d.fly && !d.p) { ctx.beginPath(); ctx.arc(d.x, d.y, RF * d.r, 0, 7); ctx.fill(); }   // 같은 색 메움 — 붙은 점만
      for (const d of live) { ctx.globalAlpha = d.fly ? 1 : 1 - d.p; ctx.beginPath(); ctx.arc(d.x, d.y, d.fly ? d.r : RD * d.r * (1 + 0.6 * d.p), 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
    };
    const render = (t: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      const g = PLAN.find((p) => t >= p.T0 && t < p.next);
      for (const p of KIDS) kid(p, t, g);
      megafont(t, g);
      if (g) symbol(t, g);
    };

    let raf = 0, dead = false;
    const ready = Promise.all([MF, ...Object.values(EYES)].map((i) => i.decode().catch(() => undefined)));
    ready.then(() => {
      if (dead) return;   // 그림이 오기 전에 화면을 떠났다
      if (reduce) { cv.style.opacity = '1'; render(PLAN[0].formed + HOLD); return; }   // 하트가 다 지어져 둘이 웃는 한 장면
      const tick = () => {
        const c = clock.current, n = performance.now();
        if (c === null || n < c) { cv.style.opacity = '0'; }
        else { cv.style.opacity = String(STD(clamp((n - c) / (2 * SLOW * 1000)))); render(((n - c) / 1000) % LOOP); }   // 스플래시 뒤에 서서히
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => { dead = true; cancelAnimationFrame(raf); };
  }, [lay, clock]);
  return <canvas ref={ref} className="home-scene" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0 }} />;
}
