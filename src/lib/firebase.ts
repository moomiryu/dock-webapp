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

async function buildRealClient(): Promise<FirestoreLike> {
  const [{ initializeApp }, firestore] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore')
  ]);
  const {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    doc,
    setDoc,
    collection,
    serverTimestamp,
    getDocs,
    getDocsFromCache,
    onSnapshot,
    orderBy,
    query,
    limit: fsLimit
  } = firestore;

  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  });

  // Force long-polling transport instead of default gRPC/WebChannel streams.
  // Default transport hangs on some Korean university/corporate networks where
  // long-lived connections are blocked or throttled. Long-polling falls back
  // to regular HTTPS requests which firewalls leave alone. Slightly more
  // overhead but reliable. autoDetect can be flaky so we just force it.
  const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    // Offline cache: reads serve instantly from IndexedDB after first load and
    // writes survive a slow/flaky connection, so the wall/archive don't depend
    // on a fast server round-trip every time.
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });

  return {
    async addMessage(d: Draft) {
      // Await the server commit so we only report success once the message is
      // actually saved — otherwise a failed write would silently vanish while
      // the UI claims "완료". We cap the wait so a blocked network surfaces an
      // error (→ retry) instead of hanging forever on "보내는 중…".
      const ref = doc(collection(db, 'messages'));
      await withTimeout(
        setDoc(ref, {
          text: d.text,
          tone: d.tone,
          startedAt: d.startedAt,
          createdAt: serverTimestamp()
        }),
        20000
      ).catch(() => {
        throw new Error('외벽에 저장하지 못했어요. 잠시 후 다시 시도해주세요.');
      });
      return ref.id;
    },
    async listMessages(lim: number) {
      const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'), fsLimit(lim));
      // Reads can stall indefinitely on blocked/slow networks (same reason we
      // force long-polling). Cap the server read; on timeout/failure fall back
      // to whatever is in the local cache so the archive never hangs.
      try {
        const snap = await withTimeout(getDocs(q), 15000);
        return snap.docs.map(toStoredMessage);
      } catch (e) {
        try {
          const cached = await getDocsFromCache(q);
          return cached.docs.map(toStoredMessage);
        } catch {
          throw e instanceof Error ? e : new Error('목록을 불러오지 못했어요.');
        }
      }
    },
    subscribeMessages(lim: number, cb, onError) {
      const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'), fsLimit(lim));
      const unsub = onSnapshot(
        q,
        (snap) => cb(snap.docs.map(toStoredMessage)),
        (err) => onError(err as Error)
      );
      return unsub;
    }
  };
}

function toStoredMessage(doc: { id: string; data: () => Record<string, unknown> }): StoredMessage {
  const data = doc.data();
  const ts = data.createdAt as { toMillis?: () => number } | number | null | undefined;
  const createdAt =
    ts && typeof ts === 'object' && typeof ts.toMillis === 'function'
      ? ts.toMillis()
      : (data.startedAt as number) ?? Date.now();
  return {
    id: doc.id,
    text: String(data.text ?? ''),
    tone: (data.tone ?? null) as ToneState | null,
    createdAt
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
    cached = hasFirebaseEnv() ? buildRealClient() : Promise.resolve(buildMockClient());
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
