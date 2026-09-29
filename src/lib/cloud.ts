import { LINE_HEIGHT, foldLines, type BoxShape } from './fit';
import { formFor, opticalFix } from './palettes';
import type { Align } from '../types';

/**
 * 발화 배경 — 구름.
 *
 * 글줄을 따라 **크기가 제각각인 원**을 놓고 그 합집합이 배경이 된다. 규칙과
 * 고른 이유는 design/cloud-rules.md, 시안은 design/cloud-*.png. 2026-09-22에
 * 네 모양 말풍선(bubbles.ts)을 이것으로 바꿨다.
 *
 * 여기는 **자리만** 정한다 — 원의 중심·반지름, 갈래, 글이 앉을 자리. 그리는
 * 일(번짐 필터·숨)은 CloudBubble이 한다. 단위는 u = 글자 한 칸(font-size)이라
 * 폰에서도 벽에서도 같은 모양이고, 씨앗이 글이라 같은 글은 언제나 같은 구름이다.
 *
 * 순서가 중요하다: **글이 먼저고 틀이 결과다.** 참여자가 정한 크기·줄바꿈을
 * 그대로 두고, 그 글 덩어리를 원들이 감싼다.
 */

/** 글과 윤곽 사이에 반드시 남는 자리 — 글자 한 칸의 배수. 말풍선 때와 같다 */
export const PAD = 0.7;
/**
 * 짧은 글(두 줄까지)의 최소 지름 — **0이다.**
 *
 * 시안(cloud-form.png)에서 고른 것은 11.4u였다. 벽 가로폭의 ¼로, 한마디가
 * 제 존재감을 갖게 하는 값이었고 그 격자에서는 글자 크기를 28px로 붙박아
 * 두고 봤다. 실제 앱에 넣으니 그 전제가 깨졌다 — 크기 축이 글자 크기를
 * 정하므로, 이 최소가 짧은 글의 구름을 12.63u까지 부풀려 **두 줄짜리
 * (12.58u)보다 크게** 만들었다. 말이 짧을수록 커지는 셈이다.
 *
 * 둘 다 가질 수 없어서 길이 쪽을 골랐다(2026-09-22). 존재감은 최소로 두고
 * 길이가 드러나게 한다. 글이 읽히는 데 필요한 자리는 이것이 아니라 PAD가
 * 지킨다 — 사방 0.7u는 여기서도 그대로다. 0이어도 6자 글의 구름은 10.67u로,
 * 글 폭(5.49u)의 두 배 가까이 된다. 덩이 반지름에 하한이 있기 때문이다.
 *
 * 되살리려면 cloudFor의 minDiameter로 준다 — 조율 격자가 그렇게 쓴다.
 */
export const B_MIN_DIAMETER = 0;

// ─── 움직임 (중 · 6초). 값의 근거는 design/cloud-rules.md ─────────────
/** 반지름이 부푸는 최대 비율. 8%는 멈춰 보였고 28%는 짧은 말에서 과했다 */
export const AMP = 0.16;
/** 파동 주기(초)와 그 위에 얹는 느린 결의 주기. 나눠떨어지지 않아 되돌아가는 자리가 없다 */
export const T1 = 6;
export const T2 = 9.7;
/** 파동 한 마루의 길이 (u). 위상은 자리다 — 왼쪽이 먼저 부풀고 오른쪽이 따라온다 */
export const LAMBDA = 8;
/** 조각이 옮겨 다니는 거리 (u). 조각만 자리를 옮긴다 */
export const DRIFT = 0.6;

export type Edge = 'spike' | 'smooth' | 'cumulus' | 'pixel' | 'stone' | 'tree' | 'bead' | 'creature';

export interface Persona {
  key: string;
  edge: Edge;
  /** 큰 덩이 반지름 — H(줄 반높이 + 여백)의 배수 범위 */
  lobe: readonly [number, number];
  /** 메우는 원 반지름 — H의 배수 범위 */
  fill: readonly [number, number];
  /** 큰 덩이 사이 (H 배수) */
  gap: number;
  /** 줄 끝 너머로 덩이를 더 두는 거리 (u) */
  spread: readonly [number, number];
  /** 작은 조각 개수 */
  sat: number;
  /** 번짐 (u) */
  blur: number;
  /** 당당한 — 갈래. 깊이(u) 범위 · 밑동 반폭(u) · 간격(u) */
  spike?: { depth: readonly [number, number]; base: number; gap: number };
  /** 유머있는 — 격자 한 칸 (u) */
  cell?: number;
  /** 차분한 — 날 선 돌. 원을 안 쓰고 다각형 하나다(stoneFor) */
  stone?: {
    /** 꼭짓점 수 범위 */
    corners: readonly [number, number];
    /** 꼭짓점 자리 흔들림(한 칸에 대한 비율) · 거리 흔들림(비율) */
    slot: number;
    reach: number;
    /** 모서리 굴림 (u) — 그리는 쪽(CloudBubble)이 쓴다 */
    round: number;
    /** 기울기 범위(도). 방향은 글마다 */
    tilt: readonly [number, number];
    /** 깨는 모서리 수 · 깨는 각도 범위(도) · 글 + 여백에서 비켜 지나는 거리(u) */
    crack: { count: number; angle: readonly [number, number]; clear: number };
    /** 빗금 — 켜짐 · 바깥 법선 각도 범위(도, 0 = 오른쪽 · 90 = 아래) · 깊이 · 간격 · 굵기 (u).
        on이 false면 빗금을 만들지도 그리지도 않는다 — 값은 그대로 두어 on만 되돌리면 산다 */
    hatch: { on: boolean; from: number; to: number; depth: number; gap: number; width: number };
    /** 걸기(R17) — 돌과 글이 같이 기우는 각도(도, + = 시계 방향: 올려 걸기 · 중간 걸기 · 내려 걸기) · 돌의 몸이 글 아래로 처지는 깊이(글 높이의 배수) */
    hang: { up: number; mid: number; down: number; drop: number };
    /** 넘치기(R18) — 가운데 돌의 기본. 넘치는 깨짐의 각도 범위(도, 작을수록 가파르다) · 가장 바깥 줄 끝을 파고드는 깊이 범위 (u) */
    overflow: { angle: readonly [number, number]; depth: readonly [number, number] };
    /** 윤곽 따라(R20) — 윤곽에서 첫 줄 글자 가장자리까지 (u) · 줄 사이에 비우는 줄 수 · 글을 얹는 비탈의 한도(도) ·
        돌을 처음 잡는 크기(가운데 돌에 대한 비율) · 글이 다 안 얹힐 때 한 번에 키우는 비율 ·
        한 줄에 얹는 길이의 한도(가장 긴 줄 폭의 배수 — 이것이 없으면 긴 윗 윤곽 하나에 글이 다 얹혀 줄이 안 생긴다) */
    contour: { inset: number; gap: number; slope: number; start: number; grow: number; fill: number };
    /** 밑면 — 무게중심 좌우로 밑면이 되는 폭(돌 폭의 비율) · 글 + 여백에서 비켜 지나는 거리(u). flatBase */
    base: { half: number; clear: number };
  };
  /** 줄 높이(글자 크기의 배수). 없으면 LINE_HEIGHT(1.5). 글에 바짝 붙는 형상(나무)이 좁힌다 */
  lh?: number;
  /** 당당한 — 나무(treeFor, 2026-09-29 다시). 예리한 = 같은 기울기의 이등변 삼각형 반복, 온화한 = 같은 원의 반복.
      기둥 · 줄무늬는 없다. 값의 근거는 design/landscape.md '나무' */
  tree?: {
    /** 예리한 — 삼각형 옆변의 기울기(반폭 ÷ 높이) · 아래 단이 시작하는 목의 반폭(그 단 밑변 반폭의 비율) ·
        아래로 한 단마다 밑변이 넓어지는 비율. 셋 다 레퍼런스(Tree_reference_2)에서 잰 값 */
    slope: number;
    notch: number;
    grow: number;
    /** 사선 배열 — 줄의 기울기(도, 시계 방향) · 한 줄마다 시작이 읽는 쪽으로 밀리는 거리(글자 높이의 배수) */
    slant: number;
    stagger: number;
    /** 한 줄 글자 수 — 기본 · 사선. 세로쓰기는 앱 전체의 줄바꿈(fit.ts) 그대로 */
    per: number;
  };
  /** 다정한 — 구슬 구름(beadFor). 뭉게구름 윤곽을 한 크기 구슬로 찍는다. 값의 근거는 design/landscape.md '구름' */
  bead?: {
    /** 육각 격자 간격 · 구슬 반지름 (u) */
    step: number;
    r: number;
    /** 글 덩어리와 윤곽 사이 — 옆 · 위아래 (u). 봉우리는 그 바깥으로 솟는다 */
    side: number;
    top: number;
    /** 곁의 작은 구름 — 수(뽑는 주머니: 글이 씨앗으로 하나 집는다) · 차례마다 알 수 범위(첫째가 가장 크다) ·
        붙는 방향의 범위(도, 0 = 앞(오른쪽) · 90 = 위 · 180 = 뒤, 밑은 뺀다) · 둘 사이의 최소 각도(도) ·
        본 구름에서 떨어진 거리 범위 (u) · 오르내리는 폭 (u) */
    lets: { count: readonly number[]; sizes: readonly (readonly [number, number])[]; angle: readonly [number, number]; apart: number };
    gap: readonly [number, number];
    bob: number;
    /** 휜 배치(아치 · 부채꼴 · 미소) — 아치 · 미소의 가장 긴 줄의 반지름(줄 길이의 배수) · 부채꼴이 두르는 각(도) ·
        글 띠와 윤곽 사이 (u) */
    arc: { bow: number; fan: number; band: number };
  };
  /** 유머있는 — 말투가 형상을 가른다: 귀여운 = 새, 시니컬한 = 박쥐(creatureFor). 기하 도형만(원 · 세모 · 띠 · 원호).
      몸은 글을 따르고, 붙는 것(꼬리 · 귀 · 날개)은 길이가 정해져 있다. 값의 근거는 design/landscape.md '새' · '박쥐' */
  creature?: {
    bird: {
      /** 몸 = 글 + 여백 네모의 네 모서리를 지나는 원 × grow */
      grow: number;
      /** 머리 원 — 반지름(몸 R의 배수) · 자리(도, 화면 각도라 −가 위) · 몸 밖으로 나온 몫(머리 반지름의 배수) */
      head: { r: number; at: number; out: number };
      /** 부리 세모 — 길이 · 밑변 반(머리 반지름의 배수) */
      beak: { len: number; half: number };
      /** 꼬리 — 길이 · 반폭(u, 고정 — 몸 쪽 뿌리 · 끝: 몸 쪽으로 갈수록 좁아지는 사다리꼴) · 몸에서 나오는 자리(R의 배수) ·
          방향(from = 나오는 각, to = 뻗는 각): 글이 고르는 둘(뒤로 조금 위 · 아래로 늘어뜨림)과 날 때(곧게 뒤로) */
      tail: { len: number; half: { root: number; tip: number }; root: number; up: { from: number; to: number }; down: { from: number; to: number }; fly: { from: number; to: number } };
      /** 날개(벽, 날 때) — 부채(원의 조각): 뿌리(R 배수 · 각) · 반지름(R 배수) · 가운데 각 · 벌어짐(도) */
      wing: { root: number; at: number; r: number; dir: number; span: number };
    };
    bat: {
      /** 귀 — 높이(u) · 안쪽 밑 · 바깥 밑 · 끝의 가로 자리(높이의 배수, 가운데에서) */
      ear: { h: number; in: number; out: number; tip: number };
      /** 아래 끝 · 날개 폭 · 날개 들림의 단위 · 윗변이 글 + 여백 위로 뜨는 거리 · 옆선이 글 + 여백 밖으로 나가는 거리 ·
          옆선의 끝이 글 + 여백 아래로 내려가는 거리 (모두 u, 고정) */
      foot: number; span: number; unit: number; top: number; side: number; hip: number;
      /** 날개가 내려오는 높이 — 두 줄 견본의 날개 높이(u). 여기에 들림 × unit을 더한다. 그 아래는 옆선이 곧다 */
      reach: number;
      /** 아랫변 파임 — 현 길이에 대한 부풂 */
      sag: number;
      /** 자세 — 들림(unit 배수, −는 처짐) · 파임 수 · 손가락 끝이 처지는 정도(unit 배수). 매달림은 이것을 뒤집는다 */
      fly: { lift: number; n: number; drop: number };
      hang: { lift: number; n: number; drop: number };
      /** 벽 — 매달린 채의 몸짓(2026-09-29): 날개를 조금 들었다 내림(움찔) · 넓게 폈다 접음(span = 날개 폭의 배수).
          매달림과 n이 같아야 한다 — 벽이 두 윤곽 사이의 점을 옮겨 움직인다 */
      twitch: { lift: number; n: number; drop: number };
      stretch: { lift: number; n: number; drop: number; span: number };
    };
  };
}

/**
 * 성격이 가장자리를 정한다. 구성은 하나다.
 * 값은 design/cloud-personality.png 격자에서 골랐다 — 고친 이유는 cloud-rules.md.
 */
