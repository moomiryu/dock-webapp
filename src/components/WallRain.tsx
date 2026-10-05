import { memo, useEffect, useRef } from 'react';
import type { StoredMessage } from '../lib/firebase';
import { formFor, fontMap, rainShapeOf } from '../lib/palettes';
import { messageColors } from '../lib/messageStyle';
import { DROP, STREAM, drawDrop, placeGlyph, rainBaseline, rainColor, rainFontsReady, secPerChar, slotsOf, streamDir } from '../lib/rain';

/**
 * 벽의 비(유머있는, 2026-10-04 디자이너). 글마다 한 줄기 — 구름 밑에서 75°로 내려와 땅(땅 띠의 윗선)에 닿으면 첫 글자부터 땅 밑으로
 * 잠기고, 몇 초 쉬었다가 다른 구름에서 다시 내린다. 구름이 없으면 하늘 위 가장자리에서.
 *
 * 피하는 규칙(디자이너 — "피하는 규칙도 잘 세워야겠노"): 줄기는 구름보다 뒤, 나무 · 돌보다 앞에 그린다(벽이 이 층을 그 사이에 둔다).
 * 그래서 **글자를 가리지 않는 것**이 규칙이다 — 줄기가 지나갈 길 전체가 나무 · 돌 · 떠다니는 말 · 다른 구름의 글자 자리(둘레 여유
 * 포함)를 비키고, 내리는 다른 줄기와 원 두 개 폭 넘게 떨어진 길에서만 출발한다. 구름의 몸 뒤로 지나는 것은 괜찮다(구름이 앞이다).
 * 그런 길이 없으면 기다렸다가 다시 찾는다. 길은 출발할 때 한 번 보고 나오는 자리를 그 자리에 둔다 — 흐르는 구름을 따라 옮겼더니
 * 확인한 길에서 벗어나 글자를 스쳤다(2026-10-06, 재서 알았다). 구름은 느리게 흘러 줄기 하나가 내리는 동안 몸 밑을 벗어나지 않는다.
 */
