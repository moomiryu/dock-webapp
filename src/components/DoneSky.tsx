import { memo, useEffect, useMemo, useRef } from 'react';
import VoiceBubble from './VoiceBubble';
import { RF, arrange, arrangeOf, gapsOf, kindOf, modulesAt, tailOf, type Dot, type Item, type Kind } from '../lib/aggregate';
import { paintBody, placeGlyphs } from '../lib/dotPaint';
import { turn } from '../lib/sky';
import { foldLines } from '../lib/fit';
import { fontMap } from '../lib/palettes';
import { colorsOf } from '../lib/messageStyle';
import type { Align, ToneState } from '../types';

/**
 * 08 완료의 하늘(2026-10-20, 결정 13 — 견본 kv/done-08.html의 가운데 '1.2배') — '메아리처럼 화면을 맴돕니다'를 그림으로. 화면의 짜임은
 * 그대로 두고 하늘만 더한다: 메가폰트(.home-char) 그림 상자의 가운데를 중심으로 한 부채꼴 호(가로 반지름 = 상자 폭 × 0.625 · 세로 × 1.05,
 * 212° ~ 328°) 위에 말들이 앉아 결을 따라 3분의 1 기울고(벽의 결정 9와 같다), 꼬리는 모두 메가폰트를 가리킨다. 내 말이 앉는 꼭대기가
 * '부제 아래 ~ 메가폰트 위' 칸보다 높으면(키 큰 글 · 낮은 화면 — 320 × 640에서 꼭대기가 제목에 걸렸다) 세로 반지름만 줄여 꼭대기를 내린다.
 * - 내 말: 쓴 글 · 성격 · 모양 · 색 짝 그대로(5/5와 같은 그리기 — 점은 캔버스, 글자는 VoiceBubble), 회색 말의 1.2배, 호 꼭대기. 긴 글은
 *   폭 0.8W · 높이 '부제 아래 ~ 메가폰트 위' 안에 들게 줄인다.
 * - 회색 지난 말 넷: --grey-200 · 글자 없음(홈과 같다), 성격을 섞어 내 말 양옆으로 번갈아 바깥으로. 말 사이 1.2u.
 * - 움직임: 회색 말이 0.6초에 나타나고, 내 말이 메가폰트 가운데 40px 위에서 0.4배로 쏘아 올라 1.4초(easeOut)에 앉는다(기울기 0 → 제
 *   기울기). 앉고 0.6초 뒤부터 하늘 전체가 호를 따라 2.5°/초로 맴돌고, 양 끝 바깥 15°를 지나면 반대쪽에서 다시 — 끝 12° 안에서 옅어진다.
 *   모두 ±1.5px 둥실. 움직임 줄이기면 다 앉은 모습 그대로.
 * 메가폰트는 끌어 옮길 수 있다 — 중심은 매 순간 그 상자에서 재고, 잡고 있는 동안([data-held])만 마지막 자리에 둔다.
 */
const ARC = { rx: 0.625, ry: 1.05, a0: 212, a1: 328, tilt: 1 / 3, u: 0.059, me: 1.2, gap: 1.2, over: 15, edge: 12, omega: 2.5, rest: 0.6 };
/** 나타나기 · 쏘아 오름(시작 · 걸리는 시간 · 처음 배율 · 메가폰트 가운데 위 px) · 둥실(px) · 긴 글의 폭 상한 · 다시 그리는 간격(초) */
const MOVE = { appear: 0.6, shot: 0.6, rise: 1.4, from: 0.4, lift: 40, bob: 1.5, maxW: 0.8, dt: 0.033 };
/** 회색 지난 말 — 성격 · 글자 수(견본: 다정 4 · 차분 5 · 유머 3 · 당당 4) */
const GREYS: [string, number][] = [['doran', 4], ['chabun', 5], ['deulseok', 3], ['ttoryeot', 4]];
const easeOut = (k: number) => 1 - (1 - Math.min(1, Math.max(0, k))) ** 3;
const clamp = (k: number) => Math.min(1, Math.max(0, k));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

