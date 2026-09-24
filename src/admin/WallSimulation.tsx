// Wall projection — MEGAFONT's output side.
//
// 벽은 숨 쉬는 상자들의 풍경이다. 사흘치 글이 저마다 작은 파동 상자가 되어
// 떠다니다 서로·벽면에 닿으면 튕긴다(잔상). 송출 사건이 오면(control/dock의 startId) 지목된
// 글이 검정 위에 큰 상자로 서서 세게 숨 쉬고, 30초에 걸쳐 잦아들다가, 제
// 크기로 내려앉아 다른 잔상들 사이에 섞인다. 끝은 사건이 아니라 가라앉음이다.
//
// 말풍선의 생김새는 성격이 정한다(lib/bubbles). 크기는 글이 정한다 —
// 상자가 먼저 있고 글자가 줄어드는 것이 아니라 그 반대다(lib/fit).

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import CloudBubble from '../components/CloudBubble';
import { cloudFor, cloudShape, type Cloud } from '../lib/cloud';
import { bubbleAt, fillFromLegacySize, foldLines, type Boxed } from '../lib/fit';
import { fontMap } from '../lib/palettes';
import { palettes as legacyPalettes } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { EMPHASIS_MS, STAY_MS } from '../lib/wall';
import VoiceBubble from '../components/VoiceBubble';
import { SAMPLE_MESSAGES } from '../lib/samples';
import {
  isFirebaseConfigured,
  submitMessage,
  subscribeMessages,
  subscribeDock,
  waitIsFree,
  getMessage
} from '../lib/firebase';
import type { StoredMessage } from '../lib/firebase';

// ─── Tunables ─────────────────────────────────────────────────────────
const RECENT_N = 15;                            // fewer reads per poll (quota)
// 체류 기간은 lib/wall.ts 한 곳에서 정한다 (아카이브가 따로 없으니 이게 수명 전부)
const LOAD_TIMEOUT_MS = 20000;

/**
 * 도킹 신호를 보는 간격. 쉴 때와 누가 서 있을 때가 다르다.
 *
 * 이 화면은 24시간 돌고 Firestore 무료 할당은 하루 5만 번 읽기다. 2.5초면
 * 3만 5천 번이라 여유가 있지만, 그 간격으로는 꽂은 뒤 벽이 반응할 때까지
 * 사람이 기다리는 게 보인다. 그래서 **07에 누가 서 있는 동안만** 0.5초로
 * 당긴다 — 대기가 길지 않아 늘어나는 읽기는 얼마 안 된다.
 */
const DOCK_POLL_IDLE_MS = 2500;
const DOCK_POLL_WAIT_MS = 500;

/**
 * 마지막으로 처리한 송출 사건의 번호.
 *
 * 화면이 다시 뜰 때(파이 재부팅·새로고침) 이게 없으면 아직 남아 있는 사건을
 * 처음 보는 것으로 읽어 같은 글이 한 번 더 등장한다. 브라우저에 적어 둔다.
 */
const SEEN_KEY = 'megafont.wall.seenStart';
function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? '';
  } catch {
    return '';
  }
}
function writeSeen(id: string): void {
  try {
    localStorage.setItem(SEEN_KEY, id);
  } catch {
    /* 저장이 막힌 브라우저 — 이번 세션 동안은 ref가 대신 기억한다 */
  }
}

// ─── 떠다니는 풍경 ────────────────────────────────────────────────────
// 가로 세 줄을 흘러가던 것을 걷어냈다. 줄을 타면 말들이 행렬처럼 보이고,
// 벽이 '지나가는 전광판'이 된다. 지금은 저마다 제 방향으로 떠다니다
// 서로 닿거나 벽면에 닿으면 튕긴다 — 말들이 한 방에 같이 있는 것에 가깝다.

