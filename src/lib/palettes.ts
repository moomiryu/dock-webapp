export interface Palette {
  bg: string;
  text: string;
  graphic: string;
}

export const palettes: Palette[] = [
  { bg: '#FCE7F3', text: '#FF1493', graphic: '#8B9A1B' },
  { bg: '#1A1A2E', text: '#F39C12', graphic: '#E74C3C' },
  { bg: '#F5F5DC', text: '#0B3D3B', graphic: '#FF6347' },
  { bg: '#0A0A0A', text: '#FFD93D', graphic: '#00CED1' },
  { bg: '#FFF0F5', text: '#8B008B', graphic: '#FF6B9D' },
  { bg: '#E8F8F5', text: '#0E6251', graphic: '#7D6608' },
  { bg: '#2C3E50', text: '#ECF0F1', graphic: '#E67E22' },
  { bg: '#F8F4E3', text: '#264653', graphic: '#E76F51' },
  { bg: '#1F1F1F', text: '#FF6EC7', graphic: '#7FDBDA' },
  { bg: '#FFFAE3', text: '#D9381E', graphic: '#1B4965' }
];

// 자형 4종 → 실제 서체. 키는 Firestore 호환을 위해 옛 이름 그대로 둔다.
//   doran    다정한  손글씨   → jjgulwol       (임시 — 서예 쪽으로 기운다)
//   deulseok 발랄한  → OG 르네상스 비밀
//   ttoryeot 당당한  고딕     → seoul-namsan
//   chabun   차분한  명조     → kim-jung-chul-myungjo
//
// 2026-09-15: 이 칸이 Sunflower에서 'OG 르네상스 비밀'로 바뀌었다.
//   Sunflower는 네모틀 안에 든 둥근 산세리프라 당당한(서울남산)과 골격을
//   공유했고, 두 칸의 차이가 사실상 굵기로만 읽혔다 — 굵기는 이미 별도
//   축이 하는 일이라 그 겹침은 자형 축을 무너뜨렸다.
//   (2026-09-06 실제 렌더를 캡처해 확인 — design/screens/faces/)
//   새 글꼴은 정적이라 이 칸에서만 무게가 합성으로 답한다. global.css 참조.
//
// 안상수체2012는 당당·정갈과 인상이 겹쳐 선택지에서 내렸다. 폴백으로만 남는다.
// (botong/orbit은 UI 라벨 전용으로 빠졌다)
export const fontMap: Record<string, string> = {
  doran: '"jjgulwol", "Noto Serif KR Variable", serif',
  chabun: '"kim-jung-chul-myungjo", "Noto Serif KR Variable", serif',
  botong: '"orbit", "Pretendard Variable", sans-serif',
  ttoryeot: '"seoul-namsan", "Pretendard Variable", sans-serif',
  deulseok: '"OG Renaissance Secret", "agahnsangsoo2012", "Pretendard Variable", sans-serif',
  // legacy keys — keep so older Firestore docs still render
  gothic: '"seoul-namsan", "Pretendard Variable", sans-serif',
  mono: '"orbit", "Pretendard Variable", sans-serif',
  myeongjo: '"kim-jung-chul-myungjo", "Noto Serif KR Variable", serif',
  song: '"agahnsangsoo2012", "Pretendard Variable", sans-serif'
};

/**
 * 광학 보정 — 같은 font-size, 같은 font-weight에서도 서체마다 크기와
 * 굵기가 다르게 보인다. 견본 넷을 나란히 놓는 자리에서는 그 차이가
 * 서체의 성격이 아니라 **잘못 조판한 것**으로 읽힌다.
 *
 * 두 값 다 눈이 아니라 화소를 세서 잡았다 (canvas, 2026-09-15).
 *
 * scale — 잉크 높이. 네 이름을 100px로 찍어 actualBoundingBox로 쟀다:
 *   당당한 96 · 차분한 92 · 다정한 98 · 발랄한 85
 *   앞 셋 평균 95.33 / 85 = 1.122.
 *   em 박스가 아니라 잉크로 재는 이유: 눈이 읽는 것은 글자가 실제로
 *   차지한 높이지 글꼴이 선언한 em이 아니다.
 *
 * shift — 베이스라인. 네 이름은 각자 제 칸 한가운데에 놓이는데, 글꼴마다
 *   선언한 어센더·디센더가 달라 '가운데'가 곧 같은 베이스라인이 아니다.
 *   칸 한가운데에서 베이스라인까지를 재니 (390 화면, 36px):
 *     당당한 10.49 · 차분한 13.49 · 다정한 10.99 · 발랄한 12.00
 *   당당한과 차분한이 3.00px 어긋나 있었다 — 나란히 놓인 두 칸이라
 *   그 3px이 '줄이 안 맞는다'로 읽힌다. 네 값의 평균(11.744)에 맞춘다.
 *   글자 크기를 따라가야 하므로 em으로 적는다.
 *
 * 여기 없는 키는 보정하지 않는다.
 */
export const opticalFix: Record<string, { scale?: number; shift?: number }> = {
  ttoryeot: { shift: 0.0348 },
  chabun: { shift: -0.0486 },
  doran: { shift: 0.0209 },
  deulseok: { scale: 1.122, shift: -0.0063 }
};

