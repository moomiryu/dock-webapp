import { useEffect, useMemo, useRef } from 'react';
import VoiceBubble from './VoiceBubble';
import { ENTRANCE, arrange, arrangeOf, bigScale, evenSpread, boundsOf, fitTail, follow, G, gapsOf, kindOf, modulesAt, mouthOf, planEntrance, tailOf, type Item, type Plan, type Tail } from '../lib/aggregate';
import { paintBody, paintEntrance, placeGlyphs } from '../lib/dotPaint';
import { easeOf, tokenS } from '../lib/motion';
import { fontMap, opticalFix } from '../lib/palettes';
import type { Align, ToneState } from '../types';

/**
 * 도트 집합체 말 하나(2026-10-20, 결정 3 · 4 — 셈은 lib/aggregate.ts). 놓인 자리(부모 상자)를 다 쓴다. 점은 캔버스에, 글자는
 * VoiceBubble의 한 자씩 놓기(서체 · 무게 · 기울기 · 획 보정이 3/5 그대로)로. 기기는 상자 아래 가운데 바깥 — 꼬리가 그쪽을 가리킨다.
 *
 * 두 가지로 선다.
 * - pick(4/5) — play가 바뀔 때마다 처음부터, 5/5 · 벽과 같은 차례(결정 19 — 꼬리가 먼저): 꼬리가 첫 글자의 낱개 자리에 붙어 입 쪽
 *   끝부터 TAIL_FIRST초에 솟고, 낱개 글자들이 선다. SCATTER초 서 있다가 0.7초에 모이며(easeOut) 모듈이 1.12배로, 틈 메움이 모이는
 *   정도의 세제곱으로 나타난다. 꼬리는 첫 글자에 붙어 함께 온다. 낱개 · 모인 말을 따로 상자에 맞추고 모이는 동안 이어 간다.
 * - show(5/5 · 벽의 큰 말과 같은 차례) — 화면 정중앙에 크게(lib/aggregate.ts bigScale). 꼬리가 먼저(결정 9): 첫 글자의 퍼진 자리에서
 *   기기 쪽 끝부터 0.45초에 솟고, 그 밑동(입)에서 점이 나가 글자마다 한 박씩 쌓인다(성격별 등장 — 쿵 · 몽글 · 착 · 뿅). 날아오는 점은
 *   메움 없이 작은 점, 다 쌓인 글자는 제 몸짓으로 내려앉으며 글자가 선다. 다 서면 줄이 화면 가로 94%까지 휭 퍼지고(살짝 넘쳤다 돌아옴),
 *   hold초 머문 뒤 그 퍼진 자리에서 꼬리 단 채 모인다(꼬리는 첫 글자를 따라간다).
 * 그 뒤로는 꼬리만 나부낀다. still · 움직임 줄이기 = 모인 그대로 한 장.
 *
 * 2026-10-22 결정 56 — 폰의 말엔 꼬리가 없다(꼬리는 벽 하늘에 자리 잡은 뒤에 생긴다, 디자이너). 그리지만 않고 셈은 그대로 둔다 — 글자
 * 크기는 꼬리가 있던 때와 같고, pick의 자리는 꼬리 몫을 빼고 무대 한가운데(디자이너 "가운데로 내림"). 점이 나가는 입(show)은 꼬리
 * 밑동 그대로. pick은 꼬리가 솟던 TAIL_FIRST초를 건너 낱개부터 선다.
 */
/** 같은 글 · 모양 · 성격의 배치는 한 벌을 같이 쓴다 — 틈 메움(gapsOf)은 배치마다 한 번만 셈하므로, 4/5의 두 말풍선(첫 장 시연 · 고르는 장)이
    따로 짓던 것이 한 번이 된다(2026-10-29). 시연이 모양을 돌 때도 두 바퀴부터는 다시 셈하지 않는다 */
