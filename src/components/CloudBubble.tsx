import { useEffect, useId, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { AMP, DRIFT, T1, T2, type Circle, type Cloud } from '../lib/cloud';
import type { Boxed } from '../lib/fit';

/**
 * 구름 하나 — 배경과 그 안의 글.
 *
 * 자리는 cloud.ts가 u 단위로 정해 두었고, 여기서는 그것을 그리고 숨 쉬게 한다.
 * SpeechBubble이 그랬듯 치수는 비율로 받는다(box · side) — 창이 바뀌어도 CSS가
 * 따라가고 JS를 안 거친다. 원과 번짐은 u당 100인 화판에 그리고 viewBox가
 * 줄인다. 번짐 반경도 화판 단위라 같이 줄어든다 — 폰의 13px 글자와 벽의
 * 180px 글자가 같은 모양이 되는 이유다.
 *
 * ── 숨 ────────────────────────────────────────────────────────────────
 * 글을 덮는 원은 제자리에서 **커지기만** 한다. 놓인 반지름이 바닥이라 어느
 * 순간에도 여백 0.7u가 안 깨진다. 부풀기는 자리(x)에 위상을 건 파동(T1)에
 * 주기가 다른 느린 결(T2)을 더한 것이고, 조각만 자리를 옮긴다. 값은
 * cloud.ts 상단, 근거는 design/cloud-rules.md.
 *
 * 세 어휘(뾰족·매끈·뭉게)는 SMIL이 원을 부풀리고, 갈래는 제 덩이 중심 기준
 * 배율로 따라간다. 픽셀 구름은 프레임마다 다시 찍는다 — 격자에 찍힌 것은
 * 부풀릴 수 없어서, 부푼 원을 다시 격자에 놓는다.
 */
const K = 100;
/** 픽셀 구름을 다시 찍는 간격. 12fps면 계단이 옮겨 가는 것이 보이되 파이에 짐이 안 된다 */
const PIXEL_MS = 80;

interface Props {
  cloud: Cloud;
  /** 최대 영역 한 변에 대한 비율 (fit.ts) */
  box: Boxed;
  /** 그 한 변을 가리키는 CSS 길이 — 'var(--echo-side)' 같은 것 */
  side: string;
  color: string;
  /** 숨을 멈춘다. 모션을 끈 사람에게, 그리고 파이가 못 따라올 때의 대비 */
  still?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const SPLINE = '0.42 0 0.58 1;0.42 0 0.58 1';

/** 0 → A → 0을 사인처럼. begin을 음수로 주면 그만큼 진행된 채 시작한다 */
function Pulse({ attr, amp, dur, phase }: { attr: string; amp: number; dur: number; phase: number }) {
  return <animate attributeName={attr} values={`0;${amp.toFixed(2)};0`} keyTimes="0;0.5;1" dur={`${dur}s`}
    begin={`${(-phase * dur).toFixed(2)}s`} calcMode="spline" keySplines={SPLINE} additive="sum" repeatCount="indefinite" />;
}
/** 갈래가 제 덩이를 따라 부푸는 배율. 덩이 중심이 원점이라 scale이 곧 밖으로 미는 것이다 */
function Swell({ ratio, dur, phase }: { ratio: number; dur: number; phase: number }) {
  return <animateTransform attributeName="transform" type="scale" values={`1;${(1 + ratio).toFixed(4)};1`} keyTimes="0;0.5;1"
    dur={`${dur}s`} begin={`${(-phase * dur).toFixed(2)}s`} calcMode="spline" keySplines={SPLINE} additive="sum" repeatCount="indefinite" />;
}

/** 부풀기 한 결 — SMIL의 spline과 같은 꼴을 JS로. 픽셀 구름이 쓴다 */
const bump = (phase: number) => (1 - Math.cos(phase * Math.PI * 2)) / 2;
function at(c: Circle, sec: number): { x: number; y: number; r: number } {
  const r = c.r + c.r * AMP * 0.7 * bump(sec / T1 + c.p1) + c.r * AMP * 0.3 * bump(sec / T2 + c.p2);
  if (c.kind !== 'sat') return { x: c.x, y: c.y, r };
  return { x: c.x + DRIFT * c.sx * bump(sec / (T1 * 1.3) + c.p3), y: c.y + 0.7 * DRIFT * c.sy * bump(sec / (T2 * 0.9) + c.p4), r };
}

/** 원들의 합집합을 격자에 찍는다. 칸의 한가운데가 원 + 0.55칸 안이면 채운다 — 걸친 칸이 비면 여백에 빈 픽셀이 난다 */
function pixelRects(cloud: Cloud, sec: number | null): string {
  const cell = (cloud.persona.cell ?? 0.5) * K;
  const cs = cloud.circles.map((c) => (sec === null ? c : at(c, sec)));
  const W = cloud.w * K, H = cloud.h * K, grow = 0.55 * cell;
  let out = '';
  for (let gy = 0; gy < H; gy += cell) {
    const my = gy + cell / 2;
    for (let gx = 0; gx < W; gx += cell) {
      const mx = gx + cell / 2;
      for (const c of cs) {
        const r = c.r * K + grow;
        const dx = c.x * K - mx, dy = c.y * K - my;
        if (dx * dx + dy * dy <= r * r) { out += `<rect x="${gx.toFixed(0)}" y="${gy.toFixed(0)}" width="${cell}" height="${cell}"/>`; break; }
      }
    }
  }
  return out;
}

function prefersStill(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function CloudBubble({ cloud, box, side, color, still, className, style, children }: Props) {
  const filterId = 'cloud' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const quiet = still || prefersStill();
  const W = cloud.w * K, H = cloud.h * K;
  const pr = cloud.persona;
  const pixelRef = useRef<SVGGElement>(null);

  // 픽셀 구름 — 격자는 SMIL로 못 부풀리니 프레임마다 다시 찍는다
  useEffect(() => {
    const g = pixelRef.current;
    if (!g) return;
    if (quiet) { g.innerHTML = pixelRects(cloud, null); return; }
    const t0 = performance.now();
    let last = -Infinity, raf = 0;
    const tick = (now: number) => {
      if (now - last >= PIXEL_MS) { last = now; g.innerHTML = pixelRects(cloud, (now - t0) / 1000); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cloud, quiet]);

  const art = useMemo(() => {
    if (pr.edge === 'pixel') return null;
    return (
      <>
        {cloud.circles.map((c, i) => (
          <circle key={i} cx={(c.x * K).toFixed(1)} cy={(c.y * K).toFixed(1)} r={(c.r * K).toFixed(1)}>
            {!quiet && <>
              <Pulse attr="r" amp={c.r * K * AMP * 0.7} dur={T1} phase={c.p1} />
              <Pulse attr="r" amp={c.r * K * AMP * 0.3} dur={T2} phase={c.p2} />
              {c.kind === 'sat' && <>
                <Pulse attr="cx" amp={DRIFT * K * c.sx} dur={T1 * 1.3} phase={c.p3} />
                <Pulse attr="cy" amp={0.7 * DRIFT * K * c.sy} dur={T2 * 0.9} phase={c.p4} />
              </>}
            </>}
          </circle>
        ))}
        {cloud.spikes.map((s, i) => {
          const c = cloud.circles[s.lobe];
          return (
            <g key={'s' + i} transform={`translate(${(c.x * K).toFixed(1)} ${(c.y * K).toFixed(1)})`}>
              <polygon points={s.pts.map((p) => `${(p[0] * K).toFixed(1)},${(p[1] * K).toFixed(1)}`).join(' ')} />
              {!quiet && <>
                <Swell ratio={AMP * 0.7} dur={T1} phase={c.p1} />
                <Swell ratio={AMP * 0.3} dur={T2} phase={c.p2} />
              </>}
            </g>
          );
        })}
      </>
    );
  }, [cloud, pr.edge, quiet]);

  const blur = pr.edge === 'pixel' ? (pr.cell ?? 0.5) * K * 0.08 : pr.blur * K;
  const t = cloud.text;
  return (
    <div
      className={'cloud-bubble' + (className ? ' ' + className : '')}
      style={{ width: `calc(${side} * ${box.w.toFixed(4)})`, height: `calc(${side} * ${box.h.toFixed(4)})`, ...style }}
    >
      <svg className="cloud-art" viewBox={`0 0 ${W.toFixed(1)} ${H.toFixed(1)}`} aria-hidden="true" focusable="false">
        <defs>
          {/* 번지고(feGaussianBlur) 알파를 문턱으로 자른다(feColorMatrix) — 겹친 자리는
              채우고 나머지는 지운다. 2026-09-09의 메타볼 필터 그대로다. 번진 만큼
              바깥으로 자리를 내준다 — 기본 10%로는 살찐 원이 상자 밖에서 잘린다. */}
          <filter id={filterId} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
            <feGaussianBlur in="SourceGraphic" stdDeviation={blur.toFixed(2)} result="b" />
            <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -11" />
          </filter>
        </defs>
        <g filter={`url(#${filterId})`} fill={color}>
          {pr.edge === 'pixel' ? <g ref={pixelRef} /> : art}
        </g>
      </svg>
      {/* 글은 제 자리에 앉는다 — 구름이 비대칭이라 한가운데가 아니다 */}
      <div className="cloud-text" style={{
        left: `${((t.x / cloud.w) * 100).toFixed(3)}%`, top: `${((t.y / cloud.h) * 100).toFixed(3)}%`,
        width: `${((t.w / cloud.w) * 100).toFixed(3)}%`, height: `${((t.h / cloud.h) * 100).toFixed(3)}%`
      }}>{children}</div>
    </div>
  );
}
