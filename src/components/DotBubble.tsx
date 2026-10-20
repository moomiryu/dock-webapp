import { useEffect, useMemo, useRef } from 'react';
import VoiceBubble from './VoiceBubble';
import { ENTRANCE, TAIL_FIRST, arrange, arrangeOf, bigScale, evenSpread, boundsOf, fitTail, follow, gapsOf, kindOf, modulesAt, mouthOf, planEntrance, tailOf, tipAt, type Item, type Plan, type Tail } from '../lib/aggregate';
import { paintBody, paintEntrance, placeGlyphs } from '../lib/dotPaint';
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
 */
const SCATTER = 0.9, GATHER = 0.7, WHOOSH = 0.7;
/** 다시 그리는 간격 — 모인 뒤 꼬리 나부낌은 30fps(띠 구름 · 나무와 같았다) */
const FRAME_MS = 33;
/** pick — 상자 안 여백(몫)과 글자 크기 상한(px, RainPreview와 같다 — 높이의 6%, 28 ~ 72px) */
const FILL = 0.86;
/** 기기 — 화면 아래 가운데 바깥(견본 30px@720) */
const DEV_DROP = 30 / 720;
const easeOut = (k: number) => 1 - (1 - k) ** 3;
/** pick의 꼬리 먼저 — 쏘는 점도 다 선 글자도 없는 등장. paintEntrance에 주면 꼬리만 입 쪽 끝부터 솟는다(5/5와 같은 꼬리 셈) */
const NOTHING_YET = (n: number): Plan => ({ shots: [], modDone: Array(n).fill(Infinity), whoosh: Infinity, F: 1, Fy: 1, landed: Infinity });
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
  className?: string;
}

type Fit = {
  W: number; H: number;
  /** pick — 낱개(0) · 모인 말(1)의 1u(px)와 원점. show는 둘이 같다 */
  u0: number; ox0: number; oy0: number; u1: number; ox1: number; oy1: number;
  tail: Tail | null;
  /** show — 등장 계획 · 휭 퍼진 낱개 자리 · 점이 나가는 곳(입, 말 좌표). 모이기 시작하는 때(둘 다) */
  plan: Plan | null; spread: Item[]; dev: [number, number]; merge: number;
};

