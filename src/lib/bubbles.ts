import type { FontFamily } from '../types';

/**
 * 말풍선 네 모양.
 *
 * 모양은 **02에서 고른 성격이 정한다.** 시스템이 추천하는 것이 아니라,
 * 발화자가 이미 명시적으로 고른 값이 형식으로 이어지는 것이다.
 *
 * ── 왜 크기를 받아서 그리는가 ─────────────────────────────────────────
 * 2026-09-19까지 네 모양은 240×240 **정사각** 화판에 고정 경로로 박혀
 * 있었다. 그 전제 위에서는 상자가 먼저 있고 글자가 거기 맞춰 줄어드는데,
 * 그러면 **발화자가 정한 줄바꿈이 깨진다** — 크기 축에서 한 칸 올리면
 * 글자가 상자 폭을 넘고, 브라우저가 알아서 다시 접는다. 실제로 일곱 자
 * 발화가 2줄 × 4자로 접힌 기록이 있다(design/line-length-2026-09-17.md).
 *
 * 그래서 순서를 뒤집었다. **글자 크기를 발화자가 정하고, 틀이 그 결과로
 * 그려진다.** 여기 함수들은 글 덩어리(tw × th)를 받아 그것을 감싸는
 * 몸통 크기를 답한다.
 *
 * ── 늘어나는 건 가운데뿐이다 ──────────────────────────────────────────
 * 비례가 변해도 꼬리·갈래·덩이·요철은 **제 크기를 지킨다.** 전부 글자 한
 * 칸(u)의 배수로 잡혀 있고, 개수만 둘레를 따라 늘어난다. 도형째 늘이면
 * 계단이 길쭉해지고 구름 덩이가 타원으로 찌그러진다.
 *
 * 좌표계는 0..w × 0..(h + tail(u))다. 몸통이 위쪽 h를 쓰고 꼬리가 그
 * 아래로 흘러내린다.
 */

/**
 * 틀이 납작해질 수 있는 한계 — 가로:세로.
 *
 * 한 줄 12자를 상한 다섯 값으로 한 장에 놓고 골랐다.
 * 자연 비례(5.9:1)는 **글이 윤곽을 뚫는다** — 납작한 타원은 글줄의 위아래
 * 끝 높이에서 이미 폭이 20% 좁아져 있는데 글은 거기까지 곧게 뻗는다.
 * 3:1은 위아래가 비기 시작하고, 2.5:1에서는 한 마디짜리 발화가 세 줄짜리와
 * 같은 자리를 차지해 말의 길이가 크기로 안 읽힌다.
 * 4:1이 말풍선으로 읽히면서 아직 납작한 마지막 자리였다.
 */
export const MIN_ASPECT = 4;

export interface Size { w: number; h: number }

export interface Bubble {
  key: string;
  label: string;
  /** 글 덩어리(tw × th)를 감싸는 몸통 크기. u = 글자 한 칸(= font-size) */
  body(tw: number, th: number, u: number): Size;
  /** 몸통 아래로 꼬리가 더 쓰는 높이 */
  tail(u: number): number;
  /** 몸통 w × h의 닫힌 윤곽. 몸통과 물결이 같은 문자열을 쓴다 */
  path(w: number, h: number, u: number): string;
}

type Pt = readonly [number, number];
const n1 = (v: number) => Math.round(v * 10) / 10;
const f = (p: Pt) => `${n1(p[0])} ${n1(p[1])}`;
const rad = (deg: number) => (deg * Math.PI) / 180;

/**
 * 글 덩어리를 감싸는 **가장 작은 타원**의 반지름은 글의 반쪽 × √2다.
 * (넓이 πab를 (x/a)²+(y/b)²=1 아래에서 최소화하면 a = x√2, b = y√2)
 *
 * 옛 고정 안전영역은 폭 82%(= 1.22배)였는데 그건 이 값보다 좁아서, 첫
 * 글자와 끝 글자가 윤곽에 닿고 있었다. 납작할수록 더 닿는다.
 */
const R2 = Math.SQRT2;

/**
 * 글 덩어리와 윤곽 사이에 **반드시** 남는 자리 — 글자 한 칸의 배수.
 * 네 도형이 같은 값을 쓴다.
 *
 * 이게 없으면 여백이 도형마다 딴판이 된다. 계단은 0.8u로 고르게 두르고
 * 있었는데, 타원·구름·뾰족은 글 덩어리에 **외접**하는 타원을 몸통으로 써서
 * 옆으로는 넉넉하고 네 모서리에서는 여백이 **0**이었다. 글자가 윤곽에 닿는다.
 *
 * 그래서 도형마다 글 덩어리를 먼저 이만큼 부풀리고, 그 부푼 칸을 감싼다.
 * 재서 확인한다 — scripts는 아니고 조율 격자 쪽에서 윤곽까지의 실제 거리를
 * 스물넷 방향으로 잰다(아래 padOf 주석).
 */
