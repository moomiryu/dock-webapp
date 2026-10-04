import { LINE_HEIGHT, SIZE_FILLS, UNIT_TOP, WALL_SIDE, foldLines, fillFromLegacySize, type BoxShape } from './fit';
import { formFor, opticalFix } from './palettes';
import type { Align } from '../types';
import { CLOUD_PHOTOS, type PhotoShape } from './cloudPhoto.data';
import { TREE_PHOTOS, type TreeShape } from './treePhoto.data';
import { STONE_PHOTOS, type StoneShape } from './stonePhoto.data';

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

export type Edge = 'spike' | 'smooth' | 'cumulus' | 'pixel' | 'stone' | 'tree' | 'photo' | 'creature';

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
    /** 사진 돌(2026-10-01, photoStoneFor · stonePhoto.data.ts) — 있으면 위의 기하 돌 대신 이것을 짓는다(윤곽 따라만 기하 돌로).
        pick = 벽 글자를 안 줄이는 돌이 이보다 적으면 긴 쪽이 가장 짧은 몇 가지에서 고르나 · grid = 돌을 글 축으로 돌려 놓고
        자리를 찾는 칸 격자(긴 쪽 칸 수) · spot = 가장 큰 자리의 몇 배에 글을 앉히나(구름과 같은 3% 여유) */
    photo?: { pick: number; grid: number; spot: number; tex?: StoneTex };
  };
  /** 줄 높이(글자 크기의 배수). 없으면 LINE_HEIGHT(1.5). 글에 바짝 붙는 형상(나무)이 좁힌다 */
  lh?: number;
  /** 당당한 — 사진 나무(treeFor · treePhoto.data.ts, 2026-09-30). 말투가 종을 고른다: 예리한 = 소나무, 온화한 = 버드나무.
      값의 근거는 design/landscape.md '나무' */
  tree?: {
    /** 사선 배열(R24) — 글자 자리가 그리는 사선의 각도(도, 시계 방향. 글자는 돌리지 않는다) · 다음 줄 머리까지의
        세로 거리(글자 높이의 배수). 줄 머리는 한 세로선에 선다 */
    slant: number;
    pitch: number;
    /** 글자 배수 — 크기 막대가 고른 글자(UNIT_TOP × 크기)의 몇 배로 나무에 앉나 */
    text: number;
    /** 끄트머리 잘리게(R18) — 줄 끝이 윤곽 밖으로 나가도 되는 깊이(u) · 그 밖의 둘레가 칠 위에 남기는 여백(u) */
    bleed: number;
    gap: number;
    /** 키 — 크기 막대의 양 끝이 벽 높이의 얼마인가 · 글이 씨앗으로 흔들리는 폭(벽 높이의 비율) */
    tall: readonly [number, number];
    jitter: number;
    /** 글이 안 들어가면 이 배수씩 나무를 키운다 · 그 한계 */
    grow: number;
    maxGrow: number;
    /** 상자(폰 판) — 수관 밑에서 나무 키의 이만큼(줄기 윗부분)까지. 그 밑은 상자 밖으로 이어진다 */
    stem: number;
    /** 글 밑의 그늘(빗금)을 걷는 둘레(u) */
    lift: number;
    /** 좌우를 뒤집는 몫(글이 씨앗으로) · 폭 늘이기(treeWidths) · 버드나무 가닥의 가장 긴 길이(나무 키의 비율) */
    flip: number;
    stretch: { lo: number; hi: number; ref: number; pow: number; step: number };
    drape: number;
    /** 글에 맞춤 — 있으면 키를 크기 막대(tall)가 아니라 글이 겨우 드는 가장 작은 키 × 여유로. 여유 = lo + (hi − lo) × 난수^pow
        (글이 씨앗 — pow가 크면 대개 lo 가까이, 가끔 hi까지). 나무는 가장 작게 드는 키의 fit배 안에 드는 것들 가운데서(비교 중) */
    hug?: { lo: number; hi: number; pow: number; fit: number };
    /** 줄기만 늘이기 — 줄기(treePhoto.data.ts trunk 아래)의 from~to 구간을 세로로 늘여 나무를 벽 높이의 lo + (hi − lo) × 난수^pow
        만큼 더 키운다(글이 씨앗). 늘이는 배수는 max까지(줄기가 거의 없는 나무가 막대처럼 늘어지지 않게). 수관 · 글 · 여백은
        그대로이고 나무 키만 다양해진다(2026-10-01, 디자이너 — '줄기만 차등, 윗부분 말고'). 배수로 늘이니 줄기가 짧은 나무는
        거의 안 자라 차이가 안 보였다 — 늘어나는 길이를 벽 높이로 잡는다 */
    trunk: { lo: number; hi: number; pow: number; from: number; to: number; max: number };
    /** 나무 키의 상한(벽 높이의 비율, 2026-10-01 디자이너 — 실물 벽 2.5 × 1.4m에서 절반을 재 보고 60%로). 넘으면 먼저 줄기 늘이기를 줄이고, 그래도
        넘으면 그 나무를 글과 함께 줄인다(shrink — 글자 배수 text에 곱한다). 글이 길고 크기를 크게 고른 드문 글만 걸린다 */
    maxTall: number;
    /** 빗금 — 한 칸 · 칠로 남는 줄의 굵기(한 변의 비율 — 벽 1920×1080에서 5px · 1.7px) */
    hatch: { period: number; width: number };
    /** 바람(둘 다 · 강) — 잎 떨림의 폭 · 바람결의 크기(한 변의 비율), 흔들림(나무 키의 비율), 바람결이 한 결 지나가는 ·
        흔들림 한 번 · 돌풍 한 번의 시간(--t-hold 배수). 움직이는 견본(landscape-tree-photo-wind.html)에서 디자이너가 골랐다 */
    wind: { flutter: number; grain: number; sway: number; pass: number; swayTurn: number; gust: number };
  };
  /** 다정한 — 사진에서 딴 띠 구름(2026-09-30, photoFor · cloudPhoto.data.ts). 값의 근거는 design/landscape.md '구름' */
  photo?: {
    /** 몸통 — 글 자리에서 좌우로, 두께가 가장 두꺼운 곳의 이 몫 아래로 떨어지기 전까지. 그 밖은 꼬리 */
    body: number;
    /** 꼬리를 옆으로 누르는 배수. 2026-09-30 격자에서 0.5(1은 몸통 폭의 125~163%로 과했고, 0.35는 작은 덩이가 톱니처럼
        뾰족해졌다). 2026-10-01부터 1 — 꼬리를 혹의 사슬로 다시 지으면서(scripts/clouds/tail.py) 0.5배 누른 길이를 자료에
        미리 넣었다. 누르면 둥근 혹이 옆으로 찌그러진다 */
    tail: number;
    /** 몸통의 긴 쪽 상한(u) — 넘으면 벽 한 칸에 맞추느라 글이 작아진다(보통 크기의 한계 18.5u에서 여유를 둔다) */
    cap: number;
    /** 띠를 세로로 두툼하게 하는 배수 — 상한 안에 드는 것 가운데 가장 덜 두툼한 것(띠의 결을 지킨다) */
    thick: readonly number[];
    /** 글 모양에 맞는(몸통이 가장 짧은) 몇 장 가운데서 글이 씨앗으로 고르나 */
    pick: number;
    /** 휜 배치(아치 · 미소, 옛 글의 부채꼴) — 아치 · 미소의 가장 긴 줄의 반지름(줄 길이의 배수) · 부채꼴이 두르는 각(도) */
    arc: { bow: number; fan: number };
    /** 움직임(photoWave) — 봉우리: 바깥으로만 부푸는 폭(u) · 한 바퀴(--t-hold 배수). 움직이는 견본 격자(봉우리 · 꼬리 · 둘 다 ×
        약 · 중 · 강)에서 디자이너가 봉우리 강을 골랐다(2026-09-30).
        꼬리 — 움직이는 견본 여섯 칸(design/landscape-cloud-photo-tail-motion.html)에서 디자이너가 ② + ④를 골랐다(2026-10-01).
        swell = 혹이 뿌리에서 끝으로 차례로 부푸는 폭(그 자리 꼬리 두께의 몫, 봉우리의 billow를 넘지 않게) · 한 바퀴. drift = 떨어진 조각이 끝 너머로 떠났다
        돌아오는 거리(u, 몸통에 가장 가까운 조각 — 먼 조각일수록 더) · 한 바퀴. 고르지 않은 칸: ③ 꼬리 길이가 숨쉼 · ⑤ 조각이
        둥실 · ⑥ 조각이 흩어지고 다시 돋음. stretch · tip(꼬리가 늘었다 줄고 끝이 위아래로 나부낌)은 0 — 끝으로 갈수록 크게
        물결치는 몸짓이 뱀의 문법이다(2026-10-01에 껐다) */
    motion: { billow: number; billowTurn: number; swell: number; swellTurn: number; drift: number; driftTurn: number; stretch: number; tip: number; tailTurn: number };
    /** 빗금 결(2026-10-04, CloudArt) — 있으면 칠 위에 밑 띠의 그늘을 ／ 빗금으로. 지우면 한 색 구름(SVG)으로 돌아간다 */
    tex?: CloudTex;
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
  // 나무 (2026-09-28, 09-30 사진으로). 뾰족 구름 → 별(09-27) → 박스 → 기하 나무(삼각형 단 · 원, 09-29) → 사진에서 뗀 한 그루
  // (09-30 — 기하는 조형적 당위가 없고 주인공처럼 보였다). 원(lobe · fill · gap · spread)은 쓰이지 않는다. 행간 1.1은 박스에서
  // 고른 값 그대로. 고른 과정과 버린 것은 design/landscape.md '나무'.
  ttoryeot: { key: 'ttoryeot', edge: 'tree', lobe: [1.25, 1.85], fill: [0.6, 0.8], gap: 1.9, spread: [0.2, 0.9], sat: 0, blur: 0, lh: 1.1,
    tree: { slant: 24, pitch: 1.6, text: 1.4, bleed: 0.3, gap: 0.2, tall: [0.2, 0.6], jitter: 0.05, grow: 1.03, maxGrow: 3, stem: 0.12, lift: 0.42,
      flip: 0.5, stretch: { lo: 0.75, hi: 1.4, ref: 2, pow: 0.35, step: 0.1 }, drape: 0.22,   // 폭 늘이기 강(격자 — 없음 · 약 · 중 · 강)
      hug: { lo: 1.15, hi: 1.15, pow: 1, fit: 1.3 }, trunk: { lo: 0, hi: 0.2, pow: 1, from: 0.3, to: 0.9, max: 5 }, maxTall: 0.6,
      hatch: { period: 5 / 401.76, width: 1.7 / 401.76 },
      wind: { flutter: 4.5 / 401.76, grain: 26 / 401.76, sway: 11 / 432, pass: 2, swayTurn: 8, gust: 13 } } },
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
      base: { half: 0.2, clear: 0.05 },
      // 사진 돌(2026-10-01) — 위의 기하 돌(꼭짓점 · 깨기 · 넘치기 · 걸기의 곧은 윗변 · 밑면)은 이것을 지우면 되살아난다.
      // 걸기 셋은 글만 기운다(hang의 각도 그대로) — 돌은 사진 윤곽 그대로(디자이너, 격자 landscape-stone-photo-text.png)
      photo: { pick: 4, grid: 160, spot: 0.97,
        // 빗금 결(2026-10-04, 디자이너 — 격자 design/landscape-stone-tex-*.png). 원본 사진의 어두운 35%를 나무 빗금 그대로(／),
        // 작은 조각은 걷고(강과 중 사이), 줄은 손으로 그은 듯 '미세'하게 흔들고, 빗금 틈은 글자 획의 1.6배를 넘지 않는다('가').
        // 빛은 벽에 하나(오른쪽 위) — 돌이 기울면 그늘이 빛을 따라 다른 면으로 옮겨 간다('다', 배까지)
        tex: { q: 0.35, lo: 0.05, hi: 0.55, gamma: 1.2,
          blur: 3.75 / 401.76, edge: 0.05, edgeGrain: 1.2 / 401.76, drop: 0.0225,
          light: [0.6, -0.8], turn: 0.9,
          hatch: { period: 5 / 401.76, gap: 3.3 / 401.76, ink: 1.6, wob: [0.7 / 401.76, 0.2 / 401.76, 0.1], grain: [6 / 401.76, 0.7 / 401.76, 4 / 401.76] },
          outline: { amp: 0.8 / 401.76, step: 2 / 401.76, grain: [4 / 401.76, 1 / 401.76] },
          fade: [0.5, 1.3],
          stroke: [[250, 0.0459], [550, 0.0689], [900, 0.1014]] } } } },
  // 띠 구름 (2026-09-30). 꽃 → 옛 뭉게구름 → 구슬 구름(09-28, 기하)을 거쳐 **사진에서 딴 구름**으로 — 기하 도형이 풍경을
  // 대신하면 읽어 내야 하는 모양이라 도형이 주인공이 됐다(디자이너). 원을 부풀리지 않아 lobe · fill · gap · spread는
  // 쓰이지 않는다. 행간 1.3(2026-09-30, 디자이너 — 나무와 같던 1.1에서 늘렸다). 고른 과정과 버린 것은 design/landscape.md '구름'.
  doran: { key: 'doran', edge: 'photo', lobe: [1.1, 1.6], fill: [0.5, 0.75], gap: 1.6, spread: [0, 0.9], sat: 0, blur: 0, lh: 1.3,
    photo: { body: 0.4, tail: 1, cap: 18, thick: [1, 1.15, 1.3, 1.5], pick: 4, arc: { bow: 1.3, fan: 130 },
      motion: { billow: 0.35, billowTurn: 9, swell: 0.14, swellTurn: 10, drift: 0.6, driftTurn: 14, stretch: 0, tip: 0, tailTurn: 14 },
      // 빗금 결(2026-10-04, 디자이너 — 격자 design/landscape-cloud-tex-*.png). 빛은 돌과 같은 오른쪽 위(띠 구름은 밑이 평평해 위에서 오는
      // 빛과 거의 같았다) · 그늘은 밑 띠(가장자리 따라 · 봉우리마다 대신) · 양 35%(돌과 같게 — 25 · 45 · 55%를 벽의 두 장면에서 견줬다).
      // 뭉갬 · 정리 · 흔들림 · 글 둘레는 돌 그대로. 틈 ≤ 글자 획 × 1.6이라 다카포 획을 0.36 · 0.46 · 0.56pt로 올렸다(palettes.ts DORAN_STROKE)
      tex: { q: 0.35, blur: 3.75 / 401.76, edge: 0.05, edgeGrain: 1.2 / 401.76, drop: 0.0225, light: [0.6, -0.8], band: [0.45, 0.5], bandBlur: 2 / 401.76,
        hatch: { period: 5 / 401.76, gap: 3.3 / 401.76, ink: 1.6, wob: [0.7 / 401.76, 0.2 / 401.76, 0.1], grain: [6 / 401.76, 0.7 / 401.76, 4 / 401.76] },
        fade: [0.5, 1.3], bare: 0.0275 } } },
  // 사진 새 (2026-10-01). 귀여운 = 배가 둥근 작은 새 9, 시니컬한 = 까마귀 12 — 글만 1.65배로 넘치고 새 윤곽으로 잘린다(격자
  // landscape-bird-photo-clip-*.png). 후보는 벽 글자가 가장 큰 새의 70% 안(near), 상한은 구름과 같은 18u. 아래 creature는 옛 기하 새.
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
   표의 0.989는 2% 넓었다. 돌의 넘치기(R18)가 줄 끝을 파고드는 깊이가 이 표에 걸려 있어 0.97로 고쳤다.
   2026-10-01 당당한이 아침 Medium으로 갈렸다. 같은 방법(100px, 글자를 먼저 올리고 기다림)으로 쟀다 —
   한글 고정폭 0.92 · 띄어쓰기 0.30. 둥켈을 함께 재서 0.678 · 0.116이 그대로 나와 방법을 확인했다.
   아침에는 폭 축이 없어 아래 TTORYEOT_WIDE와 advanceFor의 보간은 이제 쓰이지 않는다(wdth가 안 온다). */