export const PERSONAS: Record<string, Persona> = {
  // 나무 (2026-09-28, 09-29 다시). 뾰족 구름 → 별(09-27) → 박스 → 나무. 2026-09-29 디자이너 레퍼런스(Tree_reference_2 · 3)로
  // 다시 지었다 — 기둥 · 줄무늬 · 달걀 머리를 버리고 실루엣 하나: 3/5 말투가 고른다, 예리한 = 같은 기울기의 이등변 삼각형
  // 반복, 온화한 = 같은 원의 반복. 원(lobe · fill · gap · spread)은 쓰이지 않는다. 행간 1.1은 박스에서 고른 값 그대로.
  // 사선은 격자에서 45° · 60° · 68.5°(레퍼런스) 중 60°. 줄은 기본 · 사선 8자, 세로쓰기 12자(디자이너).
  // 고른 과정과 버린 것은 design/landscape.md '나무'.
  ttoryeot: { key: 'ttoryeot', edge: 'tree', lobe: [1.25, 1.85], fill: [0.6, 0.8], gap: 1.9, spread: [0.2, 0.9], sat: 0, blur: 0, lh: 1.1,
    tree: { slope: 0.402, notch: 0.55, grow: 1.05, slant: 60, stagger: 1, per: 8 } },
  // 날 선 돌 (2026-09-27). 매끈한 덩이였다 — 성격의 짝이 돌·별·꽃·나비로 바뀌면서
  // 차분한이 먼저 돌이 됐다. 원을 안 써서 아래 lobe·fill·gap·spread는 쓰이지 않는다.
  // 값은 격자에서 골랐다 — 뭉툭 · 굴린 각 · 깎은 돌 중 날 선 각, 긴 글이 네모로 끌리던
  // 것은 기울이고 두 모서리를 깨서, 빗금은 둘레의 약 45%가 되게(design/landscape.md '돌').
  chabun: { key: 'chabun', edge: 'stone', lobe: [1.15, 1.35], fill: [0.75, 0.9], gap: 2.2, spread: [0, 0.3], sat: 0, blur: 0,
    stone: { corners: [6, 8], slot: 0.45, reach: 0.15, round: 0.12, tilt: [5, 10],
      crack: { count: 2, angle: [25, 65], clear: 0.3 },
      // 빗금은 꺼 두었다(2026-09-28, 사용자 — "일단 없애 보자, 나중에 되살릴 수 있게").
      // 되살리려면 on: true. 나머지 값은 09-28 새벽에 깊이를 0.6 → 0.3u로 줄인 그대로다
      hatch: { on: false, from: -35, to: 125, depth: 0.3, gap: 0.2, width: 0.055 },
      // 걸기의 각도 — 여섯 안(0 · 6 · 12 · 18° 올림, 6 · 12° 내림)을 4/5 격자로 보고 둘을 골라 두 칸으로 나눴다
      // (2026-09-28, 디자이너): 올려 걸기 = 오른쪽이 12° 올라감, 내려 걸기 = 오른쪽이 6° 내려감.
      // 같은 날 차분한의 칸을 걸기 셋으로 한정하며 기울지 않은 중간 걸기(0°)가 더해졌다
      hang: { up: -12, mid: 0, down: 6, drop: 1 },
      // 넘치기 — 카드 R18의 값 그대로(격자에서 0.2 · 0.35 · 0.5u를 보고 0.5는 너무 많이 먹어 뺐다).
      // 처음엔 고르는 칸이었다가 같은 날 가운데 돌의 기본이 됐다(디자이너 — "넘치기는 기본 기능으로")
      overflow: { angle: [15, 35], depth: [0.2, 0.35] },
      // 윤곽 따라 — 카드 R20: 줄 사이 한 줄 비우기(ㄷ), 비탈 ±35° 안. 윤곽에서 더 떼기(ㄱ)는 안 골랐다
      // 돌은 가운데 돌의 절반에서 시작해 글이 다 얹힐 때까지만 키우고, 한 줄은 가장 긴 줄의 1.1배까지만 얹는다 —
      // 둘 다 없이는 윗 윤곽이 길어 글이 한두 줄로 위에만 얹히고 몸 아래가 비었다(4/5에서 글 여섯으로 봄)
      contour: { inset: 0.45, gap: 1, slope: 35, start: 0.5, grow: 1.04, fill: 1.1 },
      // 밑면 — 무게중심 좌우 돌 폭의 20%씩(밑면이 폭의 40% 이상). 벽 바닥에 꼭짓점으로 서던 것을 변으로 앉힌다(2026-09-29)
      base: { half: 0.2, clear: 0.05 } } },
  // 구슬 구름 (2026-09-28). 꽃 → 옛 뭉게구름(부풀던 원 + 번짐)을 거쳐, 당당한 박스의 틀(글에 붙는 덩어리)을
  // 구름으로 옮겼다 — 밑은 평평하고 위와 양옆에 봉우리, 사방 여백을 고르게, 굵은 구슬 한 크기로 찍는다.
  // 원을 부풀리지 않아 lobe · fill · gap · spread는 쓰이지 않는다. 행간 1.1은 나무와 같다.
  // 고른 과정과 버린 것은 design/landscape.md '구름'.
  doran: { key: 'doran', edge: 'bead', lobe: [1.1, 1.6], fill: [0.5, 0.75], gap: 1.6, spread: [0, 0.9], sat: 0, blur: 0, lh: 1.1,
    bead: { step: 0.6, r: 0.36, side: 0.55, top: 0.35, lets: { count: [1, 2, 2, 2, 3, 3], sizes: [[3, 5], [1, 3], [1, 2]], angle: [-20, 200], apart: 50 }, gap: [0.3, 0.8], bob: 0.3, arc: { bow: 1.3, fan: 130, band: 0.45 } } },
  // 새 · 박쥐 (2026-09-29). 픽셀 구름 → 나비(시안) → 말투가 가른다: 귀여운 = 새, 시니컬한 = 박쥐. 기하 도형만.
  // 원을 부풀리지 않아 lobe · fill · gap · spread · cell은 쓰이지 않는다(cell은 옛 픽셀 구름의 격자 — 그리는 코드가 남아 있다).
  // 새: 몸 원 · 머리 0.55R · 꼬리 4u(글이 두 방향 중 하나). 박쥐: 한 몸, 귀 · 아래 끝 · 날개는 두 줄 견본에서 잰 길이 그대로.
  // 고른 과정과 200개로 잰 것은 design/landscape.md '새' · '박쥐'.
  deulseok: { key: 'deulseok', edge: 'creature', lobe: [1.1, 1.6], fill: [0.55, 0.75], gap: 1.7, spread: [0, 0.8], sat: 0, blur: 0, cell: 0.5,
    creature: {
      bird: { grow: 1.02, head: { r: 0.55, at: -38, out: 0.5 }, beak: { len: 0.34, half: 0.2 },
        tail: { len: 4, half: { root: 0.18, tip: 0.5 }, root: 0.78, up: { from: 200, to: 195 }, down: { from: 165, to: 150 }, fly: { from: 185, to: 185 } },
        wing: { root: 0.3, at: 250, r: 1.3, dir: 232, span: 58 } },
      bat: { ear: { h: 2.1, in: 0.12, out: 0.85, tip: 0.93 }, foot: 1.9, span: 3.4, unit: 2.1, top: 0.63, side: 0.15, hip: 0.5,
        reach: 5.32, sag: 0.22, fly: { lift: 0.7, n: 3, drop: 0.7 }, hang: { lift: -0.3, n: 2, drop: 0.9 },
        // 매달린 채의 몸짓 — 움직이는 견본에서 고른 값(2026-09-29, 디자이너 — "모두 반영")
        twitch: { lift: 0.05, n: 2, drop: 0.6 }, stretch: { lift: 1.1, n: 2, drop: 0.5, span: 1.6 } } } }
};

/** 성격 → 구름. 옛 Firestore 문서의 서체 키는 fontMap과 같은 칸으로 보낸다 */
const BY_FONT: Record<string, string> = {
  ttoryeot: 'ttoryeot', chabun: 'chabun', doran: 'doran', deulseok: 'deulseok',
  gothic: 'ttoryeot', myeongjo: 'chabun', song: 'deulseok'
};
export function personaFor(font?: string): Persona {
  return PERSONAS[BY_FONT[font ?? ''] ?? 'chabun'];
}

/**
 * 글자 한 칸의 실제 폭 — 서체마다 다르다. 100px로 재서 나눈 값(2026-09-22).
 * 한글은 셋이 정확히 1em인데 핸드젯만 0.722em이다. 띄어쓰기는 셋이 0.35em,
 * 핸드젯 0.177em. 이걸 안 재고 '한 칸 = 1u'로 두면 핸드젯 글은 늘 여백이
 * 넉넉하고 장평 1.3의 다카포 글은 윤곽을 뚫는다.
 */
/* 2026-09-25에 다시 쟀다(서체가 다 받아진 뒤, 100px). 둥켈·본명조·핸드젯이
   표와 달랐다 — 둥켈 1 → 0.839(폭 축 700, 기본), 본명조 1 → 0.989, 핸드젯
   0.722 → 0.790(굵기·말투와 상관없이 같다). 먼저 잰 값은 서체가 덜 받아진
   채 대신 선 서체를 쟀던 것으로 보인다. 둥켈은 폭 축을 따라 넓어진다
   (1000에서 0.984) — advanceFor가 그 사이를 잇는다.
   2026-09-28에 둥켈을 또 쟀다: 한글은 **고정폭**이고 폭 축 700 = 0.678, 850 = 0.823, 1000 = 0.967
   (곧은 선 위 — advanceFor의 보간이 맞다). 09-25의 0.839는 어도비 킷이 글자를 덜 받아 와 일부가
   대체 서체(Pretendard 0.864)로 그려진 채 잰 값이다 — 킷은 화면에 오른 글자만 받아 오므로, 잴 때는
   그 글자를 먼저 화면에 올리고 기다려야 한다. 나무의 머리는 글에 바짝 붙어 이 표가 곧 여백이다.
   같은 날 본명조(차분한)도 같은 방법으로 쟀다: 한글 0.966 · 0.970(굵기 300 · 445 · 600 모두), 띄어쓰기 0.31 —
   표의 0.989는 2% 넓었다. 돌의 넘치기(R18)가 줄 끝을 파고드는 깊이가 이 표에 걸려 있어 0.97로 고쳤다. */
const ADVANCE: Record<string, { hangul: number; space: number }> = {
  ttoryeot: { hangul: 0.678, space: 0.116 },
  chabun: { hangul: 0.97, space: 0.31 },
  doran: { hangul: 1, space: 0.35 },
  deulseok: { hangul: 0.79, space: 0.177 },
  botong: { hangul: 0.864, space: 0.251 }
};
/** 둥켈산스 폭 축 1000에서의 글자폭 */
const TTORYEOT_WIDE = { hangul: 0.967, space: 0.174 };
function advanceFor(key: string, wdth?: number) {
  const a = ADVANCE[key] ?? ADVANCE.botong;
  if (key !== 'ttoryeot' || !wdth) return a;
  const k = Math.min(1, Math.max(0, (wdth - 700) / 300));
  return { hangul: a.hangul + (TTORYEOT_WIDE.hangul - a.hangul) * k, space: a.space + (TTORYEOT_WIDE.space - a.space) * k };
}
const LATIN = 0.55;

export interface Circle {
  x: number; y: number; r: number;
  kind: 'lobe' | 'fill' | 'sat';
  /** 파동의 위상(자리)과 느린 결의 위상 — 0..1 */
  p1: number; p2: number;
  /** 조각만: 옮겨 다니는 방향과 위상 */
  sx: number; sy: number; p3: number; p4: number;
}
type Pt = readonly [number, number];
export interface Spike { lobe: number; pts: readonly [Pt, Pt, Pt] }
/** 한 변의 안쪽 띠 — 빗금이 들어갈 자리. 변의 두 끝과 안쪽으로 물러난 두 점 */
export type Quad = readonly [Pt, Pt, Pt, Pt];
/** 차분한의 돌. 원점 = 구름 상자 왼쪽 위, u 단위 */
export interface Stone {
  /** 꼭짓점 — 곧은 변으로 잇는다. 모서리 굴림은 그리는 쪽이 */
  pts: Pt[];
  /** 오른쪽 아래 안쪽 빗금의 띠들 */
  hatch: Quad[];
}
/** 당당한의 나무 — 실루엣 하나. 원점 = 구름 상자 왼쪽 위, u 단위 */
export type TreeTier =
  | { kind: 'tri'; pts: Pt[] }                              // 예리한 — 맨 위는 세 점(이등변 삼각형), 아래 단은 네 점(목 → 밑변)
  | { kind: 'disc'; cx: number; cy: number; r: number };   // 온화한 — 같은 원
export interface Tree {
  sharp: boolean;
  tiers: TreeTier[];
  /** 벽에서 바닥까지 잇는 단(원) — 폰 판 아래로 이어지고 상자(w · h)에는 안 든다. 벽이 키만큼 보이게 하고 화면 밑이 자른다 */
  more: TreeTier[];
}

/** 다정한의 구슬 구름. 원점 = 구름 상자 왼쪽 위, u 단위 */
export interface Beads {
  /** 구슬 반지름 — 모두 한 크기 */
  r: number;
  /** 본 구름의 구슬 중심 */
  body: Pt[];
  /** 곁의 작은 구름들 — 구름마다 구슬 중심. 벽에서 저마다 오르내린다(상자에 그 폭까지 넣었다) */
  lets: Pt[][];
  /** 글자 한 자씩의 가운데(띄어쓰기 빼고, 줄 차례대로) — 벽에서 남의 구슬이 이 자리를 비켜 가고, 펄럭임이 이 차례로 지나간다 */
  chars: Pt[];
}

/** 유머있는의 새 · 박쥐 한 자세 — 원과 다각형. 원점 = 구름 상자 왼쪽 위, u 단위 */
export interface CreaturePose { discs: { cx: number; cy: number; r: number }[]; polys: Pt[][] }
/**
 * 유머있는의 새(귀여운) · 박쥐(시니컬한). 자세마다 한 벌 — rest는 폰(4/5 · 5/5)의 자세이고 상자(w · h)는 이것으로 잰다:
 * 새는 앉되 원을 자르지 않고, 박쥐는 거꾸로 매달린다(형상만 뒤집고 글은 바로 선다). sit · fly는 벽이 고르는 자세 —
 * 새는 앉음(원을 자르지 않는다 — 폰의 자세와 같다, 2026-09-29) · 날기(부채 날개, 꼬리를 곧게), 박쥐는 날기(펼침). 상자 밖으로 나갈 수 있다
 */
export interface Creature {
  kind: 'bird' | 'bat';
  poses: { rest: CreaturePose; fly: CreaturePose; sit?: CreaturePose; twitch?: CreaturePose; stretch?: CreaturePose };
}

/** 휜 배치의 글자 한 자 — 글 상자 왼쪽 위에서 가운데까지(em), 기울기(rad) */
export interface Glyph { c: string; x: number; y: number; a: number }
/**
 * 형상이 정한 글 배치 — 말풍선(VoiceBubble)이 이대로 그린다(CloudBubble이 넘긴다).
 * lines = 형상이 다시 나눈 줄(사다리꼴), track = 줄마다 더하는 자간(em, 균등 배분 · 사다리꼴),
 * glyphs · box = 한 자씩 놓은 자리와 글 상자(em, 아치 · 부채꼴 · 미소),
 * align = 줄 맞춤(걸기는 왼끝), rotate = 글 상자를 제 가운데로 돌리는 각(rad, 걸기)
 */
