import { useEffect, useRef } from 'react';
import { G, RF } from '../lib/aggregate';
import { SKY } from '../lib/sky';
import { groundPx } from '../lib/ground';

/**
 * 벽의 기본 배경 — 대학 스카이라인(2026-10-20, 결정 25 — 견본 kv/bg-campus.html 'A — 완전 한 색'). 자연 컨셉 때의 나무처럼 깔리는
 * 배경을, 원형 도트로 짓되 점 사이 틈 없이(속은 한 면, 가장자리만 점 결 — 땅 띠와 같은 결) '대학'으로. 마당 · 정문 · 강의동 + 나무 안은
 * 고르지 않았고, 창 · 시계 · 기둥 같은 밝은 덧칠도 뺐다 — --grey-900 한 색으로 물러나 글이 먼저 읽힌다.
 *
 * 실루엣(가로 = 벽 폭의 몫, 높이 = 땅 띠 윗선에서 위로 벽 높이의 몫): 강의동(박공) · 시계탑(첨탑) · 도서관(박공) · 낮은 동 · (가운데
 * 0.385 ~ 0.63은 비움 — 로고 · 기기, 하늘 말 꼬리들의 꼭짓점) · 기숙사 · 학생회관(돔) · 강의동(작은 탑). 그 합집합 안의 벌집 격자 점(벽
 * 격자 — 화면 왼쪽 위가 원점, 간격 = 하늘 말 점 간격 G)마다 반지름 RF × 1.08의 원. 땅 띠 윗선 아래로는 반 줄까지만.
 *
 * 층은 벽 바탕 바로 위 — 소리의 결 · 땅 · 하늘 말 · 부스러기 · 작은 사람보다 뒤(WallSimulation에서 맨 앞에 놓는다). 움직이지 않고 도킹
 * 때도 그대로다 — 창 크기가 바뀔 때만 다시 그린다.
 */
type Shape = (x: number, y: number) => boolean;
/** 건물 — [모양, 가로 시작, 끝, 높이(또는 돔 가운데 높이), 박공 · 첨탑의 높이 또는 돔 반지름(벽 높이의 몫)] */
const BUILDINGS: readonly (readonly ['rect' | 'roof' | 'dome', number, number, number, number?])[] = [
  ['rect', 0, 0.13, 0.11], ['roof', -0.005, 0.135, 0.11, 0.035],      // 강의동 — 박공
  ['rect', 0.15, 0.185, 0.27], ['roof', 0.145, 0.19, 0.27, 0.07],     // 시계탑 — 첨탑
  ['rect', 0.2, 0.34, 0.15], ['roof', 0.195, 0.345, 0.15, 0.045],     // 도서관 — 박공
  ['rect', 0.34, 0.385, 0.07],                                         // 낮은 동
  ['rect', 0.63, 0.7, 0.23],                                           // 기숙사
  ['rect', 0.72, 0.86, 0.1], ['dome', 0.79, 0.79, 0.1, 0.055],        // 학생회관 — 돔
  ['rect', 0.88, 1, 0.13], ['rect', 0.925, 0.95, 0.18]                // 강의동 — 작은 탑
];
/** 점 반지름의 덧 — 이웃 점이 겹쳐 속이 한 면이 되게(견본 값) */
const FILL = 1.08;

export default function WallSkyline() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--grey-900').trim();
    const draw = () => {
      const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const gTop = H - groundPx(H), X = (f: number) => f * W, Y = (h: number) => gTop - h * H;
      const shapes: Shape[] = BUILDINGS.map(([kind, x0, x1, h, k = 0]) => {
        if (kind === 'rect') return (x, y) => x >= X(x0) && x <= X(x1) && y >= Y(h) && y <= gTop;
        if (kind === 'dome') return (x, y) => (x - X(x0)) ** 2 + (y - Y(h)) ** 2 <= (k * H) ** 2;
        return (x, y) => {   // 박공 · 첨탑 — 밑변 높이 h에서 k만큼 솟은 세모
          const top = Y(h + k), bot = Y(h), half = (X(x1) - X(x0)) / 2;
          return y >= top && y <= bot && Math.abs(x - (X(x0) + X(x1)) / 2) <= (half * (y - top)) / (bot - top);
        };
      });
      const u = SKY.u * H, g = G * u, row = (g * Math.sqrt(3)) / 2, r = RF * u * FILL;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (let j = Math.floor(Y(0.36) / row); j * row <= gTop + row * 0.5; j++) {
        const y = j * row, off = j & 1 ? g / 2 : 0;
        for (let i = -1; i * g + off <= W + g; i++) {
          const x = i * g + off;
          if (shapes.some((f) => f(x, y))) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 2 * Math.PI); }
        }
      }
      ctx.fill();
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, []);
  return <canvas ref={ref} className="wall-skyline" aria-hidden="true"
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', pointerEvents: 'none' }} />;
}
