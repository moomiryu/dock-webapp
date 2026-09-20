import { scopeSvg } from '../lib/svgAsset';

// 포즈 사이를 페이드로 갈아끼우면 두 그림이 겹쳐 보이면서 '바뀌었다'가 된다.
// 캐릭터가 돌아본 것처럼 보이려면 형태가 이어져야 한다.
//
// 다행히 작가가 그린 아홉 포즈가 전부 같은 뼈대다: 큰 삼각형(몸) 하나와
// 작은 삼각형(부리) 하나. 상대좌표를 절대좌표로 펴면 둘 다 예외 없이
//     M · L · C · L · C · L · C · Z   = 점 13개
// 라서 점끼리 짝지어 보간할 수 있다. 그래서 진짜로 모핑이 된다.
//
// _light 두 포즈만 그라디언트 속도선이 한 겹 더 있다. 그건 보간하지 않고
// 투명도로 얹었다 뺀다 — 빠르게 지나갈 때만 나오는 겹이라 그걸로 충분하다.
//
// 2026-09-15에 그림이 Renewal_v1으로 바뀌었다. 옛 그림은 파일마다 화판이
// 달라서 포즈마다 가운데를 다시 맞춰야 했는데, 새 그림은 아홉 장이 전부
// 같은 1920×1080 화면 안에 들어 있다. 그래서 여기서는 그 화면에서 창
// 하나를 오려 내기만 한다 — 포즈별 보정은 _light 둘뿐이다.

// 이 폴더에 캐릭터만 있는 게 아니다 — 작가가 화면 스케치와 삽화 견본도
// 같이 넣는다. 폴더를 통째로 끌어오면 그것까지 번들에 실려 나간다.
// 두 번 겪었다: 홈 스케치가 들어왔을 때 219KB→296KB, example_*가 들어왔을
// 때 227KB→525KB(example_full 한 장이 268KB다).
//
// 그래서 '아닌 것을 빼는' 대신 **필요한 이름만 부른다.** 포즈 아홉과 눈
// 아홉의 이름 족보가 이게 전부고, 새 파일이 들어와도 여기 안 걸리면
// 따라 들어오지 않는다.
const files = import.meta.glob(
  [
    '../../by_moomiryu/Renewal_v1/front_*.svg',
    '../../by_moomiryu/Renewal_v1/back_*.svg',
    '../../by_moomiryu/Renewal_v1/left*.svg',
    '../../by_moomiryu/Renewal_v1/right*.svg',
    '../../by_moomiryu/Renewal_v1/eye_*.svg'
  ],
  { query: '?raw', import: 'default', eager: true }
) as Record<string, string>;

export const POSES = [
  'front_center', 'front_left', 'front_right',
  'left', 'right', 'back_left', 'back_right',
  'left_light', 'right_light'
] as const;
export const EYES = [
  'general', 'happy', 'surprise', 'angry', 'sad',
  'tired', 'twinkle', 'see left', 'see right'
] as const;
export type Pose = (typeof POSES)[number];
export type Eyes = (typeof EYES)[number];

/**
 * 아홉 포즈를 한 좌표계에 모으는 정사각 화판.
 *
 * 그림이 놓인 1920×1080에서 (960, 539.5)를 가운데로 한 정사각형을 오려 낸다.
 * 607은 재서 나온 값이다 — 앞모습이 607.1 넓고 옆모습이 606.7 높다.
 * 화판을 그 둘의 큰 쪽에 맞추면 어느 포즈로 돌아도 같은 덩치로 보인다.
 */
export const CANVAS = 607;
const ORIGIN_X = 960 - CANVAS / 2;
const ORIGIN_Y = 539.5 - CANVAS / 2;
/** 눈 원의 반지름·한 눈의 사각·두 눈을 합친 사각. 그림에서 잰 값이다. */
const EYE_R = 43.11;
const EYE_BOX = 86.22;
const EYE_PAIR = 206.06;
/** 부리 색. 몸(#cf5b4c)과 이걸로 갈라낸다 */
const HAT_FILL = '#2ce9f7';

