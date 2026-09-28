import { cloneElement, isValidElement, useEffect, useId, useMemo, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
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
 *
 * ── 돌 (차분한, 2026-09-27) ───────────────────────────────────────────
 * 원이 아니라 다각형 하나(cloud.ts · stoneFor). 번지지도 숨 쉬지도 않는다.
 * 오른쪽 아래 빗금은 칠하지 않고 **오려 낸다**(mask) — 뒤에 있는 것이 그대로
 * 비쳐 벽에서도 폰에서도 '틈'이 된다. 시스템이 새 색을 만들지 않는다.
 *
 * ── 나무 (당당한, 2026-09-28) ─────────────────────────────────────────
 * 층(사다리꼴 또는 양 끝이 둥근 층) · 작은 머리 · 기둥(cloud.ts · treeFor). 번지지도 숨 쉬지도
 * 않는다. 기둥의 세로 줄무늬는 칠하지 않고 **오려 낸다**(mask) — 돌의 빗금과 같은 방법이라 새 색이
 * 없다. 기둥을 먼저 그리고 머리를 위에 얹어, 머리 밑에 물린 기둥 끝이 안 보인다. 행간은 1.1이라
 * 글 상자에 --cloud-lh로 내려 준다(app.css). 정렬 고르기가 아직이라 글은 가운데로 세운다.
 *
 * ── 구슬 구름 (다정한, 2026-09-28) ─────────────────────────────────────
 * 한 크기 구슬(cloud.ts · beadFor)을 그대로 찍는다 — 번짐 필터도 숨도 없다. 알끼리 조금씩 겹쳐
 * 윤곽이 구슬 줄로 읽힌다. 곁의 작은 구름은 제 묶음(.cloud-let)이라 벽에서 따로 오르내릴 수 있다.
 * 행간 1.1 · 글은 가운데(나무와 같다).
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
  /** 나무의 기둥을 상자 밑으로 더 잇는다 — 길이는 CSS 변수 --trunk-ext(벽이 나무 키로 정한다) */
  trunkExt?: boolean;
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

/** 돌의 윤곽 — 곧은 변, 모서리만 r만큼 굴린다. 변을 따라 물러난 두 점을 꼭짓점을 조절점으로 잇는다 */
function stonePath(pts: readonly (readonly [number, number])[], r: number): string {
  const f = (v: number) => (v * K).toFixed(1);
  const seg = pts.map((C, i) => {
    const P = pts[(i - 1 + pts.length) % pts.length], N = pts[(i + 1) % pts.length];
    const l1 = Math.hypot(P[0] - C[0], P[1] - C[1]), l2 = Math.hypot(N[0] - C[0], N[1] - C[1]);
    const d = Math.min(r, l1 * 0.45, l2 * 0.45);
    return [[C[0] + ((P[0] - C[0]) / l1) * d, C[1] + ((P[1] - C[1]) / l1) * d], C, [C[0] + ((N[0] - C[0]) / l2) * d, C[1] + ((N[1] - C[1]) / l2) * d]] as const;
  });
  let d = `M${f(seg[0][2][0])},${f(seg[0][2][1])}`;
  for (let i = 1; i <= seg.length; i++) {
    const [A, C, B] = seg[i % seg.length];
    d += `L${f(A[0])},${f(A[1])}Q${f(C[0])},${f(C[1])} ${f(B[0])},${f(B[1])}`;
  }
  return d + 'Z';
}

function prefersStill(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function CloudBubble({ cloud, box, side, color, still, className, style, trunkExt, children }: Props) {
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
    if (pr.edge === 'pixel' || cloud.stone || cloud.tree || cloud.beads) return null;
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
  const stone = cloud.stone, hatch = pr.stone?.hatch;
  const stoneD = useMemo(() => (stone ? stonePath(stone.pts, pr.stone?.round ?? 0) : ''), [stone, pr.stone?.round]);
  const tree = cloud.tree, beads = cloud.beads;
  const pt = (p: readonly [number, number]) => `${(p[0] * K).toFixed(1)},${(p[1] * K).toFixed(1)}`;
  const bead = (p: readonly [number, number], i: number) => <circle key={i} cx={(p[0] * K).toFixed(1)} cy={(p[1] * K).toFixed(1)} r={((beads?.r ?? 0) * K).toFixed(1)} />;
  // 기둥의 끝(상자 높이의 비율) — 벽에서 이어 붙인 기둥이 여기서 시작하고, 펴지며 등장할 때 축이 그 밑이다
  const trunkEnd = tree ? `${(((tree.trunk.y + tree.trunk.h) / cloud.h) * 100).toFixed(3)}%` : undefined;
  // 나무 · 구슬 구름은 글 배치를 형상이 정한다(cloud.ts의 layout — 다시 나눈 줄 · 줄마다 자간 · 한 자씩의 자리).
  // 줄 맞춤은 가운데 — 균등 배분 · 사다리꼴은 줄이 이미 틀을 채웠고, 달걀 · 뭉게구름은 가운데 맞춘 줄을 품게 지었다
  const lay = cloud.layout;
  const kids = (tree || beads) && isValidElement(children)
    ? cloneElement(children as ReactElement<{ align?: string; text?: string; lineTrack?: readonly number[]; glyphs?: unknown; glyphBox?: unknown }>, {
        align: 'center',
        ...(lay?.lines ? { text: lay.lines.join('\n') } : {}),
        ...(lay?.track ? { lineTrack: lay.track } : {}),
        ...(lay?.glyphs && lay.box ? { glyphs: lay.glyphs, glyphBox: lay.box } : {})
      })
    : children;
  return (
    <div
      className={'cloud-bubble' + (tree ? ' is-tree' : '') + (beads ? ' is-bead' : '') + (className ? ' ' + className : '')}
      style={{ width: `calc(${side} * ${box.w.toFixed(4)})`, height: `calc(${side} * ${box.h.toFixed(4)})`, ...(pr.lh ? { '--cloud-lh': pr.lh } : {}), ...(trunkEnd ? { '--trunk-end': trunkEnd } : {}), ...style } as CSSProperties}
    >
      <svg className="cloud-art" viewBox={`0 0 ${W.toFixed(1)} ${H.toFixed(1)}`} aria-hidden="true" focusable="false">
        {stone && !(hatch?.on && stone.hatch.length) ? (
          /* 빗금이 꺼진 돌(cloud.ts · hatch.on) — 오려 낼 것 없이 면 하나 */
          <path d={stoneD} fill={color} />
        ) : stone && hatch ? (
          <>
            <defs>
              {/* 빗금 — 세로 줄 하나를 45° 돌려 ／. 마스크 안에서 검정은 '지운다'는 뜻이다 */}
              <pattern id={filterId + 'h'} patternUnits="userSpaceOnUse" width={hatch.gap * K} height={hatch.gap * K} patternTransform="rotate(45)">
                <rect width={hatch.width * K} height={hatch.gap * K} fill="black" />
              </pattern>
              <mask id={filterId + 'm'} maskUnits="userSpaceOnUse" x="0" y="0" width={W.toFixed(1)} height={H.toFixed(1)}>
                <rect width={W.toFixed(1)} height={H.toFixed(1)} fill="white" />
                <g fill={`url(#${filterId}h)`}>
                  {stone.hatch.map((q, i) => (
                    <polygon key={i} points={q.map((p) => `${(p[0] * K).toFixed(1)},${(p[1] * K).toFixed(1)}`).join(' ')} />
                  ))}
                </g>
              </mask>
            </defs>
            <path d={stoneD} fill={color} mask={`url(#${filterId}m)`} />
          </>
        ) : tree ? (
          <>
            <defs>
              {/* 기둥의 세로 줄무늬 — 짝수 번째 줄을 검정으로 = 오린다. 벽 바탕이 그대로 비친다 */}
              <mask id={filterId + 't'} maskUnits="userSpaceOnUse" x="0" y="0" width={W.toFixed(1)} height={H.toFixed(1)}>
                <rect width={W.toFixed(1)} height={H.toFixed(1)} fill="white" />
                {Array.from({ length: Math.floor(tree.trunk.stripes / 2) }, (_, i) => {
                  const sw = tree.trunk.w / tree.trunk.stripes;
                  return <rect key={i} x={((tree.trunk.x + (2 * i + 1) * sw) * K).toFixed(1)} y={(tree.trunk.y * K).toFixed(1)} width={(sw * K).toFixed(1)} height={(tree.trunk.h * K).toFixed(1)} fill="black" />;
                })}
              </mask>
            </defs>
            <g fill={color}>
              <rect x={(tree.trunk.x * K).toFixed(1)} y={(tree.trunk.y * K).toFixed(1)} width={(tree.trunk.w * K).toFixed(1)} height={(tree.trunk.h * K).toFixed(1)} mask={`url(#${filterId}t)`} />
              {tree.tiers.map((q, i) => q.kind === 'trap'
                ? <polygon key={i} points={q.pts.map(pt).join(' ')} />
                : <rect key={i} x={(q.x * K).toFixed(1)} y={(q.y * K).toFixed(1)} width={(q.w * K).toFixed(1)} height={(q.h * K).toFixed(1)} rx={(q.r * K).toFixed(1)} />)}
              {tree.cap.kind === 'spire'
                ? <polygon points={tree.cap.pts.map(pt).join(' ')} />
                : <ellipse cx={(tree.cap.cx * K).toFixed(1)} cy={(tree.cap.cy * K).toFixed(1)} rx={(tree.cap.rx * K).toFixed(1)} ry={(tree.cap.ry * K).toFixed(1)} />}
            </g>
          </>
        ) : beads ? (
          <g fill={color}>
            <g className="cloud-body">{beads.body.map(bead)}</g>
            {beads.lets.map((l, i) => <g key={i} className={`cloud-let l${i}`}>{l.map(bead)}</g>)}
          </g>
        ) : (
          <>
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
          </>
        )}
      </svg>
      {/* 벽의 나무 — 기둥을 바닥까지 잇는다. 줄무늬는 SVG의 기둥과 같다(칠 · 비움 · 칠 …, 비운 줄로 바탕이 비친다) */}
      {tree && trunkExt && (
        <i className="cloud-trunk-ext" aria-hidden="true" style={{
          left: `${((tree.trunk.x / cloud.w) * 100).toFixed(3)}%`, width: `${((tree.trunk.w / cloud.w) * 100).toFixed(3)}%`, top: trunkEnd,
          background: `linear-gradient(to right, ${Array.from({ length: tree.trunk.stripes }, (_, i) =>
            `${i % 2 ? 'transparent' : color} ${((i / tree.trunk.stripes) * 100).toFixed(2)}% ${(((i + 1) / tree.trunk.stripes) * 100).toFixed(2)}%`).join(', ')})`
        }} />
      )}
      {/* 글은 제 자리에 앉는다 — 구름이 비대칭이라 한가운데가 아니다 */}
      <div className="cloud-text" style={{
        left: `${((t.x / cloud.w) * 100).toFixed(3)}%`, top: `${((t.y / cloud.h) * 100).toFixed(3)}%`,
        width: `${((t.w / cloud.w) * 100).toFixed(3)}%`, height: `${((t.h / cloud.h) * 100).toFixed(3)}%`
      }}>{kids}</div>
    </div>
  );
}
