import { memo, useEffect, useMemo, useRef } from 'react';
import VoiceBubble from './VoiceBubble';
import { RF, arrange, arrangeOf, gapsOf, kindOf, modulesAt, tailOf, type Dot, type Item, type Kind, type Tail } from '../lib/aggregate';
import { paintBody, placeGlyphs } from '../lib/dotPaint';
import { turn } from '../lib/sky';
import { foldLines } from '../lib/fit';
import { fontMap } from '../lib/palettes';
import { colorsOf } from '../lib/messageStyle';
import { tokenS } from '../lib/motion';
import { CLIP_H, EYE_SMILE, EYE_WHITE, FOOT_Y, HEAD, SIT, VIEW } from '../character/walker';
import { REST_Y } from '../character/HomeCharacter';
import type { Align, ToneState } from '../types';

/**
 * 08 완료의 하늘(2026-10-20, 결정 13 — 견본 kv/done-08.html의 가운데 '1.2배') — '메아리처럼 화면을 맴돕니다'를 그림으로. 화면의 짜임은
 * 그대로 두고 하늘만 더한다.
 * - 회색 지난 말 넷: 부채꼴 호(가로 반지름 = 중심 상자 폭 × 0.625 · 세로 × 1.05, 212° ~ 328°) 위에 앉아 결을 따라 3분의 1 기울고(벽의
 *   결정 9와 같다), 꼬리는 모두 호의 중심을 가리킨다. --grey-200 · 글자 없음(홈과 같다), 성격을 섞어 꼭대기 양옆으로 번갈아 바깥으로.
 *   0.6초에 나타나 하늘 전체가 호를 따라 2.5°/초로 맴돌고, 양 끝 바깥 15°를 지나면 반대쪽에서 다시 — 끝 12° 안에서 옅어진다. ±1.5px 둥실.
 * - 내 말(결정 32, 2026-10-20 디자이너 — "마지막 화면에 메가폰트를 더 이상 등장시키지 않는다. 만든 말풍선 위에 사람들이 웃으면서 앉아
 *   있게", 견본 out-08sit/v-2-fix-s): 쓴 글 · 성격 · 모양 · 색 짝 그대로(5/5와 같은 그리기 — 점은 캔버스, 글자는 VoiceBubble), 가로
 *   가운데 · 몸통 폭 = 화면 폭의 88%, 꼬리는 짧게(옛 길이 2.25u) 아래로. 그 위에 벽의 작은 사람 둘(빨강 왼쪽 · 하늘 오른쪽, walker.ts SIT ·
 *   웃는 눈)이 바깥을 보고 앉는다 — 키 = 한 줄 몸통 높이 × 0.9, 자리 = 몸통 폭의 22.5% · 77.5%, 키의 10%만큼 몸통 윗선에 걸쳐. 두 발만
 *   벽처럼 까딱. 무리(머리 꼭대기 ~ 꼬리 끝)의 가운데 = 회색 말이 내려오는 가장 낮은 곳과 규칙 목록 윗선 사이의 가운데 — 그 칸에 제
 *   크기로 들지 않으면(긴 글 · 낮은 화면) 줄이지 않고 규칙 위에 붙어 메아리 띠까지 올라간다(회색 말이 그 뒤로 지나간다 — 작은 화면,
 *   디자이너 "메아리 띠에 겹쳐도 됨"), 부제까지도 모자라면 그때만 줄인다. 말 · 사람 · 꼬리가 한 덩어리로 위아래로만 두둥실(홈 메가폰트
 *   charFloat의 결 — 5.2초 한 바퀴, 폭 ±무리 높이의 2%). 0.6초에 나타난다.
 * 움직임 줄이기면 다 앉은 모습 그대로.
 *
 * 메가폰트는 08에서 빠졌다(결정 32). 호의 중심은 그것이 서던 상자 그대로 셈한다(HomeCharacter의 제자리 — 폭 min(0.7W, 272) · 가운데
 * (W/2, 높이의 REST_Y), 단 규칙 목록 위 24px에서 상자 아래 반(폭 × 0.527, 옆모습)이 걸리지 않게) — 회색 말이 지금 자리 그대로 돈다.
 */