export default function DotBubble({ lines, tone, align, bg, fg, mode = 'pick', hold = 3, still, play, className }: Props) {
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null), text = useRef<HTMLDivElement>(null);
  const kd = kindOf(tone.font), arr = arrangeOf(tone.font, align ?? tone.align);
  const items = useMemo(() => arrange(lines, arr, kd), [lines.join('\n'), arr, kd]);
  const gaps = useMemo(() => gapsOf(items, kd), [items, kd]);
  const optic = opticalFix[tone.font]?.scale ?? 1;
  const color = useRef(bg);
  color.current = bg;
  const fit = useRef<Fit>({ W: 0, H: 0, u0: 0, ox0: 0, oy0: 0, u1: 0, ox1: 0, oy1: 0, tail: null, plan: null, spread: [], dev: [0, 0], merge: 0 });
  const redraw = useRef<() => void>(() => {});

  useEffect(() => {
    const el = wrap.current, c = cv.current;
    if (!el || !c || !items.length) return;
    const quiet = still || (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
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
        const tail = fitTail(items, kd, dev1, [[S1, W / 2, H / 2, items[i].x, items[i].y], [S, W / 2, H / 2, rest.pos[i][0] * plan.F, rest.pos[i][1] * plan.Fy]], W, H);
        fit.current = { W, H, u0: S, ox0: W / 2, oy0: H / 2, u1: S1, ox1: W / 2, oy1: H / 2, tail, plan,
          spread: items.map((it) => ({ ...it, ax: it.ax * plan.F, ay: it.ay * plan.Fy })), dev: [mouth[0], mouth[1]], merge: plan.whoosh + WHOOSH + hold };
      } else {
        const cap = Math.max(28, Math.min(72, H * 0.06));
        const sizeFor = (b: readonly number[]) => Math.min((W * FILL) / (b[2] - b[0]), (H * FILL) / (b[3] - b[1]));
        const b0 = boundsOf(items, kd, 0), u0 = Math.min(cap, sizeFor(b0));
        // 기기(상자 아래 가운데 바깥) — 꼬리 방향은 u에 거의 기대지 않아 두 번 고쳐 셈한다
        // 글자 크기는 옛 꼬리 자리(room)로, 꼬리는 모인 자리와 낱개 자리(처음 ~1.3초 — 꼬리가 먼저 솟는다) 둘 다에서 무대 안에 드는 만큼(점검 둘째)
        let u1 = Math.min(cap, sizeFor(boundsOf(items, kd, 1))), b1 = boundsOf(items, kd, 1), room: Tail | null = null, dev: [number, number] = [0, 0];
        for (let k = 0; k < 2; k++) {
          const ox = W / 2 - ((b1[0] + b1[2]) / 2) * u1, oy = H / 2 - ((b1[1] + b1[3]) / 2) * u1;
          dev = [(W / 2 - ox) / u1, (H * (1 + DEV_DROP) - oy) / u1];
          room = tailOf(items, kd, dev, Infinity, true);
          b1 = boundsOf(items, kd, 1, room);
          u1 = Math.min(cap, sizeFor(b1));
        }
        const ox0 = W / 2 - ((b0[0] + b0[2]) / 2) * u0, ox1 = W / 2 - ((b1[0] + b1[2]) / 2) * u1, oy1 = H / 2 - ((b1[1] + b1[3]) / 2) * u1, i = room!.from;
        // 줄 많은 짧은 글은 낱개 말이 무대 높이를 다 써서 옛 길이(2.25) 꼬리도 아래로 나간다 — 그만큼 낱개 말을 위 여백으로 올린다(크기는 그대로, 모이며 내려온다)
        let oy0 = H / 2 - ((b0[1] + b0[3]) / 2) * u0;
        const [, ty, , py] = tipAt(tailOf(items, kd, dev, 0), items, [u0, ox0, oy0, rest.pos[i][0], rest.pos[i][1]]);
        oy0 -= Math.max(0, Math.min(ty + py - H, oy0 + b0[1] * u0));
        const tail = fitTail(items, kd, dev, [[u1, ox1, oy1, items[i].x, items[i].y], [u0, ox0, oy0, rest.pos[i][0], rest.pos[i][1]]], W, H);
        fit.current = { W, H, u0, ox0, oy0, u1, ox1, oy1, tail, plan: null, spread: items, dev: [0, 0], merge: TAIL_FIRST + SCATTER };
      }
      draw(performance.now() / 1000, true);
    };
    const draw = (sec: number, force = false) => {
      const ctx = c.getContext('2d'), F = fit.current;
      if (!ctx || !F.u1) return;
      if (!force && quiet) return;
      const age = quiet ? Infinity : sec - t0, P = F.plan;
      // 모이는 정도 m — pick은 꼬리가 솟고 낱개로 선 뒤(merge), show는 휭 퍼져 머문 뒤(merge) 모인다. 꼬리는 둘 다 처음부터 있다
      const m = easeOut(clamp((age - F.merge) / GATHER));
      const u = F.u0 + (F.u1 - F.u0) * m, ox = F.ox0 + (F.ox1 - F.ox0) * m, oy = F.oy0 + (F.oy1 - F.oy0) * m, dpr = c.width / F.W;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.setTransform(u * dpr, 0, 0, u * dpr, ox * dpr, oy * dpr);
      ctx.fillStyle = color.current;
      // 큰 말의 등장(휭까지) · pick의 꼬리 먼저(아직 아무 점도 안 날아온 등장 — 꼬리만 솟고 글자는 숨는다) · 그 뒤 모임과 꼬리
      const first = F.tail ? { tail: F.tail, items, sec, ph, still: quiet } : undefined;
      const gs = P && age < F.merge ? paintEntrance(ctx, rest, P, F.dev, age, land, WHOOSH, first)
        : !P && first && age < TAIL_FIRST ? paintEntrance(ctx, rest, NOTHING_YET(items.length), F.dev, age, land, WHOOSH, first)
        : paintBody(ctx, F.spread, kd, gaps, m, F.tail, 1, sec, ph, quiet);
      if (text.current) text.current.style.fontSize = `${u.toFixed(2)}px`;
      placeGlyphs(glyphs(), gs, u, ox, oy);
    };
    redraw.current = () => draw(performance.now() / 1000, true);
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const sec = now / 1000, settling = sec - t0 < fit.current.merge + GATHER;
      if (!settling && now - last < FRAME_MS) return;
      last = now;
      draw(sec);
    };
    const ro = new ResizeObserver(layout);
    ro.observe(el);
    layout();
    if (!quiet) raf = requestAnimationFrame(tick);
    return () => { ro.disconnect(); cancelAnimationFrame(raf); };
  }, [items, gaps, kd, still, play, mode, hold]);
  // 색만 바뀔 때 — 다시 놓지 않고 칠만 다시(4/5 첫 장의 색 시연)
  useEffect(() => { redraw.current(); }, [bg]);

  const F = fit.current, em = F.u1 * optic || 1;
  return (
    <div ref={wrap} className={'dot-bubble' + (className ? ' ' + className : '')} role="img" aria-label={lines.join(' ')}>
      <canvas ref={cv} aria-hidden="true" />
      <div ref={text} className="dot-text" aria-hidden="true">
        <VoiceBubble text={lines.join('\n')} bg={bg} color={fg} fontFamily={fontMap[tone.font]} font={tone.font}
          weight={tone.wght} width={tone.tone} slant={tone.slnt} size={tone.size} manner={tone.manner} speed={tone.speed} weightPos={tone.weight}
          fontSize="1em" glyphs={items.map((it) => ({ c: it.ch, x: 0, y: 0, a: it.a }))} glyphBox={{ w: (F.W || 1) / em, h: (F.H || 1) / em }} />
      </div>
    </div>
  );
}