export const PAD = 0.7;

/**
 * 글 덩어리에 여백을 두른 칸. 두 가지인 이유는 **재보고 알았다.**
 *
 * 네 도형에 같은 값을 물렸더니 최소 여백이 계단 0.71u · 타원 계열 1.0u로
 * 갈렸다. 타원을 두르는 도형은 글 상자의 **네 모서리**에서 여백이 제일
 * 좁은데, 외접 타원이 부푼 칸의 모서리를 지나므로 그 자리의 실제 여백이
 * 물린 값보다 멀어진다. 그래서 타원 쪽은 그 배수로 나눠 물린다.
 *
 * 배수를 √2(모서리까지의 대각선)로 놓아 봤더니 이번엔 0.62u까지 모자랐다 —
 * 타원이 모서리에서 휘어 달아나므로 실제로는 대각선보다 가깝다. 스물넷
 * 방향으로 재보니 그 배수가 비례에 따라 **1.25~1.5** 사이를 움직인다.
 * 제일 불리한 1.25로 잡아야 어느 비례에서도 PAD 아래로 안 내려간다.
 */
const ELLIPSE_GAIN = 1.25;
const padRect = (tw: number, th: number, u: number): [number, number] =>
  [tw + 2 * PAD * u, th + 2 * PAD * u];
const padEllipse = (tw: number, th: number, u: number): [number, number] =>
  [tw + (2 * PAD / ELLIPSE_GAIN) * u, th + (2 * PAD / ELLIPSE_GAIN) * u];

/** 4:1보다 납작해지지 않게 높이를 끌어올린다. 글은 몸통 한가운데 앉는다 */
const capped = (w: number, h: number): Size => ({ w, h: Math.max(h, w / MIN_ASPECT) });

/** 타원 위의 한 점과 그 자리의 바깥 방향(단위벡터) */
function on(cx: number, cy: number, rx: number, ry: number, t: number) {
  const c = Math.cos(t), s = Math.sin(t);
  const nx = c / rx, ny = s / ry, L = Math.hypot(nx, ny);
  return { p: [cx + rx * c, cy + ry * s] as Pt, n: [nx / L, ny / L] as Pt };
}
const push = (p: Pt, n: Pt, d: number): Pt => [p[0] + n[0] * d, p[1] + n[1] * d];

/** 타원 둘레 근사(라마누잔). 갈래·덩이 **개수**가 이걸 따라간다 */
const perim = (rx: number, ry: number) =>
  Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));

/** 두 원이 만나는 두 점. 앞이 왼쪽(x 작은 쪽), 뒤가 오른쪽 */
function meet(c1: Pt, r1: number, c2: Pt, r2: number): [Pt, Pt] {
  const dx = c2[0] - c1[0], dy = c2[1] - c1[1], d = Math.hypot(dx, dy);
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const mx = c1[0] + (a * dx) / d, my = c1[1] + (a * dy) / d;
  const p: Pt = [mx + (h * dy) / d, my - (h * dx) / d];
  const q: Pt = [mx - (h * dy) / d, my + (h * dx) / d];
  return p[0] <= q[0] ? [p, q] : [q, p];
}

/**
 * 원이 타원 경계를 지나는 두 점. 몸통이 원이 아니게 되면서 meet()로는
 * 못 푼다 — 원둘레를 훑어 부호가 바뀌는 자리를 이분법으로 좁힌다.
 */
function crossEllipse(c: Pt, r: number, cx: number, cy: number, rx: number, ry: number): [Pt, Pt] | null {
  const F = (t: number) => {
    const x = c[0] + r * Math.cos(t) - cx, y = c[1] + r * Math.sin(t) - cy;
    return (x / rx) ** 2 + (y / ry) ** 2 - 1;
  };
  const at = (t: number): Pt => [c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)];
  const roots: Pt[] = [];
  const N = 720;
  for (let i = 1; i <= N && roots.length < 2; i++) {
    let lo = ((i - 1) / N) * Math.PI * 2;
    let hi = (i / N) * Math.PI * 2;
    if (F(lo) * F(hi) > 0) continue;
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      if (F(lo) * F(mid) <= 0) hi = mid; else lo = mid;
    }
    roots.push(at((lo + hi) / 2));
  }
  return roots.length === 2 ? [roots[0], roots[1]] : null;
}

