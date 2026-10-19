import { memo, useEffect, useRef, useState } from 'react';
import VoiceBubble from './VoiceBubble';
import { ENTRANCE, G, RD, RF, arrange, arrangeOf, bigScale, gapsOf, kindOf, modulesAt, planEntrance, tailOf, type Dot, type Item, type Kind, type Plan, type Tail } from '../lib/aggregate';
import { paintBody, paintEntrance, placeGlyphs, type Glyph, type Pop } from '../lib/dotPaint';
import { SKY, WIDE, bottomOf, placeFor, profileOf, repack, ringOf, type Profile } from '../lib/sky';
import { foldLines } from '../lib/fit';
import { cssRgb, hash } from '../lib/hatch';
import { fontMap } from '../lib/palettes';
import { groundPx } from '../lib/ground';
import { colorsOf } from '../lib/messageStyle';
import type { StoredMessage } from '../lib/firebase';
import type { DockBeat } from './WallWalkers';

/**
 * 벽 = 하늘에 뜬 말들 + 도킹 장면(2026-10-20, 결정 3 D · 결정 4 · 5). 나무 · 돌 · 구름 · 비눗방울의 풍경을 대체한다.
 *
 * 평소 — 지난 말들이 모인 채(도트 집합체, lib/aggregate.ts) 하늘에 붙어 아주 작게 둥실인다. 자리는 버블 슈터처럼 위에서부터
 * 쌓인다(lib/sky.ts). 겹치면 나중에 온 말이 앞에서 그냥 가린다 — 말마다 한 겹(캔버스 + 글자)이고 오래된 말부터 놓는다.
 *
 * 도킹 —
 *   1. 하늘 말들이 0.6초에 광각처럼 퍼진다(큰 말을 둘러싼 고리, 1.45배 · 고리 따라 기울기)며 회색(--grey-800, 글자도)으로 가라앉는다.
 *   2. 새 말이 화면 정중앙에 크게 — 성격별 등장(쿵 · 몽글 · 착 · 뿅) → 다 서면 줄이 화면 가로 94%까지 휭.
 *   3. 크게 머문다(도킹 중, 꼬리 없음). 새 말의 하늘 자리는 이때 미리 정한다(꽉 차면 가장 오래된 말이 꼬리 끝부터 터지고 남은 말들이
 *      다시 올라붙는다).
 *   4. 해제 → 그 퍼진 자리에서 모임 0.7초 → 꼬리 솟음 0.6초 → 0.4초 뒤 1.4초(easeInOut)에 작아지며 하늘의 제자리로. 이때 하늘 말들이
 *      제 색 · 제자리로 돌아온다.
 * 사흘이 지난 말도 꼬리 끝부터 연쇄로 터진다.
 *
 * 돌려 보이기(결정 8) — 하늘엔 많아야 열 개(lib/sky.ts). 못 뜬 말 · 넘쳐 터진 말은 기다림 줄에 선다(지운 게 아니다 — 사흘 약속을 이것으로
 * 지킨다). 1분마다 가장 오래 떠 있던 말이 꼬리 끝부터 터져 줄 맨 뒤로 가고, 남은 말이 다시 올라붙고, 0.9초 뒤 줄 맨 앞 말이 기기에서
 * 0.4배로 쏘아 올라 1.4초(easeOut)에 제자리로 커지며 붙는다(꼬리는 늘 기기를 가리킨다). 도킹 중엔 돌지 않고 끝나면 1분을 다시 센다.
 * 쏘아 오르는 중엔 도킹을 열지 않는다(다 붙은 뒤에 연다). '떠 있던 때'는 하늘에 붙은 때다 — 처음 쌓은 말만 쓰인 시각으로 잰다.
 * 사흘이 지나 터진 자리는 다음 돌림이 터뜨리지 않고 올리기만 해서 열 개로 다시 채운다.
 *
 * 말의 부스러기(결정 6) — 터지는 말의 점 다섯 알에 한 알꼴이 제 색으로(회색으로 가라앉아 있었어도) 땅에 떨어져 모래처럼 쌓이고, 땅 색으로
 * 천천히 바래다 가라앉는다. 기기에서 쏘아 올라 → 하늘에 쌓이고 → 터져 → 땅에 내려앉는 한 바퀴. 더미는 배경 — 작은 사람 뒤에 그린다.
 * 처음 켤 땐 빈 땅에서 시작한다.
 */