const ADVANCE: Record<string, { hangul: number; space: number }> = {
  ttoryeot: { hangul: 0.90, space: 0.29 },   // 김정철 고딕(10-04 — 굵기마다 같다. 그전 이사만루 0.92 · 0.25)
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
  /** 사진 돌의 결(2026-10-04, StoneArt) — 어느 돌 · 좌우 뒤집음 · 밑변의 높이(u, 벽이 붙이는 배는 이 아래) ·
      글 줄의 자리(글 상자 안 [왼 · 위 · 오른 · 아래], u — 빗금을 걷는 곳) · 글자 한 em(u) · 글자 획의 평균 굵기(u — 빗금 틈이 이를 넘지 않게) */
  photo?: { id: string; flip: boolean; base: number; lines: readonly (readonly [number, number, number, number])[]; em: number; ink: number };
}
/**
 * 차분한 돌의 빗금 결(2026-10-04, 디자이너가 격자로 골랐다 — design/landscape.md '돌'의 결). 길이는 벽 한 변(401.76px)에 대한 몫,
 * 나무 빗금과 같은 결(StoneArt)
 */
export interface StoneTex {
  /** 그늘 양 — 쉬는 자세의 돌 윗부분에서 어두운 몫 · 밝기의 바닥 · 꼭대기(돌 안 밝기의 몫 — 그 위는 맨 칠) · 어두움의 굽음 */
  q: number; lo: number; hi: number; gamma: number;
  /** 그늘을 뭉개는 폭 · 그늘 테두리를 거칠게 하는 잡음(세기 · 결의 폭) · 작은 그늘 조각을 걷고 작은 틈을 메우는 크기(돌 넓이의 몫) */
  blur: number; edge: number; edgeGrain: number; drop: number;
  /** 벽의 빛이 오는 쪽(화면, 아래가 +) · 돌이 돌면 빛을 보는 정도가 바뀐 만큼 밝기가 바뀌는 세기((꼭대기 − 바닥)의 배수) */
  light: readonly [number, number]; turn: number;
  /** 빗금 — 줄 간격(x + y) · 가장 굵은 검은 틈(x + y) · 글자 획에 대한 틈의 한도(배) · 흔들림(줄 자리 · 잔 결 · 굵기 몫)과 그 결의 폭 */
  hatch: { period: number; gap: number; ink: number; wob: readonly [number, number, number]; grain: readonly [number, number, number] };
  /** 윤곽의 구불구불 — 미는 폭 · 점 사이 · 결의 폭(낮은 · 잔) */
  outline: { amp: number; step: number; grain: readonly [number, number] };
  /** 글 둘레에서 빗금이 사라지는 자리(em) — 이 안은 없고 · 이만큼 더 가면 그대로 */
  fade: readonly [number, number];
  /** 본명조 획의 평균 굵기(em) — 무게마다(잉크 넓이 × 2 ÷ 둘레로 쟀다) */
  stroke: readonly (readonly [number, number])[];
}
/**
 * 다정한 구름의 빗금 결(2026-10-04, 디자이너가 격자로 골랐다 — design/landscape.md '구름'의 결, design/landscape-cloud-tex-*.png).
 * 길이는 벽 한 변(401.76px)에 대한 몫. 사진 명암이 윤곽과 안 맞아(꼬리를 다시 지었다) 그늘은 윤곽에서 셈한다: 빛 쪽 윤곽까지의 거리 ÷
 * (그것 + 반대쪽 밑까지의 거리) — 구름 전체의 밑이 어둡다(밑 띠)
 */
export interface CloudTex {
  /** 그늘 양 — 구름 안에서 어두운 몫 · 그늘을 뭉개는 폭 · 그늘 테두리 잡음(세기 · 결의 폭) · 작은 조각을 걷고 틈을 메우는 크기(구름 넓이의 몫) */
  q: number; blur: number; edge: number; edgeGrain: number; drop: number;
  /** 벽의 빛이 오는 쪽(화면, 아래가 + — 돌과 같다) · 밑 띠의 시작 · 폭(윗선 0 → 밑 1에서 어디부터 어두워지나) · 그 몫을 고르는 폭 */
  light: readonly [number, number]; band: readonly [number, number]; bandBlur: number;
  /** 빗금 — 줄 간격(x + y) · 가장 굵은 검은 틈(x + y) · 글자 획에 대한 틈의 한도(배, x + y로 잰다 — 격자 그대로) · 흔들림 · 그 결의 폭 */
  hatch: { period: number; gap: number; ink: number; wob: readonly [number, number, number]; grain: readonly [number, number, number] };
  /** 글 둘레에서 빗금이 사라지는 자리(em) — 이 안은 없고 · 이만큼 더 가면 그대로 */
  fade: readonly [number, number];
  /** 다카포 맨 획의 평균 굵기(em) — 덧댄 획(--optical-stroke)을 더하면 글자 획(잉크 넓이 × 2 ÷ 둘레로 쟀다) */
  bare: number;
}
/**
 * 당당한의 사진 나무(treePhoto.data.ts). 원점 = 구름 상자 왼쪽 위, u 단위. 상자(w · h)는 수관과 줄기 윗부분까지 — 나무 전체
 * (폭 w · 키 full)는 그 밑으로 이어진다. 벽은 전체를 바닥에서 세우고, 폰은 무대 밑이 자른다
 */
export interface Tree {
  /** 어느 나무인가 · 종 · 그리는 판(칠 · 그늘 그림) */
  id: string;
  species: 'pine' | 'willow';
  img: string;
  /** 나무 전체의 키(u) · 줄기를 늘이기 전의 키(u — 그리는 판 그대로) · 늘인 줄기 구간(u, 늘이기 전 좌표)과 배수 */
  full: number;
  base: number;
  trunk: { y0: number; y1: number; k: number };
  /** 벽에서의 키 — 벽 높이의 비율(글이 든 수관 · 줄기 늘이기 · 상한까지) · 상한에 걸려 나무를 글과 함께 줄인 배수(1 = 안 줄임) */
  tall: number;
  shrink: number;
  /** 글자가 차지하는 네모들(u) — 그 밑의 빗금을 걷고 바람을 멈춘다 */
  zones: readonly (readonly [number, number, number, number])[];
  /** 새가 앉는 끝(u) — 꼭대기 · 수관 양쪽의 높은 윗선 */
  perch: readonly Pt[];
  /** 좌우를 뒤집었나 · 옆으로 늘인 배수 — 그리는 판도 이대로(TreeArt) */
  flip: boolean;
  sx: number;
  /** 버드나무 — 가닥을 글마다 새로 늘어뜨린다(TreeArt): 씨앗 · 가장 긴 가닥(나무 키의 비율) */
  drape?: { seed: number; L: number };
}

/**
 * 다정한의 띠 구름 — 사진에서 딴 윤곽 하나. 원점 = **몸통** 상자 왼쪽 위, u 단위. 상자(w · h)는 몸통이고 꼬리는 그 밖
 * (x < 0 · x > w)으로 나간다 — 벽의 크기를 몸통으로 재서 꼬리가 글을 작게 만들지 않는다(2026-09-30, 디자이너)
 */