/** 꼭짓점 목록을 닫힌 다각형으로 */
function poly(list: readonly Pt[]): string {
  const [head, ...rest] = list.map(f);
  return `M ${head} L ${rest.join(' L ')} Z`;
}

// ─── 타원 — 차분한 ────────────────────────────────────────────────────
//
// 만화 말풍선 그대로. 꼬리는 아래 가운데가 아니라 **왼쪽 아래로 쓸려
// 내려간다** — 대칭으로 달면 물방울이 되고, 물방울은 말이 아니다.
// 나가는 변은 몸통에서 거의 곧게 떨어지고 돌아오는 변은 길게 쓸어
// 올라간다. 그 비대칭이 말이 새어 나온 자리로 읽히게 한다.

const OVAL_TAIL = 1.6;

const oval: Bubble = {
  key: 'oval', label: '타원',
  body: (tw, th, u) => { const [pw, ph] = padEllipse(tw, th, u); return capped(pw * R2, ph * R2); },
  tail: (u) => OVAL_TAIL * u,
  path(w, h, u) {
    const rx = w / 2, ry = h / 2, d = OVAL_TAIL * u;
    const a = on(rx, ry, rx, ry, rad(118)).p;   // 나가는 변 — 왼쪽 아래
    const b = on(rx, ry, rx, ry, rad(74)).p;    // 돌아오는 변 — 아래 가운데
    const tip: Pt = [a[0] - 0.35 * u, h + d];
    // sweep 0 = 각도가 줄어드는 쪽. 74° → 0° → -90°(위) → 180° → 118°, 큰 호
    return `M ${f(b)} A ${n1(rx)} ${n1(ry)} 0 1 0 ${f(a)}`
      + ` C ${f([a[0] - 0.2 * u, a[1] + d * 0.5])} ${f([tip[0], tip[1] - d * 0.3])} ${f(tip)}`
      + ` C ${f([tip[0] + 1.2 * u, tip[1] - d * 0.45])} ${f([b[0] - 1.1 * u, b[1] + d * 0.3])} ${f(b)} Z`;
  }
};

// ─── 계단 — 발랄한 ────────────────────────────────────────────────────
//
// 네 변이 네모지게 물린다. 요철의 **깊이와 한 칸 길이는 고정**이고 개수가
// 변 길이를 따라간다 — 옛 판은 개수가 7·6으로 박혀 있어서 가로로 늘리면
// 계단이 길쭉한 물결이 됐다.
// 아랫변만 요철을 두지 않는다 — 옆변과 같이 물리면 꼬리가 그중 하나로 묻힌다.

const STEP_AMP = 0.42;   // 요철 깊이
const STEP_LEN = 1.5;    // 요철 한 칸 길이
const STEP_TAIL = 2.4;   // 꼬리가 내려가는 깊이

const steps: Bubble = {
  key: 'steps', label: '계단',
  body: (tw, th, u) => { const [pw, ph] = padRect(tw, th, u); return capped(pw, ph); },
  tail: (u) => STEP_TAIL * u,
  path(w, h, u) {
    const amp = STEP_AMP * u;
    const edge = (from: Pt, to: Pt): Pt[] => {
      const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
      const k = Math.max(2, Math.round(len / (STEP_LEN * u)));
      const dx = (to[0] - from[0]) / k, dy = (to[1] - from[1]) / k;
      const L = Math.hypot(dx, dy), nx = dy / L, ny = -dx / L;   // 시계방향 바깥쪽
      const list: Pt[] = [];
      for (let i = 0; i < k; i++) {
        const o = i % 2 ? amp : 0;
        list.push([from[0] + dx * i + nx * o, from[1] + dy * i + ny * o]);
        list.push([from[0] + dx * (i + 1) + nx * o, from[1] + dy * (i + 1) + ny * o]);
      }
      return list;
    };
    const cx = w / 2, s = 0.95 * u, r = (STEP_TAIL / 3) * u;   // 계단 한 칸
    const tail: Pt[] = [
      [cx + 1.5 * s, h], [cx + 1.5 * s, h + r], [cx + 0.5 * s, h + r],
      [cx + 0.5 * s, h + 2 * r], [cx - 0.5 * s, h + 2 * r],
      [cx - 0.5 * s, h + 3 * r], [cx - 1.5 * s, h + 3 * r], [cx - 1.5 * s, h]
    ];
    return poly([
      ...edge([0, 0], [w, 0]),
      ...edge([w, 0], [w, h]),
      [w, h], ...tail, [0, h],
      ...edge([0, h], [0, 0])
    ]);
  }
};

