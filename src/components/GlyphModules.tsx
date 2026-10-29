import { useEffect, useRef, type RefObject } from 'react';
import { RF, kindOf, modulesAt, type Item } from '../lib/aggregate';

/**
 * 03 조율의 글자 뒤 모듈(2026-10-20, 결정 18 — 견본 out-03/sheet.png 오른쪽 B). 03은 글자 모양(크기 · 속도 · 무게)을 고르는 화면이라
 * 글은 그대로 두고, 글자마다 **뒤에** 그 성격의 모듈(당당 사각 · 다정 원 · 차분 육각 · 유머 별 — lib/aggregate modulesAt, 점 + 칠)을
 * 하나씩 깐다. 말풍선 안에 넣는 안(A)은 글자가 모듈마다 벌어져 고르는 모양이 덜 보였다.
 * - 크기: u = 그 글자의 글자 크기 / 0.85(벽 · 폰 말풍선과 같은 감싸는 비율). 가운데 = 글자 상자 가운데(Range로 잰다). 기울이지 않는다.
 * - 색: --paper로 다 그린 뒤 한 장째 --module-faint만큼 옅게(.glyph-modules opacity) — 이웃 모듈이 겹친 곳도 한 번 칠한 것처럼.
 * - 글자 자리는 매 장면 다시 재고, 바뀌었을 때만 다시 그린다 — 크기 · 속도 · 무게를 바꿀 때도, 첫 장의 훑기 시연 중에도 따라간다.
 * 캔버스는 글을 든 칸의 맨 뒤(app.css .glyph-modules · 칸이 한 겹으로 묶인다).
 */
export default function GlyphModules({ of, font }: { of: RefObject<HTMLElement | null>; font: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current, ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const one: Item = { ch: '가', li: 0, x: 0, y: 0, a: 0, p: 0, ax: 0, ay: 0 }, { dots, polys } = modulesAt([one], kindOf(font), 1);
    const paper = getComputedStyle(document.documentElement).getPropertyValue('--paper').trim(), range = document.createRange();
    let raf = 0, sig = '';
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const el = of.current;
      if (!el) return;
      /* 그림판은 바탕이라 좌우 여백을 무시하고 견본 칸(.z-glyph-stage — 화면 끝에서 끝까지인 빨간 면) 양끝까지 넓힌다(2026-10-20, 결정 33 —
         글 칸에 붙어 있어 큰 모듈이 여백선에서 곧게 잘렸다. 디자이너 "이런 창은 여백 무시하면 안 됨?"). 넘친 것은 그 칸이 화면 끝에서 자른다.
         자리는 아래에서 그림판 자신을 기준으로 재므로 넓혀도 그대로 맞는다 */
      const wide = cv.closest('.z-glyph-stage'), host = cv.parentElement;
      if (wide && host) {
        const w = wide.getBoundingClientRect(), hr = host.getBoundingClientRect();
        const left = `${(w.left - hr.left).toFixed(1)}px`, width = `${w.width.toFixed(1)}px`;
        if (cv.style.left !== left) cv.style.left = left;
        if (cv.style.width !== width) cv.style.width = width;
      }
      const box = cv.getBoundingClientRect(), marks: [number, number, number][] = [];
      const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode() as Text | null; n; n = walk.nextNode() as Text | null) {
        /* 첫 장의 크기 훑기는 글자 크기가 아니라 배율 --demo-k다(app.css .tone-figure-text, 2026-10-29) — 모듈도 그만큼 */
        const cs = getComputedStyle(n.parentElement ?? el);
        const u = (parseFloat(cs.fontSize) * (parseFloat(cs.getPropertyValue('--demo-k')) || 1)) / 0.85;
        for (let i = 0; i < n.length; i++) {
          if (!n.data[i].trim()) continue;
          range.setStart(n, i); range.setEnd(n, i + 1);
          const b = range.getBoundingClientRect();
          marks.push([b.left + b.width / 2 - box.left, b.top + b.height / 2 - box.top, u]);
        }
      }
      const next = `${box.width.toFixed(1)}x${box.height.toFixed(1)}|${marks.map((m) => m.map((v) => v.toFixed(1)).join(',')).join(';')}`;
      if (next === sig) return;
      sig = next;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      /* 판 크기가 같으면 새로 만들지 않고 지우기만 한다 — 첫 장의 훑기는 매 장면 다시 그린다(2026-10-29 점검) */
      const W = Math.round(box.width * dpr), H = Math.round(box.height * dpr);
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
      else { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H); }
      ctx.fillStyle = paper;
      for (const [x, y, u] of marks) {
        ctx.setTransform(u * dpr, 0, 0, u * dpr, x * dpr, y * dpr);
        for (const Q of polys) { ctx.beginPath(); Q.forEach(([qx, qy]) => ctx.lineTo(qx, qy)); ctx.closePath(); ctx.fill(); }
        ctx.beginPath();
        for (const d of dots) { ctx.moveTo(d.x + RF * d.r, d.y); ctx.arc(d.x, d.y, RF * d.r, 0, 2 * Math.PI); }
        ctx.fill();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [of, font]);
  return <canvas ref={ref} className="glyph-modules" aria-hidden="true" />;
}
