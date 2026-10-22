import { useEffect, useRef } from 'react';
import { G, RF } from '../lib/aggregate';
import { DOTS, SKY } from '../lib/sky';
import { tokenMs } from '../lib/motion';
import { groundPx } from '../lib/ground';
import { Eyes } from '../phases/PhaseOnWall';
import type { DockBeat } from './WallWalkers';
import sadSrc from '../../by_moomiryu/Renewal_v1/Character/eye/eye_sad.svg?raw';
import tiredSrc from '../../by_moomiryu/Renewal_v1/Character/eye/eye_tired.svg?raw';

/** 해의 슬픈 눈꺼풀 둘 — 작가의 슬픈 눈(eye_sad.svg)은 07 눈과 판 · 눈 자리가 같아(412 × 172, 흰자 반지름 86.21) 눈꺼풀만 그대로 얹는다 */
const SAD_LIDS = [...sadSrc.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
/** 달의 피곤한 눈꺼풀 둘 — 작가의 피곤한 눈(eye_tired.svg)도 같은 판이라 위쪽 반원 눈꺼풀만 얹는다(반만 뜬 눈) */
const TIRED_LIDS = [...tiredSrc.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);

/**
 * 벽의 기본 배경 — 대학 스카이라인(2026-10-20, 결정 25 — 견본 kv/bg-campus.html 'A — 완전 한 색'). 자연 컨셉 때의 나무처럼 깔리는
 * 배경을, 원형 도트로 짓되 점 사이 틈 없이(속은 한 면, 가장자리만 점 결 — 땅 띠와 같은 결) '대학'으로. 마당 · 정문 · 강의동 + 나무 안은
 * 고르지 않았고, 창 · 시계 · 기둥 같은 밝은 덧칠도 뺐다 — --grey-900 한 색으로 물러나 글이 먼저 읽힌다.
 *
 * 실루엣(가로 = 벽 폭의 몫, 높이 = 땅 띠 윗선에서 위로 벽 높이의 몫): 강의동(박공) · 시계탑(첨탑) · 도서관(박공) · 낮은 동 · (가운데
 * 0.385 ~ 0.63은 비움 — 로고 · 기기, 하늘 말 꼬리들의 꼭짓점) · 기숙사 · 학생회관(돔) · 강의동(작은 탑). 그 합집합 안의 벌집 격자 점(벽
 * 격자 — 화면 왼쪽 위가 원점, 간격 = 하늘 말 점 간격 G)마다 반지름 RF × 1.08의 원.
 *
 * 해와 구름(결정 29 — "우리 결로"): 같은 짓는 법, 같은 --grey-900(결정 34 — 한 단계 밝던 --grey-800을 건물과 한 색으로). 해는 실제 시계로
 * 하늘 위 큰 호를 지나고, 밤엔 같은 길을 초승달이 지난다(ORB). 해에는 눈이 있다(2026-10-21 디자이너 — 07의 두 눈, 흰자는 은은하게): 평소엔
 * 느리게 끔뻑, 도킹 중엔 깜짝 놀라 가운데 큰 말을 본다(app.css .wall-sun). 낮의 해 둘레엔 둥근 점 햇살 8줄이 천천히 돈다(RAYS). 달은 같은 눈에 피곤한 눈꺼풀. 구름 둘은 위 두 귀에 크게 — 화면 위 끝에서 잘려 하늘 위 가장자리를 채운다(2026-10-21 디자이너 — 말풍선과 크기 차가
 * 없어 애매해 보였다. 위 두 귀 · 위 가장자리 띠 · 네 귀 × 2배 · 3배 견본에서 '위 두 귀 · 3배'. 옆의 작은 둘은 뺐다). 가운데로 흘러 들어오지
 * 않는다 — 제자리에서 화면 폭의 ±1.5%만 40초에 한 번 오간다, 구름마다 박자를 엇갈려. 움직임 줄이기면 멈춘다.
 *
 * 층은 벽 바탕 바로 위 — 해 → 구름 → 건물 다음에야 소리의 결 · 땅 · 하늘 말 · 부스러기 · 작은 사람(WallSimulation에서 맨 앞에 놓는다).
 * 도킹 때도 그대로다 — 창 크기가 바뀔 때만 다시 그린다.
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
/**
 * 건물 하나하나의 땅 위 가로 범위(벽 폭의 몫, 왼쪽부터) — 사각 몸통끼리 겹치면 한 건물(강의동의 작은 탑), 맞닿기만 한 도서관 · 낮은 동은 둘.
 * 작은 사람이 티끌을 가운데에서 가까운 건물부터 나른다(결정 55, WallSky)
 */
export const HALLS: readonly (readonly [number, number])[] = BUILDINGS.filter(([kind]) => kind === 'rect').map(([, a, b]) => [a, b] as [number, number])
  .sort((p, q) => p[0] - q[0]).reduce<[number, number][]>((out, [a, b]) => { const l = out[out.length - 1]; if (l && a < l[1]) l[1] = Math.max(l[1], b); else out.push([a, b]); return out; }, []);
/**
 * 해 · 달 — 실제 시계로 하늘 위 큰 호를 지난다(2026-10-21 디자이너 "이게 시간이 지나는 거면 해의 위치도 바뀌어야 하는 거 아니냐, 해랑 달이
 * 반복되는?" — 부스러기가 글의 나이로 바래니 해도 같은 시계로. 실제 시계 · 빠르게 한 바퀴 · 그대로 중 실제 시계, 큰 호 · 위 가장자리를 따라
 * 중 큰 호). 오전 6시 왼쪽 건물 뒤에서 떠서 정오에 하늘 맨 위 가운데, 오후 6시 오른쪽 건물 뒤로 진다. 밤엔 같은 길을 달이 — 초승달 ·
 * 피곤한 눈(벽은 밤에도 켜 둔다. 보름 · 반달 · 초승 × 뜬 · 피곤한 · 감은 눈 견본에서). 해와 달이 바뀌는 때는 지평선, 건물 뒤다. 한낮엔
 * 말풍선 뒤로 지나가 눈이 가려질 때가 있다(알고 골랐다). 호의 가운데 가로 · 가로 반지름(벽 폭의 몫) · 지평선 · 한낮 높이 · 반지름(벽
 * 높이의 몫) · 자리를 다시 셈하는 간격(초 — 1920 벽에서 10초에 0.5px쯤이라 멈춘 듯 보인다)
 */
const ORB = { cx: 0.5, rx: 0.45, horizon: 0.86, noon: 0.13, r: 0.065, every: 10 };
/**
 * 햇살 — 해 둘레에서 바깥으로 뻗는 둥근 점 점선(2026-10-22 결정 54, 디자이너 "해가 해 같지가 않대" — 02 십자선 · 소리 결과 같은 점, 점
 * 사이 = 지름 × DOTS.gap). 낮에만, 달엔 없다. 8 · 12줄 × 가만히 · 천천히 돎 · 숨 쉬기 견본에서 '8줄 · 천천히 돎', 이어 "더 작아도 돼,
 * 여기 주인공은 말풍선" → 점 2 · 3개 × 지름 0.06 · 0.08 · 0.10 격자에서 '2개 · 0.08'. 줄 수 · 줄마다 점 수 · 첫 점 자리 · 점 지름(둘 다
 * 해 반지름의 몫) · 한 칸(45°) 도는 데 --t-home-ring의 몇 배(12줄 견본과 같은 각속도 — 40초에 30°)
 */
const RAYS = { n: 8, dots: 2, from: 1.3, d: 0.08, turn: 1.5 };
/** 그때 해인가 달인가 · 호 위의 자리(벽의 몫) */
function orbAt(d: Date) {
  const h = d.getHours() + d.getMinutes() / 60, moon = h < 6 || h >= 18, k = (Math.PI * ((h - (moon ? 18 : 6) + 24) % 24)) / 12;
  return { moon, x: ORB.cx - ORB.rx * Math.cos(k), y: ORB.horizon - (ORB.horizon - ORB.noon) * Math.sin(k) };
}
/** 구름 — 가운데 가로 · 세로(벽의 몫), 폭(벽 폭의 몫 — 그 전 구름의 3배), 오가는 박자의 출발점(한 번 오가는 것의 몫). 왼쪽 위 · 오른쪽 위 */
const CLOUDS = [[0.07, 0.03, 0.39, 0], [0.93, 0.04, 0.36, 0.4]] as const;
/** 구름 꼴 — 폭 w · 높이 0.5w 상자 안 둥근 혹 다섯의 합집합 [가로, 세로, 반지름](w의 몫), 아래는 0.82h에서 평평하게(견본 식 그대로) */
const BUMPS = [[0.18, 0.62, 0.17], [0.38, 0.42, 0.24], [0.6, 0.48, 0.21], [0.8, 0.64, 0.15], [0.48, 0.7, 0.2]] as const;
/** 구름이 오가는 폭(벽 폭의 몫) · 한 번 오가는 시간(초) */
const SWAY = 0.015, SWAY_S = 40;
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

export default function WallSkyline({ beat, sad = false }: { beat?: { current: DockBeat | null }; sad?: boolean }) {
  const ref = useRef<HTMLDivElement>(null), sunRef = useRef<HTMLDivElement>(null);
  const beatRef = useRef(beat);
  beatRef.current = beat;
  // 끄기를 묻는 동안(WallPower) 해가 슬프다 — 눈꺼풀이 내려오고 조금 가라앉는다(app.css .wall-sun.is-sad)
  useEffect(() => { sunRef.current?.classList.toggle('is-sad', sad); }, [sad]);
  // 해의 눈 — 도킹 중(큰 말이 선 때부터 하늘로 오르기 시작할 때까지)엔 깜짝 놀란다. 그 밖엔 07 눈처럼 느리게 끔뻑(app.css .wall-sun)
  useEffect(() => {
    let raf = 0, on = false;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const b = beatRef.current?.current, now = performance.now() / 1000, dk = !!b && now >= b.start && now < b.rise;
      if (dk !== on && sunRef.current) { on = dk; sunRef.current.classList.toggle('is-startled', dk); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const box = ref.current, sun = sunRef.current;
    if (!box || !sun) return;
    const ink = getComputedStyle(document.documentElement).getPropertyValue('--grey-900').trim();
    const made: HTMLCanvasElement[] = [];
    /** 해 · 달을 지금 시각의 자리로 — 놀랄 때 눈동자가 볼 쪽(벽 가운데)도 그 자리에서 셈한다(app.css --look-x · --look-y). 해 ↔ 달이 바뀌었으면 다시 그린다 */
    const place = () => {
      const o = orbAt(new Date());
      if (o.moon !== sun.classList.contains('is-moon')) return draw();
      const W = window.innerWidth, H = window.innerHeight, sr = ORB.r * H, x = o.x * W, y = o.y * H, dx = W / 2 - x, dy = H / 2 - y, d = Math.hypot(dx, dy) || 1;
      Object.assign(sun.style, { left: `${x - sr}px`, top: `${y - sr}px` });
      sun.style.setProperty('--look-x', `${((11 * dx) / d).toFixed(1)}%`);
      sun.style.setProperty('--look-y', `${((11 * dy) / d).toFixed(1)}%`);
    };
    const draw = () => {
      const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      const u = SKY.u * H, g = G * u, row = (g * Math.sqrt(3)) / 2, r = RF * u * FILL;
      /** w × h 안 벌집 점(왼쪽 위가 원점) 중 inside인 것을 color로 — 점이 잘리지 않게 사방 r만큼 넓힌 캔버스를 (x, y)에 놓는다(해는 제 틀 안에) */
      const dots = (x: number, y: number, w: number, h: number, color: string, inside: Shape, into: HTMLElement = box) => {
        const cv = document.createElement('canvas'), ctx = cv.getContext('2d')!;
        cv.width = Math.ceil((w + 2 * r) * dpr); cv.height = Math.ceil((h + 2 * r) * dpr);
        cv.style.cssText = `position:absolute;left:${x - r}px;top:${y - r}px;width:${cv.width / dpr}px;height:${cv.height / dpr}px`;
        ctx.setTransform(dpr, 0, 0, dpr, r * dpr, r * dpr);
        ctx.fillStyle = color;
        ctx.beginPath();
        for (let j = 0; j * row <= h + row; j++) {
          const py = j * row, off = j & 1 ? g / 2 : 0;
          for (let i = -1; i * g + off <= w + g; i++) {
            const px = i * g + off;
            if (inside(px, py)) { ctx.moveTo(px + r, py); ctx.arc(px, py, r, 0, 2 * Math.PI); }
          }
        }
        ctx.fill();
        made.push(cv);
        return into === box ? box.appendChild(cv) : into.insertBefore(cv, into.firstChild);   // 해는 눈 뒤에
      };
      for (const cv of made.splice(0)) cv.remove();
      // 해 · 달 — 눈과 한 틀(.wall-sun)에 넣어 놀랄 때 함께 움찔한다. 틀은 맨 앞 자식이라 구름 · 건물이 그 앞에 선다. 초승달은 원에서 왼쪽으로
      // 반지름의 절반 비킨 0.9배 원을 뺀 것(밝은 쪽이 오른쪽)
      const sr = ORB.r * H, moon = orbAt(new Date()).moon;
      Object.assign(sun.style, { width: `${2 * sr}px`, height: `${2 * sr}px` });
      sun.classList.toggle('is-moon', moon);
      dots(0, 0, 2 * sr, 2 * sr, ink, (x, y) => (x - sr) ** 2 + (y - sr) ** 2 <= sr * sr && (!moon || (x - sr / 2) ** 2 + (y - sr) ** 2 > (0.9 * sr) ** 2), sun);
      place();
      const still = matchMedia('(prefers-reduced-motion: reduce)').matches, A = SWAY * W;
      // 햇살 — 해 원판 뒤에 한 장. 점은 한 번에 칠하고 캔버스째 돈다(움직임 줄이기면 가만히). 해와 한 틀이라 놀라면 함께 움찔한다
      if (!moon) {
        const d = RAYS.d * sr, step = d * DOTS.gap, reach = sr * RAYS.from + (RAYS.dots - 1) * step + d;
        const cv = document.createElement('canvas'), ctx = cv.getContext('2d')!;
        cv.width = cv.height = Math.ceil(2 * reach * dpr);
        cv.style.cssText = `position:absolute;left:${sr - reach}px;top:${sr - reach}px;width:${cv.width / dpr}px;height:${cv.height / dpr}px`;
        ctx.setTransform(dpr, 0, 0, dpr, reach * dpr, reach * dpr);
        ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--grey-800').trim();
        ctx.beginPath();
        for (let i = 0; i < RAYS.n; i++) for (let k = 0; k < RAYS.dots; k++) {
          const a = (i / RAYS.n) * 2 * Math.PI, at = sr * RAYS.from + k * step;
          ctx.moveTo(Math.cos(a) * at + d / 2, Math.sin(a) * at);
          ctx.arc(Math.cos(a) * at, Math.sin(a) * at, d / 2, 0, 2 * Math.PI);
        }
        ctx.fill();
        made.push(cv);
        sun.insertBefore(cv, sun.firstChild);
        if (!still) cv.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${360 / RAYS.n}deg)` }], { duration: tokenMs('--t-home-ring', 40000) * RAYS.turn, iterations: Infinity });
      }
      for (const [cx, cy, fw, phase] of CLOUDS) {
        const w = fw * W, h = w * 0.5;
        const cv = dots(cx * W - w / 2, cy * H - h / 2, w, h, ink, (x, y) =>
          y <= h * 0.82 && BUMPS.some(([bx, by, br]) => (x - bx * w) ** 2 + (y - by * h * 1.6 + h * 0.18) ** 2 <= (br * w) ** 2));
        if (still) continue;
        const steps = Array.from({ length: 25 }, (_, k) => ({ transform: `translateX(${A * Math.sin((k / 24) * 2 * Math.PI)}px)` }));
        cv.animate(steps, { duration: SWAY_S * 1000, iterations: Infinity, iterationStart: phase });
      }
      dots(0, 0, W, H, ink, buildingsAt(W, H));
    };
    draw();
    window.addEventListener('resize', draw);
    const clock = window.setInterval(place, ORB.every * 1000);
    return () => { window.removeEventListener('resize', draw); clearInterval(clock); for (const cv of made) cv.remove(); };
  }, []);
  return (
    <div ref={ref} className="wall-skyline" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div ref={sunRef} className="wall-sun">
        <Eyes />
        <svg className="onwall-eye wall-sun-sad" viewBox="0 0 412.12 172.43" aria-hidden focusable="false">{SAD_LIDS.map((d) => <path key={d} d={d} />)}</svg>
        <svg className="onwall-eye wall-moon-lids" viewBox="0 0 412.12 172.43" aria-hidden focusable="false">{TIRED_LIDS.map((d) => <path key={d} d={d} />)}</svg>
      </div>
    </div>
  );
}
