import type { Stage } from '../types';

export function getStageFromUrl(): Stage {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('stage');
  if (raw === 'enter' || raw === 'submit') return raw;
  return null;
}

export function clearStageFromUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('stage');
  window.history.replaceState({}, '', url.toString());
}
