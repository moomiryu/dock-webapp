/**
 * 움직임 토큰(tokens.css의 --t-* · --ease-*)을 JS에서 읽는 곳. 값은 tokens.css 한 곳에만 산다.
 *
 * 시간은 단위를 보고 읽는다 — 빌드가 CSS를 줄이며 700ms를 .7s로 고쳐 적는다. ms로만 읽었더니 라이브에서만
 * 0.0007초가 되어 벽 구름이 한 프레임에 600px씩 건너뛰었다(2026-09-29). 그 뒤 같은 함수가 열한 곳에 따로 생겨 여기로 모았다(10-11).
 */

function raw(name: string): string {
  return typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** 시간 토큰 → ms */
export function tokenMs(name: string, fallback: number): number {
  const v = raw(name), n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return v.endsWith('ms') ? n : n * 1000;
}

/** 시간 토큰 → 초 */
export function tokenS(name: string, fallback: number): number {
  const v = raw(name), n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return v.endsWith('ms') ? n / 1000 : n;
}

/** 이징 토큰(cubic-bezier) → 0~1 함수 */
export function easeOf(name: string): (p: number) => number {
  const nums = raw(name).match(/-?[\d.]+/g)?.map(Number);
  const [x1, y1, x2, y2] = nums && nums.length === 4 ? nums : [0.2, 0, 0, 1];
  const f = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (p) => {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    let lo = 0, hi = 1, t = p;
    for (let i = 0; i < 22; i++) { t = (lo + hi) / 2; if (f(x1, x2, t) < p) lo = t; else hi = t; }
    return f(y1, y2, t);
  };
}
