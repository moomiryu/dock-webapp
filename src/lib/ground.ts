/**
 * 벽의 땅 — 화면 맨 아래 늘 같은 두께의 띠, 그 위의 사진 풀(2026-10-04, 디자이너가 격자로 골랐다).
 * 고른 과정과 버린 것은 design/landscape.md '땅', 격자는 design/landscape-ground-* · landscape-grass-*.
 *
 * 바닥선 — 돌 · 나무가 서는 곳 — 은 땅의 **곧은 윗선**이다(groundPx). 벽은 풍경의 높이를 그만큼 줄여 계산한다(WallSimulation).
 * 굴곡은 그 위로만 솟아 돌 · 줄기의 발치를 몇 px 덮는다 — 아래로 파이면 그 위에 선 것의 밑에 빈틈이 생긴다.
 * 값은 모두 벽 높이에 비례한다(1080px 벽에서 고른 값 — U = 그 벽의 1px).
 */
import { GRASS_PHOTOS, type GrassSpecies } from './grassPhoto.data';

const U = 1 / 1080;

export const GROUND = {
  /** 두께 — 벽 높이의 3%(1080에서 32px, 실물 4cm). 지금 · 3 · 5 · 7 · 9 · 12% 중 — 9%부터 돌 키만 해져 무거웠고,
      확대해도 화면에 남는 띠라 얇을수록 덜 가린다 */
  thick: 0.03,
  /** 윗선 굴곡 — 0~10px로 완만히 오르내린다(세 파장의 사인을 섞는다: [파장, 몫, 시작]). 곧게 · 0~4 · 0~10 중 */
  swell: 10 * U,
  waves: [[900 * U, 0.5, 0.7], [520 * U, 0.3, 2.1], [330 * U, 0.2, 4.0]] as const,
  /** 그 위의 잔결 — ±1.5px, 10px마다 무작위 높이를 부드럽게 잇는다(찢은 종이 같은 땅 가장자리) */
  grain: 1.5 * U,
  grainStep: 10 * U
};

export const MEADOW = {
  /** 100px마다 1.6포기(1920 × 1080 벽에 31) — 0.8 · 1.6 · 3.2 · 6.4 중 */
  density: 1.6 / (100 * U),
  /** 1~5포기씩 무리 짓는다(실제 풀밭처럼) — 무리 안은 가운데에서 표준편차 30px */
  clusters: [1, 2, 3, 3, 4, 5],
  spread: 30 * U,
  /** 섞는 비율 강아지풀 : 민들레 : 토끼풀 = 2 : 1 : 0.5 — 1:1:1 · 3:1:1 · 2:1:2 · 1:3:1에서 2:1:2를 골랐다가 "토끼풀 너무 많아"로 0.5 */
  mix: { fox: 2, dan: 1, clo: 0.5 } as Record<GrassSpecies, number>,
  /** 키 — 가장 큰 풀 75px에 종마다의 범위. 강아지풀(0.7)은 "너무 커", 민들레는 두 번 70%(0.49)로 줄였다 →
      강아지풀 34~53px · 민들레 26~39px · 토끼풀 26~45px */
  hmax: 75 * U,
  height: { fox: [0.65 * 0.7, 1.0 * 0.7], dan: [0.7 * 0.49, 1.05 * 0.49], clo: [0.35, 0.6] } as Record<GrassSpecies, readonly [number, number]>,
  /** 밑동은 바닥선 아래로 4px 묻는다 — 굴곡 없는 자리에서도 땅에서 돋아난다 */
  bury: 4 * U,
  /** 글 둘레 — 글자 높이 × 이만큼 안에 걸린 포기는 걷는다. 처음엔 1(돌 글이 바닥에서 20~80px로 낮아 돌 앞 풀은 가장자리에만 섰다).
      2026-10-07: 풀이 돌 · 나무와 겹쳐 보여도 좋다 — 글자만 안 가리면 되므로 글 상자 바로 둘레(0.1)까지만 걷는다 */
  clear: 0.1
};

