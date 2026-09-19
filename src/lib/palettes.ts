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
//
// 2026-09-20: **네 칸의 서체가 전부 갈렸다.** 함께 '발랄한'이 '유머있는'이
// 되었다(tone.ts). 키는 안 바꾼다 — 사흘치 글이 벽에 떠 있는 동안 키를
// 바꾸면 그 글들이 서체를 잃는다.
//
//   ttoryeot 당당한   → dunkel-sans-variable          (Adobe 킷 qgd6cda)
//   chabun   차분한   → source-han-serif-kr-variable  (Adobe 킷 qgd6cda)
//   doran    다정한   → 마포 다카포                    (우리 파일)
//   deulseok 유머있는 → Handjet 2.004                  (우리 파일)
//
// 네 서체가 가진 축은 제각각이다 (파일의 fvar를 직접 읽어 확인했다):
//   당당한   wdth 700~1000 · GLAT 0~1000   ← 무게 축이 없다
//   차분한   wght 250~900                  ← 그것뿐
//   유머있는 wght 100~900 · ELSH 0~16 · ELGR 1~2
//   다정한   없음                          ← 굵기 한 벌
// 지금 조율 화면은 넷에게 같은 세 축(크기·빠르기·무게)을 묻는다. 안내서가
// 정한 성격별 축으로 가는 일은 다음 묶음이다.
//
// 폴백 차례에 뜻이 있다. 킷은 **도메인 잠금**이 걸려 있어서 새 도메인에
// 올리면 당당한·차분한 둘이 한꺼번에 사라질 수 있다. 차분한은 본명조가
// 받아 주고(index.html의 CDN), 당당한은 UI 얼굴로 떨어진다.
export const fontMap: Record<string, string> = {
  ttoryeot: '"dunkel-sans-variable", "Pretendard Variable", sans-serif',
  chabun: '"source-han-serif-kr-variable", "Noto Serif KR Variable", serif',
  doran: '"Mapo Dacapo", "Pretendard Variable", sans-serif',
  deulseok: '"Handjet", "Pretendard Variable", sans-serif',
  // 옛 Firestore 문서가 아직 벽에 있다. 없어진 서체를 가리키게 두면 그 글만
  // UI 얼굴로 떨어지므로, 제일 가까운 새 칸으로 보낸다.
  botong: '"Pretendard Variable", sans-serif',
  gothic: '"dunkel-sans-variable", "Pretendard Variable", sans-serif',
  mono: '"Pretendard Variable", sans-serif',
  myeongjo: '"source-han-serif-kr-variable", "Noto Serif KR Variable", serif',
  song: '"Handjet", "Pretendard Variable", sans-serif'
};

/**
 * 광학 보정 — 같은 font-size, 같은 font-weight에서도 서체마다 크기와
 * 자리가 다르게 보인다. 견본 넷을 나란히 놓는 02 성격 화면에서는 그
 * 차이가 서체의 성격이 아니라 **잘못 조판한 것**으로 읽힌다.
 *
 * 2026-09-20에 네 서체가 전부 갈려서 옛 수치는 통째로 버렸다. 없어진
 * 서체를 재서 얻은 값이라 하나도 못 쓴다. 아래는 새 넷을 다시 잰 값이다
 * (실제 앱 문서에서, 100px, 무게 500).
 *
 * scale — 잉크 높이. 제 이름을 100px로 찍어 actualBoundingBox로 쟀다:
 *   당당한 93 · 차분한 97 · 다정한 104 · 유머있는 85   (평균 94.8)
 *   em 박스가 아니라 잉크로 재는 이유: 눈이 읽는 것은 글자가 실제로
 *   차지한 높이지 글꼴이 선언한 em이 아니다.
 *
 * shift — 자리. 잉크의 한가운데가 줄 상자의 한가운데에서 얼마나
 *   벗어나 있는지를 쟀다(100px 기준, 아래로 +):
 *     당당한 +3.0 · 차분한 +5.5 · 다정한 −4.5 · 유머있는 +5.5
 *   다정한과 나머지가 10px 어긋나 있었다 — 나란히 놓인 칸이라 그게
 *   '줄이 안 맞는다'로 읽힌다. 네 값의 평균(+2.38)에 맞춘다.
 *   글자 크기를 따라가야 하므로 em으로 적는다.
 *
 * 안내서(2026-09-20 '타입 안내')는 시각보정을 30·22·23·28로 적어 두었다.
 * 배율로 치면 1.165 · 0.854 · 0.893 · 1.087이라 다정한·유머있는은 잰 값과
 * 거의 같고 당당한·차분한이 다르다. 안내서의 당당한에는 세로 75% 눌림이
 * 함께 걸려 있어서 그렇다 — 우리 화면은 그 눌림을 안 쓴다. 눈으로 보고
 * 안내서 쪽이 맞다 싶으면 이 표만 갈면 된다.
 *
 * 여기 없는 키는 보정하지 않는다.
 */
export const opticalFix: Record<string, { scale?: number; shift?: number }> = {
  ttoryeot: { scale: 1.019, shift: -0.0063 },
  chabun: { scale: 0.977, shift: -0.0313 },
  doran: { scale: 0.911, shift: 0.0688 },
  deulseok: { scale: 1.115, shift: -0.0313 }
};

/**
 * 획 보정 — 무게 축이 없는 서체에 획을 덧대 대신 답하게 한다.
 *
 * 2026-09-20에 이 표의 임자가 바뀌었다. 옛 '발랄한'(OG 르네상스 비밀)이
 * 나가고 **당당한과 다정한 둘**이 들어왔다. 파일의 fvar를 직접 읽어 보면:
 *
 *   당당한   Dunkelsans        wdth · GLAT 뿐    ← 무게 축이 없다
 *   차분한   Source Han Serif  wght 250~900
 *   다정한   마포 다카포        축이 아예 없다
 *   유머있는 Handjet           wght 100~900
 *
 * 유머있는은 이제 제 축으로 움직이므로 이 표에서 뺐다.
 *
 * 브라우저의 합성 굵기는 껐다(global.css의 font-synthesis-weight). 켜 두면
 * 600·700에서만 갑자기 뛰어서 다섯 칸이 '셋+둘'로 갈라지고, 무엇보다
 * **당당한의 속공간이 통째로 메워졌다** — 원래 잉크가 0.736으로 이미 꽉 찬
 * 얼굴이라 거기에 가짜 굵기를 얹으면 검은 덩어리가 된다.
 *
 * 값은 한 장에 나란히 놓고 골랐다(tuning-grid, 46px, '발화'):
 *   다정한  0 · 0.02 · 0.04 · 0.06 · 0.08em을 놓고 보니 **0.08에서 ㅂ의
 *           속공간이 닫힌다.** 0.06을 꼭대기로 두고 고르게 나눈다.
 *   당당한  0 · 0.008 · 0.016 · 0.024 · 0.032em. **0.016부터 이미 덩어리가
 *           된다.** 0.008이 마지막으로 골격이 버티는 자리다.
 *
 * 당당한의 사다리가 이렇게 짧은 것은 보정이 모자라서가 아니라 **이 서체에
 * 무게 축이 없어야 맞기 때문**이다. 안내서도 당당한에는 무게 대신
 * 말투(GLAT)를 두었다. 성격별 축으로 가는 일이 끝나면 이 줄은 없어진다.
 */
const STROKE_LADDER: Record<string, Record<number, number>> = {
  doran: { 300: 0, 400: 0.015, 500: 0.03, 600: 0.045, 700: 0.06 },
  ttoryeot: { 300: 0, 400: 0.002, 500: 0.004, 600: 0.006, 700: 0.008 }
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
