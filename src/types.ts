// Font family keys = the 5 형태(speech-form) levels, mapped to Adobe Fonts in
// fontMap (palettes.ts). Ordered calm → lively:
//   doran    다정한    (Mapo Dacapo)
//   chabun   차분한    (source-han-serif-kr-variable)
//   botong   보통      (없어진 칸 — 옛 문서용)
//   ttoryeot 당당한    (dunkel-sans-variable)
//   deulseok 유머있는  (Handjet)
// Older Firestore docs may still carry legacy keys (mono/gothic/myeongjo/song);
// fontMap keeps those for back-compat rendering.
export type FontFamily = 'doran' | 'chabun' | 'botong' | 'ttoryeot' | 'deulseok';

export interface ToneState {
  align?: 'left' | 'center' | 'right';
  backgroundColor?: string;
  textColor?: string;
  font: FontFamily;
  tone: number;       // scaleX (0.7 / 1.0 / 1.3)
  wght: number;       // 100..900
  slnt: number;       // 0 or -8
  /**
   * 말투 — 0이 날 선 쪽, 1이 부드러운 쪽.
   *
   * 무게 축이 없는 서체(당당한·유머있는)가 무게 대신 쓰는 축이다. 그 둘은
   * 굵기 대신 **글자 모양 자체를 바꾸는 축**을 갖고 있다(palettes.ts · MANNER).
   * 없어도 되는 값이라 옵션이다 — 벽에 떠 있는 옛 글은 이게 없고, 없으면 0이다.
   */
  manner?: number;
  size: number;       // 28..60 옛 척도. 2026-09-25부터 그 사이 연속값
  /**
   * 속도·무게 막대의 자리(0 왼쪽 · 0.5 가운데 · 1 오른쪽). 2026-09-25 슬라이더.
   *
   * 있으면 모양은 이 자리에서 **서체별 표**(palettes.ts · formFor)로 계산한다 —
   * 3/5 · 4/5 · 벽이 같은 표를 읽는다. 없으면(옛 글) tone·slnt·wght 그대로
   * 그린다. 옛 칸(tone·slnt·wght)도 같이 적어 둔다 — 새 표를 모르는 곳이
   * 대략이라도 같은 모양을 그리게.
   */
  speed?: number;
  weight?: number;
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