/** 바람 — '강'(가만히 · 약 6% · 강 14% 중). 나무와 같은 바람(cloud.ts PERSONAS.ttoryeot.tree.wind의 시간): 돌풍 한 번이
    --t-hold × 13에 왼쪽에서 오른쪽으로 벽을 훑고(돌풍 하나 = 벽 폭), 잔 떨림이 × 2에 바람결(파장 260px)로 지나간다.
    밑동은 가만히, 끝으로 갈수록 (높이 비율)²만큼 휜다 — 끝이 키의 14%까지. 견본: design/landscape-grass-wind.html */
export const WIND = { lean: 0.14, gust: 13, flutter: 2, wave: 260 * U };

/** 땅 두께(px) — 벽은 풍경의 높이를 이만큼 줄여 계산한다 */
export function groundPx(h: number): number {
  return Math.round(h * GROUND.thick);
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 가로 x(px)에서 땅 윗선이 바닥선보다 솟은 높이(px) — 굴곡 + 잔결, 늘 0 이상 */
export function swellAt(x: number, h: number, knots: readonly number[]): number {
  const u = x / h;
  let v = 0;
  for (const [len, share, phase] of GROUND.waves) v += share * Math.sin((u / len) * 2 * Math.PI + phase);
  const s = (u / GROUND.grainStep), i = Math.floor(s), f0 = s - i, f = f0 * f0 * (3 - 2 * f0);
  const g = (knots[i % knots.length] ?? 0) * (1 - f) + (knots[(i + 1) % knots.length] ?? 0) * f;
  return h * (GROUND.swell * (v + 1) / 2 + GROUND.grain * (g + 1));
}

/** 잔결의 무작위 높이들(−1~1) — 같은 벽은 늘 같은 땅 */
export function grainKnots(seed = 4): number[] {
  const r = mulberry32(seed);
  return Array.from({ length: 512 }, () => r() * 2 - 1);
}

export interface Plant {
  /** 그림 왼쪽 · 밑동(바닥선 기준 아래로 묻힌 만큼) · 크기(px) */
  x: number; bury: number; w: number; h: number;
  /** GRASS_PHOTOS 차례 · 좌우 뒤집기 · 떨림 시작(라디안) */
  shape: number; flip: boolean; jit: number;
}

/** 벽 폭 w · 높이 h에 풀을 흩뿌린다 — 같은 벽 크기면 늘 같은 풀밭(씨앗 고정). 글 둘레는 그릴 때 걷는다(글이 오고 가므로) */
export function meadowFor(w: number, h: number, seed = 7): Plant[] {
  const r = mulberry32(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const bySp: Record<GrassSpecies, number[]> = { fox: [], dan: [], clo: [] };
  GRASS_PHOTOS.forEach((g, i) => bySp[g.species].push(i));
  const sps = (Object.keys(MEADOW.mix) as GrassSpecies[]).filter((s) => bySp[s].length);
  const total = sps.reduce((a, s) => a + MEADOW.mix[s], 0);
  const pick = (): GrassSpecies => {
    let v = r() * total;
    for (const s of sps) { v -= MEADOW.mix[s]; if (v <= 0) return s; }
    return sps[sps.length - 1];
  };
  const n = Math.round(MEADOW.density * (w / h));
  const out: Plant[] = [];
  while (out.length < n) {
    const cx = r() * w, k = MEADOW.clusters[Math.floor(r() * MEADOW.clusters.length)];
    for (let j = 0; j < k && out.length < n; j++) {
      const sp = pick(), list = bySp[sp], shape = list[Math.floor(r() * list.length)];
      const [lo, hi] = MEADOW.height[sp];
      const ph = Math.round(h * MEADOW.hmax * (lo + r() * (hi - lo)));
      const pw = Math.max(1, Math.round(ph * GRASS_PHOTOS[shape].aspect));
      const x = cx + gauss() * MEADOW.spread * h;
      out.push({ x: Math.round(x - pw / 2), bury: Math.round(MEADOW.bury * h), w: pw, h: ph, shape, flip: r() < 0.5, jit: r() * 2 * Math.PI });
    }
  }
  return out;
}