export interface TextLayout {
  lines?: string[];
  track?: number[];
  glyphs?: Glyph[];
  box?: { w: number; h: number };
  align?: 'left' | 'center' | 'right';
  rotate?: number;
}

export interface Cloud {
  persona: Persona;
  rule: 'B' | 'C';
  /** 원점 = 구름 상자 왼쪽 위. u 단위 */
  circles: Circle[];
  /** 당당한의 갈래. 점은 제 덩이 중심 기준 — 덩이가 부풀면 같이 부푼다 */
  spikes: Spike[];
  /** 차분한의 돌. 있으면 circles · spikes는 비어 있다 */
  stone?: Stone;
  /** 당당한의 나무. 있으면 circles · spikes는 비어 있다 */
  tree?: Tree;
  /** 다정한의 구슬 구름. 있으면 circles · spikes는 비어 있다 */
  beads?: Beads;
  /** 유머있는의 새 · 박쥐. 있으면 circles · spikes는 비어 있다 */
  creature?: Creature;
  /** 형상이 정한 글 배치. 없으면 들어온 줄 그대로 */
  layout?: TextLayout;
  /** 구름 상자 (u) */
  w: number; h: number;
  /** 글 덩어리가 앉는 자리 (상자 안, u) */
  text: { x: number; y: number; w: number; h: number };
}

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** 한 줄의 폭 (u). 한글·띄어쓰기·라틴을 따로 세고 광학 보정과 장평을 곱한다 */
function lineWidth(line: string, font: string | undefined, optic: number, scaleX: number, slant: number, wdth?: number, track = 0): number {
  const adv = advanceFor(BY_FONT[font ?? ''] ?? font ?? '', wdth);
  let w = 0;
  for (const ch of Array.from(line)) {
    if (ch === ' ') w += adv.space;
    else if (/[A-Za-z0-9.,!?'"-]/.test(ch)) w += LATIN;
    else w += adv.hangul;
    w += track;   // 자간은 글자마다 붙는다(차분한 -0.025em)
  }
  // 기운 글자는 위아래 끝이 옆으로 나간다 — 줄 높이의 반 × tan
  const lean = Math.abs(Math.tan((slant * Math.PI) / 180)) * LINE_HEIGHT * optic;
  return w * optic * scaleX + lean;
}

interface Options {
  /** 씨앗. 안 주면 글 자체 — 미리보기와 벽이 같은 구름을 봐야 한다 */
  seed?: string;
  /** 짧은 글의 최소 지름을 덮어쓴다 (u). 조율 격자가 쓴다 */
  minDiameter?: number;
  /** 장평 (03의 '빠르기') */
  scaleX?: number;
  /** 기울기 (도) */
  slant?: number;
  /** 세로 비율 (2026-09-25 표 — 당당한·유머있는·차분한의 한쪽 끝) */
  scaleY?: number;
  /** 둥켈산스 폭 축 */
  wdth?: number;
  /** 자간 (em) */
  track?: number;
  /** 3/5 말투 — 나무가 머리를 고른다(1 = 예리한 · 0 = 온화한, palettes.ts의 MANNER와 같은 차례) */
  manner?: number;
  /** 4/5 정렬 — 나무 · 구름은 이것으로 글 배치와 제 모양을 바꾼다(arrangementsFor) */
  align?: Align;
}

/**
 * 성격마다 4/5에서 고를 수 있는 정렬 — 첫째가 기본(가운데)은 아니다: 고전 셋은 왼쪽 · 가운데 · 오른쪽 차례.
 * 나무 · 구름은 제 정렬만 준다(2026-09-28 디자이너 — 나무는 '양끝 정렬의 정도', 구름은 '다정함과 어울리는 휜 배치').
 */
const ARRANGEMENTS: Record<string, readonly Align[]> = {
  // 나무 — 기본 · 사선 · 세로쓰기(2026-09-29, 디자이너 레퍼런스). 균등 배분 · 사다리꼴(09-28)은 실루엣이 하나가 되며 뺐다 —
  // 그 옛 글은 기본으로 선다
  ttoryeot: ['center', 'slant', 'vertical'],
  // 차분한 — 걸기 셋으로 한정했다(2026-09-28, 디자이너 — "올려 걸기, 중간 걸기, 내려 걸기만"). 가운데 칸은 없다 —
  // 가운데 돌(늘 넘침, R18)은 칸이 생기기 전의 옛 글에만 선다. 윤곽 따라(R20, contourText)는 칸에서 뺐지만 되살릴 수
  // 있게 코드를 둔다(빗금처럼). 세로쓰기(R19)는 다른 태도용으로 남겨 둔다
  chabun: ['hang-up', 'hang-mid', 'hang-down'],
  doran: ['center', 'arch', 'fan', 'smile']
};
export function arrangementsFor(font: string | undefined): readonly Align[] {
  return ARRANGEMENTS[BY_FONT[font ?? ''] ?? ''] ?? ['left', 'center', 'right'];
}
/**
 * 이 글의 줄 — 앱 전체는 한 줄 12자(fit.ts)인데 나무(당당한)의 기본 · 사선만 per자(8)로 접는다. 좁고 뾰족한 실루엣에
 * 12자 줄은 옆으로 넓어 나무가 커지고 벽의 글이 작아졌다. 세로쓰기는 12자 그대로(디자이너, 2026-09-29)
 */
export function linesFor(text: string, tone: { font?: string; align?: Align } | null | undefined): string[] {
  const t = tone?.font ? personaFor(tone.font).tree : undefined;
  return t && tone?.align !== 'vertical' ? foldLines(text, t.per) : foldLines(text);
}

/** 4/5에 처음 들어왔을 때 골라져 있는 칸 — 가운데가 있으면 가운데, 차분한은 중간 걸기 */
export function defaultAlign(font: string | undefined): Align {
  const list = arrangementsFor(font);
  return list.includes('center') ? 'center' : list.includes('hang-mid') ? 'hang-mid' : list[0];
}

/**
 * 조율 값 그대로 구름을 만든다 — 서체별 표(palettes.ts · formFor)가 계산한
 * 장평·세로·기울기·폭 축·자간을 넘긴다. 4/5와 벽이 같은 이 함수를 쓴다.
 */
export function cloudForTone(lines: readonly string[], tone: (Parameters<typeof formFor>[0] & { align?: Align }) | null | undefined, o: Pick<Options, 'seed' | 'minDiameter'> = {}): Cloud {
  // 같은 글 · 같은 조율이면 같은 구름이다(씨앗이 글) — 한 번 지은 것을 둔다. 벽은 1초마다 열두 글의 구름을 다시 묻는데,
  // 나무는 품을 크기를 찾느라 한 번에 수 ms가 든다(2026-09-29)
  const key = JSON.stringify([lines, tone, o]), had = MADE.get(key);
  if (had) return had;
  let c: Cloud;
  if (!tone) c = cloudFor(lines, undefined, o);
  else {
    const f = formFor(tone);
    c = cloudFor(lines, tone.font, { ...o, scaleX: f.scaleX, scaleY: f.scaleY, slant: f.slant, wdth: f.wdth, track: parseFloat(f.letterSpacing) || 0, manner: tone.manner, align: tone.align });
  }
  if (MADE.size >= 300) MADE.delete(MADE.keys().next().value!);
  MADE.set(key, c);
  return c;
}
/** 지은 구름 — 오래된 것부터 버린다 */
const MADE = new Map<string, Cloud>();

/**
 * 이 글의 구름.
 *
 * 차례: ① 줄마다 큰 덩이를 드문드문 ② 두 줄까지는 최소 지름을 채우는 큰 덩이
 * ③ 글 상자 + 여백의 테두리와 **안쪽**을 훑어 안 덮인 자리마다 작은 원(목)
 * ④ 조각 ⑤ 당당한이면 윤곽 위 둘레에 갈래.
 *
 * 같은 크기의 원을 촘촘히 두면 모서리만 둥근 상자가 된다(첫 시안). 윤곽의
 * 변화는 원의 크기 차이와 성김에서 온다.
 */
export function cloudFor(lines: readonly string[], font: string | undefined, o: Options = {}): Cloud {
  const pr = personaFor(font);
  const optic = opticalFix[font ?? '']?.scale ?? 1;
  const scaleX = o.scaleX ?? 1, slant = o.slant ?? 0;
  /* 세로 비율은 글 덩어리를 가운데에서 누른다 — 보이는 줄 높이가 그만큼 준다 */
  const LH = (pr.lh ?? LINE_HEIGHT) * optic * (o.scaleY ?? 1);   // 줄 높이 (u)
  const H = LH / 2 + PAD;                                  // 줄 위아래로 반드시 덮을 반높이
  const R = rng(hash((o.seed ?? lines.join('\n')) + '|' + pr.key));
  const pick = (range: readonly [number, number]) => range[0] + (range[1] - range[0]) * R();

  // 글 덩어리. 줄은 가운데 정렬 — VoiceBubble이 그렇게 앉힌다
  const widths = lines.map((l) => lineWidth(l, font, optic, scaleX, slant, o.wdth, o.track ?? 0));
  const TW = Math.max(0.5, ...widths), TH = Math.max(1, lines.length) * LH;
  const boxes = widths.map((w, i) => ({ x0: (TW - w) / 2, x1: (TW + w) / 2, yc: (i + 0.5) * LH }));
  const rule: 'B' | 'C' = boxes.length <= 2 ? 'B' : 'C';
  if (pr.edge === 'stone' && pr.stone) return stoneFor(pr, rule, TW, TH, R, o.align === 'hang-up' || o.align === 'hang-mid' || o.align === 'hang-down' || o.align === 'contour' ? o.align : 'center', widths, LH, o.align,
      o.align === 'contour' ? { lines, font, optic, scaleX, wdth: o.wdth, track: o.track ?? 0 } : undefined);
  if (pr.edge === 'tree' && pr.tree) return treeFor(pr, rule, lines, font, optic, scaleX, o, LH);
  if (pr.edge === 'bead' && pr.bead) {
    if (o.align === 'arch' || o.align === 'fan' || o.align === 'smile') return beadArcFor(pr, rule, lines, font, optic, scaleX, o, LH, R, o.align);
    return beadFor(pr, rule, TW, TH, R, charCenters(lines, font, optic, scaleX, o.wdth, o.track ?? 0, TW, LH));
  }
  // 말투가 없는 옛 글은 귀여운(새)이다 — 0이 귀여운, 1이 시니컬한(palettes.ts의 MANNER 차례)
  if (pr.edge === 'creature' && pr.creature) return creatureFor(pr, rule, TW, TH, R, o.manner === 1 ? 'bat' : 'bird');

  const circles: Circle[] = [];
  const put = (x: number, y: number, r: number, kind: Circle['kind']) =>
    circles.push({ x, y, r, kind, p1: 0, p2: R(), sx: R() > 0.5 ? 1 : -1, sy: R() > 0.5 ? 1 : -1, p3: R(), p4: R() });
  const inside = (x: number, y: number) => circles.some((c) => Math.hypot(c.x - x, c.y - y) <= c.r);

  // ① 큰 덩이 — 줄마다 드문드문. C에서는 줄을 한 줄씩 위아래로 어긋내 줄이 제 덩이를 갖게 한다
  boxes.forEach((b, li) => {
    const a = b.x0 + 0.4, z = b.x1 - 0.4, len = Math.max(0, z - a);
    const k = Math.max(1, Math.round(len / (pr.gap * H)));
    const yj = rule === 'C' ? (li % 2 ? 1 : -1) * 0.15 : 0;
    for (let i = 0; i < k; i++) {
      const x = k === 1 ? (a + z) / 2 : a + (len * (i + 0.5 + (R() - 0.5) * 0.5)) / k;
      put(x, b.yc + yj + (R() - 0.5) * 0.5 * H, H * pick(pr.lobe), 'lobe');
    }
    const sl = pick(pr.spread), sr = pick(pr.spread);
    if (sl > 0) put(a - sl, b.yc + (R() - 0.5) * 0.8, H * pick(pr.lobe) * 0.85, 'lobe');
    if (sr > 0) put(z + sr, b.yc + (R() - 0.5) * 0.8, H * pick(pr.lobe) * 0.85, 'lobe');
  });

  // ② 짧은 글의 최소 자리. 긴 글에 쓰면 귀만 두 개 남고 아래가 좁아져 자루가 된다
  const cx = TW / 2, cy = TH / 2;
  if (rule === 'B') {
    const want = (o.minDiameter ?? B_MIN_DIAMETER) / 2;
    const ext = () => Math.max(...circles.map((c) => Math.hypot(c.x - cx, c.y - cy) + c.r));
    let guard = 0;
    while (ext() < want && guard++ < 12) {
      const t = R() * Math.PI * 2, r = want * (0.3 + 0.3 * R());
      put(cx + Math.cos(t) * (want - r), cy + Math.sin(t) * (want - r) * 0.9, r, 'lobe');
    }
  }

  // ③ 메움. 테두리만 훑으면 성긴 덩이 사이에 구멍이 남는다 — 차분한 다섯 줄에서
  //    글 사이에 검은 점이 났다. 안쪽 점은 바깥 방향이 없어 원이 그 자리에 앉는다.
  const need: Array<[number, number, number, number]> = [];
  for (const b of boxes) {
    const xa = b.x0 - PAD, xz = b.x1 + PAD, yt = b.yc - H, yb = b.yc + H;
    const n = Math.max(2, Math.ceil((xz - xa) / 0.35)), m = Math.max(2, Math.ceil((yb - yt) / 0.35));
    for (let i = 0; i <= n; i++) { const x = xa + ((xz - xa) * i) / n; need.push([x, yt, 0, -1], [x, yb, 0, 1]); }
    for (let j = 0; j <= m; j++) { const y = yt + ((yb - yt) * j) / m; need.push([xa, y, -1, 0], [xz, y, 1, 0]); }
    for (let j = 1; j < m; j++) for (let i = 1; i < n; i++) need.push([xa + ((xz - xa) * i) / n, yt + ((yb - yt) * j) / m, 0, 0]);
  }
  for (let pass = 0; pass < 3; pass++) {
    for (const [x, y, nx, ny] of need) {
      if (inside(x, y)) continue;
      const r = H * pick(pr.fill);
      put(x - nx * r * 0.8, y - ny * r * 0.8, r, 'fill');   // 점을 덮되 중심은 안쪽으로
    }
  }

  // ④ 조각 — 붙거나 조금 떨어져서. 움직일 때 이것만 자리를 옮긴다
  for (let i = 0; i < pr.sat; i++) {
    const t = R() * Math.PI * 2;
    const base = circles[Math.floor(R() * circles.length)];
    const r = 0.22 + 0.45 * R();
    const gap = (R() * 1.5 - 0.3) * r;
    put(base.x + Math.cos(t) * (base.r + r + gap), base.y + Math.sin(t) * (base.r + r + gap), r, 'sat');
  }

  // ⑤ 갈래 — 윤곽 위에 선 둘레에만. 밑동은 원 안에 0.25u 물려 번짐이 합친다
  const spikes: Spike[] = [];
  if (pr.spike) {
    const sp = pr.spike;
    circles.forEach((c, ci) => {
      if (c.kind === 'sat') return;
      const n = Math.max(6, Math.round((2 * Math.PI * c.r) / sp.gap));
      const off = R() * Math.PI * 2;
      for (let i = 0; i < n; i++) {
        const t = off + (i / n) * Math.PI * 2;
        const px = c.x + Math.cos(t) * c.r, py = c.y + Math.sin(t) * c.r;
        if (circles.some((o) => o !== c && o.kind !== 'sat' && Math.hypot(o.x - px, o.y - py) <= o.r - 0.05)) continue;
        const d = pick(sp.depth), b = sp.base;
        const ux = Math.cos(t), uy = Math.sin(t), tx = -uy, ty = ux;
        const r0 = c.r - 0.25;
        spikes.push({ lobe: ci, pts: [
          [ux * r0 + tx * b, uy * r0 + ty * b],
          [ux * (c.r + d), uy * (c.r + d)],
          [ux * r0 - tx * b, uy * r0 - ty * b]
        ] });
      }
    });
  }

  // 상자. 부풀었을 때(AMP)와 갈래·격자·번짐이 나갈 자리까지 넣는다
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = 1 + AMP;
  for (const c of circles) {
    const r = c.r * grow + (c.kind === 'sat' ? DRIFT : 0);
    minX = Math.min(minX, c.x - r); maxX = Math.max(maxX, c.x + r);
    minY = Math.min(minY, c.y - r); maxY = Math.max(maxY, c.y + r);
  }
  for (const s of spikes) {
    const c = circles[s.lobe];
    for (const p of s.pts) {
      minX = Math.min(minX, c.x + p[0] * grow); maxX = Math.max(maxX, c.x + p[0] * grow);
      minY = Math.min(minY, c.y + p[1] * grow); maxY = Math.max(maxY, c.y + p[1] * grow);
    }
  }
  const edge = pr.cell ? pr.cell * 1.6 : pr.blur * 2;
  minX -= edge; minY -= edge; maxX += edge; maxY += edge;

  // 파동의 위상은 자리다 — 상자 왼쪽에서 오른쪽으로. 구름마다 시작점을 어긋내
  // 벽에 열 개가 떠도 같은 박자로 안 뛴다.
  const phase0 = R();
  for (const c of circles) {
    c.x -= minX; c.y -= minY;
    c.p1 = (phase0 + c.x / LAMBDA) % 1;
  }
  return {
    persona: pr, rule, circles, spikes,
    w: maxX - minX, h: maxY - minY,
    text: { x: -minX, y: -minY, w: TW, h: TH }
  };
}

// ─── 차분한 — 날 선 돌 (2026-09-27) ──────────────────────────────────
// 고른 과정과 잰 결과는 design/landscape.md '돌'. 값은 PERSONAS.chabun.stone.

/** 다각형 안인가 (짝수-홀수 규칙) */
function inPolygon(x: number, y: number, P: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, yi] = P[i], [xj, yj] = P[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 반평면으로 자른다 — n·p ≤ c 쪽을 남긴다 (Sutherland–Hodgman) */
function clipHalf(P: readonly Pt[], nx: number, ny: number, c: number): Pt[] {
  const out: Pt[] = [];
  const side = (p: Pt) => nx * p[0] + ny * p[1] - c;
  for (let i = 0; i < P.length; i++) {
    const A = P[i], B = P[(i + 1) % P.length], da = side(A), db = side(B);
    if (da <= 0) out.push(A);
    if ((da <= 0) !== (db <= 0)) { const t = da / (da - db); out.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t]); }
  }
  return out;
}

/** 네모의 둘레 위 점들 — 돌이 품어야 할 자리를 잰다 */
function rimOf(x0: number, y0: number, x1: number, y1: number, n = 12): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    p.push([x0 + (x1 - x0) * t, y0], [x0 + (x1 - x0) * t, y1], [x0, y0 + (y1 - y0) * t], [x1, y0 + (y1 - y0) * t]);
  }
  return p;
}

