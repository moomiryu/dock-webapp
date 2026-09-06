import { scopeSvg } from './svgAsset';

const files = import.meta.glob('../../by_moomiryu/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
export const POSES = ['Front', 'Left', 'Right', 'Back Left', 'Back Right', 'Vertical Front', 'Vertical Left', 'Vertical Right', 'Light Left', 'Light Right'] as const;
export const EYES = ['general', 'happy', 'surprise', 'angry', 'sad', 'tired', 'twinkle', 'see left', 'see right'] as const;
export type Pose = typeof POSES[number];
export type Eyes = typeof EYES[number];
const SIZE = 1210.42;
const cache = new Map<string, string>();

/** Keep the author's geometry, strip embedded eyes, then align the separate eye asset. */
export function characterArtwork(pose: Pose, eyes: Eyes): string {
  const key = `${pose}-${eyes}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const parse = (name: string) => new DOMParser().parseFromString(files[`../../by_moomiryu/${name}.svg`], 'image/svg+xml').documentElement;
  const body = parse(pose);
  const whiteClass = body.querySelector('style')?.textContent?.match(/\.(cls-\d+)\s*\{\s*fill:\s*#fff\s*;/i)?.[1];
  const centers = Array.from(body.querySelectorAll('circle')).filter(c => c.getAttribute('class') === whiteClass)
    .map(c => ({ x: Number(c.getAttribute('cx')), y: Number(c.getAttribute('cy')) }));
  // Remove whites and their pupils only; back-facing red circles are silhouette details.
  body.querySelectorAll('circle').forEach(c => {
    if (centers.some(center => center.x === Number(c.getAttribute('cx')) && center.y === Number(c.getAttribute('cy')))) c.remove();
  });
  const [, , vw, vh] = body.getAttribute('viewBox')!.split(/\s+/).map(Number);
  const light = pose.startsWith('Light');
  const dx = light ? (SIZE - 763.19) / 2 - (pose === 'Light Right' ? 918.14 : 0) : (SIZE - vw) / 2;
  const dy = light ? 0 : (SIZE - vh) / 2;
  let eyeLayer = '';
  if (centers.length) {
    const eye = parse(`eye_${eyes}`);
    const x = Math.min(...centers.map(c => c.x)) - 86.21;
    const y = Math.min(...centers.map(c => c.y)) - 86.21;
    const width = centers.length === 1 ? 172.43 : 412.12;
    eye.setAttribute('viewBox', `0 0 ${width} 172.44`);
    eye.setAttribute('x', String(x)); eye.setAttribute('y', String(y));
    eye.setAttribute('width', String(width)); eye.setAttribute('height', '172.44');
    eyeLayer = scopeSvg(new XMLSerializer().serializeToString(eye), 'eyes');
  }
  const inner = scopeSvg(body.innerHTML, 'body');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true"><g transform="translate(${dx} ${dy})">${inner}${eyeLayer}</g></svg>`;
  // Scope every copy, including crossfade layers, independently.
  const result = scopeSvg(svg, key.replaceAll(' ', '-'));
  cache.set(key, result);
  return result;
}

export function poseSize(pose: Pose) {
  return pose.startsWith('Vertical') || pose.startsWith('Light') ? { x: 0.70, y: 1 } : { x: 1, y: 763.19 / SIZE };
}