// ─── 뾰족 — 당당한 ────────────────────────────────────────────────────
//
// 갈래가 **바깥 법선 방향으로 고정 깊이만큼** 나간다. 옛 판은 바깥·안쪽
// 반지름 두 값이라, 비례가 변하면 갈래가 옆으로 기울었다.
// 한 갈래만 길게 빼서 꼬리로 쓰고, 그 양옆은 더 깊이 파 밑동을 좁힌다 —
// 안 그러면 꼬리가 그냥 긴 갈래로 읽힌다.

// 깊이 1.45 · 간격 1.5로 먼저 그렸더니 4:1에서 별이 아니라 **톱니 띠**가 됐다.
// 몸통이 납작해지면 갈래가 몸통 두께만큼 커져서 그렇다. 얕고 촘촘하게 내린다.
const SPIKE = 1.0;         // 갈래 깊이
const SPIKE_GAP = 1.1;     // 갈래 사이
const SPIKE_TAIL = 3.4;    // 꼬리 갈래는 이 배수만큼 길다 — 얕아진 만큼 더 뺀다
const SPIKE_NOTCH = 0.35;  // 꼬리 양옆을 안으로 파는 깊이. 밑동이 좁아야 꼬리로 읽힌다

const spiky: Bubble = {
  key: 'spiky', label: '뾰족',
  body: (tw, th, u) => {
    // 꼬리 양옆이 안으로 파이는 만큼을 미리 물려 둔다 — 안 그러면 그 두 점이
    // 여백을 먹는다. 재보니 한 줄에서 0.51u까지 내려가 있었다.
    // 홈은 꼬리 양옆, 곧 **아래쪽에만** 파인다. 사방에 물리면 이 도형만
    // 여백이 1.6u까지 벌어져 나머지 셋과 안 맞는다.
    const notch = 2 * SPIKE_NOTCH * SPIKE * u;
    const [pw, ph] = padEllipse(tw, th + notch, u);
    return capped(pw * R2 + 2 * SPIKE * u, ph * R2 + 2 * SPIKE * u);
  },
  tail: (u) => SPIKE * u * (SPIKE_TAIL - 1) * 0.92,
  path(w, h, u) {
    const sp = SPIKE * u;
    const rx = Math.max(u, w / 2 - sp), ry = Math.max(u, h / 2 - sp);
    let n = Math.max(12, Math.round(perim(rx, ry) / (SPIKE_GAP * u)));
    if (n % 2) n += 1;                               // 바깥·안쪽이 번갈아야 한다
    let ti = Math.round((n * 0.53) / 2) * 2;         // 꼬리는 아래쪽 바깥 갈래에
    if (ti >= n) ti = n - 2;
    const list: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const e = on(rx + sp, ry + sp, rx, ry, rad(-90 + (i * 360) / n));
      const near = i === (ti + n - 1) % n || i === (ti + 1) % n;
      list.push(push(e.p, e.n, i === ti ? sp * SPIKE_TAIL : near ? -sp * SPIKE_NOTCH : i % 2 ? 0 : sp));
    }
    return poly(list);
  }
};

// ─── 구름 — 다정한 ────────────────────────────────────────────────────
//
// 덩이가 **고정 깊이**로 부풀고 개수가 둘레를 따라간다.
// 꼬리도 구름이다 — 삼각형으로 빼면 몸통과 다른 어휘가 된다. 점점 작아지는
// 동그라미 셋을 아래로 늘어놓고 그 합집합의 윤곽을 따라간다.

const BUMP = 0.5;        // 덩이가 부푸는 깊이
const BUMP_GAP = 1.7;    // 덩이 하나의 폭
// 꼬리 동그라미 셋.
//
// 간격을 고정값으로 두면 두 번 다 틀린다. 1.15u는 서로 삼켜서 **물방울 하나**가
// 됐고(구름이 아니라 눈물이다), 1.5u로 벌렸더니 이번엔 셋째가 둘째에 **아예
// 안 닿아서** 따로 떠 있는 점이 됐다. 동그라미가 점점 작아지므로 간격도 같이
// 작아져야 한다 — 중심 거리를 이웃한 두 반지름의 합에 매단다.
// 크기도 두 번 틀렸다. 0.9u로 뒀더니 몸통 덩이(폭 1.7u)와 거의 같아서 꼬리가
// 아니라 **덩이 하나가 삐져나온 것**으로 읽혔다. 꼬리는 몸통 덩이보다 커야 한다.
const CLOUD_DOTS = [1.15, 0.78, 0.46]; // 반지름
// 겹침이 얕으면 동그라미 사이가 오목하게 패여 구름이 아니라 **갈퀴**가 된다.
// 0.72로 뒀을 때가 그랬다. 옛 정사각 판이 쓰던 비율(0.38~0.46)로 되돌린다.
const CLOUD_LAP = 0.5;                 // 중심 거리 = 반지름 합 × 이것 (1이면 외접)
const CLOUD_DIR = [-0.41, 0.912];      // 흘러내리는 방향 — 아래로, 왼쪽으로

