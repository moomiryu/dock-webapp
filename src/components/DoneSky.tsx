import { memo, useEffect, useMemo, useRef } from 'react';
import VoiceBubble from './VoiceBubble';
import { RF, arrange, arrangeOf, gapsOf, kindOf, modulesAt, tailOf, type Dot, type Item, type Kind, type Tail } from '../lib/aggregate';
import { paintBody, placeGlyphs } from '../lib/dotPaint';
import { foldLines } from '../lib/fit';
import { fontMap } from '../lib/palettes';
import { colorsOf } from '../lib/messageStyle';
import { tokenS } from '../lib/motion';
import { CLIP_H, EYE_SMILE, EYE_WHITE, FOOT_Y, HEAD, SIT, VIEW } from '../character/walker';
import type { Align, ToneState } from '../types';

/**
 * 08 완료의 하늘 — 내 말과 그 위에 앉은 두 사람만(2026-11-03 디자이너 — "센터가 안 맞다. 짜바리 뒤 희미한 말풍선 다 빼고 사람 + 문장
 * 구름만 봐서 중앙에"). 지금 라이브 · 10-27 미커밋 변경 위 · 라이브 기준 셋을 두 화면 × 두 글로 견본 보고 라이브 기준을 골랐다.
 * - 내 말(결정 32, 2026-10-20 디자이너 — "마지막 화면에 메가폰트를 더 이상 등장시키지 않는다. 만든 말풍선 위에 사람들이 웃으면서 앉아
 *   있게", 견본 out-08sit/v-2-fix-s): 쓴 글 · 성격 · 모양 · 색 짝 그대로(5/5와 같은 그리기 — 점은 캔버스, 글자는 VoiceBubble), 가로
 *   가운데 · 몸통 폭 = 화면 폭의 88%. 그 위에 벽의 작은 사람 둘(빨강 왼쪽 · 하늘 오른쪽, walker.ts SIT · 웃는 눈)이 바깥을 보고 앉는다 —
 *   키 = 한 줄 몸통 높이 × 0.9, 자리 = 몸통 폭의 22.5% · 77.5%, 앉은 키의 25%만큼 몸통 윗선 아래로 묻혀(walker.ts SIT.sink — 2026-11-03, 10%였다). 두 발만 벽처럼 까딱.
 * - 자리: 보이는 무리(머리 꼭대기 ~ 몸통 아랫선)의 가운데 = 제목 묶음(.home-intro — '발화 종료.') 아랫선과 규칙 목록 윗선 사이의 가운데
 *   (제목 밑 한 줄은 2026-11-03에 뺐다 — 그전엔 그 줄의 아랫선). 그 칸에 제 크기(폭 88%)로
 *   안 들 때만(긴 글 · 낮은 화면) 줄인다. 말 · 사람이 한 덩어리로 위아래로만 두둥실(홈 메가폰트 charFloat의 결 — 5.2초 한 바퀴, 폭
 *   ±무리 높이의 2%). 0.6초에 나타난다. 움직임 줄이기면 다 앉은 모습 그대로.
 * - 그 전(2026-10-20 결정 13 ~ 11-03): 회색 지난 말 넷이 메가폰트가 서던 자리를 중심으로 한 부채꼴 호를 따라 맴돌았고('메아리'), 내 말
 *   무리는 그 메아리 아래 ~ 규칙 위의 가운데였다 — 화면 아래로 처져 보였다(390 × 844에서 빈 칸 가운데보다 77px 아래).
 *
 * 2026-10-22 결정 56 — 내 말은 꼬리를 그리지 않는다(폰의 말엔 꼬리가 없다). 크기 셈은 꼬리가 있던 때 그대로.
 */
/** 나타나기(초) · 다시 그리는 간격(초) */
const MOVE = { appear: 0.6, dt: 0.033 };
/** 내 말과 앉은 두 사람 — 몸통 폭(화면 폭의 몫) · 꼬리 길이 상한(u) · 키(한 줄 몸통 높이의 몫) · 자리(몸통 폭의 몫) ·
 *  두둥실(한 바퀴 초 — app.css charFloat · 폭은 무리 높이의 몫) · 제목 · 규칙 목록과 띄움(px) */
const ME = { w: 0.88, tail: 2.25, h: 0.9, seats: [0.225, 0.775], float: 5.2, amp: 0.02, gap: 12 };
/** 사람 그림의 판 — walker.ts 좌표(견본과 같다). 앉으면 몸이 SIT.drop만큼 내려와 엉덩이가 FOOT_Y − 4에 닿는다 — 앉은 키 = CLIP_H */
const VB = { x: -140, y: -20, w: 600, h: 600 }, SEAT_Y = FOOT_Y - 4;
const PEOPLE = ['--brand-main', '--char-cyan'];
const clamp = (k: number) => Math.min(1, Math.max(0, k));

