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
 * stroke — 잉크 비율(칠해진 화소 / 잉크 상자 넓이). 같은 조건에서:
 *   당당한 0.2605 · 차분한 0.2642 · 다정한 0.2248 · 발랄한 0.1918
 *   앞 셋 평균 0.2498. 200px 견본에 획을 0.5px씩 더해 가며 재니
 *   2px에서 0.2442, 2.5px에서 0.2577 — 목표는 그 사이 2.21px이다.
 *   크기를 따라가야 하므로 em으로 적는다: 2.21 / 200 = 0.011em.
 *
 *   이 획이 필요한 까닭: 'OG 르네상스 비밀'은 굵기 축이 없는 정적 글꼴인데
 *   @font-face가 100~900을 통째로 걸고 있다(global.css). 그래서 이 칸만
 *   무게를 아무리 올려도 획이 굵어지지 않는다 — 합성 굵기조차 안 걸린다.
 *
 * 여기 없는 키는 보정하지 않는다.
 */
export const opticalFix: Record<string, { scale?: number; stroke?: number }> = {
  deulseok: { scale: 1.122, stroke: 0.011 }
};

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
