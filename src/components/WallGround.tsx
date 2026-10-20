import { useEffect, useRef } from 'react';
import { GROUND, groundPx, grainKnots, swellAt } from '../lib/ground';
import { G, RF } from '../lib/aggregate';
import { SKY } from '../lib/sky';

/**
 * 벽의 바닥 — 땅 띠와 그 속에 박힌 로고타입(2026-10-20, 결정 6). 벽의 구도는 역삼각: 위에 넓게 하늘, 아래 가운데가 꼭짓점 — 하늘
 * 말들의 꼬리가 모두 아래 가운데(기기)를 가리키고, 그 꼭짓점에 로고타입이 박혀 있다.
 *
 * 땅 띠 — 벽 높이의 3%(lib/ground.ts) · --grey-800 · 벽 격자(화면 왼쪽 위가 원점)의 벌집 점 사이를 같은 색으로 메워 한 면. 윗선만
 * 점 결(점 간격 0.3u₀ — u₀ = 하늘 말의 u, 말의 점과 같은 크기)이고 그 위의 완만한 굴곡은 그대로. 결정 2의 '성긴 점 · 메움 없음'을
 * 뒤집었다(디자이너: 점 간격이 보이면 별로). 사진 풀은 2026-10-20에 걷었다.
 *
 * 로고타입 'MegaFont' — 한 줄 · 기울기 없음 · Lineal 1200 · 자간 −0.01em(옛 배지 값) · 검정(--ink). 크기는 홈 마크(--fs-home-mark)의
 * 30%를 견본 벽(720px 높이)에 단 것 — 벽 높이에 비례(≈ 1.8%). 가로 가운데, 땅 띠 높이의 한가운데에 박는다("땅 상단에 있지 말고 땅에
 * 박아"). 벽 왼쪽 위의 원 배지는 뺐다(폰 홈의 원은 그대로).
 *
 * 새로고침 — 땅 띠 왼쪽 끝, 로고타입처럼 띠 높이의 한가운데에 박힌 아이콘(2026-10-21). 자판 없이 마우스 하나로 벽을 다시 띄운다.
 * 끄기 — 그 짝으로 오른쪽 끝(2026-10-21). 선을 뽑지 않고 파이를 끈다(WallPower → pi/power.py).
 *
 * 말들 뒤에 선다(작은 사람이 그 위를 걷는다). 움직이지 않는다 — 창이 바뀔 때만 다시 그린다.
 */
export default function WallGround({ onPower }: { onPower?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null), mark = useRef<HTMLDivElement>(null), reload = useRef<HTMLButtonElement>(null), power = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const css = getComputedStyle(document.documentElement);
    const color = css.getPropertyValue('--grey-800').trim(), home = parseFloat(css.getPropertyValue('--fs-home-mark')) || 44;
    const knots = grainKnots();
    const draw = () => {
      const W = window.innerWidth, H = window.innerHeight, dpr = window.devicePixelRatio || 1, band = groundPx(H);
      // 캔버스 = 땅 + 윗선이 솟는 만큼. floor = 캔버스 안의 바닥선(땅의 곧은 윗선)
      const floor = Math.ceil(H * (GROUND.swell + 2 * GROUND.grain)) + 2, ch = floor + band, top = H - ch;
      cv.width = Math.round(W * dpr); cv.height = Math.round(ch * dpr); cv.style.height = `${ch}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, ch);
      ctx.fillStyle = color;
      const u = SKY.u * H, g = G * u, row = (g * Math.sqrt(3)) / 2, r = RF * u;
      ctx.beginPath();
      for (let j = Math.ceil(top / row); j * row <= H + r; j++) {
        const y = j * row - top, off = j & 1 ? g / 2 : 0;
        for (let i = -1; i * g + off <= W + r; i++) {
          const x = i * g + off;
          if (y < floor - swellAt(x, H, knots)) continue;
          ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, 2 * Math.PI);
        }
      }
      ctx.fill();
      // 로고타입 — 땅 띠 높이의 한가운데
      if (mark.current) Object.assign(mark.current.style, { fontSize: `${((0.3 * home * H) / 720).toFixed(2)}px`, bottom: `${(band / 2).toFixed(1)}px` });
      // 새로고침 · 끄기 — 칸은 모서리에 붙이고 아이콘만 띠 한가운데로 띄운다
      for (const b of [reload.current, power.current]) {
        const icon = b?.firstElementChild?.getBoundingClientRect().height ?? 0;
        if (b) b.style.paddingBottom = `${Math.max(0, band / 2 - icon / 2).toFixed(1)}px`;
      }
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, []);
  return (
    <>
      <canvas ref={ref} className="wall-soil" aria-hidden="true" />
      <div ref={mark} className="wall-mark" aria-hidden="true">MegaFont</div>
      <button ref={reload} type="button" className="wall-reload" onClick={() => location.reload()} aria-label="새로고침">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden focusable="false">
          <path d="M19.5 12 A7.5 7.5 0 1 1 15.75 5.5 M11.9 6.5 L15.75 5.5 L14.7 1.65" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {/* 끄기 — 오른쪽 끝, 새로고침의 짝(2026-10-21). 누르면 '종료하시겠어요?'(WallPower) */}
      {onPower && (
        <button ref={power} type="button" className="wall-reload wall-power" onClick={onPower} aria-label="종료">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden focusable="false">
            <path d="M7.4 6.6 A7.5 7.5 0 1 0 16.6 6.6 M12 2.8 V11" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </>
  );
}
