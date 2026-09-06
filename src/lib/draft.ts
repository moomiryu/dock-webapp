import type { Draft, ToneState } from '../types';

const KEY = 'megafont.draft.v1';

/**
 * 쓰다 만 초안이 살아 있는 시간.
 *
 * 이건 개인 기기의 임시 저장이 아니라 *광장에 놓인 기기*를 전제한다.
 * 한 사람이 쓰다 그만두고 떠난 뒤 다음 사람이 오는 데 몇 분이면 충분하고,
 * 그때 남의 문장이 화면에 떠 있으면 그 사람의 말도 아니고 앞사람의 말도
 * 아닌 것이 외벽에 올라갈 수 있다. 그래서 오래된 초안은 없던 것으로 친다.
 */
const STALE_MS = 10 * 60 * 1000;

function lastTouched(d: Draft): number {
  return d.touchedAt ?? d.startedAt ?? 0;
}

export function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Draft;
    if (typeof obj.text !== 'string') return null;
    if (Date.now() - lastTouched(obj) > STALE_MS) {
      clearDraft();
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}

export function saveDraft(d: Draft): void {
  localStorage.setItem(KEY, JSON.stringify({ ...d, touchedAt: Date.now() }));
}

export function clearDraft(): void {
  localStorage.removeItem(KEY);
}

export function newDraft(text = ''): Draft {
  const now = Date.now();
  return { text, tone: null, startedAt: now, touchedAt: now };
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
