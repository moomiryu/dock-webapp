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
import { cloudForTone, cloudShape, convexHull, type Cloud } from '../lib/cloud';
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
  listMessagesSince,
  subscribeDock,
  waitIsFree,
  getMessage
} from '../lib/firebase';
import type { StoredMessage } from '../lib/firebase';

// ─── Tunables ─────────────────────────────────────────────────────────
const RECENT_N = 15;                            // fewer reads per poll (quota)
/**
 * 사흘 치 전부를 다시 받는 간격.
 *
 * 벽은 최신 15개만 받아 그것만 돌렸다 — 사흘이 안 됐어도 열여섯 번째부터는
 * 벽에 한 번도 안 나왔다. 사흘 약속은 '떠 있는 동안이 곧 기록'이라는 뜻이라
 * 이제 사흘 치를 전부 돌린다(2026-09-26).
 *
 * 다만 전부를 1분마다 받으면 읽기가 글 수 × 1440이 된다 — 서른다섯 개만
 * 쌓여도 하루 무료 할당(5만)을 혼자 넘는다. 그래서 둘로 나눈다. 새 글과
 * 지워진 테스트 글은 지금처럼 1분마다 최신 15개로 보고, 그보다 오래된
 * 쪽은 한 시간에 한 번 받는다. 오래된 글은 새로 생기지 않고 지워지지도
 * 않으니(규칙상 테스트 글만 지워진다) 한 시간 늦어도 달라질 것이 없다.
 * 늘어나는 읽기는 글 수 × 24다.
 */
const POOL_REFRESH_MS = 60 * 60_000;
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

/** 한 화면에 떠 있을 수 있는 잔상의 수. 이보다 쌓이면 갈아 끼운다.
 *  10이었다 — 2026-09-26에 12로 */
const FLOAT_N = 12;
/** 떠다니는 속도 — 초당 화면 높이의 몇 배인가. 읽을 수 있을 만큼 느리게 */
const SPEED_MIN = 0.012;
const SPEED_MAX = 0.032;
/** 화면이 다 차 있을 때 한 칸을 갈아 끼우는 간격 */
const ROTATE_MS = 20_000;
/**
 * 막 내려앉은 글을 붙잡아 두는 시간 — 5분. 최신 15개만 돌던 때의 한 바퀴
 * (15개 × 20초)였다. 사흘 치를 다 돌리게 되면서 한 바퀴는 글 수에 따라
 * 몇 시간이 될 수도 있어, 그 길이를 따라가지 않고 5분에 고정했다.
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
const LINGER_MS = 15 * ROTATE_MS;

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
 *
 * 2026-09-26 31 → 37.2(1.2배). 2.5 × 1.41m 실물을 두고 디자이너가 20%는
 * 더 커도 된다고 봤다. 같은 날 칸이 열둘로 늘었다.
 */
const ECHO_SIDE_VH = 37.2;
/** 잔상도 숨 쉰다. 파이의 크로미움이 열두 개의 번짐을 못 따라오면 여기서 끈다 — 강조만 숨 쉰다 */
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

/** 몸의 종류 — 떠다니는 말 · 차분한의 돌 · 당당한의 나무 · 다정한의 구름 */
type Kind = 'float' | 'stone' | 'tree' | 'cloud';

/** 떠다니는 몸 하나. 자리와 속도는 여기 있고 React는 모른다 — 프레임마다
    상태를 갱신하면 열두 개 × 60프레임 = 초당 720번 다시 그리게 된다.
    hw · hh = 상자의 반폭 · 반높이. heavy = 차분한의 돌, a · va = 돌의 흔들림(rad).
    poly = 돌의 실제 윤곽(볼록 다각형, 가운데 기준 px). 말은 없다 — 상자로 친다.
    나무: tall = 키(벽 높이의 비율). 구름: cruise = 지나가는 빠르기(px/s), sway · flutter = 엇걸음 ·
    펄럭임의 위상, u = 글자 한 칸(px), beads · chars = 구슬 · 글자 가운데(가운데 기준 px), beadR = 구슬 반지름(px),
    side = 그 값들을 잰 한 변(창이 바뀌면 다시 잰다) */
type Body = {
  x: number; y: number; vx: number; vy: number; r: number; hw: number; hh: number;
  held: boolean; heavy: boolean; a: number; va: number; poly: Pt2[] | null;
  kind: Kind; tall: number; cruise: number; sway: number; flutter: number;
  u: number; beadR: number; beads: Pt2[]; chars: Pt2[]; side: number;
};
type Pt2 = [number, number];
/** 물리 계산이 보는 한 글의 치수 — 상자에 대한 비율(0~1)로. 한 변(side)이 창과 함께 바뀌기 때문이다 */
type Size = {
  w: number; h: number; heavy?: boolean; kind: Kind; poly?: Pt2[];
  /** 나무 — 키(벽 높이의 비율) · 기둥 끝(상자 높이의 비율) */
  tall?: number; trunkEnd?: number;
  /** 구름 — 구슬(작은 구름까지) · 글자 가운데, 글자 한 칸(한 변의 비율) · 구슬 반지름 · 상자 폭 · 작은 구름 오르내림 (u) */
  beads?: Pt2[]; chars?: Pt2[]; unit?: number; beadR?: number; cw?: number; bob?: number;
};

