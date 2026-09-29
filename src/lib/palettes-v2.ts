// 색 조합 — 배경과 글자 두 색이 전부다.
//
// 규칙 (direction-v0 원칙):
//   · 풀채도. 파스텔·그라데이션·코퍼레이트 톤 금지
//   · 한쪽은 반드시 극단(검정/흰색/형광) — 야간 벽에서 멀리서 읽혀야 한다
//   · 이름은 UI에 뜨지 않는다. 사용자는 색 자체를 보고 고른다
//
// 순서가 곧 순환 순서다. 색 버튼을 누르면 0 → 1 → … → 9 → 0.
// 앞의 다섯 자리는 기존 paletteIdx(0..4)와 호환된다 — 이미 보낸 메시지가
// 같은 색으로 계속 보이도록. (idx 3만 옛 파스텔에서 흑백으로 교체)
//
// graphic/blend는 효과 기능을 걷어내며 화면에서 쓰지 않게 됐지만,
// Firestore에 남아 있는 옛 메시지를 읽을 때를 위해 타입은 유지한다.

import type { Pair } from './lang';

export type MoodId =
  | 'night' | 'print' | 'day' | 'mono' | 'electric'
  | 'paper' | 'neon' | 'flag' | 'ink' | 'lime';

export interface Mood {
  id: MoodId;
  /** 색 칩의 낭독 이름. 영문판(2026-09-26)을 위해 두 언어로 든다 */
  name: Pair;
  nameLatin: string;
  bg: string;
  text: string;
  graphic: string;   // 미사용 — 옛 데이터 호환용
  blend: 'multiply' | 'screen';
  intent: string;
}

export const moods: Mood[] = [
  {
    id: 'night',
    name: { ko: '밤', en: 'Night' },
    nameLatin: 'NIGHT',
    bg: '#00FF88',
    text: '#000000',
    graphic: '#FF00AA',
    blend: 'screen',
    intent: '한밤 벽, 새벽 간판. 네온의 명상.'
  },
  {
    id: 'print',
    name: { ko: '인쇄', en: 'Print' },
    nameLatin: 'RETRO',
    bg: '#FF6B6B',
    text: '#1E2A52',
    graphic: '#FFD93D',
    blend: 'multiply',
    intent: '리소 인쇄소 견본. 듀오톤의 무게.'
  },
  {
    id: 'day',
    name: { ko: '낮', en: 'Day' },
    nameLatin: 'POP',
    bg: '#FFFF00',
    text: '#000000',
    graphic: '#FF0080',
    blend: 'multiply',
    intent: '거리 광고지. 자신감의 형광.'
  },
  {
    id: 'mono',
    name: { ko: '흑백', en: 'Black and white' },
    nameLatin: 'MONO',
    bg: '#FFFFFF',
    text: '#000000',
    graphic: '#FFFFFF',
    blend: 'screen',
    intent: '대자보의 먹과 종이. 가장 오래된 조합.'
  },
  {
    id: 'electric',
    name: { ko: '전기', en: 'Electric' },
    nameLatin: 'VIVID',
    bg: '#0033FF',
    text: '#FFEE00',
    graphic: '#FF00FF',
    blend: 'screen',
    intent: 'Bauhaus + 야간 신호등. 가장 정치적.'
  },
  {
    id: 'paper',
    name: { ko: '백지', en: 'Blank paper' },
    nameLatin: 'PAPER',
    bg: '#FFFFFF',
    text: '#000000',
    graphic: '#000000',
    blend: 'multiply',
    intent: '흰 종이에 검은 글씨. 아무 편도 들지 않는 자리.'
  },
  {
    id: 'neon',
    name: { ko: '분홍', en: 'Pink' },
    nameLatin: 'HOTPINK',
    bg: '#FF0080',
    text: '#000000',
    graphic: '#00FF88',
    blend: 'screen',
    intent: '유흥가 간판. 밤에 가장 멀리 간다.'
  },
  {
    id: 'flag',
    name: { ko: '적기', en: 'Red flag' },
    nameLatin: 'FLAG',
    bg: '#E4002B',
    text: '#FFFFFF',
    graphic: '#FFEE00',
    blend: 'multiply',
    intent: '현수막과 깃발. 물러설 데 없는 색.'
  },
  {
    id: 'ink',
    name: { ko: '남색', en: 'Navy' },
    nameLatin: 'INK',
    bg: '#1E2A52',
    text: '#FFD93D',
    graphic: '#FF6B6B',
    blend: 'screen',
    intent: '개교기념 인쇄물. 오래된 학교의 색.'
  },
  {
    id: 'lime',
    name: { ko: '형광', en: 'Fluorescent' },
    nameLatin: 'LIME',
    bg: '#00FF88',
    text: '#000000',
    graphic: '#0033FF',
    blend: 'multiply',
    intent: '안전조끼와 공사 표지. 보라고 만든 색.'
  }
];

export const moodById: Record<MoodId, Mood> = moods.reduce(
  (acc, m) => ({ ...acc, [m.id]: m }),
  {} as Record<MoodId, Mood>
);

export function moodAt(index: number): Mood {
  return moods[((index % moods.length) + moods.length) % moods.length];
}

export function nextMoodIndex(current: number): number {
  return (current + 1) % moods.length;
}

