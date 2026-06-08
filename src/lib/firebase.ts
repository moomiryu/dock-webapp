import type { Draft, ToneState } from '../types';

export interface StoredMessage {
  id: string;
  text: string;
  tone: ToneState | null;
  createdAt: number; // ms epoch — best-effort (serverTimestamp may be null until propagated)
}

interface FirestoreLike {
  addMessage(d: Draft): Promise<string>;
  listMessages(limit: number): Promise<StoredMessage[]>;
  subscribeMessages(limit: number, cb: (msgs: StoredMessage[]) => void, onError: (e: Error) => void): () => void;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ]);
}

function isMockForcedByUrl(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('mock') === '1';
}

function hasFirebaseEnv(): boolean {
  if (isMockForcedByUrl()) return false;
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID
  );
}

// Firestore via the plain REST API (HTTPS fetch) instead of the SDK's
// WebChannel/long-polling transport. The realtime transport stalls on iOS
// Safari + iCloud Private Relay and on networks that throttle long-lived
// connections — a Node probe read/wrote in ~150ms while the browser SDK timed
// out on the phone. Plain REST requests get through. Wide-open security rules
// let the API key alone authorize reads/writes.

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${import.meta.env.VITE_FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const FS_KEY = import.meta.env.VITE_FIREBASE_API_KEY;

type FsValue = Record<string, unknown>;

function toFsValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === 'object') {
    const fields: Record<string, FsValue> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) fields[k] = toFsValue(val);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function fromFsValue(val: FsValue): unknown {
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue as string, 10);
  if ('doubleValue' in val) return val.doubleValue;
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('mapValue' in val) return fieldsToObj((val.mapValue as { fields?: Record<string, FsValue> }).fields ?? {});
  if ('arrayValue' in val) return ((val.arrayValue as { values?: FsValue[] }).values ?? []).map(fromFsValue);
  return null;
}

function fieldsToObj(fields: Record<string, FsValue>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) out[k] = fromFsValue(v);
  return out;
}

interface RestDoc {
  name: string;
  fields?: Record<string, FsValue>;
}

function restDocToStored(d: RestDoc): StoredMessage {
  const f = d.fields ?? {};
  const iso = (f.createdAt as { timestampValue?: string } | undefined)?.timestampValue;
  const startedAt = (f.startedAt as { integerValue?: string } | undefined)?.integerValue;
  const createdAt = iso ? Date.parse(iso) : startedAt ? parseInt(startedAt, 10) : Date.now();
  return {
    id: d.name.split('/').pop() ?? '',
    text: (f.text as { stringValue?: string } | undefined)?.stringValue ?? '',
    tone: f.tone ? (fromFsValue(f.tone) as ToneState) : null,
    createdAt
  };
}