export interface Photo {
  /** 어느 띠인가(cloudPhoto.data.ts) */
  id: string;
  pts: Pt[];
  /** 꼬리 끝 너머 떨어진 조각(2026-10-01) — 윤곽 여럿. 몸통과 같은 색으로 칠하고, 끝 너머로 떠났다 돌아온다(photoWave) */
  extra?: Pt[][];
  /** 글자 한 자씩의 가운데(띄어쓰기 빼고, 줄 차례대로) — 벽에서 남의 구름 글자가 이 자리를 비켜 간다 */
  chars: Pt[];
  /** 꼬리 · 떨어진 조각까지 합친 가로 범위(u, 몸통 상자 기준) — 조각이 떠가는 데까지(driftReach). 벽이 읽힘을 따질 때 꼬리도
      몸으로 친다 */
  x0: number; x1: number;
  /** 빗금 결(CloudArt)이 쓰는 글자 — 한 em(u) · 획의 평균 굵기(u, 빗금 틈이 이를 넘지 않게) */
  ink?: { em: number; ink: number };
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
  /** 다정한의 띠 구름. 있으면 circles · spikes는 비어 있다 */
  photo?: Photo;
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
  /** 3/5 무게 막대 자리(0~1) — 2026-10-04부터 당당한은 말투 대신 무게가 나무를 고른다(treeFor) */
  weightPos?: number;
  /** 4/5 정렬 — 나무 · 구름은 이것으로 글 배치와 제 모양을 바꾼다(arrangementsFor) */
  align?: Align;
  /** 크기 막대(fit.ts SIZE_FILLS 사이) — 나무가 제 키를 이것으로 정한다 */
  fill?: number;
  /** 글자의 굵기(formFor의 무게 · 덧댄 획 em) — 돌의 빗금 틈이 글자 획보다 굵지 않게(StoneTex.hatch.ink) */
  ink?: { weight: number; stroke: number };
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
  // 다정한 — 가운데 · 아치 · 미소(2026-09-30, 디자이너). 부채꼴은 칸에서 뺐다 — 부채꼴로 올라간 옛 글은 그대로 부채꼴로 선다
  doran: ['center', 'arch', 'smile']
};
export function arrangementsFor(font: string | undefined): readonly Align[] {
  return ARRANGEMENTS[BY_FONT[font ?? ''] ?? ''] ?? ['left', 'center', 'right'];
}
/**
 * 이 글의 줄 — 한 줄 12자(fit.ts), 모든 성격이 같다. 나무(당당한)의 기본 · 사선만 8자로 접던 때가 있었다(09-29 — 좁고
 * 뾰족한 기하 나무에 12자 줄이 옆으로 넓었다). 사진 나무는 수관이 옆으로 넓어 12자로 돌아왔다(2026-09-30, 디자이너 —
 * 60자가 9줄에서 5줄). 부르는 곳(벽 · 4/5)이 성격을 몰라도 되게 함수는 남긴다
 */
export function linesFor(text: string, _tone?: { font?: string; align?: Align } | null): string[] {
  return foldLines(text);
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
export function cloudForTone(lines: readonly string[], tone: (Parameters<typeof formFor>[0] & { align?: Align; size?: number }) | null | undefined, o: Pick<Options, 'seed' | 'minDiameter'> = {}): Cloud {
  // 같은 글 · 같은 조율이면 같은 구름이다(씨앗이 글) — 한 번 지은 것을 둔다. 벽은 1초마다 열두 글의 구름을 다시 묻는데,
  // 나무는 품을 크기를 찾느라 한 번에 수 ms가 든다(2026-09-29)
  const key = JSON.stringify([lines, tone, o]), had = MADE.get(key);
  if (had) return had;
  let c: Cloud;
  if (!tone) c = cloudFor(lines, undefined, o);
  else {
    const f = formFor(tone);
    c = cloudFor(lines, tone.font, { ...o, scaleX: f.scaleX, scaleY: f.scaleY, slant: f.slant, wdth: f.wdth, track: parseFloat(f.letterSpacing) || 0, manner: tone.manner, weightPos: tone.weight, align: tone.align,
      fill: fillFromLegacySize(tone.size), ink: { weight: f.weight, stroke: parseFloat(f.stroke) || 0 } });
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
  if (pr.edge === 'stone' && pr.stone) {
    const mode = o.align === 'hang-up' || o.align === 'hang-mid' || o.align === 'hang-down' || o.align === 'contour' ? o.align : 'center';
    // 사진 돌 — 칸이 생기기 전의 옛 글(가운데 돌)도 사진 돌로 선다: 기울지 않고 넘치지 않는다(디자이너, 2026-10-01)
    if (pr.stone.photo && mode !== 'contour') {
      // 결이 걷어 낼 글 줄 — 걸기는 왼끝 맞춤, 옛 가운데 돌은 가운데(VoiceBubble이 앉히는 그대로). 줄의 잉크 높이 ≈ 줄 높이의 0.6
      const left = mode !== 'center', ink = o.ink ?? { weight: 620, stroke: 0 };
      const rows = widths.map((w, i): readonly [number, number, number, number] => {
        const x0 = left ? 0 : (TW - w) / 2;
        return [x0, (i + 0.2) * LH, x0 + w, (i + 0.8) * LH];
      });
      return photoStoneFor(pr, rule, TW, TH, R, mode, o.fill ?? SIZE_FILLS[2], { rows, em: optic, ink });
    }
    return stoneFor(pr, rule, TW, TH, R, mode, widths, LH, o.align,
      mode === 'contour' ? { lines, font, optic, scaleX, wdth: o.wdth, track: o.track ?? 0 } : undefined);
  }
  if (pr.edge === 'tree' && pr.tree) return treeFor(pr, rule, lines, font, optic, scaleX, o, LH, R);
  if (pr.edge === 'photo' && pr.photo) {
    // 빗금 결이 쓰는 글자 — 한 em = 보이는 글자 크기(u), 획 = 다카포 맨 획 + 덧댄 획(formFor의 무게)
    const ink = pr.photo.tex && o.ink ? { em: optic, ink: (pr.photo.tex.bare + o.ink.stroke) * optic } : undefined;
    if (o.align === 'arch' || o.align === 'fan' || o.align === 'smile') {
      const g = arcGlyphs(pr, lines, font, optic, scaleX, o, LH, o.align);
      return photoFor(pr, rule, g.tb, g.chars, R, g.layout, ink);
    }
    return photoFor(pr, rule, { x0: 0, y0: 0, x1: TW, y1: TH }, charCenters(lines, font, optic, scaleX, o.wdth, o.track ?? 0, TW, LH), R, undefined, ink);
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

// ─── 차분한 — 사진에서 딴 돌 (2026-10-01) ─────────────────────────────
// 위키미디어 CC0 · 공공 사진에서 뗀 돌 다섯(design/stone-photo, 윤곽은 stonePhoto.data.ts) — 날 선 깨진 돌, 밑은 바닥에 평평하게.
// 고른 과정과 버린 것은 design/landscape.md '돌'. 값은 PERSONAS.chabun.stone.photo.

/** 돌 s(flip = 좌우 뒤집기)를 −ang 돌려 놓은 판(글 축)의 칸 격자 — 칸 c(돌 단위: 키 = 1), 판의 왼쪽 위(x0 · y0), 안전하지 않은
    칸(제 칸과 네 이웃이 다 안이 아닌 칸)의 누적합, 무게중심(칸). 같은 돌 · 같은 각도는 한 번만 짓는다 */
type StoneGrid = { W: number; H: number; c: number; x0: number; y0: number; sat: Int32Array; cx: number; cy: number };
const STONE_GRIDS = new Map<string, StoneGrid>();
function stoneGrid(s: StoneShape, flip: boolean, ang: number, N: number): StoneGrid {
  const key = `${s.id}|${flip ? 1 : 0}|${ang.toFixed(4)}|${N}`, had = STONE_GRIDS.get(key);
  if (had) return had;
  const ca = Math.cos(-ang), sa = Math.sin(-ang);
  const Q = s.pts.map(([x, y]): Pt => { const X = (flip ? 1 - x : x) * s.aspect; return [X * ca - y * sa, X * sa + y * ca]; });
  const xs = Q.map((q) => q[0]), ys = Q.map((q) => q[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), c = Math.max(Math.max(...xs) - x0, Math.max(...ys) - y0) / N;
  const W = Math.ceil((Math.max(...xs) - x0) / c), H = Math.ceil((Math.max(...ys) - y0) / c), inn = new Uint8Array(W * H);
  let mx = 0, my = 0, n = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (inPolygon(x0 + (x + 0.5) * c, y0 + (y + 0.5) * c, Q)) { inn[y * W + x] = 1; mx += x + 0.5; my += y + 0.5; n++; }
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : inn[y * W + x]);
  const sat = new Int32Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += at(x, y) && at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1) ? 0 : 1;
      sat[(y + 1) * (W + 1) + x + 1] = sat[y * (W + 1) + x + 1] + row;
    }
  }
  const g = { W, H, c, x0, y0, sat, cx: mx / Math.max(1, n), cy: my / Math.max(1, n) };
  if (STONE_GRIDS.size >= 120) STONE_GRIDS.delete(STONE_GRIDS.keys().next().value!);
  STONE_GRIDS.set(key, g);
  return g;
}

type StoneFit = { s: StoneShape; flip: boolean; k: number; cx: number; cy: number; long: number };
/** 글 + 여백 네모(가로 ÷ 세로 = asp, 높이 RH u)가 각도 ang으로 드는 가장 큰 자리의 spot배, 무게중심에 가장 가까운 곳 —
    k = 돌 단위 → u, (cx, cy) = 네모 가운데(돌 단위), long = 돌의 긴 쪽(u). 없으면 null. shrink = 그만큼 칸을 줄여 잡는다
    (= 돌이 커진다) — 실제 윤곽에 걸렸을 때 다시 맞추는 몫 */
function stoneFit(s: StoneShape, flip: boolean, ang: number, asp: number, RH: number, p: NonNullable<NonNullable<Persona['stone']>['photo']>, shrink = 0): StoneFit | null {
  const g = stoneGrid(s, flip, ang, p.grid), W1 = g.W + 1;
  const out = (x: number, y: number, w: number, h: number) => g.sat[(y + h) * W1 + x + w] - g.sat[y * W1 + x + w] - g.sat[(y + h) * W1 + x] + g.sat[y * W1 + x];
  const fits = (h: number) => {
    const w = Math.round(h * asp);
    if (w < 1 || w > g.W || h > g.H) return false;
    for (let y = 0; y + h <= g.H; y++) for (let x = 0; x + w <= g.W; x++) if (!out(x, y, w, h)) return true;
    return false;
  };
  let lo = 0, hi = g.H + 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (fits(m)) lo = m; else hi = m; }
  if (lo < 2) return null;
  const h = Math.max(2, Math.floor(lo * p.spot) - shrink), w = Math.max(1, Math.round(h * asp));
  let bx = -1, by = -1, bd = Infinity;
  for (let y = 0; y + h <= g.H; y++) for (let x = 0; x + w <= g.W; x++) {
    if (out(x, y, w, h)) continue;
    const d = (x + w / 2 - g.cx) ** 2 + (y + h / 2 - g.cy) ** 2;
    if (d < bd) { bd = d; bx = x; by = y; }
  }
  if (bx < 0) return null;
  const tx = g.x0 + (bx + w / 2) * g.c, ty = g.y0 + (by + h / 2) * g.c, cb = Math.cos(ang), sb = Math.sin(ang), k = RH / (h * g.c);
  return { s, flip, k, cx: tx * cb - ty * sb, cy: tx * sb + ty * cb, long: Math.max(s.aspect, 1) * k };
}

