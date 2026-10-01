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
import Matter from 'matter-js';
import CloudBubble from '../components/CloudBubble';
import { cloudForTone, cloudShape, convexHull, linesFor, personaFor, type Cloud, type Creature, type CreaturePose } from '../lib/cloud';
import { WALL_SIDE, bubbleAt, fillFromLegacySize, type Boxed } from '../lib/fit';
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
/** 벽에 한 번에 서는 나무(당당한)의 최대 수(2026-10-01, 디자이너). 나무는 한 그루에 결 · 빗금 · 가닥이 많아 여러 그루가
    모이면 바닥이 소란했다(같은 벽에 여덟 · 셋을 세워 봤다). 여섯으로 정했다가 여덟로 고쳤다(같은 날). 넘치면 오래된 나무부터
    잠시 빠지고 그 자리를 다른 성격의 글이 채운다 — 열둘을 갈아 끼울 때(rotate) 빠졌던 나무도 제 차례에 돌아온다 */
const TREE_MAX = 8;
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
const ECHO_SIDE_VH = WALL_SIDE * 100;   // 37.2 — 나무의 키가 이 값으로 글자와 이어진다(fit.ts WALL_SIDE)
/**
 * 유머있는(새 · 박쥐)의 벽 크기 — 다른 말의 0.68배(2026-09-29, 디자이너). 실제 동물 크기라면 나무 · 구름에 비해 아주 작지만
 * 적절히 키우되 같은 위계는 아니게("그렇다해서 또 동 위계면 애매"). 같은 벽에 나무 · 구름 · 돌을 세우고 ×1 · 0.75 · 0.6 · 0.45를
 * 견줘 본 뒤 골랐다 — ×1은 새가 나무 꼭대기만 해 모자처럼 읽혔다. 몸이 글을 감싸서 글자도 같이 작아진다: 보통 크기가 실물 벽
 * (높이 1.4m)에서 2.6cm → 1.8cm. 참여자가 고른 크기는 그 안에서 그대로 산다. 크게 보여 준 발화는 제 크기로 서고, 내려앉을
 * 때 이 배율까지 줄어든다
 */
const CREATURE_SCALE = 0.68;
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

/** 몸의 종류 — 떠다니는 말 · 차분한의 돌 · 당당한의 나무 · 다정한의 구름 · 유머있는의 새(귀여운) · 박쥐(시니컬한) */
type Kind = 'float' | 'stone' | 'tree' | 'cloud' | 'bird' | 'bat';

/** 떠다니는 몸 하나. 자리와 속도는 여기 있고 React는 모른다 — 프레임마다
    상태를 갱신하면 열두 개 × 60프레임 = 초당 720번 다시 그리게 된다.
    hw · hh = 상자의 반폭 · 반높이. heavy = 차분한의 돌, a · va = 돌의 흔들림(rad).
    poly = 돌의 실제 윤곽(볼록 다각형, 가운데 기준 px). 말은 없다 — 상자로 친다.
    나무: tall = 키(벽 높이의 비율). 구름: home = 제 자리(벽에 대한 비율), sway · flutter = 엇걸음 ·
    펄럭임의 위상(헤맴의 가로 · 세로 위상도 겸한다), u = 글자 한 칸(px), chars = 글자 가운데(가운데 기준 px),
    side = 그 값들을 잰 한 변(창이 바뀌면 다시 잰다) */
type Body = {
  x: number; y: number; vx: number; vy: number; r: number; hw: number; hh: number;
  held: boolean; heavy: boolean; a: number; va: number; poly: Pt2[] | null;
  kind: Kind; tall: number; home: Pt2 | null; sway: number; flutter: number;
  u: number; chars: Pt2[]; side: number;
  /** 글 상자(상자에 대한 비율, 걸기처럼 돌린 글은 돌린 뒤의 테두리) · 나무의 글 자리(px, 여유 포함 — TEXT_CLEAR) */
  tx: Rect | null; zone: Rect | null;
  /** 짝(PAIR_ODDS) — 구름: 같이 떠다니는 짝 구름과 그 구름에서의 거리(px) */
  lead: Body | null; rel: Pt2;
  /** 칠 · 글자색(0~1) — 곱해진 자리에서 글자가 읽히나(legible) */
  bg: RGB; fg: RGB;
  /** 나무 — 새가 앉는 끝(꼭대기 · 단 끝, 상자에 대한 비율). 새 · 박쥐 — 앉음 · 날기 · 몸짓의 상태 */
  perch: Pt2[] | null; cr: CrState | null;
  /** 구름 — 꼬리까지 합친 가로 범위(상자 폭에 대한 비율, 0~1 밖으로 나간다). 크기는 몸통(상자)으로 재고, 읽힘은 꼬리까지 */
  ext?: Pt2;
  /** 구름 — 몰림을 마지막으로 따져 본 때의 벽 몸 수(새 몸이 들어오거나 빠질 때만 다시 본다 — drift) */
  crowdSeen?: number;
  /** 돌 — 물리 라이브러리의 몸(stoneBodyOf) · 상자 가운데가 그 몸의 무게중심에서 얼마나 떨어졌나(돌기 전, px) · 그 몸을 지은 한 변 ·
      기대는 한도를 풀었나(휩쓸려 나가는 중) */
  mb?: Matter.Body | null; mc?: Pt2; mside?: number; free?: boolean;
  /** 차분한의 발화(calmStep) — 발화 중인 글의 돌을 물리 밖에 세워 둠 · 큰 돌에 휩쓸리는 중 · 화면 밖으로 나갔음 · 휩쓸리는 빠르기(px/초) */
  parked?: boolean; swept?: boolean; away?: boolean; sv?: number;
};
type RGB = [number, number, number];
type Pt2 = [number, number];
/** 네모 — 왼 · 위 · 오른 · 아래 */
type Rect = [number, number, number, number];
/** 물리 계산이 보는 한 글의 치수 — 상자에 대한 비율(0~1)로. 한 변(side)이 창과 함께 바뀌기 때문이다 */
type Size = {
  /** 폭 · 높이는 벽의 크기 배율(scale — 새 · 박쥐 CREATURE_SCALE)까지 곱한 값 */
  w: number; h: number; scale?: number; heavy?: boolean; kind: Kind; poly?: Pt2[];
  /** 나무 — 키(벽 높이의 비율). 글 상자(상자에 대한 비율) — 모두 */
  tall?: number; tx?: Rect;
  /** 짝을 찾나 · 얼마나 겹치나 — 글이 씨앗인 0~1(PAIR_ODDS · PAIR_OVER) */
  pair?: number; over?: number;
  /** 칠 · 글자색(0~1) */
  bg?: RGB; fg?: RGB;
  /** 나무 — 새가 앉는 끝(상자에 대한 비율). 새 · 박쥐 — 형상(형상 단위) */
  perch?: Pt2[]; cr?: CrGeo;
  /** 구름 — 글자 가운데, 글자 한 칸(한 변의 비율) · 상자 폭(u) · 꼬리까지 합친 가로 범위(상자 폭에 대한 비율) */
  chars?: Pt2[]; unit?: number; cw?: number; ext?: Pt2;
  /** 돌 — 보이는 윗사슬(밑변 한 끝 → 윗선 → 다른 끝) · 땅에 묻힌 아랫부분(상자에 대한 비율 — 아랫부분은 1 밖으로 나간다) */
  chain?: Pt2[]; belly?: Pt2[];
};

// ─── 나무 (당당한) — 벽 아래에 선다 (2026-09-28, design/landscape.md '나무') ─────────
/* 나무 키(바닥 → 꼭대기, 벽 높이의 비율)는 cloud.ts가 정한다(treeFor · tree.tall) — 2026-10-01부터 **글이 키를 정한다**(글이
   겨우 드는 수관 × 1.15 + 줄기 늘이기, 상한 60%). 그 전(09-29)에는 3/5에서 고른 크기가 곧 키였다(매우 작게 20% → 매우 크게 60%,
   글이 씨앗으로 ±5%) — 디자이너가 '글에 비해 나무가 크다'고 해서 바꿨다(design/landscape.md '나무').
   지나온 값: 30~60%(09-28 처음) → "고도가 높다"며 15~35%(같은 날, 넷 중에서) → 기둥 없는 새 나무에서 "더 높아도 된다"
   (09-29) — 같은 벽에 15~35 · 20~45 · 25~55 · 30~60%를 세워 보고, 범위 대신 크기와 잇기로 했다 */
/** 나무끼리 — 숲처럼 불규칙하게 선다(2026-09-30, 디자이너 — "다 동일간격으로 부자연스럽게 있는 건 별로"). 전에는 다른 나무와
    반폭 합의 60%만큼 떼어 놓으려 해서 빈자리를 차례로 메웠고, 나무들이 고른 간격으로 늘어섰다. 이제는 거의 한자리에 포개지는
    것만(반폭 합의 TREE_STACK 안) 피하고 나머지는 벽 어디든 — 몰린 곳과 빈 곳이 절로 생긴다. 그리고 TREE_GROVE만큼은 이미 선
    나무 곁에 붙어 선다(좁은 쪽 폭의 TREE_NEAR만큼 걸쳐) — 두세 그루가 무리 지은 곳. 키 큰 나무가 뒤, 글자끼리는 여전히 안 겹친다 */
const TREE_STACK = 0.2;
const TREE_GROVE = 0.45;
const TREE_NEAR: readonly [number, number] = [0.15, 0.55];
/**
 * 글 자리 — 글 상자에서 이만큼(벽 높이의 비율, 1920×1080에서 11px) 둘레까지. **글자와 글자는 겹치지 않는다**
 * (2026-09-29, 디자이너 — "나무의 텍스트 부분과 텍스트가 서로 겹치지 않아야"). 처음엔 나무의 글 자리에 어떤 몸도 못
 * 들어오게 했다 — 돌이 곱하지 않고 앞에 서서 나무 글을 통째로 가렸기 때문이다(분홍 돌이 산호 나무의 글을 덮었다).
 * 같은 날 돌도 곱하게 되면서(오버프린트, PAIR_ODDS) 몸은 남의 글 위로도 걸친다 — 곱해도 검은 글자는 그대로 읽힌다.
 * 지키는 것은 글자끼리다:
 * - 돌: 제 글의 **세로 띠**가 나무 글 자리에 들어가지 않는다. 떨어지는 동안에도 글끼리 스치지 않게 띠로 잡았다.
 *   떨어질 자리를 띠 밖에서 고르고, 밀려 들어오면 가까운 쪽으로 미끄러져 나간다
 * - 떠다니는 말(유머있는): 아직 곱하지 않는다(가린다) — 나무 글 자리에서 바닥까지를 기둥으로 치고 튕긴다. 밑으로는
 *   안 민다 — 나무 머리에 튕기게 했을 때 머리와 벽 끝 사이에 끼어 떨었다(2026-09-28). 옆이 벽에 막히면 위로 비킨다
 * - 구름: 나무 위 어디든 자리를 잡고(나무가 구름을 뚫고 지나간다), 헤매다 글줄이 나무 글 자리에 닿으려 하면 그때 비킨다.
 *   제 자리에서부터 글이 걸리는 새 나무가 서면 자리를 옮긴다
 * - 나무끼리: 글 자리가 안 겹치는 가로 자리를 고른다
 * 자리가 정말 없으면(벽이 꽉 찼을 때) 가장 덜 겹치는 곳을 고르고, 돌은 미끄러져 나간다.
 */
const TEXT_CLEAR = 0.01;
/**
 * 오버프린트 — 짝 찾기(2026-09-29, 디자이너). 벽에 오르는 글 둘에 하나꼴(글이 씨앗)이 높이가 걸치는 짝을 찾아 옆으로
 * 일부 포개진 자리에 선다. 나머지는 빈자리에 선다. 모두가 겹치면 어색하다(디자이너) — 겹친 곳이 드문드문 강조로 읽히게.
 * 높이는 성격의 규칙 그대로 두고 옆으로만 찾는다(억지로 끌어올리거나 내리지 않는다):
 * - 돌 ↔ 나무: 둘 다 바닥에 선다. 새 돌은 나무 옆에, 새 나무는 돌 옆에
 * - 구름 ↔ 구름: 새 구름이 짝 구름 옆(조금 위나 아래로 비껴)에 붙어 **같이 떠다닌다** — 따로 헤매면 겹침이 벌어졌다 닫혔다 한다
 * - 구름 ↔ 나무: 짝으로 찾지 않는다 — 구름은 곳곳의 빈자리로 흩어지고, 거기 솟은 나무가 구름을 뚫고 지나가며 곱해진다
 *   (디자이너 — "나무가 구름을 관통할 수 있게, 구름이 더 곳곳에"). 나무 끝에 걸터앉는 짝을 먼저 넣었다가 걷었다(pairCloud)
 * - 나무끼리는 짝을 찾지 않는다(지금처럼 자리를 고르다 우연히만, 디자이너)
 * 얼마나: 둘 중 좁은 쪽 폭의 35~60%가 가로로 포개진다(글이 씨앗). 벽 크기 견본 넷(지금 · 글 자리 보호 최대 · 글자끼리만
 * 35% · 60%) 중 뒤의 둘 사이로 골랐다(디자이너 — "C~D를 자유롭게"). 글자끼리 닿으면 그만큼 덜 겹치고, 35%도 안 되면
 * 다른 짝 · 다른 쪽을 보고, 끝내 없으면 빈자리에 선다.
 */
const PAIR_ODDS = 0.5;
const PAIR_OVER: readonly [number, number] = [0.35, 0.6];

// ─── 구름 (다정한) — 제자리에서 부유한다 (2026-09-29, design/landscape.md '구름') ─────
// 벽의 느린 박자는 모두 --t-hold의 배수다(아래 hold()).
/** 구름이 다니는 곳 — 벽 위 끝(여백)에서 이 비율까지. 맨 밑 18%는 돌 자리다.
    0.7이었다(아래 30%는 돌 · 나무 자리). 나무 키를 크기로 이으며(최대 65%) 디자이너가 풀었다 — "구름의 고도 제한을 풀자.
    돌 옆에 있으면 어색하겠지, 맨 밑 부분에는 안 되겠지만 저 많은 나무의 남는 부분들을 구름이 마음껏 관통하며"(2026-09-29).
    구름은 나무 사이로 내려와 나무를 뚫고 지나가며 곱해진다. 돌 곁은 CLOUD_STONE_GAP만큼 비킨다 */
const CLOUD_ZONE = 0.82;
/** 구름이 돌(과 돌이 떨어질 길)에서 떨어지는 거리 — 벽 높이의 비율(1920×1080에서 32px). 헤매며 닿는 곳 전체로 본다 */
const CLOUD_STONE_GAP = 0.03;
const CLOUD_MARGIN = 0.02;
/** 부유 — 구름마다 제 자리(home)를 하나 받아 그 둘레만 헤맨다. 가운데가 다니는 가로 반지름(u) · 세로는 그 비율 ·
    가로 한 바퀴(--t-hold 배수) · 세로 박자는 가로보다 이만큼 느리게(같은 동그라미를 되풀이하지 않는다).
    움직이는 견본에서 ±50px · 21초(평균 11px/초, 1920×1080)의 빠르기를 골랐고 "영역은 134px까지 가도 된다"고 해서
    반지름을 넓히고 한 바퀴를 같은 빠르기가 되게 늘렸다(134/50 × 21 ≈ 56초 = × 80). 2026-09-29.
    견본의 칸 이름은 '±3u · ±8u'였는데 그 u는 **보이는 글자 크기**였다 — 여기 u(b.u)는 다카포의 크기 보정(× 0.77)
    전 값이라 8을 그대로 넣으니 영역 · 빠르기가 30% 컸다(한 바퀴 재서 가로 334px). 픽셀로 맞춰 6(130px) */
const FLOAT_U = 6;
const FLOAT_RY = 0.6;
const FLOAT_LOOP = 80;
const FLOAT_Y_RATIO = 1.37;
/** 헤매는 자리를 따라가는 느슨함(--t-hold 배수) — 밀렸다가 돌아올 때도, 처음 자리를 잡을 때도 이 박자로 스르르 */
const FLOAT_FOLLOW = 4;
/** 엇걸음 · 펄럭임은 평소엔 끈다 — 제자리에서 조용히 부유하는 동안은 작은 구름 오르내림만 한다(디자이너, 2026-09-29).
    값과 코드는 둔다: 새 글이 크게 등장할 때 구름이 화면 밖으로 휭 날아가는 장면(계획)에서 더 세게 쓴다 */
const SWAY_ON = false;
const FLUTTER_ON = false;
/** 엇걸음 — 몸 전체를 앞뒤로 기울여 위 · 아래가 번갈아 앞선다. 한 번(--t-hold 배수) · 위아래 끝이 앞서는 거리(u) */
const SWAY = 4;
const SWAY_U = 0.25;
/** 펄럭임 — 이 간격(--t-hold 배수)마다 한 번, 왼쪽(읽는 순서)에서 오른쪽으로 지나가는 데(배수),
    글자와 구슬이 오르는 높이(u) · 물결 폭(u) */
const FLUTTER_EVERY = 14;
const FLUTTER_PASS = 3;
const FLUTTER_U = 0.3;
const FLUTTER_WIDTH = 1.1;
/** 두 구름의 글자 한 자끼리 떨어지는 거리(u, 가운데 사이) — 글자의 둥근 자리 0.55 둘 + 틈 0.15. 몸은 겹쳐 지나가되(곱하기)
    글자끼리는 안 닿는다. 오버프린트 전에는 구슬이 남의 글자에서 0.7u(0.55 + 0.15) 떨어졌다 */
const LETTER_APART = 1.25;
/** 파고든 만큼을 이 시간(초)에 걸쳐 떼어 놓는다. 0.06초(견본 값)에서는 다가오는 빠르기를 못 따라가 구슬이 둘레를 0.32u까지
    파고들었다(벽에서 20초 재서) — 두어 프레임에 뗀다. 파고듦이 조금씩 자라므로 한 번에 미는 양은 여전히 작다 */