const ARC = { rx: 0.625, ry: 1.05, a0: 212, a1: 328, tilt: 1 / 3, u: 0.059, me: 1.2, gap: 1.2, over: 15, edge: 12, omega: 2.5, rest: 0.6 };
/** 호의 중심 상자 — 폭(화면 폭의 몫 · 상한 px) · 규칙 목록과 띄움(px) · 상자 아래 반(폭의 몫) */
const ANCHOR = { w: 0.7, max: 272, gap: 24, half: 0.527 };
/** 나타나기(초) · 회색 말 둥실(px) · 다시 그리는 간격(초) */
const MOVE = { appear: 0.6, bob: 1.5, dt: 0.033 };
/** 내 말과 앉은 두 사람 — 몸통 폭(화면 폭의 몫) · 꼬리 길이 상한(u) · 키(한 줄 몸통 높이의 몫) · 자리(몸통 폭의 몫) · 걸침(키의 몫) ·
 *  두둥실(한 바퀴 초 — app.css charFloat · 폭은 무리 높이의 몫) · 회색 말 · 규칙 목록과 띄움(px) */
const ME = { w: 0.88, tail: 2.25, h: 0.9, seats: [0.225, 0.775], sink: 0.1, float: 5.2, amp: 0.02, gap: 12 };
/** 사람 그림의 판 — walker.ts 좌표(견본과 같다). 앉으면 몸이 SIT.drop만큼 내려와 엉덩이가 FOOT_Y − 4에 닿는다 — 앉은 키 = CLIP_H */
const VB = { x: -140, y: -20, w: 600, h: 600 }, SEAT_Y = FOOT_Y - 4;
/** 회색 지난 말 — 성격 · 글자 수(견본: 다정 4 · 차분 5 · 유머 3 · 당당 4) */
const GREYS: [string, number][] = [['doran', 4], ['chabun', 5], ['deulseok', 3], ['ttoryeot', 4]];
const PEOPLE = ['--brand-main', '--char-cyan'];
const clamp = (k: number) => Math.min(1, Math.max(0, k));

type Msg = { kd: Kind; items: Item[]; gaps: Dot[]; box: [number, number, number, number]; ph: number; me: boolean };
function msgOf(lines: string[], font: string | undefined, align: Align | undefined, me: boolean, ph: number): Msg {
  const kd = kindOf(font), items = arrange(lines, arrangeOf(font, align), kd), gaps = gapsOf(items, kd);
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const d of [...modulesAt(items, kd, 1).dots, ...gaps]) { b[0] = Math.min(b[0], d.x - RF); b[1] = Math.min(b[1], d.y - RF); b[2] = Math.max(b[2], d.x + RF); b[3] = Math.max(b[3], d.y + RF); }
  return { kd, items, gaps, box: b, ph, me };
}
/** 내 말 무리의 셈(u, 말 좌표) — 꼬리 · 두 사람의 키 · 엉덩이 자리(가로, 몸통 윗선 + 걸침) · 무리 위아래 */
function groupOf(m: Msg) {
  const cx = (m.box[0] + m.box[2]) / 2, tail: Tail = tailOf(m.items, m.kd, [cx, m.box[3] + 40], ME.tail);
  const one = msgOf(['가'], undefined, 'center', false, 0), h = ME.h * (one.box[3] - one.box[1]) * (m.kd.k / one.kd.k), half = (h * HEAD.r) / CLIP_H;
  const dots = [...modulesAt(m.items, m.kd, 1).dots, ...m.gaps];
  const seats = ME.seats.map((f) => {
    const x = m.box[0] + f * (m.box[2] - m.box[0]), near = dots.filter((d) => Math.abs(d.x - x) <= half);
    return [x, Math.min(...(near.length ? near : dots).map((d) => d.y)) - RF + ME.sink * h] as [number, number];
  });
  const top = Math.min(...seats.map(([, y]) => y - h)), bottom = Math.max(m.box[3], tail.tip[1] + RF);
  return { tail, h, seats, top, bottom };
}