/**
 * 차분한의 사진 돌 — 글이 먼저다(구름 · 나무와 같은 길, 2026-10-01 디자이너가 격자로 골랐다).
 *
 * 걸기 셋(올려 · 중간 · 내려)은 **글만 기운다** — 기하 돌처럼 윗변을 글과 나란히 자르면 사진 돌의 윗선이 톱으로 켠 듯
 * 평평해진다(디자이너). 글 + 여백(PAD) 네모를 그 각도로 기울여 돌마다(다섯 × 좌우) 넣어 보고, 네모가 겨우 드는 크기로
 * 돌을 맞춘다. 고르기: 걸기 세 각도 모두에서 벽 글자를 안 줄이는(긴 쪽 ≤ 1 ÷ (UNIT_TOP × 크기)) 돌 가운데 글이 씨앗으로
 * 하나 — 그런 돌이 pick보다 적으면 가장 긴 쪽이 가장 짧은 pick가지에서. 세 각도로 고르니 4/5에서 칸을 바꿔도 돌은 그대로고
 * 기울기만 바뀐다.
 * 자리는 무게중심에 가장 가까운 곳, 줄은 걸기처럼 왼끝 맞춤. 칸이 생기기 전의 옛 글(가운데)은 0°, 제 줄 맞춤 그대로.
 * 칸 격자는 실제 윤곽보다 거칠다 — 지은 뒤 네모의 둘레를 실제 윤곽으로 확인하고, 걸리면 한 칸씩 줄여 다시 맞춘다.
 * 그리기 · 벽은 기하 돌과 같다 — 곧은 변으로 이은 다각형(Stone.pts)이고 밑면은 y = 바닥인 곧은 변 하나다.
 */
function photoStoneFor(pr: Persona, rule: 'B' | 'C', TW: number, TH: number, R: () => number, mode: 'center' | 'hang-up' | 'hang-mid' | 'hang-down', fill: number,
  txt?: { rows: readonly (readonly [number, number, number, number])[]; em: number; ink: { weight: number; stroke: number } }): Cloud {
  const s = pr.stone!, p = s.photo!;
  const ang = mode === 'center' ? 0 : ((mode === 'hang-up' ? s.hang.up : mode === 'hang-mid' ? s.hang.mid : s.hang.down) * Math.PI) / 180;
  const RW = TW + 2 * PAD, RH = TH + 2 * PAD, cap = 1 / (UNIT_TOP * fill);
  // 돌마다 걸기 세 각도에 다 넣어 보고 그중 가장 긴 쪽으로 견준다 — 0°로만 고르니 올려 걸기(−12°)에서 커지는 돌이 걸려
  // 보통 크기의 긴 글 19/200이 벽 글자를 89%까지 줄였다(2026-10-01, 재서). 세 각도 모두로 고르니 칸을 바꿔도 돌은 그대로다
  const angs = [s.hang.up, s.hang.mid, s.hang.down].map((d) => (d * Math.PI) / 180);
  const each: (StoneFit & { worst: number })[] = [];
  for (const sh of STONE_PHOTOS) for (const flip of [false, true]) {
    const fs = angs.map((a) => stoneFit(sh, flip, a, RW / RH, RH, p));
    if (fs.every((f) => f)) each.push({ ...fs[1]!, worst: Math.max(...fs.map((f) => f!.long)) });
  }
  const ok = each.filter((f) => f.worst <= cap);
  const pool = ok.length >= p.pick ? ok : [...each].sort((a, b) => a.worst - b.worst || a.s.id.localeCompare(b.s.id)).slice(0, p.pick);
  const chosen = pool[Math.floor(R() * pool.length)] ?? { s: STONE_PHOTOS[0], flip: false };
  // 고른 돌에 그 칸의 각도로 — 실제 윤곽으로 둘레를 확인하고 걸리면 한 칸씩 줄여 다시
  const build = (f: StoneFit) => {
    const P = f.s.pts.map(([x, y]): Pt => [(f.flip ? 1 - x : x) * f.s.aspect * f.k, y * f.k]);
    const cx = f.cx * f.k, cy = f.cy * f.k, ca = Math.cos(ang), sa = Math.sin(ang);
    const rim = rimOf(-RW / 2, -RH / 2, RW / 2, RH / 2, 24).map(([u, v]): Pt => [cx + u * ca - v * sa, cy + u * sa + v * ca]);
    return { f, P, cx, cy, fits: rim.every(([x, y]) => inPolygon(x, y, P)) };
  };
  let f = stoneFit(chosen.s, chosen.flip, ang, RW / RH, RH, p) ?? stoneFit(chosen.s, chosen.flip, 0, RW / RH, RH, p)!;
  let got = build(f);
  for (let k = 1; !got.fits && k <= 8; k++) {
    const g = stoneFit(chosen.s, chosen.flip, ang, RW / RH, RH, p, k);
    if (!g) break;
    f = g; got = build(g);
  }
  // 상자 — 기하 돌처럼 가장자리가 잘리지 않게 조금 넉넉히
  const e = 0.05, mv = ([x, y]: Pt): Pt => [x + e, y + e], pts = got.P.map(mv);
  // 결(StoneArt) — 글자 획의 평균 굵기 = 본명조의 그 무게 + 덧댄 획(em) × em(u)
  const tex = p.tex, sw = (w: number) => {
    const T = tex?.stroke ?? [];
    if (!T.length) return 0;
    let i = 0;
    while (i < T.length - 2 && w > T[i + 1][0]) i++;
    const [w0, s0] = T[i], [w1, s1] = T[Math.min(i + 1, T.length - 1)];
    return w1 === w0 ? s0 : s0 + ((s1 - s0) * (w - w0)) / (w1 - w0);
  };
  const photo = txt ? { id: f.s.id, flip: f.flip, base: f.k + e, lines: txt.rows, em: txt.em, ink: (sw(txt.ink.weight) + txt.ink.stroke) * txt.em } : undefined;
  return {
    persona: pr, rule, circles: [], spikes: [],
    stone: { pts, hatch: s.hatch.on ? hatchBands(pts, got.cx + e, got.cy + e, s.hatch) : [], ...(photo ? { photo } : {}) },
    w: f.s.aspect * f.k + 2 * e, h: f.k + 2 * e,
    text: { x: got.cx + e - TW / 2, y: got.cy + e - TH / 2, w: TW, h: TH },
    ...(mode !== 'center' ? { layout: { align: 'left' as const, rotate: ang } } : {})
  };
}

/** 땅에 묻힌 아랫부분 — 윗선을 밑변에 비춰 뒤집고 돌 키의 이만큼으로 눌렀다(디자이너, 격자: 거울 20 · 35 · 50% · 둥근 배).
    벽에서는 바닥이 돌의 윗부분하고만 닿고 아랫부분은 바닥을 지나 화면 아래에 묻힌다 — 바닥에 앉은 돌은 전처럼 밑이 곧게 붙고,
    다른 돌에 얹히거나 구르면 아랫부분이 드러난다(디자이너 — "안 보이던 돌의 아랫부분이 보여지는 게 자연스럽잖아").
    폰(4/5 · 5/5)에서는 바닥 없이 배까지 한 덩이로 선다(2026-10-04, 디자이너 — stoneWhole) */
export const STONE_BELLY = 0.35;
/** 돌의 윤곽(밑변이 가장 아래의 곧은 변) → 보이는 윗사슬(밑변 한 끝 → 윗선 → 다른 끝)과 땅에 묻힌 아랫부분. 밑변이 곧지
    않으면(기하 돌 — photo를 지웠을 때) 아랫부분이 없다 */
export function stoneBelly(pts: readonly (readonly [number, number])[]): { chain: Pt[]; belly: Pt[] } {
  const n = pts.length, yb = Math.max(...pts.map((p) => p[1])), on = (p: readonly [number, number]) => p[1] > yb - 1e-3;
  let i = 0;
  while (i < n && !(on(pts[i]) && on(pts[(i + 1) % n]))) i++;
  if (i === n) return { chain: pts.map((p): Pt => [p[0], p[1]]), belly: [] };
  const chain: Pt[] = [];
  for (let k = 1; k <= n; k++) { const p = pts[(i + k) % n]; chain.push([p[0], p[1]]); }
  const belly = chain.slice(1, -1).reverse().map(([x, y]): Pt => [x, yb + (yb - y) * STONE_BELLY]);
  return { chain, belly };
}
/** 배까지 다 그린 사진 돌 — 상자도 배까지 늘린다(폰 4/5 · 5/5, 2026-10-04 디자이너 — 바닥 없이 떠 있는 돌의 밑이 곧게 잘려
    보였다). 벽의 돌은 이것을 쓰지 않는다 — 상자는 윗부분 그대로 바닥에 앉고 배는 상자 밑으로 그린다(WallSimulation · withBelly) */