const read = (name: string) =>
  new DOMParser().parseFromString(files[`../../by_moomiryu/Renewal_v1/${name}.svg`], 'image/svg+xml')
    .documentElement;

/** `.cls-3 { fill: #cf5b4c }` 같은 내부 스타일을 클래스→색 표로 바꾼다 */
function fillTable(root: Element): Record<string, string> {
  const css = root.querySelector('style')?.textContent ?? '';
  const table: Record<string, string> = {};
  for (const m of css.matchAll(/\.([\w-]+)\s*\{[^}]*?fill:\s*([^;}]+)/g)) {
    table[m[1]] = m[2].trim();
  }
  return table;
}

/**
 * path의 d를 절대좌표 점 13개(숫자 26개)로 편다.
 * 지원하는 명령은 이 그림들이 실제로 쓰는 것만: M m L l H h V v C c Z z.
 */
function flatten(d: string): number[] {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const out: number[] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let cmd = '';
  const num = () => Number(tokens[i++]);
  const push = (x: number, y: number) => {
    out.push(x, y);
    cx = x;
    cy = y;
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    switch (cmd) {
      case 'M': case 'L': push(num(), num()); break;
      case 'm': case 'l': push(cx + num(), cy + num()); break;
      case 'H': push(num(), cy); break;
      case 'h': push(cx + num(), cy); break;
      case 'V': push(cx, num()); break;
      case 'v': push(cx, cy + num()); break;
      case 'C': {
        out.push(num(), num(), num(), num());
        push(num(), num());
        break;
      }
      case 'c': {
        const sx = cx;
        const sy = cy;
        out.push(sx + num(), sy + num(), sx + num(), sy + num());
        push(sx + num(), sy + num());
        break;
      }
      case 'Z': case 'z': break;
      default: i++;
    }
  }
  return out;
}

/** 점 13개를 다시 d 문자열로. 순서는 M L C L C L C Z 로 고정이다. */
export function toPathD(p: number[]): string {
  const at = (n: number) => `${p[n * 2].toFixed(2)},${p[n * 2 + 1].toFixed(2)}`;
  return (
    `M${at(0)}L${at(1)}C${at(2)} ${at(3)} ${at(4)}` +
    `L${at(5)}C${at(6)} ${at(7)} ${at(8)}` +
    `L${at(9)}C${at(10)} ${at(11)} ${at(12)}Z`
  );
}

export interface PoseGeo {
  body: number[];
  hat: number[];
  bodyFill: string;
  hatFill: string;
  /** 뒤통수 쪽 실루엣 점. 없는 포즈는 r=0 으로 둔다 */
  dot: { cx: number; cy: number; r: number };
  /** 눈 자리. 뒷모습처럼 눈이 없는 포즈는 null */
  eye: { x: number; y: number; w: number; h: number } | null;
  /** Light 포즈의 속도선. 보간하지 않고 투명도로만 다룬다 */
  trail: string | null;
  /** 화면에서 차지하는 비율 — 벽에 닿는 지점을 정할 때 쓴다 */
  span: { x: number; y: number };
}

const geoCache = new Map<Pose, PoseGeo>();

