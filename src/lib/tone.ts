import type { ToneState } from '../types';
export type PartialTone = Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;
export const DEFAULT_TONE = { tone: 1, wght: 500, slnt: 0, size: 44 };
// 차례는 스케치가 정한 것이다 — 당당한 · 차분한 · 다정한 · 유머있는.
//
// 2026-09-20: 넷째 칸의 이름이 '발랄한'에서 **'유머있는'**으로 바뀌었다.
// val은 Firestore에 저장되는 키라 건드리지 않는다 — 사흘치 글이 벽에 떠
// 있는 동안 키를 바꾸면 그 글들이 서체를 잃는다. 보이는 이름만 간다.
export const STYLE_OPTIONS: Array<{ val: ToneState['font']; label: string; en: string }> = [
  { val: 'ttoryeot', label: '당당한', en: 'Confident' },
  { val: 'chabun', label: '차분한', en: 'Calm' },
  { val: 'doran', label: '다정한', en: 'Warm' },
  { val: 'deulseok', label: '유머있는', en: 'Humorous' }
];