export function stoneWhole(cloud: Cloud): Cloud {
  if (!cloud.stone?.photo) return cloud;
  const { chain, belly } = stoneBelly(cloud.stone.pts);
  if (!belly.length) return cloud;
  const low = Math.max(...belly.map((p) => p[1]));
  return { ...cloud, h: Math.max(cloud.h, low + 0.05), stone: { ...cloud.stone, pts: [...chain, ...belly] } };
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

// ─── 당당한 — 사진 나무 (2026-09-30) ────────────────────────────────
// 사진(위키미디어 CC0)에서 뗀 한 그루 13장(design/tree-photo, 재는 판은 treePhoto.data.ts) 가운데서 고른다. 말투가 종을
// 고른다 — 예리한 = 소나무, 온화한 = 버드나무. 고른 과정과 버린 것은 design/landscape.md '나무'. 값은 PERSONAS.ttoryeot.tree.

type Rect4 = readonly [number, number, number, number];
/** 나무 한 장의 칸 격자 — 칠 밖 · 그늘의 누적합(칸 네모 안에 몇 칸인가를 한 번에 센다), 수관 가운데(칸).
    뒤집고(flip) · 옆으로 늘인(sx) 격자는 받은 격자에서 칸을 옮겨 짓는다 — 그리는 판도 같은 비로 늘인다(TreeArt) */
type TreeGrid = { W: number; H: number; out: Int32Array; shade: Int32Array; cx: number; cy: number };
const TREE_GRIDS = new Map<string, TreeGrid>();
function treeGrid(s: TreeShape, flip: boolean, sx: number): TreeGrid {
  const key = `${s.id}|${flip ? 1 : 0}|${sx.toFixed(3)}`, had = TREE_GRIDS.get(key);
  if (had) return had;
  const W = Math.max(1, Math.round(s.gw * sx)), H = s.gh, W1 = W + 1, pa = atob(s.paint), sa = atob(s.shade);
  const bit = (raw: string, i: number) => (raw.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  const from = Array.from({ length: W }, (_, x) => { const k = Math.min(s.gw - 1, Math.floor(((x + 0.5) * s.gw) / W)); return flip ? s.gw - 1 - k : k; });
  const out = new Int32Array(W1 * (H + 1)), shade = new Int32Array(W1 * (H + 1));
  for (let y = 0; y < H; y++) {
    let ro = 0, rs = 0;
    for (let x = 0; x < W; x++) {
      ro += 1 - bit(pa, y * s.gw + from[x]); rs += bit(sa, y * s.gw + from[x]);
      out[(y + 1) * W1 + x + 1] = out[y * W1 + x + 1] + ro;
      shade[(y + 1) * W1 + x + 1] = shade[y * W1 + x + 1] + rs;
    }
  }
  const cx = ((flip ? s.gw - s.cx : s.cx) * W) / s.gw;
  const g = { W, H, out, shade, cx, cy: s.cy };
  if (TREE_GRIDS.size >= 200) TREE_GRIDS.delete(TREE_GRIDS.keys().next().value!);
  TREE_GRIDS.set(key, g);
  return g;
}
function satIn(sat: Int32Array, W1: number, x0: number, y0: number, x1: number, y1: number): number {
  return sat[y1 * W1 + x1] - sat[y0 * W1 + x1] - sat[y1 * W1 + x0] + sat[y0 * W1 + x0];
}

/**
 * 격자 G의 나무를 키 H0 × g(u)로 세웠을 때 글의 발자국(foot — 칠 위에 있어야 하는 네모들, 글 좌표 u)이 들어가는 자리.
 * best = false면 들어가는 자리가 있는지만(처음 찾은 곳), true면 수관 가운데에 가깝고(세로는 1.2배로 쳐서) 그늘에 덜 걸리는 곳.
 * 칸으로 옮길 때 네모를 바깥으로 둥글린다 — 칸 격자가 실제 윤곽보다 거친 몫을 글 쪽이 떠안는다
 */
function treePlace(G: TreeGrid, H0: number, g: number, foot: readonly Rect4[], best: boolean): { X: number; Y: number; c: number; fx: number; fy: number } | null {
  const W1 = G.W + 1, c = (H0 * g) / G.H;
  const fx = Math.min(...foot.map((r) => r[0])), fy = Math.min(...foot.map((r) => r[1]));
  const R = foot.map((r): Rect4 => [Math.floor((r[0] - fx) / c), Math.floor((r[1] - fy) / c), Math.ceil((r[2] - fx) / c), Math.ceil((r[3] - fy) / c)]);
  const fw = Math.max(...R.map((r) => r[2])), fh = Math.max(...R.map((r) => r[3]));
  if (fw > G.W || fh > G.H) return null;
  const area = R.reduce((a, r) => a + (r[2] - r[0]) * (r[3] - r[1]), 0) || 1;
  let bx = -1, by = -1, bd = Infinity;
  for (let Y = 0; Y + fh <= G.H; Y++) for (let X = 0; X + fw <= G.W; X++) {
    let ok = true;
    for (const r of R) if (satIn(G.out, W1, X + r[0], Y + r[1], X + r[2], Y + r[3])) { ok = false; break; }
    if (!ok) continue;
    if (!best) return { X, Y, c, fx, fy };
    let sh = 0;
    for (const r of R) sh += satIn(G.shade, W1, X + r[0], Y + r[1], X + r[2], Y + r[3]);
    const d = Math.hypot(X + fw / 2 - G.cx, (Y + fh / 2 - G.cy) * 1.2) / G.H + (0.8 * sh) / area;
    if (d < bd) { bd = d; bx = X; by = Y; }
  }
  return bx < 0 ? null : { X: bx, Y: by, c, fx, fy };
}
/** 글이 들어갈 때까지 나무를 grow배씩 키운 배수 — 두 배씩 건너뛰어 찾고 그 사이를 반씩 좁힌다(키가 클수록 잘 든다). 한계까지 안 들면 null */
function treeGrow(G: TreeGrid, H0: number, foot: readonly Rect4[], t: NonNullable<Persona['tree']>): number | null {
  const ok = (k: number) => !!treePlace(G, H0, t.grow ** k, foot, false);
  if (ok(0)) return 1;
  const K = Math.ceil(Math.log(t.maxGrow) / Math.log(t.grow));
  let lo = 0, hi = 1;
  while (hi <= K && !ok(hi)) { lo = hi; hi *= 2; }
  if (hi > K) { if (!ok(K)) return null; hi = K; }
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ok(m)) hi = m; else lo = m; }
  return t.grow ** hi;
}
/**
 * 폭 늘이기(2026-09-30, 디자이너 — '구름처럼 유동성 있는 규칙'): 글 덩어리의 가로 ÷ 세로(asp)를 따라 나무 폭을 늘이거나
 * 줄인다 — (asp ÷ ref)^pow를 lo~hi 안으로. 옆으로 긴 글은 넓은 나무, 세로쓰기는 좁고 높은 나무. 구름의 '두툼하게'와 같은
 * 자리다. 그 폭에서 안 들면 키우기 전에 step씩 넓혀 본다(hi까지) — 나무가 위로만 치솟지 않게
 */
function treeWidths(asp: number, st: NonNullable<Persona['tree']>['stretch']): number[] {
  const want = Math.min(st.hi, Math.max(st.lo, (asp / st.ref) ** st.pow)), out = [want];
  for (let v = want + st.step; v < st.hi - 1e-6; v += st.step) out.push(v);
  if (out[out.length - 1] < st.hi - 1e-6) out.push(st.hi);
  return out;
}

/**
 * 당당한의 나무 — 사진에서 뗀 한 그루에 글이 든다(2026-09-30, 디자이너가 격자로 골랐다).
 *
 * 글: 크기 막대가 고른 글자의 text배(1.4 — '여백이 커서 글이 작다', 1.3~1.6을 세 배열로 보고). 한 줄 12자(앱 전체와 같다 —
 * 사진 수관이 옆으로 넓다). 배열 셋 — 기본: 줄 가운데 맞춤. 사선(R24, 2026-10-04 — 메뉴판 캡처): 글자는 똑바로 선 채 한 자씩
 * 아래에 놓여 줄이 slant°(24)의 사선을 그리고, 줄 머리는 한 세로선, 다음 줄은 pitch(1.6) × 글자 높이 아래. 전에는 글자째
 * 18° 돌리고 줄 머리가 오른쪽 아래로 비켜 섰다(60°는 고개를 꺾어 읽었다). 세로쓰기: 오른쪽 줄부터, 한 자씩 위에서 아래로.
 * 끄트머리 잘리게(R18): 줄 끝(기본 · 사선은 앞뒤, 세로쓰기는 위아래)은 윤곽 밖으로 bleed만큼 나가 벽에 묻혀도 되고, 그 밖의
 * 둘레는 gap만큼 칠 위에 남는다. 수관 안쪽 빈 틈으로 나가는 것도 된다(디자이너 — 실루엣이 재밌다).
 *
 * 키: 크기 막대가 곧 벽에서 나무의 키(tall — 벽 높이의 20~60%, 글이 씨앗으로 ±jitter). 그 키에서 글이 안 들어가면 나무만
 * grow배씩 키운다 — 글자는 줄지 않는다. 60%를 넘어도 된다(디자이너).
 *
 * 고르기: 그 종의 나무마다 넣어 보고, 키우지 않고 드는 나무들 가운데서 글이 씨앗으로 하나. 그런 나무가 없으면 가장 덜 자라는
 * 나무(구름과 같은 길 — 좁은 나무에 긴 사선 글이 걸려 벽 높이의 70%로 치솟는 일이 드물다). 자리는 칠 위에 드는 곳 가운데
 * 수관 가운데에 가깝고 그늘에 덜 걸리는 곳.
 *
 * 상자(w · h)는 수관과 줄기 윗부분(수관 밑에서 키의 stem만큼)까지다 — 폰은 이 상자로 크기를 재고, 그 밑의 줄기는 상자
 * 밖으로 이어져 무대 밑이 자른다. 벽은 나무 전체(full)를 바닥에서 세운다. 그리는 일(칠 · 빗금 · 바람)은 CloudBubble.
 */
