import type { ToneState } from '../types';
export type PartialTone = Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;
// speed·weight 0.5 = 막대 가운데('보통'). size 44 = 크기 막대 가운데(28~60)
export const DEFAULT_TONE = { tone: 1, wght: 500, slnt: 0, size: 44, manner: 0, speed: 0.5, weight: 0.5 };
// 차례가 2×2 네 칸의 자리를 정한다 — 0·1이 윗줄(왼·오른), 2·3이 아랫줄.
//
// 2026-09-20: 넷째 칸의 이름이 '발랄한'에서 **'유머있는'**으로 바뀌었다.
// val은 Firestore에 저장되는 키라 건드리지 않는다 — 사흘치 글이 벽에 떠
// 있는 동안 키를 바꾸면 그 글들이 서체를 잃는다. 보이는 이름만 간다.
//
// 아랫줄 둘을 맞바꿨다(2026-09-20). 스케치의 차례는 다정한·유머있는이었다.
//
// en은 영문판 화면의 이름이다(2026-09-26, 사용자가 정한 넷).
export const STYLE_OPTIONS: Array<{ val: ToneState['font']; label: string; en: string }> = [
  { val: 'ttoryeot', label: '당당한', en: 'Bold' },
  { val: 'chabun', label: '차분한', en: 'Calm' },
  { val: 'deulseok', label: '유머있는', en: 'Witty' },
  { val: 'doran', label: '다정한', en: 'Warm' }
];
