import { memo, useEffect, useRef, useState } from 'react';
import VoiceBubble from './VoiceBubble';
import { ENTRANCE, G, RD, RF, arrange, arrangeOf, dockPlanOf, evenSpread, gapsOf, hurry, kindOf, modulesAt, tailOf, type Dot, type Item, type Kind, type Plan, type Tail } from '../lib/aggregate';
import { paintBody, paintEntrance, placeGlyphs, type Glyph, type Pop } from '../lib/dotPaint';
import { FAN, SKY, WAVE, WIDE, bodyOf, fanOf, profileOf, ringOf, turn, waveAlpha, wavesAt, type Box, type Seat, type Seated } from '../lib/sky';
import { foldLines } from '../lib/fit';
import { cssRgb, hash } from '../lib/hatch';
import { fontMap } from '../lib/palettes';
import { groundPx } from '../lib/ground';
import { tokenS } from '../lib/motion';
import { colorsOf } from '../lib/messageStyle';
import type { StoredMessage } from '../lib/firebase';
import type { DockBeat } from './WallWalkers';

/**
 * 벽 = 하늘에 뜬 말들 + 도킹 장면(2026-10-20, 결정 3 D · 결정 4 · 5). 나무 · 돌 · 구름 · 비눗방울의 풍경을 대체한다.
 *
 * 평소 — 지난 말들이 모인 채(도트 집합체, lib/aggregate.ts) 하늘에 아주 작게 둥실인다. 자리는 기기를 중심으로 한 부채꼴 — 두 겹 호에
 * 자리 번호 차례로 앉아 호의 결을 따라 3분의 1만큼 기운다(결정 9, lib/sky.ts). 꼬리는 기울어도 기기를 가리킨다. 하나가 바뀌면 그 호의
 * 이웃들이 호를 따라 미끄러진다. 겹치면 나중에 온 말이 앞에서 그냥 가린다 — 말마다 한 겹(캔버스 + 글자)이고 오래된 말부터 놓는다.
 *
 * 도킹 —
 *   1. 하늘 말들이 0.6초에 광각처럼 퍼진다(큰 말을 둘러싼 고리, 1.45배 · 고리 따라 기울기)며 회색(--grey-800, 글자도)으로 가라앉는다.
 *   2. 새 말이 화면 정중앙에 크게 — 꼬리가 먼저(결정 9): 첫 글자의 퍼진 자리에서 기기 쪽 끝부터 밑동으로 0.45초에 솟고, 그 밑동(입)에서
 *      글자 점들이 성격별 등장(쿵 · 몽글 · 착 · 뿅)으로 나간다 → 다 서면 줄이 화면 가로 94%까지 휭(꼬리는 첫 글자를 따라간다).
 *   3. 크게 머문다(도킹 중, 꼬리 단 채). 새 말의 하늘 자리는 이때 미리 정한다(열이 찼거나 호에 안 들어가면 가장 오래 떠 있던 말이 꼬리
 *      끝부터 터지고 새 말이 그 자리 번호를 물려받는다 — 없으면 맨 뒤 번호).
 *   4. 해제 → 그 퍼진 자리에서 꼬리 단 채 모임 0.7초 → 0.4초 뒤 1.4초(easeInOut)에 작아지며 하늘의 제자리로. 이때 하늘 말들이
 *      제 색 · 제자리로 돌아온다.
 * 사흘이 지난 말도 꼬리 끝부터 연쇄로 터진다.
 *
 * 소리의 결(결정 9) — 평소엔 없다. 도킹 때만 메가폰처럼 격렬하게: 도킹 순간 가장 굵은 결 한 방(광각 퍼짐과 함께), 글자가 설 때마다 한 방,
 * 크게 머무는 동안 0.4초마다 쏟아지고 모이며 잦아든다. 말과 땅 뒤(WallSimulation의 .wall-waves)에 --grey-600으로. 결이 지나가면 하늘
 * 말이 덜컥 흔들린다 — 큰 말은 흔들지 않는다(소리의 주인).
 *
 * 돌려 보이기(결정 8) — 하늘엔 많아야 열 개(lib/sky.ts). 못 뜬 말 · 넘쳐 터진 말은 기다림 줄에 선다(지운 게 아니다 — 사흘 약속을 이것으로
 * 지킨다). 1분마다 가장 오래 떠 있던 말이 꼬리 끝부터 터져 줄 맨 뒤로 가고, 줄 맨 앞 말이 그 자리 번호를 물려받아 0.9초 뒤 기기에서
 * 0.4배로 쏘아 올라 1.4초(easeOut)에 제자리로 곧게 커지며 붙는다(꼬리는 늘 기기를 가리키고, 기울기는 0에서 제 기울기로). 도킹 중엔
 * 돌지 않고 끝나면 1분을 다시 센다.
 * 쏘아 오르는 중엔 도킹을 열지 않는다(다 붙은 뒤에 연다). '떠 있던 때'는 하늘에 붙은 때다 — 처음 쌓은 말만 쓰인 시각으로 잰다.
 * 사흘이 지나 터진 자리는 다음 돌림이 터뜨리지 않고 올리기만 해서 열 개로 다시 채운다.
 *
 * 말의 부스러기(결정 6) — 터지는 말의 점 다섯 알에 한 알꼴이 제 색으로(회색으로 가라앉아 있었어도) 땅에 떨어져 모래처럼 쌓이고, 땅 색으로
 * 천천히 바래다 가라앉는다. 기기에서 쏘아 올라 → 하늘에 쌓이고 → 터져 → 땅에 내려앉는 한 바퀴. 더미는 배경 — 작은 사람 뒤에 그린다.
 * 처음 켤 땐 빈 땅에서 시작한다.
 */
const GATHER = 0.7, WAIT = 0.4, RISE = 1.4, WHOOSH = 0.7;
/** 터짐이 꼬리 끝에서 번지는 빠르기 — 벽 폭의 몫/초(견본 520px@1280) · 시작까지 · 다 터지고 걷는 때 */
const POP_V = 520 / 1280, POP_DELAY = 0.25, POP_DONE = 3;
/** 하늘 말을 다시 그리는 간격(초 — 나부낌 · 둥실은 30fps). 도킹 중의 큰 말은 매 프레임 */
const SKY_DT = 0.033;
/**
 * 부스러기 — 다섯 알에 한 알 · 중력(화면 높이/초²) · 처음 속도(가로 ± 폭의 몫/초, 위로 높이의 몫/초) · 더미 높이 상한(땅 띠 위, 벽 높이의 몫) ·
 * 로고 앞 비우는 반폭(폭의 몫 — 떨어지면 가까운 가장자리로, 흘러내려도 벽처럼 넘지 않는다) · 바래는 시간(초 — 하루, 2026-10-20 결정 22로
 * 확정. 견본은 45초) · 다 바랜 뒤 그만큼 더 지나면 땅 띠 속으로 가라앉아 없어진다(더미가 끝없이 차지 않게 — 한 알이 --t-crumb-sink초에 한
 * 칸, 위의 알들이 함께 내려앉는다) · 바래는 동안 다시 칠하는 간격(초)
 */
