import { useEffect, useRef } from 'react';
import { GRASS_PHOTOS } from '../lib/grassPhoto.data';
import { GROUND, MEADOW, WIND, groundPx, grainKnots, meadowFor, swellAt, type Plant } from '../lib/ground';

/**
 * 벽의 땅 — 화면 맨 아래 늘 같은 두께의 띠와 그 위의 사진 풀(2026-10-04). 값과 고른 까닭은 lib/ground.ts.
 *
 * 풍경(.wall-field) 위 · 큰 돌과 발화(같은 층)보다 뒤에 놓여 그 위에 그려진다 — 땅이 돌의 묻힌 아랫부분과 줄기 밑을 덮고,
 * 풀은 돌 · 나무 앞에 선다(디자이너). 확대해도 화면에 그대로 남는다(풍경과 따로 논다).
 *
 * 글을 가리지 않는다: 화면에 뜬 글자(.message-line-fill)의 자리를 읽어, 그 둘레에 걸린 포기는 서서히 걷고 글이 떠나면
 * 다시 돋운다(--t-slow). 벽 속 계산을 몰라도 되게 화면에서 읽는다 — 큰 돌 · 발화 · 확대된 글도 그대로 잡힌다.
 *
 * 바람은 30fps로 다시 그린다(띠 구름 · 나무와 같다). 움직임 줄이기를 켠 화면에서는 가만히 있고, 걷고 돋을 때만 다시 그린다.
 */

/** 시간 토큰(초) — 단위를 보고 읽는다: 빌드가 700ms를 .7s로 고쳐 적는다(CloudBubble · holdS와 같은 까닭) */
function tokenS(name: string, fallback: number): number {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return fallback;
  return /ms$/.test(v) ? n / 1000 : n;
}

const FPS = 30;
/** 글자 자리는 다시 그릴 때마다 읽는다 — 확대한 카메라가 훑는 동안 글이 빠르게 지나가, 200ms마다 읽고 천천히 걷었더니
    지나가는 글 위에 풀이 남았다(글자 픽셀의 1.5%, 2026-10-04 벽에서 잼) */
/** 휘는 띠 한 칸(px) — 2px마다 옆으로 옮겨 그린다(견본과 같다) */
const BAND = 2;