/**
 * 빗금 자리 — 바깥 법선이 from~to를 향한 변들의 한 줄기를 끝까지, 변마다 안쪽 depth의 띠.
 *
 * 줄기가 없으면 오른쪽 아래(45°)에 가장 가까운 변 하나로 — 글 200개로 재 보니 그런
 * 돌은 없었지만(2026-09-27), '늘 있다'는 약속을 운에 맡기지 않는다.
 */
function hatchBands(P: readonly Pt[], cx: number, cy: number, h: { from: number; to: number; depth: number }): Quad[] {
  const n = P.length;
  const edges = P.map((A, i) => {
    const B = P[(i + 1) % n], L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1e-9;
    let nx = (B[1] - A[1]) / L, ny = -(B[0] - A[0]) / L;
    if (nx * ((A[0] + B[0]) / 2 - cx) + ny * ((A[1] + B[1]) / 2 - cy) < 0) { nx = -nx; ny = -ny; }
    const ang = (Math.atan2(ny, nx) * 180) / Math.PI;
    return { A, B, nx, ny, ang, ok: ang >= h.from && ang <= h.to };
  });
  const start = edges.findIndex((e, i) => e.ok && !edges[(i - 1 + n) % n].ok);
  let run: typeof edges = [];
  if (start >= 0) for (let j = 0; j < n && edges[(start + j) % n].ok; j++) run.push(edges[(start + j) % n]);
  if (!run.length) run = [edges.reduce((m, e) => (Math.abs(e.ang - 45) < Math.abs(m.ang - 45) ? e : m))];
  return run.map(({ A, B, nx, ny }): Quad => [A, B, [B[0] - nx * h.depth, B[1] - ny * h.depth], [A[0] - nx * h.depth, A[1] - ny * h.depth]]);
}

/** 다각형의 무게중심(넓이로) */
function centroidOf(P: readonly Pt[]): Pt {
  let a = 0, x = 0, y = 0;
  for (let i = 0; i < P.length; i++) {
    const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length], c = x0 * y1 - x1 * y0;
    a += c; x += (x0 + x1) * c; y += (y0 + y1) * c;
  }
  return Math.abs(a) < 1e-9 ? P[0] : [x / (3 * a), y / (3 * a)];
}

/**
 * 밑면(2026-09-29, 디자이너 — "모서리로 서 있는 게 아니라 변으로 밑에 와 마주해야"). 벽 바닥에 돌이 가장 낮은 꼭짓점
 * 하나로 서 있었다. 가장 낮은 곳을 수평으로 깨서 무게중심 좌우로 돌 폭의 half만큼은 밑면이 되게 한다 — 무게가 밑면
 * 위에 실려 있어야 서 있는 것으로 보인다. 돌을 굴려 제 변으로 눕히지 않은 까닭: 걸기의 글자 각도(올려 12° · 내려 6°)는
 * 참여자가 고른 값이라 벽이 바꾸면 안 된다. 그래서 4/5 · 5/5의 돌도 같은 밑면을 갖는다(같은 글은 같은 돌).
 * keep(글 + 여백)에서 clear 안쪽으로는 깨지 않는다 — 거기까지 올라가도 모자라면 밑면이 그만큼 좁다.
 */
function flatBase(P: Pt[], keep: readonly Pt[], half: number, clear: number): Pt[] {
  const xs = P.map((p) => p[0]), W = Math.max(...xs) - Math.min(...xs), [gx] = centroidOf(P);
  const bottom = Math.max(...P.map((p) => p[1])), top = Math.max(...keep.map((p) => p[1])) + clear;
  const chord = (y: number): [number, number] => {
    let l = Infinity, r = -Infinity;
    for (let i = 0; i < P.length; i++) {
      const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length];
      if ((y0 - y) * (y1 - y) > 0 || y0 === y1) continue;
      const x = x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
      l = Math.min(l, x); r = Math.max(r, x);
    }
    return [l, r];
  };
  let y = bottom;
  for (const step = W / 400; y > top; y -= step) {
    const [l, r] = chord(y);
    if (l <= gx - half * W && r >= gx + half * W) break;
  }
  y = Math.max(y, top);
  return y >= bottom - 1e-6 ? P : clipHalf(P, 0, 1, y);
}

/**
 * 차분한의 돌.
 *
 * 초타원(지수 3) 둘레에 꼭짓점을 흔들어 놓고 곧은 변으로 잇는다. 돌 전체를 기울이고,
 * 글 + 사방 여백을 다 품을 때까지 가운데에서 키운 뒤, 오른쪽 아래를 뺀 세 모서리 중
 * 둘을 깬다. 깨진 면은 글 + 여백에서 clear만큼 바깥을 지나 글을 다치지 않는다.
 *
 * 기울이고 깨는 것은 긴 글 때문이다 — 네다섯 줄의 글 덩어리는 네모라, 그걸 품는
 * 꼭짓점 여섯 개짜리 돌도 네모로 끌려갔다. 줄 수에 비례해 흔들기는 돌을 34%까지
 * 키웠고, 줄 따라 깎기는 네모를 더 잘 없앴지만 '깨진 돌'의 인상이 없었다.
 *
 * 원은 하나도 안 쓴다. 번지지도 숨 쉬지도 않는다 — 돌은 가만히 있다.
 */