const ARR = new Map<string, Item[]>();
const shared = (lines: readonly string[], arr: Align, kd: ReturnType<typeof kindOf>) => {
  const key = `${lines.join('\n')}|${arr}|${kd.mod}`, had = ARR.get(key);
  if (had) return had;
  if (ARR.size > 24) ARR.delete(ARR.keys().next().value!);
  const items = arrange(lines, arr, kd);
  ARR.set(key, items);
  return items;
};
const SCATTER = 0.9, GATHER = 0.7, WHOOSH = 0.7;
/** pick — play가 바뀐 뒤 낱개로 섰다가 다 모이기까지(초). 4/5 첫 장 시연이 이 박자에 맞춰 다음 모양으로 넘어간다 */
export const REGATHER = SCATTER + GATHER;
/** 다시 그리는 간격 — 모인 뒤 점의 숨은 30fps(띠 구름 · 나무와 같았다) */
const FRAME_MS = 33;
/** 글자를 짜는 기준 크기(px) — 화면에 보이는 크기가 아니다. 보이는 크기는 낱글자 배율(u / FONT_PX)이 준다. 핸드젯(유머있는)은 새 글자
    크기마다 서체를 다시 준비하는 데 60ms쯤 들어, 크기가 매 장면 · 모양마다 바뀌면 4/5가 멈칫했다(2026-10-29 점검). 한 값으로 두면 폰의
    말풍선이 모두 한 번 준비한 서체를 같이 쓴다 */
const FONT_PX = 64;
/** pick — 상자 안 여백(몫)과 글자 크기 상한(px, RainPreview와 같다 — 높이의 6%, 28 ~ 72px) */
const FILL = 0.86;
/** 기기 — 화면 아래 가운데 바깥(견본 30px@720) */
const DEV_DROP = 30 / 720;
const easeOut = (k: number) => 1 - (1 - k) ** 3;
const clamp = (k: number) => Math.min(1, Math.max(0, k));

interface Props {
  lines: readonly string[];
  tone: ToneState;
  align?: Align;
  /** 모듈의 칠 · 글자색 */
  bg: string;
  fg: string;
  mode?: 'pick' | 'show';
  /** show — 크게 머무는 시간(초) */
  hold?: number;
  still?: boolean;
  /** pick — 이 값이 바뀌면 낱개부터 다시 모인다(4/5에서 모양을 고를 때) */
  play?: unknown;
  /**
   * pick · still — 다 모인 말의 밑동에서 기기 쪽(무대 아래 가운데)으로 꼬리가 자란다(5/5, 2026-10-29 디자이너 — 결정 56의 예외). 벽 하늘에
   * 붙은 말과 같은 꼬리 · 같은 박자(--t-slow 뒤 --t-hold · --ease-standard로 밑동부터). room = 꼬리 끝이 비켜 둘 무대 아래(px, 무대 W · H로),
   * onRim = 말의 점 수 · 몸통 아랫가장자리 점들(px, 점 간격마다 가장 아래 점 — 부스러기가 여기서 튕겨 나간다) · 땅(px — 작은 사람이 서는 줄). 놓을 때마다. 움직임 줄이기면 다 자란 꼬리로 선다
   */
  tail?: { room: (W: number, H: number) => number; onRim?: (dots: number, rim: [number, number][], floor: number) => void };
  className?: string;
}

type Fit = {
  W: number; H: number;
  /** pick — 낱개(0) · 모인 말(1)의 1u(px)와 원점. show는 둘이 같다 */
  u0: number; ox0: number; oy0: number; u1: number; ox1: number; oy1: number;
  /** show — 등장 계획 · 휭 퍼진 낱개 자리 · 점이 나가는 곳(입, 말 좌표). 모이기 시작하는 때(둘 다) */
  plan: Plan | null; spread: Item[]; dev: [number, number]; merge: number;
  /** pick · tail — 모인 자리의 꼬리 */
  tail: Tail | null;
};

