import { cloneElement, isValidElement, useEffect, useId, useMemo, useRef, type CSSProperties, type ReactElement, type ReactNode } from 'react';
import { AMP, DRIFT, T1, T2, photoWave, type Circle, type Cloud } from '../lib/cloud';
import TreeArt from './TreeArt';
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
 * ── 나무 (당당한, 2026-09-28, 09-30 사진으로) ─────────────────────────
 * 사진에서 뗀 한 그루(cloud.ts · treeFor)를 캔버스에 그린다(TreeArt · treeGL) — 칠 한 색, 덩이 밑 그늘은 빗금으로
 * 오려 내고, 바람에 잎이 살랑이고 수관이 흔들린다. 상자는 수관과 줄기 윗부분이고 줄기는 상자 밖으로 바닥까지 이어진다 —
 * 벽은 바닥에 세우고 폰은 무대 밑이 자른다. 행간은 1.1이라 글 상자에 --cloud-lh로 내려 준다(app.css). 사선 · 세로쓰기는
 * 한 자씩 자리를 받는다(layout.glyphs).
 *
 * ── 띠 구름 (다정한, 2026-09-30) ───────────────────────────────────────
 * 사진에서 딴 윤곽 하나(cloud.ts · photoFor)를 한 색으로 칠한다 — 번지지도 숨 쉬지도 않는다. 상자는 몸통이고
 * 꼬리는 상자 밖으로 그려진다(.cloud-art는 overflow: visible — 나무의 밑동과 같다). 행간 1.3 · 글은 가운데.
 * 봉우리가 부풀고 꼬리가 흐른다(cloud.ts · photoWave, 2026-09-30) — FRAME_MS마다 윤곽을 다시 그린다. 움직임을 끈 사람 ·
 * still(4/5 설명 장의 시연)에서는 멈춘다.
 * 09-28의 구슬 구름(한 크기 구슬 · 곁의 작은 구름)은 걷었다.
 *
 * ── 새 · 박쥐 (유머있는, 2026-09-29) ───────────────────────────────────
 * 말투가 가른다(cloud.ts · creatureFor) — 귀여운은 새(원 둘 · 부리 세모 · 꼬리 띠), 시니컬한은 박쥐(윤곽 하나).
 * 도형을 그대로 겹쳐 한 색으로 칠한다 — 번지지도 숨 쉬지도 않는다. pose로 자세를 고른다: 안 주면 폰의 자세(rest),
 * 벽은 sit · fly를 줄 수 있다(없는 자세면 rest). 박쥐의 매달림은 형상만 뒤집혀 있고 글은 바로 선다.
 */
const K = 100;
/** 픽셀 구름을 다시 찍는 간격. 12fps면 계단이 옮겨 가는 것이 보이되 파이에 짐이 안 된다 */
const PIXEL_MS = 80;
/** 띠 구름의 윤곽을 다시 그리는 간격 — 30fps. 봉우리가 6초에 한 번 부풀 만큼 느려서 더 촘촘할 까닭이 없고, 벽의 구름 여럿을 파이가 그린다 */
const FRAME_MS = 33;

/** --t-hold(초) — 단위를 보고 읽는다: 빌드가 700ms를 .7s로 고쳐 적는다(WallSimulation · hold, PhaseColor · tokenMs와 같은 까닭) */
function holdS(): number {
  if (typeof document === 'undefined') return 0.7;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--t-hold').trim();
  return (parseFloat(v) || 0) * (v.endsWith('ms') ? 0.001 : 1) || 0.7;
}

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
  /** 새 · 박쥐의 자세 — 안 주면 폰의 자세(rest). 벽이 앉음(sit, 새만) · 날기(fly)를 고른다 */
  pose?: 'rest' | 'sit' | 'fly';
  /** 글을 상자 한가운데로 — 띠 구름을 통째로 옮겨 글의 가운데를 상자의 가운데에 맞춘다(폰 미리보기 4/5 · 5/5).
      구름의 실루엣과 별개로 글이 딱 중앙에 있게(2026-09-30, 디자이너). 띠 구름만 — 나무는 글이 머리에 서는 것이 모양의 뜻이다 */
  centerText?: boolean;
  /** 나무를 무대 바닥에 세운다(폰 4/5 — 무대가 grid라야 한다). 밑동이 바닥에 닿게 올리고, 나무가 무대보다 크면 꼭대기를 무대 위
      끝에 맞추고 줄기를 바닥에서 자른다(2026-10-01, 디자이너 — '무대 바닥에 서고 줄기는 잘림'). 나무가 글에 맞춰 작아지자
      무대 가운데에 놓인 나무가 공중에 떴다 */
  floor?: boolean;
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