export interface RainScene {
  /** 구름 — 가운데 · 반폭 · 반높이(px), 글자 자리(둘레 여유 포함 — 다른 구름에서 나온 줄기가 비킨다) */
  clouds: { id: string; x: number; y: number; hw: number; hh: number; letters: [number, number, number, number] | null }[];
  /** 비켜야 할 글자 자리(둘레 여유 포함, px) */
  letters: [number, number, number, number][];
  /** 땅의 윗선(px) — 여기서 잠긴다 */
  land: number;
}
type Drop = { el: HTMLDivElement; p: [number, number]; te: number };
type Stream = {
  msg: StoredMessage; next: number; run: boolean; src: string | null; last: string | null;
  E: [number, number]; t0: number; v: number; slots: { ch: string; at: number }[]; made: (Drop | null | undefined)[];
};
/** 다 잠긴 뒤 다시 내리기까지(--t-hold의 배수 사이) */
const REST: [number, number] = [4, 10];
const holdS = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--t-hold').trim(); return v.endsWith('ms') ? parseFloat(v) / 1000 : parseFloat(v) || 0.7; };
const hit = (a: number[], b: number[]) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

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
    const streams: Stream[] = msgs.map((msg, i) => ({ msg, next: now0 + i * 2.2 * T + Math.random() * 2 * T, run: false, src: null, last: null,
      E: [0, 0], t0: 0, v: 0, slots: slotsOf(msg.text), made: [] }));
    const stop = (st: Stream, sec: number) => {
      for (const d of st.made) d?.el.remove();
      st.made = []; st.run = false; st.last = st.src; st.src = null; st.next = sec + (REST[0] + Math.random() * (REST[1] - REST[0])) * T;
    };
    const go = async () => {
      await rainFontsReady();
      if (dead) return;
      const family = fontMap.deulseok, base = rainBaseline(family), [dx, dy] = streamDir(), nx = dy, ny = -dx;
      const look = (st: Stream) => {
        const tone = st.msg.tone, f = formFor({ ...tone, font: 'deulseok', align: tone?.align });   // 옛 서체 키(song)도 유머있는으로
        return { f, shape: rainShapeOf(tone?.align), color: rainColor(tone ? messageColors(tone).bg : '#FFFFFF') };
      };
      const mouth = (c: RainScene['clouds'][number], ex: number, R: number): [number, number] => [c.x + ex * c.hw, c.y + c.hh - R];
      const xAt = (E: [number, number], y: number) => E[0] + ((y - E[1]) / dy) * dx;
      /** 출발 — 길이 트인 구름 · 자리를 고른다. 없으면 기다린다 */
      const start = (st: Stream, sec: number, S: RainScene, fs: number) => {
        const D = DROP.d * fs, R = D / 2, W = window.innerWidth, g = 0.2 * D;
        const others = streams.filter((o) => o !== st && o.run).map((o) => o.E);
        const busy = new Set(streams.filter((o) => o.run).map((o) => o.src));
        const tries: { src: string | null; E: [number, number] }[] = [];
        const free = S.clouds.filter((c) => !busy.has(c.id) && c.id !== st.last);
        for (const c of (free.length ? free : S.clouds.filter((c) => !busy.has(c.id))))
          for (const ex of [-0.6, -0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45, 0.6]) tries.push({ src: c.id, E: mouth(c, ex + (Math.random() - 0.5) * 0.1, R) });
        if (!S.clouds.length) for (let k = 2; k <= 19; k++) tries.push({ src: null, E: [(k / 20) * W, -R] });
        const ok = tries.filter((o) => {
          if (others.some((q) => Math.abs((o.E[0] - q[0]) * nx + (o.E[1] - q[1]) * ny) < 2.2 * D)) return false;
          const land = xAt(o.E, S.land);
          if (land < R || land > W - R) return false;
          const blocks = [...S.letters, ...S.clouds.filter((c) => c.id !== o.src && c.letters).map((c) => c.letters!)];
          const y0 = o.src ? o.E[1] + 2 * R : 0;
          for (let y = y0; y <= S.land; y += 0.5 * D) {
            const x = xAt(o.E, y), r = [x - R - g, y - R - g, x + R + g, y + R + g];
            if (blocks.some((b) => hit(r, b))) return false;
          }
          return true;
        });
        if (!ok.length) { st.next = sec + T; return; }
        const pickd = ok[Math.floor(Math.random() * ok.length)];
        Object.assign(st, { run: true, src: pickd.src, E: pickd.E, t0: sec, v: ((DROP.d + DROP.gap) * fs) / secPerChar(st.msg.tone?.speed), made: [] });
      };
      const make = (st: Stream, ch: string, i: number, fs: number) => {
        const { f, shape, color } = look(st), p = placeGlyph(ch, shape, f.weight, f.slant), s = DROP.d * fs;
        const d = document.createElement('div'), cv = document.createElement('canvas'), span = document.createElement('span');
        d.className = 'rain-drop'; d.style.width = d.style.height = `${s}px`;
        drawDrop(cv, fs, Math.min(2, window.devicePixelRatio || 1), color, p.box, i * 13 + st.msg.text.length);
        span.textContent = ch;
        span.style.cssText = `left:${(p.tx * fs).toFixed(2)}px;top:${((p.ty - base) * fs).toFixed(2)}px;font:${fs}px/1 ${family};` +
          `color:${color};font-variation-settings:${f.variation};transform-origin:0 ${base}em;transform:skewX(${-f.slant}deg)`;
        d.append(cv, span); el.append(d);
        return d;
      };
      let clip = '';
      const loop = () => {
        if (dead) return;
        const sec = performance.now() / 1000, S = sceneRef.current(), H = window.innerHeight;
        const fs = Math.round(H * STREAM.wallFs), R = (DROP.d * fs) / 2;
        // 땅의 윗선 아래는 잘린다 — 땅 밑으로 잠긴다
        const c = `inset(0 0 ${Math.max(0, H - S.land).toFixed(0)}px 0)`;
        if (c !== clip) { el.style.clipPath = c; clip = c; }
        for (const st of streams) {
          if (st.msg.id === hideRef.current) { if (st.run) stop(st, sec); continue; }
          if (!st.run) { if (sec >= st.next) start(st, sec, S, fs); if (!st.run) continue; }
          // 움직임을 줄인 벽 — 줄기를 멈춰 세운다(맨 앞 글자가 땅 바로 위)
          const u0 = still ? (S.land - R - st.E[1]) / dy : st.v * (sec - st.t0);
          let alive = false;
          st.slots.forEach((sl, i) => {
            const u = u0 - sl.at * fs;
            if (u < 0) { alive = true; return; }
            let d = st.made[i];
            if (d === null) return;
            if (!d) { d = st.made[i] = { el: make(st, sl.ch, i, fs), p: [st.E[0], st.E[1]], te: sec - u / st.v }; if (still) d.p = [st.E[0], st.E[1]]; }
            const k = still ? u : st.v * (sec - d.te), x = d.p[0] + k * dx, y = d.p[1] + k * dy;
            if (y - R > S.land) { d.el.remove(); st.made[i] = null; return; }
            alive = true;
            d.el.style.transform = `translate3d(${(x - R).toFixed(1)}px, ${(y - R).toFixed(1)}px, 0)`;
          });
          if (!alive && !still) stop(st, sec);
        }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };
    go();
    return () => { dead = true; cancelAnimationFrame(raf); for (const st of streams) for (const d of st.made) d?.el.remove(); };
  }, [key]);

  return <div ref={layer} className="wall-rain" aria-hidden="true" />;
});