export default function DotBubble({ lines, tone, align, bg, fg, mode = 'pick', hold = 3, still, play, tail, className }: Props) {
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null), text = useRef<HTMLDivElement>(null);
  const kd = kindOf(tone.font), arr = arrangeOf(tone.font, align ?? tone.align);
  const items = useMemo(() => shared(lines, arr, kd), [lines.join('\n'), arr, kd]);
  const gaps = useMemo(() => gapsOf(items, kd), [items, kd]);
  const optic = opticalFix[tone.font]?.scale ?? 1;
  const color = useRef(bg);
  color.current = bg;
  const fit = useRef<Fit>({ W: 0, H: 0, u0: 0, ox0: 0, oy0: 0, u1: 0, ox1: 0, oy1: 0, plan: null, spread: [], dev: [0, 0], merge: 0, tail: null });
  const tailOpt = useRef(tail);
  tailOpt.current = tail;
  const redraw = useRef<() => void>(() => {});

  useEffect(() => {
    const el = wrap.current, c = cv.current;
    if (!el || !c || !items.length) return;
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches, quiet = still || reduced;
    // 자라는 꼬리(tail) — 멈춘 말이라도 자라는 동안만 그린다
    const SLOW = tokenS('--t-slow', 0.4), HOLD = tokenS('--t-hold', 0.7), easeStd = easeOf('--ease-standard'), growing = !!tailOpt.current && mode === 'pick' && !reduced;
    const ph = items.length * 1.7 + lines.join('').length * 0.37, land = ENTRANCE[kd.mod].land, rest = modulesAt(items, kd, 0);
    let raf = 0, last = -Infinity;
    const t0 = performance.now() / 1000;
    const glyphs = () => [...(text.current?.querySelectorAll<HTMLElement>('.arc-glyph') ?? [])];
    const layout = () => {
      const W = el.clientWidth, H = el.clientHeight;
      if (!W || !H) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      if (mode === 'show') {
        // 정중앙에 크게 — 말 좌표의 원점(모인 덩어리 가운데)이 화면 가운데, 꼬리는 그 아래로
        const S = bigScale(items, kd, W, H), dev: [number, number] = [0, (H / 2 + H * DEV_DROP) / S];
        // 세로로 긴 화면(폰 5/5) — 낱개가 폭의 80%라 모인 말이 폭의 절반쯤에 그쳤다. 모이면서 모인 말이 폭의 88%까지 커진다(4/5처럼 이어
        // 간다, 2026-10-20 디자이너 — "폰의 여건에 맞게"). 꼬리 끝은 화면 아래 안에. 벽(가로로 넓은 화면)은 그대로 한 크기
        // 글자 크기는 옛 꼬리 자리(room)로 잡는다 — 꼬리가 길어졌다고 글자가 작아지지 않게(점검 둘째). 꼬리는 그 크기에서 무대 안에 드는 만큼(fitTail)
        let S1 = S, room = tailOf(items, kd, dev, Infinity, true), dev1 = dev;
        if (H > W) for (let k = 0; k < 2; k++) {
          const b = boundsOf(items, kd, 1, room);
          S1 = Math.max(S, Math.min((0.88 * W) / (b[2] - b[0]), (H / 2 - (12 * H) / 720) / Math.max(-b[1], b[3])));
          dev1 = [0, (H / 2 + H * DEV_DROP) / S1];
          room = tailOf(items, kd, dev1, Infinity, true);
        }
        // 꼬리가 먼저(결정 9 — 벽과 같은 차례) — 모였을 때의 꼬리를 첫 글자의 퍼진 자리에 붙여 먼저 세우고, 글자 점들은 그 밑동(입)에서 나간다
        const i = room.from, t1 = tailOf(items, kd, dev1), mouth = mouthOf(follow(t1, items, rest.pos[i])), plan = planEntrance(items, kd, mouth, S, W, H, evenSpread(arr), t1);
        fit.current = { W, H, u0: S, ox0: W / 2, oy0: H / 2, u1: S1, ox1: W / 2, oy1: H / 2, plan,
          spread: items.map((it) => ({ ...it, ax: it.ax * plan.F, ay: it.ay * plan.Fy })), dev: [mouth[0], mouth[1]], merge: plan.whoosh + WHOOSH + hold, tail: null };
      } else {
        const cap = Math.max(28, Math.min(72, H * 0.06));
        const sizeFor = (b: readonly number[]) => Math.min((W * FILL) / (b[2] - b[0]), (H * FILL) / (b[3] - b[1]));
        const b0 = boundsOf(items, kd, 0), u0 = Math.min(cap, sizeFor(b0));
        // 글자 크기는 옛 꼬리 자리(room)째로 잡는다 — 꼬리가 있던 때와 같은 크기(결정 56). 기기(상자 아래 가운데 바깥) — 꼬리 방향은 u에
        // 거의 기대지 않아 두 번 고쳐 셈한다
        let u1 = Math.min(cap, sizeFor(boundsOf(items, kd, 1))), b1 = boundsOf(items, kd, 1);
        for (let k = 0; k < 2; k++) {
          const ox = W / 2 - ((b1[0] + b1[2]) / 2) * u1, oy = H / 2 - ((b1[1] + b1[3]) / 2) * u1;
          b1 = boundsOf(items, kd, 1, tailOf(items, kd, [(W / 2 - ox) / u1, (H * (1 + DEV_DROP) - oy) / u1], Infinity, true));
          u1 = Math.min(cap, sizeFor(b1));
        }
        // 자리는 몸통만으로 — 낱개도 모인 말도 무대 한가운데(결정 56, 디자이너 "가운데로 내림")
        const bb = boundsOf(items, kd, 1);
        const ox0 = W / 2 - ((b0[0] + b0[2]) / 2) * u0, oy0 = H / 2 - ((b0[1] + b0[3]) / 2) * u0, ox1 = W / 2 - ((bb[0] + bb[2]) / 2) * u1;
        let oy1 = H / 2 - ((bb[1] + bb[3]) / 2) * u1;
        // 자라는 꼬리 — 기기(무대 아래 가운데 바깥)를 가리키되 끝은 땅(floor) 위 room에서 멈춘다(fitTail). 말풍선 위 끝 ~ 땅(작은 사람의 발)을 한
        // 덩어리로 무대 세로 가운데에 둔다(2026-10-29 디자이너 — "무게 중심 자체가 너무 낮다, 캐릭터 ~ 말풍선 끝의 중심이 거의 중앙에"). 덩어리가
        // 무대보다 크면 위에 붙이고 땅은 무대 바닥, 꼬리가 줄어든다
        let tl: Tail | null = null, floor = H;
        const to = tailOpt.current;
        if (to) {
          const devAt = (oy: number): [number, number] => [(W / 2 - ox1) / u1, (H * (1 + DEV_DROP) - oy) / u1], room = to.room(W, H);
          const tall = (tailOf(items, kd, devAt(oy1)).tip[1] - bb[1]) * u1 + room, top = Math.max(0, (H - tall) / 2);
          oy1 = top - bb[1] * u1; floor = Math.min(H, top + tall);
          const dev = devAt(oy1), it = items[tailOf(items, kd, dev).from], at = [u1, ox1, oy1, it.x, it.y];
          tl = fitTail(items, kd, dev, [at], W, floor - room);
          const body = modulesAt(items, kd, 1).dots, low = new Map<number, (typeof body)[number]>();
          for (const d of body) { const k = Math.round(d.x / G), o = low.get(k); if (!o || d.y > o.y) low.set(k, d); }
          to.onRim?.(body.length + gaps.length + tl.dots.length, [...low.values()].map((d): [number, number] => [ox1 + d.x * u1, oy1 + d.y * u1]), floor);
        }
        fit.current = { W, H, u0, ox0, oy0, u1, ox1, oy1, plan: null, spread: items, dev: [0, 0], merge: SCATTER, tail: tl };
      }
      draw(performance.now() / 1000, true);
    };
    const draw = (sec: number, force = false) => {
      const ctx = c.getContext('2d'), F = fit.current;
      if (!ctx || !F.u1) return;
      if (!force && quiet && !growing) return;
      const age = quiet ? Infinity : sec - t0, P = F.plan;
      // 모이는 정도 m — pick은 꼬리가 솟고 낱개로 선 뒤(merge), show는 휭 퍼져 머문 뒤(merge) 모인다. 꼬리는 둘 다 처음부터 있다
      const m = easeOut(clamp((age - F.merge) / GATHER));
      const u = F.u0 + (F.u1 - F.u0) * m, ox = F.ox0 + (F.ox1 - F.ox0) * m, oy = F.oy0 + (F.oy1 - F.oy0) * m, dpr = c.width / F.W;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(u * dpr, 0, 0, u * dpr, ox * dpr, oy * dpr);
      ctx.fillStyle = color.current;
      // 큰 말의 등장(휭까지) · 그 뒤 모임 — 꼬리 없이(결정 56). 5/5만 다 모인 말에서 꼬리가 자란다(tail)
      const gs = P && age < F.merge ? paintEntrance(ctx, rest, P, F.dev, age, land, WHOOSH)
        : paintBody(ctx, F.spread, kd, gaps, m, F.tail, reduced ? 1 : easeStd(clamp((sec - t0 - SLOW) / HOLD)), sec, ph, quiet);
      /* 글자는 FONT_PX로 짜 두고 보이는 크기는 낱글자 안쪽(.ch)의 배율로 — 제 가운데에서 줄고 는다(FONT_PX) */
      const gl = glyphs(), ks = (u / FONT_PX).toFixed(4);
      placeGlyphs(gl, gs, u, ox, oy);
      for (const e of gl) { const ch = e.firstElementChild as HTMLElement | null; if (ch && ch.style.scale !== ks) ch.style.scale = ks; }
    };
    redraw.current = () => draw(performance.now() / 1000, true);
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (quiet) { draw(now / 1000, true); if (now / 1000 - t0 > SLOW + HOLD) cancelAnimationFrame(raf); return; }   // 멈춘 말 — 꼬리가 다 자라면 그친다
      const sec = now / 1000, settling = sec - t0 < fit.current.merge + GATHER;
      if (!settling && now - last < FRAME_MS) return;
      last = now;
      /* 모이는 동안만 글자마다 제 그림층 — 배율이 바뀔 때마다 핸드젯 글자를 다시 칠하면 장면이 빠졌다. 다 모이면 풀어 제 크기로 또렷하게
         다시 칠한다(app.css .dot-text[data-moving]) */
      if (text.current && text.current.hasAttribute('data-moving') !== settling) text.current.toggleAttribute('data-moving', settling);
      draw(sec);
    };
    const ro = new ResizeObserver(layout);
    ro.observe(el);
    layout();
    if (!quiet || growing) raf = requestAnimationFrame(tick);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [items, gaps, kd, still, play, mode, hold]);
  // 색만 바뀔 때 — 다시 놓지 않고 칠만 다시(4/5 첫 장의 색 시연)
  useEffect(() => { redraw.current(); }, [bg]);

  const F = fit.current, em = FONT_PX * optic;
  return (
    <div ref={wrap} className={'dot-bubble' + (className ? ' ' + className : '')} role="img" aria-label={lines.join(' ')}>
      <canvas ref={cv} aria-hidden="true" />
      <div ref={text} className="dot-text" aria-hidden="true" style={{ fontSize: FONT_PX }}>
        <VoiceBubble text={lines.join('\n')} bg={bg} color={fg} fontFamily={fontMap[tone.font]} font={tone.font}
          weight={tone.wght} width={tone.tone} slant={tone.slnt} size={tone.size} manner={tone.manner} speed={tone.speed} weightPos={tone.weight}
          fontSize="1em" glyphs={items.map((it) => ({ c: it.ch, x: 0, y: 0, a: it.a }))} glyphBox={{ w: (F.W || 1) / em, h: (F.H || 1) / em }} />
      </div>
    </div>
  );
}