const LETTER_PUSH_S = 0.02;

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
/** 글 → 0~1. 같은 글은 같은 값(나무 키의 흔들림 · 짝을 찾나 · 얼마나 겹치나) */
function seed01(text: string): number {
  let h = 2166136261;
  for (const c of text) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) / 4294967296;
}
/** 나무의 키 — 벽 높이의 비율(cloud.ts treeFor). 나무가 아니면 0 */
function tallOf(msg: StoredMessage): number {
  return cloudOf(msg).cloud.tree?.tall ?? 0;
}
/** 벽에서 이 말의 크기 배율 — 새 · 박쥐만 CREATURE_SCALE */
function scaleOf(cloud: Cloud): number {
  return cloud.creature ? CREATURE_SCALE : 1;
}
function kindOf(cloud: Cloud): Kind {
  return cloud.stone ? 'stone' : cloud.tree ? 'tree' : cloud.photo ? 'cloud' : cloud.creature ? cloud.creature.kind : 'float';
}
/** 나무에서 새가 앉는 끝 — 상자에 대한 비율. 사진 나무의 꼭대기와 수관 양쪽의 높은 윗선(scripts/trees/export.py) */
function perchesOf(cloud: Cloud): Pt2[] | undefined {
  const t = cloud.tree;
  return t ? t.perch.map(([x, y]): Pt2 => [x / cloud.w, y / cloud.h]) : undefined;
}
/** 새 · 박쥐의 형상 — 형상 단위. anchor = 앉는 점(새: 몸 원의 맨 밑) · 매다는 점(박쥐: 뒤집힌 발끝, 폰 자세의 맨 위) */
function crGeoOf(cloud: Cloud): CrGeo | undefined {
  const c = cloud.creature;
  if (!c) return undefined;
  const rest = c.poses.rest, t = cloud.text;
  let anchor: Pt2;
  if (c.kind === 'bird') { const body = rest.discs[0]; anchor = [body.cx, body.cy + body.r]; }
  else { const top = rest.polys[0].reduce((m, p) => (p[1] < m[1] ? p : m)); anchor = [top[0], top[1]]; }
  const tcx = t.x + t.w / 2, tcy = t.y + t.h / 2;
  return { kind: c.kind, w: cloud.w, h: cloud.h, tcx, tcy, anchor, poses: c.poses, ...reachOf(c, anchor, tcx, tcy) };
}
/**
 * 자세들이 차지하는 테두리(형상 단위) — 앉은 새는 몸짓(꼬리 · 고개 · 부풀림 · 쪼기 · 콩콩)과 양쪽 방향 모두, 나는 새는
 * 날갯짓과 양쪽 방향. 박쥐는 발끝을 붙인 채 움찔 · 펴기 · 흔들림, 나는 박쥐는 편 자세. 앉을 자리 · 나는 길을 이 테두리로
 * 따진다 — 폰 자세 상자로만 따졌더니 반대로 돌아선 새의 꼬리가 돌의 글을 덮었다(벽에서 60초에 15프레임, 재서 알았다)
 */
function reachOf(c: Creature, anchor: Pt2, tcx: number, tcy: number): { reach: Rect; flyReach: Rect } {
  const turn = (P: Pt2[], deg: number, o: Pt2): Pt2[] => {
    const a = (deg * Math.PI) / 180, co = Math.cos(a), sn = Math.sin(a);
    return P.map(([x, y]): Pt2 => [o[0] + (x - o[0]) * co - (y - o[1]) * sn, o[1] + (x - o[0]) * sn + (y - o[1]) * co]);
  };
  const ring = (d: { cx: number; cy: number; r: number }, k = 1, dy = 0): Pt2[] =>
    Array.from({ length: 16 }, (_, i): Pt2 => [d.cx + d.r * k * Math.cos((i * Math.PI) / 8), d.cy + dy + d.r * k * Math.sin((i * Math.PI) / 8)]);
  const boxOf = (P: Pt2[]): Rect => [Math.min(...P.map((p) => p[0])), Math.min(...P.map((p) => p[1])), Math.max(...P.map((p) => p[0])), Math.max(...P.map((p) => p[1]))];
  const both = (P: Pt2[]) => [...P, ...P.map(([x, y]): Pt2 => [2 * tcx - x, y])];             // 양쪽 방향
  const topOf = (Q: readonly (readonly [number, number])[]) => Math.min(...Q.map((p) => p[1]));
  if (c.kind === 'bird') {
    const sit = c.poses.sit ?? c.poses.rest, [body, head] = sit.discs, [beak, tail] = sit.polys as Pt2[][];
    const root: Pt2 = [(tail[0][0] + tail[3][0]) / 2, (tail[0][1] + tail[3][1]) / 2];
    const P = [...ring(body, 1.05), ...ring(head, 1.05), ...ring(head, 1.05, 0.25), ...beak, ...beak.map(([x, y]): Pt2 => [x, y + 0.25]), ...tail, ...turn(tail, -14, root)];
    const r = boxOf(both([...P, ...turn(P, 12, [tcx, tcy])]));
    const fly = c.poses.fly, [fb, fh] = fly.discs, [fk, ft, fan] = fly.polys as Pt2[][];
    const F = [...ring(fb), ...ring(fh), ...fk, ...ft, ...(fan ? [...turn(fan, 18, fan[0]), ...turn(fan, -18, fan[0])] : [])];
    return { reach: [r[0], r[1] - 0.6, r[2], r[3]], flyReach: boxOf(both(F)) };
  }
  const rest = c.poses.rest.polys[0] as Pt2[], t0 = topOf(rest);
  const pinned = (Q: Pt2[]) => Q.map(([x, y]): Pt2 => [x, y + t0 - topOf(Q)]);
  const P = [rest, c.poses.twitch?.polys[0], c.poses.stretch?.polys[0]].filter((q): q is Pt2[] => !!q).flatMap((q) => pinned(q));
  return { reach: boxOf([...turn(P, 3, anchor), ...turn(P, -3, anchor)]), flyReach: boxOf(pinned(c.poses.fly.polys[0] as Pt2[])) };
}
/** 글 상자 — 상자에 대한 비율. 걸기처럼 돌린 글(layout.rotate)은 돌린 뒤의 테두리 */
function textBox(cloud: Cloud): Rect {
  const t = cloud.text, rot = cloud.layout?.rotate ?? 0, cx = t.x + t.w / 2, cy = t.y + t.h / 2;
  const c = Math.abs(Math.cos(rot)), sn = Math.abs(Math.sin(rot)), hw = (t.w * c + t.h * sn) / 2, hh = (t.w * sn + t.h * c) / 2;
  return [(cx - hw) / cloud.w, (cy - hh) / cloud.h, (cx + hw) / cloud.w, (cy + hh) / cloud.h];
}
/** 나무의 키(px) — 나무 전체(cloud.ts tree.full)가 벽에서 서는 높이. 상자(수관 + 줄기 윗부분)보다 작아지지 않는다 */
function treeHeight(b: Body, h: number): number {
  return Math.max(b.tall * h, 2 * b.hh);
}
/** 글 자리(px) — 가운데 (x, y) · 반폭 · 반높이의 상자 안 글 상자(tx)에 둘레 m을 더해 */
function textAt(x: number, y: number, hw: number, hh: number, tx: Rect, m: number): Rect {
  const x0 = x - hw, y0 = y - hh;
  return [x0 + tx[0] * 2 * hw - m, y0 + tx[1] * 2 * hh - m, x0 + tx[2] * 2 * hw + m, y0 + tx[3] * 2 * hh + m];
}
/** 나무의 글 자리(px) — 글 상자에 TEXT_CLEAR만큼 둘레를 더해 */
function zoneAt(x: number, y: number, hw: number, hh: number, tx: Rect, h: number): Rect {
  return textAt(x, y, hw, hh, tx, TEXT_CLEAR * h);
}
/** 돌 글의 세로 띠(px, 둘레 포함) — 이 띠가 나무 글 자리에 들어가지 않는다. x에 놓였을 때 */
function bandAt(x: number, hw: number, tx: Rect | null, h: number): [number, number] {
  const m = TEXT_CLEAR * h;
  return tx ? [x - hw + tx[0] * 2 * hw - m, x - hw + tx[2] * 2 * hw + m] : [x - hw, x + hw];
}
/** 짝 옆 자리 — 가운데가 짝(o)의 dir 쪽, 둘 중 좁은 쪽 폭의 over만큼 가로로 포개지는 곳 */
function besideX(o: Body, hw: number, over: number, dir: number): number {
  return o.x + dir * (o.hw + hw - over * 2 * Math.min(o.hw, hw));
}
/** 겹침 양 후보 — 글이 고른 양부터, 글자에 막히면 35%까지 내려 본다 */
function oversFrom(over: number): number[] {
  const a = PAIR_OVER[0] + (PAIR_OVER[1] - PAIR_OVER[0]) * over;
  return [a, (a + PAIR_OVER[0]) / 2, PAIR_OVER[0]];
}
function shuffled<T>(list: readonly T[]): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function overlapArea(a: Rect, b: Rect): number {
  return Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
}
/** 가로로 겹치는 길이 — 돌의 세로 띠 */
function spanOverlap(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}
function zonesOf(bodies: Iterable<Body>): Rect[] {
  const out: Rect[] = [];
  for (const b of bodies) if (b.kind === 'tree' && b.zone) out.push(b.zone);
  return out;
}
/** 구름의 글줄이 제 자리(home)에서 헤매며 닿을 수 있는 곳 전부(px, 둘레 포함). 짝을 따라 떠다니는 구름은 짝의 헤맴을 탄다 */
function lettersWander(b: Body, home: Pt2, w: number, h: number): Rect {
  const [rx, ry] = floatR(b.lead ?? b, w, h), x = home[0] * w, y = home[1] * h;
  const t = b.tx ? textAt(x, y, b.hw, b.hh, b.tx, TEXT_CLEAR * h) : [x - b.hw, y - b.hh, x + b.hw, y + b.hh];
  return [t[0] - rx, t[1] - ry, t[2] + rx, t[3] + ry];
}
// ─── 읽힘 — 섞인 자리의 글자 (2026-09-29) ───────────────────────────────
/**
 * 섞인 자리에서 글자와 바탕의 대비 하한(WCAG 큰 글자 3:1). 몸은 남의 글 위로도 걸치지만(섞여 비친다), 이보다 낮아지는
 * 짝이면 글자가 그 몸을 비킨다. 노랑 구름이 파랑 나무에 뚫리자 곱해진 자리가 거의 검정이 되어 검은 구름 글자가 묻혔다
 * (벽에서 봤다). 디자이너가 둘 중 골랐다 — 읽힐 때만 겹침(추천) / 글자는 어떤 몸도 피함.
 * 섞는 방식은 층마다 다르다(app.css '벽의 풍경', BLEND): 뒤 나무 · 가운데 돌은 어둡게, 앞 구름은 하드 라이트. 위에 올라간
 * 쪽의 방식으로 잰다. 확정한 성격별 색(각 여덟 짝)으로 벽에서 겹치는 조합을 모두 재서 골랐다 — 모두 곱하기 74% ·
 * 모두 어둡게 82% · 이 층 나눔 62%가 읽혔다. 층 나눔은 구름이 채도 높은 나무에 묻히지 않는 대신 구름 밑 글자가 구름 색에
 * 물든다 — 그런 자리를 이 규칙이 비킨다
 */
const LEGIBLE = 3;
/** 층의 차례(겹 안의 DOM 차례와 같다 — layered) · 층마다 섞는 방식(채널 하나: 아래 cb, 위 cs). 떠다니는 말은 섞지 않는다 */
const RANK: Record<Kind, number> = { tree: 0, stone: 1, float: 2, bird: 2, bat: 2, cloud: 3 };
const hardLight = (cb: number, cs: number) => (cs <= 0.5 ? cb * 2 * cs : cb + (2 * cs - 1) - cb * (2 * cs - 1));
const BLEND: Record<Kind, (cb: number, cs: number) => number> = {
  tree: Math.min, stone: Math.min, cloud: hardLight, float: (_cb, cs) => cs, bird: (_cb, cs) => cs, bat: (_cb, cs) => cs
};
/** 나무의 몸 폭(상자 폭의 배수) — 사진 나무는 상자 폭이 곧 나무 폭이다(수관이 가장 넓다). 기하 나무 때는 폰 판 아래로
    이어 쌓은 단이 1.3배까지 넓어졌다 */
const TREE_BASE = 1;
function rgbOf(c: string): RGB {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return [1, 1, 1];
  const x = m[1].length === 3 ? m[1].split('').map((d) => d + d).join('') : m[1];
  return [0, 2, 4].map((i) => parseInt(x.slice(i, i + 2), 16) / 255) as RGB;
}
function luminance(c: RGB): number {
  const f = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
/** a의 글자가 b의 몸과 섞여도 읽히나 — 섞인 글자색과 섞인 칠의 대비가 LEGIBLE 이상인가. 섞는 방식은 위에 올라간 쪽의 것
    (BLEND). 같은 층끼리(나무 · 나무, 구름 · 구름)는 누가 위일지 모르니 두 차례 다 읽혀야 한다 */
function legible(a: Body, b: Body): boolean {
  const mix = (f: (cb: number, cs: number) => number, cb: RGB, cs: RGB): RGB => [f(cb[0], cs[0]), f(cb[1], cs[1]), f(cb[2], cs[2])];
  const ok = (text: RGB, paper: RGB) => { const l1 = luminance(text), l2 = luminance(paper); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) >= LEGIBLE; };
  const aTop = () => ok(mix(BLEND[a.kind], b.bg, a.fg), mix(BLEND[a.kind], b.bg, a.bg));      // a가 위: a의 글자가 b의 칠 위
  const aUnder = () => ok(mix(BLEND[b.kind], a.fg, b.bg), mix(BLEND[b.kind], a.bg, b.bg));    // a가 아래: b의 칠이 a의 글자 위
  return RANK[a.kind] > RANK[b.kind] ? aTop() : RANK[a.kind] < RANK[b.kind] ? aUnder() : aTop() && aUnder();
}
/** 글 자리(px, 둘레 m) · 몸(px) — 나무는 바닥까지(상자 밑으로 이어지는 줄기까지), 돌은 윤곽의 테두리 */
function lettersOf(b: Body, m: number): Rect | null {
  return b.tx ? textAt(b.x, b.y, b.hw, b.hh, b.tx, m) : null;
}
function bodyOf(b: Body, h: number): Rect {
  if (b.kind === 'tree') return [b.x - b.hw * TREE_BASE, b.y - b.hh, b.x + b.hw * TREE_BASE, h];
  // 띠 구름 — 꼬리는 상자(몸통) 밖으로 뻗는다. 남의 글자를 덮어 읽히지 않게 되는지는 꼬리까지 따진다(2026-09-30)
  if (b.ext) return [b.x - b.hw + b.ext[0] * 2 * b.hw, b.y - b.hh, b.x - b.hw + b.ext[1] * 2 * b.hw, b.y + b.hh];
  if (b.poly) {
    let l = Infinity, r = -Infinity, t = Infinity, d = -Infinity;
    for (const [x, y] of b.poly) { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); d = Math.max(d, y); }
    return [b.x + l, b.y + t, b.x + r, b.y + d];
  }
  return [b.x - b.hw, b.y - b.hh, b.x + b.hw, b.y + b.hh];
}
/**
 * 이 자리에서 a가 o와 부딪치나 — 글자끼리(letters), 또는 곱해져 읽히지 않는 글자와 몸. [a에서 비켜야 할 네모, o의 네모]의 쌍들.
 * 둘레(TEXT_CLEAR)는 o 쪽에만 둔다
 */
function clashes(a: Body, o: Body, h: number, letters = true): [Rect, Rect][] {
  const m = TEXT_CLEAR * h, out: [Rect, Rect][] = [];
  const la = lettersOf(a, 0), lo = lettersOf(o, m);
  if (letters && la && lo && overlapArea(la, lo) > 0) out.push([la, lo]);
  if (la && !legible(a, o)) { const bo = bodyOf(o, h), g: Rect = [bo[0] - m, bo[1] - m, bo[2] + m, bo[3] + m]; if (overlapArea(la, g) > 0) out.push([la, g]); }
  if (lo && !legible(o, a)) { const ba = bodyOf(a, h); if (overlapArea(ba, lo) > 0) out.push([ba, lo]); }
  return out;
}
function clashArea(a: Body, o: Body, h: number): number {
  return clashes(a, o, h).reduce((s, [r, z]) => s + overlapArea(r, z), 0);
}
/** b를 덜 들어간 쪽으로 조금씩 옮겨 네모 R을 Z 밖으로 — 한 번에 옮기면 순간이동으로 보인다(LETTER_PUSH_S) */
function pushOut(b: Body, R: Rect, Z: Rect, dt: number, share = 1) {
  const l = R[2] - Z[0], r = Z[2] - R[0], u = R[3] - Z[1], d = Z[3] - R[1];
  if (l <= 0 || r <= 0 || u <= 0 || d <= 0) return;
  const pen = Math.min(l, r, u, d), k = Math.min(1, dt / LETTER_PUSH_S) * 0.5 * pen * share;
  if (pen === l) b.x -= k; else if (pen === r) b.x += k; else if (pen === u) b.y -= k; else b.y += k;
}
/** 이 제 자리에서 구름이 나무와 부딪치는 양(px²) — 글자끼리 · 읽히지 않는 글자와 몸. 헤매는 동안 닿는 것은 그때그때
    비킨다(cloudOffTrees). 처음엔 헤매며 닿을 수 있는 곳 전체를 비켰다 — 나무 키를 크기로 잇자 키 큰 나무들의 글이 벽
    가운데를 막아 구름이 모두 그 위로 밀렸고, 여섯 번 띄워 나무가 구름을 뚫은 판이 없었다(디자이너 — "나무가 구름을
    관통할 수 있게, 구름이 곳곳에") */
function homeHits(b: Body, home: Pt2, w: number, h: number, bodies: Iterable<Body>): number {
  const at: Body = { ...b, x: home[0] * w, y: home[1] * h };
  let hit = 0;
  for (const t of bodies) if (t.kind === 'tree') hit += clashArea(at, t, h);
  return hit;
}
/** 헤매던 구름이 나무와 부딪치면(글자끼리 · 읽히지 않는 글자와 몸) 덜 들어간 쪽으로 조금씩 떼어 놓는다. 나머지는 나무가
    구름을 뚫고 지나간다 — 곱해진다 */