/** 한 화면에 떠 있을 수 있는 잔상의 수. 이보다 쌓이면 갈아 끼운다 */
const FLOAT_N = 10;
/** 떠다니는 속도 — 초당 화면 높이의 몇 배인가. 읽을 수 있을 만큼 느리게 */
const SPEED_MIN = 0.012;
const SPEED_MAX = 0.032;
/** 열 개가 차 있을 때 한 칸을 갈아 끼우는 간격 */
const ROTATE_MS = 20_000;
/**
 * 막 내려앉은 글을 붙잡아 두는 시간 — 벽의 한 바퀴(15개 × 20초 = 5분).
 *
 * 붙잡는 것이 착지(1.2초)까지뿐이었다(2026-09-25에 재서 알았다). 그 뒤로는
 * 다른 글과 똑같이 갈아 끼우는 차례를 타서, 열다섯 중 열 칸 창 밖이면 —
 * 셋에 하나꼴로 — 내려앉은 **그 순간** 벽에서 사라졌다. 목록 폴링(60초)이
 * 아직 그 글을 못 받았으면 차례와 상관없이 사라졌다. 폰을 뺀 사람이
 * 벽을 돌아보면 제 글이 내려앉자마자 없어지는 장면을 봤다.
 *
 * 한 바퀴를 붙잡아 두면 그동안 떠 있던 다른 글들이 한 번씩 다 갈려
 * 나가는 것을 제 글이 같이 본다. 그 뒤로는 다른 글과 같다.
 */
const LINGER_MS = RECENT_N * ROTATE_MS;

// ─── 파동 상자의 치수 ─────────────────────────────────────────────────
// 발화하는 동안 서는 큰 상자와, 그 뒤 풍경에 남는 잔상. 둘의 글자 크기가
// 한 변에 정비례해야 내려앉을 때 배율 하나로 정확히 포개진다.
/**
 * 발화 중인 상자의 한 변.
 *
 * 72였다. 그 값은 16:10 벽에서 고른 것인데 실물이 16:9로 확인되면서
 * (wall.ts) 같은 vh가 폭의 45%에서 40.5%로 줄었다 — 벽 전체가 납작해진
 * 만큼 글이 작아진 셈이다. 재서 다시 골랐다(2.5 × 1.41m 기준):
 *
 *   72vh  60자가 벽 높이의 67% · 글자 6.5cm · 편히 읽히는 거리 4.7m
 *   85vh                  79% · 7.6cm · 5.5m
 *   95vh                  88% · 8.5cm · 6.1m   ← 여기
 *  100vh                  93% · 9.0cm · 6.5m
 *
 * 100vh는 60자에서 위아래 4.9cm만 남아 구름이 벽 가장자리에 붙는다.
 * 95vh면 8.4cm가 남는다. 짧은 글은 어차피 제 크기만 쓰므로(6자는 높이의
 * 39%) 이 값은 **가장 긴 글이 넘지 않는 선**으로 잡는다.
 */
export const BIG_SIDE_VH = 95;
/** 폰으로 /wall을 열었을 때처럼 세로가 긴 화면의 상한 */
export const BIG_SIDE_MAX_VW = 88;
/**
 * 잔상의 한 변. 22였다 — 강조와 같은 이유로 올린다.
 * 열 개가 다 떠 있어도 화면의 15%뿐이라(재서 확인: 22vh에서 7%) 자리는
 * 넉넉하다. 31vh에서 글자가 1.9~2.2cm가 되어 1.5m 앞에서 읽힌다.
 */
const ECHO_SIDE_VH = 31;
/** 잔상도 숨 쉰다. 파이의 크로미움이 열 개의 번짐을 못 따라오면 여기서 끈다 — 강조만 숨 쉰다 */
const ECHO_MOTION = true;
/** 큰 목소리가 잔상으로 내려앉는 시간 */
const LAND_MS = 1200;

/** CSS가 같은 치수를 보게 내려준다. 벽의 루트에 한 번 */
const WALL_VARS = {
  '--big-side': `min(${BIG_SIDE_VH}vh, ${BIG_SIDE_MAX_VW}vw)`,
  '--echo-side': `${ECHO_SIDE_VH}vh`,
  '--land-ms': `${LAND_MS}ms`
} as CSSProperties;

// ─── Helpers ──────────────────────────────────────────────────────────


/** 큰 상자가 내려앉을 자리. 화면 가운데에서의 거리(px)와 배율 */
type Land = { dx: number; dy: number; scale: number };
/** 도착점을 못 재면 제자리에서 잔상 크기로 가라앉는다 */
const SINK: Land = { dx: 0, dy: 0, scale: ECHO_SIDE_VH / BIG_SIDE_VH };

/** 떠다니는 몸 하나. 자리와 속도는 여기 있고 React는 모른다 — 프레임마다
    상태를 갱신하면 열 개 × 60프레임 = 초당 600번 다시 그리게 된다. */
