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

// ─── 성격마다 여덟 짝 (2026-09-29, 디자이너 확정 · 2026-10-01 공통 잉크로 다시) ───────────
//
// 위의 열 짝(moods)은 성격이 생기기 전에 외벽의 무드(때와 장소)로 만든 목록이라, 네 성격이 같이 돌았다 —
// 거기서 '당당한 색'을 고르려니 기준이 없었다(디자이너 — "가물가물"). 성격마다 **색의 구조**를 먼저 나누고
// 그 안에서 여덟 짝을 골랐다. 형상에서 사물이 아니라 행동을 가져온 것과 같다(design/landscape.md '색').
//
// 2026-10-01 다시 짰다. 서른두 짝을 한 장('가')에 모아 보니 당당 · 유머가 지나치게 셌고(칠의 진하기, OKLCH C 평균 —
// 유머 0.215 · 당당 0.172 · 다정 0.126 · 차분 0.073), 벽에서 겹쳐 찍어도 조화가 안 났다 — 서른두 칠을 따로 골라
// 겹친 자리의 색도 제각각이었다. 그래서 **모든 칠을 같은 잉크 열 통**에서 만들고(노랑 #FFE600 · 주황 #FF8A3D ·
// 빨강 #F4605F · 분홍 #F2609F · 보라 #9C7BE0 · 파랑 #4F8FE0 · 하늘 #3DBDE8 · 초록 #2FA866 · 먹 · 종이 — 리소의 드럼처럼),
// 성격은 그 잉크를 찍는 방식으로 가른다:
//   당당한 — 잉크 한 통을 '중간' 진하기로(색상 · 밝기는 두고 진하기만 0.7배, 노랑은 0.68배, 흰은 미색) + 검정 글자
//   차분한 — 잉크 위에 먹을 한 번 더 찍은 짙은 칠 + 흰(남색만 노랑) 글자, 밝은 둘은 돌빛 · 연청
//   다정한 — 따뜻한 잉크를 종이에 연하게 + 남색 글자
//   유머있는 — 두 잉크를 겹친 칠이나 연한 칠 + 보색 글자, 당당과 같은 '중간'만큼 눌렀다
// 진하기는 당당 0.098 · 유머 0.092 · 다정 0.113 · 차분 0.061, 칠과 글자의 대비는 서른두 짝 모두 5.3 이상.
// 이름과 색상은 지켰고 유머의 전기 파랑만 '일렉트릭'이 됐다(디자이너). 위 옛 짝의 '풀채도' 원칙은 여기서 푼다
// (디자이너 — 당당 · 유머를 누르기로). 고른 길: 당당은 같은 소나무 여덟 그루에 네 단계(지금 · 조금 · 중간 · 많이)를
// 입혀 '중간', 노랑은 그 위로 다섯 단계에서 '+++'(그보다 노라면 다시 혼자 앞으로 나온다), 흰은 같은 줄의 미색.
// '많이'는 노랑과 미색이 붙어 버렸다. 치른 값: 다른 성격끼리 가장 닮은 칠이 12.9에서 7.4로 가까워졌다(당당 빨강 ·
// 다정 코랄) — 벽에서는 나무와 구름, 검정과 남색 글자가 가른다. 벽의 섞는 법(app.css '벽의 겹침')은 새 색으로
// 다시 견줘 보고 지금 그대로 뒀다(디자이너 — 섞지 않음 · 지금 · 모두 어둡게 · 모두 곱하기 중 "지금이 제일 낫다").
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
    cp('yellow', '노랑', 'Yellow', '#F6E67B', '#000000'), cp('white', '흰', 'White', '#F0E9DB', '#000000'),
    cp('red', '빨강', 'Red', '#DC7671', '#000000'), cp('blue', '파랑', 'Blue', '#6590C8', '#000000'),
    cp('green', '초록', 'Green', '#59A173', '#000000'), cp('orange', '주황', 'Orange', '#E99768', '#000000'),
    cp('violet', '보라', 'Violet', '#9883C9', '#000000'), cp('sky', '하늘', 'Sky', '#6CB9D7', '#000000')
  ],
  chabun: [
    cp('navy', '남색', 'Navy', '#1E3655', '#FFE600'), cp('forest', '짙은 초록', 'Forest', '#134329', '#FFFFFF'),
    cp('crimson', '진홍', 'Crimson', '#801420', '#FFFFFF'), cp('teal', '청록', 'Teal', '#07513C', '#FFFFFF'),
    cp('plum', '보라', 'Plum', '#3E315A', '#FFFFFF'), cp('ink', '먹', 'Ink', '#2B2B2B', '#FFFFFF'),
    cp('stone', '돌빛', 'Stone', '#CCC1BA', '#2B2B2B'), cp('mist', '연청', 'Mist', '#B5D0F2', '#1E3655')
  ],
  doran: [
    cp('coral', '코랄', 'Coral', '#F78D8C', '#1E3655'), cp('bubblegum', '버블검', 'Bubblegum', '#F690BC', '#1E3655'),
    cp('sunflower', '해바라기', 'Sunflower', '#FFA400', '#1E3655'), cp('apricot', '살구', 'Apricot', '#FFCAA8', '#1E3655'),
    cp('orchid', '난초', 'Orchid', '#BE80C7', '#142438'), cp('peach', '복숭아', 'Peach', '#FB9376', '#1E3655'),
    cp('lavender', '라벤더', 'Lavender', '#C9B6EE', '#1E3655'), cp('blush', '연분홍', 'Blush', '#FAC7DD', '#1E3655')
  ],
  deulseok: [
    cp('neon-green', '형광 초록', 'Neon green', '#81BA99', '#000000'), cp('hot-pink', '핫핑크', 'Hot pink', '#DB779E', '#000000'),
    cp('electric', '일렉트릭', 'Electric', '#3A50A5', '#FFE600'), cp('lime', '라임', 'Lime', '#C1CC65', '#1F2D80'),
    cp('aqua', '아쿠아', 'Aqua', '#83BBB6', '#1F2D80'), cp('cyan', '시안', 'Cyan', '#9ED2E5', '#1F2D80'),
    cp('magenta', '마젠타', 'Magenta', '#86437F', '#FFE600'), cp('ice', '얼음', 'Ice', '#CFE0DB', '#1F2D80')
  ]
};
/** 이 성격이 고르는 여덟 짝. 성격을 모르는 글(옛 서체 키)은 당당한의 짝으로 */
export function colorsFor(font: string | undefined): readonly ColorPair[] {
  return ATTITUDE_COLORS[font ?? ''] ?? ATTITUDE_COLORS.ttoryeot;
}