function cloudOffTrees(b: Body, bodies: Body[], h: number, dt: number) {
  // 새 · 박쥐도 — 구름이 그 글자 위로 지나가며 묻히게 하지 않는다(새 · 박쥐는 섞이지 않고 구름 밑에 있다)
  for (const t of bodies) if (t.kind === 'tree' || t.cr) for (const [R, Z] of clashes(b, t, h)) pushOut(b, R, Z, dt);
}
/**
 * 구름의 짝(PAIR_ODDS) — 짝이 없는 구름 옆에 붙어 같이 떠다닌다. 겹침 양을 글이 고른 값부터 35%까지 내려 가며, 조금 위나
 * 아래로도 비껴 보고, 글자끼리 안 닿는 첫 자리. 찾으면 b의 lead · rel과 home을 적는다. 못 찾으면 그대로 둔다(빈자리로 간다).
 * 나무 끝에 걸터앉는 짝도 있었다(같은 날) — 나무 키를 크기로 잇자 구름 자리까지 닿는 나무가 많아져 벽의 구름이 모두 나무
 * 끝에 모였다. 디자이너가 걷고 "나무가 구름을 관통하게, 구름이 곳곳에" 두었다 — 구름은 빈자리로 흩어지고, 거기 솟은 나무가
 * 구름을 뚫고 지나가며 곱해진다(글자끼리만 비킨다)
 */
function pairCloud(b: Body, w: number, h: number, taken: Body[], over: number): void {
  const m = TEXT_CLEAR * h;
  const words = (q: Body, x: number, y: number): Rect => (q.tx ? textAt(x, y, q.hw, q.hh, q.tx, m) : [x - q.hw, y - q.hh, x + q.hw, y + q.hh]);
  // 짝은 하나씩 — 이미 짝이 있는 구름은 뺀다
  const cands = shuffled(taken.filter((o) => o.kind === 'cloud' && o.home && !o.lead && !taken.some((q) => q.lead === o)));
  for (const ov of oversFrom(over)) for (const o of cands) for (const dir of shuffled([1, -1])) {
    // 짝의 헤맴을 같이 탄다 — 짝의 반지름으로 벽 위 82% 안에 드는지 본다. 조금 위나 아래로 비껴 봉우리끼리도 겹친다
    const [rx, ry] = floatR(o, w, h), ox = o.home![0] * w, oy = o.home![1] * h;
    for (const f of [0, -0.3, 0.3, -0.6, 0.6]) {
      const dx = besideX(o, b.hw, ov, dir) - o.x, dy = f * (o.hh + b.hh), x = ox + dx, y = oy + dy;
      if (x - b.hw - rx < 0 || x + b.hw + rx > w || y - b.hh - ry < CLOUD_MARGIN * h || y + b.hh + ry > CLOUD_ZONE * h) continue;
      const mine = words(b, x, y), sweep: Rect = [mine[0] - rx, mine[1] - ry, mine[2] + rx, mine[3] + ry];
      // 짝과 글자끼리 · 읽히지 않는 글자와 몸이 안 닿고, 나무 · 돌 곁 · 다른 구름의 글줄에도 안 걸리는 자리
      if (clashes({ ...b, x, y }, { ...o, x: ox, y: oy }, h).length || homeHits(b, [x / w, y / h], w, h, taken) > 0 || stoneHits(b, [x / w, y / h], w, h, taken) > 0 ||
        crowdAt([x - b.hw - rx, y - b.hh - ry, x + b.hw + rx, y + b.hh + ry], taken, w, h, (q) => q === b || q === o || q.lead === o) > 0 ||
        taken.some((q) => q !== o && q.kind === 'cloud' && q.home && overlapArea(sweep, lettersWander(q, q.home, w, h)) > 0)) continue;
      b.lead = o; b.rel = [dx, dy]; b.home = [x / w, y / h];
      return;
    }
  }
}
/**
 * 몰림(2026-10-01, 디자이너 — "몰리지 않게"). 한 나무 위에 구름 셋 · 박쥐 · 새가 쌓인 자리가 나무 수보다 더 소란했다.
 * 이 네모 r에 걸치는 몸의 수 — 몸 넓이의 CROWD_MIN 넘게 겹치는 것만 센다. 구름은 헤매는 곳 전체, 새 · 박쥐는 앉은 몸짓 전부,
 * 나무 · 돌은 몸. skip으로 자신 · 짝 · 앉을 나무를 뺀다. 구름은 이 수가 가장 적은 자리를 먼저 고르고(한 몸까지는 괜찮다 —
 * 나무가 구름을 뚫고 지나가는 것은 디자이너가 둔 것), 새 · 박쥐는 다른 몸이 안 걸린 자리부터 앉는다
 */
const CROWD_MIN = 0.12;
function wanderBox(o: Body, w: number, h: number): Rect {
  const [rx, ry] = floatR(o.lead ?? o, w, h), x = (o.home?.[0] ?? o.x / w) * w, y = (o.home?.[1] ?? o.y / h) * h;
  return [x - o.hw - rx, y - o.hh - ry, x + o.hw + rx, y + o.hh + ry];
}
function crowdAt(r: Rect, bodies: Iterable<Body>, w: number, h: number, skip: (o: Body) => boolean): number {
  const area = (q: Rect) => Math.max(1, (q[2] - q[0]) * (q[3] - q[1]));
  let n = 0;
  for (const o of bodies) {
    // 크기를 아직 모르는 몸(벽이 막 켜진 첫 프레임들의 떠다니는 말)은 세지 않는다 — 곧 나무 · 돌 · 구름으로 다시 놓인다.
    // 셌더니 구름이 그 임시 자리들을 피해 다른 구름 곁으로 몰렸다
    if (skip(o) || o.kind === 'float') continue;
    const R = o.kind === 'cloud' ? wanderBox(o, w, h) : o.cr ? (o.cr.box ?? [o.x - o.hw, o.y - o.hh, o.x + o.hw, o.y + o.hh]) : bodyOf(o, h);
    if (overlapArea(r, R) > CROWD_MIN * Math.min(area(r), area(R))) n++;
  }
  return n;
}
/** 구름이 지금 가 있을 곳 — 짝 구름을 따라가는 구름은 짝의 헤맴 + 떨어진 거리 */
function cloudTarget(b: Body, w: number, h: number, sec: number): Pt2 {
  if (b.lead) { const [x, y] = floatAt(b.lead, w, h, sec); return [x + b.rel[0], y + b.rel[1]]; }
  return floatAt(b, w, h, sec);
}
/** 이 제 자리에서 헤매는 구름 전체가 돌 곁(돌 · 돌이 바닥까지 떨어질 길 + CLOUD_STONE_GAP)에 얼마나 걸리나(px²) */
function stoneHits(b: Body, home: Pt2, w: number, h: number, bodies: Iterable<Body>): number {
  const [rx, ry] = floatR(b.lead ?? b, w, h), x = home[0] * w, y = home[1] * h, g = CLOUD_STONE_GAP * h;
  const r: Rect = [x - b.hw - rx, y - b.hh - ry, x + b.hw + rx, y + b.hh + ry];
  let hit = 0;
  for (const s of bodies) if (s.kind === 'stone') hit += overlapArea(r, [s.x - s.hw - g, s.y - s.hh - g, s.x + s.hw + g, h]);
  return hit;
}
/**
 * 구름의 제 자리 — 벽 위 82% 안에서, 헤매도 그 밖으로 안 나가는 곳 중 **다른 구름의 자리에서 가장 먼 곳**(빈자리).
 * 서른 번 뽑아 가장 먼 것을 고른다. 처음엔 '안 겹치는 첫 자리'였는데 열 개를 띄우니 가운데로 몰리고 오른쪽이
 * 비었다(2026-09-29) — 빈 곳부터 채운다. 자리가 모자라면 겹친다(오버프린트라 조금은 겹쳐도 된다, 디자이너).
 * 자리는 벽에 대한 비율로 둔다 — 창이 바뀌어도 같은 곳이다.
 * 글줄이 나무의 글 자리에 걸리는 곳(TEXT_CLEAR) · 헤매다 돌 곁에 닿는 곳(CLOUD_STONE_GAP)은 빈자리보다 먼저 거른다 — 걸리지
 * 않는 곳이 하나도 없을 때만 덜 걸리는 곳
 */
function cloudHome(b: Body, w: number, h: number, taken: Body[]): Pt2 {
  const [rx, ry] = floatR(b, w, h);
  const x0 = b.hw + rx, x1 = w - b.hw - rx;
  const y0 = b.hh + ry + CLOUD_MARGIN * h, y1 = CLOUD_ZONE * h - b.hh - ry;
  const others = taken.filter((o) => o !== b && o.kind === 'cloud' && o.home);
  let best: Pt2 = [0.5, 0.5], most = -Infinity;
  for (let t = 0; t < 30; t++) {
    const x = x1 < x0 ? w / 2 : x0 + Math.random() * (x1 - x0);
    const y = y1 < y0 ? (y0 + y1) / 2 : y0 + Math.random() * (y1 - y0);
    const home: Pt2 = [x / w, y / h], hit = homeHits(b, home, w, h, taken) + stoneHits(b, home, w, h, taken);
    // 몰림 — 이 자리에서 헤매는 곳에 걸치는 몸의 수(짝은 빼고). 하나까지는 그대로, 둘부터 한 몸마다 크게 깎는다
    // (구름끼리는 아래 틈으로 잰다 — 여기서는 나무 · 새 · 박쥐 · 돌만)
    const crowd = crowdAt([x - b.hw - rx, y - b.hh - ry, x + b.hw + rx, y + b.hh + ry], taken, w, h, (q) => q === b || q.kind === 'cloud');
    // 두 상자 사이의 틈(벽 높이의 비율) — 가장자리끼리의 거리, 겹치면 음수. 전에는 제 크기의 몇 배인가로 쟀는데(0~1 = 맞닿음), 납작한
    // 구름끼리는 위아래로 조금만 떨어져도 '멀다'가 되어 하늘 한쪽에 구름 셋이 층층이 쌓였다(2026-10-01, 몰림을 재다가 봤다)
    const gap = (o: Body) => {
      const dx = Math.abs(o.home![0] * w - x) - (o.hw + b.hw), dy = Math.abs(o.home![1] * h - y) - (o.hh + b.hh);
      return (dx > 0 || dy > 0 ? Math.hypot(Math.max(0, dx), Math.max(0, dy)) : Math.max(dx, dy)) / h;
    };
    const apart = hit > 0 ? -1e6 - hit : Math.min(1e9, ...others.map(gap)) - 100 * Math.max(0, crowd - 1);
    if (apart > most) { most = apart; best = home; }
  }
  return best;
}
/** 헤매는 가로 · 세로 반지름(px). 좁은 창(폰으로 연 벽)에서는 구름이 벽 밖으로 안 나가게 들어갈 만큼만 */
function floatR(b: Body, w: number, h: number): Pt2 {
  const rx = Math.min(FLOAT_U * b.u, Math.max(0, w / 2 - b.hw));
  return [rx, Math.min(FLOAT_RY * rx, Math.max(0, ((CLOUD_ZONE - CLOUD_MARGIN) * h) / 2 - b.hh))];
}
/** 지금 이 구름이 가 있을 곳(px) — 제 자리 둘레의 느린 헤맴 */
function floatAt(b: Body, w: number, h: number, sec: number): Pt2 {
  const [hx, hy] = b.home ?? [0.5, 0.5], [rx, ry] = floatR(b, w, h), P = FLOAT_LOOP * hold();
  return [hx * w + rx * Math.sin((2 * Math.PI * sec) / P + b.sway),
          hy * h + ry * Math.sin((2 * Math.PI * sec) / (P * FLOAT_Y_RATIO) + b.flutter * 2 * Math.PI)];
}

// ─── 돌 (차분한) — 떨어져 바닥에 앉고 서로 기대 쌓인다 (2026-09-27, 2026-10-01 물리 라이브러리로) ──────────
// design/landscape.md '돌'. 9/27부터 손으로 짠 계산이었다(상자 → 실제 윤곽으로 부딪힘, 쿵 · 흔들림 · 받침을 잃으면 미끄러짐).
// 사진 돌이 되며 디자이너가 '돌끼리 부딪히고 얹히는 것이 자연스러운가'를 물었고, 움직이는 견본(landscape-stone-photo-entrance.html)에서
// 물리 라이브러리(matter-js)로 진짜로 구르고 기대는 것을 골랐다(2026-10-01). 값은 그 견본의 '무거움'(1920×1080에서 고른 값 —
// 다른 크기의 벽에서는 높이에 비례). 돌끼리만 이 계산을 쓰고, 나무 · 구름 · 새와의 규칙은 전처럼 이 파일의 계산이 맡는다.
/** 무거움 — 중력(벽 높이 1080px에서) · 되튐 · 마찰(미끄러질 때 · 멈춰 있을 때) · 공기 저항 · 밀도 */
const STONE_G = 2.0;
const STONE_BOUNCE = 0.02;
const STONE_FRICTION: readonly [number, number] = [0.9, 1.5];
const STONE_AIR = 0.02;
const STONE_DENSITY = 0.004;
/** 땅에 묻힌 아랫부분 — 윗선을 밑변에 비춰 뒤집고 돌 키의 이만큼으로 눌렀다(디자이너, 격자: 거울 20 · 35 · 50% · 둥근 배).
    바닥은 돌의 윗부분하고만 닿고 아랫부분은 바닥을 지나 화면 아래에 묻힌다 — 바닥에 앉은 돌은 전처럼 밑이 곧게 붙고, 다른 돌에
    얹히거나 구르면 아랫부분이 드러난다(디자이너 — "안 보이던 돌의 아랫부분이 보여지는 게 자연스럽잖아"). 돌끼리는 아랫부분까지 닿는다 */
const STONE_BELLY = 0.35;
/** 기대는 한도 — 평소엔 돌이 이 각도까지만 기대고, 넘어가려 하면 되돌리는 힘이 커진다(쌓여도 글이 뒤집히지 않게). 15 · 25 · 35°를
    견본에서 보고 골랐다(디자이너). 큰 돌에 휩쓸려 나가는 돌은 풀린다(free) — 화면 밖으로 나가는 중이다.
    글은 돌과 함께 돈다(디자이너) — 9/29의 '돌을 굴려 제 변으로 눕히기'를 버린 이유(벽이 글 각도를 바꾼다)를 이번에 디자이너가 풀었다 */
const STONE_LEAN = (25 * Math.PI) / 180;
const STONE_RIGHT = 9;
/** 떠다니는 말보다 몇 배 무거운가 — 돌에 부딪힌 말은 튕겨 나간다(stoneAndFloater) */
const STONE_MASS = 8;
/** 물리 계산의 한 걸음(ms) — 견본과 같은 박자. 한 프레임에 많아야 세 걸음 */
const STONE_STEP = 1000 / 60;

type StoneWorld = { engine: Matter.Engine; walls: Matter.Body[]; w: number; h: number; acc: number;
  /** 옆벽을 걷었나(큰 돌이 풍경을 쓸어 낼 때 — 밀린 돌이 화면 밖으로 나가게) · 지금 세워진 벽이 어느 쪽인가 */
  open: boolean; built: boolean | null };
/** 바닥 × 아랫부분 짝을 부딪힘 목록에서 뺀다 — 라이브러리는 몸 하나의 조각마다 거르는 칸이 없어서, 찾은 부딪힘을 한 번 거른다 */
let BELLY_SKIP = false;
function skipBellyOnFloor() {
  if (BELLY_SKIP) return;
  BELLY_SKIP = true;
  const find = Matter.Detector.collisions;
  const skip = (a: Matter.Body, b: Matter.Body) => (a.label === 'floor' && b.label === 'belly') || (b.label === 'floor' && a.label === 'belly');
  Matter.Detector.collisions = (d: Matter.Detector) => find(d).filter((c) => !skip(c.bodyA, c.bodyB));
}
function stoneWorld(): StoneWorld {
  skipBellyOnFloor();
  const engine = Matter.Engine.create({ enableSleeping: true, positionIterations: 10, velocityIterations: 8 });
  return { engine, walls: [], w: 0, h: 0, acc: 0, open: false, built: null };
}
/** 바닥 · 옆벽 — 벽(창) 크기가 바뀌면 다시. 중력은 벽 높이에 비례(견본은 1080px) */
function stoneBounds(W: StoneWorld, w: number, h: number) {
  if (W.w === w && W.h === h && W.built === W.open) return;
  for (const q of W.walls) Matter.Composite.remove(W.engine.world, q);
  W.walls = [Matter.Bodies.rectangle(w / 2, h + 100, w * 8, 200, { isStatic: true, friction: 1, label: 'floor' })];
  if (!W.open) W.walls.push(Matter.Bodies.rectangle(-100, h / 2, 200, h * 4, { isStatic: true }), Matter.Bodies.rectangle(w + 100, h / 2, 200, h * 4, { isStatic: true }));
  Matter.Composite.add(W.engine.world, W.walls);
  W.engine.gravity.y = (STONE_G * h) / 1080;
  W.w = w; W.h = h; W.built = W.open;
}
/** 돌의 윤곽(밑변이 가장 아래의 곧은 변) → 보이는 윗사슬(밑변 한 끝 → 윗선 → 다른 끝)과 땅에 묻힌 아랫부분. 밑변이 곧지
    않으면(기하 돌 — photo를 지웠을 때) 아랫부분이 없다 */
function stoneBelly(pts: readonly (readonly [number, number])[]): { chain: Pt2[]; belly: Pt2[] } {
  const n = pts.length, yb = Math.max(...pts.map((p) => p[1])), on = (p: readonly [number, number]) => p[1] > yb - 1e-3;
  let i = 0;
  while (i < n && !(on(pts[i]) && on(pts[(i + 1) % n]))) i++;
  if (i === n) return { chain: pts.map((p): Pt2 => [p[0], p[1]]), belly: [] };
  const chain: Pt2[] = [];
  for (let k = 1; k <= n; k++) { const p = pts[(i + k) % n]; chain.push([p[0], p[1]]); }
  const belly = chain.slice(1, -1).reverse().map(([x, y]): Pt2 => [x, yb + (yb - y) * STONE_BELLY]);
  return { chain, belly };
}
/** 돌 한 개의 몸 — 윗부분 · 아랫부분 두 조각을 한 몸으로. 점은 상자 가운데 기준 px. 돌려주는 mc = 상자 가운데가 무게중심에서
    떨어진 거리(돌기 전) — 자리를 읽고 쓸 때 이만큼 돌려서 더한다 */