type Body = { x: number; y: number; vx: number; vy: number; r: number; held: boolean };

/**
 * 이 글이 쓰는 틀 — 최대 영역 한 변에 대한 **비율**로.
 *
 * 잔상과 강조가 같은 값을 쓴다. 둘의 차이는 곱하는 한 변뿐이라
 * (--echo-side · --big-side) 내려앉을 때 배율 하나로 포개진다.
 */
function cloudOf(msg: StoredMessage): { lines: string[]; cloud: Cloud; box: Boxed } {
  const lines = foldLines(msg.text);
  // 씨앗은 글 자체 — 04 미리보기와 같은 구름이 뜬다(cloud.ts)
  const cloud = cloudFor(lines, msg.tone?.font, { scaleX: msg.tone?.tone, slant: msg.tone?.slnt });
  return { lines, cloud, box: bubbleAt(lines, cloudShape(cloud), fillFromLegacySize(msg.tone?.size)) };
}

function boxSide(): number {
  return (window.innerHeight * ECHO_SIDE_VH) / 100;
}

/** 새 몸을 아무 자리에 놓는다. 이미 있는 것들과 겹치지 않는 자리를 찾아본다 */
function spawn(r: number, w: number, h: number, taken: Body[]): Body {
  const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
  const angle = Math.random() * Math.PI * 2;
  let x = 0, y = 0;
  for (let t = 0; t < 30; t++) {
    x = r + Math.random() * Math.max(1, w - r * 2);
    y = r + Math.random() * Math.max(1, h - r * 2);
    if (taken.every((b) => Math.hypot(b.x - x, b.y - y) >= b.r + r)) break;
  }
  return { x, y, vx: Math.cos(angle) * speed * h, vy: Math.sin(angle) * speed * h, r, held: false };
}

/**
 * 한 프레임. 벽면에 닿으면 되튀고, 서로 닿으면 맞바꾼다.
 *
 * 둥근 사각형을 원으로 친다(반지름 = 한 변의 절반). 축에 나란히 닿을 때가
 * 정확히 변끼리 맞닿는 순간이고, 비스듬히 만날 때만 조금 일찍 튕긴다 —
 * 모서리가 17% 깎여 있어서 눈에는 그게 더 맞다.
 *
 * 질량이 같으므로 탄성 충돌은 **법선 방향 속도를 맞바꾸는 것**으로 끝난다.
 * 접선 방향은 건드리지 않는다(스치듯 지나가는 것이 스치듯 보여야 한다).
 * 멀어지는 중인 쌍은 건너뛴다 — 안 그러면 겹친 채 붙어 떨리게 된다.
 */
function step(bodies: Body[], w: number, h: number, dt: number) {
  for (const b of bodies) {
    if (b.held) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
    else if (b.x > w - b.r) { b.x = w - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
    else if (b.y > h - b.r) { b.y = h - b.r; b.vy = -Math.abs(b.vy); }
  }
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i], b = bodies[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1e-6;
      const min = a.r + b.r;
      if (d >= min) continue;
      const nx = dx / d, ny = dy / d;
      // 겹친 만큼 서로 밀어낸다. 안 그러면 다음 프레임에도 겹쳐 있어 떤다.
      const push = (min - d) / 2;
      if (!a.held) { a.x -= nx * push; a.y -= ny * push; }
      if (!b.held) { b.x += nx * push; b.y += ny * push; }
      const va = a.vx * nx + a.vy * ny;
      const vb = b.vx * nx + b.vy * ny;
      if (va - vb <= 0) continue;          // 이미 멀어지는 중
      const diff = va - vb;
      if (!a.held) { a.vx -= diff * nx; a.vy -= diff * ny; }
      if (!b.held) { b.vx += diff * nx; b.vy += diff * ny; }
    }
  }
}

// ─── Component ────────────────────────────────────────────────────────