type Msg = { kd: Kind; items: Item[]; gaps: Dot[]; box: [number, number, number, number]; ph: number; me: boolean };
function msgOf(lines: string[], font: string | undefined, align: Align | undefined, me: boolean, ph: number): Msg {
  const kd = kindOf(font), items = arrange(lines, arrangeOf(font, align), kd), gaps = gapsOf(items, kd);
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const d of [...modulesAt(items, kd, 1).dots, ...gaps]) { b[0] = Math.min(b[0], d.x - RF); b[1] = Math.min(b[1], d.y - RF); b[2] = Math.max(b[2], d.x + RF); b[3] = Math.max(b[3], d.y + RF); }
  return { kd, items, gaps, box: b, ph, me };
}
/** 내 말 무리의 셈(u, 말 좌표) — 꼬리 · 두 사람의 키 · 엉덩이 자리(가로, 몸통 윗선 + 걸침) · 무리 위아래(크기는 꼬리째 센다, 결정 56) */
function groupOf(m: Msg) {
  const cx = (m.box[0] + m.box[2]) / 2, tail: Tail = tailOf(m.items, m.kd, [cx, m.box[3] + 40], ME.tail);
  const one = msgOf(['가'], undefined, 'center', false, 0), h = ME.h * (one.box[3] - one.box[1]) * (m.kd.k / one.kd.k), half = (h * HEAD.r) / CLIP_H;
  const dots = [...modulesAt(m.items, m.kd, 1).dots, ...m.gaps];
  const seats = ME.seats.map((f) => {
    const x = m.box[0] + f * (m.box[2] - m.box[0]), near = dots.filter((d) => Math.abs(d.x - x) <= half);
    return [x, Math.min(...(near.length ? near : dots).map((d) => d.y)) - RF + SIT.sink * h] as [number, number];
  });
  const top = Math.min(...seats.map(([, y]) => y - h)), bottom = Math.max(m.box[3], tail.tip[1] + RF);
  return { h, seats, top, bottom };
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
    const kick = tokenS('--t-hold', 0.7) * 4;
    const glyphEls = () => [...(textRef.current?.querySelectorAll<HTMLElement>('.arc-glyph') ?? [])];
    const people = [...(peopleRef.current?.children ?? [])] as HTMLElement[];
    const legs = people.map((p) => [p.querySelector<SVGGElement>('[data-p="far"]'), p.querySelector<SVGGElement>('[data-p="near"]')]);
    let key = '', raf = 0, last = -Infinity;
    let me = { u: 0, ox: 0, oy: 0, amp: 0 };
    const t0 = performance.now() / 1000;

    // 자리 — 화면 · 제목 · 규칙 목록이 바뀔 때만 다시 센다
    const measure = () => {
      if (!mine || !group) return;
      const fr = frame.getBoundingClientRect(), gate = frame.querySelector('.home-gate')?.getBoundingClientRect(), rules = frame.querySelector('.info-rules')?.getBoundingClientRect();
      const head = frame.querySelector('.home-intro')?.getBoundingClientRect();
      const W = fr.width, H = fr.height, headB = head ? head.bottom - fr.top : 0, rulesTop = rules ? rules.top - fr.top : gate ? gate.top - fr.top : H;
      const next = `${W}|${H}|${headB}|${rulesTop}`;
      if (next === key) return;
      key = next;
      // 보이는 무리(머리 꼭대기 ~ 몸통 아랫선)의 가운데를 제목 ~ 규칙 칸의 가운데에. 두둥실 폭까지 그 칸에 들게, 제 크기로 안 들 때만 줄인다
      const span = group.bottom - group.top, need = span * (1 + 2 * ME.amp), full = (ME.w * W) / (mine.box[2] - mine.box[0]);
      const u = Math.min(full, (rulesTop - headB - 2 * ME.gap) / need), amp = ME.amp * span * u, half = ((mine.box[3] - group.top) / 2) * u;
      const cy = Math.max(headB + ME.gap + amp + half, Math.min((headB + rulesTop) / 2, rulesTop - ME.gap - amp - half));
      me = { u, ox: W / 2 - ((mine.box[0] + mine.box[2]) / 2) * u, oy: cy - ((group.top + mine.box[3]) / 2) * u, amp };
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
      const t = quiet ? Infinity : sec - t0, show = clamp(t / MOVE.appear);
      if (!mine || !group || !colors || !me.u) return;
      // 내 말 · 두 사람 — 한 덩어리로 위아래 두둥실(charFloat처럼 양 끝에서 느리게)
      const dy = quiet ? 0 : -me.amp * Math.cos((2 * Math.PI * sec) / ME.float), Y = me.oy + dy;
      ctx.setTransform(me.u * dpr, 0, 0, me.u * dpr, me.ox * dpr, Y * dpr);
      ctx.globalAlpha = show;
      ctx.fillStyle = colors.bg;
      const gs = paintBody(ctx, mine.items, mine.kd, mine.gaps, 1, null, 1, sec, mine.ph, quiet);
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