export default function CloudBubble({ cloud, box, side, color, still, className, style, pose, centerText, floor, children }: Props) {
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
    if (pr.edge === 'pixel' || cloud.stone || cloud.tree || cloud.photo || cloud.creature) return null;
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
  const tree = cloud.tree, photo = cloud.photo;
  const photoD = useMemo(() => (photo ? 'M' + photo.pts.map((p) => `${(p[0] * K).toFixed(1)},${(p[1] * K).toFixed(1)}`).join('L') + 'Z' : ''), [photo]);
  // 띠 구름의 움직임 — 요소를 직접(React 바깥). 시작 박자는 구름마다(글 상자 · 띠 번호에서) 달라 벽의 구름이 한 박자로 안 움직인다
  const photoRef = useRef<SVGPathElement>(null);
  const motion = pr.photo?.motion;
  useEffect(() => {
    const el = photoRef.current;
    if (!photo || !motion || quiet || !el) return;
    const phase = (cloud.text.w * 7.31 + cloud.text.h * 3.17 + photo.id.charCodeAt(photo.id.length - 1) * 1.7) % (Math.PI * 2);
    const wave = photoWave(photo, cloud.w, motion, phase), hold = holdS(), t0 = performance.now();
    let last = -Infinity, raf = 0;
    const tick = (now: number) => {
      if (now - last >= FRAME_MS) {
        last = now;
        el.setAttribute('d', 'M' + wave((now - t0) / 1000, hold).map((p) => `${(p[0] * K).toFixed(1)},${(p[1] * K).toFixed(1)}`).join('L') + 'Z');
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [photo, motion, quiet, cloud.w, cloud.text.w, cloud.text.h]);
  const creature = cloud.creature, shape = creature ? (pose && creature.poses[pose]) || creature.poses.rest : null;
  // 나무 · 구슬 구름은 글 배치를 형상이 정한다(cloud.ts의 layout — 다시 나눈 줄 · 줄마다 자간 · 한 자씩의 자리).
  // 줄 맞춤은 가운데 — 나무 · 뭉게구름은 가운데 맞춘 줄을 품게 지었다
  const lay = cloud.layout;
  const kids = (tree || photo || lay) && isValidElement(children)
    ? cloneElement(children as ReactElement<{ align?: string; text?: string; lineTrack?: readonly number[]; glyphs?: unknown; glyphBox?: unknown }>, {
        align: lay?.align ?? 'center',
        ...(lay?.lines ? { text: lay.lines.join('\n') } : {}),
        ...(lay?.track ? { lineTrack: lay.track } : {}),
        ...(lay?.glyphs && lay.box ? { glyphs: lay.glyphs, glyphBox: lay.box } : {})
      })
    : children;
  return (
    <div
      className={'cloud-bubble' + (tree ? ' is-tree' : '') + (photo ? ' is-photo' : '') + (className ? ' ' + className : '')}
      style={{ width: `calc(${side} * ${box.w.toFixed(4)})`, height: `calc(${side} * ${box.h.toFixed(4)})`, ...(pr.lh ? { '--cloud-lh': pr.lh } : {}),
        ...(floor && tree ? { alignSelf: 'end', marginBottom: `max(0px, min(calc(${side} * ${((tree.full - cloud.h) * box.unit).toFixed(4)}), calc(100cqh - ${side} * ${box.h.toFixed(4)})))` } : {}),
        ...(centerText && photo ? { transform: `translate(${((0.5 - (t.x + t.w / 2) / cloud.w) * 100).toFixed(3)}%, ${((0.5 - (t.y + t.h / 2) / cloud.h) * 100).toFixed(3)}%)` } : {}), ...style } as CSSProperties}
    >
      {tree && <TreeArt cloud={cloud} unit={box.unit} color={color} quiet={quiet} hold={holdS()} />}
      {!tree && <svg className="cloud-art" viewBox={`0 0 ${W.toFixed(1)} ${H.toFixed(1)}`} aria-hidden="true" focusable="false">
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
        ) : photo ? (
          <path ref={photoRef} d={photoD} fill={color} />
        ) : shape ? (
          <g fill={color}>
            {shape.polys.map((P, i) => <path key={'p' + i} d={'M' + P.map((p) => `${(p[0] * K).toFixed(1)},${(p[1] * K).toFixed(1)}`).join('L') + 'Z'} />)}
            {shape.discs.map((d, i) => <circle key={'d' + i} cx={(d.cx * K).toFixed(1)} cy={(d.cy * K).toFixed(1)} r={(d.r * K).toFixed(1)} />)}
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
      </svg>}
      {/* 글은 제 자리에 앉는다 — 구름이 비대칭이라 한가운데가 아니다 */}
      <div className="cloud-text" style={{
        left: `${((t.x / cloud.w) * 100).toFixed(3)}%`, top: `${((t.y / cloud.h) * 100).toFixed(3)}%`,
        width: `${((t.w / cloud.w) * 100).toFixed(3)}%`, height: `${((t.h / cloud.h) * 100).toFixed(3)}%`,
        // 걸기 — 글 상자를 제 가운데로 돌려 곧은 윗변과 나란히 둔다(cloud.ts stoneFor)
        ...(lay?.rotate ? { transform: `rotate(${lay.rotate.toFixed(4)}rad)` } : {})
      }}>{kids}</div>
    </div>
  );
}