const GATHER = 0.7, GROW = 0.6, WAIT = 0.4, RISE = 1.4, WHOOSH = 0.7;
/** 터짐이 꼬리 끝에서 번지는 빠르기 — 벽 폭의 몫/초(견본 520px@1280) · 시작까지 · 다 터지고 걷는 때 */
const POP_V = 520 / 1280, POP_DELAY = 0.25, POP_DONE = 3;
/** 하늘 말을 다시 그리는 간격(초 — 나부낌 · 둥실은 30fps). 도킹 중의 큰 말은 매 프레임 */
const SKY_DT = 0.033;
/**
 * 부스러기 — 다섯 알에 한 알 · 중력(화면 높이/초²) · 처음 속도(가로 ± 폭의 몫/초, 위로 높이의 몫/초) · 더미 높이 상한(땅 띠 위, 벽 높이의 몫) ·
 * 로고 앞 비우는 반폭(폭의 몫 — 떨어지면 가까운 가장자리로) · 바래는 시간(초 — 실제 벽은 하루, 디자이너 제안. 견본은 45초) · 다 바랜 뒤
 * 그만큼 더 지나면 땅 띠 속으로 가라앉아 없어진다(더미가 끝없이 차지 않게) · 바래는 동안 다시 칠하는 간격(초)
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
interface Base { id: string; msg: StoredMessage; lines: string[]; kd: Kind; items: Item[]; gaps: Dot[]; bg: string; fg: string; ph: number; dr: P; born: number }
/** 하늘에 붙은 말 — 자리(px, 말 원점) · 다시 올라붙는 중(from → pos, mv초부터) · 아래에서 올라오는 중 · 꼬리 · 윤곽 · 캔버스 범위(u) · 터지는 때 */
interface Sky extends Base { pos: P; from?: P; mv?: number; up?: number; tail: Tail; prof: Profile; box: [number, number, number, number]; popAt?: number;
  /** 터질 때 땅에 떨어질 점(다섯 알에 한 알) · 이미 떨어뜨린 점 */
  seeds?: Dot[]; sent?: Set<number> }
/** 도킹하는 말 — 시작(초) · 크게 선 1u(px) · 등장 계획 · 휭 퍼진 낱개 자리 · 낱개 자리의 모듈 · 기기(u) · 큰 꼬리 · 하늘 자리 · 해제(초) · 광각 고리 */
interface Dock extends Base { key: number; T: number; S: number; plan: Plan; spread: Item[]; rest: ReturnType<typeof modulesAt>; dev: P; tail: Tail; to: P; release: number; ring: Map<Sky, { to: P; rot: number }> }
/** 돌림으로 기기에서 쏘아 오르는 말 — 하늘 자리 · 쏘는 때(초) */
interface Launch { b: Base; to: P; T: number }
const times = (D: Dock) => {
  const merge = Math.max(D.plan.whoosh + WHOOSH, D.release), sprout = merge + GATHER, rise = sprout + GROW + WAIT;
  return { merge, sprout, rise, end: rise + RISE };
};