type Msg = { kd: Kind; items: Item[]; gaps: Dot[]; box: [number, number, number, number]; ph: number; me: boolean };
function msgOf(lines: string[], font: string | undefined, align: Align | undefined, me: boolean, ph: number): Msg {
  const kd = kindOf(font), items = arrange(lines, arrangeOf(font, align), kd), gaps = gapsOf(items, kd);
  const b: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const d of [...modulesAt(items, kd, 1).dots, ...gaps]) { b[0] = Math.min(b[0], d.x - RF); b[1] = Math.min(b[1], d.y - RF); b[2] = Math.max(b[2], d.x + RF); b[3] = Math.max(b[3], d.y + RF); }
  return { kd, items, gaps, box: b, ph, me };
}

export default function DoneSky({ text, tone }: { text?: string; tone?: ToneState | null }) {
  const cvRef = useRef<HTMLCanvasElement>(null), textRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => (text ? foldLines(text) : []), [text]);
  const mine = useMemo(() => (lines.length && tone ? msgOf(lines, tone.font, tone.align, true, 0.7) : null), [lines, tone]);
  const colors = useMemo(() => (tone && text ? colorsOf({ id: 'done', text, tone, createdAt: 0 }) : null), [tone, text]);

  useEffect(() => {
    const cv = cvRef.current, ctx = cv?.getContext('2d'), frame = cv?.closest('.home-frame') as HTMLElement | null;
    if (!cv || !ctx || !frame) return;
    const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const css = getComputedStyle(document.documentElement), grey = css.getPropertyValue('--grey-200').trim();
    const greys = GREYS.map(([f, n], i) => msgOf(['가'.repeat(n)], f, 'center', false, 1.9 * i + 0.4));
    const all = mine ? [mine, ...greys] : greys;
    const glyphEls = () => [...(textRef.current?.querySelectorAll<HTMLElement>('.arc-glyph') ?? [])];
    let C: [number, number] = [0, 0], box = 0, ry = 0, seats: { m: Msg; th: number; u: number }[] = [], raf = 0, last = -Infinity;
    const t0 = performance.now() / 1000;

    // 자리 — 메가폰트 상자에서 중심 · 크기를 재고, 내 말을 꼭대기(270°)에, 회색 말을 양옆으로 번갈아 바깥으로(메가폰트에서 본 폭만큼 각)
    const measure = () => {
      const char = frame.querySelector<HTMLElement>('.home-char');
      if (!char || char.hasAttribute('data-held')) return false;
      const fr = frame.getBoundingClientRect(), r = char.getBoundingClientRect();
      const nextC: [number, number] = [r.left - fr.left + r.width / 2, r.top - fr.top + r.height / 2];
      if (box === r.width && nextC[0] === C[0] && nextC[1] === C[1]) return true;
      C = nextC; box = r.width;
      const U = ARC.u * box, gap = ARC.gap * U, sub = frame.querySelector('.home-subtitle')?.getBoundingClientRect(), W = fr.width;
      // 내 말은 '부제 아래(한 칸 띄워) ~ 메가폰트 위' 칸과 폭 0.8W 안에 — 긴 글은 줄이고, 꼭대기 자리가 그 칸보다 높으면(키 큰 글 · 낮은
      // 화면) 호의 세로 반지름을 줄여 꼭대기를 내린다. 짧은 글 · 보통 화면은 견본 그대로(× 1.05)
      const top = sub ? sub.bottom - fr.top + gap : 0, room = r.top - fr.top - top;
      // 단 회색 말보다는 작아지지 않는다 — 낮은 화면(320 × 568)에서 그 칸이 음수(−19.7px)가 되어 u가 음수 → 180° 뒤집힌 작은 덩어리로
      // 그려졌다(움직임 줄이기에선 글자가 6px까지). 칸이 모자라 메가폰트 윗부분에 걸리면 걸린 채 둔다 — 층이 메가폰트 뒤다(2026-10-20 점검)
      const uOf = (m: Msg) => (m.me ? Math.max(U, Math.min(ARC.me * U, (MOVE.maxW * W) / (m.box[2] - m.box[0]), room / (m.box[3] - m.box[1]))) : U);
      ry = ARC.ry * box;
      if (mine) ry = Math.min(ry, C[1] - top - ((mine.box[3] - mine.box[1]) * uOf(mine)) / 2);
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
      return true;
    };
    const at = (m: Msg, u: number, th: number, S = 1) => {
      const a = (th * Math.PI) / 180, rot = (ARC.tilt * (th - 270) * Math.PI) / 180;
      const [ox, oy] = turn([((m.box[0] + m.box[2]) / 2) * u * S, ((m.box[1] + m.box[3]) / 2) * u * S], rot);
      return { pos: [C[0] + ARC.rx * box * Math.cos(a) - ox, C[1] + ry * Math.sin(a) - oy] as [number, number], rot };
    };
    const draw = (ms: number) => {
      raf = requestAnimationFrame(draw);
      const sec = ms / 1000;
      if (sec - last < MOVE.dt) return;
      last = sec;
      const W = cv.clientWidth, H = cv.clientHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      if (!W || !H || !measure()) return;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      const t = quiet ? Infinity : sec - t0, settled = MOVE.shot + MOVE.rise + ARC.rest;
      const spin = quiet ? 0 : Math.max(0, t - settled) * ARC.omega, lo = ARC.a0 - ARC.over, span = ARC.a1 - ARC.a0 + 2 * ARC.over;
      // 오래된 쪽(바깥)부터 칠하고 내 말을 맨 앞에
      for (const s of [...seats].reverse()) {
        const th = lo + ((((s.th + spin - lo) % span) + span) % span);
        const edge = clamp((th - lo) / ARC.edge) * clamp((lo + span - th) / ARC.edge);
        const bob = quiet ? [0, 0] : [MOVE.bob * Math.sin(sec * 0.6 + s.m.ph), MOVE.bob * Math.sin(sec * 0.8 + s.m.ph * 2)];
        let { pos, rot } = at(s.m, s.u, th), S = 1, alpha = edge;
        if (!s.m.me) alpha *= clamp(t / MOVE.appear);
        else if (t < MOVE.shot) { if (textRef.current) textRef.current.style.opacity = '0'; continue; }
        else if (t < MOVE.shot + MOVE.rise) {
          // 메가폰트 가운데 위에서 작게 쏘아 올라 제자리로 커지며 앉는다
          const e = easeOut((t - MOVE.shot) / MOVE.rise), m = s.m, u = s.u;
          S = lerp(MOVE.from, 1, e);
          const start: [number, number] = [C[0] - ((m.box[0] + m.box[2]) / 2) * u * S, C[1] - MOVE.lift - ((m.box[1] + m.box[3]) / 2) * u * S];
          pos = [lerp(start[0], pos[0], e), lerp(start[1], pos[1], e)];
          rot *= e; alpha = 1;
        }
        const X = pos[0] + bob[0], Y = pos[1] + bob[1], k = s.u * S, c = Math.cos(rot) * k * dpr, n = Math.sin(rot) * k * dpr;
        ctx.setTransform(c, n, -n, c, X * dpr, Y * dpr);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.m.me && colors ? colors.bg : grey;
        // 꼬리는 기운 말의 좌표에서 메가폰트를 가리킨다
        const tail = tailOf(s.m.items, s.m.kd, turn([(C[0] - X) / k, (C[1] - Y) / k], -rot));
        const gs = paintBody(ctx, s.m.items, s.m.kd, s.m.gaps, 1, tail, 1, sec, s.m.ph, quiet);
        const el = textRef.current;
        if (s.m.me && el) {
          Object.assign(el.style, { opacity: alpha.toFixed(3), fontSize: `${k.toFixed(2)}px`, transformOrigin: '0 0', transform: `translate(${X.toFixed(1)}px, ${Y.toFixed(1)}px) rotate(${rot.toFixed(4)}rad)` });
          placeGlyphs(glyphEls(), gs, k);
        }
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [mine, colors]);

  return (
    <>
      <canvas ref={cvRef} className="done-sky" aria-hidden="true" />
      <div ref={textRef} className="dot-text done-sky-text" aria-hidden="true">
        {mine && tone && colors && <Letters lines={lines} items={mine.items} tone={tone} bg={colors.bg} fg={colors.text} />}
      </div>
    </>
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