function stoneBodyOf(chain: Pt2[], belly: Pt2[], x: number, y: number): { mb: Matter.Body; mc: Pt2 } {
  const part = (poly: Pt2[], label: string) => {
    const hv = convexHull(poly).map(([a, b]) => ({ x: a, y: b })), c = Matter.Vertices.centre(hv);
    return Matter.Bodies.fromVertices(c.x, c.y, [hv], { label });
  };
  const parts = [part(chain, 'top')];
  if (belly.length) parts.push(part([chain[0], ...belly, chain[chain.length - 1]], 'belly'));
  const mb = Matter.Body.create({ parts, restitution: STONE_BOUNCE, friction: STONE_FRICTION[0], frictionStatic: STONE_FRICTION[1], frictionAir: STONE_AIR, sleepThreshold: 40 });
  Matter.Body.setDensity(mb, STONE_DENSITY);
  const mc: Pt2 = [-mb.position.x, -mb.position.y];
  Matter.Body.setPosition(mb, { x: x - mc[0], y: y - mc[1] });
  return { mb, mc };
}
/** 상자 가운데(px) ↔ 몸의 무게중심 — 돌아간 만큼 mc를 돌려 더한다 */
function stoneCenter(b: Body): Pt2 {
  const m = b.mb!, c = Math.cos(m.angle), s = Math.sin(m.angle), [dx, dy] = b.mc!;
  return [m.position.x + dx * c - dy * s, m.position.y + dx * s + dy * c];
}
/** 돌들의 한 걸음 — 기대는 한도를 넘은 돌은 되돌리고(휩쓸려 나가는 돌은 빼고), 정해진 박자로 걷고, 자리 · 각도를 몸(Body)에 옮긴다 */
function stepStones(W: StoneWorld, bodies: Body[], dt: number) {
  W.acc = Math.min(W.acc + dt * 1000, STONE_STEP * 3);
  while (W.acc >= STONE_STEP) {
    for (const b of bodies) {
      const m = b.mb;
      if (!m || m.isStatic || b.free) continue;
      const a = Math.atan2(Math.sin(m.angle), Math.cos(m.angle));
      if (Math.abs(a) <= STONE_LEAN) continue;
      Matter.Body.setAngularVelocity(m, m.angularVelocity * 0.9 - (a - Math.sign(a) * STONE_LEAN) * STONE_RIGHT / 60);
      if (m.isSleeping) Matter.Sleeping.set(m, false);
    }
    Matter.Engine.update(W.engine, STONE_STEP);
    W.acc -= STONE_STEP;
  }
  for (const b of bodies) if (b.mb) { [b.x, b.y] = stoneCenter(b); b.a = b.mb.angle; b.vx = b.mb.velocity.x * 60; b.vy = b.mb.velocity.y * 60; }
}

// ─── 차분한의 발화 — 큰 돌이 밀려와 풍경을 쓸어 낸다 (2026-10-01) ─────────
// 다른 성격은 검정이 깔리고 큰 상자가 선다(WallShowMessage). 차분한은 검정 없이 화면 80%의 큰 돌이 왼쪽에서 바닥을 따라 천천히
// 밀려 들어오고, 그 앞의 풍경(돌 · 구름 · 나무 · 새)이 오른쪽 밖으로 휩쓸려 나간다. 30초가 되거나 폰을 빼면 큰 돌이 조금 물러났다가
// 스르륵 밀려 나가고, 풍경이 제자리로 스며들며 그 글의 돌이 빈 바닥에 '뚜둔' 앉는다. 움직이는 견본(landscape-stone-photo-entrance.html)
// 에서 디자이너가 골랐다 — 내려앉기 · 굴러오기는 탈락, 처음 판(물리에 던져 굴린 큰 돌)은 '경박하다', 굴러 나가기는 '밀어서 나가기'로.
// 큰 돌은 정해진 길로 움직이고(물리에 던지지 않는다) 다른 돌은 그 몸에 밀려 물리로 굴러 나간다.
/** 큰 돌 — 화면 가로 · 세로의 이만큼 안에 드는 가장 큰 크기(디자이너 — "화면의 80%를 차지해도 된다") */
const CALM_SIZE = 0.8;
/** 밀려오기(초, 끝으로 갈수록 느려진다) · 퇴장: 물러나는 거리(벽 높이의 비율, 1080px에서 50px) · 시간(초) · 미끄러져 나가는 시간(초) */
const CALM_IN = 6.5;
const CALM_BACK = 50 / 1080;
const CALM_BACK_T = 1.0;
const CALM_GLIDE = 5.5;
/** 풍경이 제자리로 스며드는 시간(초) · 그 글의 돌이 떨어지는 때(복귀 시작부터, 초) · 떨어지는 높이(벽 높이의 비율) */
const CALM_RETURN = 1.6;
const CALM_DROP = 1.2;
const CALM_DROP_H = 70 / 1080;
/** 휩쓸림 — 큰 돌 앞 이만큼(벽 높이의 비율) 안에 들면 밀려나기 시작한다. 돌은 미끄럽게 굴러 나가는 빠르기(1080px에서 px/걸음,
    안쪽 → 바깥쪽), 구름 · 나무 · 새는 바람에 밀리듯 빨라진다(벽 높이 / 초²) */
const SWEEP_AHEAD = 450 / 1080;
const SWEEP_ROLL: readonly [number, number] = [6, 10];
const SWEEP_WIND = 260 / 1080;
/** 새 · 박쥐는 쓸리지 않고 날아간다(디자이너 — "날갯짓하면서 날아가게") — 큰 돌 앞 이만큼(벽 높이의 비율) 안에 들면 가까운
    새부터 날아올라(먼 새일수록 이 초 안에서 늦게, 무작위를 섞어) 오른쪽 위 화면 밖으로. 처음 빠르기(오른쪽, 위 — 박쥐는 떨어지며 시작한다) ·
    오른쪽으로 붙는 가속 · 가장 빠른 빠르기(벽 높이 / 초, / 초²) · 솟는 빠르기가 잦아들어 머무는 값(벽 높이 / 초)과 그 빠르기
    (1 / 초 — 박쥐는 이 값으로 떨어지다 솟는다) */
const FLEE_AHEAD = 700 / 1080;
const FLEE_DELAY = 0.6;
const FLEE_V0: readonly [number, number] = [0.1, 0.35];
const FLEE_PUSH = 0.5;
const FLEE_MAX = 0.8;
const FLEE_CLIMB = 0.12;
const FLEE_EASE = 1.2;

type Calm = {
  id: string; phase: 'enter' | 'hold' | 'exit' | 'return'; t0: number;
  /** 큰 돌의 배율(벽의 한 변에 대해) · 물리 몸 · 반폭 · 반높이 · 퇴장을 시작한 자리(px) */
  G: number; giant: { mb: Matter.Body; mc: Pt2; hw: number; hh: number } | null; x0: number;
  /** 등장 전 풍경의 자리(상자 가운데 px · 각도) — 복귀 때 그대로 되돌린다 */
  snap: Map<string, { x: number; y: number; a: number }> | null;
  /** 복귀의 스며듦(0~1) · 그 글의 돌을 떨어뜨렸나 · 끝났나(정리할 차례) */
  fade: number; dropped: boolean; done: boolean;
};
const easeOut3 = (t: number) => 1 - (1 - t) ** 3;
const easeInOut3 = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

/** 돌 몸을 상자 가운데 (x, y) · 각도 a에 둔다 — 무게중심은 mc를 돌려 뺀 곳 */
const setAngleV = Matter.Body.setAngle as unknown as (b: Matter.Body, a: number, updateVelocity?: boolean) => void;
const setPositionV = Matter.Body.setPosition as unknown as (b: Matter.Body, p: Matter.Vector, updateVelocity?: boolean) => void;
function placeStone(mb: Matter.Body, mc: Pt2, x: number, y: number, a: number, updateVelocity = false) {
  const c = Math.cos(a), s = Math.sin(a);
  setAngleV(mb, a, updateVelocity);
  setPositionV(mb, { x: x - (mc[0] * c - mc[1] * s), y: y - (mc[0] * s + mc[1] * c) }, updateVelocity);
}
/** 큰 돌이 바닥(윗부분의 가장 낮은 점 = 벽 아래)에 닿는 상자 가운데 높이(각도 0) */
function giantGroundY(g: NonNullable<Calm['giant']>, h: number): number {
  const top = g.mb.parts.find((q) => q.label === 'top') ?? g.mb;
  let low = -Infinity;
  for (const v of top.vertices) low = Math.max(low, v.y);
  return h - (low - (g.mb.position.y + g.mc[1]));
}
/** 그 글의 돌이 떨어질 빈 바닥 — 등장 전 바닥에 앉아 있던 돌들의 폭을 피해 가장 넓은 틈의 가운데. 틈이 없으면 가운데쯤 아무 데나(얹힌다) */
function calmSpot(C: Calm, map: Map<string, Body>, hw: number, w: number, h: number): number {
  const spans: [number, number][] = [];
  for (const [id, p] of C.snap ?? []) { const b = map.get(id); if (b?.heavy && p.y + b.hh > h - 8) spans.push([p.x - b.hw, p.x + b.hw]); }
  spans.sort((a, b) => a[0] - b[0]);
  let best: [number, number] | null = null, at = 0;
  for (const [a, b] of [...spans, [w, w] as [number, number]]) {
    if (a - at >= 2 * hw + 20 && (!best || a - at > best[1] - best[0])) best = [at, a];
    at = Math.max(at, b);
  }
  return best ? (best[0] + best[1]) / 2 : w * (0.25 + 0.5 * Math.random());
}
/** 새 · 박쥐가 날아간다 — 저마다 늦는 만큼(c.t0까지)은 제자리에 앉아 있다가 날갯짓하며 오른쪽 위로(b.sv = 날아올랐나).
    큰 돌 가까이(제 폭 둘 안)에서 날아오르면 큰 돌보다 조금 빨리 앞질러 난다 — 큰 돌은 맨 처음이 가장 빨라 벽 왼쪽 끝의
    새가 덮였다(새는 풍경과 한 겹이라 큰 돌 뒤에 그려진다). edge = 큰 돌의 오른쪽 끝(px) · edgeV = 그 빠르기(px/초).
    앉을 자리(c.spot)는 그대로 둔다 — 복귀 때 제자리로 돌아와 앉는다. 화면 밖으로 나가면 away */
function fleeStep(b: Body, w: number, h: number, dt: number, now: number, edge: number, edgeV: number) {
  const c = b.cr!;
  if (now < c.t0) return;
  const near = Math.max(0, Math.min(1, 1 - (b.x - b.hw - edge) / (4 * b.hw)));
  if (!b.sv) {
    b.sv = 1; c.mode = 'fly'; c.face = 1;
    b.vx = FLEE_V0[0] * h; b.vy = (c.geo.kind === 'bat' ? 0.5 : -1) * FLEE_V0[1] * h;
  }
  b.vx = Math.max(Math.min(FLEE_MAX * h, b.vx + FLEE_PUSH * h * dt), near * 1.15 * edgeV);
  b.vy += (-FLEE_CLIMB * h - b.vy) * Math.min(1, FLEE_EASE * dt);
  // 나는 동안의 작은 오르내림 — 평소의 날기(creatureStep)와 같은 폭 · 박자
  const f = 2 * Math.PI * 1.2, bob = 0.02 * h * f * Math.cos(f * (now - c.t0));
  b.x += b.vx * dt; b.y += (b.vy + bob) * dt;
  if (b.x - b.hw > w + 40 || b.y + b.hh < -40) b.away = true;
}
/** 풍경을 등장 전 자리로 — 휩쓸렸던 몸은 제자리 · 제 각도로, 돌은 물리 몸도 되돌려 잠재운다. 날아간 새 · 박쥐는 제자리에 다시
    앉는다. 등장 중에 들어온 몸은 지워서 다음 프레임에 다시 놓이게 한다(제자리가 없다). now = 초 */
function calmRestore(C: Calm, W: StoneWorld, map: Map<string, Body>, now: number) {
  for (const [id, b] of [...map]) {
    const p = C.snap?.get(id);
    if (id === C.id) continue;
    if (!p) { if (b.swept || b.away) { if (b.mb) Matter.Composite.remove(W.engine.world, b.mb); map.delete(id); } continue; }
    b.x = p.x; b.y = p.y; b.a = p.a; b.swept = false; b.away = false; b.sv = 0; b.free = false;
    if (b.cr) { b.vx = b.vy = 0; b.cr.mode = 'perch'; b.cr.until = now + perchFor(b.cr.geo); }
    if (b.mb) {
      Matter.Composite.remove(W.engine.world, b.mb);
      Matter.Composite.add(W.engine.world, b.mb);
      placeStone(b.mb, b.mc!, p.x, p.y, p.a);
      Matter.Body.setVelocity(b.mb, { x: 0, y: 0 }); Matter.Body.setAngularVelocity(b.mb, 0);
      b.mb.friction = STONE_FRICTION[0]; b.mb.frictionStatic = STONE_FRICTION[1];
      Matter.Sleeping.set(b.mb, true);
    }
  }
  if (C.giant) { Matter.Composite.remove(W.engine.world, C.giant.mb); C.giant = null; }
  W.open = false;
}
/**
 * 차분한 발화의 한 프레임 — 큰 돌을 짓고 정해진 길로 옮기고, 앞의 풍경을 쓸어 내고, 퇴장 · 복귀를 잇는다. 돌의 물리 걸음(step) 전에.
 * f = 그 글의 치수(크기 표), side = 벽의 한 변(px), now = 초
 */
function calmStep(C: Calm, W: StoneWorld, map: Map<string, Body>, f: Size | undefined, side: number, w: number, h: number, dt: number, now: number) {
  // 그 글의 돌 — 등장하는 동안은 물리 밖에 세워 둔다(복귀 때 떨어뜨린다)
  const own = map.get(C.id);
  if (own && !C.dropped) { if (own.mb) { Matter.Composite.remove(W.engine.world, own.mb); own.mb = null; } own.parked = true; }
  if (!C.snap) {
    C.snap = new Map();
    for (const [id, b] of map) if (id !== C.id) C.snap.set(id, { x: b.x, y: b.y, a: b.a });
    W.open = true;
  }
  if (!C.giant && f?.chain && C.phase !== 'return') {
    const hw = (C.G * side * f.w) / 2, hh = (C.G * side * f.h) / 2;
    const off = ([u, v]: Pt2): Pt2 => [(u - 0.5) * 2 * hw, (v - 0.5) * 2 * hh];
    const { mb, mc } = stoneBodyOf(f.chain.map(off), (f.belly ?? []).map(off), -hw, h - hh);
    Matter.Body.setStatic(mb, true);
    C.giant = { mb, mc, hw, hh };
    Matter.Composite.add(W.engine.world, mb);
  }
  const g = C.giant, t = now - C.t0, k = h / 1080;
  // 큰 돌의 자리 — 등장: 왼쪽 밖에서 가운데까지(끝으로 갈수록 느리게). 퇴장: 물러났다가 오른쪽 밖으로 스르륵
  if (g) {
    let x = w / 2;
    if (C.phase === 'enter') { const e = easeOut3(Math.min(1, t / CALM_IN)); x = -g.hw + (w / 2 + g.hw) * e; if (t >= CALM_IN) { C.phase = 'hold'; C.t0 = now; } }
    else if (C.phase === 'exit') {
      if (Number.isNaN(C.x0)) C.x0 = g.mb.position.x + g.mc[0];
      const back = CALM_BACK * h;
      x = t < CALM_BACK_T ? C.x0 - back * easeInOut3(t / CALM_BACK_T) : C.x0 - back + (w + g.hw - C.x0 + back + 60) * Math.min(1, (t - CALM_BACK_T) / CALM_GLIDE) ** 2.2;
    }
    placeStone(g.mb, g.mc, x, giantGroundY(g, h), 0, true);
    if (C.phase === 'exit' && x - g.hw > w + 40) {
      calmRestore(C, W, map, now);
      C.phase = 'return'; C.t0 = now;
    }
  }
  // 휩쓸림 — 큰 돌 앞에 든 것부터(등장 절반이 지나면 모두) 오른쪽 밖으로. 돌은 미끄럽게 굴러, 나머지는 바람에 밀리듯
  if ((C.phase === 'enter' || C.phase === 'hold') && g) {
    const edge = g.mb.bounds.max.x, front = edge + SWEEP_AHEAD * h, late = C.phase === 'hold' || t > CALM_IN / 2;
    // 큰 돌 오른쪽 끝의 빠르기(px/초) — 등장의 감속 곡선(easeOut3)을 미분한 것
    const edgeV = C.phase === 'enter' ? ((w / 2 + g.hw) * 3 * (1 - Math.min(1, t / CALM_IN)) ** 2) / CALM_IN : 0;
    for (const [id, b] of map) {
      if (id === C.id || b.away) continue;
      // 새 · 박쥐 — 큰 돌이 닿기 전에 날아오른다. 가까운 새부터 — 늦는 만큼은 큰 돌에서 먼 만큼(날던 새는 곧장)
      if (b.cr) {
        if (!b.swept && (late || b.x - b.hw < front + FLEE_AHEAD * h)) {
          const far = Math.max(0, Math.min(1, (b.x - b.hw - edge) / (FLEE_AHEAD * h)));
          b.swept = true; b.sv = 0; b.cr.t0 = now + (b.cr.mode === 'fly' ? 0 : FLEE_DELAY * far * (0.5 + 0.5 * Math.random()));
        }
        if (b.swept) fleeStep(b, w, h, dt, now, edge, edgeV);
        continue;
      }
      if (!b.swept && (late || b.x - b.hw < front)) {
        b.swept = true; b.sv = 0;
        if (b.mb) {
          b.free = true; b.mb.friction = 0.04; b.mb.frictionStatic = 0.05;
          Matter.Sleeping.set(b.mb, false);
          Matter.Body.setAngularVelocity(b.mb, 0.02 + 0.02 * Math.random());
        }
      }
      if (!b.swept) continue;
      if (b.mb) {
        Matter.Sleeping.set(b.mb, false);
        const want = (SWEEP_ROLL[0] + (SWEEP_ROLL[1] - SWEEP_ROLL[0]) * Math.max(0, Math.min(1, b.x / w))) * k;
        if (b.mb.velocity.x < want) Matter.Body.setVelocity(b.mb, { x: b.mb.velocity.x + 0.45 * k, y: b.mb.velocity.y });
      } else {
        b.sv = (b.sv ?? 0) + SWEEP_WIND * h * dt;
        b.x += b.sv * dt;
      }
      if (b.x - b.hw > w + 40) { b.away = true; if (b.mb) Matter.Composite.remove(W.engine.world, b.mb); }
    }
  }
  // 복귀 — 풍경이 스며들고, 그 글의 돌이 빈 바닥에 떨어진다
  if (C.phase === 'return') {
    C.fade = Math.min(1, t / CALM_RETURN);
    if (!C.dropped && t >= CALM_DROP && own) {
      C.dropped = true; own.parked = false; own.a = 0;
      own.x = calmSpot(C, map, own.hw, w, h); own.y = h - own.hh - CALM_DROP_H * h;
    }
    if (C.dropped && t >= Math.max(CALM_RETURN, CALM_DROP) + 0.4) C.done = true;
  }
}