/** 꼬리 동그라미들의 자리. (bx, by) = 몸통 아래 끝 가운데 */
function cloudDots(bx: number, by: number, u: number): Array<{ c: Pt; r: number }> {
  const out: Array<{ c: Pt; r: number }> = [];
  let p: Pt = [bx - 0.5 * u, by + 0.45 * u];        // 첫 덩이는 몸통에 걸친다
  for (let i = 0; i < CLOUD_DOTS.length; i++) {
    if (i > 0) {
      const d = (CLOUD_DOTS[i - 1] + CLOUD_DOTS[i]) * CLOUD_LAP * u;
      p = [p[0] + CLOUD_DIR[0] * d, p[1] + CLOUD_DIR[1] * d];
    }
    out.push({ c: p, r: CLOUD_DOTS[i] * u });
  }
  return out;
}

const cloud: Bubble = {
  key: 'cloud', label: '구름',
  body: (tw, th, u) => { const [pw, ph] = padEllipse(tw, th, u); return capped(pw * R2 + 2 * BUMP * u, ph * R2 + 2 * BUMP * u); },
  tail: (u) => cloudDots(0, 0, u).at(-1)!.c[1] + CLOUD_DOTS.at(-1)! * u,
  path(w, h, u) {
    const bp = BUMP * u;
    const rx = Math.max(u, w / 2 - bp), ry = Math.max(u, h / 2 - bp);
    const cx = w / 2, cy = h / 2;
    const n = Math.max(7, Math.round(perim(rx, ry) / (BUMP_GAP * u)));
    const ti = Math.round(n * 0.52);                 // 꼬리가 달리는 칸 — 아래 왼쪽
    const v = (i: number) => on(cx, cy, rx, ry, rad(-90 + ((i % n) * 360) / n));

    // 꼬리: 몸통에서 왼쪽 아래로 흘러내리는 동그라미 셋
    const dot = cloudDots(cx, cy + ry, u);
    function tailArc(): string | null {
      const first = crossEllipse(dot[0].c, dot[0].r, cx, cy, rx, ry);
      if (!first) return null;
      const join: Array<[Pt, Pt]> = [first];
      for (let i = 0; i < dot.length - 1; i++) join.push(meet(dot[i].c, dot[i].r, dot[i + 1].c, dot[i + 1].r));
      const last = dot[dot.length - 1];
      let d = ` L ${f(join[0][1])}`;
      for (let i = 0; i < dot.length - 1; i++) d += ` A ${n1(dot[i].r)} ${n1(dot[i].r)} 0 0 0 ${f(join[i + 1][1])}`;
      d += ` A ${n1(last.r)} ${n1(last.r)} 0 1 0 ${f(join[dot.length - 1][0])}`;
      for (let i = dot.length - 2; i >= 0; i--) d += ` A ${n1(dot[i].r)} ${n1(dot[i].r)} 0 0 0 ${f(join[i][0])}`;
      return d;
    }
    const arc = tailArc();

    let d = `M ${f(v(0).p)}`;
    for (let i = 0; i < n; i++) {
      const mid = on(cx, cy, rx, ry, rad(-90 + ((i + 0.5) * 360) / n));
      const next = v(i + 1).p;
      if (i === ti && arc) d += arc + ` L ${f(next)}`;
      else d += ` Q ${f(push(mid.p, mid.n, bp * 2))} ${f(next)}`;
    }
    return d + ' Z';
  }
};

export const BUBBLES: Record<string, Bubble> = { spiky, cloud, oval, steps };

/** 성격 → 모양. 당당한=뾰족 · 차분한=타원 · 다정한=구름 · 발랄한=계단 */
const BY_FONT: Record<string, string> = { ttoryeot: 'spiky', chabun: 'oval', doran: 'cloud', deulseok: 'steps' };

export function bubbleFor(font?: FontFamily | string): Bubble {
  return BUBBLES[BY_FONT[font ?? ''] ?? 'oval'];
}