function treeFor(pr: Persona, rule: 'B' | 'C', lines: readonly string[], font: string | undefined, optic: number, scaleX: number, o: Options, LH: number, R: () => number): Cloud {
  const t = pr.tree!, mode = o.align === 'slant' || o.align === 'vertical' ? o.align : 'basic';
  const adv = advanceFor(BY_FONT[font ?? ''] ?? font ?? '', o.wdth), tr = o.track ?? 0;
  const lh = pr.lh ?? LINE_HEIGHT, gh = LH / lh;           // 글자 높이 (u) — 세로 비율까지
  const gw = optic * scaleX;                                // 세로쓰기 한 줄의 폭 — 글자 칸 1em (u)
  const L = lines.map((line) => {
    const cs = Array.from(line);
    const av = cs.map((ch) => ((ch === ' ' ? adv.space : /[A-Za-z0-9.,!?'"-]/.test(ch) ? LATIN : adv.hangul) + tr) * optic * scaleX);
    return { cs, av, len: Math.max(0.5, av.reduce((s, v) => s + v, 0)) };
  });
  const TW = Math.max(...L.map((l) => l.len));

  // 글자 · 발자국 — 원점은 아무 데나(자리를 찾은 뒤 옮긴다). 발자국은 칠 위에 있어야 하는 네모들: 줄 끝은 bleed만큼 안으로,
  // 나머지 둘레는 gap만큼 밖으로 — 넘치는 깊이는 줄 길이의 20%까지(한두 자 줄이 통째로 밖에 나가지 않게). zones는 글자가 실제로
  // 차지하는 네모(그늘을 걷고 바람을 멈출 자리)
  const placed: { c: string; x: number; y: number; a: number; w: number; h: number }[] = [];
  const foot: Rect4[] = [], zones: Rect4[] = [], b = t.bleed, p = t.gap;
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
      const len = Math.max(gh, y), e = Math.min(b, 0.2 * len);
      zones.push([x1 - gw, 0, x1, len]);
      foot.push([x1 - gw - p, e, x1 + p, len - e]);
    });
  } else if (mode === 'slant') {
    // R24: 글자는 돌리지 않는다(a = 0). 글자 가운데의 가로 자리 k만큼 tan × k 내려 놓아 줄이 사선을 그린다.
    // 줄 머리는 x = 0 한 세로선, 다음 줄은 pitch × 글자 높이 아래(격자 18 · 24 · 30° × 1.6 · 2.2 · 2.8에서 디자이너가 24° · 1.6).
    // 마지막 줄(두 줄 이상일 때)은 오른 끝 정렬 — 끝을 가장 긴 줄의 끝(TW)에 맞추고, 높이는 같은 사선 레일(y0 + x × tan)을 따른다(디자이너)
    const tn = Math.tan((t.slant * Math.PI) / 180);
    L.forEach((l, i) => {
      const y0 = i * t.pitch * gh;
      const mine: Rect4[] = [];
      let s = i === L.length - 1 && L.length > 1 ? TW - l.len : 0;
      l.cs.forEach((c, j) => {
        const k = s + l.av[j] / 2;
        if (c.trim()) {
          const q = { c, x: k, y: y0 + k * tn + gh / 2, a: 0, w: l.av[j], h: gh };
          placed.push(q);
          mine.push([q.x - q.w / 2, q.y - q.h / 2, q.x + q.w / 2, q.y + q.h / 2]);
        }
        s += l.av[j];
      });
      const e = Math.min(b, 0.2 * l.len);
      mine.forEach((r, j) => {
        zones.push(r);
        foot.push([r[0] + (j === 0 ? e : -p), r[1] - p, r[2] + (j === mine.length - 1 ? -e : p), r[3] + p]);
      });
    });
  } else {
    L.forEach((l, i) => {
      const x0 = -l.len / 2, y0 = i * LH + (LH - gh) / 2;
      const e = Math.min(b, 0.2 * l.len);
      zones.push([x0, y0, x0 + l.len, y0 + gh]);
      foot.push([x0 + e, y0 - p, x0 + l.len - e, y0 + gh + p]);
    });
  }
  if (!foot.length) { zones.push([-0.25, 0, 0.25, gh]); foot.push([-0.25, -p, 0.25, gh + p]); }

  // 키(u) — 벽에서 나무 키 tall × 벽 높이 = 벽 한 변(WALL_SIDE × 벽 높이) × 글자(unit) × 키(u)
  const fill = o.fill ?? SIZE_FILLS[2];
  const x = (fill - SIZE_FILLS[0]) / (SIZE_FILLS[SIZE_FILLS.length - 1] - SIZE_FILLS[0]);
  const tall = t.tall[0] + (t.tall[1] - t.tall[0]) * x + t.jitter * (2 * R() - 1);
  const unitK = WALL_SIDE * UNIT_TOP * fill * t.text;      // 키(벽 높이의 비율) ÷ 키(u)

  // 고르기 — 말투가 종을(말투가 없는 옛 글은 온화한 · 버드나무). 좌우는 글이 씨앗으로(flip), 폭은 글 모양이(treeWidths).
  // 그 종의 나무마다 폭을 대 보고, 키우지 않고 드는 나무들 가운데 글이 씨앗으로 하나 — 없으면 가장 덜 자라는 나무
  const flip = R() < t.flip;
  const fb = [Math.min(...foot.map((r) => r[0])), Math.min(...foot.map((r) => r[1])), Math.max(...foot.map((r) => r[2])), Math.max(...foot.map((r) => r[3]))];
  const widths = treeWidths((fb[2] - fb[0]) / Math.max(0.01, fb[3] - fb[1]), t.stretch);
  // 종 — 말투가 남은 옛 글은 말투로(1 = 예리한 = 소나무 · 0 = 온화한 = 버드나무). 2026-10-04부터 당당한은 말투 대신 무게를
  // 묻고 무게가 고른다(디자이너): 가볍게 = 버드나무 · 무겁게 = 소나무 · 보통 = 세 번째 나무(아직 없다 — 들기 전까지 소나무)
  const sp = typeof o.manner === 'number' ? (o.manner === 1 ? 'pine' : 'willow') : (o.weightPos ?? 0.5) < 0.25 ? 'willow' : 'pine';
  const kin = TREE_PHOTOS.filter((s) => s.species === sp);
  // 글에 맞춤(hug) — 크기 막대는 글자만 정하고, 나무는 글이 겨우 드는 가장 작은 키 × hug(구름처럼 글이 틀을 정한다). 비교 중
  const H0 = t.hug ? Math.max(1, (fb[3] - fb[1]) * 1.2) : tall / unitK;
  // 글에 맞춤은 가장 작게 드는 키를 찾는다 — 이미 찾은 것보다 크게 드는 경우는 따지지 않는다(폭마다 · 나무마다 한계를 좁힌다.
  // 안 좁히면 사선 소나무 한 글에 50ms 넘게 걸렸다). 나무는 가장 작은 것의 fit배 안에 드는 것만 후보라 그 밖은 볼 까닭이 없다
  let bound = 12;
  const each = kin.map((s) => {
    if (t.hug) {
      // 폭은 글 모양이 정한 하나(widths[0]) — 넓은 폭일수록 작게 들어, 모두 대 보면 늘 가장 넓은 폭이 이겨 폭 늘이기가 흐려졌다.
      // 상한에 걸릴 때 넓혀 보던 것도 뺐다 — 세로로 긴 글에 좌우로 빈 수관만 커졌다(2026-10-01, 폰 60자 세로쓰기)
      const g = treeGrow(treeGrid(s, flip, widths[0]), H0, foot, { ...t, maxGrow: bound });
      if (g !== null) bound = Math.min(bound, g * t.hug.fit);
      return g === null ? null : { s, sx: widths[0], g };
    }
    for (const sx of widths) if (treePlace(treeGrid(s, flip, sx), H0, 1, foot, false)) return { s, sx, g: 1 };
    const sx = widths[widths.length - 1], g = treeGrow(treeGrid(s, flip, sx), H0, foot, t);
    return g === null ? null : { s, sx, g };
  }).filter((e): e is { s: TreeShape; sx: number; g: number } => e !== null);
  const least = Math.min(...each.map((e) => e.g));
  // 글에 맞춤 — 가장 작게 드는 나무의 fit배 안에서. 그 가장 작은 나무도 상한을 넘으면 그 나무 하나(글을 가장 알뜰하게 품는
  // 나무 — 나무를 글과 함께 줄이는 몫이 가장 적다)
  const overCap = !!t.hug && H0 * least * t.hug.hi * unitK > t.maxTall;
  const pool = !each.length ? [{ s: kin[0], sx: 1, g: t.maxGrow }] : t.hug ? each.filter((e) => (overCap ? e.g === least : e.g <= least * t.hug!.fit)) : each.filter((e) => e.g === 1 || e.g === least);
  const pick = pool[Math.floor(R() * pool.length)], { s, sx } = pick;
  const g = t.hug ? pick.g * (t.hug.lo + (t.hug.hi - t.hug.lo) * R() ** t.hug.pow) : pick.g;
  const G = treeGrid(s, flip, sx);
  const at = treePlace(G, H0, g, foot, true) ?? { X: 0, Y: 0, c: (H0 * g) / G.H, fx: 0, fy: 0 };
  const c = at.c, dx = at.X * c - at.fx, dy = at.Y * c - at.fy;   // 글 좌표 → 나무 좌표(u, 나무 왼쪽 위)
  const W = G.W * c, kx = W / s.gw;                    // kx = 받은 격자 한 칸이 몇 u인가(가로)
  // 줄기만 늘이기 — 줄기의 from~to 구간(위는 가지 끄트머리, 밑은 뿌리 쪽이라 뺀다)을 k배. 나무 전체 키 full
  const base = G.H * c, tk = t.trunk, y0 = (s.trunk + tk.from * (G.H - s.trunk)) * c, y1 = (s.trunk + tk.to * (G.H - s.trunk)) * c;
  // 더 키울 길이(u) — 상한까지 남은 틈 안에서 뽑는다. 늘인 뒤 상한에서 자르면 보통 크기 나무의 60% 넘게가 꼭 상한 높이에
  // 닿아 꼭대기가 한 줄로 가지런해졌다(높이 다양성과 반대, 2026-10-01 재서 봤다)
  const roomTall = Math.max(0, t.maxTall - base * unitK);
  const more = Math.max(0, tk.lo + (Math.min(tk.hi, roomTall) - tk.lo) * R() ** tk.pow) / unitK;
  // 상한(maxTall) — 늘이기 전에도 넘으면 나무를 글과 함께 줄인다(shrink)
  const room = Math.max(1, 1 + (t.maxTall / unitK - base) / Math.max(1e-6, y1 - y0));
  const kT = Math.min(tk.max, room, 1 + more / Math.max(1e-6, y1 - y0)), full = base + (y1 - y0) * (kT - 1);
  const shrink = Math.min(1, t.maxTall / (full * unitK));

  // 글 자리 — 기본은 여느 글 상자, 사선 · 세로쓰기는 한 자씩(모서리까지 품는 상자)
  let tb: { x0: number; y0: number; x1: number; y1: number }, layout: TextLayout | undefined;
  if (mode === 'basic') tb = { x0: -TW / 2 + dx, y0: dy, x1: TW / 2 + dx, y1: L.length * LH + dy };
  else {
    const corners = placed.flatMap((q) => {
      const ca = Math.cos(q.a), sa = Math.sin(q.a);
      return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]): Pt => [q.x + dx + (u * q.w * ca - v * q.h * sa) / 2, q.y + dy + (u * q.w * sa + v * q.h * ca) / 2]);
    });
    if (!corners.length) corners.push([dx, dy], [dx + 0.5, dy + gh]);
    tb = { x0: Math.min(...corners.map((q) => q[0])) - 0.06, y0: Math.min(...corners.map((q) => q[1])) - 0.06,
      x1: Math.max(...corners.map((q) => q[0])) + 0.06, y1: Math.max(...corners.map((q) => q[1])) + 0.06 };
    layout = {
      glyphs: placed.map((q) => ({ c: q.c, x: (q.x + dx - tb.x0) / optic, y: (q.y + dy - tb.y0) / optic, a: q.a })),
      box: { w: (tb.x1 - tb.x0) / optic, h: (tb.y1 - tb.y0) / optic }
    };
  }
  // 상자 — 수관 + 줄기 윗부분. 글이 그보다 아래로 내려오면 글 밑까지
  const h = Math.min(full, Math.max((s.crown + t.stem * s.gh) * c, tb.y1 + PAD));
  return {
    persona: pr, rule, circles: [], spikes: [],
    tree: {
      id: s.id, species: s.species, img: s.img, full, base, trunk: { y0, y1, k: kT }, tall: full * unitK * shrink, shrink, flip, sx: W / (s.gw * c),
      ...(s.drape ? { drape: { seed: Math.floor(R() * 2 ** 31), L: t.drape } } : {}),
      zones: zones.map((r): Rect4 => [r[0] + dx, r[1] + dy, r[2] + dx, r[3] + dy]),
      perch: s.perch.map(([px, py]): Pt => [(flip ? s.gw - px : px) * kx, py * c])
    },
    w: W, h,
    text: { x: tb.x0, y: tb.y0, w: tb.x1 - tb.x0, h: tb.y1 - tb.y0 },
    ...(layout ? { layout } : {})
  };
}

// ─── 다정한 — 사진에서 딴 띠 구름 (2026-09-30) ─────────────────────────
// 원본 사진(위키미디어 CC0 · 공공 저작물)에서 구름 머리를 떼어 이 PC에서 합성한 띠 12장(design/cloud-photo, 윤곽은
// cloudPhoto.data.ts) 가운데서 고른다. 글이 먼저다: 글 + 여백(PAD) 네모가 드는 가장 작은 크기로 띠를 맞추고, 벽의
// 크기는 꼬리를 뺀 몸통으로 잰다. 고른 과정과 버린 것은 design/landscape.md '구름'. 값은 PERSONAS.doran.photo.

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

/**
 * 휜 배치의 글자 자리(2026-09-28, 디자이너 — '아치' · '미소'처럼 다정함과 어울리는 정렬. 부채꼴은 09-30에 칸에서 뺐고
 * 옛 글만 쓴다). 줄마다 제 길이를 같은 중심의 호에 얹는다 — 자간 · 행간은 그대로다(디자이너 몫). 글자는 제 가운데가
 * 호 위에 서고 호를 따라 기운다.
 * - 아치: 중심이 아래, 첫 줄(가장 바깥)의 반지름 = 가장 긴 줄 × arc.bow(4u 이상), 아래 줄은 한 줄씩 안으로
 * - 부채꼴: 중심이 아래, 가장 긴 줄이 arc.fan°를 두를 만큼 중심이 가깝다 — 마지막 줄이 가장 안쪽
 * - 미소: 아치를 뒤집어 중심이 위 — 양 끝이 올라간다
 * 구슬 구름 때는 구름도 같이 휘었다. 띠 구름은 사진이라 휘지 않고, 휜 글 덩어리 전체를 품는다.
 */
