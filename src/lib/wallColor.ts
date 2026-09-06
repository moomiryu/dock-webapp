// 벽 위의 색 규칙.
//
// 강조(꽂혀 있는 동안)에는 고른 색 조합이 화면을 통째로 덮는다.
// 그 뒤 풍경으로 돌아가면 바탕은 검정이고, 글자는 그 조합에서 더 밝은 쪽을 쓴다.
// 미리보기(04)와 실제 벽(/wall)이 같은 규칙을 봐야 미리보기가 거짓말이 아니다.

export function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 두 색 중 밝은 쪽 — 검은 풍경 위에서 읽히는 색 */
export function brightestColor(p: { bg: string; text: string }): string {
  return [p.bg, p.text].sort((a, b) => luminance(b) - luminance(a))[0];
}
