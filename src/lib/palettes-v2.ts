// v1 — bold palette system. Full saturation, no pastels, no safe corporate tones.
// 5 moods, each a tight 3-color triad designed for strong contrast and optical mixing.

export type MoodId = 'night' | 'print' | 'day' | 'classic' | 'electric';

export interface Mood {
  id: MoodId;
  name: string;
  nameLatin: string;
  bg: string;
  text: string;
  graphic: string;
  blend: 'multiply' | 'screen';  // optical mixing mode for graphic layer
  intent: string;
}

export const moods: Mood[] = [
  {
    id: 'night',
    name: '밤',
    nameLatin: 'NIGHT',
    bg: '#000000',
    text: '#00FF88',          // neon green
    graphic: '#FF00AA',       // magenta
    blend: 'screen',          // additive on dark
    intent: '한밤 외벽, 새벽 간판. 네온의 명상.'
  },
  {
    id: 'print',
    name: '인쇄',
    nameLatin: 'PRINT',
    bg: '#FF6B6B',            // Riso coral / fluorescent red
    text: '#1E2A52',          // Riso midnight blue
    graphic: '#FFD93D',       // Riso yellow
    blend: 'multiply',        // subtractive on light
    intent: '리소 인쇄소 견본. 듀오톤의 무게.'
  },
  {
    id: 'day',
    name: '낮',
    nameLatin: 'DAY',
    bg: '#FFFF00',            // fluorescent yellow
    text: '#000000',
    graphic: '#FF0080',       // hot pink
    blend: 'multiply',
    intent: '거리 광고지, 마음스튜디오. 자신감의 형광.'
  },
  {
    id: 'classic',
    name: '기본',
    nameLatin: 'CLASSIC',
    bg: '#FCE7F3',
    text: '#C2185B',
    graphic: '#8B9A1B',
    blend: 'multiply',
    intent: 'GT Mechanik 헌정. 출발점.'
  },
  {
    id: 'electric',
    name: '전기',
    nameLatin: 'ELECTRIC',
    bg: '#0033FF',            // electric ultramarine
    text: '#FFEE00',          // yellow
    graphic: '#FF00FF',       // magenta
    blend: 'screen',
    intent: 'Bauhaus + 야간 신호등. 가장 정치적.'
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