// ─── 나무 (당당한) — 벽 아래에 선다 (2026-09-28, design/landscape.md '나무') ─────────
/** 나무 키(바닥 → 머리 꼭대기) — 벽 높이의 비율 범위. 글이 씨앗이라 같은 글은 같은 키.
    머리 + 보이는 기둥이 이보다 크면 그게 키다(기둥을 더 잇지 않는다).
    30~60%였다 — 벽에 세워 보니 고도가 높아(디자이너) 같은 벽 · 같은 자리에 넷을 나란히 놓고 15~35%를
    골랐다(2026-09-28). 대신 키 작은 나무는 돌에 가려지기 시작한다(돌이 앞에 선다) */
const TREE_TALL: readonly [number, number] = [0.15, 0.35];
/** 나무끼리 겹쳐 서도 된다(키 큰 나무가 뒤) — 다만 한자리에 포개지지 않게 가로로 이만큼(반폭 합의 비율)은 떼어 본다 */
const TREE_SPREAD = 0.6;

// ─── 구름 (다정한) — 지나간다 (2026-09-28, design/landscape.md '구름') ─────────────
// 벽의 느린 박자는 모두 --t-hold의 배수다(아래 hold()).
/** 구름이 다니는 곳 — 벽 위 끝(여백)에서 이 비율까지. 아래 30%는 돌 · 나무 자리 */
const CLOUD_ZONE = 0.7;
const CLOUD_MARGIN = 0.02;
/** 벽을 가로지르는 시간(--t-hold 배수) · 구름마다 ±25% */
const CLOUD_CROSS = 30;
const CLOUD_JITTER = 0.25;
/** 엇걸음 — 몸 전체를 앞뒤로 기울여 위 · 아래가 번갈아 앞선다. 한 번(--t-hold 배수) · 위아래 끝이 앞서는 거리(u) */
const SWAY = 4;
const SWAY_U = 0.25;
/** 펄럭임 — 이 간격(--t-hold 배수)마다 한 번, 왼쪽(읽는 순서)에서 오른쪽으로 지나가는 데(배수),
    글자와 구슬이 오르는 높이(u) · 물결 폭(u) */
const FLUTTER_EVERY = 14;
const FLUTTER_PASS = 3;
const FLUTTER_U = 0.3;
const FLUTTER_WIDTH = 1.1;
/** 곁의 작은 구름이 오르내리는 한 번(--t-hold 배수). 폭은 cloud.ts의 bead.bob */
const BOB = 4;
/** 구슬이 남의 글자 한 자에서 떨어지는 거리(u) — 글자의 둥근 자리 0.55 + 틈 0.15. 겹쳐 지나가되(곱하기) 글자에는 안 닿는다 */
const LETTER_CLEAR = 0.7;
/** 파고든 만큼을 이 시간(초)에 걸쳐 떼어 놓는다. 0.06초(견본 값)에서는 다가오는 빠르기를 못 따라가 구슬이 둘레를 0.32u까지
    파고들었다(벽에서 20초 재서) — 두어 프레임에 뗀다. 파고듦이 조금씩 자라므로 한 번에 미는 양은 여전히 작다 */
const LETTER_PUSH_S = 0.02;
/** 처음 뜬 뒤 이만큼(ms) 지나 들어오는 구름은 왼쪽 밖에서 들어온다. 그 전(벽이 막 켜졌을 때)은 벽 곳곳에 놓는다 */
const CLOUD_ENTER_AFTER = 1500;

/** --t-hold(초). 토큰을 한 번 읽어 둔다 — 못 읽는 곳(토큰이 없는 문서)에서만 0.7초.
    단위를 보고 읽는다: 빌드가 CSS를 줄이며 700ms를 .7s로 고쳐 적는다. ms로만 읽었더니 라이브에서만
    0.0007초가 되어 구름이 한 프레임에 600px씩 건너뛰고 펄럭임 · 엇걸음이 1000배로 떨었다(2026-09-29) */