export function poseGeometry(pose: Pose): PoseGeo {
  const hit = geoCache.get(pose);
  if (hit) return hit;

  const root = read(pose);
  const fills = fillTable(root);

  const paths = Array.from(root.querySelectorAll('path'));
  const solid = paths.filter((p) => {
    const f = fills[p.getAttribute('class') ?? ''] ?? '';
    return f.startsWith('#');
  });
  const trailEl = paths.find((p) => (fills[p.getAttribute('class') ?? ''] ?? '').startsWith('url('));

  const raw = solid.map((p) => ({
    pts: flatten(p.getAttribute('d')!),
    fill: fills[p.getAttribute('class') ?? ''] ?? '#000'
  }));

  // _light 포즈는 속도선이 한쪽으로 길게 뻗느라 몸이 화면 가운데에서 비켜나
  // 앉아 있다. 그대로 두면 빨라지는 순간 캐릭터가 옆으로 순간이동한 것처럼
  // 보인다. 그래서 그 둘만 몸을 다시 가운데로 끌어온다.
  const light = pose.endsWith('_light');
  const bodyXs = raw.flatMap((c) => c.pts.filter((_, k) => k % 2 === 0));
  const dx = -ORIGIN_X + (light ? 960 - (Math.min(...bodyXs) + Math.max(...bodyXs)) / 2 : 0);
  const dy = -ORIGIN_Y;
  const shift = (pts: number[]) => pts.map((n, k) => n + (k % 2 ? dy : dx));

  const colored = raw.map((c) => ({ pts: shift(c.pts), fill: c.fill }));
  // 빨강이 몸, 청록이 부리. 파일마다 클래스 번호가 달라서 색으로 고른다.
  const body = colored.find((c) => c.fill.toLowerCase() !== HAT_FILL) ?? colored[0];
  const hat = colored.find((c) => c.fill.toLowerCase() === HAT_FILL) ?? colored[1];

  const circles = Array.from(root.querySelectorAll('circle'));
  const whites = circles.filter((c) => (fills[c.getAttribute('class') ?? ''] ?? '').toLowerCase() === '#fff');
  const eye = whites.length
    ? (() => {
        const xs = whites.map((c) => Number(c.getAttribute('cx')) + dx);
        const ys = whites.map((c) => Number(c.getAttribute('cy')) + dy);
        const w = whites.length === 1 ? EYE_BOX : EYE_PAIR;
        return { x: Math.min(...xs) - EYE_R, y: Math.min(...ys) - EYE_R, w, h: EYE_BOX };
      })()
    : null;

  // 흰자가 없는 포즈(뒷모습)에서 큰 원은 눈이 아니라 실루엣에 얹힌 혹이다.
  // 두 개가 그려져 있지만 가장자리에 걸친 하나만 밖으로 비어져 나온다 —
  // 가운데에서 먼 쪽이 그것이다. 안쪽 하나는 몸과 같은 색이라 보이지 않는다.
  const dotEl = whites.length
    ? null
    : circles
        .filter((c) => Number(c.getAttribute('r')) > EYE_R * 0.9)
        .sort(
          (a, b) =>
            Math.abs(Number(b.getAttribute('cx')) - 960) -
            Math.abs(Number(a.getAttribute('cx')) - 960)
        )[0];
  const centre = { cx: CANVAS / 2, cy: CANVAS / 2 };
  const dot = dotEl
    ? {
        cx: Number(dotEl.getAttribute('cx')) + dx,
        cy: Number(dotEl.getAttribute('cy')) + dy,
        r: Number(dotEl.getAttribute('r'))
      }
    : { ...centre, r: 0 };

  // 속도선은 보간하지 않는다. 좌표를 펴는 대신 원본을 통째로 옮겨 놓는다 —
  // 그라디언트가 userSpaceOnUse라 같은 무리 안에 있어야 색이 안 어긋나고,
  // 속도선 옆의 작은 막대(rect)는 제 회전을 들고 있어 점으로 못 편다.
  let trail: string | null = null;
  if (trailEl) {
    const defs = root.querySelector('defs')?.cloneNode(true) as Element | null;
    defs?.querySelectorAll('style').forEach((s) => s.remove());
    const drawn = [trailEl, ...Array.from(root.querySelectorAll('rect'))]
      .map((el) => {
        const copy = el.cloneNode(true) as Element;
        copy.setAttribute('fill', fills[copy.getAttribute('class') ?? ''] ?? 'none');
        copy.removeAttribute('class');
        return copy.outerHTML;
      })
      .join('');
    trail = scopeSvg(
      `${defs ? defs.outerHTML : ''}` +
        `<g transform="translate(${dx.toFixed(2)} ${dy.toFixed(2)})">${drawn}</g>`,
      pose.replace(/[^a-z0-9]+/gi, '-')
    );
  }

  const geo: PoseGeo = {
    body: body.pts,
    hat: hat.pts,
    bodyFill: body.fill,
    hatFill: hat.fill,
    dot,
    eye,
    trail,
    // 옆을 보면 세로로 길고, 앞을 보면 가로로 넓다. 재서 나온 값이다:
    // 앞모습 607.1 × 381.6, 옆모습 418.4 × 606.7.
    span: light || pose === 'left' || pose === 'right'
      ? { x: 0.7, y: 1 }
      : { x: 1, y: 381.6 / CANVAS }
  };
  geoCache.set(pose, geo);
  return geo;
}

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixAll = (a: number[], b: number[], t: number) => a.map((n, i) => mix(n, b[i], t));

