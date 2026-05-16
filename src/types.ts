export type FontFamily = 'mono' | 'gothic' | 'myeongjo';

export interface ToneState {
  font: FontFamily;
  tone: number;       // scaleX (0.7 / 1.0 / 1.3)
  wght: number;       // 100..900
  slnt: number;       // 0 or -8
  size: number;       // px
  paletteIdx: number; // index into palettes
  graphicIdx: number; // -1 means off
}

export interface Draft {
  text: string;
  tone: ToneState | null;
  startedAt: number;
}

export type Stage = 'enter' | 'submit' | null;