function baseOf(msg: StoredMessage): Base {
  const tone = msg.tone, lines = foldLines(msg.text), kd = kindOf(tone?.font), items = arrange(lines, arrangeOf(tone?.font, tone?.align), kd);
  const { bg, text } = colorsOf(msg), h = hash(msg.id);
  return { id: msg.id, msg, lines, kd, items, gaps: gapsOf(items, kd), bg, fg: text, ph: (h % 628) / 100, dr: [((h >>> 8) % 628) / 100, ((h >>> 16) % 628) / 100], born: msg.createdAt };
}
/** 기기(벽 아래 가운데 바깥)를 그 자리의 말 좌표(u)로 */
const devFrom = (pos: readonly number[], W: number, H: number, u: number): P => [(W / 2 - pos[0]) / u, (H * (1 + SKY.devDrop) - pos[1]) / u];
/** 하늘의 말 — 그 자리의 꼬리(기기를 가리킨다) · 윤곽 · 캔버스 범위 */
function skyAt(b: Base, pos: P, W: number, H: number, u: number): Sky {
  const tail = tailOf(b.items, b.kd, devFrom(pos, W, H, u)), all = [...modulesAt(b.items, b.kd, 1).dots, ...b.gaps, ...tail.dots];
  const e = 3 * G, xs = all.map((d) => d.x), ys = all.map((d) => d.y);
  return { ...b, pos, tail, prof: profileOf(all, u), box: [Math.min(...xs) - e, Math.min(...ys) - e, Math.max(...xs) + e, Math.max(...ys) + e] };
}
/** 자리를 잴 때의 윤곽 — 하늘 가운데 위쪽(SKY.probe)에서의 꼬리로 */
const probeOf = (b: Base, W: number, H: number, u: number) => skyAt(b, [W / 2, SKY.probe * H], W, H, u).prof;
const posAt = (s: Sky, now: number): P => (s.from && s.mv !== undefined && now < s.mv + SKY.move ? [lerp(s.from[0], s.pos[0], easeIO((now - s.mv) / SKY.move)), lerp(s.from[1], s.pos[1], easeIO((now - s.mv) / SKY.move))] : s.pos);
/** 터지기 시작한다 — 꼬리 끝부터 연쇄로, 다섯 알에 한 알은 땅에 떨어진다 */
const leave = (s: Sky, t: number): Sky => ({ ...s, popAt: t + POP_DELAY, sent: new Set(),
  seeds: [...modulesAt(s.items, s.kd, 1).dots, ...s.gaps, ...s.tail.dots].filter((_, i) => i % CRUMB.every === 0) });
/** 하늘에 둥실 — 붙은 맛이 깨지지 않게 아주 작게(±2 · ±1.5px@1280 × 720) */
const drift = (b: Base, now: number, W: number, H: number): P => [((2 * W) / 1280) * Math.sin(now * 0.35 + b.dr[0]), ((1.5 * H) / 720) * Math.sin(now * 0.5 + b.dr[1])];

type Els = { wrap: HTMLDivElement; canvas: HTMLCanvasElement; text: HTMLDivElement };

interface Props {
  /** 벽에 떠 있을 글 — 사흘 안, 최신이 앞(WallSimulation) */
  list: readonly StoredMessage[];
  /** 지금 도킹한 글 — key가 바뀌면 새 도킹, release = 해제(폰을 뗐다 · 30초) */
  dock: { msg: StoredMessage; key: number; release: boolean } | null;
  /** 도킹의 박자를 적어 둘 곳 — 작은 사람이 읽는다(큰 말이 선 때 · 글자마다 다 쌓인 때 · 하늘로 오르는 때) */
  beat?: { current: DockBeat | null };
}