function arcGlyphs(pr: Persona, lines: readonly string[], font: string | undefined, optic: number, scaleX: number, o: Options, LH: number, mode: 'arch' | 'fan' | 'smile'):
    { tb: { x0: number; y0: number; x1: number; y1: number }; chars: Pt[]; layout: TextLayout } {
  const b = pr.photo!.arc;
  const adv = advanceFor(BY_FONT[font ?? ''] ?? font ?? '', o.wdth), tr = o.track ?? 0;
  const L = lines.map((line) => {
    const cs = Array.from(line);
    const av = cs.map((ch) => ((ch === ' ' ? adv.space : /[A-Za-z0-9.,!?'"-]/.test(ch) ? LATIN : adv.hangul) + tr) * optic * scaleX);
    return { cs, av, len: Math.max(0.5, av.reduce((s, v) => s + v, 0)) };
  });
  const n = L.length, Lmax = Math.max(...L.map((l) => l.len));
  let Rr: number[];
  if (mode === 'fan') {
    const span = (b.fan * Math.PI) / 180, rin = Math.max(0.9, ...L.map((l, i) => l.len / span - (n - 1 - i) * LH));
    Rr = L.map((_, i) => rin + (n - 1 - i) * LH);
  } else {
    const R0 = Math.max(Lmax * b.bow, 4);
    Rr = L.map((_, i) => (mode === 'arch' ? R0 - i * LH : R0 + i * LH));
  }
  const up = mode !== 'smile';                                  // 위로 볼록 — 중심이 아래
  const pt = (r: number, ph: number): Pt => (up ? [r * Math.sin(ph), -r * Math.cos(ph)] : [r * Math.sin(ph), r * Math.cos(ph)]);

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

  const layout: TextLayout = {
    glyphs: placed.map((q) => ({ c: q.c, x: (q.x - bx0) / optic, y: (q.y - by0) / optic, a: q.a })),
    box: { w: (bx1 - bx0) / optic, h: (by1 - by0) / optic }
  };
  return { tb: { x0: bx0, y0: by0, x1: bx1, y1: by1 }, chars: placed.map((q): Pt => [q.x, q.y]), layout };
}

/**
 * 띠 하나를 두께 배수(k)로 늘인 칸 격자 — 안(1) · 밖, 한 칸 깎은 안의 누적합(밖의 수), 칸마다 두께, 무게중심.
 * 한 칸을 더 깎는 것은 칸이 윤곽을 조금 넘을 수 있어서다 — 그리는 윤곽은 칸 격자보다 곱다
 */
type PhotoGrid = { W: number; H: number; inn: Uint8Array; sat: Int32Array; thick: Float32Array; cx: number; cy: number };
const PHOTO_GRIDS = new Map<string, PhotoGrid>();
const PHOTO_BITS = new Map<string, Uint8Array>();
function photoBits(s: PhotoShape): Uint8Array {
  let got = PHOTO_BITS.get(s.id);
  if (got) return got;
  const raw = atob(s.bits), inn = new Uint8Array(s.w * s.h);
  for (let i = 0; i < inn.length; i++) inn[i] = (raw.charCodeAt(i >> 3) >> (7 - (i & 7))) & 1;
  PHOTO_BITS.set(s.id, (got = inn));
  return got;
}
function photoGrid(s: PhotoShape, k: number): PhotoGrid {
  const key = s.id + '|' + k, had = PHOTO_GRIDS.get(key);
  if (had) return had;
  const src = photoBits(s), W = s.w, H = Math.max(1, Math.round(s.h * k)), inn = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) { const sy = Math.min(s.h - 1, Math.floor(y / k)); for (let x = 0; x < W; x++) inn[y * W + x] = src[sy * W + x]; }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : inn[y * W + x]);
  const sat = new Int32Array((W + 1) * (H + 1)), thick = new Float32Array(W);
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      const v = at(x, y), safe = v && at(x - 1, y) && at(x + 1, y) && at(x, y - 1) && at(x, y + 1);
      row += safe ? 0 : 1;
      sat[(y + 1) * (W + 1) + x + 1] = sat[y * (W + 1) + x + 1] + row;
      if (v) { thick[x]++; sx += x + 0.5; sy += y + 0.5; n++; }
    }
  }
  const g = { W, H, inn, sat, thick, cx: sx / Math.max(1, n), cy: sy / Math.max(1, n) };
  PHOTO_GRIDS.set(key, g);
  return g;
}
/** 칸 네모(x0, y0, w, h)에 밖이 몇 칸인가 */
function outsideIn(g: PhotoGrid, x0: number, y0: number, w: number, h: number): number {
  const W1 = g.W + 1;
  return g.sat[(y0 + h) * W1 + x0 + w] - g.sat[y0 * W1 + x0 + w] - g.sat[(y0 + h) * W1 + x0] + g.sat[y0 * W1 + x0];
}

type PhotoFit = { s: PhotoShape; k: number; upp: number; rx: number; ry: number; bx0: number; bx1: number; by0: number; by1: number; long: number };
/** 띠 s를 두께 k로 늘였을 때 글 + 여백 네모(가로 ÷ 세로 = asp)가 드는 가장 큰 자리 — 없으면 null. shrink = 네모를 그만큼
    칸을 줄여 잡는다(= 띠가 그만큼 커진다) — 실제 윤곽에 걸렸을 때 다시 맞추는 몫 */
function photoFit(s: PhotoShape, k: number, asp: number, RH: number, bodyAt: number, shrink = 0): PhotoFit | null {
  const g = photoGrid(s, k);
  const fits = (h: number) => {
    const w = Math.round(h * asp);
    if (w < 1 || w > g.W || h > g.H) return false;
    for (let y = 0; y + h <= g.H; y++) for (let x = 0; x + w <= g.W; x++) if (!outsideIn(g, x, y, w, h)) return true;
    return false;
  };
  let lo = 0, hi = g.H + 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (fits(m)) lo = m; else hi = m; }
  if (lo < 2) return null;
  // 3% 여유를 두고 자리를 고른다 — 무게중심에 가장 가까운 곳
  const h = Math.max(2, Math.floor(lo * 0.97) - shrink), w = Math.max(1, Math.round(h * asp));
  let rx = -1, ry = -1, best = Infinity;
  for (let y = 0; y + h <= g.H; y++) for (let x = 0; x + w <= g.W; x++) {
    if (outsideIn(g, x, y, w, h)) continue;
    const d = (x + w / 2 - g.cx) ** 2 + (y + h / 2 - g.cy) ** 2;
    if (d < best) { best = d; rx = x; ry = y; }
  }
  if (rx < 0) return null;
  // 몸통 — 글 자리에서 좌우로, 두께가 가장 두꺼운 곳의 bodyAt 아래로 떨어지기 전까지. 그 밖은 꼬리
  let top = 0;
  for (let x = 0; x < g.W; x++) top = Math.max(top, g.thick[x]);
  const thr = bodyAt * top;
  let bx0 = rx, bx1 = rx + w;
  while (bx0 > 0 && g.thick[bx0 - 1] >= thr) bx0--;
  while (bx1 < g.W && g.thick[bx1] >= thr) bx1++;
  let by0 = g.H, by1 = 0;
  for (let y = 0; y < g.H; y++) for (let x = bx0; x < bx1; x++) if (g.inn[y * g.W + x]) { by0 = Math.min(by0, y); by1 = Math.max(by1, y + 1); break; }
  const upp = RH / h;
  return { s, k, upp, rx, ry, bx0, bx1, by0, by1, long: Math.max(bx1 - bx0, by1 - by0) * upp };
}

/**
 * 다정한의 띠 구름 — 12장 모두에 글을 넣어 보고, 몸통의 긴 쪽이 상한(cap) 안에 드는 장이면 모두 후보로 글이 씨앗으로 하나.
 * 그런 장이 pick장보다 적으면 몸통이 가장 짧은 pick장에서. '가장 짧은 넷'만 후보로 두었더니 글 200개가 12장 중 5장만
 * 썼다(2026-09-30, 재서) — 글자가 안 줄어드는 한 넓게 고른다.
 * 띠마다 두께 배수(thick)를 차례로 대 보고 몸통이 상한 안에 드는 첫째(가장 덜 두툼한)를 쓴다 — 모두 넘으면 가장 짧은 것.
 * 꼬리(몸통 밖)는 옆으로 tail배 눌러 짧게 한다(2026-10-01부터 1 — 자료에 미리 넣었다). 꼬리 끝 너머 떨어진 조각(extra)도
 * 같은 자리 옮김으로 따라온다. tb = 글 상자(u) · chars = 그 좌표의 글자 가운데.
 * 칸 격자(폭 256)는 실제 윤곽보다 거칠다 — 지은 뒤 글 + 여백 네모의 둘레를 **실제 윤곽**으로 확인하고, 걸리면 한 칸씩 줄여
 * 다시 맞춘다(칸만 믿었을 때 글 200개 중 5~15개가 칸 사이 홈 · 누른 꼬리에 모서리가 걸렸다).
 * 격자로 고른 과정: 옆으로 퍼진 조각(해안선 같아 구름으로 안 읽혔다) → 세로로 쌓은 탑(한 톤이면 돌처럼 읽혔다) → 가로로
 * 나란히 선 봉우리 → 레퍼런스(보라 띠)의 띠를 위아래 되돌린 것(디자이너). 두 톤은 버리고 원톤
 */
function photoFor(pr: Persona, rule: 'B' | 'C', tb: { x0: number; y0: number; x1: number; y1: number }, chars: Pt[], R: () => number, layout?: TextLayout,
  ink?: { em: number; ink: number }): Cloud {
  const p = pr.photo!, TW = tb.x1 - tb.x0, TH = tb.y1 - tb.y0, RW = TW + 2 * PAD, RH = TH + 2 * PAD;
  const each: PhotoFit[] = [];
  for (const s of CLOUD_PHOTOS) {
    let pick: PhotoFit | null = null, short: PhotoFit | null = null;
    for (const k of p.thick) {
      const f = photoFit(s, k, RW / RH, RH, p.body);
      if (!f) continue;
      if (!short || f.long < short.long) short = f;
      if (f.long <= p.cap) { pick = f; break; }
    }
    const f = pick ?? short;
    if (f) each.push(f);
  }
  const ok = each.filter((f) => f.long <= p.cap);
  const pool = ok.length >= p.pick ? ok : [...each].sort((a, b) => a.long - b.long || a.s.id.localeCompare(b.s.id)).slice(0, p.pick);
  let f = pool[Math.floor(R() * pool.length)];
  // 윤곽 — 칸 좌표를 두께만큼 늘이고, 몸통 밖(꼬리)은 옆으로 눌러, 몸통 상자 왼쪽 위를 원점으로 u에
  const build = (g: PhotoFit) => {
    const at = ([x, y]: readonly [number, number]): Pt => {
      const xx = x < g.bx0 ? g.bx0 + (x - g.bx0) * p.tail : x > g.bx1 ? g.bx1 + (x - g.bx1) * p.tail : x;
      return [(xx - g.bx0) * g.upp, (y * g.k - g.by0) * g.upp];
    };
    const pts = g.s.pts.map(at), extra = (g.s.extra ?? []).map((r) => r.map(at));
    const tx = (g.rx - g.bx0) * g.upp + PAD, ty = (g.ry - g.by0) * g.upp + PAD;
    const x0 = tx - PAD, y0 = ty - PAD, x1 = tx + TW + PAD, y1 = ty + TH + PAD;
    // 둘레를 변마다 60점으로 — 20점은 점 사이 밑선의 잔 홈을 놓쳤다(2026-10-01, 꼬리를 다시 지은 판이 칸 격자에서 촘촘해져
    // 글 상자가 밑선에 더 붙어 앉자 글 200개 중 4~10개가 걸렸다)
    let fits = true;
    for (let i = 0; i < 60 && fits; i++) {
      const t = i / 60;
      for (const [x, y] of [[x0 + (x1 - x0) * t, y0], [x1, y0 + (y1 - y0) * t], [x1 - (x1 - x0) * t, y1], [x0, y1 - (y1 - y0) * t]])
        if (!inPolygon(x, y, pts)) { fits = false; break; }
    }
    return { pts, extra, tx, ty, fits };
  };
  let got = build(f);
  for (let shrink = 1; !got.fits && shrink <= 8; shrink++) {
    const g = photoFit(f.s, f.k, RW / RH, RH, p.body, shrink);
    if (!g) break;
    const b2 = build(g);
    f = g; got = b2;
  }
  const { pts, extra, tx, ty } = got, xs = [...pts, ...extra.flat()].map((q) => q[0]);
  // 조각이 끝 너머로 떠가는 데까지 가로 범위에 넣는다(photoWave — 가장 먼 조각이 가는 거리 + 부풀어 커지는 만큼). 벽이 읽힘을
  // 따질 때 그 자리도 몸으로 친다
  const bw = (f.bx1 - f.bx0) * f.upp, half = (r: Pt[]) => { const cx = r.reduce((a, q) => a + q[0], 0) / r.length; return Math.max(...r.map((q) => Math.abs(q[0] - cx))); };
  const reach = (side: number) => {
    const rs = extra.filter((r) => pieceSide(r, bw) === side);
    return rs.length ? driftReach(p.motion, rs.length - 1) + p.motion.swell * Math.max(...rs.map(half)) : 0;
  };
  return {
    persona: pr, rule, circles: [], spikes: [],
    photo: { id: f.s.id, pts, ...(extra.length ? { extra } : {}), chars: chars.map(([x, y]): Pt => [x - tb.x0 + tx, y - tb.y0 + ty]), x0: Math.min(...xs) - reach(-1), x1: Math.max(...xs) + reach(1),
      ...(ink ? { ink } : {}) },
    w: (f.bx1 - f.bx0) * f.upp, h: (f.by1 - f.by0) * f.upp,
    text: { x: tx, y: ty, w: TW, h: TH },
    ...(layout ? { layout } : {})
  };
}