function stoneFor(pr: Persona, rule: 'B' | 'C', TW: number, TH: number, R: () => number, mode: 'center' | 'hang-up' | 'hang-mid' | 'hang-down' | 'contour' = 'center', widths: readonly number[] = [TW], LH = TH, align?: Align,
  text?: { lines: readonly string[]; font: string | undefined; optic: number; scaleX: number; wdth?: number; track: number }): Cloud {
  const s = pr.stone!;
  /* 걸기(R17, 2026-09-28): 돌의 몸을 글 아래로 글 높이 × drop만큼 더 잡고 짓는다. 무작위 기울기는 쓰지 않는다 —
     차분한은 칸마다 같은 각도로 기운다(디자이너 — 올려 걸기 · 내려 걸기 두 칸). 윗변은 아래에서 곧게 자르고,
     다 지은 뒤 돌과 글을 그 각도만큼 돌린다 */
  const hang = mode === 'hang-up' || mode === 'hang-mid' || mode === 'hang-down', drop = hang ? TH * s.hang.drop : 0;
  const cx = TW / 2, cy = (TH + drop) / 2, a = TW / 2 + PAD, b = (TH + drop) / 2 + PAD;
  const pick = (range: readonly [number, number]) => range[0] + (range[1] - range[0]) * R();
  const k = s.corners[0] + Math.floor(R() * (s.corners[1] - s.corners[0] + 1));
  const tilt0 = ((R() < 0.5 ? -1 : 1) * pick(s.tilt) * Math.PI) / 180, tilt = hang ? 0 : tilt0;
  const off = R() * Math.PI * 2;
  const sup = (v: number) => Math.sign(v) * Math.abs(v) ** (2 / 3);

  // 꼭짓점 — 초타원을 12% 넉넉히 잡고 자리와 거리를 흔든다
  let pts: Pt[] = [];
  for (let i = 0; i < k; i++) {
    const t = off + ((i + (R() - 0.5) * 2 * s.slot) / k) * Math.PI * 2;
    const m = 1 + (R() - 0.5) * 2 * s.reach;
    const x = a * 1.12 * sup(Math.cos(t)) * m, y = b * 1.12 * sup(Math.sin(t)) * m;
    pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  pts.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));

  // 글 + 사방 여백을 다 품을 때까지 키운다(걸기는 처지는 몸까지)
  const need = rimOf(-PAD, -PAD, TW + PAD, TH + PAD + drop);
  for (let g = 0; g < 120 && !need.every(([x, y]) => inPolygon(x, y, pts)); g++) {
    pts = pts.map(([x, y]): Pt => [cx + (x - cx) * 1.02, cy + (y - cy) * 1.02]);
  }

  // 깨기 — 오른쪽 아래(빗금 자리)는 두고 나머지 셋 중 count곳, 사분면 안의 각도로
  const quads: Pt[] = [[-1, -1], [1, -1], [-1, 1]];
  for (let i = quads.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [quads[i], quads[j]] = [quads[j], quads[i]]; }
  /* 넘치기(R18, 2026-09-28) — 가운데 돌의 기본(디자이너). 깨진 모서리 하나를 가파르게(overflow.angle) 깨서 그 면이
     가장 바깥 줄 끝을 overflow.depth만큼 파고들게 한다 — 형상이 글을 다 품지 않는다. 파고드는 쪽은 빗금 자리(오른쪽
     아래)의 반대편, 왼쪽이다(위 · 아래 모서리 중 글이 씨앗으로 하나). 넘친 글자의 색은 뒤집지 않는다(디자이너) — 검은
     바탕에 묻히면 묻힌 대로. 다른 깨짐 하나는 그대로 글 + 여백 바깥을 지난다. '끝의 기준' 2번의 예외다(landscape.md).
     줄 끝은 실제 줄 맞춤으로 잡는다 — 벽에는 왼쪽 · 오른쪽으로 맞춘 옛 글도 떠 있다 */
  let cracks = quads.slice(0, s.crack.count);
  if (mode === 'center') {
    const sy = R() < 0.5 ? -1 : 1, th = (pick(s.overflow.angle) * Math.PI) / 180, d = pick(s.overflow.depth);
    const ux = -Math.cos(th), uy = sy * Math.sin(th);
    const x0Of = (w: number) => (align === 'left' ? 0 : align === 'right' ? TW - w : (TW - w) / 2);
    const ends = widths.flatMap((w, i): Pt[] => { const x0 = x0Of(w), x1 = x0 + w; return [[x0, i * LH], [x1, i * LH], [x0, (i + 1) * LH], [x1, (i + 1) * LH]]; });
    pts = clipHalf(pts, ux, uy, Math.max(...ends.map(([x, y]) => ux * x + uy * y)) - d);
    cracks = quads.filter(([qx, qy]) => !(qx === -1 && qy === sy)).slice(0, s.crack.count - 1);
  }
  for (const [sx, sy] of cracks) {
    const th = (pick(s.crack.angle) * Math.PI) / 180, ux = sx * Math.cos(th), uy = sy * Math.sin(th);
    if (hang && sy < 0) continue;                        // 걸기 — 위 모서리는 곧은 윗변이 어차피 자른다
    pts = clipHalf(pts, ux, uy, Math.max(...need.map(([x, y]) => ux * x + uy * y)) + s.crack.clear);
  }
  if (hang) pts = clipHalf(pts, 0, -1, PAD);              // 곧은 윗변 — 글 윗줄에서 여백만큼 위
  // 자른 자리에 겹친 점이 남으면 길이 0인 변이 생긴다
  pts = pts.filter((p, i) => { const q = pts[(i + 1) % pts.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-4; });

  // 윤곽 따라 — 글을 윤곽 위에 한 자씩. 다 안 얹히면 돌을 키운다(contourText)
  const flow = mode === 'contour' && text ? contourText(pts, text, LH, s.contour, Math.max(...widths)) : null;
  if (flow) pts = flow.pts;

  // 걸기 — 돌과 글을 글 윗줄 왼끝을 축으로 같이 돌린다. 글 상자는 돌리지 않은 크기 그대로, 가운데만 옮긴다
  const ang = hang ? ((mode === 'hang-up' ? s.hang.up : mode === 'hang-mid' ? s.hang.mid : s.hang.down) * Math.PI) / 180 : 0, ca = Math.cos(ang), sa = Math.sin(ang);
  const rot = ([x, y]: Pt): Pt => [x * ca - y * sa, x * sa + y * ca];
  if (hang) pts = pts.map(rot);
  const [tcx, tcy] = rot([TW / 2, TH / 2]);
  const [hcx, hcy] = rot([cx, cy]);
  // 밑면 — 벽 바닥에 모서리가 아니라 변으로 앉게(flatBase). 지킬 곳은 글 + 여백(윤곽 따라는 얹힌 글자마다) — 걸기가
  // 처지게 잡은 몸(drop)은 깨도 된다
  const keep = flow ? flow.glyphs.flatMap((g): Pt[] => rimOf(g.x - 0.6, g.y - 0.6, g.x + 0.6, g.y + 0.6, 1)) : rimOf(-PAD, -PAD, TW + PAD, TH + PAD).map(rot);
  pts = flatBase(pts, keep, s.base.half, s.base.clear);
  const hatch = s.hatch.on ? hatchBands(pts, hcx, hcy, s.hatch) : [];

  // 상자 — 원점을 왼쪽 위로. 가장자리가 잘리지 않게 조금 넉넉히
  const e = 0.05;
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs) - e, minY = Math.min(...ys) - e;
  const mv = ([x, y]: Pt): Pt => [x - minX, y - minY];
  if (flow) {
    const { glyphs, box } = flow, optic = text!.optic;
    return {
      persona: pr, rule, circles: [], spikes: [],
      stone: { pts: pts.map(mv), hatch: hatch.map((q): Quad => [mv(q[0]), mv(q[1]), mv(q[2]), mv(q[3])]) },
      w: Math.max(...xs) + e - minX, h: Math.max(...ys) + e - minY,
      text: { x: box.x0 - minX, y: box.y0 - minY, w: box.x1 - box.x0, h: box.y1 - box.y0 },
      layout: {
        glyphs: glyphs.map((g) => ({ c: g.c, x: (g.x - box.x0) / optic, y: (g.y - box.y0) / optic, a: g.a })),
        box: { w: (box.x1 - box.x0) / optic, h: (box.y1 - box.y0) / optic }
      }
    };
  }
  return {
    persona: pr, rule, circles: [], spikes: [],
    stone: { pts: pts.map(mv), hatch: hatch.map((q): Quad => [mv(q[0]), mv(q[1]), mv(q[2]), mv(q[3])]) },
    w: Math.max(...xs) + e - minX, h: Math.max(...ys) + e - minY,
    text: { x: tcx - TW / 2 - minX, y: tcy - TH / 2 - minY, w: TW, h: TH },
    ...(hang ? { layout: { align: 'left' as const, rotate: ang } } : {})
  };
}

/**
 * 윤곽 따라(R20, 2026-09-28) — 글이 돌의 윗 윤곽을 따라 휜다.
 *
 * 돌(볼록 껍질)을 안쪽으로 물린 선을 줄마다 하나씩 긋는다 — 첫 줄은 윤곽에서 inset + 반 줄, 다음 줄부터는
 * (1 + gap)줄씩 더 안으로(줄 사이를 한 줄 비운다, 카드의 ㄷ). 그 선의 윗 사슬(왼 끝 → 꼭대기 → 오른 끝) 가운데
 * 비탈이 ±slope° 안인 구간에만 글을 얹는다 — 왼쪽에서 오른쪽으로만 읽히게. 낱말은 쪼개지 않고, 한 줄에 들어갈
 * 만큼 넣고 남으면 다음 줄로. 줄마다 그 구간의 가운데에 놓고, 글자는 제 가운데가 선 위에 서서 선을 따라 기운다.
 * 한 줄에는 가장 긴 줄 폭의 fill배까지만 얹는다. 돌은 가운데 돌의 start배에서 시작해 다 얹힐 때까지 grow배씩
 * 키운다 — 글이 제 줄 수만큼 내려가며 윤곽의 메아리가 되고, 돌은 그 줄들을 품을 만큼 커진다. 발화자가 넣은 줄바꿈도 윤곽에 맡긴다(윤곽을 고른 것이 곧 그것이다).
 */
