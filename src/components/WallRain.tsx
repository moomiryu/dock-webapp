import { memo, useEffect, useRef } from 'react';
import type { StoredMessage } from '../lib/firebase';
import { formFor, fontMap, rainShapeOf } from '../lib/palettes';
import { messageColors } from '../lib/messageStyle';
import { DROP, WALL_FS, bubbleLayout, bubbleMotionOf, bubbleMove, drawDrop, placeGlyph, rainBaseline, rainColor, rainFontsReady } from '../lib/rain';

/**
 * 벽의 비눗방울(유머있는, 2026-10-06 디자이너 — 비의 줄기에서 바꿨다). 글마다 한 덩어리 — 폰 미리보기와 같은 가로줄(lib/rain.ts
 * bubbleLayout)로, 조금 아래에서 떠오르며 바람 따라 천천히 옆으로 흘러간다. 방울마다 살랑에 고른 둥실 · 흔들이 더해진다(bubbleMove).
 * 읽는 순서대로 하나씩 부풀어 나타나고, 한동안(글이 길수록 길게) 떠다닌 뒤 읽는 순서대로 하나씩 톡톡 터진다. 몇 초 쉬고 다른 자리에서
 * 다시.
 *
 * 피하는 규칙: 덩어리가 떠오르고 흘러가며 쓸고 지나갈 자리 전체(떠다니는 여유 포함)가 나무 · 돌 · 떠다니는 말 · 구름의 글자 자리
 * (둘레 여유 포함)와 떠 있는 다른 덩어리를 비켜야 자리를 잡는다. 없으면 기다렸다 다시 찾는다. 자리는 잡을 때 한 번 본다. 비눗방울은
 * 나무 · 돌 앞, 구름 뒤에 그린다(벽이 이 층을 그 사이에 둔다). 움직임을 줄이면 떠오르지도 흘러가지도 않고, 터지는 대신 사라진다.
 */
export interface RainScene {
  /** 비켜야 할 글자 자리(나무 · 돌 · 떠다니는 말 · 구름, 둘레 여유 포함, px) */
  letters: [number, number, number, number][];
  /** 땅의 윗선(px) */
  land: number;
}
type Bubble = { el: HTMLDivElement; x: number; y: number; ph: [number, number] };
type Block = {
  msg: StoredMessage; next: number; on: boolean; bubbles: Bubble[]; fs: number;
  /** 자리 잡은 때 · 다 떠오른 자리(왼쪽 위, px) · 흘러가는 쪽(±1) · 쓸고 지나갈 자리 · 터지기 시작하는 때 */
  t0: number; x: number; y: number; dir: number; swept: number[]; popAt: number;
};
/** 떠오르는 높이(화면 높이의 몫) · 시간(--t-hold의 배수), 흘러가는 빠르기(초마다 화면 높이의 몫), 부풀기 · 터지기 간격 · 터지는 시간(초) */
const RISE = 0.12, RISE_T = 8, DRIFT = 0.012, GROW = 0.06, POP = 0.12, POP_T = 0.18;
/** 떠다니는 시간 — 6T + 글자마다 0.35초. 다 터진 뒤 쉬는 시간 — T의 4 ~ 10배 */
const HOLD = (n: number, T: number) => 6 * T + 0.35 * n, REST: [number, number] = [4, 10];
const holdS = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--t-hold').trim(); return v.endsWith('ms') ? parseFloat(v) / 1000 : parseFloat(v) || 0.7; };
const hit = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const ease = (k: number) => 1 - (1 - k) ** 3;