/**
 * 획 보정 — 무게 축이 이 글꼴만 못 움직여서, 획을 덧대 대신 답하게 한다.
 *
 * '발랄한'(OG 르네상스 비밀)은 굵기 축이 없는 정적 글꼴인데 @font-face가
 * 100~900을 통째로 걸고 있다(global.css). 그래서 무게를 아무리 올려도
 * 획이 굵어지지 않는다 — 합성 굵기조차 안 걸린다. 무게 다섯 칸을 재 보면:
 *
 *   당당한 0.216 0.287 0.287 0.339 0.400   ← 잉크 비율(칠해진 화소 / 잉크 상자)
 *   차분한 0.236 0.301 0.301 0.424 0.424
 *   다정한 0.195 0.263 0.263 0.398 0.398
 *   발랄한 0.192 0.192 0.192 0.192 0.192   ← 다섯 칸이 한 값이다
 *
 * (canvas, '발화'를 200px로, 2026-09-15. 네 서체에 **같은 글자**를 준다 —
 *  서체마다 제 이름을 쓰면 글자가 달라 잉크도 달라지고, 그건 서체의 굵기가
 *  아니라 글자의 굵기를 잰 것이 된다.)
 *
 * 앞 셋의 평균을 목표로 두고 발랄한에 획을 0.1px씩 더해 가며 맞췄다:
 *   300 → 0.006em · 400·500 → 0.023em · 600 → 0.0545em · 700 → 0.063em
 *
 * 그런데 위 두 칸은 그대로 쓸 수 없다. 획은 글자 바깥으로도 자라서
 * 속공간을 메운다 — 0.010em부터 0.070em까지 한 장에 놓고 보니
 * **0.050em에서 '발'의 ㅂ이 닫히고** 그 위로는 글자가 덩어리가 된다.
 * 32도가 기울기의 마지막 자리였던 것과 같은 종류의 한계다.
 * 그래서 꼭대기를 0.045em으로 자르고, 0.023em 위쪽을 그 비율(0.55)로 눌렀다.
 *
 * 400과 500이 같은 값인 것은 발랄한의 사정이 아니다 — 서울남산도 김정철도
 * 그 두 칸이 같은 파일로 떨어진다(가진 굵기가 300·500·600·700뿐이다).
 * 진짜 서체가 안 움직이는 자리를 발랄한만 움직이게 하면 그게 더 어긋난다.
 */
const STROKE_LADDER: Record<string, Record<number, number>> = {
  deulseok: { 300: 0.006, 400: 0.023, 500: 0.023, 600: 0.04, 700: 0.045 }
};

/**
 * 그 서체를 그 무게로 찍을 때 덧댈 획. 보정이 없는 서체는 '0'이라
 * -webkit-text-stroke가 아무 일도 하지 않는다.
 *
 * 저장된 무게가 눈금에 정확히 없을 수 있다(옛 메시지) — 제일 가까운 칸으로 읽는다.
 */
export function opticalStroke(font: string, wght: number): string {
  const ladder = STROKE_LADDER[font];
  if (!ladder) return '0';
  const stops = Object.keys(ladder).map(Number);
  const at = stops.reduce((best, s) => (Math.abs(s - wght) < Math.abs(best - wght) ? s : best), stops[0]);
  return ladder[at] + 'em';
}

export const graphics: string[] = [
  // sphere with rotating grid
  '<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice"><g style="animation:mfRot 14s linear infinite;transform-origin:190px 130px"><ellipse cx="190" cy="130" rx="170" ry="115" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="7,5"/><ellipse cx="190" cy="130" rx="130" ry="115" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="7,5"/><ellipse cx="190" cy="130" rx="70" ry="115" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="7,5"/><ellipse cx="190" cy="130" rx="170" ry="75" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="7,5"/><ellipse cx="190" cy="130" rx="170" ry="35" fill="none" stroke="currentColor" stroke-width="2.5" stroke-dasharray="7,5"/></g></svg>',
  // pulsing polka dots
  '<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice"><defs><pattern id="dp" x="0" y="0" width="55" height="55" patternUnits="userSpaceOnUse"><circle cx="27" cy="27" r="17" fill="currentColor" style="animation:mfPulse 3.2s ease-in-out infinite"/></pattern></defs><rect width="380" height="260" fill="url(#dp)"/></svg>',
  // scrolling grid
  '<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice"><g stroke="currentColor" stroke-width="1.8" fill="none" stroke-dasharray="5,5">' +
    Array.from({ length: 11 }, (_, i) => `<line x1="${i * 40}" y1="0" x2="${i * 40}" y2="260" style="animation:mfDash ${(3.5 + i * 0.18).toFixed(2)}s linear infinite"/>`).join('') +
    Array.from({ length: 8 }, (_, i) => `<line x1="0" y1="${i * 40}" x2="380" y2="${i * 40}"/>`).join('') +
    '</g></svg>',
  // concentric expansion
  '<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice">' +
    [25, 55, 85, 115, 145, 175]
      .map((r, i) => `<circle cx="190" cy="130" r="${r}" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:mfExp 4.5s ease-in-out ${(i * 0.45).toFixed(2)}s infinite;transform-origin:190px 130px"/>`)
      .join('') +
    '</svg>',
  // sliding waves
  '<svg viewBox="0 0 380 260" preserveAspectRatio="xMidYMid slice"><g fill="none" stroke="currentColor" stroke-width="2.5">' +
    [40, 80, 120, 160, 200, 240]
      .map((y, i) => `<path d="M -50 ${y} Q 45 ${y - 22},140 ${y} T 330 ${y} T 520 ${y}" style="animation:mfSlide ${(6 + i * 0.4).toFixed(2)}s linear infinite"/>`)
      .join('') +
    '</g></svg>'
];