function contourText(P0: Pt[], t: { lines: readonly string[]; font: string | undefined; optic: number; scaleX: number; wdth?: number; track: number },
  LH: number, c: { inset: number; gap: number; slope: number; start: number; grow: number; fill: number }, lineW: number): { pts: Pt[]; glyphs: { c: string; x: number; y: number; a: number }[]; box: { x0: number; y0: number; x1: number; y1: number } } {
  const adv = advanceFor(BY_FONT[t.font ?? ''] ?? t.font ?? '', t.wdth);
  const aOf = (ch: string) => ((ch === ' ' ? adv.space : /[A-Za-z0-9.,!?'"-]/.test(ch) ? LATIN : adv.hangul) + t.track) * t.optic * t.scaleX;
  const words = t.lines.join(' ').split(/\s+/).filter(Boolean).map((w) => ({ w, cs: Array.from(w), len: Array.from(w).reduce((s, ch) => s + aOf(ch), 0) }));
  const sp = aOf(' '), maxTan = Math.tan((c.slope * Math.PI) / 180);
  const cx0 = P0.reduce((s, p) => s + p[0], 0) / P0.length, cy0 = P0.reduce((s, p) => s + p[1], 0) / P0.length;
  let P = P0.map(([x, y]): Pt => [cx0 + (x - cx0) * c.start, cy0 + (y - cy0) * c.start]);
  for (let tries = 0; tries < 120; tries++, P = P.map(([x, y]): Pt => [cx0 + (x - cx0) * c.grow, cy0 + (y - cy0) * c.grow])) {
    const hull = convexHull(P);
    const rows: Pt[][] = [];
    for (let k = 0; ; k++) {
      const d = c.inset + LH / 2 + k * (1 + c.gap) * LH, Q = insetPolygon(hull, d);
      if (Q.length < 3) break;
      const run = upperRun(Q, maxTan);
      if (run.length < 2) break;
      rows.push(run);
    }
    // 낱말을 줄에 채운다
    const placed: { c: string; x: number; y: number; a: number }[] = [];
    let wi = 0;
    for (const run of rows) {
      if (wi >= words.length) break;
      const RL = runLength(run), L = Math.min(RL, lineW * c.fill);
      let used = 0;
      const take: typeof words = [];
      while (wi < words.length) {
        const need = (take.length ? sp : 0) + words[wi].len;
        if (used + need > L) break;
        take.push(words[wi]); used += need; wi++;
      }
      let s = (RL - used) / 2;
      take.forEach((w, j) => {
        if (j) s += sp;
        for (const ch of w.cs) { const a = aOf(ch), [x, y, ang] = pointOnRun(run, s + a / 2); placed.push({ c: ch, x, y, a: ang }); s += a; }
      });
    }
    if (wi < words.length) continue;                     // 다 안 얹혔다 — 돌을 키운다
    const corners = placed.flatMap((g) => { const ca = Math.cos(g.a), sa = Math.sin(g.a), hw = aOf(g.c) / 2, hh = LH / 2;
      return [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]].map(([dx, dy]): Pt => [g.x + dx * ca - dy * sa, g.y + dx * sa + dy * ca]); });
    const xs = corners.map((p) => p[0]), ys = corners.map((p) => p[1]);
    return { pts: P, glyphs: placed, box: { x0: Math.min(...xs) - 0.06, y0: Math.min(...ys) - 0.06, x1: Math.max(...xs) + 0.06, y1: Math.max(...ys) + 0.06 } };
  }
  return { pts: P, glyphs: [], box: { x0: 0, y0: 0, x1: 1, y1: 1 } };
}

/** 볼록 껍질 — 벽의 물리가 돌을 볼록한 윤곽으로 치고(WallSimulation), 윤곽 따라가 글을 얹을 선을 이것에서 긋는다.
 *  깨진 면 때문에 아주 조금 오목한 자리가 생길 수 있다 */
export function convexHull(P: readonly Pt[]): [number, number][] {
  const p = P.map(([x, y]): [number, number] => [x, y]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], up: [number, number][] = [];
  for (const q of p) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of [...p].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}

/** 볼록 다각형을 d만큼 안으로 — 변마다 안쪽 반평면을 d 물려 자른다(볼록이면 곧 안쪽 평행선들의 교집합) */
function insetPolygon(H: readonly Pt[], d: number): Pt[] {
  let area = 0;
  for (let i = 0; i < H.length; i++) { const p = H[i], q = H[(i + 1) % H.length]; area += p[0] * q[1] - q[0] * p[1]; }
  const sgn = area > 0 ? 1 : -1;                          // 화면 좌표(y 아래)에서의 감는 방향
  let Q: Pt[] = [...H];
  for (let i = 0; i < H.length && Q.length >= 3; i++) {
    const p = H[i], q = H[(i + 1) % H.length], ex = q[0] - p[0], ey = q[1] - p[1], L = Math.hypot(ex, ey);
    if (L < 1e-9) continue;
    const nx = (-ey / L) * sgn, ny = (ex / L) * sgn;      // 안쪽 법선
    Q = clipHalf(Q, -nx, -ny, -(nx * p[0] + ny * p[1] + d));
  }
  return Q;
}

/** 볼록 다각형의 윗 사슬(가장 왼쪽 → 가장 오른쪽, 위로 도는 쪽)에서 비탈 |tan| ≤ maxTan인 이어진 구간 */
function upperRun(Q: readonly Pt[], maxTan: number): Pt[] {
  const n = Q.length;
  let li = 0, ri = 0;
  for (let i = 1; i < n; i++) { if (Q[i][0] < Q[li][0]) li = i; if (Q[i][0] > Q[ri][0]) ri = i; }
  const chain = (step: number) => { const out: Pt[] = [Q[li]]; for (let i = li; i !== ri; ) { i = (i + step + n) % n; out.push(Q[i]); } return out; };
  const a = chain(1), b = chain(-1), avg = (c: Pt[]) => c.reduce((s, p) => s + p[1], 0) / c.length;
  const top = avg(a) < avg(b) ? a : b;
  const run: Pt[] = [];
  for (let i = 0; i + 1 < top.length; i++) {
    const [x0, y0] = top[i], [x1, y1] = top[i + 1], dx = x1 - x0;
    if (dx > 1e-6 && Math.abs((y1 - y0) / dx) <= maxTan) { if (!run.length) run.push(top[i]); run.push(top[i + 1]); }
    else if (run.length) break;
  }
  return run;
}

function runLength(run: readonly Pt[]): number {
  let L = 0;
  for (let i = 0; i + 1 < run.length; i++) L += Math.hypot(run[i + 1][0] - run[i][0], run[i + 1][1] - run[i][1]);
  return L;
}

/** 구간의 처음에서 s만큼 간 자리와 그곳의 기울기(rad) */
function pointOnRun(run: readonly Pt[], s: number): [number, number, number] {
  for (let i = 0; i + 1 < run.length; i++) {
    const [x0, y0] = run[i], [x1, y1] = run[i + 1], L = Math.hypot(x1 - x0, y1 - y0);
    if (s <= L || i + 2 === run.length) { const t = Math.min(1, Math.max(0, s / L)); return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, Math.atan2(y1 - y0, x1 - x0)]; }
    s -= L;
  }
  return [run[0][0], run[0][1], 0];
}

// ─── 당당한 — 나무 (2026-09-28, 09-29 다시) ────────────────────────────
// 고른 과정과 잰 결과는 design/landscape.md '나무'. 값은 PERSONAS.ttoryeot.tree.

/**
 * 당당한의 나무 — 실루엣 하나에 글이 든다(2026-09-29, 디자이너 레퍼런스 Tree_reference_2 · 3). 기둥 · 줄무늬는 없다.
 *
 * 예리한(말투 1): 맨 위는 이등변 삼각형(밑변 반폭 s, 높이 s ÷ slope). 그 밑으로 단이 이어진다 — 단마다 밑변 반폭이
 * grow배로 넓어지고, 윗변(목)은 그 notch배, 옆변은 모두 같은 기울기. 온화한(말투 0): 반지름 s인 같은 원이 반지름만큼씩
 * 내려가며 겹친다.
 *
 * 품기: 줄마다의 네모(글자 높이 × 줄 길이, + PAD)의 둘레 점이 다 안에 들 때까지 s를 2%씩 키우고, 크기마다 글을 맨 위
 * 단(원) 안에서부터 내려 보며 처음 들어가는 자리에 둔다 — 가장 작은 나무, 들어가는 가장 위. 글 윗변이 맨 위 단(원)
 * 안에서 시작해야 한다: 안 막으면 아래 단일수록 넓어서 좁은 나무 한참 아래에 글을 두는 답을 골랐다(격자에서 봤다).
 * 폰 판은 글 아래 한 단(원) 더. 벽에서는 바닥까지 단(원)을 더 쌓는다(WallSimulation).
 *
 * 배열 셋 — 기본: 줄 가운데 맞춤(여느 글 상자). 사선: 줄마다 slant°(시계 방향) 기울고, 다음 줄은 왼쪽 아래로 한 행간,
 * 시작은 읽는 쪽으로 stagger × 글자 높이씩 밀린다(레퍼런스의 계단). 세로쓰기: 오른쪽 줄부터, 한 자씩 위에서 아래로.
 * 사선 · 세로쓰기는 한 자씩 자리를 정해 넘긴다(layout.glyphs — 다정한의 휜 배치와 같은 길).
 */
/** 벽이 바닥까지 이을 단(원)의 깊이 (u) — 벽의 가장 큰 나무 키(35%)를 가장 작은 글자(14px)로 재도 27u */
const MORE_U = 60;
function treeFor(pr: Persona, rule: 'B' | 'C', lines: readonly string[], font: string | undefined, optic: number, scaleX: number, o: Options, LH: number): Cloud {
  const t = pr.tree!, sharp = !!o.manner, mode = o.align === 'slant' || o.align === 'vertical' ? o.align : 'basic';
  const adv = advanceFor(BY_FONT[font ?? ''] ?? font ?? '', o.wdth), tr = o.track ?? 0;
  const lh = pr.lh ?? LINE_HEIGHT, gh = LH / lh;           // 글자 높이 (u) — 세로 비율까지
  const gw = optic * scaleX;                                // 세로쓰기 한 줄의 폭 — 글자 칸 1em (u)
  const L = lines.map((line) => {
    const cs = Array.from(line);
    const av = cs.map((ch) => ((ch === ' ' ? adv.space : /[A-Za-z0-9.,!?'"-]/.test(ch) ? LATIN : adv.hangul) + tr) * optic * scaleX);
    return { cs, av, len: Math.max(0.5, av.reduce((s, v) => s + v, 0)) };
  });
  const TW = Math.max(...L.map((l) => l.len));

  // 줄 네모 — 시작점 · 읽는 방향 · 두께 방향 · 길이 · 두께. 원점은 아무 데나(품은 뒤 옮긴다)
  type Run = { o: Pt; d: Pt; n: Pt; len: number; th: number };
  const runs: Run[] = [], placed: { c: string; x: number; y: number; a: number; w: number; h: number }[] = [];
  if (mode === 'vertical') {
    const colPitch = gw * lh;
    L.forEach((l, i) => {
      const x1 = -i * colPitch;                             // 이 줄의 오른쪽 끝
      let y = 0;
      l.cs.forEach((c) => {
        const step = c === ' ' ? adv.space * gh : gh;
        if (c.trim()) placed.push({ c, x: x1 - gw / 2, y: y + step / 2, a: 0, w: gw, h: gh });
        y += step;
      });
      runs.push({ o: [x1, 0], d: [0, 1], n: [-1, 0], len: Math.max(gh, y), th: gw });
    });
  } else if (mode === 'slant') {
    const th = (t.slant * Math.PI) / 180, d: Pt = [Math.cos(th), Math.sin(th)], n: Pt = [-Math.sin(th), Math.cos(th)];
    L.forEach((l, i) => {
      const o0: Pt = [n[0] * i * LH + d[0] * i * t.stagger * gh, n[1] * i * LH + d[1] * i * t.stagger * gh];
      let s = 0;
      l.cs.forEach((c, j) => {
        const k = s + l.av[j] / 2;
        if (c.trim()) placed.push({ c, x: o0[0] + d[0] * k + (n[0] * gh) / 2, y: o0[1] + d[1] * k + (n[1] * gh) / 2, a: th, w: l.av[j], h: gh });
        s += l.av[j];
      });
      runs.push({ o: o0, d, n, len: l.len, th: gh });
    });
  } else {
    L.forEach((l, i) => runs.push({ o: [-l.len / 2, i * LH + (LH - gh) / 2], d: [1, 0], n: [0, 1], len: l.len, th: gh }));
  }

  // 둘레 점 — 네모마다 여백(PAD)만큼 밖, 변마다 열 점
  const ring: Pt[] = [];
  for (const r of runs) {
    const at = (a: number, b: number): Pt => [r.o[0] + a * r.d[0] + b * r.n[0], r.o[1] + a * r.d[1] + b * r.n[1]];
    const cs = [at(-PAD, -PAD), at(r.len + PAD, -PAD), at(r.len + PAD, r.th + PAD), at(-PAD, r.th + PAD)];
    for (let k = 0; k < 4; k++) {
      const [x0, y0] = cs[k], [x1, y1] = cs[(k + 1) % 4];
      for (let q = 0; q < 10; q++) ring.push([x0 + ((x1 - x0) * q) / 10, y0 + ((y1 - y0) * q) / 10]);
    }
  }
  const rx = ring.map((p) => p[0]), ry = ring.map((p) => p[1]);
  const cx = (Math.min(...rx) + Math.max(...rx)) / 2, ry0 = Math.min(...ry), hh = Math.max(...ry) - ry0;
  const Q = ring.map(([x, y]): Pt => [x - cx, y - ry0]), half = Math.max(...Q.map((p) => Math.abs(p[0])));

  // 예리한의 단들 — 깊이 H까지. 온화한은 원 가운데가 s, 2s, 3s …
  const sharpTiers = (s: number, H: number, capB = Infinity) => {
    const out = [{ y0: 0, y1: s / t.slope, n: 0, B: s }];
    let y = s / t.slope, B = s;
    while (y < H) { B = Math.min(B * t.grow, capB); const n = t.notch * B, h = (B - n) / t.slope; out.push({ y0: y, y1: y + h, n, B }); y += h; }
    return out;
  };
  const inSharp = (T: ReturnType<typeof sharpTiers>, x: number, y: number) =>
    T.some((q) => y >= q.y0 && y <= q.y1 && Math.abs(x) <= q.n + ((y - q.y0) / (q.y1 - q.y0)) * (q.B - q.n));
  const inRound = (s: number, x: number, y: number) => {
    if (y < 0) return false;
    const j = Math.round((y - s) / s);
    return [j - 1, j, j + 1].some((k) => k >= 0 && x * x + (y - s - k * s) ** 2 <= s * s);
  };
  // 크기는 늘 찾아진다(나무가 커지면 결국 다 든다) — 그래도 운에 맡기지 않고 상한에서 멈춘다(맨 위에 둔다)
  let s = half * 0.9, dy = 0;
  for (; s < half * 40; s *= 1.02) {
    const top = sharp ? s / t.slope : s, T = sharp ? sharpTiers(s, top + hh + 0.5) : null;
    const fits = (d: number) => Q.every(([x, y]) => (T ? inSharp(T, x, y + d) : inRound(s, x, y + d)));
    let d = 0;
    while (d <= top && !fits(d)) d += 0.1;
    if (d <= top) { dy = d; break; }
  }
  const sx = -cx, sy = dy - ry0, textBot = dy + hh;

  // 폰 판 — 글 아래로 한 단(원) 더. 벽이 바닥까지 이을 단(원)은 그 밑으로 MORE_U만큼 — 삼각형 단은 내려갈수록 grow배로
  // 넓어지는데 수십 단을 이으면 밑동이 한없이 벌어져, 폰 판 마지막 단의 1.3배에서 멈춘다
  const tiers: TreeTier[] = [], more: TreeTier[] = [];
  if (sharp) {
    // 글이 끝나는 단(k) 아래로 한 단이 늘 있게 짓는다 — 글 밑 + s까지만 지었더니 맨 위 단이 그보다 길면(짧은 글이 첫 단에
    // 다 들 때) 한 단 더가 없어 벽이 멈췄다(2026-09-29, 나무 일곱 벽에서)
    const T0 = sharpTiers(s, textBot), k = Math.max(0, T0.findIndex((q) => q.y1 >= textBot)), n = k + 2;
    const T = sharpTiers(s, T0[k].y1 + 1e-6);
    const tri = (q: (typeof T)[number]): TreeTier => ({ kind: 'tri', pts: q.n ? [[-q.n, q.y0], [q.n, q.y0], [q.B, q.y1], [-q.B, q.y1]] : [[0, 0], [q.B, q.y1], [-q.B, q.y1]] });
    const all = sharpTiers(s, T[n - 1].y1 + MORE_U, T[n - 1].B * 1.3);
    all.slice(0, n).forEach((q) => tiers.push(tri(q)));
    all.slice(n).forEach((q) => more.push(tri(q)));
  } else {
    let k = 0;
    while (s + k * s + s < textBot) k++;
    for (let j = 0; j <= k + 1; j++) tiers.push({ kind: 'disc', cx: 0, cy: s + j * s, r: s });
    for (let j = k + 2; s + j * s - s < s + (k + 1) * s + s + MORE_U; j++) more.push({ kind: 'disc', cx: 0, cy: s + j * s, r: s });
  }

  // 글 자리 — 기본은 여느 글 상자, 사선 · 세로쓰기는 한 자씩(모서리까지 품는 상자)
  let tb: { x0: number; y0: number; x1: number; y1: number }, layout: TextLayout | undefined;
  if (mode === 'basic') tb = { x0: -TW / 2 + sx, y0: sy, x1: TW / 2 + sx, y1: L.length * LH + sy };
  else {
    const corners = placed.flatMap((q) => {
      const ca = Math.cos(q.a), sa = Math.sin(q.a);
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]): Pt => [q.x + sx + (u * q.w * ca - v * q.h * sa) / 2, q.y + sy + (u * q.w * sa + v * q.h * ca) / 2]);
    });
    tb = { x0: Math.min(...corners.map((p) => p[0])) - 0.06, y0: Math.min(...corners.map((p) => p[1])) - 0.06,
      x1: Math.max(...corners.map((p) => p[0])) + 0.06, y1: Math.max(...corners.map((p) => p[1])) + 0.06 };
    layout = {
      glyphs: placed.map((q) => ({ c: q.c, x: (q.x + sx - tb.x0) / optic, y: (q.y + sy - tb.y0) / optic, a: q.a })),
      box: { w: (tb.x1 - tb.x0) / optic, h: (tb.y1 - tb.y0) / optic }
    };
  }

  // 상자 — 나무 · 글이 다 들게
  const pts: Pt[] = [
    ...tiers.flatMap((q): Pt[] => (q.kind === 'tri' ? q.pts : [[q.cx - q.r, q.cy - q.r], [q.cx + q.r, q.cy + q.r]])),
    [tb.x0, tb.y0], [tb.x1, tb.y1]
  ];
  const e = 0.05, xs = pts.map((p) => p[0]), yAll = pts.map((p) => p[1]);
  const minX = Math.min(...xs) - e, minY = Math.min(...yAll) - e;
  const mv = ([x, y]: Pt): Pt => [x - minX, y - minY];
  const mvTier = (q: TreeTier): TreeTier => (q.kind === 'tri' ? { kind: 'tri', pts: q.pts.map(mv) } : { ...q, cx: q.cx - minX, cy: q.cy - minY });
  return {
    persona: pr, rule, circles: [], spikes: [],
    tree: { sharp, tiers: tiers.map(mvTier), more: more.map(mvTier) },
    w: Math.max(...xs) + e - minX, h: Math.max(...yAll) + e - minY,
    text: { x: tb.x0 - minX, y: tb.y0 - minY, w: tb.x1 - tb.x0, h: tb.y1 - tb.y0 },
    ...(layout ? { layout } : {})
  };
}

// ─── 다정한 — 구슬 구름 (2026-09-28) ─────────────────────────────────
// 고른 과정과 견본은 design/landscape.md '구름'. 값은 PERSONAS.doran.bead.

/** 글자 한 자씩의 가운데 (u) — 줄은 가운데 맞춤, 띄어쓰기는 빼고 줄 차례대로. 폭은 lineWidth와 같은 표 */
function charCenters(lines: readonly string[], font: string | undefined, optic: number, scaleX: number, wdth: number | undefined, track: number, TW: number, LH: number): Pt[] {
  const adv = advanceFor(BY_FONT[font ?? ''] ?? font ?? '', wdth), out: Pt[] = [];
  lines.forEach((line, i) => {
    const cs = Array.from(line);
    const a = cs.map((ch) => ((ch === ' ' ? adv.space : /[A-Za-z0-9.,!?'"-]/.test(ch) ? LATIN : adv.hangul) + track) * optic * scaleX);
    let x = (TW - a.reduce((s, v) => s + v, 0)) / 2;
    cs.forEach((ch, j) => { if (ch.trim()) out.push([x + a[j] / 2, (i + 0.5) * LH]); x += a[j]; });
  });
  return out;
}

/** 둥근 모서리 네모 안인가 */
function inRound(x: number, y: number, x0: number, y0: number, x1: number, y1: number, r: number): boolean {
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return Math.hypot(x - cx, y - cy) <= r;
}

/**
 * 다정한의 구슬 구름 — 기본 정렬(가운데)의 뭉게구름.
 *
 * 글 덩어리에 옆 side · 위아래 top만큼 둘러 둥근 네모를 잡고, 양옆 아래에 봉우리 하나씩, 위에 봉우리를
 * 줄지어(2.6u에 하나, 반지름은 폭의 20%를 1.2~1.7u로 묶고 조금씩 다르게) 솟게 한다. 밑은 평평하다.
 * 그 윤곽(+ 알 반지름의 1/3)에 든 육각 격자 자리마다 한 크기 구슬을 놓는다 — 알끼리 조금씩 겹쳐
 * 윤곽이 구슬 줄로 읽힌다. 봉우리가 글 폭에 비례하면 위만 2u 가까이 휑했다(첫 판, 디자이너 지적).
 *
 * 곁의 작은 구름(알 3 · 2개)은 본 구름 테두리 — 뒤(아래 1/4은 빼고) · 위 · 앞 — 위의 한 자리에 붙는다.
 * 자리는 글이 씨앗인 무작위라 같은 글은 같은 자리이고, 둘은 테두리의 35~65%만큼 떨어진다. 밑에는
 * 안 붙는다. 본 구름(알 40~200개)과 급이 확실히 갈리는 크기다.
 */
function beadFor(pr: Persona, rule: 'B' | 'C', TW: number, TH: number, R: () => number, chars: Pt[]): Cloud {
  const b = pr.bead!, S = b.step, mm = b.r / 3;
  // 글 덩어리 — 글자 끝에서 0.06u, 줄 상자 위아래로 0.12u 더 잡는다(견본과 같다)
  const X = -0.06 - b.side, Y = -0.12 - b.top, W = TW + 0.12 + 2 * b.side, floor = TH + 0.12 + b.top, Hh = floor - Y;
  const domes: [number, number, number][] = [];
  const Rs = Math.min(Math.max(Hh * 0.42, 0.9), 1.5);                          // 옆 봉우리 — 바깥으로 Rs × 0.4
  domes.push([X + Rs * 0.6, floor - Rs * 0.95, Rs], [X + W - Rs * 0.6, floor - Rs * 0.95, Rs]);
  const n = Math.max(2, Math.round(W / 2.6)), Rt = Math.min(Math.max(0.2 * W, 1.2), 1.7), pat = [0.85, 1.1, 1.0, 0.9, 1.05, 0.95];
  for (let i = 0; i < n; i++) { const r = Rt * pat[i % pat.length]; domes.push([X + (W * (i + 0.5)) / n, Y + 0.45 * r, r]); }   // 위 봉우리 — 위로 r × 0.55
  const inside = (x: number, y: number) => y <= floor + mm &&
    (inRound(x, y, X - mm, Y - mm, X + W + mm, floor + mm, Math.min(0.8, Hh / 2) + mm) || domes.some(([cx, cy, r]) => Math.hypot(x - cx, y - cy) <= r + mm));
  const body = beadGrid(inside, X - 1.5, Y - 3, X + W + 1.5, floor + S, S);
  return finishBeads(pr, rule, body, { x0: 0, y0: 0, x1: TW, y1: TH }, chars, R);
}

/** 윤곽 안의 육각 격자 자리마다 구슬 하나 — 격자는 (x0, y0)에서 시작한다 */
function beadGrid(inside: (x: number, y: number) => boolean, x0: number, y0: number, x1: number, y1: number, S: number): Pt[] {
  const rh = (S * Math.sqrt(3)) / 2, out: Pt[] = [];
  for (let j = 0, y = y0; y <= y1; j++, y += rh)
    for (let x = x0 + (j % 2 ? S / 2 : 0); x <= x1; x += S) if (inside(x, y)) out.push([x, y]);
  return out;
}

/** 작은 구름 한 덩이의 알 수 → 쌓는 꼴(아래 줄부터). 꼴이 여럿이면 글이 씨앗으로 하나 */
const LET_ROWS: Record<number, readonly (readonly number[])[]> = { 1: [[1]], 2: [[2]], 3: [[2, 1]], 4: [[3, 1], [2, 2]], 5: [[3, 2]] };
/** 작은 구름 한 덩이 — k알을 아래 줄부터 쌓는다. 윗줄은 아랫줄 틈에 반 칸 어긋나 얹히고, 어느 틈인지는 씨앗. 가운데가 원점 */
function letPts(k: number, S: number, R: () => number): Pt[] {
  const opts = LET_ROWS[k] ?? LET_ROWS[3], rows = opts[Math.floor(R() * opts.length)], rh = (S * Math.sqrt(3)) / 2, pts: Pt[] = [];
  let base = 0;
  rows.forEach((n, r) => {
    if (r) base += n < rows[r - 1] ? S / 2 + S * Math.floor(R() * (rows[r - 1] - n)) : R() < 0.5 ? -S / 2 : S / 2;
    for (let q = 0; q < n; q++) pts.push([base + q * S, -r * rh]);
  });
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return pts.map(([x, y]): Pt => [x - mx, y - my]);
}

/** 구슬 구름 마무리 — 곁의 작은 구름을 붙이고 상자를 잡는다. tb = 글 상자(u, 구슬과 같은 원점) */
function finishBeads(pr: Persona, rule: 'B' | 'C', body: Pt[], tb: { x0: number; y0: number; x1: number; y1: number }, chars: Pt[], R: () => number, layout?: TextLayout): Cloud {
  const b = pr.bead!, S = b.step, rb = b.r, L = b.lets;
  /* 곁의 작은 구름 — 수 · 크기 · 자리 모두 글이 씨앗(2026-09-29, 격자 D). 늘 3알 + 2알을 본 구름의 네모 테두리 옆 · 위에
     반듯하게 붙이던 때는 "랜덤성이 부족해 어눌해 보였다"(디자이너). 수는 1~3, 첫째가 가장 크다(3~5알 · 1~3알 · 1~2알 —
     본 구름(40~200알)과 급은 그대로 갈린다). 자리는 **실제 윤곽**을 따른다: 가운데(조금 아래)에서 아무 방향으로 나가다
     구슬에서 간격만큼 떨어진 첫 곳 — 봉우리 사이 · 비스듬한 어깨 · 옆 아래에도 앉는다. 밑은 뺀다(본 구름의 맨 아랫줄보다
     내려가지 않는다 — 처음엔 200개 중 33개가 밑으로 처졌다).
     알 수의 상한은 본 구름 알 12개에 하나(2~5) — 한 줄 짧은 글(40알 안팎)에 5알이 붙으면 급이 흐리고, 옆으로 뻗어
     벽에서 글이 67%까지 작아졌다(200개 재서). 그래서 짧은 글은 3알까지 */
  const n = L.count[Math.floor(R() * L.count.length)], cap = Math.min(5, Math.max(2, Math.floor(body.length / 12)));
  const shapes = L.sizes.map(([lo, hi]) => lo + Math.floor(R() * (hi - lo + 1))).slice(0, n).map((k) => letPts(Math.min(k, cap), S, R));
  const bxs = body.map((p) => p[0]), bys = body.map((p) => p[1]);
  const cx = (Math.min(...bxs) + Math.max(...bxs)) / 2, cy = (Math.min(...bys) + Math.max(...bys)) / 2 + 0.15 * (Math.max(...bys) - Math.min(...bys));
  const floor = Math.max(...bys);
  const clear = (pts: Pt[], gap: number) => pts.every(([x, y]) => body.every(([u, v]) => Math.hypot(x - u, y - v) >= 2 * rb + gap));
  /** 가운데에서 deg 방향으로 나가 본 구름과 gap만큼 떨어지는 첫 자리 — 성기게 나가다 잘게 되짚는다 */
  const reach = (sh: Pt[], deg: number, gap: number): Pt[] => {
    const dx = Math.cos((deg * Math.PI) / 180), dy = -Math.sin((deg * Math.PI) / 180);
    const at = (t: number) => sh.map(([x, y]): Pt => [cx + dx * t + x, cy + dy * t + y]);
    let t = 0;
    while (!clear(at(t), gap)) t += 0.25;
    while (t > 0.05 && clear(at(t - 0.05), gap)) t -= 0.05;
    return at(t);
  };
  const lets: Pt[][] = [], angs: number[] = [];
  for (const sh of shapes) {
    for (let tries = 0; tries < 40; tries++) {
      const deg = L.angle[0] + (L.angle[1] - L.angle[0]) * R();
      if (angs.some((a) => Math.abs(a - deg) < L.apart)) continue;
      const pts = reach(sh, deg, b.gap[0] + (b.gap[1] - b.gap[0]) * R());
      if (pts.some((p) => p[1] > floor)) continue;
      if (lets.some((o) => o.some(([x, y]) => pts.some(([u, v]) => Math.hypot(x - u, y - v) < 2 * rb + 0.4)))) continue;
      lets.push(pts); angs.push(deg); break;
    }
  }
  // 늘 하나는 있다 — 자리를 끝내 못 찾았으면(재 보니 없었다) 첫째를 바로 위에
  if (!lets.length) lets.push(reach(shapes[0], 90, b.gap[0]));

  // 상자 — 구슬 · 작은 구름(오르내리는 폭까지) · 글이 다 들게
  const e = 0.02;
  const xs = [tb.x0, tb.x1, ...body.map((p) => p[0] - rb), ...body.map((p) => p[0] + rb), ...lets.flat().flatMap((p) => [p[0] - rb, p[0] + rb])];
  const ys = [tb.y0, tb.y1, ...body.map((p) => p[1] - rb), ...body.map((p) => p[1] + rb), ...lets.flat().flatMap((p) => [p[1] - rb - b.bob, p[1] + rb + b.bob])];
  const minX = Math.min(...xs) - e, minY = Math.min(...ys) - e;
  const mv = ([x, y]: Pt): Pt => [x - minX, y - minY];
  return {
    persona: pr, rule, circles: [], spikes: [],
    beads: { r: rb, body: body.map(mv), lets: lets.map((l) => l.map(mv)), chars: chars.map(mv) },
    w: Math.max(...xs) + e - minX, h: Math.max(...ys) + e - minY,
    text: { x: tb.x0 - minX, y: tb.y0 - minY, w: tb.x1 - tb.x0, h: tb.y1 - tb.y0 },
    ...(layout ? { layout } : {})
  };
}

/**
 * 구름의 휜 배치 셋(2026-09-28, 디자이너 — '아치' · '부채꼴'처럼 다정함과 어울리는 정렬).
 *
 * 줄마다 제 길이를 같은 중심의 호에 얹는다 — 자간 · 행간은 그대로다(디자이너 몫). 글자는 제 가운데가 호 위에
 * 서고 호를 따라 기운다.
 * - 아치: 중심이 아래, 첫 줄(가장 바깥)의 반지름 = 가장 긴 줄 × arc.bow(4u 이상), 아래 줄은 한 줄씩 안으로
 * - 부채꼴: 중심이 아래, 가장 긴 줄이 arc.fan°를 두를 만큼 중심이 가깝다 — 마지막 줄이 가장 안쪽
 * - 미소: 아치를 뒤집어 중심이 위 — 양 끝이 올라간다
 *
 * **구름도 휜다.** 줄마다 글이 놓인 휜 띠(호 ± 반 줄 + arc.band)를 두르고 양 끝을 둥글게, 봉우리는 맨 윗줄 곡선을
 * 따라 솟고, 가장 넓은 띠 양 끝에 옆 봉우리. 네모 구름으로 두르면 모서리가 휑했다(견본).
 */
function beadArcFor(pr: Persona, rule: 'B' | 'C', lines: readonly string[], font: string | undefined, optic: number, scaleX: number, o: Options, LH: number, R: () => number, mode: 'arch' | 'fan' | 'smile'): Cloud {
  const b = pr.bead!, S = b.step, mm = b.r / 3, m = b.arc.band;
  const adv = advanceFor(BY_FONT[font ?? ''] ?? font ?? '', o.wdth), tr = o.track ?? 0;
  const L = lines.map((line) => {
    const cs = Array.from(line);
    const av = cs.map((ch) => ((ch === ' ' ? adv.space : /[A-Za-z0-9.,!?'"-]/.test(ch) ? LATIN : adv.hangul) + tr) * optic * scaleX);
    return { cs, av, len: Math.max(0.5, av.reduce((s, v) => s + v, 0)) };
  });
  const n = L.length, Lmax = Math.max(...L.map((l) => l.len));
  let Rr: number[];
  if (mode === 'fan') {
    const span = (b.arc.fan * Math.PI) / 180, rin = Math.max(0.9, ...L.map((l, i) => l.len / span - (n - 1 - i) * LH));
    Rr = L.map((_, i) => rin + (n - 1 - i) * LH);
  } else {
    const R0 = Math.max(Lmax * b.arc.bow, 4);
    Rr = L.map((_, i) => (mode === 'arch' ? R0 - i * LH : R0 + i * LH));
  }
  const up = mode !== 'smile';                                  // 위로 볼록 — 중심이 아래
  const pt = (r: number, ph: number): Pt => (up ? [r * Math.sin(ph), -r * Math.cos(ph)] : [r * Math.sin(ph), r * Math.cos(ph)]);
  const polar = (x: number, y: number): [number, number] => (up ? [Math.hypot(x, y), Math.atan2(x, -y)] : [Math.hypot(x, y), Math.atan2(x, y)]);

  // 글자 — 제 가운데가 호 위에. 띄어쓰기는 자리만 차지한다
  const placed: { c: string; x: number; y: number; a: number; w: number }[] = [];
  L.forEach((l, i) => {
    let s = 0;
    const a0 = -l.len / Rr[i] / 2;
    l.cs.forEach((c, j) => {
      const ph = a0 + (s + l.av[j] / 2) / Rr[i];
      s += l.av[j];
      if (!c.trim()) return;
      const [x, y] = pt(Rr[i], ph);
      placed.push({ c, x, y, a: up ? ph : -ph, w: l.av[j] });
    });
  });
  const corners = placed.flatMap((q) => {
    const ca = Math.cos(q.a), sa = Math.sin(q.a);
    return [[-q.w / 2, -LH / 2], [q.w / 2, -LH / 2], [-q.w / 2, LH / 2], [q.w / 2, LH / 2]].map(([dx, dy]): Pt => [q.x + dx * ca - dy * sa, q.y + dx * sa + dy * ca]);
  });
  const bx0 = Math.min(...corners.map((p) => p[0])) - 0.06, bx1 = Math.max(...corners.map((p) => p[0])) + 0.06;
  const by0 = Math.min(...corners.map((p) => p[1])) - 0.06, by1 = Math.max(...corners.map((p) => p[1])) + 0.06;

  // 휜 띠 · 둥근 끝 · 봉우리
  const bands = L.map((l, i) => ({ a: l.len / Rr[i] / 2, rIn: Rr[i] - LH / 2 - m, rOut: Rr[i] + LH / 2 + m, R: Rr[i] }));
  const domes: [number, number, number][] = [];
  for (const d of bands) { const rm = (d.rIn + d.rOut) / 2, rr = (d.rOut - d.rIn) / 2; for (const sg of [-1, 1]) { const [x, y] = pt(rm, sg * d.a); domes.push([x, y, rr]); } }
  const t0 = bands[0], edge = up ? t0.rOut : t0.rIn, arcLen = 2 * t0.a * edge + 1.0;
  const nd = Math.max(2, Math.round(arcLen / 2.6)), Rt = Math.min(Math.max(0.2 * arcLen, 1.2), 1.7), pat = [0.85, 1.1, 1.0, 0.9, 1.05, 0.95];
  const aSpan = t0.a + 0.5 / edge;
  for (let k = 0; k < nd; k++) {
    const r = Rt * pat[k % pat.length], ph = -aSpan + (2 * aSpan * (k + 0.5)) / nd;
    const [x, y] = pt(up ? edge - 0.45 * r : edge + 0.45 * r, ph);        // 곡선 바깥(위)으로 0.55r
    domes.push([x, y, r]);
  }
  const wide = bands.reduce((p, q) => (q.a * q.R > p.a * p.R ? q : p)), Rs = Math.min(Math.max(0.5 * (wide.rOut - wide.rIn), 0.9), 1.4);
  for (const sg of [-1, 1]) { const [x, y] = pt((wide.rIn + wide.rOut) / 2, sg * (wide.a + 0.2 / wide.R)); domes.push([x, y, Rs]); }
  const inside = (x: number, y: number) => {
    const [r, ph] = polar(x, y);
    return bands.some((d) => r >= d.rIn - mm && r <= d.rOut + mm && Math.abs(ph) <= d.a) || domes.some(([cx, cy, rr]) => Math.hypot(x - cx, y - cy) <= rr + mm);
  };
  const body = beadGrid(inside, bx0 - 3.5, by0 - 3.5, bx1 + 3.5, by1 + 3, S);
  const layout: TextLayout = {
    glyphs: placed.map((q) => ({ c: q.c, x: (q.x - bx0) / optic, y: (q.y - by0) / optic, a: q.a })),
    box: { w: (bx1 - bx0) / optic, h: (by1 - by0) / optic }
  };
  return finishBeads(pr, rule, body, { x0: bx0, y0: by0, x1: bx1, y1: by1 }, placed.map((q): Pt => [q.x, q.y]), R, layout);
}

// ─── 유머있는 — 새 · 박쥐 (2026-09-29) ─────────────────────────────────
// 말투가 가른다: 귀여운 = 새, 시니컬한 = 박쥐. 기하 도형만이고 곡선을 다듬지 않는다. 몸은 글을 따르고, 붙는 것
// (꼬리 · 귀 · 날개)은 길이가 정해져 있다. 고른 과정과 200개로 잰 것은 design/landscape.md '새' · '박쥐'.
// 값은 PERSONAS.deulseok.creature. 두 형상 모두 글 + 여백 네모를 품는 것이 구조로 보장된다 — 새의 몸은 네모의 네
// 모서리를 지나는 원, 박쥐의 윤곽은 네모 바깥으로만 지나간다(파인 아랫변은 날개 높이만큼만 내려온다).

const DEG = Math.PI / 180;

/** A에서 B까지의 원호(A는 빼고 B까지) — toward 쪽으로 현 길이 × sag만큼 부푼다. 박쥐 날개의 파인 아랫변 */
function scallopArc(A: Pt, B: Pt, toward: Pt, sag: number, n = 24): Pt[] {
  const c = Math.hypot(B[0] - A[0], B[1] - A[1]), s = sag * c, mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
  if (c < 1e-6) return [B];
  let nx = -(B[1] - A[1]) / c, ny = (B[0] - A[0]) / c;
  if (nx * (toward[0] - mx) + ny * (toward[1] - my) < 0) { nx = -nx; ny = -ny; }
  const r = (c * c / 4 + s * s) / (2 * s), ox = mx - nx * (r - s), oy = my - ny * (r - s);
  const a0 = Math.atan2(A[1] - oy, A[0] - ox), a1 = Math.atan2(B[1] - oy, B[0] - ox), am = Math.atan2(my + ny * s - oy, mx + nx * s - ox);
  const norm = (x: number) => ((x % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  // a0에서 a1로 가되 부푼 점(am)을 지나는 쪽으로
  let d = norm(a1 - a0);
  if (norm(am - a0) > d) d -= 2 * Math.PI;
  return Array.from({ length: n }, (_, i): Pt => { const t = a0 + (d * (i + 1)) / n; return [ox + r * Math.cos(t), oy + r * Math.sin(t)]; });
}

/**
 * 점 줄(P)의 끝 호(마지막 n점)를 뒤 40%에서 곡선으로 바꿔, 끝점에 이어질 선(끝점 → next)과 같은 방향으로 들어가게 한다.
 * 곡선은 호의 그 자리 방향으로 떠나 끝점에 닿는 3차 베지어다 — 점 수는 그대로(바뀌는 모양끼리 점을 옮겨 움직일 수 있게)
 */
function smoothInto(P: Pt[], n: number, next: Pt): Pt[] {
  const s0 = P.length - n, j = s0 + Math.floor(n * 0.6), A = P[j], B = P[P.length - 1];
  const tx = P[j + 1][0] - P[j - 1][0], ty = P[j + 1][1] - P[j - 1][1], tl = Math.hypot(tx, ty) || 1;
  const nx = next[0] - B[0], ny = next[1] - B[1], nl = Math.hypot(nx, ny) || 1;
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]) * 0.45;
  const C1: Pt = [A[0] + (tx / tl) * L, A[1] + (ty / tl) * L], C2: Pt = [B[0] - (nx / nl) * L, B[1] - (ny / nl) * L];
  const m = P.length - 1 - j;
  const bez = (u: number): Pt => { const v = 1 - u;
    return [v * v * v * A[0] + 3 * v * v * u * C1[0] + 3 * v * u * u * C2[0] + u * u * u * B[0], v * v * v * A[1] + 3 * v * v * u * C1[1] + 3 * v * u * u * C2[1] + u * u * u * B[1]]; };
  return [...P.slice(0, j + 1), ...Array.from({ length: m }, (_, i) => bez((i + 1) / m))];
}

function creatureFor(pr: Persona, rule: 'B' | 'C', TW: number, TH: number, R: () => number, kind: 'bird' | 'bat'): Cloud {
  const cr = pr.creature!;
  const x0 = -PAD, y0 = -PAD, x1 = TW + PAD, y1 = TH + PAD, HW = (x1 - x0) / 2, HH = (y1 - y0) / 2, CX = TW / 2, CY = TH / 2;
  let poses: Creature['poses'];
  if (kind === 'bird') {
    const b = cr.bird, Rr = Math.hypot(HW, HH) * b.grow;
    const at = (r: number, deg: number): Pt => [CX + r * Math.cos(deg * DEG), CY + r * Math.sin(deg * DEG)];
    const body = { cx: CX, cy: CY, r: Rr };
    const hr = b.head.r * Rr, [hx, hy] = at(Rr - hr * (1 - b.head.out), b.head.at), head = { cx: hx, cy: hy, r: hr };
    // 부리 — 머리 앞, 가운데보다 조금 아래에 밑변을 물린다
    const bl = hr * b.beak.len, bh = hr * b.beak.half, bx = hx + hr * 0.92, by = hy + hr * 0.1;
    const beak: Pt[] = [[bx - bh, by - bh], [bx + bl, by], [bx - bh, by + bh]];
    // 꼬리 — 몸 쪽 뿌리가 좁고 끝이 넓은 사다리꼴(2026-09-29, 디자이너). 곧은 띠였다
    const tail = (t: { from: number; to: number }): Pt[] => {
      const [px, py] = at(Rr * b.tail.root, t.from), dx = Math.cos(t.to * DEG), dy = Math.sin(t.to * DEG), nx = -dy, ny = dx, L = b.tail.len;
      const w0 = b.tail.half.root, w1 = b.tail.half.tip;
      return [[px + nx * w0, py + ny * w0], [px + dx * L + nx * w1, py + dy * L + ny * w1], [px + dx * L - nx * w1, py + dy * L - ny * w1], [px - nx * w0, py - ny * w0]];
    };
    const mine = R() < 0.5 ? b.tail.up : b.tail.down;   // 글이 고른다 — 같은 글은 언제나 같은 꼬리
    const wc = at(Rr * b.wing.root, b.wing.at), wr = Rr * b.wing.r;
    const fan: Pt[] = [wc, ...Array.from({ length: 41 }, (_, i): Pt => {
      const t = (b.wing.dir - b.wing.span / 2 + (b.wing.span * i) / 40) * DEG; return [wc[0] + wr * Math.cos(t), wc[1] + wr * Math.sin(t)]; })];
    poses = {
      rest: { discs: [body, head], polys: [beak, tail(mine)] },
      // 앉음 — 몸의 원을 자르지 않는다(2026-09-29, 디자이너). 원을 0.92R 아래로 잘라 바닥을 평평하게 했었다 — 둥근 밑의 한 점으로 앉는다
      sit: { discs: [body, head], polys: [beak, tail(mine)] },
      fly: { discs: [body, head], polys: [beak, tail(b.tail.fly), fan] }
    };
  } else {
    const t = cr.bat, E = t.ear.h;
    // 한 몸: 귀 → 날개 윗변(손목) → 날개 끝 → 파인 아랫변 → 옆선 → 아래 끝 → 반대쪽. 매달림은 이것을 위아래로 뒤집는다
    const outline = (p: { lift: number; n: number; drop: number; span?: number }, flip: boolean): Pt[] => {
      const top = y0 - t.top, span = t.span * (p.span ?? 1);
      const tip = (s: number): Pt => [CX + s * (HW + span), top - p.lift * t.unit];
      const wrist = (s: number): Pt => [CX + s * (HW + span * 0.3), top - (p.lift * 0.5 + 0.15) * t.unit];
      const ear = (s: number): Pt[] => [[CX + s * E * t.ear.in, top], [CX + s * E * t.ear.tip, top - E], [CX + s * E * t.ear.out, top]];
      const hip = (s: number): Pt => [CX + s * (HW + t.side), y1 + t.hip];
      // 날개는 크기가 정해져 있다 — 견본의 날개 높이만큼만 내려오고, 글이 길면 그 아래는 옆선이 곧게 내려간다
      const end = (s: number): Pt => [hip(s)[0], Math.min(hip(s)[1], tip(s)[1] + t.reach + p.lift * t.unit)];
      const hem = (s: number): Pt[] => {
        const T = tip(s), B = end(s), W = wrist(s), out: Pt[] = [];
        let prev = T;
        for (let k = 1; k <= p.n; k++) {
          const f = k / p.n, q: Pt = k === p.n ? B : [T[0] + (B[0] - T[0]) * f, T[1] + (B[1] - T[1]) * f + t.unit * p.drop * Math.sin(f * Math.PI)];
          out.push(...scallopArc(prev, q, [(T[0] + W[0]) / 2, W[1]], t.sag));
          prev = q;
        }
        // 날개 아랫변이 몸 옆선으로 들어가는 곳을 매끄럽게(2026-09-29, 디자이너 — 베지어). 마지막 호가 옆선에 모서리로 꺾여
        // 들어갔다 — 호의 뒤 40%를, 호의 방향으로 떠나 옆선(옆선이 없으면 아래 끝으로 가는 선)과 같은 방향으로 들어오는 곡선으로
        const H = hip(s), next: Pt = Math.abs(H[1] - B[1]) < 1e-6 ? [CX, y1 + t.foot] : H;
        return smoothInto(out, 24, next);
      };
      const [rIn, rTip, rOut] = ear(1), [lIn, lTip, lOut] = ear(-1);
      const P: Pt[] = [rIn, rTip, rOut, wrist(1), tip(1), ...hem(1), hip(1), [CX, y1 + t.foot], hip(-1), ...[tip(-1), ...hem(-1)].reverse(), wrist(-1), lOut, lTip, lIn];
      return flip ? P.map(([x, y]): Pt => [x, 2 * CY - y]) : P;
    };
    poses = { rest: { discs: [], polys: [outline(t.hang, true)] }, fly: { discs: [], polys: [outline(t.fly, false)] },
      twitch: { discs: [], polys: [outline(t.twitch, true)] }, stretch: { discs: [], polys: [outline(t.stretch, true)] } };
  }
  // 상자는 폰 자세(rest)로 잰다 — 벽의 다른 자세는 이 상자 밖으로 나갈 수 있다
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const see = (x: number, y: number) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); };
  for (const d of poses.rest.discs) { see(d.cx - d.r, d.cy - d.r); see(d.cx + d.r, d.cy + d.r); }
  for (const P of poses.rest.polys) for (const [x, y] of P) see(x, y);
  const move = (q: CreaturePose): CreaturePose => ({
    discs: q.discs.map((d) => ({ cx: d.cx - minX, cy: d.cy - minY, r: d.r })),
    polys: q.polys.map((P) => P.map(([x, y]): Pt => [x - minX, y - minY]))
  });
  const moved: Creature['poses'] = { rest: move(poses.rest), fly: move(poses.fly), ...(poses.sit ? { sit: move(poses.sit) } : {}),
    ...(poses.twitch ? { twitch: move(poses.twitch) } : {}), ...(poses.stretch ? { stretch: move(poses.stretch) } : {}) };
  return {
    persona: pr, rule, circles: [], spikes: [], creature: { kind, poses: moved },
    w: maxX - minX, h: maxY - minY,
    text: { x: -minX, y: -minY, w: TW, h: TH }
  };
}

/** fit.ts와 잇는 계약. 구름은 글이 정하므로 tw·th를 안 받고 제 상자를 답한다 */
export function cloudShape(cloud: Cloud): BoxShape {
  return {
    body: (_tw, _th, u) => ({ w: cloud.w * u, h: cloud.h * u }),
    tail: () => 0
  };
}