// ─── 성격마다 여덟 짝 (2026-09-29, 디자이너 확정) ─────────────────────────
//
// 위의 열 짝(moods)은 성격이 생기기 전에 외벽의 무드(때와 장소)로 만든 목록이라, 네 성격이 같이 돌았다 —
// 거기서 '당당한 색'을 고르려니 기준이 없었다(디자이너 — "가물가물"). 성격마다 **색의 구조**를 먼저 나누고
// 그 안에서 여덟 짝을 골랐다. 형상에서 사물이 아니라 행동을 가져온 것과 같다(design/landscape.md '색').
//   당당한 — 표지의 원색 + 검정 글자(모두 밝은 칠. 벽의 맨 뒤 가장 넓은 칠이라 무엇이 뚫고 지나가도 글이 산다)
//   차분한 — 짙은 칠 + 흰(노랑) 글자, 밝은 둘은 돌빛 · 연청
//   다정한 — 리소 잉크의 따뜻한 칠 + 남색 글자
//   유머있는 — 형광 + 보색 충돌
// 계열 사이에 너무 닮은 칠이 없게 모든 칠 사이의 색 거리(ΔE2000)를 재서 골랐다 — 서로 다른 성격끼리 가장 가까운
// 둘이 12.9(차분 연청 · 다정 라벤더), 칠과 글자의 대비는 서른두 짝 모두 5.0 이상. 원칙은 위와 같다(풀채도, 한쪽은 극단).
// 이름은 4/5 룰렛 창에 뜬다(2026-09-29, 디자이너 — '가' 한 자 대신 "실제 색 이름을") — 위 옛 짝의 '이름은 UI에 뜨지 않는다'는
// 여기엔 해당하지 않는다. 낭독 이름도 같다. 옛 글은 제가 고른 칠 · 글자색(hex)을 그대로 들고 있다.
export interface ColorPair {
  id: string;
  name: Pair;
  bg: string;
  text: string;
}
const cp = (id: string, ko: string, en: string, bg: string, text: string): ColorPair => ({ id, name: { ko, en }, bg, text });
export const ATTITUDE_COLORS: Record<string, readonly ColorPair[]> = {
  ttoryeot: [
    cp('yellow', '노랑', 'Yellow', '#FFFF00', '#000000'), cp('white', '흰', 'White', '#FFFFFF', '#000000'),
    cp('red', '빨강', 'Red', '#FF2D2D', '#000000'), cp('blue', '파랑', 'Blue', '#2F8CFF', '#000000'),
    cp('green', '초록', 'Green', '#00A651', '#000000'), cp('orange', '주황', 'Orange', '#FF7A00', '#000000'),
    cp('violet', '보라', 'Violet', '#8A5CFF', '#000000'), cp('sky', '하늘', 'Sky', '#33C9FF', '#000000')
  ],
  chabun: [
    cp('navy', '남색', 'Navy', '#1E2A52', '#FFD93D'), cp('forest', '짙은 초록', 'Forest', '#0E4D2E', '#FFFFFF'),
    cp('crimson', '진홍', 'Crimson', '#7A0A2A', '#FFFFFF'), cp('teal', '청록', 'Teal', '#004E5A', '#FFFFFF'),
    cp('plum', '보라', 'Plum', '#3B1470', '#FFFFFF'), cp('ink', '먹', 'Ink', '#2B2B2B', '#FFFFFF'),
    cp('stone', '돌빛', 'Stone', '#CFC8BA', '#2B2B2B'), cp('mist', '연청', 'Mist', '#A9C8E8', '#1E2A52')
  ],
  doran: [
    cp('coral', '코랄', 'Coral', '#FF8E91', '#1E2A52'), cp('bubblegum', '버블검', 'Bubblegum', '#F984CA', '#1E2A52'),
    cp('sunflower', '해바라기', 'Sunflower', '#FFB511', '#1E2A52'), cp('apricot', '살구', 'Apricot', '#FFCB8E', '#1E2A52'),
    cp('orchid', '난초', 'Orchid', '#C77DDB', '#14183A'), cp('peach', '복숭아', 'Peach', '#FFA38A', '#1E2A52'),
    cp('lavender', '라벤더', 'Lavender', '#C8B3FF', '#1E2A52'), cp('blush', '연분홍', 'Blush', '#FFC7D6', '#1E2A52')
  ],
  deulseok: [
    cp('neon-green', '형광 초록', 'Neon green', '#00FF88', '#000000'), cp('hot-pink', '핫핑크', 'Hot pink', '#FF0080', '#000000'),
    cp('electric', '전기 파랑', 'Electric blue', '#0033FF', '#FFEE00'), cp('lime', '라임', 'Lime', '#A6FF00', '#6600FF'),
    cp('aqua', '아쿠아', 'Aqua', '#00FFD5', '#6600FF'), cp('cyan', '시안', 'Cyan', '#00F0FF', '#6600FF'),
    cp('magenta', '마젠타', 'Magenta', '#F000FF', '#000000'), cp('ice', '얼음', 'Ice', '#C4FFF9', '#6600FF')
  ]
};
/** 이 성격이 고르는 여덟 짝. 성격을 모르는 글(옛 서체 키)은 당당한의 짝으로 */
export function colorsFor(font: string | undefined): readonly ColorPair[] {
  return ATTITUDE_COLORS[font ?? ''] ?? ATTITUDE_COLORS.ttoryeot;
}
