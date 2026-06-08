// Font family keys = the 5 형태(speech-form) levels, mapped to Adobe Fonts in
// fontMap (palettes.ts). Ordered calm → lively:
//   doran    도란도란  (jjgulwol)
//   chabun   차분히    (kim-jung-chul-myungjo)
//   botong   보통      (orbit)
//   ttoryeot 또렷이    (seoul-namsan)
//   deulseok 들썩들썩  (agahnsangsoo2012)
// Older Firestore docs may still carry legacy keys (mono/gothic/myeongjo/song);
// fontMap keeps those for back-compat rendering.
export type FontFamily = 'doran' | 'chabun' | 'botong' | 'ttoryeot' | 'deulseok';

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
