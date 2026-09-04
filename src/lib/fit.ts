// 액자에 글을 맞추는 계산 — 쓰는 만큼 글자가 작아진다.
//
// 외벽은 정해진 크기(2.4 × 1.5 m)라, 긴 문장은 작게 들어갈 수밖에 없다.
// 그 사실을 쓰는 동안에도 보여주려고 입력 화면과 미리보기가 같은 공식을 쓴다.
// /wall의 강조 렌더도 같은 비율을 쓰되 단위만 뷰포트(vw/vh)다.
//
// 단위가 cqw/cqh라서 부모에 `container-type: size`가 있어야 한다.
// 컨테이너 쿼리를 모르는 브라우저에서는 이 값이 통째로 무효가 되므로,
// CSS 쪽에 폴백 font-size를 남겨둘 것.

interface Options {
  /** 아래로 줄어들 수 있는 한계 (px). 편집 화면은 읽을 수 있어야 해서 더 높다 */
  min?: number;
  /** 위로 커질 수 있는 한계 (px) */
  max?: number;
}

/** 가장 긴 줄이 폭의 88%, 전체 줄이 높이의 82%에 맞춰지는 font-size 식 */
export function fitFontSize(text: string, { min = 6, max = 200 }: Options = {}): string {
  const lines = text.split('\n');
  const longest = Math.max(1, ...lines.map((l) => Array.from(l).length));
  const byWidth = (88 / longest).toFixed(2);
  const byHeight = (82 / (lines.length * 1.25)).toFixed(2);
  return `clamp(${min}px, min(${byWidth}cqw, ${byHeight}cqh), ${max}px)`;
}

/** 그 글자가 실제 외벽에서 몇 cm가 되는지 */
export function glyphCm(text: string, wallWidthM: number): number {
  const lines = text.split('\n');
  const longest = Math.max(1, ...lines.map((l) => Array.from(l).length));
  return Math.round(((wallWidthM * 100) / longest) * 0.88);
}
