import type { Draft, ToneState } from '../types';

const KEY = 'megafont.draft.v1';

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Draft;
    if (typeof obj.text !== 'string') return null;
    return obj;
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft): void {
  localStorage.setItem(KEY, JSON.stringify(d));
}

export function clearDraft(): void {
  localStorage.removeItem(KEY);
}

export function newDraft(text = ''): Draft {
  return { text, tone: null, startedAt: Date.now() };
}

export function updateDraftText(text: string): Draft {
  const cur = loadDraft() ?? newDraft();
  const next: Draft = { ...cur, text };
  saveDraft(next);
  return next;
}

export function updateDraftTone(tone: ToneState): Draft {
  const cur = loadDraft() ?? newDraft();
  const next: Draft = { ...cur, tone };
  saveDraft(next);
  return next;
}