let HOLD_S = 0;
function hold(): number {
  if (!HOLD_S) {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--t-hold').trim();
    HOLD_S = (parseFloat(v) || 0) * (v.endsWith('ms') ? 0.001 : 1) || 0.7;
  }
  return HOLD_S;
}
/** 글 → 0~1. 같은 글은 같은 값(나무 키) */
function seed01(text: string): number {
  let h = 2166136261;
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
function tallOf(text: string): number {
  return TREE_TALL[0] + (TREE_TALL[1] - TREE_TALL[0]) * seed01(text + '|tall');
}
function kindOf(cloud: Cloud): Kind {
  return cloud.stone ? 'stone' : cloud.tree ? 'tree' : cloud.beads ? 'cloud' : 'float';
}
/** 나무의 키(px) — 머리 + 보이는 기둥보다 작아지지 않는다 */
function treeHeight(b: Body, h: number): number {
  return Math.max(b.tall * h, 2 * b.hh);
}
/** 구름이 설 수 있는 높이에서 아무 데나 */
function cloudY(b: Body, h: number): number {
  const top = b.hh + CLOUD_MARGIN * h, bottom = CLOUD_ZONE * h - b.hh;
  return bottom < top ? (top + bottom) / 2 : top + Math.random() * (bottom - top);
}

// ─── 돌 (차분한) — 떠다니지 않고 바닥에 내려앉는다 (2026-09-27) ──────────
// design/landscape.md '돌': 위에서 쿵 떨어져 아래에 간격을 두고 쌓인다. 가만히 있다가
// 주변의 충격에 조금 흔들리고 밀리고, 밀려서 받침을 잃으면 굴러떨어진다.
/** 무게 — 초당 화면 높이의 몇 배씩 빨라지나. 1.6이면 벽 높이를 1초 남짓에 떨어진다 */
const STONE_G = 1.6;
/** 떠다니는 말보다 몇 배 무거운가. 부딪힌 말은 튕겨 나가고 돌은 조금만 밀린다 */
const STONE_MASS = 8;
/** 바닥에 떨어질 때 되튀는 비율 — 쿵 하고 한 번 들썩일 만큼. 이보다 느리면 그냥 앉는다 */
const STONE_BOUNCE = 0.18;
const STONE_THUD = 0.08;
/** 바닥 · 받침 위에서 미끄러지다 멈추는 빠르기(초당 감쇠) */
const STONE_FRICTION = 3;
/** 돌끼리 두는 틈 — 화면 높이의 비율. 0.025(27px)였다 — 상자로 치던 때라 빈 모서리까지
    더해져 '보이지 않는 경계'가 있어 보였다. 윤곽으로 치면서 거의 맞닿게(3px 안팎) */
const STONE_GAP = 0.003;
/** 받침 돌의 반폭 중 이만큼 바깥에 무게중심이 있으면 받침을 잃고 미끄러진다 */
const STONE_TIP = 0.55;
/** 흔들림 — 되돌아오는 힘 · 잦아드는 힘 · 최대 기울기(rad, 약 5°) · 충격이 기울기로 옮는 비율 */
const WOBBLE_K = 55;
const WOBBLE_DAMP = 5;
const WOBBLE_MAX = 0.09;
const WOBBLE_GAIN = 1.5;
/** 부딪혀 밀린 속도가 흔들림으로 옮는 비율 — 떠다니는 말에 한 번 맞으면 2° 안팎 */
const WOBBLE_HIT = 30;
/** 받침을 잃은 돌이 옆으로 빨라지는 비율(무게에 대해) · 그쪽으로 기우는 빠르기(rad/s) */
const TIP_SLIDE = 0.6;
const TIP_LEAN = 1.2;

/**
 * 이 글이 쓰는 틀 — 최대 영역 한 변에 대한 **비율**로.
 *
 * 잔상과 강조가 같은 값을 쓴다. 둘의 차이는 곱하는 한 변뿐이라
 * (--echo-side · --big-side) 내려앉을 때 배율 하나로 포개진다.
 */
function cloudOf(msg: StoredMessage): { lines: string[]; cloud: Cloud; box: Boxed } {
  const lines = foldLines(msg.text);
  // 씨앗은 글 자체 — 04 미리보기와 같은 구름이 뜬다(cloud.ts)
  const cloud = cloudForTone(lines, msg.tone);
  return { lines, cloud, box: bubbleAt(lines, cloudShape(cloud), fillFromLegacySize(msg.tone?.size)) };
}

function boxSide(): number {
  return (window.innerHeight * ECHO_SIDE_VH) / 100;
}

/** 새 몸을 아무 자리에 놓는다. 이미 있는 것들과 겹치지 않는 자리를 찾아본다.
 *  돌은 위쪽 3분의 1 어딘가에서 멈춘 채 나타나 떨어진다 — 다른 돌과 가로로 안 겹치는 자리를 찾아본다.
 *  나무는 바닥에 선다 — 다른 나무와 한자리에 포개지지 않는 가로 자리를 찾아본다.
 *  구름은 벽이 막 켜졌으면 곳곳에, 그 뒤로는 왼쪽 밖에서 들어온다(late) */
function spawn(r: number, hw: number, hh: number, kind: Kind, w: number, h: number, taken: Body[], tall: number, late: boolean): Body {
  const heavy = kind === 'stone';
  const still = { held: false, heavy, a: 0, va: 0, r, hw, hh, poly: null, kind, tall, cruise: 0,
    sway: Math.random() * Math.PI * 2, flutter: Math.random(), u: 0, beadR: 0, beads: [], chars: [], side: 0 };
  if (kind === 'tree') {
    let x = 0;
    for (let t = 0; t < 30; t++) {
      x = hw + Math.random() * Math.max(1, w - hw * 2);
      if (taken.every((b) => b.kind !== 'tree' || Math.abs(b.x - x) >= (b.hw + hw) * TREE_SPREAD)) break;
    }
    return { ...still, x, y: h - Math.max(tall * h, 2 * hh) + hh, vx: 0, vy: 0 };
  }
  if (kind === 'cloud') {
    const cruise = ((w + 2 * hw) / (CLOUD_CROSS * hold())) * (1 + CLOUD_JITTER * (2 * Math.random() - 1));
    const b: Body = { ...still, cruise, x: late ? -hw - Math.random() * 0.25 * w : -hw + Math.random() * (w + hw), y: 0, vx: cruise, vy: 0 };
    b.y = cloudY(b, h);
    return b;
  }
  if (heavy) {
    let x = 0;
    for (let t = 0; t < 30; t++) {
      x = hw + Math.random() * Math.max(1, w - hw * 2);
      if (taken.every((b) => !b.heavy || Math.abs(b.x - x) >= b.hw + hw)) break;
    }
    return { ...still, x, y: hh + Math.random() * Math.max(1, h / 3 - hh), vx: 0, vy: 0 };
  }
  const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
  const angle = Math.random() * Math.PI * 2;
  let x = 0, y = 0;
  for (let t = 0; t < 30; t++) {
    x = r + Math.random() * Math.max(1, w - r * 2);
    y = r + Math.random() * Math.max(1, h - r * 2);
    if (taken.every((b) => Math.hypot(b.x - x, b.y - y) >= b.r + r)) break;
  }
  return { ...still, x, y, vx: Math.cos(angle) * speed * h, vy: Math.sin(angle) * speed * h };
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
 *
 * 돌이 낀 쌍은 원이 아니라 **돌의 실제 윤곽**으로 친다(말은 상자). 납작한 돌을 긴 쪽
 * 반지름의 원으로 치면 바닥에서 한참 떠 보이고, 상자로 쳐도 기울고 깨진 돌의 빈
 * 모서리끼리 먼저 닿아 '보이지 않는 경계'가 생겼다. 돌은 무거워서 부딪힌 말은 튕겨
 * 나가고 돌은 조금만 밀린다(STONE_MASS).
 */
function step(bodies: Body[], w: number, h: number, dt: number) {
  const ground = new Set<Body>();
  for (const b of bodies) {
    if (b.held) continue;
    // 나무는 가만히 선다 — 바닥에서 제 키만큼. 창이 바뀌면 같이 바뀐다
    if (b.kind === 'tree') { b.y = h - treeHeight(b, h) + b.hh; continue; }
    if (b.kind === 'cloud') { drift(b, w, h, dt); continue; }
    if (b.heavy) {
      // 흔들림은 늘 제자리(0)로 돌아온다
      b.va += (-WOBBLE_K * b.a - WOBBLE_DAMP * b.va) * dt;
      b.a = Math.max(-WOBBLE_MAX, Math.min(WOBBLE_MAX, b.a + b.va * dt));
      b.vy += STONE_G * h * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      // 바닥에 닿는 것은 상자의 바닥이 아니라 돌의 가장 낮은 점이다
      const P = b.poly, low = P ? Math.max(...P.map((p) => p[1])) : b.hh;
      const left = P ? -Math.min(...P.map((p) => p[0])) : b.hw, right = P ? Math.max(...P.map((p) => p[0])) : b.hw;
      if (b.y > h - low) {
        const hit = b.vy;
        b.y = h - low;
        // 쿵 — 빨리 떨어졌으면 한 번 들썩이고, 떨어진 쪽으로 조금 기운다
        if (hit > STONE_THUD * h) { b.vy = -hit * STONE_BOUNCE; b.va += (hit / h) * WOBBLE_GAIN * (b.x < w / 2 ? -1 : 1); }
        else b.vy = 0;
        ground.add(b);
      }
      if (b.x < left) { b.x = left; b.vx = Math.abs(b.vx) * 0.3; }
      else if (b.x > w - right) { b.x = w - right; b.vx = -Math.abs(b.vx) * 0.3; }
      continue;
    }
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
      // 구름은 무엇과도 부딪치지 않고 겹쳐 지나간다(곱하기) — 다른 구름의 글자만 비킨다
      if (a.kind === 'cloud' || b.kind === 'cloud') { if (a.kind === b.kind) cloudsApart(a, b, dt); continue; }
      // 나무는 무엇과도 부딪치지 않는다 — 돌은 그 앞에 서고, 구름 · 떠다니는 말은 겹쳐 지나간다.
      // 떠다니는 말을 머리에 튕기게 했더니 나무 머리들과 벽 끝 사이에 끼어 제자리에서 초당 600px씩
      // 튀었다(2026-09-28, 재서 알았다)
      if (a.kind === 'tree' || b.kind === 'tree') continue;
      if (a.heavy || b.heavy) { collideStones(a, b, h, dt, ground); continue; }
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
  // 바닥이나 받침 위에 앉은 돌은 미끄러지다 멈춘다
  for (const b of ground) b.vx *= Math.exp(-STONE_FRICTION * dt);
}

/**
 * 구름 한 걸음 — 제 빠르기로 오른쪽으로. 밀려서 늦거나 빨라졌으면 천천히 제 빠르기로 돌아온다.
 * 오른쪽으로 다 나가면 왼쪽 밖에서 다시 들어온다(높이는 새로). 벽 위 70% 안에서만 다닌다.
 */
function drift(b: Body, w: number, h: number, dt: number) {
  b.vx += (b.cruise - b.vx) * (1 - Math.exp(-dt / 0.8));
  b.x += b.vx * dt;
  if (b.x - b.hw > w) { b.x = -b.hw - Math.random() * 0.25 * w; b.y = cloudY(b, h); b.vx = b.cruise; }
  const top = b.hh + CLOUD_MARGIN * h, bottom = CLOUD_ZONE * h - b.hh;
  b.y = bottom < top ? (top + bottom) / 2 : Math.min(bottom, Math.max(top, b.y));
}

/**
 * 두 구름 — 튕기지 않고 겹쳐 지나간다. 한 구름의 구슬이 상대 글자 한 자의 둥근 자리(LETTER_CLEAR)에
 * 닿을 때만, 가장 깊이 닿은 곳에서 반대로 조금씩 떼어 놓는다. 글자 자리를 네모로 잡으면 휜 글은 상자가
 * 구름을 거의 덮어 겹침이 안 생겼다 — 한 자씩 잡는다. 작은 구름의 구슬도 같이 센다(작은 구름이 남의
 * 글자에 닿으면 구름째 비킨다).
 */
function cloudsApart(a: Body, b: Body, dt: number) {
  if (Math.abs(a.x - b.x) > a.hw + b.hw || Math.abs(a.y - b.y) > a.hh + b.hh) return;
  for (const [p, q] of [[a, b], [b, a]] as const) {        // p의 구슬 ↔ q의 글자
    const rc = LETTER_CLEAR * q.u + p.beadR;
    let best = 0, nx = 0, ny = 0;
    for (const c of q.chars) {
      const cx = q.x + c[0], cy = q.y + c[1];
      for (const d of p.beads) {
        const dx = p.x + d[0] - cx, dy = p.y + d[1] - cy;
        if (dx > rc || dx < -rc || dy > rc || dy < -rc) continue;
        const dd = Math.hypot(dx, dy), pen = rc - dd;
        if (pen > best) { best = pen; nx = dx / (dd || 1); ny = dy / (dd || 1); }
      }
    }
    if (best <= 0) continue;
    const k = Math.min(1, dt / LETTER_PUSH_S) * 0.5 * best;
    if (!p.held) { p.x += nx * k; p.y += ny * k; }
    if (!q.held) { q.x -= nx * k; q.y -= ny * k; }
  }
}

/** 몸의 윤곽 — 가운데 기준 px. 돌은 제 다각형, 말은 상자 */
function outline(b: Body): Pt2[] {
  return b.poly ?? [[-b.hw, -b.hh], [b.hw, -b.hh], [b.hw, b.hh], [-b.hw, b.hh]];
}

/**
 * 두 볼록 윤곽이 겹쳤나 — 두 도형의 모든 변의 법선에 비춰 본다(분리축). 한 축에서라도
 * 떨어져 있으면 안 겹친 것이다. 겹쳤으면 가장 덜 겹친 축이 밀어낼 방향(a → b)과 깊이다.
 * gap만큼 떨어져 있어도 닿은 것으로 친다.
 */
function overlap(a: Body, b: Body, gap: number): { nx: number; ny: number; pen: number } | null {
  const A = outline(a), B = outline(b);
  let best = Infinity, bx = 0, by = 0;
  for (const P of [A, B]) {
    for (let i = 0; i < P.length; i++) {
      const p = P[i], q = P[(i + 1) % P.length];
      let nx = p[1] - q[1], ny = q[0] - p[0];
      const L = Math.hypot(nx, ny);
      if (L < 1e-9) continue;
      nx /= L; ny /= L;
      let amin = Infinity, amax = -Infinity, bmin = Infinity, bmax = -Infinity;
      for (const v of A) { const d = (v[0] + a.x) * nx + (v[1] + a.y) * ny; if (d < amin) amin = d; if (d > amax) amax = d; }
      for (const v of B) { const d = (v[0] + b.x) * nx + (v[1] + b.y) * ny; if (d < bmin) bmin = d; if (d > bmax) bmax = d; }
      const o = Math.min(amax, bmax) - Math.max(amin, bmin) + gap;
      if (o <= 0) return null;
      if (o < best) { best = o; bx = nx; by = ny; }
    }
  }
  if ((b.x - a.x) * bx + (b.y - a.y) * by < 0) { bx = -bx; by = -by; }
  return { nx: bx, ny: by, pen: best };
}

/**
 * 돌이 낀 한 쌍. 윤곽이 겹친 만큼 덜 겹친 방향으로 밀어내고, 무게에 반비례해 나눠
 * 움직인다. 붙잡힌 몸(held)은 무한히 무겁다.
 *
 * - 돌과 말: 말은 그대로 튕겨 나가고(되튐 1), 돌은 받은 만큼 조금 밀리며 흔들린다.
 *   **말은 돌을 떠받치지 못한다** — 자리는 말만 비킨다. 돌 밑에 낀 말은 옆으로
 *   빠져나간다(2026-09-27, 가벼운 말 위에 돌이 올라타 떠 있던 것을 고쳤다)
 * - 돌과 돌: 거의 맞닿게(STONE_GAP) 앉는다. 거의 안 튄다(0.1). 흔들림은 쿵 부딪힐
 *   때만 — 얹혀 누르는 힘까지 충격으로 치면 받침 돌이 내내 기운 채로 있었다
 * - 위에 앉은 돌의 무게중심이 받침 돌 가장자리 바깥(STONE_TIP)이면 그쪽으로
 *   미끄러지며 기운다 — 굴러떨어진다
 */
function collideStones(a: Body, b: Body, h: number, dt: number, ground: Set<Body>) {
  if (a.heavy !== b.heavy) return stoneAndFloater(a.heavy ? a : b, a.heavy ? b : a, h, dt);
  const hit = overlap(a, b, STONE_GAP * h);
  if (!hit) return;
  const ia = a.held ? 0 : 1 / STONE_MASS, ib = b.held ? 0 : 1 / STONE_MASS;
  if (ia + ib === 0) return;
  const { nx, ny, pen } = hit;
  a.x -= (nx * pen * ia) / (ia + ib); a.y -= (ny * pen * ia) / (ia + ib);
  b.x += (nx * pen * ib) / (ia + ib); b.y += (ny * pen * ib) / (ia + ib);

  // 위아래로 닿았나 — 위의 돌이 받침을 잃었는지 본다
  const stacked = Math.abs(ny) > 0.6;
  if (stacked) {
    const top = ny > 0 ? a : b, base = top === a ? b : a;
    ground.add(top);
    const off = top.x - base.x;
    if (!top.held && Math.abs(off) > base.hw * STONE_TIP) {
      const dir = Math.sign(off);
      top.vx += dir * STONE_G * h * TIP_SLIDE * dt;
      top.va += dir * TIP_LEAN * dt;
    }
  }

  const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
  if (vn >= 0) return;                    // 이미 멀어지는 중
  const j = (-(1 + 0.1) * vn) / (ia + ib);
  a.vx -= j * ia * nx; a.vy -= j * ia * ny;
  b.vx += j * ib * nx; b.vy += j * ib * ny;
  // 쿵 부딪혔을 때만 흔들린다. 옆에서 맞으면 민 쪽으로, 위아래로 맞으면 맞은 자리가
  // 가운데에서 비낀 쪽으로 기운다
  if (-vn < STONE_THUD * h) return;
  for (const [s2, o, inv, sgn] of [[a, b, ia, -1], [b, a, ib, 1]] as const) {
    if (s2.held) continue;
    const dir = stacked ? Math.sign(o.x - s2.x) || 1 : sgn * Math.sign(nx);
    s2.va += ((j * inv) / h) * WOBBLE_HIT * dir;
  }
}

/** 말이 돌 밑에서 빠져나가는 빠르기 — 초당 화면 높이의 비율. 한 번에 옮기면 순간이동으로 보인다 */
const SLIP_OUT = 0.6;

/**
 * 돌과 떠다니는 말. 자리는 말만 비킨다 — 말은 돌을 떠받치지 못한다.
 * 말이 돌 위에 있으면 위로, 옆이면 옆으로 튕긴다. 돌 밑에 끼었으면 옆으로 빠져나간다.
 * 속도는 말이 그대로 튕기고(되튐 1), 돌은 무게에 반비례해 조금 밀리며 흔들린다.
 */
function stoneAndFloater(s: Body, f: Body, h: number, dt: number) {
  if (f.held) return;
  const hit = overlap(s, f, 0);
  if (!hit) return;
  let { nx, ny, pen } = hit;
  if (ny > 0.6) { nx = Math.sign(f.x - s.x) || 1; ny = 0; pen = SLIP_OUT * h * dt; }
  f.x += nx * pen; f.y += ny * pen;
  const vn = (f.vx - s.vx) * nx + (f.vy - s.vy) * ny;
  if (vn >= 0) return;
  const is = s.held ? 0 : 1 / STONE_MASS;
  const j = (-2 * vn) / (1 + is);
  f.vx += j * nx; f.vy += j * ny;
  if (s.held) return;
  s.vx -= j * is * nx; s.vy -= j * is * ny;
  const dir = Math.abs(nx) > Math.abs(ny) ? -Math.sign(nx) : Math.sign(f.x - s.x) || 1;
  s.va += ((j * is) / h) * WOBBLE_HIT * dir;
}

// ─── 구름의 움직임 — 요소를 직접 (React 바깥) ────────────────────────────
/** 한 구름에서 움직일 요소 — 본 구름의 구슬(놓인 cy · 자리 x, u) · 한 자씩의 글자(자리 x, u) · 작은 구름 */
type CloudDom = {
  el: HTMLElement; k: number; on: boolean;
  beads: { c: SVGCircleElement; cy: number; x: number }[];
  chars: { e: HTMLElement; x: number }[];
  lets: SVGGElement[];
};
function cloudDomOf(cache: Map<string, CloudDom>, id: string, el: HTMLElement, f: Size): CloudDom {
  const had = cache.get(id);
  if (had && had.el === el) return had;
  const svg = el.querySelector<SVGSVGElement>('svg.cloud-art');
  const k = svg && f.cw ? svg.viewBox.baseVal.width / f.cw : 100;            // 화판 단위 / u
  const d: CloudDom = {
    el, k, on: false,
    beads: [...el.querySelectorAll<SVGCircleElement>('.cloud-body circle')].map((c) => ({ c, cy: Number(c.getAttribute('cy')), x: Number(c.getAttribute('cx')) / k })),
    // 글자는 cloud.ts의 chars와 같은 차례다(띄어쓰기 빼고 줄 차례) — 자리는 거기서 읽는다
    chars: [...el.querySelectorAll<HTMLElement>('.ch')].map((e, i) => ({ e, x: (f.chars?.[i]?.[0] ?? 0) * (f.cw ?? 0) })),
    lets: [...el.querySelectorAll<SVGGElement>('.cloud-let')]
  };
  cache.set(id, d);
  return d;
}
/**
 * 펄럭임 · 작은 구름의 오르내림 한 프레임.
 * 펄럭임은 FLUTTER_EVERY마다 한 번, 봉우리 하나가 왼쪽 밖에서 오른쪽 밖으로 FLUTTER_PASS에 지나가며
 * 그 자리의 글자와 구슬을 FLUTTER_U 올렸다 내린다. 지나가는 동안만 요소를 건드린다.
 * 작은 구름은 저마다 BOB 주기로 오르내린다(서로 위상이 다르다).
 */
function cloudFrame(d: CloudDom, b: Body, f: Size, sec: number) {
  const H = hold(), every = FLUTTER_EVERY * H, pass = FLUTTER_PASS * H, cw = f.cw ?? 0;
  const tt = (((sec + b.flutter * every) % every) + every) % every, on = tt <= pass;
  if (on || d.on) {
    const c = -1.5 + (cw + 3) * (tt / pass);
    const wave = (x: number) => (on ? -FLUTTER_U * Math.exp(-(((x - c) / FLUTTER_WIDTH) ** 2)) : 0);
    for (const p of d.beads) p.c.setAttribute('cy', (p.cy + wave(p.x) * d.k).toFixed(1));
    for (const q of d.chars) q.e.style.transform = on ? `translateY(${(wave(q.x) * b.u).toFixed(2)}px)` : '';
    d.on = on;
  }
  d.lets.forEach((g, i) => g.setAttribute('transform', `translate(0 ${((f.bob ?? 0) * d.k * Math.sin((sec / (BOB * H)) * Math.PI * 2 + b.sway + i * 2.1)).toFixed(1)})`));
}
function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  // 프레임마다 상태를 갱신하면 열두 개 × 60프레임을 다시 그리게 된다.
  const bodiesRef = useRef(new Map<string, Body>());
  const elsRef = useRef(new Map<string, HTMLElement>());
  const setBlockEl = useCallback((id: string, el: HTMLElement | null) => {
    if (el) elsRef.current.set(id, el);
    else elsRef.current.delete(id);
  }, []);

  // 잔상의 크기는 글마다 다르다 — 정사각이던 시절엔 한 변 하나로 끝났지만,
  // 이제 납작한 것과 정방형인 것이 섞여 있다. 물리 계산이 그 값을 알아야
  // 벽면과 서로에게 제대로 튕긴다. 프레임 루프는 React 바깥이라 ref로 건넨다.
  const sizesRef = useRef(new Map<string, Size>());
  /** 구름의 펄럭임 · 작은 구름이 움직일 요소들(글마다). 요소가 바뀌면 다시 찾는다 */
  const cloudDomRef = useRef(new Map<string, CloudDom>());
  /** 벽이 켜진 때 — 그 직후의 구름은 벽 곳곳에, 그 뒤로는 왼쪽 밖에서 들어온다 */
  const bornRef = useRef(performance.now());

  // 화면이 다 차 있을 때 한 칸씩 갈아 끼우는 시계
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

  // 사흘 치 전부 — 최신 15개보다 오래된 쪽을 채운다(POOL_REFRESH_MS).
  // 못 받아도 벽을 비우지 않는다. 최신 15개는 위에서 따로 돌고 있다.
  const [pool, setPool] = useState<StoredMessage[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () =>
      listMessagesSince(Date.now() - STAY_MS).then(
        (msgs) => {
          if (!cancelled) setPool(msgs);
        },
        () => {}
      );
    void load();
    const id = window.setInterval(load, POOL_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const visible = useMemo(() => {
    if (!messages) return [];
    // 최신 15개가 다 찼으면 그보다 오래된 것은 사흘 치 목록에서 잇는다.
    // 겹치는 구간은 최신 쪽을 믿는다 — 1분마다 새로 보니 지워진 테스트 글이
    // 거기서 먼저 빠진다. 15개가 안 찼으면 그게 이미 전부다.
    const edge =
      messages.length < RECENT_N ? -Infinity : Math.min(...messages.map((m) => m.createdAt));
    const list = [...messages, ...pool.filter((m) => m.createdAt < edge)]
      .filter((m) => now - m.createdAt < STAY_MS)
      .sort((a, b) => b.createdAt - a.createdAt);
    // 발화 중인 글이 목록에 아직 없으면(폴링 전) 끼워 넣는다 — 잔상 자리가
    // 있어야 내려앉을 곳이 있다. 폴링이 따라오면 같은 id라 그대로 합쳐진다.
    // 막 내려앉은 글도 같다 — 폴링이 아직 못 받았으면 착지하자마자 사라진다.
    for (const m of [linger, emphMsg]) if (m && !list.some((x) => x.id === m.id)) list.unshift(m);
    return list;
  }, [messages, pool, now, emphMsg, linger]);

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

  // 화면에 띄울 열두 개. 더 쌓이면 갈아 끼우되, **발화 중인 글은 반드시 남긴다** —
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
    const m = new Map<string, Size>();
    for (const msg of shown) {
      const { box, cloud } = cloudOf(msg);
      // 돌(차분한)은 떠다니지 않고 바닥에 앉는다 — 물리 계산이 알아야 한다. 윤곽은
      // 상자에 대한 비율(0~1)로 넘긴다 — 한 변(side)이 창과 함께 바뀌기 때문이다
      const fr = ([x, y]: readonly [number, number]): Pt2 => [x / cloud.w, y / cloud.h];
      const poly = cloud.stone ? convexHull(cloud.stone.pts).map(fr) : undefined;
      const kind = kindOf(cloud), t = cloud.tree, bd = cloud.beads;
      m.set(msg.id, {
        w: box.w, h: box.h + box.tail, heavy: kind === 'stone', kind, poly,
        ...(t ? { tall: tallOf(msg.text), trunkEnd: (t.trunk.y + t.trunk.h) / cloud.h } : {}),
        ...(bd ? { beads: [...bd.body, ...bd.lets.flat()].map(fr), chars: bd.chars.map(fr), unit: box.unit, beadR: bd.r, cw: cloud.w, bob: cloud.persona.bead?.bob ?? 0 } : {})
      });
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
      for (const id of [...map.keys()]) if (!ids.includes(id)) { map.delete(id); cloudDomRef.current.delete(id); }
      const late = t - bornRef.current > CLOUD_ENTER_AFTER;
      for (const id of ids) {
        const f = sizesRef.current.get(id);
        const hw = (side * (f?.w ?? 1)) / 2, hh = (side * (f?.h ?? 1)) / 2, kind = f?.kind ?? 'float';
        const off = ([u, v]: Pt2): Pt2 => [(u - 0.5) * 2 * hw, (v - 0.5) * 2 * hh];
        const poly = f?.poly ? f.poly.map(off) : null;
        let b = map.get(id);
        if (!b) map.set(id, (b = spawn(rOf(id), hw, hh, kind, w, h, [...map.values()], f?.tall ?? 0, late)));
        else { b.r = rOf(id); b.hw = hw; b.hh = hh; b.heavy = kind === 'stone'; b.kind = kind; b.tall = f?.tall ?? 0; }   // 창 크기가 바뀌면 같이 바뀐다
        b.poly = poly;
        if (kind === 'cloud' && f?.beads && b.side !== side) {
          b.side = side; b.u = side * (f.unit ?? 0); b.beadR = b.u * (f.beadR ?? 0);
          b.beads = f.beads.map(off); b.chars = (f.chars ?? []).map(off);
        }
      }
      step([...map.values()], w, h, dt);
      const moving = !prefersReducedMotion();
      for (const [id, b] of map) {
        const el = elsRef.current.get(id);
        if (!el) continue;
        // 몸은 가운데를 들고 있고 요소는 왼쪽 위로 놓인다
        const f = sizesRef.current.get(id) ?? { w: 1, h: 1, kind: 'float' as Kind };
        // 돌은 흔들린 만큼 제 가운데를 축으로 기운다
        let tf = `translate3d(${(b.x - (side * f.w) / 2).toFixed(1)}px, ${(b.y - (side * f.h) / 2).toFixed(1)}px, 0)` + (b.a ? ` rotate(${b.a.toFixed(4)}rad)` : '');
        if (b.kind === 'tree') {
          // 기둥을 바닥까지 잇는다(CloudBubble trunkExt). 바뀐 만큼만 적는다
          const ext = Math.max(0, treeHeight(b, h) - 2 * b.hh * (f.trunkEnd ?? 1)).toFixed(0) + 'px';
          if (el.style.getPropertyValue('--trunk-ext') !== ext) el.style.setProperty('--trunk-ext', ext);
          // 처음 세운 순간 — 여기서부터 펴진다(app.css). React가 안 건드리는 data 속성이라 다시 그려도 남는다
          if (!el.dataset.placed) el.dataset.placed = '1';
        }
        if (b.kind === 'cloud' && moving && ECHO_MOTION) {
          // 엇걸음 — 가운데 높이를 축으로 몸 전체를 기울여 위아래 끝이 ±SWAY_U씩 번갈아 앞선다
          const lean = (SWAY_U * b.u * Math.sin((t / 1000 / (SWAY * hold())) * Math.PI * 2 + b.sway)) / Math.max(1, b.hh);
          tf += ` skewX(${(-Math.atan(lean)).toFixed(4)}rad)`;
          cloudFrame(cloudDomOf(cloudDomRef.current, id, el, f), b, f, t / 1000);
        }
        el.style.transform = tf;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [shownKey]);

  // 겹 안의 차례 — 키 큰 나무가 맨 뒤, 그다음 작은 나무 · 돌 · 떠다니는 말 · 구름(맨 앞, 곱하기)
  const layered = useMemo(() => {
    const rank = { tree: 0, stone: 1, float: 2, cloud: 3 } as const;
    return shown
      .map((msg) => ({ msg, kind: kindOf(cloudOf(msg).cloud), tall: tallOf(msg.text) }))
      .sort((a, b) => rank[a.kind] - rank[b.kind] || (a.kind === 'tree' ? b.tall - a.tall : 0))
      .map((x) => x.msg);
  }, [shown]);

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
      <div className="wall-field">
        {layered.map((msg, i) => (
          <WallBlock key={msg.id} msg={msg} index={i} ghost={emphMsg?.id === msg.id} onEl={setBlockEl} />
        ))}
      </div>

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
  const kind = kindOf(cloud);

  // 자리는 CSS가 아니라 프레임 루프가 transform으로 적는다(위 useEffect).
  // 여기서 style에 자리를 주면 매 프레임 React를 거치게 된다.
  return (
    <div
      className={`wall-block is-${kind}${ghost ? ' is-ghost' : ''}`}
      data-id={msg.id}
      ref={(el) => onEl(msg.id, el)}
    >
      {/* 숨은 구름마다 시작점이 다르다(cloud.ts의 phase0) — 열두 개가 같은 박자로 안 뛴다.
          파이가 열두 개의 번짐을 못 따라오면 ECHO_MOTION을 끈다. */}
      <CloudBubble cloud={cloud} box={box} side="var(--echo-side)" color={bg} still={!ECHO_MOTION} trunkExt={kind === 'tree'}>
        <VoiceBubble text={lines.join('\n')} bg={bg} color={text} fontFamily={fontFamily} font={msg.tone?.font} weight={wght}
          width={scaleX} slant={skew} align={msg.tone?.align} size={msg.tone?.size} manner={msg.tone?.manner}
          speed={msg.tone?.speed} weightPos={msg.tone?.weight} perChar={kind === 'cloud'}
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
          speed={msg.tone?.speed} weightPos={msg.tone?.weight}
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