export default function WallGround() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const css = getComputedStyle(document.documentElement);
    const color = css.getPropertyValue('--grey-800').trim();
    const hold = tokenS('--t-hold', 0.7), slow = tokenS('--t-slow', 0.4), quick = tokenS('--t-return', 0.22);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    const knots = grainKnots();

    // 풀 그림 — 한 색 알파를 칠로 물들여 두고(그릴 때마다 물들이지 않게) 뒤집은 판도 같이 둔다
    const art: { fwd: HTMLCanvasElement; rev: HTMLCanvasElement }[] = [];
    let dirty = true;
    GRASS_PHOTOS.forEach((g, i) => {
      const img = new Image();
      img.onload = () => {
        const make = (flip: boolean) => {
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const x = c.getContext('2d')!;
          if (flip) { x.translate(c.width, 0); x.scale(-1, 1); }
          x.drawImage(img, 0, 0);
          x.setTransform(1, 0, 0, 1, 0, 0);
          x.globalCompositeOperation = 'source-in';
          x.fillStyle = color;
          x.fillRect(0, 0, c.width, c.height);
          return c;
        };
        art[i] = { fwd: make(false), rev: make(true) };
        dirty = true;
      };
      img.src = g.png;
    });

    let W = 0, H = 0, dpr = 1, ch = 0, floorY = 0;
    let plants: Plant[] = [], vis = new Float32Array(0), want = new Float32Array(0);
    let soil: HTMLCanvasElement | null = null;
    const layout = () => {
      W = window.innerWidth; H = window.innerHeight; dpr = window.devicePixelRatio || 1;
      // 캔버스 = 땅 + 그 위로 풀 · 굴곡이 솟는 만큼. floorY = 캔버스 안의 바닥선(땅의 곧은 윗선)
      floorY = Math.ceil(H * (MEADOW.hmax + GROUND.swell + 2 * GROUND.grain)) + 8;
      ch = floorY + groundPx(H);
      cv.width = Math.round(W * dpr); cv.height = Math.round(ch * dpr);
      cv.style.height = `${ch}px`;
      plants = meadowFor(W, H);
      vis = new Float32Array(plants.length).fill(1);
      want = new Float32Array(plants.length).fill(1);
      // 땅 띠는 창이 바뀔 때만 다시 그린다
      soil = document.createElement('canvas');
      soil.width = cv.width; soil.height = cv.height;
      const s = soil.getContext('2d')!;
      s.scale(dpr, dpr);
      s.fillStyle = color;
      s.beginPath(); s.moveTo(0, ch);
      for (let x = 0; x <= W + 2; x += 2) s.lineTo(x, floorY - swellAt(x, H, knots));
      s.lineTo(W, ch); s.closePath(); s.fill();
      dirty = true;
    };

    // 글 둘레 — 땅 가까이 뜬 글자의 자리를 읽어, 휜 끝까지 쳐서 걸린 포기는 걷는다
    const scan = () => {
      const top = H - ch, boxes: [number, number, number, number][] = [];
      document.querySelectorAll('.wall .message-line-fill').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.bottom < top - r.height * MEADOW.clear) return;
        const m = r.height * MEADOW.clear;   // 옆으로는 두 배 — 훑는 카메라를 따라 글이 옆으로 다가온다
        boxes.push([r.left - 2 * m, r.top - top - m, r.right + 2 * m, r.bottom - top + m]);
      });
      plants.forEach((p, i) => {
        const lean = WIND.lean * p.h;
        const x0 = p.x - lean, x1 = p.x + p.w + lean, y1 = floorY + p.bury, y0 = y1 - p.h;
        want[i] = boxes.some((b) => x0 < b[2] && x1 > b[0] && y0 < b[3] && y1 > b[1]) ? 0 : 1;
      });
    };

    const draw = (sec: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, cv.width, cv.height);
      if (soil) ctx.drawImage(soil, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const still = reduce.matches;
      plants.forEach((p, i) => {
        const a = art[p.shape];
        if (!a || vis[i] <= 0.01) return;
        const img = p.flip ? a.rev : a.fwd, sy = img.height / p.h;
        const cx = p.x + p.w / 2;
        const gust = 0.55 + 0.45 * Math.sin(2 * Math.PI * (sec / (hold * WIND.gust) - cx / W));
        const flutter = 0.65 + 0.35 * Math.sin(2 * Math.PI * (sec / (hold * WIND.flutter) - cx / (WIND.wave * H)) + p.jit);
        const lean = still ? 0 : WIND.lean * p.h * gust * flutter;
        const y0 = floorY + p.bury - p.h;
        ctx.globalAlpha = vis[i];
        if (!lean) { ctx.drawImage(img, p.x, y0, p.w, p.h); return; }
        for (let y = 0; y < p.h; y += BAND) {
          const r = 1 - y / p.h, bh = Math.min(BAND, p.h - y);
          ctx.drawImage(img, 0, y * sy, img.width, bh * sy, p.x + lean * r * r, y0 + y, p.w, bh);
        }
      });
      ctx.globalAlpha = 1;
    };

    let raf = 0, last = -Infinity;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (now - last < 1000 / FPS - 1) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      scan();
      let fading = false;
      for (let i = 0; i < vis.length; i++) if (vis[i] !== want[i]) {
        const d = want[i] - vis[i], stepV = dt / (d < 0 ? quick : slow);   // 걷을 땐 빨리(--t-return), 돋을 땐 천천히(--t-slow)
        vis[i] = Math.abs(d) <= stepV ? want[i] : vis[i] + Math.sign(d) * stepV;
        fading = true;
      }
      if (reduce.matches && !fading && !dirty) return;
      draw(now / 1000);
      dirty = false;
    };
    layout();
    raf = requestAnimationFrame(frame);
    window.addEventListener('resize', layout);
    const onReduce = () => { dirty = true; };
    reduce.addEventListener('change', onReduce);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', layout);
      reduce.removeEventListener('change', onReduce);
    };
  }, []);

  return <canvas ref={ref} className="wall-ground" aria-hidden="true" />;
}
