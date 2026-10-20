import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { G, RF } from '../lib/aggregate';
import { SKY } from '../lib/sky';

/**
 * 벽의 끄기(2026-10-21 디자이너 — "이때까지 그냥 라즈베리파이 선 뽑는 걸로 무식하게 끔"). 땅 띠 오른쪽 끝의 끄기 버튼(WallGround, 왼쪽
 * 새로고침의 짝) → 가운데 '종료하시겠어요? 예 / 아니오'. 판은 우리 결 — 스카이라인 · 땅처럼 벌집 점을 겹쳐 속은 한 면, 가장자리만 점 결
 * (--grey-800, 땅 띠와 같은 색). 주 행동 '예'만 1px 선 칸, '아니오'는 글자. 열리면 '아니오'에 먼저 초점(실수로 끄지 않게), Esc로도 닫힌다.
 * 떠 있는 동안 해와 작은 사람이 슬프다(WallSimulation이 sad로 넘긴다 — 디자이너 "해당 장면 때 해랑 캐릭터들 슬픈 표정").
 *
 * '예' → 벽 전체가 옛 TV처럼 위아래로 접혀 가로 한 줄이 됐다가 사라지고(여는 장면의 homeBootOff — 그 장면처럼 2배 느리게) → 파이 안의
 * 문지기(pi/power.py)를 두드려 파이를 정상 종료한다. 문지기가 없으면(파이가 아닌 데서 연 벽) 다시 펴지고 창이 닫힌다.
 * 크기는 벽 높이에 비례 — 토큰 값을 벽 높이 / 720배로(로고타입과 같은 셈)
 */
/** 문지기 자리 — pi/power.py의 HOST · PORT와 같아야 한다 */
const POWER_URL = 'http://127.0.0.1:8765/poweroff';
/** 점 반지름의 덧 — 이웃 점이 겹쳐 속이 한 면이 되게(스카이라인과 같은 값) */
const FILL = 1.08;

export default function WallPower({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null), dots = useRef<HTMLCanvasElement>(null), no = useRef<HTMLButtonElement>(null);
  const [down, setDown] = useState(false);
  const [k, setK] = useState(() => window.innerHeight / 720);

  // 판 — 벌집 점으로 짓는다(창 크기가 바뀌면 다시)
  useEffect(() => {
    if (!open) return;
    const paint = () => {
      const p = panel.current, cv = dots.current;
      if (!p || !cv) return;
      const H = window.innerHeight, u = SKY.u * H, g = G * u, row = (g * Math.sqrt(3)) / 2, r = RF * u * FILL, dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = p.offsetWidth, h = p.offsetHeight, ctx = cv.getContext('2d');
      if (!ctx) return;
      cv.width = Math.ceil((w + 2 * r) * dpr); cv.height = Math.ceil((h + 2 * r) * dpr);
      Object.assign(cv.style, { left: `${-r}px`, top: `${-r}px`, width: `${cv.width / dpr}px`, height: `${cv.height / dpr}px` });
      ctx.setTransform(dpr, 0, 0, dpr, r * dpr, r * dpr);
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--grey-800').trim();
      ctx.beginPath();
      for (let j = 0; j * row <= h; j++) {
        for (let x = j & 1 ? g / 2 : 0; x <= w; x += g) { ctx.moveTo(x + r, j * row); ctx.arc(x, j * row, r, 0, 2 * Math.PI); }
      }
      ctx.fill();
    };
    const resize = () => { setK(window.innerHeight / 720); requestAnimationFrame(paint); };
    requestAnimationFrame(paint);
    no.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !down) onClose(); };
    window.addEventListener('resize', resize);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('resize', resize); window.removeEventListener('keydown', esc); };
  }, [open, down, onClose]);

  // '예' — 벽이 접혀 꺼진 뒤 문지기를 두드린다. 못 두드리면 다시 편다
  useEffect(() => {
    if (!down) return;
    const wall = panel.current?.closest<HTMLElement>('.wall');
    if (!wall) return;
    let gone = false;
    const knock = () => {
      if (gone) return;
      gone = true;
      fetch(POWER_URL, { method: 'POST' })
        .then((r) => { if (!r.ok) throw new Error(String(r.status)); })
        .catch(() => { wall.classList.remove('is-power-off'); setDown(false); onClose(); });
    };
    const end = (e: AnimationEvent) => { if (e.target === wall) knock(); };
    wall.addEventListener('animationend', end);
    wall.classList.add('is-power-off');
    // 움직임 줄이기면 접힘 없이 바로 검게(animationend가 안 온다)
    if (getComputedStyle(wall).animationName === 'none') knock();
    return () => wall.removeEventListener('animationend', end);
  }, [down, onClose]);

  if (!open) return null;
  return (
    <div ref={panel} className={'wall-power-ask' + (down ? ' is-down' : '')} role="dialog" aria-modal="true" aria-labelledby="wall-power-q"
      style={{ '--wk': k } as CSSProperties} onClick={(e) => e.stopPropagation()}>
      <canvas ref={dots} className="wall-power-dots" aria-hidden="true" />
      <p id="wall-power-q" className="wall-power-q">종료하시겠어요?</p>
      <div className="wall-power-acts">
        <button type="button" className="wall-power-yes" onClick={() => setDown(true)}>예</button>
        <button ref={no} type="button" className="wall-power-no" onClick={onClose}>아니오</button>
      </div>
    </div>
  );
}
