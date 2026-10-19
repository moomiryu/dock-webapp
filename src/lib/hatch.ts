/**
 * 작은 공용 부품 — 토큰 색 읽기 · 씨앗 난수 · 글 해시. 2026-10-04 빗금 결(돌 · 구름 · 나무의 명암)의 부품이 살던 곳이라 이름이 남았다 —
 * 빗금은 2026-10-20에 걷었고(도트 집합체) 뭉개기 · 잡음 · 조각 셈 · 프레임 나눔도 함께 걷었다.
 */

/** 토큰 색(--ink 등)을 [r, g, b](0~255)로 — '#rrggbb' · 'rgb(r g b)' · 'rgb(r, g, b)' */
export function cssRgb(v: string): [number, number, number] {
  const t = v.trim();
  if (/^#[0-9a-f]{6}$/i.test(t)) return [parseInt(t.slice(1, 3), 16), parseInt(t.slice(3, 5), 16), parseInt(t.slice(5, 7), 16)];
  const m = t.match(/\d+(\.\d+)?/g);
  return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : [0, 0, 0];
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
