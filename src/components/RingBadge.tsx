import { useEffect, useId, useState } from 'react';

/**
 * 돌아가는 원형 메시지 + Mega / Font — 홈의 원(HomePoster)과 같은 것을 다른 화면에 거는 부품(2026-10-06, 벽 왼쪽 위).
 * 부제가 두 바퀴, 한 바퀴 --t-home-ring으로 돈다. 가운데 Mega / Font는 -15°. 크기는 놓는 쪽의 CSS가 정한다(viewBox가 따라 준다).
 */

export const RING_SUB = '대학 내 공공발화를 위한 카트, 메가폰트';
/** 원 글 반지름 — 부제 한 벌 + 전각 빈칸이 284px(16px · Whois + Pretendard)이라 두 벌이 한 바퀴. 견본에서 쟀다 */
export const RING_R = 90.4;
/** Lineal VF 대문자 높이 / em(OS/2) — 두 줄을 원 가운데에 세울 때 쓴다 */
export const LINEAL_CAP = 0.706;

/** 토큰을 숫자로 — 시간은 단위를 보고 초로(빌드가 ms를 s로 고쳐 적는다) */
function tokenNum(name: string, fallback: number): number {
  const n = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(n) ? n : fallback;
}
function tokenSeconds(name: string, fallback: number): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return /ms$/.test(v) ? n / 1000 : n;
}

export default function RingBadge({ className }: { className?: string }) {
  const pid = 'rb' + useId().replace(/:/g, '');
  const [m, setM] = useState({ fs: 44, lh: 0.83, turn: 40, still: true });
  useEffect(() => {
    setM({
      fs: tokenNum('--fs-home-mark', 44), lh: tokenNum('--lh-home-mark', 0.83), turn: tokenSeconds('--t-home-ring', 40),
      still: window.matchMedia('(prefers-reduced-motion: reduce)').matches
    });
  }, []);
  const R = RING_R, y1 = -((m.lh - LINEAL_CAP) * m.fs) / 2;
  return (
    <svg className={'ring-badge' + (className ? ' ' + className : '')} viewBox="-112 -112 224 224" aria-hidden focusable="false">
      <path id={pid} d={`M ${-R} 0 A ${R} ${R} 0 1 1 ${R} 0 A ${R} ${R} 0 1 1 ${-R} 0`} fill="none" />
      <g className="ring-badge-text">
        {!m.still && <animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur={`${m.turn}s`} repeatCount="indefinite" />}
        {[0, 1].map((k) => (
          <text key={k}><textPath href={`#${pid}`} startOffset={k * Math.PI * R}>{RING_SUB}</textPath></text>
        ))}
      </g>
      <text className="ring-badge-mark" textAnchor="middle" transform="rotate(-15)">
        <tspan x="0" y={y1}>Mega</tspan>
        <tspan x="0" y={y1 + m.lh * m.fs}>Font</tspan>
      </text>
    </svg>
  );
}
