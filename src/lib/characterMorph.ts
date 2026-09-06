import { scopeSvg } from './svgAsset';

// 포즈 사이를 페이드로 갈아끼우면 두 그림이 겹쳐 보이면서 '바뀌었다'가 된다.
// 캐릭터가 돌아본 것처럼 보이려면 형태가 이어져야 한다.
//
// 다행히 작가가 그린 열 포즈가 전부 같은 뼈대다: 큰 삼각형(몸) 하나와
// 작은 삼각형(부리) 하나. 상대좌표를 절대좌표로 펴면 둘 다 예외 없이
//     M · L · C · L · C · L · C · Z   = 점 13개
// 라서 점끼리 짝지어 보간할 수 있다. 그래서 진짜로 모핑이 된다.
//
// Light 두 포즈만 그라디언트 속도선이 한 겹 더 있다. 그건 보간하지 않고
// 투명도로 얹었다 뺀다 — 빠르게 지나갈 때만 나오는 겹이라 그걸로 충분하다.

const files = import.meta.glob('../../by_moomiryu/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true
}) as Record<string, string>;

export const POSES = [
  'Front', 'Left', 'Right', 'Back Left', 'Back Right',
  'Vertical Front', 'Vertical Left', 'Vertical Right',
  'Light Left', 'Light Right'
] as const;
export const EYES = [
  'general', 'happy', 'surprise', 'angry', 'sad',
  'tired', 'twinkle', 'see left', 'see right'
] as const;
export type Pose = (typeof POSES)[number];
export type Eyes = (typeof EYES)[number];

/** 열 포즈를 한 좌표계에 모으는 정사각 화판 */
export const CANVAS = 1210.42;
const EYE_R = 86.21;
const EYE_BOX = 172.44;
const EYE_PAIR = 412.12;

const read = (name: string) =>
  new DOMParser().parseFromString(files[`../../by_moomiryu/${name}.svg`], 'image/svg+xml')
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
  const [, , vw, vh] = root.getAttribute('viewBox')!.split(/\s+/).map(Number);

  // Light 포즈는 캔버스가 속도선까지 품느라 넓다. 캐릭터 본체만 가운데 맞춘다.
  const light = pose.startsWith('Light');
  const dx = light
    ? (CANVAS - 763.19) / 2 - (pose === 'Light Right' ? 918.14 : 0)
    : (CANVAS - vw) / 2;
  const dy = light ? 0 : (CANVAS - vh) / 2;
  const shift = (pts: number[]) => pts.map((n, k) => n + (k % 2 ? dy : dx));

  const paths = Array.from(root.querySelectorAll('path'));
  const solid = paths.filter((p) => {
    const f = fills[p.getAttribute('class') ?? ''] ?? '';
    return f.startsWith('#');
  });
  const trailEl = paths.find((p) => (fills[p.getAttribute('class') ?? ''] ?? '').startsWith('url('));

  const colored = solid.map((p) => ({
    pts: shift(flatten(p.getAttribute('d')!)),
    fill: fills[p.getAttribute('class') ?? ''] ?? '#000'
  }));
  // 빨강이 몸, 청록이 부리. 파일마다 클래스 번호가 달라서 색으로 고른다.
  const body = colored.find((c) => c.fill.toLowerCase() !== '#3cced0') ?? colored[0];
  const hat = colored.find((c) => c.fill.toLowerCase() === '#3cced0') ?? colored[1];

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

  // 흰자가 없는 포즈의 큰 원은 눈이 아니라 뒤통수 점이다.
  const dotEl = whites.length
    ? null
    : circles.find((c) => Number(c.getAttribute('r')) > 70);
  const centre = { cx: CANVAS / 2, cy: CANVAS / 2 };
  const dot = dotEl
    ? {
        cx: Number(dotEl.getAttribute('cx')) + dx,
        cy: Number(dotEl.getAttribute('cy')) + dy,
        r: Number(dotEl.getAttribute('r'))
      }
    : { ...centre, r: 0 };

  let trail: string | null = null;
  if (trailEl) {
    const defs = root.querySelector('defs')?.cloneNode(true) as Element | null;
    defs?.querySelectorAll('style').forEach((s) => s.remove());
    const d = toPathD(shift(flatten(trailEl.getAttribute('d')!)));
    const fill = fills[trailEl.getAttribute('class') ?? ''] ?? 'none';
    trail = scopeSvg(
      `${defs ? defs.outerHTML : ''}<path d="${d}" fill="${fill}"/>`,
      pose.replace(/\s+/g, '-')
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
    span: light || pose.startsWith('Vertical')
      ? { x: 0.7, y: 1 }
      : { x: 1, y: 763.19 / CANVAS }
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
 * 좌우를 도는가(수직축 회전), 눕거나 서는가(굴러가는 회전).
 */
export function turnKind(from: Pose, to: Pose): 'spin' | 'roll' | 'none' {
  const upright = (p: Pose) => p.startsWith('Vertical');
  if (upright(from) !== upright(to)) return 'roll';
  const side = (p: Pose) =>
    /Left/.test(p) ? -1 : /Right/.test(p) ? 1 : 0;
  const back = (p: Pose) => (p.startsWith('Back') ? 1 : 0);
  if (side(from) !== side(to) || back(from) !== back(to)) return 'spin';
  return 'none';
}