export default function DoneSky({ text, tone }: { text?: string; tone?: ToneState | null }) {
  const cvRef = useRef<HTMLCanvasElement>(null), textRef = useRef<HTMLDivElement>(null), peopleRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => (text ? foldLines(text) : []), [text]);
  const mine = useMemo(() => (lines.length && tone ? msgOf(lines, tone.font, tone.align, true, 0.7) : null), [lines, tone]);
  const group = useMemo(() => (mine ? groupOf(mine) : null), [mine]);
  const colors = useMemo(() => (tone && text ? colorsOf({ id: 'done', text, tone, createdAt: 0 }) : null), [tone, text]);

  useEffect(() => {
    const cv = cvRef.current, ctx = cv?.getContext('2d'), frame = cv?.closest('.home-frame') as HTMLElement | null;
    if (!cv || !ctx || !frame) return;
    const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const css = getComputedStyle(document.documentElement), grey = css.getPropertyValue('--grey-200').trim(), kick = tokenS('--t-hold', 0.7) * 4;
    const greys = GREYS.map(([f, n], i) => msgOf(['가'.repeat(n)], f, 'center', false, 1.9 * i + 0.4));
    // 내 말이 앉던 호 꼭대기는 비워 둔다 — 회색 말이 메가폰트가 있던 때 짧은 글(일곱 자)의 양옆 그 자리 그대로 앉는다. 글 길이로 잡으면
    // 긴 글에선 꼭대기가 커져 회색 말이 모두 호 끝 밖으로 밀려났다(320 × 568 · 60자)
    const gapMsg = mine ? msgOf(['가'.repeat(7)], 'doran', 'center', true, 0) : null, all = gapMsg ? [gapMsg, ...greys] : greys;
    const glyphEls = () => [...(textRef.current?.querySelectorAll<HTMLElement>('.arc-glyph') ?? [])];
    const people = [...(peopleRef.current?.children ?? [])] as HTMLElement[];
    const legs = people.map((p) => [p.querySelector<SVGGElement>('[data-p="far"]'), p.querySelector<SVGGElement>('[data-p="near"]')]);
    let C: [number, number] = [0, 0], box = 0, ry = 0, seats: { m: Msg; th: number; u: number }[] = [], key = '', raf = 0, last = -Infinity;
    let me = { u: 0, ox: 0, oy: 0, amp: 0 };
    const t0 = performance.now() / 1000;

    const at = (m: Msg, u: number, th: number) => {
      const a = (th * Math.PI) / 180, rot = (ARC.tilt * (th - 270) * Math.PI) / 180;
      const [ox, oy] = turn([((m.box[0] + m.box[2]) / 2) * u, ((m.box[1] + m.box[3]) / 2) * u], rot);
      return { pos: [C[0] + ARC.rx * box * Math.cos(a) - ox, C[1] + ry * Math.sin(a) - oy] as [number, number], rot };
    };
    // 자리 — 화면 · 규칙 목록이 바뀔 때만 다시 센다
    const measure = () => {
      const fr = frame.getBoundingClientRect(), gate = frame.querySelector('.home-gate')?.getBoundingClientRect(), rules = frame.querySelector('.info-rules')?.getBoundingClientRect();
      const W = fr.width, H = fr.height, gateTop = gate ? gate.top - fr.top : H, rulesTop = rules ? rules.top - fr.top : gateTop;
      const next = `${W}|${H}|${gateTop}|${rulesTop}`;
      if (next === key) return;
      key = next;
      box = Math.min(ANCHOR.w * W, ANCHOR.max);
      C = [W / 2, Math.min(REST_Y * H, gateTop - ANCHOR.gap - ANCHOR.half * box)];
      const U = ARC.u * box, gap = ARC.gap * U, sub = frame.querySelector('.home-subtitle')?.getBoundingClientRect();
      const top = sub ? sub.bottom - fr.top + gap : 0, room = C[1] - box / 2 - top;
      const uOf = (m: Msg) => (m.me ? Math.max(U, Math.min(ARC.me * U, (0.8 * W) / (m.box[2] - m.box[0]), room / (m.box[3] - m.box[1]))) : U);
      ry = ARC.ry * box;
      if (gapMsg) ry = Math.min(ry, C[1] - top - ((gapMsg.box[3] - gapMsg.box[1]) * uOf(gapMsg)) / 2);
      const ext = (m: Msg, u: number, th: number) => { const a = (th * Math.PI) / 180; return Math.abs((m.box[2] - m.box[0]) * u * Math.sin(a)) + Math.abs((m.box[3] - m.box[1]) * u * Math.cos(a)); };
      const R = (ARC.rx * box + ry) / 2, deg = (px: number) => (px / R) * (180 / Math.PI);
      seats = [];
      let L = 270, Rr = 270, lastL: { m: Msg; u: number } | null = null, lastR: { m: Msg; u: number } | null = null, k = 0;
      for (const m of all) {
        const u = uOf(m);
        if (!lastL || !lastR) { seats.push({ m, th: 270, u }); lastL = lastR = { m, u }; continue; }
        const right = k++ % 2 === 1, prev = right ? lastR : lastL, from = right ? Rr : L, sign = right ? 1 : -1;
        let th = from + sign * deg(ext(prev.m, prev.u, from) / 2 + gap + ext(m, u, from) / 2);
        th = from + sign * deg(ext(prev.m, prev.u, from) / 2 + gap + ext(m, u, th) / 2);
        // 호 끝(a0 ~ a1) 밖이면 앉히지 않는다 — 회색 말이 하나 준다. 끝 밖(200° · 341°)에 앉아 흐린 채 시작했다(2026-10-20 점검)
        if (th < ARC.a0 || th > ARC.a1) continue;
        seats.push({ m, th, u });
        if (right) { Rr = th; lastR = { m, u }; } else { L = th; lastL = { m, u }; }
      }
      if (!mine || !group) return;
      // 회색 말이 내려오는 가장 낮은 곳 — 다 보이는 동안(양 끝 12° 안쪽까지) 기운 몸통 네 귀 · 꼬리 끝을 2°마다 잰다
      let low = 0;
      for (const s of seats) if (!s.m.me) for (let th = ARC.a0 - ARC.over + ARC.edge; th <= ARC.a1 + ARC.over - ARC.edge; th += 2) {
        const { pos, rot } = at(s.m, s.u, th), k2 = s.u, tail = tailOf(s.m.items, s.m.kd, turn([(C[0] - pos[0]) / k2, (C[1] - pos[1]) / k2], -rot));
        for (const [x, y] of [[s.m.box[0], s.m.box[3]], [s.m.box[2], s.m.box[3]], tail.tip]) low = Math.max(low, pos[1] + turn([x * k2, y * k2], rot)[1]);
      }
      low = Math.max(low + MOVE.bob, top);   // 회색 말이 없어도 부제 아래로는 올라가지 않는다
      // 메아리 아래 ~ 규칙 위에 제 크기(폭 88%)로 들면 그 가운데. 모자라면(320 × 568 · 60자 다섯 줄 — 폭 41%까지 줄었다) 제 크기 그대로
      // 규칙 위에 붙어 메아리 띠까지 올라간다 — 회색 말은 그 뒤로 지나간다(결정 32 작은 화면, 디자이너 "메아리 띠에 겹쳐도 됨"). 부제는 넘지 않는다
      const span = group.bottom - group.top, need = span * (1 + 2 * ME.amp), full = (ME.w * W) / (mine.box[2] - mine.box[0]);
      const fits = (rulesTop - low - 2 * ME.gap) / need >= full, u = fits ? full : Math.min(full, (rulesTop - top - 2 * ME.gap) / need), amp = ME.amp * span * u;
      const oy = fits ? (low + rulesTop) / 2 - ((group.top + group.bottom) / 2) * u : rulesTop - ME.gap - amp - group.bottom * u;
      me = { u, ox: W / 2 - ((mine.box[0] + mine.box[2]) / 2) * u, oy, amp };
      // 사람 — 키 · 자리는 화면이 바뀔 때만 적는다(두둥실 · 발은 그리는 시계가)
      const ks = (group.h * u) / CLIP_H;
      people.forEach((p, i) => {
        const [x, y] = group.seats[i];
        Object.assign(p.style, { width: `${(VB.w * ks).toFixed(1)}px`, height: `${(VB.h * ks).toFixed(1)}px`,
          left: `${(me.ox + x * u - (HEAD.cx - VB.x) * ks).toFixed(1)}px`, top: `${(me.oy + y * u - (SEAT_Y - VB.y) * ks).toFixed(1)}px` });
      });
    };
    const draw = (ms: number) => {
      raf = requestAnimationFrame(draw);
      const sec = ms / 1000;
      if (sec - last < MOVE.dt) return;
      last = sec;
      const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!W || !H) return;
      measure();
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      const t = quiet ? Infinity : sec - t0, spin = quiet ? 0 : Math.max(0, t - MOVE.appear - ARC.rest) * ARC.omega;
      const lo = ARC.a0 - ARC.over, span = ARC.a1 - ARC.a0 + 2 * ARC.over, show = clamp(t / MOVE.appear);
      // 회색 말 — 오래된 쪽(바깥)부터
      for (const s of [...seats].reverse()) {
        if (s.m.me) continue;
        const th = lo + ((((s.th + spin - lo) % span) + span) % span);
        const alpha = clamp((th - lo) / ARC.edge) * clamp((lo + span - th) / ARC.edge) * show;
        const { pos, rot } = at(s.m, s.u, th), X = pos[0] + (quiet ? 0 : MOVE.bob * Math.sin(sec * 0.6 + s.m.ph)), Y = pos[1] + (quiet ? 0 : MOVE.bob * Math.sin(sec * 0.8 + s.m.ph * 2));
        const k = s.u, c = Math.cos(rot) * k * dpr, n = Math.sin(rot) * k * dpr;
        ctx.setTransform(c, n, -n, c, X * dpr, Y * dpr);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = grey;
        // 꼬리는 기운 말의 좌표에서 호의 중심을 가리킨다
        paintBody(ctx, s.m.items, s.m.kd, s.m.gaps, 1, tailOf(s.m.items, s.m.kd, turn([(C[0] - X) / k, (C[1] - Y) / k], -rot)), 1, sec, s.m.ph, quiet);
      }
      ctx.globalAlpha = 1;
      if (!mine || !group || !colors || !me.u) return;
      // 내 말 · 두 사람 — 한 덩어리로 위아래 두둥실(charFloat처럼 양 끝에서 느리게)
      const dy = quiet ? 0 : -me.amp * Math.cos((2 * Math.PI * sec) / ME.float), Y = me.oy + dy;
      ctx.setTransform(me.u * dpr, 0, 0, me.u * dpr, me.ox * dpr, Y * dpr);
      ctx.globalAlpha = show;
      ctx.fillStyle = colors.bg;
      const gs = paintBody(ctx, mine.items, mine.kd, mine.gaps, 1, group.tail, 1, sec, mine.ph, quiet);
      ctx.globalAlpha = 1;
      const el = textRef.current;
      if (el) {
        Object.assign(el.style, { opacity: show.toFixed(3), fontSize: `${me.u.toFixed(2)}px`, transform: `translate(${me.ox.toFixed(1)}px, ${Y.toFixed(1)}px)` });
        placeGlyphs(glyphEls(), gs, me.u);
      }
      const swing = quiet ? 0 : (2 * Math.PI * sec) / kick;
      people.forEach((p, i) => {
        Object.assign(p.style, { opacity: show.toFixed(3), transform: `translateY(${dy.toFixed(1)}px)` });
        legs[i][0]?.setAttribute('transform', `rotate(${(SIT.farDeg + SIT.farSwing * Math.sin(swing)).toFixed(1)} ${SIT.pivot[0]} ${SIT.pivot[1]})`);
        legs[i][1]?.setAttribute('transform', `rotate(${(SIT.nearDeg + SIT.nearSwing * Math.sin(swing + 1.7)).toFixed(1)} ${SIT.pivot[0]} ${SIT.pivot[1]})`);
      });
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mine, group, colors]);

  return (
    <>
      <canvas ref={cvRef} className="done-sky" aria-hidden="true" />
      <div ref={textRef} className="dot-text done-sky-text" aria-hidden="true" style={{ transformOrigin: '0 0' }}>
        {mine && tone && colors && <Letters lines={lines} items={mine.items} tone={tone} bg={colors.bg} fg={colors.text} />}
      </div>
      {mine && <div ref={peopleRef} aria-hidden="true">{PEOPLE.map((c, i) => <Sitter key={c} color={c} flip={i === 1} id={i} />)}</div>}
    </>
  );
}

