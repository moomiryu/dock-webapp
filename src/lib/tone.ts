import type { ToneState } from '../types';
export type PartialTone = Omit<ToneState, 'paletteIdx' | 'graphicIdx'>;
export const DEFAULT_TONE = { tone: 1, wght: 500, slnt: 0, size: 44 };
export const STYLE_OPTIONS: Array<{ val: ToneState['font']; label: string }> = [
  { val: 'doran', label: '다정한' },
  { val: 'deulseok', label: '발랄한' },
  { val: 'ttoryeot', label: '당당한' },
  { val: 'chabun', label: '차분한' }
];