function buildRestClient(): FirestoreLike {
  async function list(lim: number): Promise<StoredMessage[]> {
    const url = `${FS_BASE}/messages?key=${FS_KEY}&pageSize=${lim}&orderBy=${encodeURIComponent('createdAt desc')}`;
    const res = await withTimeout(fetch(url), 15000);
    if (!res.ok) throw new Error(`외벽을 불러오지 못했어요 (${res.status})`);
    const json = (await res.json()) as { documents?: RestDoc[] };
    return (json.documents ?? []).map(restDocToStored);
  }
  return {
    async addMessage(d: Draft) {
      const body = {
        fields: {
          text: { stringValue: d.text },
          tone: toFsValue(d.tone),
          startedAt: { integerValue: String(d.startedAt) },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      };
      const res = await withTimeout(
        fetch(`${FS_BASE}/messages?key=${FS_KEY}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        }),
        15000
      ).catch(() => {
        throw new Error('외벽에 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
      });
      if (!res.ok) throw new Error('외벽에 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
      const json = (await res.json()) as { name?: string };
      return json.name ? (json.name.split('/').pop() ?? 'rest') : 'rest-' + Date.now();
    },
    listMessages: list,
    subscribeMessages(lim, cb, onError) {
      // REST has no realtime stream — poll every 5s.
      let cancelled = false;
      const tick = () => {
        if (cancelled) return;
        list(lim).then(
          (msgs) => {
            if (!cancelled) cb(msgs);
          },
          (e) => {
            if (!cancelled) onError(e as Error);
          }
        );
      };
      tick();
      const id = window.setInterval(tick, 5000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }
  };
}

const MOCK_KEY = 'megafont.mock.messages.v1';

function readMockStore(): StoredMessage[] {
  try {
    return JSON.parse(localStorage.getItem(MOCK_KEY) ?? '[]') as StoredMessage[];
  } catch {
    return [];
  }
}

function writeMockStore(messages: StoredMessage[]) {
  localStorage.setItem(MOCK_KEY, JSON.stringify(messages.slice(0, 50)));
}

function seedMockIfEmpty() {
  if (readMockStore().length > 0) return;
  const now = Date.now();
  const seed: StoredMessage[] = [
    {
      id: 'seed-1',
      text: '저는 과기대를 사랑하는데 총장님은 아니신가봐요',
      tone: { font: 'ttoryeot', tone: 1.0, wght: 700, slnt: 0, size: 40, paletteIdx: 0, graphicIdx: -1 },
      createdAt: now - 1000 * 60 * 5
    },
    {
      id: 'seed-2',
      text: '등록금 어디 쓰는지 알려줘',
      tone: { font: 'chabun', tone: 0.7, wght: 300, slnt: -8, size: 44, paletteIdx: 2, graphicIdx: 3 },
      createdAt: now - 1000 * 60 * 12
    },
    {
      id: 'seed-3',
      text: '내일 비 온대',
      tone: { font: 'botong', tone: 1.3, wght: 400, slnt: 0, size: 36, paletteIdx: 5, graphicIdx: 1 },
      createdAt: now - 1000 * 60 * 33
    }
  ];
  writeMockStore(seed);
}

function buildMockClient(): FirestoreLike {
  seedMockIfEmpty();
  return {
    async addMessage(d: Draft) {
      await new Promise((r) => setTimeout(r, 500));
      const id = 'mock-' + Date.now();
      const message: StoredMessage = {
        id,
        text: d.text,
        tone: d.tone,
        createdAt: Date.now()
      };
      writeMockStore([message, ...readMockStore()]);
      console.info('[MEGAFONT] (mock) submitted message:', id, d);
      return id;
    },
    async listMessages(lim: number) {
      await new Promise((r) => setTimeout(r, 100));
      return readMockStore()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, lim);
    },
    subscribeMessages(lim, cb) {
      // Mock 'subscription' — fires once with current store, then re-polls every 5s.
      let cancelled = false;
      const tick = () => {
        if (cancelled) return;
        cb(readMockStore().sort((a, b) => b.createdAt - a.createdAt).slice(0, lim));
      };
      tick();
      const id = window.setInterval(tick, 5000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }
  };
}

let cached: Promise<FirestoreLike> | null = null;

function client(): Promise<FirestoreLike> {
  if (!cached) {
    cached = Promise.resolve(hasFirebaseEnv() ? buildRestClient() : buildMockClient());
  }
  return cached;
}

export async function submitMessage(d: Draft): Promise<string> {
  const c = await client();
  return c.addMessage(d);
}

export async function listMessages(limit = 30): Promise<StoredMessage[]> {
  const c = await client();
  return c.listMessages(limit);
}

/** Real-time subscription. Returns a cleanup function. */
export function subscribeMessages(
  limit: number,
  cb: (msgs: StoredMessage[]) => void,
  onError: (e: Error) => void
): () => void {
  let unsub: (() => void) | null = null;
  let cancelled = false;
  client().then(
    (c) => {
      if (cancelled) return;
      unsub = c.subscribeMessages(limit, cb, onError);
    },
    (err) => {
      if (!cancelled) onError(err as Error);
    }
  );
  return () => {
    cancelled = true;
    if (unsub) unsub();
  };
}

export function isFirebaseConfigured(): boolean {
  return hasFirebaseEnv();
}
