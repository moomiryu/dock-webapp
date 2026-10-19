/**
 * 벽의 하늘 — 말이 놓이는 기반 규칙(2026-10-20, 결정 4 · 5 — 견본 kv/sky-pack.html의 placeFor · repack · wideOf). 하늘의 말(모인 채)은
 * 아래(기기 쪽)에서 곧게 올라오다 천장이나 먼저 붙은 말에 처음 닿는 자리에 붙는다 — 버블 슈터의 윗줄처럼 위에서부터 쌓이고, 완전히
 * 붙지 않고 틈 0.25u. 닿음은 실제 점 윤곽으로 잰다: 점 간격 칸마다 그 말 점들의 위끝 · 아래끝(메움 반지름 포함), 닿는 것은 몸통 +
 * 꼬리 밑동 3분의 1(t ≤ 0.35). 자리를 고르는 일은 이 파일 하나에 모았다.
 * 길이는 px(화면) — 말 좌표(u)의 점은 × u로 옮긴다. 견본의 px 값은 1280 × 720 기준이라 화면 크기에 비례.
 */
import { G, RF, type Dot } from './aggregate';

type P = [number, number];
export const SKY = {
  /** 하늘 말의 u — 벽 높이의 몫(결정 5: 글자 높이 ≈ 벽 높이의 2.2%, 1080 벽에서 27px) */
  u: 0.0253,
  /** 하늘에 뜨는 수 — 한눈에 낱낱으로 읽히는 수(결정 8, 12였다 — 옛 '자연' 벽의 칸 수). 그보다 먼저 '화면 절반'에 닿아도 가장 오래
      떠 있던 말부터 터진다. 못 뜬 말은 기다림 줄에서 차례를 기다린다(WallSky 돌려 보이기) */
  max: 10,
  /** 새 말이 붙을 자리의 아랫변이 화면 높이의 이만큼을 넘으면 꽉 참 */
  full: 0.5,
  /** 이웃과의 틈(u) · 천장 여백(높이의 몫, 견본 12px@720) · 좌우 끝 여백(폭의 몫, 16px@1280) */
  gap: 0.25, ceil: 12 / 720, side: 16 / 1280,
  /** 다시 올라붙는 시간(초, easeInOut) */
  move: 0.8,
  /** 자리를 잴 땐 '하늘 가운데 이 높이에서의 꼬리'로 잰다(높이의 몫, 견본 120px@720) — 꼬리 방향이 자리마다 조금씩 달라서 */
  probe: 120 / 720,
  /** 기기 — 벽 아래 가운데 바깥(높이의 몫, 30px@720) */
  devDrop: 30 / 720
} as const;

/** 점 간격 칸 → [위끝, 아래끝](px, 말 원점 기준) */
export type Profile = Map<number, [number, number]>;
export function profileOf(dots: readonly Dot[], u: number): Profile {
  const m: Profile = new Map();
  for (const d of dots) {
    if ((d.t ?? 0) > 0.35) continue;
    const c = Math.round(d.x / G), r = RF * d.r, v = m.get(c) ?? [Infinity, -Infinity];
    v[0] = Math.min(v[0], (d.y - r) * u); v[1] = Math.max(v[1], (d.y + r) * u);
    m.set(c, v);
  }
  return m;
}
/** 하늘에 붙은 말 — 자리(px, 말 원점) · 윤곽 */
export interface Placed { pos: P; prof: Profile }
const colOf = (x: number, u: number) => Math.round(x / (G * u));
/**
 * 아래에서 올라와 처음 닿는 자리 — x를 점 간격 칸마다 훑어 가장 높이 올라가는 곳, 같으면 가운데 가까이(점수 = y + |x − 가운데| × 0.04).
 * 각 칸에서 '그 칸의 기존 말들 아래끝 중 가장 낮은 것 + 틈' 아래에 위끝이 온다(없으면 천장 여백). fixed = 그 칸(x)에서 위로만
 */