/**
 * 이 글이 쓰는 틀 — 최대 영역 한 변에 대한 **비율**로.
 *
 * 잔상과 강조가 같은 값을 쓴다. 둘의 차이는 곱하는 한 변뿐이라
 * (--echo-side · --big-side) 내려앉을 때 배율 하나로 포개진다.
 */
function cloudOf(msg: StoredMessage): { lines: string[]; cloud: Cloud; box: Boxed } {
  const lines = linesFor(msg.text, msg.tone);   // 한 줄 12자 — 모든 성격(cloud.ts)
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
 *  구름은 제 자리(cloudHome)를 받아 그 헤맴의 지금 자리에 나타난다 — 벽을 가로지르며 들어오지 않는다.
 *  글자끼리는 겹치지 않게 고른다(TEXT_CLEAR): 나무는 다른 나무의 글 · 돌 글의 띠 · 구름 글줄이 헤매는 곳을, 돌은 제 글의
 *  띠가 나무 글에 안 걸리게, 떠다니는 말은 나무 글의 기둥을 피해. 여럿을 뽑아 걸리지 않는 첫 자리, 없으면 가장 덜 걸리는 자리.
 *  글 둘에 하나꼴(o.pair < PAIR_ODDS)은 그보다 먼저 짝 옆 자리를 찾는다 — 돌은 나무 옆, 나무는 돌 옆, 구름은 짝 구름 옆
 *  (pairCloud). 좁은 쪽 폭의 PAIR_OVER만큼(o.over가 고른다) 포개지되 글자는 비키는 자리.
 *  u = 구름의 글자 한 칸(px) — 헤매는 영역의 크기가 거기 걸려 있다. tx = 글 상자(상자에 대한 비율) */
function spawn(r: number, hw: number, hh: number, kind: Kind, w: number, h: number, taken: Body[],
  o: { tall: number; u: number; tx: Rect | null; pair: number; over: number; bg: RGB; fg: RGB; perch?: Pt2[]; cr?: CrGeo }): Body {
  const { tall, u, tx, over } = o, heavy = kind === 'stone', zones = zonesOf(taken), seek = o.pair < PAIR_ODDS;
  const still = { held: false, heavy, a: 0, va: 0, r, hw, hh, poly: null, kind, tall, home: null,
    sway: Math.random() * Math.PI * 2, flutter: Math.random(), u: 0, chars: [], side: 0, tx, zone: null,
    lead: null, rel: [0, 0] as Pt2, bg: o.bg, fg: o.fg, perch: o.perch ?? null, cr: null };
  // 새 · 박쥐 — 앉을(매달릴) 자리에 앉은 채 나타난다. 자리가 없으면 벽 위쪽에서 날며 찾는다(creatureStep)
  if ((kind === 'bird' || kind === 'bat') && o.cr) {
    const b: Body = { ...still, x: w / 2, y: h / 3, vx: 0, vy: 0 };
    b.cr = { geo: o.cr, mode: 'perch', spot: null, until: 0, from: [0, 0], t0: 0, dur: 1, face: Math.random() < 0.5 ? 1 : -1, arc: 1,
      t0s: {}, next: {}, hopTurn: false, lookFor: 0, box: null };
    const sp = pickSpot(b, taken, w, h), P = sp && spotPoint(sp, taken);
    if (sp && P) { b.cr.spot = sp; placeAt(b, P); b.cr.box = crBox(b, P); b.cr.until = performance.now() / 1000 + perchFor(o.cr); }
    else placeAt(b, [crRnd(hw, w - hw), crRnd(0.15, 0.4) * h]);
    return b;
  }
  if (kind === 'tree') {
    const y = h - Math.max(tall * h, 2 * hh) + hh;
    const at = (x: number): Body => ({ ...still, x, y, vx: 0, vy: 0, zone: tx ? zoneAt(x, y, hw, hh, tx, h) : null });
    // 이 자리에서 부딪치는 양 — 다른 나무와(글자끼리 · 읽히지 않는 글자와 몸) · 돌과(stoneTreeBands) · 구름 글줄이 헤매는
    // 곳과 글자끼리. 0이어야 한다
    const hitAt = (x: number) => {
      const me = at(x), z = me.zone;
      let hit = 0;
      if (z) for (const q of taken) {
        if (q.kind === 'tree') hit += clashArea(me, q, h);
        else if (q.kind === 'stone') for (const [a, c] of stoneTreeBands(q, me, h)) hit += spanOverlap(a[0], a[1], c[0], c[1]) * (z[3] - z[1]);
        else if (q.kind === 'cloud' && q.home) hit += overlapArea(z, lettersWander(q, q.home, w, h));
      }
      return hit;
    };
    // 짝 — 돌 옆에 좁은 쪽 폭의 35~60%만큼 걸쳐 선다
    if (seek) for (const ov of oversFrom(over)) for (const s of shuffled(taken.filter((q) => q.kind === 'stone'))) for (const dir of shuffled([1, -1])) {
      const x = besideX(s, hw, ov, dir);
      if (x >= hw && x <= w - hw && hitAt(x) === 0) return at(x);
    }
    // 숲 — 이미 선 나무 곁에 걸쳐 선다(TREE_GROVE). 무리는 둘까지 — 이미 곁에 나무가 걸친 나무에는 더 붙지 않는다(곁에 곁에
    // 붙다 다섯 그루가 한곳에 겹겹이 뭉쳤다, 2026-10-01)
    const trees = taken.filter((q) => q.kind === 'tree');
    const lean = (a: Body, b: Body) => Math.abs(a.x - b.x) < (a.hw + b.hw) * 0.9;
    const alone = trees.filter((t) => !trees.some((q) => q !== t && lean(q, t)));
    if (alone.length && Math.random() < TREE_GROVE) for (const t of shuffled(alone)) for (const dir of shuffled([1, -1])) {
      const x = besideX(t, hw, TREE_NEAR[0] + Math.random() * (TREE_NEAR[1] - TREE_NEAR[0]), dir);
      const others = trees.filter((q) => q !== t && Math.abs(q.x - x) < (q.hw + hw) * 0.9).length;
      if (x >= hw && x <= w - hw && others === 0 && hitAt(x) === 0 && crowdAt([x - hw, y - hh, x + hw, y + hh], taken, w, h, (q) => q.kind === 'tree' || q.kind === 'stone') <= 1) return at(x);
    }
    let bx = w / 2, least = Infinity;
    for (let t = 0; t < 40 && least > 0; t++) {
      const x = hw + Math.random() * Math.max(1, w - hw * 2), hit = hitAt(x);
      // 글 자리가 안 걸리는 것이 먼저, 그다음 다른 나무와 한자리에 포개지지 않기(거의 같은 자리만 — TREE_STACK),
      // 그다음 몰림 — 수관(상자)에 구름 · 새 · 박쥐가 둘 넘게 걸리는 자리는 한 몸마다 깎는다(하나는 나무가 구름을 뚫는 것)
      const stack = trees.some((q) => Math.abs(q.x - x) < (q.hw + hw) * TREE_STACK) ? 1 : 0;
      // 빈자리에 설 때는 다른 나무에 걸치는 만큼 조금씩 깎는다 — 무리는 위의 '숲'이 짓는다
      const lap = trees.filter((q) => Math.abs(q.x - x) < (q.hw + hw) * 0.9).length;
      const pile = crowdAt([x - hw, y - hh, x + hw, y + hh], taken, w, h, (q) => q.kind === 'tree' || q.kind === 'stone');
      const score = hit > 0 ? 1e6 + hit : stack + 0.5 * Math.max(0, pile - 1) + 0.3 * lap;
      if (score < least) { least = score; bx = x; }
    }
    return at(bx);
  }
  if (kind === 'cloud') {
    const b: Body = { ...still, u, x: 0, y: 0, vx: 0, vy: 0 };
    if (seek) pairCloud(b, w, h, taken, over);
    if (!b.home) b.home = cloudHome(b, w, h, taken);
    [b.x, b.y] = cloudTarget(b, w, h, performance.now() / 1000);
    return b;
  }
  if (heavy) {
    const y = hh + Math.random() * Math.max(1, h / 3 - hh);
    // 나무와 가로로 떨어져 있어야 할 띠가 걸리는 양(stoneTreeBands) · 다른 돌 위인가(그러면 그 위에 쌓인다)
    const trees = taken.filter((q) => q.kind === 'tree');
    const inText = (x: number) => { const me: Body = { ...still, x, y, vx: 0, vy: 0 }; let s = 0;
      for (const t of trees) for (const [a, c] of stoneTreeBands(me, t, h)) s += spanOverlap(a[0], a[1], c[0], c[1]);
      return s; };
    const onStone = (x: number) => taken.some((q) => q.heavy && Math.abs(q.x - x) < q.hw + hw);
    // 짝 — 나무 옆에 좁은 쪽 폭의 35~60%만큼 걸쳐 바닥에 앉는다
    if (seek) for (const ov of oversFrom(over)) for (const t of shuffled(trees)) for (const dir of shuffled([1, -1])) {
      const x = besideX(t, hw, ov, dir);
      if (x >= hw && x <= w - hw && !inText(x) && !onStone(x)) return { ...still, x, y, vx: 0, vy: 0 };
    }
    // 나무 글의 띠 밖이 먼저, 그다음 다른 돌과 가로로 안 겹치는 자리
    let bx = w / 2, least = Infinity;
    for (let t = 0; t < 40 && least > 0; t++) {
      const x = hw + Math.random() * Math.max(1, w - hw * 2), hit = inText(x);
      const score = hit > 0 ? 2 + hit : onStone(x) ? 1 : 0;
      if (score < least) { least = score; bx = x; }
    }
    // 나타나는 자리가 다른 돌과 겹치면 그 돌 위로 올린다(화면 위 밖이어도 — 거기서 떨어져 들어온다). 벽이 막 켜져 열 개가
    // 한꺼번에 나타나면 위쪽 3분의 1에서 서로 겹친 채 태어났고, 물리 계산은 깊이 겹쳐 태어난 몸을 풀지 못해 파고든 채
    // 쌓였다(2026-10-01, 재서 알았다 — 겹침 깊이 35~91px)
    let by = y;
    for (let k = 0; k < taken.length; k++) {
      const hit = taken.find((q) => q.heavy && Math.abs(q.x - bx) < q.hw + hw && Math.abs(q.y - by) < q.hh + hh + 8);
      if (!hit) break;
      by = hit.y - hit.hh - hh - 8;
    }
    return { ...still, x: bx, y: by, vx: 0, vy: 0 };
  }
  const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
  const angle = Math.random() * Math.PI * 2;
  let x = 0, y = 0;
  for (let t = 0; t < 30; t++) {
    x = r + Math.random() * Math.max(1, w - r * 2);
    y = r + Math.random() * Math.max(1, h - r * 2);
    if (taken.every((b) => Math.hypot(b.x - x, b.y - y) >= b.r + r) && zones.every((z) => overlapArea([x - hw, y - hh, x + hw, y + hh], [z[0], z[1], z[2], h]) === 0)) break;
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
 * 돌끼리는 물리 라이브러리가 친다(stepStones, 2026-10-01). 돌과 말은 **돌의 실제 윤곽**으로
 * 친다(말은 상자) — 돌은 무거워서 부딪힌 말만 튕겨 나간다(STONE_MASS).
 */
function step(W: StoneWorld, bodies: Body[], w: number, h: number, dt: number, sec: number, still = false) {
  // 돌 — 먼저 걷는다. 그다음의 구름 · 새 · 나무 규칙이 돌의 지금 자리를 본다
  stoneBounds(W, w, h);
  stepStones(W, bodies, dt);
  // 나무는 가만히 선다 — 바닥에서 제 키만큼. 창이 바뀌면 같이 바뀐다. 글 자리를 먼저 적어 둔다 — 다른 것들이 비킨다
  for (const b of bodies) if (b.kind === 'tree') {
    b.y = h - treeHeight(b, h) + b.hh;
    b.zone = b.tx ? zoneAt(b.x, b.y, b.hw, b.hh, b.tx, h) : null;
  }
  const zones = zonesOf(bodies);
  for (const b of bodies) {
    // 큰 돌에 휩쓸리는 몸은 calmStep이 옮긴다(돌은 물리 계산이)
    if (b.held || b.kind === 'tree' || b.swept || b.away) continue;
    if (b.cr) { creatureStep(b, bodies, w, h, sec, still); continue; }
    if (b.kind === 'cloud') { drift(b, w, h, dt, sec, bodies); continue; }
    // 돌은 물리 계산이 움직인다(stepStones — 아래에서 먼저 걸었다)
    if (b.heavy) continue;
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
      // 새 · 박쥐는 부딪치지 않는다 — 앉을 자리를 고를 때 남의 글자 · 서로를 비킨다(spotOk)
      if (a.cr || b.cr) continue;
      if (a.kind === 'cloud' || b.kind === 'cloud') { if (a.kind === b.kind) cloudsApart(a, b, h, dt); continue; }
      // 나무는 무엇과도 부딪치지 않는다 — 돌은 그 앞에 서고, 구름 · 떠다니는 말은 겹쳐 지나간다.
      // 떠다니는 말을 머리에 튕기게 했더니 나무 머리들과 벽 끝 사이에 끼어 제자리에서 초당 600px씩
      // 튀었다(2026-09-28, 재서 알았다)
      if (a.kind === 'tree' || b.kind === 'tree') continue;
      // 돌끼리는 물리 계산이 친다. 돌과 떠다니는 말은 말만 튕긴다
      if (a.heavy && b.heavy) continue;
      if (a.heavy || b.heavy) { stoneAndFloater(a.heavy ? a : b, a.heavy ? b : a, h, dt); continue; }
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
  // 나무의 글 자리는 비워 둔다(TEXT_CLEAR) — 돌은 띠 밖으로 미끄러져 나가고, 떠다니는 말은 기둥에 튕긴다
  if (zones.length) for (const b of bodies) {
    if (b.held) continue;
    if (b.heavy && !b.free && !b.away) stoneOffText(b, bodies, w, h, dt);
    else if (b.kind === 'float') floaterOffText(b, zones, w, h);
  }
}

/**
 * 돌(s)과 나무(t)가 가로로 떨어져 있어야 할 띠들 — [돌의 띠, 나무의 띠](px). 돌은 바닥까지 떨어지고 나무는 바닥에서 서니
 * 가로로 겹치면 곧 겹친다(떨어지는 동안에도). 글끼리는 늘(돌 글의 세로 띠 ↔ 나무 글 자리), 곱해져 읽히지 않는 짝이면 글과
 * 몸도(나무 글 ↔ 돌 몸 · 돌 글 ↔ 나무 몸)
 */
function stoneTreeBands(s: Body, t: Body, h: number): [[number, number], [number, number]][] {
  if (!t.zone) return [];
  const z: [number, number] = [t.zone[0], t.zone[2]], band = bandAt(s.x, s.hw, s.tx, h), m = TEXT_CLEAR * h;
  const out: [[number, number], [number, number]][] = [[band, z]];
  if (!legible(t, s)) { const b = bodyOf(s, h); out.push([[b[0], b[2]], z]); }
  if (!legible(s, t)) out.push([band, [t.x - t.hw * TREE_BASE - m, t.x + t.hw * TREE_BASE + m]]);
  return out;
}

/**
 * 돌이 나무와 떨어져 있어야 할 띠(stoneTreeBands)에 들어와 있으면 가까운 쪽으로(벽에 막히면 반대쪽으로) 미끄러져 나간다.
 * 한 번에 옮기면 순간이동으로 보이니 말이 돌 밑에서 빠지는 빠르기(SLIP_OUT)로. 떨어질 자리는 띠 밖에서 골랐으니 여기
 * 걸리는 것은 밀리거나 받침에서 떨어진 돌이다. 그 밖의 몸은 나무 위로 걸쳐도 된다(곱해진다)
 */
function stoneOffText(b: Body, bodies: Body[], w: number, h: number, dt: number) {
  const P = outline(b);
  let l = Infinity, r = -Infinity;
  for (const p of P) { l = Math.min(l, p[0]); r = Math.max(r, p[0]); }
  for (const t of bodies) if (t.kind === 'tree') for (const [[x0, x1], [z0, z1]] of stoneTreeBands(b, t, h)) {
    if (spanOverlap(x0, x1, z0, z1) <= 0) continue;
    const toL = x1 - z0, toR = z1 - x0;
    let dir = toL <= toR ? -1 : 1;
    if (dir < 0 && b.x + l - toL < 0) dir = 1;
    else if (dir > 0 && b.x + r + toR > w) dir = -1;
    const d = dir * Math.min(dir < 0 ? toL : toR, SLIP_OUT * h * dt);
    b.x += d;
    if (b.mb) {
      Matter.Body.translate(b.mb, { x: d, y: 0 });
      if (b.mb.velocity.x * dir < 0) Matter.Body.setVelocity(b.mb, { x: 0, y: b.mb.velocity.y });
      if (b.mb.isSleeping) Matter.Sleeping.set(b.mb, false);
    } else if (b.vx * dir < 0) b.vx = 0;
  }
}

/**
 * 떠다니는 말과 나무 글 — 글 자리에서 바닥까지를 기둥으로 치고, 덜 들어간 쪽(왼 · 오른 · 위)으로 밀어내며 그쪽으로 튕긴다.
 * 아래로는 안 민다(밑은 기둥이 바닥까지다). 옆으로 밀면 벽 밖으로 나가는 쪽은 고르지 않는다 — 기둥과 벽 사이에 끼면 위로 빠진다
 */
function floaterOffText(b: Body, zones: Rect[], w: number, h: number) {
  for (const z of zones) {
    if (overlapArea([b.x - b.hw, b.y - b.hh, b.x + b.hw, b.y + b.hh], [z[0], z[1], z[2], h]) <= 0) continue;
    const toL = b.x + b.hw - z[0], toR = z[2] - (b.x - b.hw), toU = b.y + b.hh - z[1];
    const ways: [number, number][] = [[toU, 0]];
    if (b.x - toL - b.r >= 0) ways.push([toL, -1]);
    if (b.x + toR + b.r <= w) ways.push([toR, 1]);
    const [d, dir] = ways.reduce((m, q) => (q[0] < m[0] ? q : m));
    if (dir) { b.x += dir * d; b.vx = dir * Math.abs(b.vx); }
    else { b.y -= d; b.vy = -Math.abs(b.vy); }
  }
}

/**
 * 구름 한 걸음 — 제 자리 둘레를 헤매는 지금 자리(floatAt)를 느슨하게(FLOAT_FOLLOW) 따라간다. 남의 글자에서
 * 밀려났으면 같은 박자로 스르르 돌아온다. 크게 보였다 내려앉은 글도 붙잡혔던 자리에서 이 길로 이어 간다.
 * 벽 위 82% 안에서만 다닌다(창이 줄었을 때를 위해 한 번 더 막는다).
 * 새 나무가 서서 헤매는 영역이 그 글 자리에 걸리면 걸리지 않는 새 자리로 옮긴다 — 같은 박자로 스르르. 그런 자리가 없으면
 * 그대로 둔다(프레임마다 자리를 바꿔 쫓아다니지 않게).
 */
function drift(b: Body, w: number, h: number, dt: number, sec: number, bodies: Body[]) {
  // 짝 구름이 벽을 떠났으면 빈자리로 옮겨 제 헤맴을 이어 간다
  if (b.lead && !bodies.includes(b.lead)) { b.lead = null; b.home = cloudHome(b, w, h, bodies); }
  if (!b.home) b.home = cloudHome(b, w, h, bodies);
  // 새 나무의 글이 제 자리에 걸리거나 새 돌이 곁에 떨어지면 걸리지 않는 새 자리로 스르르 옮긴다(없으면 그대로)
  const bad = (home: Pt2) => homeHits(b, home, w, h, bodies) + stoneHits(b, home, w, h, bodies);
  if (!b.lead && bad(b.home) > 0) {
    const next = cloudHome(b, w, h, bodies);
    if (bad(next) === 0) b.home = next;
  }
  // 몰림 — 벽의 몸(크기를 아는 것)의 수가 바뀌었을 때만(프레임마다 쫓아다니지 않게). 제 자리에 걸친 몸이 둘 넘으면 덜 몰린
  // 새 자리로 스르르. 벽이 막 켜져 떠다니던 말들이 제 모양을 알게 되는 때도 여기 든다
  const known = bodies.reduce((n, q) => n + (q.kind === 'float' ? 0 : 1), 0);
  if (!b.lead && b.crowdSeen !== known) {
    b.crowdSeen = known;
    const pileAt = (home: Pt2) => crowdAt(wanderBox({ ...b, home }, w, h), bodies, w, h, (q) => q === b || q.lead === b);
    const here = pileAt(b.home);
    if (here > 1) { const next = cloudHome(b, w, h, bodies); if (bad(next) === 0 && pileAt(next) < here) b.home = next; }
  }
  const [tx, ty] = cloudTarget(b, w, h, sec), k = 1 - Math.exp(-dt / (FLOAT_FOLLOW * hold()));
  b.x += (tx - b.x) * k;
  b.y += (ty - b.y) * k;
  cloudOffTrees(b, bodies, h, dt);
  // 짝 구름을 따라가는 구름의 제 자리 — 다른 구름이 빈자리를 고를 때 본다
  if (b.lead?.home) b.home = [b.lead.home[0] + b.rel[0] / w, b.lead.home[1] + b.rel[1] / h];
  const top = b.hh + CLOUD_MARGIN * h, bottom = CLOUD_ZONE * h - b.hh;
  b.y = bottom < top ? (top + bottom) / 2 : Math.min(bottom, Math.max(top, b.y));
}

/**
 * 두 구름 — 튕기지 않고 겹쳐 지나간다. 한 구름의 글자 한 자가 상대 글자 한 자의 둥근 자리(LETTER_APART)에 닿을 때만,
 * 가장 깊이 닿은 곳에서 반대로 조금씩 떼어 놓는다. 글자 자리를 네모로 잡으면 휜 글은 상자가 구름을 거의 덮어 겹침이
 * 안 생겼다 — 한 자씩 잡는다. 처음엔 구슬이 남의 글자를 비켰다 — 오버프린트(PAIR_ODDS)부터는 몸이 남의 글 위로도
 * 걸치고(곱해도 글자가 읽힌다) 글자끼리 비킨다 — 곱해져 읽히지 않는 짝이면(LEGIBLE) 글줄과 몸도. 짝지어 같이 떠다니는
 * 둘은 그렇게 비켜 자리를 잡았으니 건너뛴다.
 */
function cloudsApart(a: Body, b: Body, h: number, dt: number) {
  if (a.lead === b || b.lead === a) return;
  if (Math.abs(a.x - b.x) > a.hw + b.hw || Math.abs(a.y - b.y) > a.hh + b.hh) return;
  // 곱해져 읽히지 않는 짝이면 글줄과 몸도 떼어 놓는다(반씩)
  for (const [R, Z] of clashes(a, b, h, false)) { pushOut(a, R, Z, dt, 0.5); pushOut(b, Z, R, dt, 0.5); }
  const rc = LETTER_APART * Math.max(a.u, b.u);
  let best = 0, nx = 0, ny = 0;
  for (const c of a.chars) {
    const cx = a.x + c[0], cy = a.y + c[1];
    for (const d of b.chars) {
      const dx = b.x + d[0] - cx, dy = b.y + d[1] - cy;
      if (dx > rc || dx < -rc || dy > rc || dy < -rc) continue;
      const dd = Math.hypot(dx, dy), pen = rc - dd;
      if (pen > best) { best = pen; nx = dx / (dd || 1); ny = dy / (dd || 1); }
    }
  }
  if (best <= 0) return;
  const k = Math.min(1, dt / LETTER_PUSH_S) * 0.5 * best;
  if (!a.held) { a.x -= nx * k; a.y -= ny * k; }
  if (!b.held) { b.x += nx * k; b.y += ny * k; }
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
}

// ─── 구름의 움직임 — 요소를 직접 (React 바깥) ────────────────────────────
/** 한 구름에서 움직일 요소 — 한 자씩의 글자(자리 x, u). 구슬 구름 때는 구슬 · 곁의 작은 구름도 움직였다(09-30에 걷었다) */
type CloudDom = {
  el: HTMLElement; k: number; on: boolean;
  chars: { e: HTMLElement; x: number }[];
};
function cloudDomOf(cache: Map<string, CloudDom>, id: string, el: HTMLElement, f: Size): CloudDom {
  const had = cache.get(id);
  if (had && had.el === el) return had;
  const svg = el.querySelector<SVGSVGElement>('svg.cloud-art');
  const k = svg && f.cw ? svg.viewBox.baseVal.width / f.cw : 100;            // 화판 단위 / u
  const d: CloudDom = {
    el, k, on: false,
    // 글자는 cloud.ts의 chars와 같은 차례다(띄어쓰기 빼고 줄 차례) — 자리는 거기서 읽는다
    chars: [...el.querySelectorAll<HTMLElement>('.ch')].map((e, i) => ({ e, x: (f.chars?.[i]?.[0] ?? 0) * (f.cw ?? 0) }))
  };
  cache.set(id, d);
  return d;
}
/**
 * 펄럭임 한 프레임.
 * 펄럭임은 FLUTTER_EVERY마다 한 번, 봉우리 하나가 왼쪽 밖에서 오른쪽 밖으로 FLUTTER_PASS에 지나가며
 * 그 자리의 글자를 FLUTTER_U 올렸다 내린다. 지나가는 동안만 요소를 건드린다. 평소엔 꺼 둔다(FLUTTER_ON).
 * 구슬 구름 때는 구슬도 같이 오르고 곁의 작은 구름이 오르내렸다 — 띠 구름은 사진 윤곽 하나라 글자만(2026-09-30)
 */
function cloudFrame(d: CloudDom, b: Body, f: Size, sec: number) {
  const H = hold(), every = FLUTTER_EVERY * H, pass = FLUTTER_PASS * H, cw = f.cw ?? 0;
  const tt = (((sec + b.flutter * every) % every) + every) % every, on = FLUTTER_ON && tt <= pass;
  if (on || d.on) {
    const c = -1.5 + (cw + 3) * (tt / pass);
    const wave = (x: number) => (on ? -FLUTTER_U * Math.exp(-(((x - c) / FLUTTER_WIDTH) ** 2)) : 0);
    for (const q of d.chars) q.e.style.transform = on ? `translateY(${(wave(q.x) * b.u).toFixed(2)}px)` : '';
    d.on = on;
  }
}
function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ─── 새 · 박쥐 (유머있는) — 앉았다 날았다 (2026-09-29, design/landscape.md '새' · '박쥐') ─────────
// 새는 나무 꼭대기 · 단 끝 · 나무 중턱(글 아래) · 돌 위에 앉고, 박쥐는 벽 맨 위 · 구름 밑에 매달린다(디자이너). 저마다
// 무작위로 머물다 다음 자리로 날아간다. 앉아 있는 동안은 가만히 굳지 않고 작은 몸짓을 한다 — 움직이는 견본에서 아홉 가지를
// 모두 골랐다("몸짓 자체는 모두 좋은데", "모두 반영"). 보는 방향도 제각각이다 — 한쪽으로만 서 있으니 어색했다(디자이너).
// 몸짓 · 방향은 모양에만 입힌다 — 글은 늘 바로 선다(콩콩 뛸 때 · 박쥐가 흔들릴 때만 글도 같이).
// 시간은 모두 --t-hold(T)의 배수 — hold().

/** 새 · 박쥐의 형상(형상 단위, 폰 자세 상자가 원점) — 벽이 부품을 직접 그린다 */
type CrGeo = { kind: 'bird' | 'bat'; w: number; h: number; tcx: number; tcy: number; anchor: Pt2; poses: Creature['poses']; reach: Rect; flyReach: Rect };
/** 앉는(매다는) 자리 — 나무 끝(i번째) · 나무 중턱(가운데에서 dx, 높이 y) · 돌 위(가운데에서 dx) · 벽 맨 위(x = dx) ·
    구름 밑(가운데에서 dx). i < 0은 갈 곳이 없어 떠도는 목표(dx, y) */
type Spot = { kind: 'tip' | 'mid' | 'stone' | 'ceil' | 'cloud'; host: Body | null; i: number; dx: number; y: number };
/** 새 · 박쥐의 상태 — 앉음 · 날기, 날 때는 from → spot을 t0부터 dur초. face = 보는 쪽(1 오른쪽).
    t0s · next = 몸짓마다 시작한 때 · 다음 때. box = 앉을(앉은) 자리의 상자 — 다른 새가 겹쳐 앉지 않게 */
type CrState = {
  geo: CrGeo; mode: 'perch' | 'fly'; spot: Spot | null; until: number;
  from: Pt2; t0: number; dur: number; face: 1 | -1; arc: number;
  t0s: Record<string, number | undefined>; next: Record<string, number>; hopTurn: boolean; lookFor: number; box: Rect | null;
};
/** 머무는 시간(T 배수) — 새 12~28(약 8~20초) · 박쥐 14~36(약 10~25초) */
const PERCH_BIRD: readonly [number, number] = [12, 28];
const PERCH_BAT: readonly [number, number] = [14, 36];
/** 나는 빠르기(초당 벽 높이의 비율)와 나는 시간의 범위(T 배수 — 약 2.8~4.9초) · 나는 길이 솟는 높이(거리의 비율, 더해 벽 높이 5%) */
const FLY_SPEED = 0.2;
const FLY_T: readonly [number, number] = [4, 7];
const FLY_ARC = 0.25;
/** 나는 길이 남의 글자를 가로지르면 이만큼 더 높이 솟는 길(FLY_ARC의 배수)을 차례로 본다 — 그래도 걸리면 다른 자리.
    길을 안 따졌더니 40초에 17프레임, 날며 나무 · 구름 글자를 덮고 지나갔다(벽에서 재서 알았다) */
const FLY_ARCS = [1, 2, 3.2];
/** 몸짓마다 [걸리는 시간, 다음까지 최소, 최대] — T 배수(0.63 = --t-return 둘). 견본에서 고른 그대로 */
const IDLE: Record<string, readonly [number, number, number]> = {
  tail: [0.63, 4, 10], bob: [0.63, 3, 8], hop: [1, 6, 14], fluff: [2, 7, 16], peck: [1, 7, 16], look: [3, 8, 18],
  twitch: [0.63, 4, 11], stretch: [4, 10, 26]
};
const crRnd = (a: number, b: number) => a + Math.random() * (b - a);
const bump = (x: number) => (x <= 0 || x >= 1 ? 0 : Math.sin(Math.PI * x));
const smooth01 = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x)));
const perchFor = (g: CrGeo) => crRnd(...(g.kind === 'bird' ? PERCH_BIRD : PERCH_BAT)) * hold();

/** 돌 윤곽의 윗변 높이(px) — x에서. 윤곽 밖이면 상자 위 */
function topAt(s: Body, x: number): number {
  const P = outline(s), lx = x - s.x;
  let best = Infinity;
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
    if ((ax - lx) * (bx - lx) > 0 || ax === bx) continue;
    best = Math.min(best, ay + ((by - ay) * (lx - ax)) / (bx - ax));
  }
  return s.y + (best === Infinity ? -s.hh : best);
}
/** 자리의 점(px) — 앉는(매다는) 점이 올 곳. 자리가 사라졌으면(나무 · 돌 · 구름이 벽을 떠남) null */
function spotPoint(sp: Spot, bodies: Body[]): Pt2 | null {
  if (sp.i < 0) return [sp.dx, sp.y];
  const o = sp.host;
  if (o && !bodies.includes(o)) return null;
  switch (sp.kind) {
    case 'tip': { const p = o?.perch?.[sp.i]; return o && p ? [o.x - o.hw + p[0] * 2 * o.hw, o.y - o.hh + p[1] * 2 * o.hh] : null; }
    case 'mid': return o ? [o.x + sp.dx, sp.y] : null;
    case 'stone': return o ? [o.x + sp.dx, topAt(o, o.x + sp.dx)] : null;
    case 'ceil': return [sp.dx, 0];
    case 'cloud': return o ? [o.x + sp.dx, o.y + o.hh - 0.3 * o.u] : null;
  }
}
/** 앉는 점이 P일 때 이 새(박쥐)가 차지할 수 있는 테두리(px) — 앉은 몸짓 전부(reach), fly면 나는 자세(flyReach) */
function crBox(b: Body, P: Pt2, fly = false): Rect {
  const g = b.cr!.geo, r = fly ? g.flyReach : g.reach, px = (2 * b.hw) / g.w, py = (2 * b.hh) / g.h;
  return [P[0] + (r[0] - g.anchor[0]) * px, P[1] + (r[1] - g.anchor[1]) * py, P[0] + (r[2] - g.anchor[0]) * px, P[1] + (r[3] - g.anchor[1]) * py];
}
/** 지금 앉는 점(px) · 앉는 점이 P가 되게 놓기 */
function crAnchor(b: Body): Pt2 {
  const g = b.cr!.geo;
  return [b.x - b.hw + (g.anchor[0] / g.w) * 2 * b.hw, b.y - b.hh + (g.anchor[1] / g.h) * 2 * b.hh];
}
function placeAt(b: Body, P: Pt2) {
  const g = b.cr!.geo;
  b.x = P[0] + b.hw - (g.anchor[0] / g.w) * 2 * b.hw;
  b.y = P[1] + b.hh - (g.anchor[1] / g.h) * 2 * b.hh;
}
/** 이 자리에 앉아도 되나 — 벽 안, 남의 글자(둘레 포함)를 가리지 않고, 다른 새 · 박쥐와 겹치지 않는다(지금 자리 · 가는 자리 둘 다) */
function spotOk(b: Body, P: Pt2, bodies: Body[], w: number, h: number): boolean {
  const r = crBox(b, P), m = TEXT_CLEAR * h;
  if (r[0] < 0 || r[2] > w || r[1] < -2 || r[3] > h) return false;
  for (const o of bodies) {
    if (o === b) continue;
    if (o.cr) {
      if (overlapArea(r, [o.x - o.hw, o.y - o.hh, o.x + o.hw, o.y + o.hh]) > 0) return false;
      if (o.cr.box && overlapArea(r, o.cr.box) > 0) return false;
    } else {
      const L = lettersOf(o, m);
      if (L && overlapArea(r, L) > 0) return false;
    }
  }
  return true;
}
/** 다음 자리들 — 새: 나무 끝 · 나무 중턱 · 돌 위, 박쥐: 벽 맨 위 · 구름 밑. 되는 자리를 섞어서(지금 자리는 되도록 뺀다) */
function spotsFor(b: Body, bodies: Body[], w: number, h: number): Spot[] {
  const g = b.cr!.geo, cands: Spot[] = [];
  if (g.kind === 'bird') {
    for (const o of bodies) {
      if (o.kind === 'tree') {
        (o.perch ?? []).forEach((_p, i) => cands.push({ kind: 'tip', host: o, i, dx: 0, y: 0 }));
        // 중턱 — 나무 글 아래, 벽 밑 20%(돌 자리)보다 위. 나무 앞에 선다
        const z = o.zone, lo = (z ? z[3] : o.y - o.hh) + 2 * b.hh, hi = h * 0.8;
        for (let k = 0; k < 2 && hi > lo; k++) cands.push({ kind: 'mid', host: o, i: 0, dx: crRnd(-0.3, 0.3) * o.hw, y: crRnd(lo, hi) });
      } else if (o.kind === 'stone') {
        for (const f of [-0.3, 0, 0.3]) cands.push({ kind: 'stone', host: o, i: 0, dx: f * o.hw, y: 0 });
      }
    }
  } else {
    for (let k = 0; k < 6; k++) cands.push({ kind: 'ceil', host: null, i: 0, dx: crRnd(b.hw, w - b.hw), y: 0 });
    for (const o of bodies) if (o.kind === 'cloud') for (const f of [-0.35, 0, 0.35]) cands.push({ kind: 'cloud', host: o, i: 0, dx: f * o.hw, y: 0 });
  }
  const now = b.cr!.spot;
  const ok = cands.filter((sp) => { const P = spotPoint(sp, bodies); return !!P && spotOk(b, P, bodies, w, h); });
  const fresh = ok.filter((sp) => !now || sp.host !== now.host || sp.kind !== now.kind || sp.i !== now.i);
  // 몰리지 않게 — 앉는 몸짓에 앉을 곳(나무 · 돌 · 구름) 말고 다른 몸이 안 걸리는 자리부터. 새 · 박쥐가 한 나무에 겹쳐 앉지도 않는다
  const crowd = (sp: Spot) => { const P = spotPoint(sp, bodies)!; return crowdAt(crBox(b, P), bodies, w, h, (q) => q === b || q === sp.host)
    + bodies.filter((q) => q !== b && q.cr?.spot?.host && q.cr.spot.host === sp.host).length; };
  const pool = shuffled(fresh.length ? fresh : ok).map((sp) => ({ sp, c: crowd(sp) }));
  return pool.sort((a, c) => a.c - c.c).map((x) => x.sp);
}
function pickSpot(b: Body, bodies: Body[], w: number, h: number): Spot | null {
  return spotsFor(b, bodies, w, h)[0] ?? null;
}
/**
 * 나는 길 위의 한 점(앉는 점, px) — 2차 곡선, e = 0~1. 새는 솟았다 내려앉고, 박쥐는 떨어졌다가 올라가 매달린다
 * (천장에 매달린 채 위로 솟을 수는 없다 — 솟게 뒀더니 천장을 따라 미끄러지며 날개가 화면 밖으로 잘렸다).
 * 몸 전체가 벽 안에 있게 앉는 점의 높이를 묶는다 — 새의 앉는 점은 발끝이라 0에 묶으면 몸이 통째로 화면 위로 나간다
 */