export default function WallSky({ list, dock, beat }: Props) {
  const beatRef = useRef(beat);
  beatRef.current = beat;
  const host = useRef<HTMLDivElement>(null), dockCv = useRef<HTMLCanvasElement>(null), dockText = useRef<HTMLDivElement>(null), crumbCv = useRef<HTMLCanvasElement>(null);
  const els = useRef(new Map<string, Els>());
  /** queue = 기다림 줄(글 id, 앞이 먼저) · shot = 쏘아 오르는 말 · nextRot = 다음 돌림(초) */
  const model = useRef({ sky: [] as Sky[], leaving: [] as Sky[], dock: null as Dock | null, queue: [] as string[], shot: null as Launch | null, nextRot: Infinity, W: 0, H: 0, u: 0, ready: false,
    /** 부스러기 — 점 간격 칸마다 쌓인 더미(아래부터) · 떨어지는 점 · 다시 칠할까 · 마지막으로 칠한 때 · 마지막 걸음 */
    crumbs: { cols: [] as Crumb[][], falls: [] as Fall[], dirty: true, painted: -Infinity, last: NaN } });
  const [, bump] = useState(0);
  /** 하늘을 처음 쌓았나 — 그 전에 온 도킹은 쌓은 뒤에 연다 */
  const [ready, setReady] = useState(false);
  /** 쏘아 오른 말이 붙을 때마다 — 그동안 미뤄 둔 도킹을 연다 */
  const [landed, setLanded] = useState(0);
  const rerender = () => bump((v) => v + 1);
  const quiet = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const now = () => performance.now() / 1000;

  /** 새 말의 자리 — 꽉 차면(아랫변이 화면 절반을 넘거나 열이 다 찼으면) 가장 오래 떠 있던 말이 터져 기다림 줄 맨 뒤로 가고 남은 말들이
      다시 올라붙는다. 될 때까지. newer = 하늘의 어느 말보다 새 말인가 — 아니면(늦게 받은 옛 글) 자리가 날 때만 붙고 남을 밀어내지
      않는다(null — 기다림 줄로) */
  const admit = (prof: Profile, t: number, animate: boolean, newer = true): P | null => {
    const M = model.current, { W, H, u } = M;
    let to = placeFor(prof, M.sky, W, H, u);
    const full = () => bottomOf(prof, to[1]) > SKY.full * H || M.sky.length >= SKY.max;
    if (!newer && M.sky.length && full()) return null;
    while (M.sky.length && full()) {
      const old = M.sky.reduce((a, b) => (a.born < b.born ? a : b));
      M.sky = M.sky.filter((s) => s !== old);
      M.queue.push(old.id);
      if (animate) M.leaving.push(leave(old, t));
      settle(t, animate);
      to = placeFor(prof, M.sky, W, H, u);
    }
    return to;
  };
  /** 빠진 뒤 다시 올라붙기 — 새 자리에서 꼬리 · 윤곽을 다시 셈한다 */
  const settle = (t: number, animate: boolean) => {
    const M = model.current, { W, H, u } = M, to = repack(M.sky, W, H, u);
    M.sky = M.sky.map((s, i) => {
      if (to[i][0] === s.pos[0] && to[i][1] === s.pos[1]) return s;
      return { ...skyAt(s, to[i], W, H, u), up: s.up, ...(animate ? { from: posAt(s, t), mv: t } : {}) };
    });
  };
  /** 돌려 보이기 한 번 — 가장 오래 떠 있던 말이 터져 줄 맨 뒤로 · 남은 말이 올라붙음 · 줄 맨 앞 말(목록에서 빠진 글은 건너뜀)이 ROT.wait 뒤 쏘아 오른다.
      하늘이 열 개가 안 되면(사흘이 지나 터진 자리) 터뜨리지 않고 올리기만 해 열 개로 다시 채운다(디자이너 10-20) — 화면 절반에 걸리면 admit이 터뜨린다 */
  const rotate = (t: number) => {
    const M = model.current, { W, H, u } = M;
    M.nextRot = t + ROT.every;
    if (M.sky.length >= SKY.max) {
      const old = M.sky.reduce((a, b) => (a.born < b.born ? a : b));
      M.sky = M.sky.filter((s) => s !== old);
      M.leaving.push(leave(old, t));
      M.queue.push(old.id);
      settle(t, true);
    }
    let msg: StoredMessage | undefined;
    while (!msg && M.queue.length) { const id = M.queue.shift(); msg = listRef.current.find((m) => m.id === id); }
    if (msg) { const b = baseOf(msg); M.shot = { b, to: admit(probeOf(b, W, H, u), t, true)!, T: t + (quiet ? 0 : ROT.wait) }; }
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
      M.crumbs = { cols: Array.from({ length: Math.ceil(W / (G * M.u)) + 2 }, () => []), falls: [], dirty: true, painted: -Infinity, last: NaN };
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
        // 자리부터 — admit이 M.sky를 새 배열로 바꾸므로 push를 한 식에 쓰면 옛 배열에 들어가 그 말이 사라진다
        const b = baseOf(m), to = admit(probeOf(b, M.W, M.H, M.u), t, false)!;
        M.sky.push(skyAt(b, to, M.W, M.H, M.u));
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
      const b = baseOf(m), oldest = Math.min(Infinity, ...M.sky.map((s) => s.born)), to = admit(probeOf(b, M.W, M.H, M.u), t, true, b.born > oldest);
      if (!to) { M.queue.push(m.id); continue; }
      M.sky.push({ ...skyAt(b, to, M.W, M.H, M.u), up: t, born: Date.now() });
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
    if (M.dock && M.dock.key === dock.key) { if (dock.release && M.dock.release === Infinity) M.dock.release = t; return; }
    // 쏘아 오르는 말이 다 붙은 뒤에 연다(landed가 다시 부른다)
    if (M.shot) return;
    if (M.dock) { const D = M.dock; M.sky.push({ ...skyAt(D, D.to, W, H, u), born: Date.now() }); M.dock = null; }
    if (M.sky.some((s) => s.id === dock.msg.id)) { M.sky = M.sky.filter((s) => s.id !== dock.msg.id); settle(t, true); }
    M.queue = M.queue.filter((id) => id !== dock.msg.id);
    const b = baseOf(dock.msg), to = admit(probeOf(b, W, H, u), t, true)!;
    const S = bigScale(b.items, b.kd, W, H), dev: P = [0, (H / 2 + H * SKY.devDrop) / S], plan = planEntrance(b.items, b.kd, dev, S, W);
    M.dock = { ...b, key: dock.key, T: t, S, plan, spread: b.items.map((it) => ({ ...it, ax: it.ax * plan.F })), rest: modulesAt(b.items, b.kd, 0), dev,
      tail: tailOf(b.items, b.kd, dev), to, release: dock.release ? t : Infinity, ring: ringOf([...M.sky, ...M.leaving], W, H) };
    rerender();
  }, [dock?.key, dock?.release, ready, landed]);

  // 그리기 — 한 시계
  useEffect(() => {
    const grey = cssRgb(getComputedStyle(document.documentElement).getPropertyValue('--grey-800'));
    const mix = (c: string, k: number) => { if (k <= 0) return c; const a = cssRgb(c); return `rgb(${a.map((v, i) => Math.round(v + (grey[i] - v) * k)).join(' ')})`; };
    let raf = 0, last = -Infinity;
    const glyphEls = (e: HTMLElement | null) => [...(e?.querySelectorAll<HTMLElement>('.arc-glyph') ?? [])];
    /**
     * 부스러기의 한 걸음 — 떨어지는 점은 중력으로 내려와 그 칸 더미 위에 닿으면 쌓인다. 쌓일 칸: 로고 앞이면 가까운 가장자리로, 옆 칸보다
     * 두 알 이상 높아지면 낮은 쪽으로 흘러내린다(여덟 번까지), 상한을 넘으면 버린다. 더미는 벌집(홀수 층 반 칸 엇갈림) · 같은 색 메움
     */
    const crumbs = (t: number, W: number, H: number, u: number, dpr: number) => {
      const C = model.current.crumbs, cv = crumbCv.current, g = G * u, row = (g * Math.sqrt(3)) / 2, top = H - groundPx(H);
      const max = Math.floor((H * CRUMB.maxH) / row), n = C.cols.length;
      const dt = Number.isNaN(C.last) ? 0 : Math.min(0.05, t - C.last);
      C.last = t;
      const settle = (c: number) => {
        const lo = Math.round((W * (0.5 - CRUMB.logo)) / g), hi = Math.round((W * (0.5 + CRUMB.logo)) / g);
        if (c > lo && c < hi) c = c - lo < hi - c ? lo : hi;
        for (let k = 0; k < 8; k++) {
          const h = C.cols[c].length, l = C.cols[c - 1]?.length ?? 99, r = C.cols[c + 1]?.length ?? 99;
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
      // 다 바랜 뒤 그만큼 더 지난 알은 가라앉는다(위의 알이 한 칸씩 내려앉는다)
      if (t - C.painted >= CRUMB.repaint) for (const stack of C.cols) {
        const keep = stack.filter((q) => t - q.t < CRUMB.fade + CRUMB.sink);
        if (keep.length !== stack.length) { stack.splice(0, stack.length, ...keep); C.dirty = true; }
      }
      if (!cv || (!C.dirty && !C.falls.length && t - C.painted < CRUMB.repaint)) return;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const rf = RF * u, rd = RD * u;
      C.cols.forEach((stack, c) => stack.forEach((q, k) => {
        ctx.fillStyle = mix(q.col, clamp((t - q.t) / CRUMB.fade));
        ctx.beginPath(); ctx.arc(c * g + (k & 1 ? g / 2 : 0), top - (k + 0.55) * row, rf, 0, 2 * Math.PI); ctx.fill();
      }));
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
      if (D && t >= times(D).end) { M.sky.push({ ...skyAt(D, D.to, W, H, u), born: Date.now() }); M.dock = null; M.nextRot = t + ROT.every; rerender(); }
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
      for (const s of [...M.leaving, ...M.sky]) {
        const e = els.current.get(s.id + (s.popAt ? ':pop' : ''));
        if (!e) continue;
        let [x, y] = posAt(s, t);
        // 아래(기기)에서 곧게 올라와 붙는다 — 도킹 없이 들어온 말
        if (s.up !== undefined && t < s.up + RISE) { const k = easeIO((t - s.up) / RISE); x = lerp(W / 2, x, k); y = lerp(H * (1 + SKY.devDrop), y, k); }
        const [dx, dy] = quiet ? [0, 0] : drift(s, t, W, H), w = M.dock?.ring.get(s);
        const X = w ? lerp(x + dx, w.to[0], P) : x + dx, Y = w ? lerp(y + dy, w.to[1], P) : y + dy, rot = w ? w.rot * P : 0, k = w ? lerp(1, WIDE.grow, P) : 1;
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
      // 돌림으로 쏘아 오르는 말 — 기기에서 0.4배로 나와 제자리로 커지며 붙는다. 꼬리는 그 순간의 자리에서 기기를 가리킨다. 쏘기 전엔 글자를 숨긴다
      const Sh = M.shot;
      if (dockText.current) dockText.current.style.visibility = !Dk && Sh && t < Sh.T ? 'hidden' : '';
      if (!Dk && Sh) {
        if (t < Sh.T) return;
        const e = easeOut(clamp((t - Sh.T) / ROT.shot)), [dx, dy] = quiet ? [0, 0] : drift(Sh.b, t, W, H), Su = lerp(ROT.from * u, u, e);
        const X = lerp(W / 2, Sh.to[0] + dx, e), Y = lerp(H * (1 + SKY.devDrop), Sh.to[1] + dy, e);
        ctx.setTransform(Su * dpr, 0, 0, Su * dpr, X * dpr, Y * dpr);
        ctx.fillStyle = Sh.b.bg;
        const gs = paintBody(ctx, Sh.b.items, Sh.b.kd, Sh.b.gaps, 1, tailOf(Sh.b.items, Sh.b.kd, devFrom([X, Y], W, H, Su)), 1, t, Sh.b.ph, quiet);
        if (dockText.current) dockText.current.style.fontSize = `${Su.toFixed(2)}px`;
        placeGlyphs(glyphEls(dockText.current), gs, Su, X, Y);
        if (e >= 1) { M.sky.push({ ...skyAt(Sh.b, Sh.to, W, H, u), born: Date.now() }); M.shot = null; setLanded((v) => v + 1); rerender(); }
        return;
      }
      if (!Dk || !T) return;
      const age = quiet ? Infinity : t - Dk.T;
      ctx.fillStyle = Dk.bg;
      let gs: Glyph[], Su = Dk.S, X = W / 2, Y = H / 2;
      if (!quiet && t < T.merge) {
        ctx.setTransform(Su * dpr, 0, 0, Su * dpr, X * dpr, Y * dpr);
        gs = paintEntrance(ctx, Dk.rest, Dk.plan, Dk.dev, age, ENTRANCE[Dk.kd.mod].land, WHOOSH);
      } else {
        const m = quiet ? 1 : easeOut(clamp((t - T.merge) / GATHER)), g = quiet ? 1 : easeOut(clamp((t - T.sprout) / GROW)), r = easeIO(clamp((t - T.rise) / RISE));
        const [dx, dy] = quiet ? [0, 0] : drift(Dk, t, W, H);
        X = lerp(W / 2, Dk.to[0] + dx, r); Y = lerp(H / 2, Dk.to[1] + dy, r); Su = lerp(Dk.S, u, r);
        // 오르는 동안 꼬리는 그 순간의 자리에서 기기를 가리킨다
        const tail = r > 0 ? tailOf(Dk.items, Dk.kd, devFrom([X, Y], W, H, Su)) : Dk.tail;
        ctx.setTransform(Su * dpr, 0, 0, Su * dpr, X * dpr, Y * dpr);
        gs = paintBody(ctx, r > 0 ? Dk.items : Dk.spread, Dk.kd, Dk.gaps, r > 0 ? 1 : m, tail, g, t, Dk.ph, quiet);
      }
      if (dockText.current) dockText.current.style.fontSize = `${Su.toFixed(2)}px`;
      placeGlyphs(glyphEls(dockText.current), gs, Su, X, Y);
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
