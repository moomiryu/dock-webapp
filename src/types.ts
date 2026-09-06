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
  /** 마지막으로 손댄 시각. 오래된 초안은 다음 사람에게 넘어가지 않는다 */
  touchedAt?: number;
}

/**
 * NFC 진입만 남긴다. 'submit'은 물리 도킹이 없던 시절의 우회로였는데,
 * 이제 06→07→08이 실제 결과를 다루므로 그걸 통째로 건너뛰는 입구는
 * 플로우에 구멍만 낸다.
 */
export type Stage = 'enter' | null;
