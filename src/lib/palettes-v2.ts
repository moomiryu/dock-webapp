// Curated palette system for Option Z (and future main flow).
// 4 moods, each with intent. Replaces the 10-random-palette system from palettes.ts
// when ?mode=z is active.

export type MoodId = 'night' | 'print' | 'day' | 'classic';

export interface Mood {
  id: MoodId;
  name: string;        // Korean label
  nameLatin: string;   // shown in header (UPPERCASE small)
  bg: string;
  text: string;
  graphic: string;
  intent: string;      // designer-facing description
}

export const moods: Mood[] = [
  {
    id: 'night',
    name: '밤',
    nameLatin: 'NIGHT',
    bg: '#0A0A0A',
    text: '#F2F2F2',
    graphic: '#FFB800',
    intent: '집중과 의례. 톤을 발견하는 순간. 외벽이 밤에 켜진 모습.'
  },
  {
    id: 'print',
    name: '인쇄',
    nameLatin: 'PRINT',
    bg: '#F5F4ED',
    text: '#1A3A8C',
    graphic: '#E84545',
    intent: '리소 듀오톤의 무게. 선언적, 진지함, "찍힘"의 흔적.'
  },
  {
    id: 'day',
    name: '낮',
    nameLatin: 'DAY',
    bg: '#FFFAE3',
    text: '#0A0A0A',
    graphic: '#FF1493',
    intent: '활기와 합창. 풍경에 합류하는 메시지. 카렐 마르턴스의 자신감.'
  },
  {
    id: 'classic',
    name: '기본',
    nameLatin: 'CLASSIC',
    bg: '#FCE7F3',
    text: '#C2185B',
    graphic: '#8B9A1B',
    intent: 'GT Mechanik 헌정. 익숙한 출발점. 기본값.'
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