function flyAt(b: Body, from: Pt2, to: Pt2, arc: number, w: number, h: number, e: number, wob = 0): Pt2 {
  const g = b.cr!.geo, dist = Math.hypot(to[0] - from[0], to[1] - from[1]), lift = arc * FLY_ARC * dist + 0.05 * h;
  const cx = (from[0] + to[0]) / 2, cy = g.kind === 'bat' ? Math.max(from[1], to[1]) + lift : Math.min(from[1], to[1]) - lift;
  const x = (1 - e) ** 2 * from[0] + 2 * (1 - e) * e * cx + e * e * to[0], y = (1 - e) ** 2 * from[1] + 2 * (1 - e) * e * cy + e * e * to[1] + wob;
  // 나는 자세의 테두리가 벽 안에 들게 — 앉는 점에서 네 변까지(px). 날아오르고 내려앉는 끝점은 앉은 자리 그대로
  const r = crBox(b, [0, 0], true), k = Math.min(1, 8 * e, 8 * (1 - e));
  const cl = (v: number, lo: number, hi: number) => (lo > hi ? v : Math.min(hi, Math.max(lo, v)));
  return [x + (cl(x, -r[0], w - r[2]) - x) * k, y + (cl(y, -r[1], h - r[3]) - y) * k];
}
/** 이 길로 날면 남의 글자(둘레 포함)를 몇 번 가로지르나 — 길 위 16점에서 몸 상자로 */
function pathHits(b: Body, from: Pt2, to: Pt2, arc: number, bodies: Body[], w: number, h: number): number {
  const m = TEXT_CLEAR * h, L = bodies.filter((o) => o !== b && !o.cr).map((o) => lettersOf(o, m)).filter((r): r is Rect => !!r);
  let hit = 0;
  for (let k = 1; k < 16; k++) { const r = crBox(b, flyAt(b, from, to, arc, w, h, k / 16), true); for (const z of L) if (overlapArea(r, z) > 0) hit++; }
  return hit;
}
/** 날아오른다 — 다음 자리를 골라 거리만큼(FLY_SPEED) 날아간다. 갈 곳이 없으면 벽 위쪽 아무 데로 날며 닿으면 다시 찾는다 */
function takeOff(b: Body, bodies: Body[], w: number, h: number, sec: number) {
  const c = b.cr!, from = crAnchor(b);
  // 되는 자리마다 낮은 길부터 — 남의 글자를 안 가로지르는 첫 (자리, 길). 없으면 가장 덜 가로지르는 것
  let next: Spot | null = null, arc = 1, least = Infinity;
  for (const sp of spotsFor(b, bodies, w, h).slice(0, 8)) {
    const P = spotPoint(sp, bodies)!;
    for (const a of FLY_ARCS) {
      const hits = pathHits(b, from, P, a, bodies, w, h);
      if (hits < least) { least = hits; next = sp; arc = a; }
      if (!hits) break;
    }
    if (!least) break;
  }
  c.spot = next ?? { kind: 'ceil', host: null, i: -1, dx: crRnd(b.hw, w - b.hw), y: crRnd(0.2, 0.5) * h };
  const to = spotPoint(c.spot, bodies)!, T = hold(), dist = Math.hypot(to[0] - from[0], to[1] - from[1]);
  c.mode = 'fly'; c.from = from; c.t0 = sec; c.arc = arc;
  c.dur = Math.max(FLY_T[0] * T, Math.min(FLY_T[1] * T, dist / (FLY_SPEED * h)));
  if (Math.abs(to[0] - from[0]) > 1) c.face = to[0] > from[0] ? 1 : -1;
  c.box = next ? crBox(b, to) : null;
}
/** 한 걸음 — 앉아 있으면 자리를 따라가고(구름 밑의 박쥐는 구름과 함께) 때가 되면 날아오른다. 날고 있으면 둥근 길로 가서 앉는다.
    움직임 줄이기를 켠 사람에게는 날아오르지 않는다 */