export default memo(function WallRain({ msgs, scene, hideId }: { msgs: StoredMessage[]; scene: () => RainScene; hideId: string | null }) {
  const layer = useRef<HTMLDivElement>(null);
  const hideRef = useRef(hideId);
  hideRef.current = hideId;
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const key = msgs.map((m) => m.id).join(',');

  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    let raf = 0, dead = false;
    const T = holdS(), still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const now0 = performance.now() / 1000;
    const blocks: Block[] = msgs.map((msg, i) => ({ msg, next: now0 + i * 2.2 * T + Math.random() * 2 * T, on: false, bubbles: [], fs: 0,
      t0: 0, x: 0, y: 0, dir: 1, swept: [0, 0, 0, 0], popAt: 0 }));
    const stop = (b: Block, sec: number) => {
      for (const q of b.bubbles) q.el.remove();
      b.bubbles = []; b.on = false; b.next = sec + (REST[0] + Math.random() * (REST[1] - REST[0])) * T;
    };
    const go = async () => {
      await rainFontsReady();
      if (dead) return;
      const family = fontMap.deulseok, base = rainBaseline(family);
      const look = (msg: StoredMessage) => {
        const tone = msg.tone, f = formFor({ ...tone, font: 'deulseok', align: tone?.align });   // 옛 서체 키(song)도 유머있는으로
        return { f, shape: rainShapeOf(tone?.align), color: rainColor(tone ? messageColors(tone).bg : '#FFFFFF') };
      };
      /** 자리 잡기 — 떠오르고 흘러가며 쓸고 지나갈 자리가 글자 자리 · 다른 덩어리를 비키는 곳 중 하나 */
      const start = (b: Block, sec: number, S: RainScene, W: number, H: number) => {
        const fs = Math.round(H * WALL_FS), pts = bubbleLayout(b.msg.text), n = pts.length;
        if (!n) { b.next = sec + 10 * T; return; }
        const w = (Math.max(...pts.map((p) => p.x)) + DROP.d) * fs, h = (Math.max(...pts.map((p) => p.y)) + DROP.d) * fs;
        const life = n * GROW + HOLD(n, T) + n * POP + POP_T, rise = still ? 0 : RISE * H, drift = still ? 0 : DRIFT * H * life, m = 0.3 * DROP.d * fs;
        const others = blocks.filter((o) => o !== b && o.on).map((o) => o.swept);
        const tries: { x: number; y: number; dir: number; swept: number[] }[] = [];
        for (let y = 0.06 * H; y + h + rise <= S.land - 0.02 * H; y += 0.04 * H)
          for (let x = 0.03 * W; x + drift + w <= 0.97 * W; x += 0.025 * W) {
            const swept = [x - m, y - m, x + drift + w + m, y + h + rise + m];
            if (S.letters.some((r) => hit(swept, r)) || others.some((r) => hit(swept, r))) continue;
            for (const dir of [1, -1]) tries.push({ x: dir > 0 ? x : x + drift, y, dir, swept });
          }
        if (!tries.length) { b.next = sec + T; return; }
        const t = tries[Math.floor(Math.random() * tries.length)], { f, shape, color } = look(b.msg), s = DROP.d * fs;
        const seed0 = [...b.msg.text].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
        b.bubbles = pts.map((p, i) => {
          const pl = placeGlyph(p.ch, shape, f.weight, f.slant), d = document.createElement('div'), cv = document.createElement('canvas'), span = document.createElement('span');
          d.className = 'rain-drop'; d.style.width = d.style.height = `${s}px`; d.style.opacity = '0';
          drawDrop(cv, fs, Math.min(2, window.devicePixelRatio || 1), color, pl.box, seed0 + i * 13);
          span.textContent = p.ch;
          span.style.cssText = `left:${(pl.tx * fs).toFixed(2)}px;top:${((pl.ty - base) * fs).toFixed(2)}px;font:${fs}px/1 ${family};` +
            `color:${color};font-variation-settings:${f.variation};transform-origin:0 ${base}em;transform:skewX(${-f.slant}deg)`;
          d.append(cv, span); el.append(d);
          return { el: d, x: p.x * fs, y: p.y * fs, ph: [((seed0 + i * 7919) % 628) / 100, ((seed0 + i * 104729) % 628) / 100] };
        });
        Object.assign(b, { on: true, fs, t0: sec, x: t.x, y: t.y, dir: t.dir, swept: t.swept, popAt: sec + n * GROW + HOLD(n, T) });
      };
      const loop = () => {
        if (dead) return;
        const sec = performance.now() / 1000, S = sceneRef.current(), W = window.innerWidth, H = window.innerHeight;
        for (const b of blocks) {
          if (b.msg.id === hideRef.current) { if (b.on) stop(b, sec); continue; }
          if (!b.on) { if (sec >= b.next) start(b, sec, S, W, H); if (!b.on) continue; }
          const age = sec - b.t0, mo = bubbleMotionOf(b.msg.tone?.align), fs = b.fs;
          // 덩어리 자리 — 떠오르며(처음 RISE_T 동안, 차츰 느려진다) 바람 따라 옆으로
          const up = still ? 0 : RISE * H * (1 - ease(Math.min(1, age / (RISE_T * T)))), side = still ? 0 : b.dir * DRIFT * H * age;
          let alive = false;
          b.bubbles.forEach((q, i) => {
            const pk = (sec - (b.popAt + i * POP)) / POP_T;   // 터짐 — 0에서 1로
            if (pk >= 1) { if (q.el.isConnected) q.el.remove(); return; }
            alive = true;
            const grow = Math.min(1, Math.max(0, (age - i * GROW) / (2 * GROW)));
            const [dx, dy, sx, sy] = still ? [0, 0, 1, 1] : bubbleMove(mo, i, sec, q.ph, T, b.msg.tone?.speed);
            const k = still ? 1 : pk > 0 ? 1 + 0.3 * pk : 0.6 + 0.4 * grow;
            const op = still ? (pk > 0 ? 0 : 1) : pk > 0 ? 1 - pk : grow;
            q.el.style.opacity = op.toFixed(3);
            q.el.style.transform = `translate3d(${(b.x + side + q.x + dx * fs).toFixed(1)}px, ${(b.y + up + q.y + dy * fs).toFixed(1)}px, 0) scale(${(sx * k).toFixed(3)}, ${(sy * k).toFixed(3)})`;
          });
          if (!alive) stop(b, sec);
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };
    go();
    return () => { dead = true; cancelAnimationFrame(raf); for (const b of blocks) for (const q of b.bubbles) q.el.remove(); };
  }, [key]);

  return <div ref={layer} className="wall-rain" aria-hidden="true" />;
});
