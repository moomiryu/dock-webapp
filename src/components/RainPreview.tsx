import { useEffect, useRef } from 'react';
import { formFor, fontMap, type RainShape } from '../lib/palettes';
import { DROP, drawDrop, placeGlyph, rainBaseline, rainColor, rainFontsReady, secPerChar, slotsOf, streamDir } from '../lib/rain';

/**
 * 유머있는(비)의 폰 미리보기(4/5 · 5/5, 2026-10-04 디자이너 — "내리는 줄기"). 벽처럼 75° 줄기가 무대 위에서 내려와 밑으로 잠기고,
 * 다 잠기면 잠깐 쉬었다 다시 내린다. 글자는 고른 모양 · 무게 · 빠르기(기울기)로, 빠르기는 내리는 빠르기도 정한다(lib/rain.ts).
 * 무대에는 구름이 없어 줄기는 무대 위 가장자리에서 나온다 — 머리줄(진행 점 · 닫기)이 무대 위에 겹쳐 떠 있으면 그 아랫선에서. 움직임 줄이기에서는 줄기를 멈춰 세운다(가운데 글자가 무대 가운데).
 * 색만 바뀔 때는 처음부터 다시 내리지 않고 떠 있는 빗방울을 다시 칠한다 — 4/5 첫 장의 색 시연이 색을 차례로 바꾼다.
 */
interface Props {
  text: string;
  /** 글의 색(원 선 · 명암 · 글자 모두 이 한 색) */
  color: string;
  shape: RainShape;
  speed?: number;
  weight?: number;
  /** 말투가 적힌 옛 글(벽의 크게 보여 주기) — 그때의 자형 그대로(palettes.ts formFor) */
  manner?: number;
}
/** 다 잠긴 뒤 다시 내리기까지(--t-hold의 배수) */
const REST = 2;

export default function RainPreview({ text, color, shape, speed, weight, manner }: Props) {
  const stage = useRef<HTMLDivElement>(null);
  color = rainColor(color);
  const colorRef = useRef(color);
  /** 떠 있는 빗방울 — 색만 바뀔 때 다시 칠한다 */
  const live = useRef<{ cv: HTMLCanvasElement; span: HTMLSpanElement; box: [number, number, number, number]; fs: number; dpr: number; seed: number }[]>([]);

  useEffect(() => {
    colorRef.current = color;
    for (const d of live.current) { drawDrop(d.cv, d.fs, d.dpr, color, d.box, d.seed); d.span.style.color = color; }
  }, [color]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let raf = 0, dead = false;
    const form = formFor({ font: 'deulseok', speed: speed ?? 0.5, weight: weight ?? 0.5, align: shape, manner });
    const family = fontMap.deulseok;
    const still = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const holdS = (() => { const v = getComputedStyle(document.documentElement).getPropertyValue('--t-hold').trim(); return v.endsWith('ms') ? parseFloat(v) / 1000 : parseFloat(v) || 0.7; })();
    const clear = () => { el.querySelectorAll('.rain-drop').forEach((n) => n.remove()); live.current = []; };

    const go = async () => {
      await rainFontsReady();
      if (dead) return;
      const base = rainBaseline(family);
      const W = el.clientWidth, H = el.clientHeight;
      if (!W || !H) return;
      // 같은 화면의 머리줄이 무대 위에 겹쳐 있으면(4/5 고르는 장) 그 아랫선부터 내리고 위는 가린다
      const hdr = el.closest('.proj-frame, section')?.querySelector('.compose-chrome, .step-header');
      const top = hdr ? Math.max(0, hdr.getBoundingClientRect().bottom - el.getBoundingClientRect().top) : 0;
      el.style.clipPath = top ? `inset(${top}px 0 0 0)` : '';
      // 글자 크기 — 무대 폭의 10% · 높이의 6% 중 작은 쪽(폰 390 폭에서 36px 안팎, 벽의 크게 보여 주기 1080에서 65px), 28 ~ 72px
      const fs = Math.round(Math.min(72, Math.max(28, Math.min(W * 0.1, H * 0.06)))), dpr = Math.min(3, window.devicePixelRatio || 1);
      const s = DROP.d * fs, R = s / 2, [dx, dy] = streamDir(), slots = slotsOf(text);
      // 줄기가 무대 가운데를 지나게 — 위(−R)에서 들어와 밑(H + R)으로 나간다
      const travel = ((H - top + 2 * R) / dy) * -dx, E: [number, number] = [W / 2 + travel / 2, top - R];
      const seed0 = [...text].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
      const make = (ch: string, i: number) => {
        const p = placeGlyph(ch, shape, form.weight, form.slant);
        const d = document.createElement('div'), cv = document.createElement('canvas'), span = document.createElement('span');
        d.className = 'rain-drop'; d.style.width = d.style.height = `${s}px`;
        drawDrop(cv, fs, dpr, colorRef.current, p.box, seed0 + i * 13);
        span.textContent = ch;
        span.style.cssText = `left:${(p.tx * fs).toFixed(2)}px;top:${((p.ty - base) * fs).toFixed(2)}px;font:${fs}px/1 ${family};` +
          `color:${colorRef.current};font-variation-settings:${form.variation};transform-origin:0 ${base}em;transform:skewX(${-form.slant}deg)`;
        d.append(cv, span); el.append(d);
        live.current.push({ cv, span, box: p.box, fs, dpr, seed: seed0 + i * 13 });
        return d;
      };
      const put = (d: HTMLElement, u: number) => {
        d.style.transform = `translate3d(${(E[0] + u * dx - R).toFixed(1)}px, ${(E[1] + u * dy - R).toFixed(1)}px, 0)`;
      };
      if (still) {
        // 멈춘 줄기 — 가운데 글자가 무대 가운데에
        const mid = slots.length ? slots[Math.floor((slots.length - 1) / 2)].at * fs : 0, uMid = Math.hypot(W / 2 - E[0], (H + top) / 2 - E[1]);
        slots.forEach((sl, i) => {
          const u = uMid + mid - sl.at * fs, y = E[1] + u * dy;
          if (y < top - R || y > H + R) return;
          put(make(sl.ch, i), u);
        });
        return;
      }
      const v = ((DROP.d + DROP.gap) * fs) / secPerChar(speed);
      const last = slots.length ? slots[slots.length - 1].at * fs : 0, gone = (H - top + 2 * R) / dy + R;
      let t0 = performance.now() / 1000, made: (HTMLElement | null)[] = [];
      const loop = () => {
        if (dead) return;
        const u0 = v * (performance.now() / 1000 - t0);
        slots.forEach((sl, i) => {
          const u = u0 - sl.at * fs;
          if (u < 0) return;
          if (u > gone) { if (made[i]) { made[i]!.remove(); made[i] = null; } return; }
          if (made[i] === undefined) made[i] = make(sl.ch, i);
          if (made[i]) put(made[i]!, u);
        });
        // 다 잠기면 쉬었다 처음부터
        if (u0 - last > gone + v * REST * holdS) { clear(); made = []; t0 = performance.now() / 1000; }
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
    };
    clear();
    go();
    return () => { dead = true; cancelAnimationFrame(raf); clear(); };
  }, [text, shape, speed, weight, manner]);

  return <div ref={stage} className="rain-stage" role="img" aria-label={text} />;
}