function creatureStep(b: Body, bodies: Body[], w: number, h: number, sec: number, still: boolean) {
  const c = b.cr!;
  if (b.held) return;
  if (!c.spot) {
    const sp = pickSpot(b, bodies, w, h);
    if (sp) { c.spot = sp; c.mode = 'perch'; c.until = sec + perchFor(c.geo); }
    else if (!still) { takeOff(b, bodies, w, h, sec); return; }
    else return;
  }
  if (c.mode === 'perch') {
    const P = spotPoint(c.spot, bodies);
    if (!P) { c.spot = null; return; }
    placeAt(b, P);
    c.box = crBox(b, P);
    if (!still && sec >= c.until) takeOff(b, bodies, w, h, sec);
    return;
  }
  // 난다 — 솟았다 내려앉는 2차 곡선에 작은 오르내림
  const to = spotPoint(c.spot, bodies);
  if (!to) { takeOff(b, bodies, w, h, sec); return; }
  const s = Math.min(1, (sec - c.t0) / c.dur);
  placeAt(b, flyAt(b, c.from, to, c.arc, w, h, smooth01(s), Math.sin(sec * 2 * Math.PI * 1.2) * 0.02 * h * bump(s)));
  if (s >= 1) {
    if (c.spot.i < 0) { c.spot = null; return; }     // 떠돌던 목표 — 다음 걸음에 다시 찾는다
    c.mode = 'perch'; c.until = sec + perchFor(c.geo);
  }
}

/** 한 마리의 그림 — React가 그린 폰 자세를 숨기고, 부품을 따로 그린 겹을 벽이 직접 다룬다 */
type CrDom = { el: HTMLElement; live: SVGGElement; pose: SVGGElement; parts: Record<string, SVGElement> };
const SVGNS = 'http://www.w3.org/2000/svg';
function crDomOf(cache: Map<string, CrDom>, id: string, el: HTMLElement, g: CrGeo): CrDom | null {
  const had = cache.get(id);
  if (had && had.el === el && had.live.isConnected) return had;
  const svg = el.querySelector<SVGSVGElement>('svg.cloud-art'), react = svg?.querySelector<SVGGElement>(':scope > g:not(.cr-live)');
  if (!svg || !react) return null;
  react.style.display = 'none';
  svg.querySelector(':scope > g.cr-live')?.remove();
  const live = document.createElementNS(SVGNS, 'g') as SVGGElement;
  live.setAttribute('class', 'cr-live'); live.setAttribute('fill', react.getAttribute('fill') ?? '#fff');
  live.setAttribute('transform', `scale(${(svg.viewBox.baseVal.width / g.w).toFixed(4)})`);
  const pose = document.createElementNS(SVGNS, 'g') as SVGGElement;
  live.appendChild(pose); svg.appendChild(live);
  const mk = (tag: string) => { const e = document.createElementNS(SVGNS, tag) as SVGElement; pose.appendChild(e); return e; };
  const parts: Record<string, SVGElement> = g.kind === 'bird'
    ? { wing: mk('polygon'), tail: mk('polygon'), body: mk('circle'), head: mk('circle'), beak: mk('polygon') }
    : { body: mk('polygon') };
  const d = { el, live, pose, parts };
  cache.set(id, d);
  return d;
}
const ptsOf = (P: readonly (readonly [number, number])[]) => P.map((p) => p[0].toFixed(3) + ',' + p[1].toFixed(3)).join(' ');
/** 몸짓 하나의 진행(0~1) — 때가 되면 시작하고, 끝나면 다음 때를 잡는다. 안 하는 중이면 −1 */
function idlePhase(c: CrState, name: string, sec: number, on: boolean): number {
  const [dur, a, b] = IDLE[name], T = hold();
  if (!on) { c.t0s[name] = undefined; return -1; }
  if (c.next[name] === undefined) c.next[name] = sec + crRnd(0.5, b * T);
  if (sec >= c.next[name] && c.t0s[name] === undefined) {
    c.t0s[name] = sec;
    if (name === 'hop') c.hopTurn = Math.random() < 0.35;
    if (name === 'look') c.lookFor = crRnd(2 * T, 4 * T);
  }
  const t0 = c.t0s[name];
  if (t0 === undefined) return -1;
  const x = (sec - t0) / (name === 'look' ? c.lookFor : dur * T);
  if (x >= 1) {
    c.t0s[name] = undefined; c.next[name] = sec + crRnd(a * T, b * T);
    if (name === 'hop' && c.hopTurn) c.face = c.face === 1 ? -1 : 1;
    return -1;
  }
  return x;
}
/**
 * 한 프레임의 모양 — 새: 앉아서 꼬리 까딱 · 고개 까딱 · 콩콩(셋에 하나꼴 공중에서 돌아섬) · 깃털 부풀림 · 쪼기 · 두리번,
 * 날 때는 부채 날개를 친다. 박쥐: 매달려 움찔 · 날개 폈다 접기 · 흔들림, 날 때는 편 자세. 돌려주는 것은 요소 전체에
 * 더할 것 — 콩콩의 높이(px) · 흔들림(도)
 */
