// 색 조합 — 배경과 글자 두 색이 전부다.
//
// 규칙 (direction-v0 원칙):
//   · 풀채도. 파스텔·그라데이션·코퍼레이트 톤 금지
//   · 한쪽은 반드시 극단(검정/흰색/형광) — 야간 외벽에서 멀리서 읽혀야 한다
//   · 이름은 UI에 뜨지 않는다. 사용자는 색 자체를 보고 고른다
//
// 순서가 곧 순환 순서다. 색 버튼을 누르면 0 → 1 → … → 9 → 0.
// 앞의 다섯 자리는 기존 paletteIdx(0..4)와 호환된다 — 이미 보낸 메시지가
// 같은 색으로 계속 보이도록. (idx 3만 옛 파스텔에서 흑백으로 교체)
//
// graphic/blend는 효과 기능을 걷어내며 화면에서 쓰지 않게 됐지만,
// Firestore에 남아 있는 옛 메시지를 읽을 때를 위해 타입은 유지한다.

export type MoodId =
  | 'night' | 'print' | 'day' | 'mono' | 'electric'
  | 'paper' | 'neon' | 'flag' | 'ink' | 'lime';

export interface Mood {
  id: MoodId;
  name: string;
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
    name: '밤',
    nameLatin: 'NIGHT',
    bg: '#000000',
    text: '#00FF88',
    graphic: '#FF00AA',
    blend: 'screen',
    intent: '한밤 외벽, 새벽 간판. 네온의 명상.'
  },
  {
    id: 'print',
    name: '인쇄',
    nameLatin: 'RETRO',
    bg: '#FF6B6B',
    text: '#1E2A52',
    graphic: '#FFD93D',
    blend: 'multiply',
    intent: '리소 인쇄소 견본. 듀오톤의 무게.'
  },
  {
    id: 'day',
    name: '낮',
    nameLatin: 'POP',
    bg: '#FFFF00',
    text: '#000000',
    graphic: '#FF0080',
    blend: 'multiply',
    intent: '거리 광고지. 자신감의 형광.'
  },
  {
    id: 'mono',
    name: '흑백',
    nameLatin: 'MONO',
    bg: '#000000',
    text: '#FFFFFF',
    graphic: '#FFFFFF',
    blend: 'screen',
    intent: '대자보의 먹과 종이. 가장 오래된 조합.'
  },
  {
    id: 'electric',
    name: '전기',
    nameLatin: 'VIVID',
    bg: '#0033FF',
    text: '#FFEE00',
    graphic: '#FF00FF',
    blend: 'screen',
    intent: 'Bauhaus + 야간 신호등. 가장 정치적.'
  },
  {
    id: 'paper',
    name: '백지',
    nameLatin: 'PAPER',
    bg: '#FFFFFF',
    text: '#000000',
    graphic: '#000000',
    blend: 'multiply',
    intent: '흰 종이에 검은 글씨. 아무 편도 들지 않는 자리.'
  },
  {
    id: 'neon',
    name: '분홍',
    nameLatin: 'HOTPINK',
    bg: '#000000',
    text: '#FF0080',
    graphic: '#00FF88',
    blend: 'screen',
    intent: '유흥가 간판. 밤에 가장 멀리 간다.'
  },
  {
    id: 'flag',
    name: '적기',
    nameLatin: 'FLAG',
    bg: '#E4002B',
    text: '#FFFFFF',
    graphic: '#FFEE00',
    blend: 'multiply',
    intent: '현수막과 깃발. 물러설 데 없는 색.'
  },
  {
    id: 'ink',
    name: '남색',
    nameLatin: 'INK',
    bg: '#1E2A52',
    text: '#FFD93D',
    graphic: '#FF6B6B',
    blend: 'screen',
    intent: '개교기념 인쇄물. 오래된 학교의 색.'
  },
  {
    id: 'lime',
    name: '형광',
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
