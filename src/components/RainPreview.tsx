import { useEffect, useRef } from 'react';
import { formFor, fontMap, type RainShape } from '../lib/palettes';
import { DROP, bubbleLayout, bubbleMotionOf, bubbleMove, drawDrop, placeGlyph, rainBaseline, rainColor, rainFontsReady } from '../lib/rain';

/**
 * 유머있는(비눗방울)의 미리보기 — 폰 4/5 · 5/5와 벽의 크게 보여 주기. 2026-10-06부터 **글 전체를 한 화면에** 담고(디자이너 —
 * "4단계에서는 최소한 정지") 방울만 제자리 근처에서 떠다닌다 — 살랑이 기본, 모양 칸이 둥실 · 흔들을 더한다(lib/rain.ts bubbleMove).
 * 그전에는 75° 줄기가 위에서 계속 내려와 긴 글은 한 번에 다 보이지 않았다. 움직임을 줄이면 멈춰 선다.
 * 배치는 왼쪽 위에서 시작하는 가로줄(lib/rain.ts bubbleLayout) — 무대 가운데에 놓고, 넘치면 원을 줄인다.
 * 머리줄(진행 점 · 닫기)이 무대 위에 겹쳐 떠 있으면(4/5 고르는 장) 그 아랫선 밑에만 놓는다.
 * 색만 바뀔 때는 다시 놓지 않고 빗방울을 다시 칠한다 — 4/5 첫 장의 색 시연이 색을 차례로 바꾼다.
 */
interface Props {
  text: string;
  /** 글의 색(원 선 · 명암 · 글자 모두 이 한 색) */
  color: string;
  shape: RainShape;
  /** 4/5 모양 칸의 값(tone.align) — 떠다니는 움직임(기본 · 둥실 · 흔들) */
  motion?: string;
  speed?: number;
  weight?: number;
  /** 말투가 적힌 옛 글(벽의 크게 보여 주기) — 그때의 자형 그대로(palettes.ts formFor) */
  manner?: number;
}

export default function RainPreview({ text, color, shape, motion, speed, weight, manner }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  color = rainColor(color);
  const colorRef = useRef(color);
  /** 놓인 빗방울 — 색만 바뀔 때 다시 칠한다 */
  const live = useRef<{ cv: HTMLCanvasElement; span: HTMLSpanElement; box: [number, number, number, number]; fs: number; dpr: number; seed: number }[]>([]);

  useEffect(() => {
    colorRef.current = color;
    for (const d of live.current) { drawDrop(d.cv, d.fs, d.dpr, color, d.box, d.seed); d.span.style.color = color; }
  }, [color]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let dead = false, raf = 0;
    const form = formFor({ font: 'deulseok', speed: speed ?? 0.5, weight: weight ?? 0.5, align: shape, manner });
    const family = fontMap.deulseok;
    const clear = () => { el.querySelectorAll('.rain-drop').forEach((n) => n.remove()); live.current = []; };
    const go = async () => {
      await rainFontsReady();
      if (dead) return;
      const base = rainBaseline(family);
      const W = el.clientWidth, H = el.clientHeight;
      if (!W || !H) return;
      const hdr = el.closest('.proj-frame, section')?.querySelector('.compose-chrome, .step-header');
      const top = hdr ? Math.max(0, hdr.getBoundingClientRect().bottom - el.getBoundingClientRect().top) : 0;
      const pts = bubbleLayout(text), R1 = DROP.d / 2;
      if (!pts.length) return;
      const x0 = Math.min(...pts.map((p) => p.x)) - R1, x1 = Math.max(...pts.map((p) => p.x)) + R1;
      const y0 = Math.min(...pts.map((p) => p.y)) - R1, y1 = Math.max(...pts.map((p) => p.y)) + R1;
      // 글자 크기 — 높이의 6%(폰 35px 안팎 · 벽의 크게 보여 주기 65px)까지, 넘치면 무대(둘레 8% 비움 — 떠다닐 자리)에 맞춰 줄인다
      const m = 0.08 * W, cap = Math.max(28, Math.min(72, H * 0.06));
      const fs = Math.min(cap, (W - 2 * m) / (x1 - x0), (H - top - 2 * m) / (y1 - y0)), dpr = Math.min(3, window.devicePixelRatio || 1);
      const s = DROP.d * fs, ox = (W - (x1 - x0) * fs) / 2 - x0 * fs, oy = top + (H - top - (y1 - y0) * fs) / 2 - y0 * fs;
      const seed0 = [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
      const placed: { el: HTMLDivElement; x: number; y: number; ph: [number, number] }[] = [];
      pts.forEach(({ ch, x, y }, i) => {
        const p = placeGlyph(ch, shape, form.weight, form.slant);
        const d = document.createElement('div'), cv = document.createElement('canvas'), span = document.createElement('span');
        d.className = 'rain-drop'; d.style.width = d.style.height = `${s}px`;
        const px = ox + x * fs - s / 2, py = oy + y * fs - s / 2;
        d.style.transform = `translate3d(${px.toFixed(1)}px, ${py.toFixed(1)}px, 0)`;
        // 방울마다 다른 위상 — 글에서 정해진다(같은 글은 늘 같은 결)
        placed.push({ el: d, x: px, y: py, ph: [((seed0 + i * 7919) % 628) / 100, ((seed0 + i * 104729) % 628) / 100] });
        drawDrop(cv, fs, dpr, colorRef.current, p.box, seed0 + i * 13);
        span.textContent = ch;
        span.style.cssText = `left:${(p.tx * fs).toFixed(2)}px;top:${((p.ty - base) * fs).toFixed(2)}px;font:${fs}px/1 ${family};` +
          `color:${colorRef.current};font-variation-settings:${form.variation};transform-origin:0 ${base}em;transform:skewX(${-form.slant}deg)`;
        d.append(cv, span); el.append(d);
        live.current.push({ cv, span, box: p.box, fs, dpr, seed: seed0 + i * 13 });
      });
      if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const m2 = bubbleMotionOf(motion), tv = getComputedStyle(document.documentElement).getPropertyValue('--t-hold').trim();
      const T = tv.endsWith('ms') ? parseFloat(tv) / 1000 : parseFloat(tv) || 0.7;
      const loop = () => {
        if (dead) return;
        const t = performance.now() / 1000;
        placed.forEach((q, i) => {
          const [dx, dy, sx, sy] = bubbleMove(m2, i, t, q.ph, T, speed);
          q.el.style.transform = `translate3d(${(q.x + dx * fs).toFixed(1)}px, ${(q.y + dy * fs).toFixed(1)}px, 0) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
        });
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };
    clear();
    go();
    return () => { dead = true; cancelAnimationFrame(raf); clear(); };
  }, [text, shape, motion, speed, weight, manner]);

  return <div ref={stage} className="rain-stage" role="img" aria-label={text} />;
}