const CRUMB = { every: 5, gravity: 2.2, vx: 0.03, vy: 0.06, maxH: 0.03, logo: 0.04, fade: 86400, sink: 86400, repaint: 10 };
/** 돌려 보이기(결정 8) — 간격(초) · 터진 뒤 쏘기까지 · 쏘아 올라 붙는 시간 · 기기에서 나올 때의 배율 */
const ROT = { every: 60, wait: 0.9, shot: 1.4, from: 0.4 };
type Crumb = { col: string; t: number };
type Fall = { x: number; y: number; vx: number; vy: number; col: string };
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const easeIO = (k: number) => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2);
const clamp = (k: number) => Math.min(1, Math.max(0, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

type P = [number, number];
/** 한 말 — 글 · 줄 · 성격 · 글자 자리 · 틈 메움 · 색 · 나부낌 박자 · 둥실의 위상 · 나이(쓰인 시각 — 가장 오래된 말부터 터지고, 나중 말이 앞에 선다) */
interface Base { id: string; msg: StoredMessage; lines: string[]; kd: Kind; items: Item[]; gaps: Dot[]; bg: string; fg: string; ph: number; dr: [number, number, number]; born: number }
/** 하늘의 자리 — 부채꼴 위 자리(px, 말 원점) · 기울기(라디안) · 자리 번호 · 몸통 상자(px, 기울기 전) */
type Place = Seat & Seated;
/** 하늘에 붙은 말 — 자리 · 미끄러지는 중(from → pos, fromRot → rot, mv초부터) · 아래에서 올라오는 중 · 꼬리 · 캔버스 범위(u) · 터지는 때 */
interface Sky extends Base, Place { from?: P; fromRot?: number; mv?: number; up?: number; tail: Tail; box: Box; popAt?: number;
  /** 터질 때 땅에 떨어질 점(다섯 알에 한 알) · 이미 떨어뜨린 점 */
  seeds?: Dot[]; sent?: Set<number> }
/** 도킹하는 말 — 시작(초) · 크게 선 1u(px) · 등장 계획 · 휭 퍼진 낱개 자리 · 낱개 자리의 모듈 · 기기(u) · 큰 꼬리 · 하늘 자리 · 해제(초) · 광각 고리 */
interface Dock extends Base { key: number; T: number; S: number; plan: Plan; spread: Item[]; rest: ReturnType<typeof modulesAt>; mouth: readonly [number, number]; tail: Tail; at: Place; release: number; ring: Map<Sky, { to: P; rot: number }>;
  /** 글자가 다 서기 전에 뗐다(결정 21) — 남은 글자를 당겨 세우고 휭 · 머묾 없이 곧장 모인다 */
  early?: boolean }
/** 돌림으로 기기에서 쏘아 오르는 말 — 하늘 자리 · 쏘는 때(초) */
interface Launch { b: Base; at: Place; T: number }
const times = (D: Dock) => {
  // 꼬리는 처음부터 있다(결정 9) — 모이고(0.7초) 0.4초 있다 하늘로
  // 시각은 모두 페이지 시계(초) — 계획(plan)의 값은 큰 말이 선 때(D.T)부터 센 것이라 D.T를 더한다(예전엔 휭 끝을 더하지 않아 휭 도중에
  // 떼면 휭을 기다리지 않고 모였다). 일찍 뗐으면(결정 21) 마지막 글자가 서자마자 모인다 — 휭 · 크게 머묾은 건너뛴다
  const merge = D.early ? D.T + Math.max(...D.plan.modDone) : Math.max(D.T + D.plan.whoosh + WHOOSH, D.release), rise = merge + GATHER + WAIT;
  return { merge, rise, end: rise + RISE };
};

function baseOf(msg: StoredMessage): Base {
  const tone = msg.tone, lines = foldLines(msg.text), kd = kindOf(tone?.font), items = arrange(lines, arrangeOf(tone?.font, tone?.align), kd);
  const { bg, text } = colorsOf(msg), h = hash(msg.id);
  return { id: msg.id, msg, lines, kd, items, gaps: gapsOf(items, kd), bg, fg: text, ph: (h % 628) / 100, dr: [((h >>> 8) % 628) / 100, ((h >>> 16) % 628) / 100, ((h >>> 24) * 6.28) / 256], born: msg.createdAt };
}
/** 기기(벽 아래 가운데 바깥)를 그 자리의 말 좌표(u)로 */
const devFrom = (pos: readonly number[], W: number, H: number, u: number): P => [(W / 2 - pos[0]) / u, (H * (1 + SKY.devDrop) - pos[1]) / u];
/** 기기를 가리키는 꼬리 — 그 자리(px)에서, 기운 말의 좌표로 잰다(기울어도 기기를 가리킨다) */
const tailAt = (b: Base, pos: readonly number[], rot: number, W: number, H: number, u: number) => tailOf(b.items, b.kd, turn(devFrom(pos, W, H, u), -rot));
/** 하늘의 말 — 그 자리의 꼬리 · 캔버스 범위 */
function skyAt(b: Base, at: Place, W: number, H: number, u: number): Sky {
  const tail = tailAt(b, at.pos, at.rot, W, H, u), all = [...modulesAt(b.items, b.kd, 1).dots, ...b.gaps, ...tail.dots];
  const e = 3 * G, xs = all.map((d) => d.x), ys = all.map((d) => d.y);
  return { ...b, pos: at.pos, rot: at.rot, slot: at.slot, body: at.body, tail, box: [Math.min(...xs) - e, Math.min(...ys) - e, Math.max(...xs) + e, Math.max(...ys) + e] };
}
/** 몸통 상자 — 하늘 가운데 위쪽(SKY.probe)에서의 꼬리로 잰다 */
const bodyAt = (b: Base, W: number, H: number, u: number) =>
  bodyOf(profileOf([...modulesAt(b.items, b.kd, 1).dots, ...b.gaps, ...tailAt(b, [W / 2, SKY.probe * H], 0, W, H, u).dots], u), u);
const slid = (s: Sky, now: number) => (s.mv !== undefined && now < s.mv + SKY.move ? easeIO((now - s.mv) / SKY.move) : 1);
const posAt = (s: Sky, now: number): P => { const k = slid(s, now); return s.from && k < 1 ? [lerp(s.from[0], s.pos[0], k), lerp(s.from[1], s.pos[1], k)] : s.pos; };
const rotAt = (s: Sky, now: number) => { const k = slid(s, now); return s.fromRot !== undefined && k < 1 ? lerp(s.fromRot, s.rot, k) : s.rot; };
/** 캔버스 · 글자 겹을 그 자리 · 기울기 · 배율로 */
const put = (ctx: CanvasRenderingContext2D, S: number, X: number, Y: number, rot: number, dpr: number) => {
  const c = Math.cos(rot) * S * dpr, s = Math.sin(rot) * S * dpr;
  ctx.setTransform(c, s, -s, c, X * dpr, Y * dpr);
};
/** 터지기 시작한다 — 꼬리 끝부터 연쇄로, 다섯 알에 한 알은 땅에 떨어진다 */
const leave = (s: Sky, t: number): Sky => ({ ...s, popAt: t + POP_DELAY, sent: new Set(),
  seeds: [...modulesAt(s.items, s.kd, 1).dots, ...s.gaps, ...s.tail.dots].filter((_, i) => i % CRUMB.every === 0) });
/**
 * 하늘에 떠다님 '자유'(결정 24, 2026-10-20 디자이너 — "좀 더 자유롭게 둥실둥실"). 그 말의 u(px) 기준, φ는 말마다 다르다:
 * 가로 u(0.85 sin(0.11t + φ1) + 0.30 sin(0.37t + φ3)) · 세로 u(0.95 sin(0.09t + φ2) + 0.30 sin(0.41t + 1.7φ3)) · 갸웃 0.045rad(±2.6°)
 * × sin(0.10t + 2.3φ1) — 결 따라 기울기(1/3) 위에 더한다. 이웃과 가끔 겹친다(나중 말이 앞). 광각으로 퍼지는 동안은 (1 − P)만큼 줄어든다
 */
const drift = (b: Base, now: number, u: number): [number, number, number] => [
  u * (0.85 * Math.sin(0.11 * now + b.dr[0]) + 0.3 * Math.sin(0.37 * now + b.dr[2])),
  u * (0.95 * Math.sin(0.09 * now + b.dr[1]) + 0.3 * Math.sin(0.41 * now + 1.7 * b.dr[2])),
  0.045 * Math.sin(0.1 * now + 2.3 * b.dr[0])];

type Els = { wrap: HTMLDivElement; canvas: HTMLCanvasElement; text: HTMLDivElement };
/** 말의 윗선 — 점 간격 칸마다 가장 높은 윗끝(말 좌표 u, 메움 반지름까지) · 윗선이 있는 가로 범위 · 몸통 상자(꼬리 뺌) */
type Top = { cols: Map<number, number>; span: [number, number]; body: Box };

/**
 * 작은 사람이 딛는 하늘 말(하늘 놀이, 2026-10-20 진행4) — 그 순간의 자리(px, 말 원점) · 기울기 · 1u(px) · 윗선(말 좌표 x0 ~ x1에서 가장
 * 높은 윗끝, 없으면 null) · 윗선이 있는 가로 범위 · 몸통 상자(말 좌표) · 다음에 터질 말(가장 오래 떠 있던 말)인가
 */
export type Perch = { id: string; X: number; Y: number; rot: number; u: number; top: (x0: number, x1: number) => number | null; span: [number, number]; body: Box; old: boolean };
/** 하늘 놀이의 통로 — WallSky가 적고 작은 사람이 읽는다. at = 그 순간 딛을 수 있는 말(도킹 중엔 없다 — 광각으로 퍼지니 땅으로) */
export type SkyPerch = { at: (t: number) => Perch[] };

interface Props {
  /** 벽에 떠 있을 글 — 사흘 안, 최신이 앞(WallSimulation) */
  list: readonly StoredMessage[];
  /** 지금 도킹한 글 — key가 바뀌면 새 도킹, release = 해제(폰을 뗐다 · 30초) */
  dock: { msg: StoredMessage; key: number; release: boolean } | null;
  /** 도킹의 박자를 적어 둘 곳 — 작은 사람이 읽는다(큰 말이 선 때 · 글자마다 다 쌓인 때 · 하늘로 오르는 때) */
  beat?: { current: DockBeat | null };
  /** 소리의 결을 그릴 캔버스 — 땅 뒤에 놓인 것(WallSimulation) */
  waves?: { current: HTMLCanvasElement | null };
  /** 작은 사람이 딛을 하늘 말을 내줄 곳(하늘 놀이) */
  perch?: { current: SkyPerch | null };
}

export default function WallSky({ list, dock, beat, waves, perch }: Props) {
  const beatRef = useRef(beat), wavesRef = useRef(waves);
  beatRef.current = beat;
  wavesRef.current = waves;
  const host = useRef<HTMLDivElement>(null), dockCv = useRef<HTMLCanvasElement>(null), dockText = useRef<HTMLDivElement>(null), crumbCv = useRef<HTMLCanvasElement>(null);
  const els = useRef(new Map<string, Els>());
  /** queue = 기다림 줄(글 id, 앞이 먼저) · shot = 쏘아 오르는 말 · nextRot = 다음 돌림(초) */
  const model = useRef({ sky: [] as Sky[], leaving: [] as Sky[], dock: null as Dock | null, queue: [] as string[], shot: null as Launch | null, nextRot: Infinity, W: 0, H: 0, u: 0, ready: false,
    /** 부스러기 — 점 간격 칸마다 쌓인 더미(아래부터) · 떨어지는 점 · 다시 칠할까 · 마지막으로 칠한 때 · 마지막 걸음 */
    crumbs: { cols: [] as Crumb[][], falls: [] as Fall[], dirty: true, painted: -Infinity, last: NaN, sinking: false },
    /** 하늘 놀이 — 말의 윗선(말 id → 한 번 셈) */
    tops: new Map<string, Top>() });
  const [, bump] = useState(0);
  /** 하늘을 처음 쌓았나 — 그 전에 온 도킹은 쌓은 뒤에 연다 */
  const [ready, setReady] = useState(false);
  /** 쏘아 오른 말이 붙을 때마다 — 그동안 미뤄 둔 도킹을 연다 */
  const [landed, setLanded] = useState(0);
  const rerender = () => bump((v) => v + 1);
  const quiet = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => performance.now() / 1000;

  /** 하늘 말의 그 순간 자리 · 기울기(광각 · 덜컥 전) — 미끄러짐 · 아래(기기)에서 곧게 올라와 붙음(도킹 없이 들어온 말, 기울기는 0에서 제
      기울기로) · 떠다님. 그리기와 작은 사람(하늘 놀이)이 같은 셈을 쓴다 */
  const whereAt = (s: Sky, t: number): [number, number, number] => {
    const { W, H, u } = model.current;
    let [x, y] = posAt(s, t), r0 = rotAt(s, t);
    if (s.up !== undefined && t < s.up + RISE) { const k = easeIO((t - s.up) / RISE); x = lerp(W / 2, x, k); y = lerp(H * (1 + SKY.devDrop), y, k); r0 *= k; }
    const [dx, dy, dq] = quiet ? [0, 0, 0] : drift(s, t, u);
    return [x + dx, y + dy, r0 + dq];
  };
  const topOf = (b: Base): Top => {
    const M = model.current;
    let v = M.tops.get(b.id);
    if (v) return v;
    const cols = new Map<number, number>(), body: Box = [Infinity, Infinity, -Infinity, -Infinity];
    for (const d of [...modulesAt(b.items, b.kd, 1).dots, ...b.gaps]) {
      const c = Math.round(d.x / G), r = RF * d.r;
      cols.set(c, Math.min(cols.get(c) ?? Infinity, d.y - r));
      body[0] = Math.min(body[0], d.x - r); body[1] = Math.min(body[1], d.y - r); body[2] = Math.max(body[2], d.x + r); body[3] = Math.max(body[3], d.y + r);
    }
    const cs = [...cols.keys()];
    v = { cols, span: [Math.min(...cs) * G, Math.max(...cs) * G], body };
    M.tops.set(b.id, v);
    return v;
  };
  // 하늘 놀이 — 작은 사람이 딛을 말을 내준다. 도킹 중 · 올라오는 중인 말은 없다
  useEffect(() => {
    if (!perch) return;
    perch.current = {
      at: (t) => {
        const M = model.current;
        if (!M.ready || M.dock || !M.sky.length) return [];
        const oldest = M.sky.reduce((a, b) => (a.born < b.born ? a : b));
        return M.sky.filter((s) => s.up === undefined || t >= s.up + RISE).map((s) => {
          const [X, Y, rot] = whereAt(s, t), tp = topOf(s);
          const top = (x0: number, x1: number) => {
            let y = Infinity;
            for (let c = Math.round(x0 / G); c <= Math.round(x1 / G); c++) y = Math.min(y, tp.cols.get(c) ?? Infinity);
            return y === Infinity ? null : y;
          };
          return { id: s.id, X, Y, rot, u: M.u, top, span: tp.span, body: tp.body, old: s === oldest };
        });
      }
    };
    return () => { perch.current = null; };
  }, [perch]);

  /** 가장 오래 떠 있던 말이 터져 기다림 줄 맨 뒤로 — 그 말(자리 번호를 물려줄) */
  const pop = (t: number, animate: boolean) => {
    const M = model.current, old = M.sky.reduce((a, b) => (a.born < b.born ? a : b));
    M.sky = M.sky.filter((s) => s !== old);
    M.queue.push(old.id);
    if (animate) M.leaving.push(leave(old, t));
    return old;
  };
  /** 부채꼴이 다시 나뉜 자리로 — 바뀐 말은 호를 따라 미끄러진다(꼬리 · 캔버스 범위를 새 자리에서 다시 셈한다) */
  const move = (to: Map<Sky, Seat>, t: number, animate: boolean) => {
    const M = model.current, { W, H, u } = M;
    M.sky = M.sky.map((s) => {
      const q = to.get(s);
      if (!q || (q.pos[0] === s.pos[0] && q.pos[1] === s.pos[1] && q.rot === s.rot)) return s;
      return { ...skyAt(s, { ...q, slot: s.slot, body: s.body }, W, H, u), up: s.up, ...(animate ? { from: posAt(s, t), fromRot: rotAt(s, t), mv: t } : {}) };
    });
  };
  /** 빠진 뒤 — 남은 말들로 부채꼴을 다시 나눈다 */
  const settle = (t: number, animate: boolean) => {
    const M = model.current, to = fanOf(M.sky, M.W, M.H, M.u);
    if (to) move(to, t, animate);
  };
  /**
   * 새 말의 자리 — 열이 찼으면 가장 오래 떠 있던 말이 터지고 새 말이 그 자리 번호를 물려받는다(slot을 주면 그 번호 — 돌림). 번호가 없으면
   * 맨 뒤. 두 겹 호에 안 들어가면 하나씩 더 터뜨린다. newer = 하늘의 어느 말보다 새 말인가 — 아니면(늦게 받은 옛 글) 자리가 날 때만 붙고
   * 남을 밀어내지 않는다(null — 기다림 줄로)
   */
  const roomFor = (b: Base, t: number, animate: boolean, slot?: number, newer = true): Place | null => {
    const M = model.current, { W, H, u } = M, body = bodyAt(b, W, H, u);
    if (!newer && M.sky.length >= SKY.max) return null;
    let freed: number | undefined;
    while (M.sky.length >= SKY.max) freed = pop(t, animate).slot;
    const me: Seated = { body, slot: slot ?? freed ?? Math.max(-1, ...M.sky.map((s) => s.slot)) + 1 };
    for (let inherit = slot === undefined && freed === undefined; ; ) {
      const to = fanOf<Seated>([...M.sky, me], W, H, u);
      if (to) { move(to as Map<Sky, Seat>, t, animate); return { ...to.get(me)!, ...me }; }
      if (!newer) return null;
      // 혼자서도 안 들어가는 말(있을 수 없는 크기) — 하늘 가운데 위쪽에 똑바로
      if (!M.sky.length) return { pos: [W / 2 - (body[0] + body[2]) / 2, SKY.ceil * H - body[1]], rot: 0, ...me };
      // 자리를 내느라 터진 말의 번호를 물려받는다(처음 하나만) — 안 그러면 맨 뒤로 붙어 모두가 한 칸씩 밀린다
      const old = pop(t, animate);
      if (inherit) { me.slot = old.slot; inherit = false; }
    }
  };
  /** 돌려 보이기 한 번 — 가장 오래 떠 있던 말이 터져 줄 맨 뒤로 · 줄 맨 앞 말(목록에서 빠진 글은 건너뜀)이 그 자리 번호를 물려받아 ROT.wait 뒤 쏘아
      오른다. 하늘이 열 개가 안 되면(사흘이 지나 터진 자리) 터뜨리지 않고 올리기만 해 열 개로 다시 채운다(디자이너 10-20) */
  const rotate = (t: number) => {
    const M = model.current;
    M.nextRot = t + ROT.every;
    const freed = M.sky.length >= SKY.max ? pop(t, true).slot : undefined;
    let msg: StoredMessage | undefined;
    while (!msg && M.queue.length) { const id = M.queue.shift(); msg = listRef.current.find((m) => m.id === id); }
    if (msg) { const b = baseOf(msg); M.shot = { b, at: roomFor(b, t, true, freed)!, T: t + (quiet ? 0 : ROT.wait) }; }
    rerender();
  };

  // 크기 — 창이 바뀌면 하늘을 처음부터 다시 쌓는다(움직임 없이)
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const measure = () => {
      const M = model.current, W = el.clientWidth, H = el.clientHeight;
      if (!W || !H || (W === M.W && H === M.H)) return;
      Object.assign(M, { W, H, u: SKY.u * H });
      M.crumbs = { cols: Array.from({ length: Math.ceil(W / (G * M.u)) + 2 }, () => []), falls: [], dirty: true, painted: -Infinity, last: NaN, sinking: false };
      if (M.ready) { M.ready = false; M.sky = []; M.leaving = []; M.queue = []; M.shot = null; M.dock = null; }
      sync();
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  // 글 목록 — 처음엔 오래된 것부터 쌓고(넘치면 오래된 말이 빠진다), 그 뒤로는 사흘이 지난 말은 터지고 새로 온 말은 아래에서 올라와 붙는다
  const listRef = useRef(list);
  listRef.current = list;
  const sync = () => {
    const M = model.current;
    if (!M.W) return;
    const t = now(), ids = new Set(listRef.current.map((m) => m.id)), dockId = M.dock?.id;
    const order = [...listRef.current].sort((a, b) => a.createdAt - b.createdAt);
    let changed = false;
    if (!M.ready) {
      for (const m of order) {
        if (m.id === dockId) continue;
        // 자리부터 — roomFor가 M.sky를 새 배열로 바꾸므로 push를 한 식에 쓰면 옛 배열에 들어가 그 말이 사라진다
        const b = baseOf(m), at = roomFor(b, t, false)!;
        M.sky.push(skyAt(b, at, M.W, M.H, M.u));
      }
      M.ready = true;
      M.nextRot = t + ROT.every;
      setReady(true);
      rerender();
      return;
    }
    const gone = M.sky.filter((s) => !ids.has(s.id));
    if (gone.length) {
      M.sky = M.sky.filter((s) => ids.has(s.id));
      for (const s of gone) M.leaving.push(leave(s, t));
      settle(t, true);
      changed = true;
    }
    // 사흘이 지난 글 — 기다림 줄에 있으면 조용히 빠진다
    M.queue = M.queue.filter((id) => ids.has(id));
    for (const m of order) {
      if (m.id === dockId || m.id === M.shot?.b.id || M.queue.includes(m.id) || M.sky.some((s) => s.id === m.id) || M.leaving.some((s) => s.id === m.id)) continue;
      const b = baseOf(m), oldest = Math.min(Infinity, ...M.sky.map((s) => s.born)), at = roomFor(b, t, true, undefined, b.born > oldest);
      if (!at) { M.queue.push(m.id); continue; }
      M.sky.push({ ...skyAt(b, at, M.W, M.H, M.u), up: t, born: Date.now() });
      changed = true;
    }
    if (changed) rerender();
  };
  useEffect(sync, [list]);

  // 도킹 — 새 key면 새 말을 크게(하늘에 있던 같은 말은 걷고 그 자리는 다시 올라붙는다), release면 해제
  useEffect(() => {
    const M = model.current;
    if (!dock || !M.ready) return;
    const t = now(), { W, H, u } = M;
    if (M.dock && M.dock.key === dock.key) {
      const D = M.dock;
      if (dock.release && D.release === Infinity) {
        D.release = t;
        // 글자가 다 서기 전에 뗐다(결정 21) — 남은 글자를 0.15초 간격으로 당겨 세우고(점은 그대로 쏘아) 휭 없이 곧장 모인다
        if (!quiet && t - D.T < Math.max(...D.plan.modDone)) { D.plan = hurry(D.plan, t - D.T); D.spread = D.items; D.early = true; }
      }
      return;
    }
    // 쏘아 오르는 말이 다 붙은 뒤에 연다(landed가 다시 부른다)
    if (M.shot) return;
    if (M.dock) { const D = M.dock; M.sky.push({ ...skyAt(D, D.at, W, H, u), born: Date.now() }); M.dock = null; }
    if (M.sky.some((s) => s.id === dock.msg.id)) { M.sky = M.sky.filter((s) => s.id !== dock.msg.id); settle(t, true); }
    M.queue = M.queue.filter((id) => id !== dock.msg.id);
    const b = baseOf(dock.msg), at = roomFor(b, t, true)!;
    // 꼬리가 먼저(결정 9) — 모였을 때의 꼬리를 첫 글자의 퍼진 자리에 붙이고, 글자 점들은 그 밑동(입)에서 나간다. 폰 07도 같은 셈으로
    // 결의 박자를 읽는다(dockPlanOf). 미소 · 단호는 휭도 가로세로 같이 — 가로만 벌리면 단호 12°가 8~10°로 눕는다(셋째 점검)
    const { S, tail, rest, mouth, plan } = dockPlanOf(b.items, b.kd, W, H, SKY.devDrop, evenSpread(arrangeOf(dock.msg.tone?.font, dock.msg.tone?.align)));
    M.dock = { ...b, key: dock.key, T: t, S, plan, spread: b.items.map((it) => ({ ...it, ax: it.ax * plan.F, ay: it.ay * plan.Fy })), rest, mouth,
      tail, at, release: dock.release ? t : Infinity, ring: ringOf([...M.sky, ...M.leaving], W, H) };
    rerender();
  }, [dock?.key, dock?.release, ready, landed]);

  // 그리기 — 한 시계
  useEffect(() => {
    const css = getComputedStyle(document.documentElement), grey = cssRgb(css.getPropertyValue('--grey-800')), waveCol = css.getPropertyValue('--grey-600').trim();
    /** 결 캔버스에 지난 그림이 남아 있나 — 도킹이 끝나면 한 번 지운다 */
    let waved = false;
    const mix = (c: string, k: number) => { if (k <= 0) return c; const a = cssRgb(c); return `rgb(${a.map((v, i) => Math.round(v + (grey[i] - v) * k)).join(' ')})`; };
    let raf = 0, last = -Infinity;
    const glyphEls = (e: HTMLElement | null) => [...(e?.querySelectorAll<HTMLElement>('.arc-glyph') ?? [])];
    /**
     * 부스러기의 한 걸음 — 떨어지는 점은 중력으로 내려와 그 칸 더미 위에 닿으면 쌓인다. 쌓일 칸: 로고 앞이면 가까운 가장자리로, 옆 칸보다
     * 두 알 이상 높아지면 낮은 쪽으로 흘러내린다(여덟 번까지), 상한을 넘으면 버린다. 더미는 벌집(홀수 층 반 칸 엇갈림) · 같은 색 메움
     */
    const SINK = tokenS('--t-crumb-sink', 40);
    const crumbs = (t: number, W: number, H: number, u: number, dpr: number) => {
      const C = model.current.crumbs, cv = crumbCv.current, g = G * u, row = (g * Math.sqrt(3)) / 2, top = H - groundPx(H);
      const max = Math.floor((H * CRUMB.maxH) / row), n = C.cols.length;
      const dt = Number.isNaN(C.last) ? 0 : Math.min(0.05, t - C.last);
      C.last = t;
      const settle = (c: number) => {
        const lo = Math.round((W * (0.5 - CRUMB.logo)) / g), hi = Math.round((W * (0.5 + CRUMB.logo)) / g), wall = (k: number) => k > lo && k < hi;
        if (wall(c)) c = c - lo < hi - c ? lo : hi;
        // 흘러내릴 때 로고 앞 칸은 벽이다(점검 둘째 — 비워 둔 칸으로 8알이 흘러 들어왔다)
        for (let k = 0; k < 8; k++) {
          const h = C.cols[c].length, l = wall(c - 1) ? 99 : C.cols[c - 1]?.length ?? 99, r = wall(c + 1) ? 99 : C.cols[c + 1]?.length ?? 99;
          if (h > l + 1 && l <= r) c--; else if (h > r + 1) c++; else break;
        }
        return C.cols[c] && C.cols[c].length < max ? c : -1;
      };
      for (let i = C.falls.length - 1; i >= 0; i--) {
        const q = C.falls[i];
        q.vy += CRUMB.gravity * H * dt; q.vx *= 0.99; q.x += q.vx * dt; q.y += q.vy * dt;
        const c0 = Math.max(1, Math.min(n - 2, Math.round(q.x / g)));
        if (q.y < top - C.cols[c0].length * row) continue;
        const c = settle(c0);
        if (c >= 0) C.cols[c].push({ col: q.col, t });
        C.falls.splice(i, 1);
        C.dirty = true;
      }
      // 다 바랜 뒤 그만큼 더 지난 알은 땅 띠 속으로 가라앉는다(결정 22 — 48시간째에 한꺼번에 사라지던 것을, 한 알이 SINK초에 한 칸씩 묻히게.
      // 위의 알들이 함께 내려앉는다). 다 묻힌 알은 지운다. 가라앉는 동안은 0.5초마다 다시 칠한다
      const due = CRUMB.fade + CRUMB.sink, down = (q: Crumb) => clamp((t - q.t - due) / SINK), every = C.sinking ? 0.5 : CRUMB.repaint;
      if (t - C.painted >= every) {
        C.sinking = false;
        for (const stack of C.cols) {
          while (stack.length && down(stack[0]) >= 1) { stack.shift(); C.dirty = true; }
          if (stack.length && t - stack[0].t > due) C.sinking = C.dirty = true;
        }
      }
      if (!cv || (!C.dirty && !C.falls.length && t - C.painted < every)) return;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rf = RF * u, rd = RD * u;
      // 땅 띠 속은 그리지 않는다 — 맨 아래 알의 밑까지만(가라앉지 않은 더미는 예전 그대로)
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, top - 0.55 * row + rf); ctx.clip();
      C.cols.forEach((stack, c) => {
        const off = stack.reduce((a, q) => a + down(q), 0);
        stack.forEach((q, k) => {
          ctx.fillStyle = mix(q.col, clamp((t - q.t) / CRUMB.fade));
          ctx.beginPath(); ctx.arc(c * g + (k & 1 ? g / 2 : 0), top - (k + 0.55 - off) * row, rf, 0, 2 * Math.PI); ctx.fill();
        });
      });
      ctx.restore();
      for (const q of C.falls) { ctx.fillStyle = q.col; ctx.beginPath(); ctx.arc(q.x, q.y, rd, 0, 2 * Math.PI); ctx.fill(); }
      C.dirty = false;
      C.painted = t;
    };
    const frame = (ms: number) => {
      raf = requestAnimationFrame(frame);
      const M = model.current, t = ms / 1000, D = M.dock;
      if (!M.ready || !M.W) return;
      const { W, H, u } = M, dpr = Math.min(2, window.devicePixelRatio || 1);
      // 도킹이 끝났다 — 하늘의 제자리로 들어간다
      // — 도킹한 말은 하늘에 붙는 이 순간이 '떠오른 때'(가장 늦게 터진다). 돌림의 1분은 여기서 다시 센다
      if (D && t >= times(D).end) { M.sky.push({ ...skyAt(D, D.at, W, H, u), born: Date.now() }); M.dock = null; M.nextRot = t + ROT.every; rerender(); }
      if (!M.dock && !M.shot && M.queue.length && t >= M.nextRot) rotate(t);
      const before = M.leaving.length;
      M.leaving = M.leaving.filter((s) => t < (s.popAt ?? 0) + POP_DONE);
      if (M.leaving.length !== before) rerender();
      if (!M.dock && !M.shot && t - last < SKY_DT) return;
      last = t;
      // 광각 · 회색 정도 — 도킹하면 0.6초에 퍼지고, 새 말이 하늘로 오르는 1.4초에 돌아온다
      const T = M.dock ? times(M.dock) : null;
      if (beatRef.current) beatRef.current.current = M.dock && T ? { start: M.dock.T, letters: M.dock.plan.modDone.map((x) => M.dock!.T + x), rise: T.rise } : null;
      const P = !M.dock || !T ? 0 : t < T.rise ? easeOut(clamp((t - M.dock.T) / WIDE.t)) : 1 - easeIO(clamp((t - T.rise) / RISE));
      // 소리의 결 — 도킹 때만(움직임을 줄인 화면엔 없다). 말과 땅 뒤의 캔버스에 그린다
      const ws = M.dock && T && !quiet ? wavesAt(t - M.dock.T, M.dock.plan.modDone, T.merge - M.dock.T) : [], wc = wavesRef.current?.current, dv: P = [W / 2, H * (1 + SKY.devDrop)];
      const RX = FAN.rings[0].a * W, RY = FAN.rings[0].b * H;
      if (wc && (ws.length || waved)) {
        if (wc.width !== Math.round(W * dpr)) { wc.width = Math.round(W * dpr); wc.height = Math.round(H * dpr); }
        const g = wc.getContext('2d');
        if (g) {
          g.setTransform(1, 0, 0, 1, 0, 0);
          g.clearRect(0, 0, wc.width, wc.height);
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          g.strokeStyle = waveCol;
          for (const w of ws) {
            const a = waveAlpha(w);
            if (a <= 0) continue;
            g.globalAlpha = a; g.lineWidth = WAVE.line * H * w.s;
            g.beginPath(); g.ellipse(dv[0], dv[1], w.k * RX, w.k * RY, 0, Math.PI, 2 * Math.PI); g.stroke();
          }
          g.globalAlpha = 1;
        }
        waved = ws.length > 0;
      }
      // 덜컥 — 결이 지나가는 자리의 하늘 말이 기기 반대쪽으로 밀렸다 돌아온다(말의 k = 기기에서 그 자리까지를 바깥 호 타원으로 잰 배수)
      const jolt = (X: number, Y: number): P => {
        if (!ws.length) return [0, 0];
        const x = X - dv[0], y = Y - dv[1], k = Math.hypot(x / RX, y / RY), n = Math.hypot(x, y) || 1;
        const a = ws.reduce((s, w) => s + w.a * Math.min(w.s, 3) * Math.exp(-(((w.k - k) / WAVE.sig) ** 2)), 0);
        return [(WAVE.bob * u * a * x) / n, (WAVE.bob * u * a * y) / n];
      };
      for (const s of [...M.leaving, ...M.sky]) {
        const e = els.current.get(s.id + (s.popAt ? ':pop' : ''));
        if (!e) continue;
        const [x, y, r0] = whereAt(s, t), w = M.dock?.ring.get(s);
        // 광각 — 제 기울기에서 고리의 기울기로(퍼지는 정도만큼)
        const X0 = w ? lerp(x, w.to[0], P) : x, Y0 = w ? lerp(y, w.to[1], P) : y, rot = w ? lerp(r0, w.rot, P) : r0, k = w ? lerp(1, WIDE.grow, P) : 1;
        const [qx, qy] = jolt(X0, Y0), X = X0 + qx, Y = Y0 + qy;
        e.wrap.style.transform = `translate(${X.toFixed(1)}px, ${Y.toFixed(1)}px) rotate(${rot.toFixed(4)}rad) scale(${k.toFixed(4)})`;
        const ctx = e.canvas.getContext('2d');
        if (!ctx) continue;
        const res = u * dpr * WIDE.grow;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, e.canvas.width, e.canvas.height);
        ctx.setTransform(res, 0, 0, res, -s.box[0] * res, -s.box[1] * res);
        ctx.fillStyle = mix(s.bg, P);
        const pop: Pop | undefined = s.popAt === undefined ? undefined : { now: t, at: (px, py) => s.popAt! + (Math.hypot(px - s.tail.tip[0], py - s.tail.tip[1]) * u) / (POP_V * W) };
        const gs = paintBody(ctx, s.items, s.kd, s.gaps, 1, s.tail, 1, t, s.ph, quiet, pop);
        // 터진 자리의 다섯 알에 한 알 — 그 순간의 화면 자리(광각 고리 · 기울기 · 배율까지)에서 제 색으로 떨어진다
        if (pop && s.seeds && s.sent) {
          const cr = Math.cos(rot), sr = Math.sin(rot);
          s.seeds.forEach((d, i) => {
            if (s.sent!.has(i) || t < pop.at(d.x, d.y)) return;
            s.sent!.add(i);
            M.crumbs.falls.push({ x: X + k * u * (d.x * cr - d.y * sr), y: Y + k * u * (d.x * sr + d.y * cr), vx: (Math.random() - 0.5) * 2 * CRUMB.vx * W, vy: -Math.random() * CRUMB.vy * H, col: s.bg });
          });
        }
        placeGlyphs(glyphEls(e.text), gs, u);
        const vb = e.text.firstElementChild as HTMLElement | null;
        if (vb) vb.style.color = mix(s.fg, P);
      }
      crumbs(t, W, H, u, dpr);
      // 도킹하는 큰 말 — 화면 전체 한 겹, 맨 앞
      const c = dockCv.current, Dk = M.dock;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      // 큰 겹의 글자 — 겹째 그 자리 · 기울기로 옮기고 글자는 말 좌표로 놓는다
      const putText = (gs: Glyph[], Su: number, X: number, Y: number, rot: number) => {
        const el = dockText.current;
        if (!el) return;
        Object.assign(el.style, { fontSize: `${Su.toFixed(2)}px`, transformOrigin: '0 0', transform: `translate(${X.toFixed(1)}px, ${Y.toFixed(1)}px) rotate(${rot.toFixed(4)}rad)` });
        placeGlyphs(glyphEls(el), gs, Su);
      };
      // 돌림으로 쏘아 오르는 말 — 기기에서 0.4배로 나와 제자리로 곧게 커지며 붙는다. 기울기는 0에서 제 기울기로, 꼬리는 그 순간의 자리에서
      // 기기를 가리킨다. 쏘기 전엔 글자를 숨긴다
      const Sh = M.shot;
      if (dockText.current) dockText.current.style.visibility = !Dk && Sh && t < Sh.T ? 'hidden' : '';
      if (!Dk && Sh) {
        if (t < Sh.T) return;
        const e = easeOut(clamp((t - Sh.T) / ROT.shot)), [dx, dy, dq] = quiet ? [0, 0, 0] : drift(Sh.b, t, u), Su = lerp(ROT.from * u, u, e), rot = (Sh.at.rot + dq) * e;
        const X = lerp(W / 2, Sh.at.pos[0] + dx, e), Y = lerp(H * (1 + SKY.devDrop), Sh.at.pos[1] + dy, e);
        put(ctx, Su, X, Y, rot, dpr);
        ctx.fillStyle = Sh.b.bg;
        putText(paintBody(ctx, Sh.b.items, Sh.b.kd, Sh.b.gaps, 1, tailAt(Sh.b, [X, Y], rot, W, H, Su), 1, t, Sh.b.ph, quiet), Su, X, Y, rot);
        if (e >= 1) { M.sky.push({ ...skyAt(Sh.b, Sh.at, W, H, u), born: Date.now() }); M.shot = null; setLanded((v) => v + 1); rerender(); }
        return;
      }
      if (!Dk || !T) return;
      const age = quiet ? Infinity : t - Dk.T;
      ctx.fillStyle = Dk.bg;
      let gs: Glyph[], Su = Dk.S, X = W / 2, Y = H / 2, rot = 0;
      if (!quiet && t < T.merge) {
        put(ctx, Su, X, Y, 0, dpr);
        gs = paintEntrance(ctx, Dk.rest, Dk.plan, Dk.mouth, age, ENTRANCE[Dk.kd.mod].land, WHOOSH, { tail: Dk.tail, items: Dk.items, sec: t, ph: Dk.ph, still: quiet });
      } else {
        // 꼬리 단 채 모인다 — 꼬리는 첫 글자를 따라간다(paintBody)
        const m = quiet ? 1 : easeOut(clamp((t - T.merge) / GATHER)), g = 1, r = easeIO(clamp((t - T.rise) / RISE));
        const [dx, dy, dq] = quiet ? [0, 0, 0] : drift(Dk, t, u);
        X = lerp(W / 2, Dk.at.pos[0] + dx, r); Y = lerp(H / 2, Dk.at.pos[1] + dy, r); Su = lerp(Dk.S, u, r); rot = (Dk.at.rot + dq) * r;
        // 오르는 동안 기울기는 0에서 제 기울기로, 꼬리는 그 순간의 자리에서 기기를 가리킨다
        const tail = r > 0 ? tailAt(Dk, [X, Y], rot, W, H, Su) : Dk.tail;
        put(ctx, Su, X, Y, rot, dpr);
        gs = paintBody(ctx, r > 0 ? Dk.items : Dk.spread, Dk.kd, Dk.gaps, r > 0 ? 1 : m, tail, g, t, Dk.ph, quiet);
      }
      putText(gs, Su, X, Y, rot);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const M = model.current, D = M.dock;
  const setEls = (id: string) => (wrap: HTMLDivElement | null) => {
    if (!wrap) { els.current.delete(id); return; }
    const canvas = wrap.querySelector('canvas')!, text = wrap.querySelector<HTMLDivElement>('.dot-text')!;
    els.current.set(id, { wrap, canvas, text });
  };
  return (
    <div ref={host} className="wall-sky" aria-hidden="true">
      {/* 오래된 말부터 — 나중에 온 말이 앞에서 가린다(터지는 말이 가장 오래됐으니 맨 먼저) */}
      {[...M.leaving, ...[...M.sky].sort((a, b) => a.born - b.born)].map((s) => (
        <SkyMsg key={s.id + (s.popAt ? ':pop' : '')} s={s} u={M.u} onEl={setEls(s.id + (s.popAt ? ':pop' : ''))} />
      ))}
      {/* 말의 부스러기 — 하늘 말 앞, 작은 사람 뒤(작은 사람은 WallSky 다음에 선다) */}
      <canvas ref={crumbCv} className="sky-crumbs" />
      <div className="sky-dock">
        <canvas ref={dockCv} />
        <div ref={dockText} className="dot-text">{D ? <Letters key={D.key} b={D} /> : M.shot && <Letters key={`shot:${M.shot.b.id}`} b={M.shot.b} />}</div>
      </div>
    </div>
  );
}

/** 말의 글자 — VoiceBubble의 한 자씩 놓기(서체 · 무게 · 기울기 · 획 보정이 3/5 그대로). 자리는 그리는 시계가 px로 놓는다 */
const Letters = memo(function Letters({ b }: { b: Base }) {
  const tone = b.msg.tone;
  return (
    <VoiceBubble text={b.lines.join('\n')} bg={b.bg} color={b.fg} fontFamily={fontMap[tone?.font ?? 'botong']} font={tone?.font}
      weight={tone?.wght ?? 400} width={tone?.tone ?? 1} slant={tone?.slnt ?? 0} size={tone?.size} manner={tone?.manner} speed={tone?.speed} weightPos={tone?.weight}
      fontSize="1em" glyphs={b.items.map((it) => ({ c: it.ch, x: 0, y: 0, a: it.a }))} glyphBox={{ w: 1, h: 1 }} />
  );
});

/** 하늘의 말 하나 — 한 겹(캔버스 + 글자). 자리 · 기울기 · 배율은 그리는 시계가 transform으로 */
const SkyMsg = memo(function SkyMsg({ s, u, onEl }: { s: Sky; u: number; onEl: (el: HTMLDivElement | null) => void }) {
  const dpr = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1), res = u * dpr * WIDE.grow;
  const [x0, y0, x1, y1] = s.box;
  return (
    <div className="sky-msg" ref={onEl}>
      <canvas width={Math.ceil((x1 - x0) * res)} height={Math.ceil((y1 - y0) * res)}
        style={{ left: `${(x0 * u).toFixed(2)}px`, top: `${(y0 * u).toFixed(2)}px`, width: `${((x1 - x0) * u).toFixed(2)}px`, height: `${((y1 - y0) * u).toFixed(2)}px` }} />
      <div className="dot-text" style={{ fontSize: `${u.toFixed(2)}px` }}><Letters b={s} /></div>
    </div>
  );
}, (a, b) => a.s.id === b.s.id && a.s.box === b.s.box && a.u === b.u);