function creatureFrame(d: CrDom, b: Body, sec: number, moving: boolean): { dy: number; rot: number } {
  const c = b.cr!, g = c.geo, T = hold(), perched = c.mode === 'perch' && moving && !b.held;
  const pu = (2 * b.hw) / g.w;                                             // 형상 단위 하나 = px
  const P = d.parts;
  if (g.kind === 'bird') {
    const fly = c.mode === 'fly' && !b.held, pose: CreaturePose = fly ? g.poses.fly : g.poses.sit ?? g.poses.rest;
    const [body, head] = pose.discs, [beak, tail, fan] = pose.polys;
    const tp = idlePhase(c, 'tail', sec, perched), bp = idlePhase(c, 'bob', sec, perched), fp = idlePhase(c, 'fluff', sec, perched);
    const pp = idlePhase(c, 'peck', sec, perched), lp = idlePhase(c, 'look', sec, perched), hp = idlePhase(c, 'hop', sec, perched);
    const ta = tp < 0 ? 0 : -14 * bump(tp), hy = bp < 0 ? 0 : 0.25 * bump(bp), fs = fp < 0 ? 1 : 1 + 0.05 * bump(fp);
    const pa = pp < 0 ? 0 : 12 * bump(pp), back = lp > 0.1 && lp < 0.9, turned = hp > 0.5 && c.hopTurn;
    const face = turned ? -c.face : c.face;
    const hx = back ? 2 * g.tcx - head.cx : head.cx;
    P.body.setAttribute('cx', body.cx.toFixed(3)); P.body.setAttribute('cy', body.cy.toFixed(3)); P.body.setAttribute('r', (body.r * fs).toFixed(3));
    P.head.setAttribute('cx', hx.toFixed(3)); P.head.setAttribute('cy', (head.cy + hy).toFixed(3)); P.head.setAttribute('r', (head.r * fs).toFixed(3));
    P.beak.setAttribute('points', ptsOf(beak.map((p): Pt2 => [back ? 2 * g.tcx - p[0] : p[0], p[1] + hy])));
    const root = [(tail[0][0] + tail[3][0]) / 2, (tail[0][1] + tail[3][1]) / 2];
    P.tail.setAttribute('points', ptsOf(tail));
    P.tail.setAttribute('transform', `rotate(${ta.toFixed(2)} ${root[0].toFixed(3)} ${root[1].toFixed(3)})`);
    if (fly && fan) {
      // 날갯짓 — 부채의 뿌리를 축으로 ±18°, T × 0.4마다 한 번
      P.wing.setAttribute('points', ptsOf(fan));
      P.wing.setAttribute('transform', `rotate(${(18 * Math.sin((2 * Math.PI * sec) / (0.4 * T))).toFixed(2)} ${fan[0][0].toFixed(3)} ${fan[0][1].toFixed(3)})`);
      P.wing.style.display = '';
    } else P.wing.style.display = 'none';
    d.pose.setAttribute('transform', (face === -1 ? `translate(${(2 * g.tcx).toFixed(3)} 0) scale(-1 1) ` : '') + `rotate(${pa.toFixed(2)} ${g.tcx.toFixed(3)} ${g.tcy.toFixed(3)})`);
    return { dy: hp < 0 ? 0 : -0.6 * pu * bump(hp), rot: 0 };
  }
  // 박쥐 — 발끝은 천장(구름 밑)에 붙어 있다. 자세가 바뀌어 꼭대기가 올라가는 만큼 몸 전체를 내린다.
  // 안 내렸더니 벽 맨 위의 박쥐가 펴는 동안 · 날아오르는 순간 윗부분이 화면 밖으로 잘렸다(벽 캡처에서 봤다)
  const topOf = (Q: readonly (readonly [number, number])[]) => Math.min(...Q.map((p) => p[1]));
  if (c.mode === 'fly' && !b.held) {
    const F = g.poses.fly.polys[0];
    P.body.setAttribute('points', ptsOf(F));
    return { dy: (topOf(g.poses.rest.polys[0]) - topOf(F)) * pu, rot: 0 };
  }
  const rest = g.poses.rest.polys[0], tw = g.poses.twitch?.polys[0] ?? rest, st = g.poses.stretch?.polys[0] ?? rest;
  const wp = idlePhase(c, 'twitch', sec, perched), sp = idlePhase(c, 'stretch', sec, perched);
  const w1 = wp < 0 ? 0 : bump(wp);
  // 폈다(T) 두었다(2T) 접는다(T) — 펴는 동안은 움찔을 안 한다
  const s2 = sp < 0 ? 0 : sp < 0.25 ? smooth01(sp / 0.25) : sp < 0.75 ? 1 : 1 - smooth01((sp - 0.75) / 0.25);
  const now = rest.map((p, i): Pt2 => {
    const ax = p[0] + (tw[i][0] - p[0]) * w1 * (1 - s2), ay = p[1] + (tw[i][1] - p[1]) * w1 * (1 - s2);
    return [ax + (st[i][0] - ax) * s2, ay + (st[i][1] - ay) * s2];
  });
  P.body.setAttribute('points', ptsOf(now));
  // 흔들림 — 매달린 발끝을 축으로 ±3°, 한 번 T × 6(박쥐마다 박자가 다르다)
  return { dy: (topOf(rest) - topOf(now)) * pu, rot: perched ? 3 * Math.sin((2 * Math.PI * sec) / (6 * T) + b.sway) : 0 };
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
  /** 차분한의 발화 — 큰 돌이 밀려와 풍경을 쓸어 낸다(calmStep). 그리는 큰 돌 · 그 요소 · 프레임 루프의 상태 · 앞 발화를 되돌릴 차례 ·
      끝났을 때의 정리(발화 상태를 비운다 — 아래 land의 정리와 같다) */
  const [calmMsg, setCalmMsg] = useState<{ msg: StoredMessage; G: number } | null>(null);
  const giantElRef = useRef<HTMLDivElement | null>(null);
  const calmRef = useRef<Calm | null>(null);
  const calmUndoRef = useRef<Calm | null>(null);
  const calmDoneRef = useRef<() => void>(() => {});
  const lingerTimerRef = useRef(0);
  useEffect(() => () => clearTimeout(lingerTimerRef.current), []);

  // 떠다니는 몸들과 그것을 그리는 요소. 둘 다 React 바깥에 둔다 —
  // 프레임마다 상태를 갱신하면 열두 개 × 60프레임을 다시 그리게 된다.
  const bodiesRef = useRef(new Map<string, Body>());
  /** 돌의 물리 세계 — 벽이 떠 있는 동안 하나 */
  const worldRef = useRef<StoneWorld | null>(null);
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
  /** 새 · 박쥐의 부품(글마다). 요소가 바뀌면 다시 짓는다 */
  const crDomRef = useRef(new Map<string, CrDom>());

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
    // 다 내려앉은 뒤의 정리 — 내려앉은 글을 한 바퀴 붙잡아 두고 발화 상태를 비운다
    const settle = () => {
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
    };
    calmDoneRef.current = () => { calmRef.current = null; setCalmMsg(null); settle(); };
    const land = () => {
      landingRef.current = true;
      clearTimeout(closeTimerRef.current);
      clearTimeout(hideTimerRef.current);
      // 차분한 — 큰 돌이 물러났다가 밀려 나가고 풍경이 돌아온다. 끝은 프레임 루프가 알린다(calmDoneRef)
      const C = calmRef.current;
      if (C && (C.phase === 'enter' || C.phase === 'hold')) { C.phase = 'exit'; C.t0 = performance.now() / 1000; C.x0 = NaN; return; }
      if (C) return;
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
          // 같은 글이라 잔상과 큰 상자의 생김새가 같다 — 배율은 한 변의 비다(새 · 박쥐는 잔상이 CREATURE_SCALE만큼 작다)
          scale: (boxSide() * (sizesRef.current.get(id!)?.scale ?? 1)) / bigSide
        });
      } else {
        setEmphLand(SINK);
      }
      hideTimerRef.current = window.setTimeout(() => {
        if (body) body.held = false;      // 도착했으니 다시 떠다닌다
        // 도착한 글을 한 바퀴 붙잡아 둔다(LINGER_MS). 다음 발화가 오면 그 글이 이어받는다
        settle();
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
      // 차분한(돌) — 검정 대신 큰 돌이 밀려와 풍경을 쓸어 낸다. 움직임을 줄인 화면은 다른 성격처럼 검정 위의 큰 상자
      if (calmRef.current) calmUndoRef.current = calmRef.current;
      const { cloud, box } = cloudOf(msg);
      if (cloud.stone && !prefersReducedMotion()) {
        const one = boxSide(), G = Math.min((CALM_SIZE * window.innerWidth) / (box.w * one), (CALM_SIZE * window.innerHeight) / (box.h * one));
        calmRef.current = { id: msg.id, phase: 'enter', t0: performance.now() / 1000, G, giant: null, x0: NaN, snap: null, fade: 0, dropped: false, done: false };
        setCalmMsg({ msg, G });
      } else { calmRef.current = null; setCalmMsg(null); }
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
  // 나무(당당한)는 TREE_MAX그루까지 — 발화 중인 글은 나무라도 늘 남기고 그 몫도 센다
  const shown = useMemo(() => {
    const isTree = (m: StoredMessage) => personaFor(m.tone?.font).edge === 'tree';
    const out: StoredMessage[] = [];
    let trees = 0;
    const put = (m: StoredMessage, force = false) => {
      if (out.some((x) => x.id === m.id)) return;
      if (isTree(m)) { if (!force && trees >= TREE_MAX) return; trees++; }
      out.push(m);
    };
    // 발화 중인 글, 그리고 막 내려앉은 글(LINGER_MS)
    for (const keep of [emphMsg, linger]) {
      const pinned = keep ? visible.find((m) => m.id === keep.id) : null;
      if (pinned) put(pinned, true);
    }
    const n = visible.length, start = n > FLOAT_N ? rotate : 0;
    for (let i = 0; out.length < FLOAT_N && i < n; i++) put(visible[(i + start) % n]);
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
      const sb = cloud.stone ? stoneBelly(cloud.stone.pts) : null;
      const kind = kindOf(cloud), t = cloud.tree, ph = cloud.photo, colors = colorsOf(msg), scale = scaleOf(cloud);
      m.set(msg.id, {
        w: box.w * scale, h: (box.h + box.tail) * scale, scale, heavy: kind === 'stone', kind, poly,
        tx: textBox(cloud), pair: seed01(msg.text + '|pair'), over: seed01(msg.text + '|over'), bg: rgbOf(colors.bg), fg: rgbOf(colors.text),
        ...(t ? { tall: tallOf(msg), perch: perchesOf(cloud) } : {}),
        ...(cloud.creature ? { cr: crGeoOf(cloud) } : {}),
        ...(sb ? { chain: sb.chain.map(fr), belly: sb.belly.map(fr) } : {}),
        ...(ph ? { chars: ph.chars.map(fr), unit: box.unit, cw: cloud.w, ext: [ph.x0 / cloud.w, ph.x1 / cloud.w] as Pt2 } : {})
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
      const world = (worldRef.current ??= stoneWorld());
      for (const id of [...map.keys()]) if (!ids.includes(id)) {
        const gone = map.get(id);
        if (gone?.mb) Matter.Composite.remove(world.engine.world, gone.mb);
        map.delete(id); cloudDomRef.current.delete(id); crDomRef.current.delete(id);
      }
      for (const id of ids) {
        const f = sizesRef.current.get(id);
        const hw = (side * (f?.w ?? 1)) / 2, hh = (side * (f?.h ?? 1)) / 2, kind = f?.kind ?? 'float';
        const off = ([u, v]: Pt2): Pt2 => [(u - 0.5) * 2 * hw, (v - 0.5) * 2 * hh];
        const poly = f?.poly ? f.poly.map(off) : null;
        let b = map.get(id);
        // 크기를 몰라 떠다니는 말로 먼저 놓였던 몸은 제 종류를 알게 되면 다시 놓는다 — 나무는 글 자리를 보고 서야 한다
        if (!b || (b.kind !== kind && !b.held)) {
          if (b) { if (b.mb) Matter.Composite.remove(world.engine.world, b.mb); map.delete(id); }
          map.set(id, (b = spawn(rOf(id), hw, hh, kind, w, h, [...map.values()],
            { tall: f?.tall ?? 0, u: side * (f?.unit ?? 0), tx: f?.tx ?? null, pair: f?.pair ?? 1, over: f?.over ?? 0, bg: f?.bg ?? [1, 1, 1], fg: f?.fg ?? [0, 0, 0],
              perch: f?.perch, cr: f?.cr })));
        } else { b.r = rOf(id); b.hw = hw; b.hh = hh; b.heavy = kind === 'stone'; b.kind = kind; b.tall = f?.tall ?? 0; b.tx = f?.tx ?? null; b.bg = f?.bg ?? b.bg; b.fg = f?.fg ?? b.fg; b.perch = f?.perch ?? null; if (b.cr && f?.cr) b.cr.geo = f.cr; }   // 창 크기가 바뀌면 같이 바뀐다
        b.poly = poly;
        if (kind === 'stone' && f?.chain && !b.parked) {
          // 돌의 물리 몸 — 처음이거나 창 크기가 바뀌었으면 지금 자리 · 각도 그대로 다시 짓는다
          if (!b.mb || b.mside !== side) {
            const a = b.mb?.angle ?? 0, v = b.mb?.velocity;
            if (b.mb) Matter.Composite.remove(world.engine.world, b.mb);
            const { mb, mc } = stoneBodyOf(f.chain.map(off), (f.belly ?? []).map(off), b.x, b.y);
            Matter.Body.setAngle(mb, a);
            if (v) Matter.Body.setVelocity(mb, v);
            b.mb = mb; b.mc = mc; b.mside = side;
            [b.x, b.y] = stoneCenter(b);
            Matter.Composite.add(world.engine.world, mb);
          }
          // 붙잡힌 돌(큰 상자가 내려앉을 과녁)은 그 자리에 멈춘다
          if (b.mb.isStatic !== b.held) Matter.Body.setStatic(b.mb, b.held);
          // 다른 규칙(새가 앉을 윗변 · 몰림 · 나무 글 비키기)이 보는 윤곽 — 돌이 기운 만큼 돌려 둔다
          if (poly && b.a) { const c = Math.cos(b.a), sn = Math.sin(b.a); b.poly = poly.map(([x, y]): Pt2 => [x * c - y * sn, x * sn + y * c]); }
        }
        if (kind === 'cloud' && f?.chars && b.side !== side) {
          b.side = side; b.u = side * (f.unit ?? 0); b.chars = f.chars.map(off);
        }
        if (kind === 'cloud') b.ext = f?.ext;
        // 크기를 몰라 떠다니는 말로 먼저 놓였던 구름(벽이 막 켜진 첫 프레임들) — 자리를 여기서 받는다. 다른 구름의
        // 자리를 보고 고른다: 모르고 고르면 한데 포개져 서로 글자를 비키느라 밀치며 두 배로 빨라졌다(2026-09-29, 재서 알았다)
        if (kind === 'cloud' && !b.home) {
          b.home = cloudHome(b, w, h, [...map.values()]);
          [b.x, b.y] = floatAt(b, w, h, t / 1000);
          b.vx = b.vy = 0;
        }
      }
      const moving = !prefersReducedMotion();
      // 차분한의 발화 — 앞 발화가 아직 안 끝났으면 풍경부터 되돌리고, 큰 돌 · 휩쓸림 · 복귀를 걷는다
      const undo = calmUndoRef.current;
      if (undo) { calmRestore(undo, world, map, t / 1000); const ob = map.get(undo.id); if (ob) ob.parked = false; calmUndoRef.current = null; }
      const C = calmRef.current;
      if (C) {
        calmStep(C, world, map, sizesRef.current.get(C.id), side, w, h, dt, t / 1000);
        if (C.done) { C.done = false; calmDoneRef.current(); }
      }
      step(world, [...map.values()], w, h, dt, t / 1000, !moving);
      for (const [id, b] of map) {
        const el = elsRef.current.get(id);
        if (!el) continue;
        // 몸은 가운데를 들고 있고 요소는 왼쪽 위로 놓인다
        const f = sizesRef.current.get(id) ?? { w: 1, h: 1, kind: 'float' as Kind };
        // 돌은 흔들린 만큼 제 가운데를 축으로 기운다
        let tf = `translate3d(${(b.x - (side * f.w) / 2).toFixed(1)}px, ${(b.y - (side * f.h) / 2).toFixed(1)}px, 0)` + (b.a ? ` rotate(${b.a.toFixed(4)}rad)` : '');
        if (b.kind === 'tree') {
          // 상자 밑으로 이어지는 줄기의 길이 — 펴지며 등장할 때 축이 바닥에 오게(app.css). 바뀐 만큼만 적는다
          const ext = Math.max(0, treeHeight(b, h) - 2 * b.hh).toFixed(0) + 'px';
          if (el.style.getPropertyValue('--tree-ext') !== ext) el.style.setProperty('--tree-ext', ext);
          // 처음 세운 순간 — 여기서부터 펴진다(app.css). React가 안 건드리는 data 속성이라 다시 그려도 남는다
          if (!el.dataset.placed) el.dataset.placed = '1';
        }
        if (b.cr) {
          // 새 · 박쥐 — 부품을 벽이 그린다. 콩콩은 요소째 뛰고, 박쥐의 흔들림은 매달린 발끝을 축으로 요소째 돈다
          const d = crDomOf(crDomRef.current, id, el, b.cr.geo);
          if (d) {
            const g = b.cr.geo, { dy, rot } = creatureFrame(d, b, t / 1000, moving);
            tf = `translate3d(${(b.x - (side * f.w) / 2).toFixed(1)}px, ${(b.y - (side * f.h) / 2 + dy).toFixed(1)}px, 0)`;
            if (rot) {
              el.style.transformOrigin = `${((g.anchor[0] / g.w) * 2 * b.hw).toFixed(1)}px ${((g.anchor[1] / g.h) * 2 * b.hh - dy).toFixed(1)}px`;
              tf += ` rotate(${rot.toFixed(2)}deg)`;
            }
          }
        }
        if (b.kind === 'cloud' && moving && ECHO_MOTION) {
          // 엇걸음 — 가운데 높이를 축으로 몸 전체를 기울여 위아래 끝이 ±SWAY_U씩 번갈아 앞선다. 평소엔 꺼 둔다(SWAY_ON)
          if (SWAY_ON) {
            const lean = (SWAY_U * b.u * Math.sin((t / 1000 / (SWAY * hold())) * Math.PI * 2 + b.sway)) / Math.max(1, b.hh);
            tf += ` skewX(${(-Math.atan(lean)).toFixed(4)}rad)`;
          }
          cloudFrame(cloudDomOf(cloudDomRef.current, id, el, f), b, f, t / 1000);
        }
        el.style.transform = tf;
        // 차분한의 발화 — 쓸려 나간 몸은 숨기고, 복귀하는 동안 풍경이 스며든다. 그 글의 돌은 떨어지는 순간부터 보인다
        const Cn = calmRef.current;
        if (Cn) {
          const op = b.away ? '0' : Cn.phase === 'return' && id !== Cn.id ? Cn.fade.toFixed(3) : '';
          if (el.style.opacity !== op) el.style.opacity = op;
          if (id === Cn.id) el.style.visibility = Cn.dropped ? 'visible' : '';
        } else if (el.style.opacity || el.style.visibility) { el.style.opacity = ''; el.style.visibility = ''; }
      }
      // 큰 돌 — 각도는 늘 0(밀려오고 밀려 나간다)
      const ge = giantElRef.current, gC = calmRef.current?.giant;
      if (ge) ge.style.transform = gC ? `translate3d(${(gC.mb.position.x + gC.mc[0] - gC.hw).toFixed(1)}px, ${(gC.mb.position.y + gC.mc[1] - gC.hh).toFixed(1)}px, 0)` : 'translate3d(-300vw, 0, 0)';
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [shownKey]);
  // 벽이 내려가면 물리 세계도 비운다. 몸이 들고 있던 옛 세계의 몸은 놓는다 — 다시 뜨면(개발 모드는 두 번 뜬다) 그때 지은 세계에 다시 짓는다
  useEffect(() => () => {
    const W = worldRef.current;
    if (W) Matter.Engine.clear(W.engine);
    worldRef.current = null;
    for (const b of bodiesRef.current.values()) b.mb = null;
  }, []);

  // 겹 안의 차례 — 키 큰 나무가 맨 뒤, 그다음 작은 나무 · 돌 · 떠다니는 말 · 구름(맨 앞, 곱하기)
  const layered = useMemo(() => {
    return shown
      .map((msg) => ({ msg, kind: kindOf(cloudOf(msg).cloud), tall: tallOf(msg) }))
      .sort((a, b) => RANK[a.kind] - RANK[b.kind] || (a.kind === 'tree' ? b.tall - a.tall : 0))
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
      {emphMsg && !calmMsg && <WallShowMessage key={emphKey} msg={emphMsg} land={emphLand} startedAt={emphStart} />}
      {calmMsg && <WallCalmStone key={calmMsg.msg.id} msg={calmMsg.msg} G={calmMsg.G} elRef={giantElRef} />}

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
  const kind = kindOf(cloud), scale = scaleOf(cloud);
  const drawn = useMemo(() => withBelly(cloud), [cloud]);

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
      <CloudBubble cloud={drawn} box={box} side={scale === 1 ? 'var(--echo-side)' : `calc(var(--echo-side) * ${scale})`} color={bg} still={!ECHO_MOTION}>
        <VoiceBubble text={lines.join('\n')} bg={bg} color={text} fontFamily={fontFamily} font={msg.tone?.font} weight={wght}
          width={scaleX} slant={skew} align={msg.tone?.align} size={msg.tone?.size} manner={msg.tone?.manner}
          speed={msg.tone?.speed} weightPos={msg.tone?.weight} perChar={kind === 'cloud'}
          fontSize={`calc(var(--echo-side) * ${(box.unit * scale).toFixed(4)})`} />
      </CloudBubble>
    </div>
  );
});

// ─── 발화 (검정 위의 큰 상자. 잦아들다 내려앉는다) ────────────────────
// 폰의 5/5 미리보기(PhasePreview)가 이것을 그대로 빌려 쓴다 — 벽과 따로
// 그리면 서체·구름·줄바꿈 중 하나가 반드시 어긋난다.

/* 말풍선 때는 물결이 30초에 걸쳐 잦아들어 잔상의 세기에 닿았다(calmAt).
   구름은 강조와 잔상이 같은 숨(중)을 쉰다 — 크기만 내려앉는다. */
export const WallShowMessage = memo(function WallShowMessage({ msg, land, centerText }: { msg: StoredMessage; land: Land | null; startedAt: number; centerText?: boolean }) {
  const { bg, text, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);
  const { lines, cloud, box } = useMemo(() => cloudOf(msg), [msg]);

  const landing = land !== null;
  const boxStyle = land
    ? { transform: `translate(${land.dx.toFixed(1)}px, ${land.dy.toFixed(1)}px) scale(${land.scale.toFixed(4)})` }
    : undefined;

  return (
    <div className={`wall-show${landing ? ' is-landing' : ''}`}>
      <div className="wall-show-box" style={boxStyle}>
        <CloudBubble cloud={cloud} box={box} side="var(--big-side)" color={bg} centerText={centerText}>
          <VoiceBubble text={lines.join('\n')} bg={bg} color={text} fontFamily={fontFamily} font={msg.tone?.font} weight={wght}
            width={scaleX} slant={skew} align={msg.tone?.align} size={msg.tone?.size} manner={msg.tone?.manner}
          speed={msg.tone?.speed} weightPos={msg.tone?.weight}
            fontSize={`calc(var(--big-side) * ${box.unit.toFixed(4)})`} />
        </CloudBubble>
      </div>
    </div>
  );
});

/** 벽의 돌 — 땅에 묻힌 아랫부분까지 그린다(상자 밑으로 나간다 — .cloud-art는 넘쳐도 그린다). 바닥에 앉으면 화면 밑에 묻혀
    안 보이고, 얹히거나 구르면 드러난다. 폰(4/5 · 5/5)의 돌은 밑이 평평한 그대로 */
function withBelly(cloud: Cloud): Cloud {
  if (!cloud.stone) return cloud;
  const { chain, belly } = stoneBelly(cloud.stone.pts);
  return belly.length ? { ...cloud, stone: { ...cloud.stone, pts: [...chain, ...belly] } } : cloud;
}

/** 차분한 발화의 큰 돌(calmStep) — 자리는 프레임 루프가 transform으로 적는다. 크기는 벽의 한 변 × G(화면의 80% 안) */
const WallCalmStone = memo(function WallCalmStone({ msg, G, elRef }: { msg: StoredMessage; G: number; elRef: React.MutableRefObject<HTMLDivElement | null> }) {
  const { bg, text, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);
  const { lines, cloud, box } = useMemo(() => cloudOf(msg), [msg]);
  const drawn = useMemo(() => withBelly(cloud), [cloud]);
  return (
    <div ref={elRef} className="wall-calm" style={{ position: 'fixed', left: 0, top: 0, zIndex: 'var(--z-elevated)', pointerEvents: 'none', willChange: 'transform', transform: 'translate3d(-300vw, 0, 0)' } as CSSProperties}>
      <CloudBubble cloud={drawn} box={box} side={`calc(var(--echo-side) * ${G.toFixed(4)})`} color={bg} still>
        <VoiceBubble text={lines.join('\n')} bg={bg} color={text} fontFamily={fontFamily} font={msg.tone?.font} weight={wght}
          width={scaleX} slant={skew} align={msg.tone?.align} size={msg.tone?.size} manner={msg.tone?.manner}
          speed={msg.tone?.speed} weightPos={msg.tone?.weight}
          fontSize={`calc(var(--echo-side) * ${(box.unit * G).toFixed(4)})`} />
      </CloudBubble>
    </div>
  );
});

// ─── Shared style derivation ─────────────────────────────────────────

/** 한 글의 칠 · 글자색 — 벽이 그리는 색 그대로(물리 계산의 읽힘도 이것으로 잰다) */
function colorsOf(msg: StoredMessage): { bg: string; text: string } {
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
  return { bg: tone?.backgroundColor ?? pal.bg, text: tone?.textColor ?? pal.text };
}

function useDerivedStyle(msg: StoredMessage) {
  return useMemo(() => {
    const tone = msg.tone, { bg, text } = colorsOf(msg);
    const fontFamily = tone ? fontMap[tone.font] : fontMap.botong;
    return {
      bg,
      text,
      fontFamily,
      wght: tone?.wght ?? 400,
      scaleX: tone?.tone ?? 1.0,
      skew: tone?.slnt ?? 0
    };
  }, [msg]);
}