export function placeFor(prof: Profile, sky: readonly Placed[], W: number, H: number, u: number, fixed?: number): P {
  const g = G * u, bottom = new Map<number, number>();
  for (const s of sky) { const oc = colOf(s.pos[0], u); for (const [c, [, b]] of s.prof) bottom.set(c + oc, Math.max(bottom.get(c + oc) ?? -Infinity, s.pos[1] + b)); }
  const cs = [...prof.keys()], side = SKY.side * W, lo = fixed ?? Math.ceil(side / g) - Math.min(...cs), hi = fixed ?? Math.floor((W - side) / g) - Math.max(...cs);
  let best: { x: number; y: number; sc: number } | null = null;
  for (let xc = lo; xc <= Math.max(lo, hi); xc++) {
    let y = -Infinity;
    for (const [c, [t]] of prof) { const b = bottom.get(c + xc); y = Math.max(y, (b === undefined ? SKY.ceil * H : b + SKY.gap * u) - t); }
    const sc = y + Math.abs(xc * g - W / 2) * 0.04;
    if (!best || sc < best.sc) best = { x: xc * g, y, sc };
  }
  return best ? [best.x, best.y] : [W / 2, SKY.ceil * H];
}
/** 그 말의 윗변 · 아랫변(px, 화면) */
export const topOf = (s: Placed) => s.pos[1] + Math.min(...[...s.prof.values()].map((v) => v[0]));
export const bottomOf = (prof: Profile, y: number) => y + Math.max(...[...prof.values()].map((v) => v[1]));
/**
 * 하나가 빠진 뒤 — 남은 말들이 윗변 높이 순서로 제 x에서 천장 쪽으로 다시 올라붙는다(가운데 높이 순서로 하면 뿔이 솟은 별이 이웃 꼬리
 * 아래로 밀려 겹쳤다). 돌려주는 값 = 말마다 새 자리(차례는 들어온 차례 그대로)
 */
export function repack(sky: readonly Placed[], W: number, H: number, u: number): P[] {
  const done: Placed[] = [], to = new Map<Placed, P>();
  for (const s of [...sky].sort((a, b) => topOf(a) - topOf(b))) {
    const p = placeFor(s.prof, done, W, H, u, colOf(s.pos[0], u));
    to.set(s, p); done.push({ pos: p, prof: s.prof });
  }
  return sky.map((s) => to.get(s)!);
}

/**
 * 광각 퍼짐(결정 4) — 도킹하면 하늘 말들이 큰 말을 빙 둘러싼 고리(화면 가장자리 너머까지 — 잘려도 된다)로 퍼진다. 고리 = 화면 가운데
 * 중심, 가로 반지름 0.56 × 폭 · 세로 0.58 × 높이, 150°(왼쪽 아래)에서 위를 지나 30°(오른쪽 아래)까지 240°. x 차례(같으면 y)로 줄 세워
 * 고르게, 하나 건너 하나는 안쪽 고리(0.84배). 고리를 따라 기운다(회전 = (각 − 270°) × 0.12). 퍼지며 1.45배
 */
export const WIDE = { a: 0.56, b: 0.58, from: 150, sweep: 240, inner: 0.16, tilt: 0.12, grow: 1.45, t: 0.6 } as const;
export function ringOf<T extends { pos: P }>(list: readonly T[], W: number, H: number): Map<T, { to: P; rot: number }> {
  const m = new Map<T, { to: P; rot: number }>(), order = [...list].sort((p, q) => p.pos[0] - q.pos[0] || p.pos[1] - q.pos[1]);
  order.forEach((g, i) => {
    const ring = i % 2 ? 1 - WIDE.inner : 1, phi = ((WIDE.from + (WIDE.sweep * (i + 0.5)) / order.length) * Math.PI) / 180;
    m.set(g, { to: [W / 2 + WIDE.a * W * ring * Math.cos(phi), H / 2 + WIDE.b * H * ring * Math.sin(phi)], rot: (phi - 1.5 * Math.PI) * WIDE.tilt });
  });
  return m;
}
