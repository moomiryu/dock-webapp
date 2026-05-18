// Font family keys are *internal* identifiers tied to typographic categories.
// Display labels in the UI use voice-mode names (외침/선언/속삭임/노래) — see
// VOICE_LABEL in PhaseZ1Glyph. Keeping these keys stable preserves Firestore
// schema compatibility.
//   mono     → 선언 STATE   (measured, systematic — Orbit)
//   gothic   → 외침 CRY     (loud, direct — Pretendard)
//   myeongjo → 속삭임 HUSH  (intimate, slow — Noto Serif KR)
//   song     → 노래 SONG    (free, kinetic 탈네모틀 — Sunflower)
export type FontFamily = 'mono' | 'gothic' | 'myeongjo' | 'song';

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