/**
 * 두 포즈 사이의 한 순간. t=0이면 from, t=1이면 to.
 * 문자열이 아니라 숫자로 돌려준다 — 모핑 도중에 또 포즈가 바뀌면
 * 지금 이 순간을 그대로 새 출발점으로 삼아야 형태가 튀지 않는다.
 */
export function blendGeo(from: PoseGeo, to: PoseGeo, t: number): PoseGeo {
  return {
    body: mixAll(from.body, to.body, t),
    hat: mixAll(from.hat, to.hat, t),
    bodyFill: to.bodyFill,
    hatFill: to.hatFill,
    // 없던 점은 반대쪽 자리에서 r=0으로 자라거나 줄어든다 — 원점에서 미끄러지지 않게.
    dot: {
      cx: mix(from.dot.r ? from.dot.cx : to.dot.cx, to.dot.r ? to.dot.cx : from.dot.cx, t),
      cy: mix(from.dot.r ? from.dot.cy : to.dot.cy, to.dot.r ? to.dot.cy : from.dot.cy, t),
      r: mix(from.dot.r, to.dot.r, t)
    },
    eye: from.eye && to.eye
      ? {
          x: mix(from.eye.x, to.eye.x, t),
          y: mix(from.eye.y, to.eye.y, t),
          w: mix(from.eye.w, to.eye.w, t),
          h: mix(from.eye.h, to.eye.h, t)
        }
      : (from.eye ?? to.eye),
    trail: t < 0.5 ? from.trail : to.trail,
    span: { x: mix(from.span.x, to.span.x, t), y: mix(from.span.y, to.span.y, t) }
  };
}

/** 눈이 있는 쪽에서 없는 쪽으로 갈 때는 얼굴이 돌아가는 것이라 옅어진다 */
export function eyeOpacity(from: PoseGeo, to: PoseGeo, t: number): number {
  if (from.eye && to.eye) return 1;
  if (from.eye) return 1 - t;
  if (to.eye) return t;
  return 0;
}

const eyeCache = new Map<Eyes, string>();

/** 표정 하나의 알맹이. 몸통 SVG 안에 중첩 svg로 얹는다. */
export function eyeMarkup(eyes: Eyes): string {
  const hit = eyeCache.get(eyes);
  if (hit) return hit;
  const root = read(`eye_${eyes}`);
  root.querySelectorAll('style').forEach((s) => s.remove());
  const fills = fillTable(read(`eye_${eyes}`));
  root.querySelectorAll('[class]').forEach((el) => {
    const f = fills[el.getAttribute('class')!];
    if (f) el.setAttribute('fill', f);
    el.removeAttribute('class');
  });
  const out = scopeSvg(root.innerHTML, `eye-${eyes.replace(/\s+/g, '-')}`);
  eyeCache.set(eyes, out);
  return out;
}

/**
 * 두 포즈가 어떤 종류의 회전인가.
 *
 * 새 그림의 아홉 포즈는 전부 한 축 위에 있다 — 등을 보인 왼쪽에서 왼쪽,
 * 앞쪽 왼쪽, 정면, 앞쪽 오른쪽, 오른쪽, 등을 보인 오른쪽. 그래서 회전은
 * 좌우로 도는 것 하나뿐이다. (옛 그림에는 눕고 서는 포즈가 따로 있어서
 * 'roll'이 하나 더 있었는데, 그 포즈들이 없어졌다.)
 */
export function turnKind(from: Pose, to: Pose): 'spin' | 'none' {
  return from === to ? 'none' : 'spin';
}