export default function WallSimulation() {
  const [messages, setMessages] = useState<StoredMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Triggered emphasis (on top of the landscape)
  const [emphMsg, setEmphMsg] = useState<StoredMessage | null>(null);
  const [emphLand, setEmphLand] = useState<Land | null>(null);
  const [emphKey, setEmphKey] = useState(0);
  /** 그 발화가 시작된 순간(파이가 잰 값). 잦아듦과 상한이 여기서 센다 */
  const [emphStart, setEmphStart] = useState(0);
  /** 막 내려앉은 글. LINGER_MS 동안 풍경에 붙잡아 둔다 */
  const [linger, setLinger] = useState<StoredMessage | null>(null);
  const lingerTimerRef = useRef(0);
  useEffect(() => () => clearTimeout(lingerTimerRef.current), []);

  // 떠다니는 몸들과 그것을 그리는 요소. 둘 다 React 바깥에 둔다 —
  // 프레임마다 상태를 갱신하면 열 개 × 60프레임을 다시 그리게 된다.
  const bodiesRef = useRef(new Map<string, Body>());
  const elsRef = useRef(new Map<string, HTMLElement>());
  const setBlockEl = useCallback((id: string, el: HTMLElement | null) => {
    if (el) elsRef.current.set(id, el);
    else elsRef.current.delete(id);
  }, []);

  // 잔상의 크기는 글마다 다르다 — 정사각이던 시절엔 한 변 하나로 끝났지만,
  // 이제 납작한 것과 정방형인 것이 섞여 있다. 물리 계산이 그 값을 알아야
  // 벽면과 서로에게 제대로 튕긴다. 프레임 루프는 React 바깥이라 ref로 건넨다.
  const sizesRef = useRef(new Map<string, { w: number; h: number }>());

  // 열 개가 차 있을 때 한 칸씩 갈아 끼우는 시계
  const [rotate, setRotate] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setRotate((r) => r + 1), ROTATE_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    document.body.classList.add('wall-mode');
    document.body.classList.remove('themed');
    document.body.style.removeProperty('--bg-outer');
    return () => {
      document.body.classList.remove('wall-mode');
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Cache messages (the landscape source)
  const initialLoadedRef = useRef(false);
  useEffect(() => {
    let timeoutId: number | null = null;
    timeoutId = window.setTimeout(() => {
      if (!initialLoadedRef.current) {
        setError(
          `Firestore가 ${LOAD_TIMEOUT_MS / 1000}초 안에 응답하지 않았어요. Firestore Database가 생성됐는지, 보안 규칙이 읽기를 허용하는지 확인해주세요.`
        );
        setMessages([]);
      }
    }, LOAD_TIMEOUT_MS);

    const unsub = subscribeMessages(
      RECENT_N,
      (msgs) => {
        initialLoadedRef.current = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        setError(null);
        setMessages(msgs);
      },
      (err) => {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        // Only surface an error on the very first load. Once the landscape is
        // up, ignore transient failures (e.g. a 429 burst) so it doesn't blank.
        if (!initialLoadedRef.current) {
          initialLoadedRef.current = true;
          setError(err.message);
          setMessages([]);
        }
      }
    );

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      unsub();
    };
  }, []);

  const visible = useMemo(() => {
    if (!messages) return [];
    const list = messages
      .filter((m) => now - m.createdAt < STAY_MS)
      .sort((a, b) => b.createdAt - a.createdAt);
    // 발화 중인 글이 목록에 아직 없으면(폴링 전) 끼워 넣는다 — 잔상 자리가
    // 있어야 내려앉을 곳이 있다. 폴링이 따라오면 같은 id라 그대로 합쳐진다.
    // 막 내려앉은 글도 같다 — 폴링이 아직 못 받았으면 착지하자마자 사라진다.
    for (const m of [linger, emphMsg]) if (m && !list.some((x) => x.id === m.id)) list.unshift(m);
    return list.slice(0, RECENT_N);
  }, [messages, now, emphMsg, linger]);

  // '최신 글'을 따로 들고 있지 않는다. 지목된 글을 못 가져왔을 때 그걸로
  // 대신 띄우던 길이 있었고, 그 길이 남의 글을 남의 발화로 만들었다.
  const listRef = useRef<StoredMessage[]>([]);
  useEffect(() => {
    listRef.current = visible;
  }, [visible]);

  // 송출 사건 → 지목된 글을 크게. **번호가 전과 다를 때만.**
  // 전에는 깃발 하나가 올라간 것을 보고 띄웠다 — 그래서 벽이 다시 뜨면
  // 아직 올라가 있던 깃발이 새 사건으로 읽혔다.
  const seenIdRef = useRef<string>(readSeen());
  const landingRef = useRef(false);
  const emphIdRef = useRef<string | null>(null);
  /** 발화 중인 글 그 자체. 내려앉은 뒤 붙잡아 둘 때 쓴다 */
  const emphMsgRef = useRef<StoredMessage | null>(null);
  const closeTimerRef = useRef(0);
  const hideTimerRef = useRef(0);
  useEffect(() => {
    // 큰 목소리가 끝나는 방식은 하나다 — 잔상 자리로 내려앉는다.
    // 타이머가 끝내든 사람이 폰을 빼든 같은 길로 간다.
    const land = () => {
      landingRef.current = true;
      clearTimeout(closeTimerRef.current);
      clearTimeout(hideTimerRef.current);
      const id = emphIdRef.current;
      // 그 글의 잔상이 지금 떠 있는 자리를 겨눈다. 도착할 때까지 붙잡아
      // 둔다(held) — 움직이는 과녁을 맞히려면 앞을 예측해야 하는데, 튕기는
      // 몸은 예측이 안 된다. 어차피 숨어 있으니 멈춘 것은 보이지 않는다.
      const body = id ? bodiesRef.current.get(id) : null;
      if (body) {
        body.held = true;
        const bigSide = Math.min(window.innerHeight * BIG_SIDE_VH, window.innerWidth * BIG_SIDE_MAX_VW) / 100;
        setEmphLand({
          dx: body.x - window.innerWidth / 2,
          dy: body.y - window.innerHeight / 2,
          // 같은 글이라 잔상과 큰 상자의 생김새가 같다 — 배율은 한 변의 비다
          scale: boxSide() / bigSide
        });
      } else {
        setEmphLand(SINK);
      }
      hideTimerRef.current = window.setTimeout(() => {
        if (body) body.held = false;      // 도착했으니 다시 떠다닌다
        // 도착한 글을 한 바퀴 붙잡아 둔다(LINGER_MS). 다음 발화가 오면 그 글이 이어받는다
        const m = emphMsgRef.current;
        if (m) {
          setLinger(m);
          clearTimeout(lingerTimerRef.current);
          lingerTimerRef.current = window.setTimeout(() => setLinger(null), LINGER_MS);
        }
        emphMsgRef.current = null;
        setEmphMsg(null);
        setEmphLand(null);
        emphIdRef.current = null;
      }, LAND_MS);
    };

    const show = (msg: StoredMessage, startedAt: number) => {
      clearTimeout(closeTimerRef.current);
      clearTimeout(hideTimerRef.current);
      emphIdRef.current = msg.id;
      emphMsgRef.current = msg;
      landingRef.current = false;
      setEmphStart(startedAt);
      setEmphLand(null);
      setEmphMsg(msg);
      setEmphKey((k) => k + 1);
      // EMPHASIS_MS는 상한이고, 세는 곳은 **꽂힌 순간**이다. 벽이 신호를 몇
      // 초 늦게 알아채도 폰과 같은 시각에 끝난다. 대개는 아래 '폰이 빠졌다'가
      // 그보다 먼저 내려앉힌다.
      const left = Math.max(0, EMPHASIS_MS - (Date.now() - startedAt));
      closeTimerRef.current = window.setTimeout(land, left);
    };

    const unsub = subscribeDock(
      (s) => {
        // ── 끝났나 ─────────────────────────────────────────────
        // 폰이 빠지는 순간 큰 목소리가 끝나고 메아리로 남는다. 끝내는 건
        // 타이머가 아니라 사람이다 — 위의 상한은 아무도 빼지 않았을 때를
        // 위한 것이다.
        //
        // 끝났다는 것을 **두 곳에서** 읽는다. 폰이 적은 끝난 시각이 하나이고,
        // 홈에서 꽂힘이 풀린 것이 다른 하나다. 뒤엣것이 있어서 폰이 꺼지거나
        // 그 사이 인터넷이 끊겨도 벽은 30초를 멍하니 기다리지 않는다.
        const ended = s.endedAt > 0 || (!s.plugged && s.switchAt > s.startedAt);
        if (ended && s.startId === seenIdRef.current && !landingRef.current) {
          land();
        }

        // ── 새 사건인가 ────────────────────────────────────────
        if (!s.startId || s.startId === seenIdRef.current) return;
        // 번호를 먼저 적는다. 글을 가져오는 동안 다음 바퀴가 같은 사건을 또
        // 집으면 한 발화가 두 번 등장한다.
        seenIdRef.current = s.startId;
        writeSeen(s.startId);

        if (s.endedAt > 0) return;                            // 이미 끝난 사건
        if (Date.now() - s.startedAt >= EMPHASIS_MS) return;  // 지나간 사건
        // **어느 글인지 모르면 아무 일도 일어나지 않는다.** 여기서 '최신'으로
        // 대충 넘기면 방금 쓴 사람이 앞사람 글을 제 발화로 보게 된다.
        if (!s.startMessage) return;

        // 목록은 60초마다 갱신되므로 그 안에 없을 수 있다 — 그러면 직접 가져온다.
        const known = listRef.current.find((m) => m.id === s.startMessage);
        if (known) {
          show(known, s.startedAt);
          return;
        }
        void getMessage(s.startMessage).then((fetched) => {
          if (fetched) show(fetched, s.startedAt);
        });
      },
      () => {
        /* 잠깐 못 읽는 것으로 풍경을 건드리지 않는다 */
      },
      // 자주 봐야 하는 자리는 둘이다. 07에 누가 서 있는 동안은 **등장**이
      // 늦지 않기 위해서고, 큰 목소리가 나가는 동안은 **폰을 뺐을 때 거기서
      // 곧바로 접히기** 위해서다. 둘 다 몇십 초라 읽기는 얼마 안 늘어난다.
      (s) => {
        if (emphIdRef.current && !landingRef.current) return DOCK_POLL_WAIT_MS;
        return s && !waitIsFree(s) ? DOCK_POLL_WAIT_MS : DOCK_POLL_IDLE_MS;
      }
    );
    return () => {
      clearTimeout(closeTimerRef.current);
      clearTimeout(hideTimerRef.current);
      unsub();
    };
  }, []);

  // 화면에 띄울 열 개. 더 쌓이면 갈아 끼우되, **발화 중인 글은 반드시 남긴다** —
  // 그 잔상이 큰 상자가 내려앉을 자리이므로 없으면 갈 곳이 사라진다.
  const shown = useMemo(() => {
    if (visible.length <= FLOAT_N) return visible;
    const out: StoredMessage[] = [];
    // 발화 중인 글, 그리고 막 내려앉은 글(LINGER_MS)
    for (const keep of [emphMsg, linger]) {
      const pinned = keep ? visible.find((m) => m.id === keep.id) : null;
      if (pinned && !out.some((x) => x.id === pinned.id)) out.push(pinned);
    }
    for (let i = 0; out.length < FLOAT_N && i < visible.length; i++) {
      const m = visible[(i + rotate) % visible.length];
      if (!out.some((x) => x.id === m.id)) out.push(m);
    }
    return out;
  }, [visible, rotate, emphMsg, linger]);

  // 프레임마다 한 걸음 걷고 자리를 요소에 적는다. transform만 건드리므로
  // 레이아웃을 다시 계산하지 않는다 — 파이에서 이게 프레임을 지킨다.
  const shownKey = shown.map((m) => m.id).join(',');
  // 물리 계산이 볼 수 있게 크기를 옮겨 둔다. 글·모양·크기가 그대로면 값도 같다.
  useEffect(() => {
    const m = new Map<string, { w: number; h: number }>();
    for (const msg of shown) {
      const { box } = cloudOf(msg);
      m.set(msg.id, { w: box.w, h: box.h + box.tail });
    }
    sizesRef.current = m;
  }, [shown]);
  useEffect(() => {
    const ids = shownKey ? shownKey.split(',') : [];
    let raf = 0;
    let prev = performance.now();
    const loop = (t: number) => {
      // 탭이 뒤에 있다 돌아오면 dt가 몇 초가 된다. 그 한 프레임에 벽을
      // 가로질러 버리므로 상한을 둔다.
      const dt = Math.min(0.05, (t - prev) / 1000);
      prev = t;
      const w = window.innerWidth;
      const h = window.innerHeight;
      const side = boxSide();
      // 원으로 치되 반지름은 **긴 쪽 절반**이다. 납작한 말풍선이 옆으로
      // 스칠 때 조금 일찍 튕기지만, 짧은 쪽으로 잡으면 겹쳐 지나간다.
      const rOf = (id: string) => {
        const f = sizesRef.current.get(id);
        return (side * (f ? Math.max(f.w, f.h) : 1)) / 2;
      };
      const map = bodiesRef.current;
      for (const id of [...map.keys()]) if (!ids.includes(id)) map.delete(id);
      for (const id of ids) {
        const b = map.get(id);
        if (!b) map.set(id, spawn(rOf(id), w, h, [...map.values()]));
        else b.r = rOf(id);                // 창 크기가 바뀌면 같이 바뀐다
      }
      step([...map.values()], w, h, dt);
      for (const [id, b] of map) {
        const el = elsRef.current.get(id);
        if (!el) continue;
        // 몸은 가운데를 들고 있고 요소는 왼쪽 위로 놓인다
        const f = sizesRef.current.get(id) ?? { w: 1, h: 1 };
        el.style.transform = `translate3d(${(b.x - (side * f.w) / 2).toFixed(1)}px, ${(b.y - (side * f.h) / 2).toFixed(1)}px, 0)`;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [shownKey]);

  const retry = useCallback(() => {
    setError(null);
    setMessages(null);
    initialLoadedRef.current = false;
    window.location.reload();
  }, []);

  async function seedSamples() {
    if (seeding) return;
    setSeeding(true);
    try {
      // 04 미리보기의 풍경과 같은 목록 (lib/samples)
      for (const s of SAMPLE_MESSAGES) {
        await submitMessage({ text: s.text, tone: s.tone, startedAt: Date.now() });
      }
    } catch (err) {
      setError('샘플 추가 실패: ' + (err as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  const isLoading = messages === null && !error;
  const isEmpty = messages !== null && visible.length === 0;

  return (
    <div
      className="wall"
      style={WALL_VARS}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a')) return;
        setShowOverlay((v) => !v);
      }}
    >
      {/* Empty/error/loading panel */}
      {(isLoading || isEmpty || error) && (
        <div className="wall-empty">
          {isLoading && (
            <>
              <div className="wall-empty-glyph">···</div>
              <div className="wall-empty-text">벽을 불러오고 있어요</div>
            </>
          )}
          {error && (
            <>
              <div className="wall-empty-glyph" style={{ color: '#f55' }}>!</div>
              <div className="wall-empty-text" style={{ color: '#f55', maxWidth: 420, textAlign: 'center', lineHeight: 1.6 }}>
                {error}
              </div>
              <div className="wall-error-actions">
                <button className="wall-cta" onClick={retry}>다시 시도</button>
                <a className="wall-cta" href="/wall?mock=1">데모 모드로 보기 →</a>
              </div>
            </>
          )}
          {isEmpty && !error && (
            <>
              <div className="wall-empty-glyph">···</div>
              <div className="wall-empty-text">아직 벽이 비어 있어요</div>
              <div className="wall-empty-mode">
                {isFirebaseConfigured() ? '저장소: Firestore (라이브)' : '저장소: 로컬 mock (?mock=1)'}
              </div>
              <button className="wall-cta" onClick={seedSamples} disabled={seeding}>
                {seeding ? '추가 중…' : isFirebaseConfigured() ? 'Firestore에 샘플 5개 추가' : 'mock에 샘플 5개 추가'}
              </button>
              <a href="/?stage=enter" className="wall-link-secondary">또는 직접 메시지 쓰기 →</a>
            </>
          )}
        </div>
      )}

      {/* 풍경 — 잔상들이 세 줄을 흘러간다. 발화 중인 글의 잔상은 자리만
          지키고 숨어 있다가(is-ghost) 큰 상자가 내려앉는 순간 드러난다 */}
      {shown.map((msg, i) => (
        <WallBlock key={msg.id} msg={msg} index={i} ghost={emphMsg?.id === msg.id} onEl={setBlockEl} />
      ))}

      {/* 발화 — 검정 위에 큰 상자 하나 */}
      {emphMsg && <WallShowMessage key={emphKey} msg={emphMsg} land={emphLand} startedAt={emphStart} />}

      {showOverlay && (
        <div className="wall-overlay">
          <div className="wall-overlay-line">MEGAFONT · WALL</div>
          <div className="wall-overlay-line">
            풍경 {shown.length}/{visible.length}개 {emphMsg ? (emphLand ? '· 내려앉는 중' : '· 발화 중') : '· 트리거 대기'}
          </div>
          <div className="wall-overlay-line">
            {isFirebaseConfigured() ? 'Firestore 연결됨' : '로컬 mock 데이터'}
          </div>
          <div className="wall-overlay-hint">화면 탭 → 정보 토글</div>
        </div>
      )}
    </div>
  );
}

// ─── 잔상 (풍경의 한 칸, 흘러가는 작은 상자) ─────────────────────────

const WallBlock = memo(function WallBlock({ msg, ghost, onEl }: { msg: StoredMessage; index: number; ghost: boolean; onEl: (id: string, el: HTMLElement | null) => void }) {
  const { bg, text, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);
  const { lines, cloud, box } = useMemo(() => cloudOf(msg), [msg]);

  // 자리는 CSS가 아니라 프레임 루프가 transform으로 적는다(위 useEffect).
  // 여기서 style에 자리를 주면 매 프레임 React를 거치게 된다.
  return (
    <div
      className={`wall-block${ghost ? ' is-ghost' : ''}`}
      data-id={msg.id}
      ref={(el) => onEl(msg.id, el)}
    >
      {/* 숨은 구름마다 시작점이 다르다(cloud.ts의 phase0) — 열 개가 같은 박자로 안 뛴다.
          파이가 열 개의 번짐을 못 따라오면 ECHO_MOTION을 끈다. */}
      <CloudBubble cloud={cloud} box={box} side="var(--echo-side)" color={bg} still={!ECHO_MOTION}>
        <VoiceBubble text={lines.join('\n')} bg={bg} color={text} fontFamily={fontFamily} font={msg.tone?.font} weight={wght}
          width={scaleX} slant={skew} align={msg.tone?.align} size={msg.tone?.size} manner={msg.tone?.manner}
          fontSize={`calc(var(--echo-side) * ${box.unit.toFixed(4)})`} />
      </CloudBubble>
    </div>
  );
});

// ─── 발화 (검정 위의 큰 상자. 잦아들다 내려앉는다) ────────────────────
// 폰의 5/5 미리보기(PhasePreview)가 이것을 그대로 빌려 쓴다 — 벽과 따로
// 그리면 서체·구름·줄바꿈 중 하나가 반드시 어긋난다.

/* 말풍선 때는 물결이 30초에 걸쳐 잦아들어 잔상의 세기에 닿았다(calmAt).
   구름은 강조와 잔상이 같은 숨(중)을 쉰다 — 크기만 내려앉는다. */
export const WallShowMessage = memo(function WallShowMessage({ msg, land }: { msg: StoredMessage; land: Land | null; startedAt: number }) {
  const { bg, text, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);
  const { lines, cloud, box } = useMemo(() => cloudOf(msg), [msg]);

  const landing = land !== null;
  const boxStyle = land
    ? { transform: `translate(${land.dx.toFixed(1)}px, ${land.dy.toFixed(1)}px) scale(${land.scale.toFixed(4)})` }
    : undefined;

  return (
    <div className={`wall-show${landing ? ' is-landing' : ''}`}>
      <div className="wall-show-box" style={boxStyle}>
        <CloudBubble cloud={cloud} box={box} side="var(--big-side)" color={bg}>
          <VoiceBubble text={lines.join('\n')} bg={bg} color={text} fontFamily={fontFamily} font={msg.tone?.font} weight={wght}
            width={scaleX} slant={skew} align={msg.tone?.align} size={msg.tone?.size} manner={msg.tone?.manner}
            fontSize={`calc(var(--big-side) * ${box.unit.toFixed(4)})`} />
        </CloudBubble>
      </div>
    </div>
  );
});

// ─── Shared style derivation ─────────────────────────────────────────

function useDerivedStyle(msg: StoredMessage) {
  return useMemo(() => {
    const tone = msg.tone;
    let pal;
    if (!tone) {
      pal = moods[3];
    } else {
      const mood = moods[tone.paletteIdx];
      if (mood) pal = mood;
      else {
        const legacy = legacyPalettes[tone.paletteIdx];
        pal = legacy ? { bg: legacy.bg, text: legacy.text } : moods[3];
      }
    }
    const fontFamily = tone ? fontMap[tone.font] : fontMap.botong;
    return {
      bg: tone?.backgroundColor ?? pal.bg,
      text: tone?.textColor ?? pal.text,
      fontFamily,
      wght: tone?.wght ?? 400,
      scaleX: tone?.tone ?? 1.0,
      skew: tone?.slnt ?? 0
    };
  }, [msg]);
}
