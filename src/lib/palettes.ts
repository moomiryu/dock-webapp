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

// 형태 5단계 → Adobe Fonts (kit zhl0ile). Korean fallbacks added because some
// faces (e.g. orbit) may not cover all Hangul.
export const fontMap: Record<string, string> = {
  doran: '"jjgulwol", "Noto Serif KR Variable", serif',
  chabun: '"kim-jung-chul-myungjo", "Noto Serif KR Variable", serif',
  botong: '"orbit", "Pretendard Variable", sans-serif',
  ttoryeot: '"seoul-namsan", "Pretendard Variable", sans-serif',
  deulseok: '"agahnsangsoo2012", "Pretendard Variable", sans-serif',
  // legacy keys — keep so older Firestore docs still render
  gothic: '"seoul-namsan", "Pretendard Variable", sans-serif',
  mono: '"orbit", "Pretendard Variable", sans-serif',
  myeongjo: '"kim-jung-chul-myungjo", "Noto Serif KR Variable", serif',
  song: '"agahnsangsoo2012", "Pretendard Variable", sans-serif'
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