/** 앉은 작은 사람 하나(벽 WallWalkers의 앉은 모습 그대로 — walker.ts SIT · 웃는 눈). flip이면 오른쪽을 본다. 자리 · 발은 그리는 시계가 */
function Sitter({ color, flip, id }: { color: string; flip: boolean; id: number }) {
  return (
    <div className="done-sitter" style={{ position: 'absolute', left: 0, top: 0, opacity: 0, pointerEvents: 'none' }}>
      <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={`ds-body-${id}`}><rect width={VIEW.w} height={CLIP_H} /></clipPath>
          <clipPath id={`ds-legs-${id}`}><rect x={-600} y={-600} width={1600} height={600 + FOOT_Y} /></clipPath>
        </defs>
        <g style={{ color: `var(${color})` }} transform={flip ? `matrix(-1 0 0 1 ${2 * HEAD.cx} 0)` : undefined}>
          <g clipPath={`url(#ds-legs-${id})`}>
            <g data-p="far"><path fill="currentColor" d={SIT.far} /></g>
            <g data-p="near"><path fill="currentColor" d={SIT.near} /></g>
          </g>
          <g transform={`translate(0 ${SIT.drop})`}>
            <g clipPath={`url(#ds-body-${id})`}>
              <circle fill="currentColor" cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} />
              <path fill="currentColor" d={SIT.body} />
              <circle fill="var(--paper)" cx={EYE_WHITE.cx} cy={EYE_WHITE.cy} r={EYE_WHITE.r} />
              <path d={EYE_SMILE.d} transform={EYE_SMILE.transform} fill="currentColor" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}

/** 내 말의 글자 — VoiceBubble의 한 자씩 놓기(서체 · 무게 · 기울기 · 획 보정이 3/5 그대로). 자리는 그리는 시계가 px로 놓는다 */
const Letters = memo(function Letters({ lines, items, tone, bg, fg }: { lines: string[]; items: Item[]; tone: ToneState; bg: string; fg: string }) {
  return (
    <VoiceBubble text={lines.join('\n')} bg={bg} color={fg} fontFamily={fontMap[tone.font ?? 'botong']} font={tone.font}
      weight={tone.wght ?? 400} width={tone.tone ?? 1} slant={tone.slnt ?? 0} size={tone.size} manner={tone.manner} speed={tone.speed} weightPos={tone.weight}
      fontSize="1em" glyphs={items.map((it) => ({ c: it.ch, x: 0, y: 0, a: it.a }))} glyphBox={{ w: 1, h: 1 }} />
  );
});