type PhotoMotion = NonNullable<Persona['photo']>['motion'];
/** 0 → 1 → 0, 한 바퀴 = 1 */
const bump = (c: number) => (1 - Math.cos(2 * Math.PI * c)) / 2;
const ease = (u: number) => u * u * (3 - 2 * u);
/** 꼬리 움직임의 꼴 — 얼마나 · 몇 박자는 PERSONAS.doran.photo.motion, 여기는 모양(견본 landscape-cloud-photo-tail-motion.html과 같다).
    SWELL_LAG = 부풂이 꼬리 하나를 지나는 동안 도는 바퀴(1.2 — 한 번에 혹 한두 개가 부푼다) · SWELL_ROOT = 부풂이 뿌리에서 자라나는
    구간(꼬리 길이의 몫 — 몸통과 이어지는 자리가 꺾이지 않게) · DRIFT_FAR = 조각이 하나 멀수록 더 가는 몫 · DRIFT_LAG = 하나 멀수록
    늦는 박자(바퀴) · DRIFT_RISE = 떠가며 오르는 높이(간 거리의 몫) */
const SWELL_LAG = 1.2, SWELL_ROOT = 0.15, DRIFT_FAR = 0.4, DRIFT_LAG = 0.08, DRIFT_RISE = 0.2;
/** 떨어진 조각이 몸통의 어느 쪽인가(-1 왼쪽 · 1 오른쪽) — 조각의 가운데를 몸통 상자(폭 w)의 가운데로 가른다 */
function pieceSide(r: readonly Pt[], w: number): number {
  return r.reduce((a, q) => a + q[0], 0) / r.length < w / 2 ? -1 : 1;
}
/** 몸통에서 i째(0 = 가장 가까운) 조각이 끝 너머로 떠가는 가장 먼 거리(u) */
function driftReach(m: PhotoMotion, i: number): number {
  return m.drift * (1 + DRIFT_FAR * i);
}

/**
 * 띠 구름의 움직임 — 실제 구름처럼 봉우리가 부풀었다 가라앉는다(2026-09-30, 디자이너).
 * 봉우리: 둘레를 따라 흐르는 두 물결의 합을 0~1로 — 윤곽의 점을 **바깥 법선으로만** 민다. 안으로는 한 번도 안 들어가서
 * 글 + 여백이 어느 순간에도 깨지지 않는다(구슬 구름의 '커지기만 한다'와 같은 뜻). 위를 향한 점일수록 크게, 평평한 밑은 거의
 * 안 움직인다.
 * 꼬리(몸통 상자 밖, 2026-10-01): 혹의 사슬은 부풂이 뿌리에서 끝으로 한 혹씩 지나간다 — 그 자리 꼬리 두께의 몫만큼(봉우리의
 * 폭까지), 역시 바깥으로만. 떨어진 조각(extra)은 그 부풂을 이어받아 커졌다 작아지고, 끝 너머로 떠났다 돌아온다. 꼬리를 늘였다 줄이고 끝을
 * 위아래로 나부끼던 움직임(stretch · tip)은 꺼 두었다(뱀의 몸짓). 모두 몸통 밖이라 글에 닿지 않는다.
 * 돌려주는 함수는 (초, --t-hold 초) → 그 순간의 윤곽들(u) — 첫째가 띠, 나머지가 조각(photo.extra 차례). phase = 구름마다 다른
 * 시작(벽의 구름이 한 박자로 움직이지 않게)
 */
export function photoWave(photo: Photo, w: number, m: PhotoMotion, phase: number): (t: number, hold: number) => Pt[][] {
  const P = photo.pts, n = P.length, E = photo.extra ?? [];
  let area = 0;
  for (let i = 0; i < n; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % n]; area += x1 * y2 - x2 * y1; }
  const sg = area > 0 ? 1 : -1;
  const len = [0];
  for (let i = 1; i <= n; i++) { const [a, b] = P[i - 1], [c, d] = P[i % n]; len.push(len[i - 1] + Math.hypot(c - a, d - b)); }
  // 꼬리 끝은 띠 · 조각의 실제 끝으로 잰다 — photo.x0 · x1은 조각이 떠갈 자리까지 넣어 더 넓다
  const xs = [...P, ...E.flat()].map((q) => q[0]);
  const per = len[n] || 1, lo = Math.min(0, ...xs), hi = Math.max(w, ...xs);
  const tailOf = (x: number) => (x < 0 ? -x / Math.max(1e-6, -lo) : x > w ? (x - w) / Math.max(1e-6, hi - w) : 0);
  // 그 자리 꼬리의 두께(u) — 세로줄이 윤곽을 자르는 맨 위와 맨 아래. 혹이 제 크기만큼 부푼다. 변을 가로 칸(0.25u)에 미리
  // 나눠 두고 그 칸의 변만 본다 — 모든 변을 보면 느린 기계(CPU 4배)에서 구름 하나 짓는 데 18ms까지 걸렸다
  const CELL = 0.25, cells = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const a = P[i][0], b = P[(i + 1) % n][0];
    for (let c = Math.floor(Math.min(a, b) / CELL); c <= Math.floor(Math.max(a, b) / CELL); c++) {
      const l = cells.get(c);
      if (l) l.push(i); else cells.set(c, [i]);
    }
  }
  const thick = (x: number) => {
    let top = Infinity, bot = -Infinity;
    for (const i of cells.get(Math.floor(x / CELL)) ?? []) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % n];
      if (x1 === x2 || (x1 - x) * (x2 - x) > 0) continue;
      const y = y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
      top = Math.min(top, y); bot = Math.max(bot, y);
    }
    return bot > top ? bot - top : 0;
  };
  const at = P.map(([x, y], i) => {
    const [px, py] = P[(i - 1 + n) % n], [nx, ny] = P[(i + 1) % n];
    const tl = Math.hypot(nx - px, ny - py) || 1, tx = (nx - px) / tl, ty = (ny - py) / tl;
    const ox = sg * ty, oy = -sg * tx;                                 // 바깥 법선
    const tail = tailOf(x);
    return { x, y, s: len[i] / per, ox, oy, up: Math.min(1, Math.max(0.12, -oy)), tail, side: x < 0 ? -1 : x > w ? 1 : 0, th: tail > 0 && m.swell ? thick(x) : 0 };
  });
  // 떨어진 조각 — 가운데 · 어느 쪽 · 같은 쪽에서 몸통에 몇째로 가까운가(0부터)
  const bits = E.map((r) => {
    const cx = r.reduce((a, q) => a + q[0], 0) / r.length, cy = r.reduce((a, q) => a + q[1], 0) / r.length;
    return { r, cx, cy, side: pieceSide(r, w), tail: tailOf(cx) };
  });
  const nth = bits.map((b) => bits.filter((c) => c.side === b.side && c.side * c.cx < b.side * b.cx).length);
  return (t, hold) => {
    const wb = (2 * Math.PI) / (m.billowTurn * hold), wt = (2 * Math.PI) / (m.tailTurn * hold), cyc = phase / (2 * Math.PI);
    const swell = (q: number) => bump(t / (m.swellTurn * hold) - SWELL_LAG * q + cyc);
    const ring = at.map((f): Pt => {
      const k = 0.5 + 0.5 * (0.6 * Math.sin(2 * Math.PI * 4 * f.s - wb * t + phase) + 0.4 * Math.sin(2 * Math.PI * 7 * f.s + 0.7 * wb * t + 1.3 + phase));
      let x = f.x + f.ox * m.billow * k * f.up, y = f.y + f.oy * m.billow * k * f.up;
      if (f.side) {
        if (f.th) {                                                    // 혹이 차례로 — 밑을 향한 쪽은 덜 부푼다(밑이 평평히 남게)
          // 봉우리(billow)보다 크게는 안 부푼다 — 키 큰 띠(b04 · b10 · b11)는 몸통 밖도 7~8u로 두꺼워 두께의 몫이 1u(벽 21px)를 넘었다
          const push = Math.min(m.billow, m.swell * f.th) * ease(Math.min(1, f.tail / SWELL_ROOT)) * swell(f.tail) * (0.35 + 0.65 * Math.max(0, -f.oy));
          x += f.ox * push; y += f.oy * push;
        }
        const edge = f.side < 0 ? 0 : w;
        x = edge + (x - edge) * (1 + m.stretch * Math.sin(wt * t - 1.2 * f.tail + phase));
        y += m.tip * f.tail * f.tail * Math.sin(0.8 * wt * t - 2.2 * f.tail + phase + 0.5);
      }
      return [x, y];
    });
    // 조각 — 사슬의 부풂을 이어받아 커졌다 작아지고, 끝 너머로 떠났다 돌아온다(먼 조각일수록 멀리 · 늦게)
    return [ring, ...bits.map((b, j) => {
      const sc = 1 + m.swell * swell(b.tail), d = bump(t / (m.driftTurn * hold) - DRIFT_LAG * nth[j] + cyc) * driftReach(m, nth[j]);
      const dx = b.side * d, dy = -DRIFT_RISE * d;
      return b.r.map(([x, y]): Pt => [b.cx + (x - b.cx) * sc + dx, b.cy + (y - b.cy) * sc + dy]);
    })];
  };
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
    tail: () => 0,
    // 나무 — 글자는 크기 막대의 text배(1.4)로 앉고, 벽 한 칸에 맞춰 줄이지 않는다(나무가 바닥에 서서 제 키로 선다). 키 상한에
    // 걸린 나무만 글과 함께 shrink배로 줄인다
    ...(cloud.tree ? { scale: (cloud.persona.tree?.text ?? 1) * cloud.tree.shrink, free: true } : {})
  };
}
