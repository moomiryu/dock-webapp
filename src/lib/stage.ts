import type { Stage } from '../types';

export function getStageFromUrl(): Stage {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('stage');
  if (raw === 'enter') return raw;
  return null;
}

/**
 * 개발·검사용 손잡이가 보이는 자리인가.
 *
 * 07의 '꽂았어요'·08의 '폰을 뺐어요'는 파이가 없는 책상에서 왕복을 보려고
 * 둔 것이다. 학생이 쓰는 화면에 그게 있으면 **꽂지 않고도 벽에 띄울 수 있다** —
 * 이 설치물에서 벽에 오르는 값은 폰을 홈에 꽂는 일 하나뿐이어야 한다.
 *
 * `?mock=1`은 Firestore 대신 localStorage로 도는 자리라 파이가 아예 없고,
 * `?dev=1`은 진짜 Firestore를 쓰면서 스위치만 흉내 내는 자리다 —
 * `scripts/e2e-dock.mjs`가 그쪽으로 들어온다.
 */
export function isDevMode(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.get('dev') === '1' || params.get('mock') === '1';
}

export function clearStageFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('stage');
  window.history.replaceState({}, '', url.toString());
}
