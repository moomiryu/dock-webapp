import { useEffect, useRef } from 'react';
import { BIRD_PHOTOS, RAVEN_FLY } from '../lib/birdPhoto.data';

/**
 * 하늘을 나는 새 떼 — 글 없는 풍경(2026-10-07). 마네킹 나무처럼 한 색(--grey-800) 윤곽으로 화면의 빈 곳을 채운다.
 *
 * 글 수와 상관없이 늘 FLOCK마리. 풍경 뒤 겹(.wall-scenery)에 있어서 글 뒤로만 지나가고, 글을 가리거나 글과 부딪힐 일이 없다.
 * 재료는 유머있는의 사진 새(birdPhoto.data.ts) — 작은 새 아홉 + 큰까마귀. 날갯짓 세 장면(올림 · 수평 · 내림)을 돌려 가며 보인다.
 * 한쪽으로 나가면 다른 새가 반대편에서 들어온다. 움직임 줄이기를 켠 화면에서는 가만히 선다.
 *
 * 수치는 눈으로 고른 첫 값이다 — 벽에서 보고 고친다.
 */

/** 한 번에 나는 새의 수 */
const FLOCK = 7;
/** 새의 긴 쪽 길이 — 벽 높이의 이 비율 안에서 새마다 다르다 */
const SIZE: [number, number] = [0.016, 0.034];   // 처음 [0.028, 0.062] — "왼쪽 너무 커, 오른쪽 것만큼이 최대"(디자이너 10-07)
/** 나는 높이 — 벽 높이의 이 비율 사이(위에서부터). 땅과 나무 꼭대기 위쪽의 하늘 */
const SKY: [number, number] = [0.07, 0.55];
/** 한 번 가로지르는 데 걸리는 초 — 큰 새일수록 느리게 지나간다 */
const CROSS_S: [number, number] = [38, 85];
/** 날갯짓 한 바퀴(올림 → 수평 → 내림 → 수평)의 초 */
const FLAP_S: [number, number] = [0.55, 0.85];
/** 위아래로 출렁이는 폭(새 크기의 몇 배)과 한 번 출렁이는 초 */
const BOB = 0.35, BOB_S = 4;
/** 큰까마귀를 섞는 비율 */
const RAVEN_SHARE = 0.25;

type Pts = readonly (readonly [number, number])[];
interface Species { w: number; h: number; face: 1 | -1; poses: [Pts, Pts, Pts] }   // 올림 · 수평 · 내림

const SPECIES: Species[] = BIRD_PHOTOS.flatMap((b) => (b.fly ? [{ w: b.w, h: b.h, face: b.face, poses: [b.fly.up, b.fly.mid, b.fly.down] as [Pts, Pts, Pts] }] : []));
const RAVEN: Species = { w: RAVEN_FLY.w, h: RAVEN_FLY.h, face: -1, poses: [RAVEN_FLY.up, RAVEN_FLY.mid, RAVEN_FLY.down] };

const pathOf = (P: Pts) => `M${P.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L')}Z`;
const between = ([a, b]: [number, number]) => a + Math.random() * (b - a);
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

interface Bird { sp: Species; size: number; dir: 1 | -1; y: number; x: number; speed: number; flap: number; phase: number }

export default function WallFlock() {
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const root = svg.current;
    if (!root) return;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)');
    let W = window.innerWidth, H = window.innerHeight;

    const spawn = (anywhere: boolean): Bird => {
      const sp = Math.random() < RAVEN_SHARE ? RAVEN : pick(SPECIES);
      const size = between(SIZE) * H, dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
      // 큰 새일수록 느리게(원근) — 지나가는 초는 크기에 비례해 늘린다
      const t = between(CROSS_S) * (0.8 + 0.6 * ((size / H - SIZE[0]) / (SIZE[1] - SIZE[0])));
      const speed = (W + size * 2) / t;
      const x = anywhere ? Math.random() * W : dir === 1 ? -size : W + size;
      return { sp, size, dir, y: between(SKY) * H, x, speed, flap: between(FLAP_S), phase: Math.random() };
    };
    let birds = Array.from({ length: FLOCK }, () => spawn(true));

    const color = getComputedStyle(document.documentElement).getPropertyValue('--grey-800').trim();
    const NS = 'http://www.w3.org/2000/svg';
    const nodes = birds.map(() => ({ g: document.createElementNS(NS, 'g'), p: [0, 1, 2].map(() => document.createElementNS(NS, 'path')) }));
    nodes.forEach((n) => { n.p.forEach((p) => { p.setAttribute('fill', color); n.g.appendChild(p); }); root.appendChild(n.g); });
    const fit = (i: number) => nodes[i].p.forEach((p, k) => p.setAttribute('d', pathOf(birds[i].sp.poses[k])));
    birds.forEach((_, i) => fit(i));

    const place = (i: number, sec: number) => {
      const b = birds[i], n = nodes[i];
      const s = b.size / b.sp.w;
      const bob = Math.sin(2 * Math.PI * (sec / BOB_S + b.phase)) * BOB * b.size;
      // 머리가 가는 쪽을 보게 — 그림의 머리 방향(face)과 가는 방향(dir)이 같으면 그대로, 다르면 뒤집는다
      n.g.setAttribute('transform', `translate(${b.x.toFixed(1)} ${(b.y + bob).toFixed(1)}) scale(${b.dir * b.sp.face * s} ${s}) translate(${-b.sp.w / 2} ${-b.sp.h / 2})`);
      // 올림 → 수평 → 내림 → 수평
      const k = reduce.matches ? 1 : [0, 1, 2, 1][Math.floor(((sec / b.flap + b.phase) % 1) * 4)];
      n.p.forEach((p, j) => p.setAttribute('visibility', j === k ? 'visible' : 'hidden'));
    };

    let raf = 0, last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      birds.forEach((b, i) => {
        if (!reduce.matches) {
          b.x += b.dir * b.speed * dt;
          if ((b.dir === 1 && b.x > W + b.size) || (b.dir === -1 && b.x < -b.size)) { birds[i] = spawn(false); fit(i); }
        }
        place(i, now / 1000);
      });
    };
    raf = requestAnimationFrame(frame);
    const onResize = () => { W = window.innerWidth; H = window.innerHeight; };
    window.addEventListener('resize', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      nodes.forEach((n) => n.g.remove());
    };
  }, []);

  return <svg ref={svg} className="wall-flock" aria-hidden="true" focusable="false" />;
}
