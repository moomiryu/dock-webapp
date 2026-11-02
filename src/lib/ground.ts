/**
 * 벽의 땅 — 화면 맨 아래 늘 같은 두께의 띠(2026-10-04, 디자이너가 격자로 골랐다). 고른 과정은 design/landscape.md '땅'.
 * 그 위의 사진 풀은 2026-10-20에 걷었다(결정 2 — 자연을 버렸다). 띠는 성긴 점으로 그린다(WallGround).
 *
 * 바닥선 — 작은 사람이 걷는 곳 — 은 땅의 **곧은 윗선**이다(groundPx). 굴곡은 그 위로만 솟는다.
 * 값은 모두 벽 높이에 비례한다(1080px 벽에서 고른 값 — U = 그 벽의 1px).
 */
import { rng } from './hatch';

const U = 1 / 1080;

export const GROUND = {
  /** 두께 — 벽 높이의 3%(1080에서 32px, 실물 4cm). 지금 · 3 · 5 · 7 · 9 · 12% 중 — 9%부터 돌 키만 해져 무거웠고,
      확대해도 화면에 남는 띠라 얇을수록 덜 가린다 */
  thick: 0.03,
  /** 윗선 굴곡 — 0~10px로 완만히 오르내린다(세 파장의 사인을 섞는다: [파장, 몫, 시작]). 곧게 · 0~4 · 0~10 중 */
  swell: 10 * U,
  waves: [[900 * U, 0.5, 0.7], [520 * U, 0.3, 2.1], [330 * U, 0.2, 4.0]] as const,
  /** 그 위의 잔결 — ±1.5px, 10px마다 무작위 높이를 부드럽게 잇는다(찢은 종이 같은 땅 가장자리) */
  grain: 1.5 * U,
  grainStep: 10 * U
};

/** 땅 두께(px) */
export function groundPx(h: number): number {
  return Math.round(h * GROUND.thick);
}

/** 가로 x(px)에서 땅 윗선이 바닥선보다 솟은 높이(px) — 굴곡 + 잔결, 늘 0 이상 */
export function swellAt(x: number, h: number, knots: readonly number[]): number {
  const u = x / h;
  let v = 0;
  for (const [len, share, phase] of GROUND.waves) v += share * Math.sin((u / len) * 2 * Math.PI + phase);
  const s = (u / GROUND.grainStep), i = Math.floor(s), f0 = s - i, f = f0 * f0 * (3 - 2 * f0);
  const g = (knots[i % knots.length] ?? 0) * (1 - f) + (knots[(i + 1) % knots.length] ?? 0) * f;
  return h * (GROUND.swell * (v + 1) / 2 + GROUND.grain * (g + 1));
}

/** 잔결의 무작위 높이들(−1~1) — 같은 벽은 늘 같은 땅 */
export function grainKnots(seed = 4): number[] {
  const r = rng(seed);
  return Array.from({ length: 512 }, () => r() * 2 - 1);
}

/* ── 벽의 학교(WallSkyline 결정 25) — 땅 윗선에 선 건물들. 벽과 폰 Step 3(InfoOverlay)이 같이 쓴다 ── */
export type Shape = (x: number, y: number) => boolean;
/** 건물 — [모양, 가로 시작, 끝, 높이(또는 돔 가운데 높이), 박공 · 첨탑의 높이 또는 돔 반지름(벽 높이의 몫)] */
export const BUILDINGS: readonly (readonly ['rect' | 'roof' | 'dome', number, number, number, number?])[] = [
  ['rect', 0, 0.13, 0.11], ['roof', -0.005, 0.135, 0.11, 0.035],      // 강의동 — 박공
  ['rect', 0.15, 0.185, 0.27], ['roof', 0.145, 0.19, 0.27, 0.07],     // 시계탑 — 첨탑
  ['rect', 0.2, 0.34, 0.15], ['roof', 0.195, 0.345, 0.15, 0.045],     // 도서관 — 박공
  ['rect', 0.34, 0.385, 0.07],                                         // 낮은 동
  ['rect', 0.63, 0.7, 0.23],                                           // 기숙사
  ['rect', 0.72, 0.86, 0.1], ['dome', 0.79, 0.79, 0.1, 0.055],        // 학생회관 — 돔
  ['rect', 0.88, 1, 0.13], ['rect', 0.925, 0.95, 0.18]                // 강의동 — 작은 탑
];
/** 점 반지름의 덧 — 이웃 점이 겹쳐 속이 한 면이 되게(견본 값) */
export const FILL = 1.08;

/** 건물들의 합집합 — 벽 W × H에서 (x, y)가 건물 안인가. 말의 부스러기도 이 안에만 쌓인다(WallSky — 건물이 그릇) */
export function buildingsAt(W: number, H: number): Shape {
  const gTop = H - groundPx(H), X = (f: number) => f * W, Y = (f: number) => gTop - f * H;
  const shapes: Shape[] = BUILDINGS.map(([kind, x0, x1, h, k = 0]) => {
    if (kind === 'rect') return (x, y) => x >= X(x0) && x <= X(x1) && y >= Y(h) && y <= gTop;
    if (kind === 'dome') return (x, y) => (x - X(x0)) ** 2 + (y - Y(h)) ** 2 <= (k * H) ** 2;
    return (x, y) => {   // 박공 · 첨탑 — 밑변 높이 h에서 k만큼 솟은 세모
      const top = Y(h + k), bot = Y(h), half = (X(x1) - X(x0)) / 2;
      return y >= top && y <= bot && Math.abs(x - (X(x0) + X(x1)) / 2) <= (half * (y - top)) / (bot - top);
    };
  });
  return (x, y) => shapes.some((f) => f(x, y));
}
