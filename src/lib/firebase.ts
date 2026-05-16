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
}

function hasFirebaseEnv(): boolean {
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
  const { getFirestore, addDoc, collection, serverTimestamp, getDocs, orderBy, query, limit: fsLimit } = firestore;

  const app = initializeApp({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  });

  const db = getFirestore(app);

  return {
    async addMessage(d: Draft) {
      const ref = await addDoc(collection(db, 'messages'), {
        text: d.text,
        tone: d.tone,
        startedAt: d.startedAt,
        createdAt: serverTimestamp()
      });
      return ref.id;
    },
    async listMessages(lim: number) {
      const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'), fsLimit(lim));
      const snap = await getDocs(q);
      return snap.docs.map((doc) => {
        const data = doc.data();
        const ts = data.createdAt;
        const createdAt =
          ts && typeof ts.toMillis === 'function' ? ts.toMillis() : data.startedAt ?? Date.now();
        return {
          id: doc.id,
          text: String(data.text ?? ''),
          tone: (data.tone ?? null) as ToneState | null,
          createdAt
        };
      });
    }
  };
}

const MOCK_KEY = 'dock.mock.messages.v1';

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
      tone: { font: 'gothic', tone: 1.0, wght: 800, slnt: 0, size: 40, paletteIdx: 0, graphicIdx: -1 },
      createdAt: now - 1000 * 60 * 5
    },
    {
      id: 'seed-2',
      text: '등록금 어디 쓰는지 알려줘',
      tone: { font: 'myeongjo', tone: 0.7, wght: 600, slnt: -8, size: 44, paletteIdx: 2, graphicIdx: 3 },
      createdAt: now - 1000 * 60 * 12
    },
    {
      id: 'seed-3',
      text: '내일 비 온대',
      tone: { font: 'mono', tone: 1.3, wght: 400, slnt: 0, size: 36, paletteIdx: 5, graphicIdx: 1 },
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
      console.info('[DOCK] (mock) submitted message:', id, d);
      return id;
    },
    async listMessages(lim: number) {
      await new Promise((r) => setTimeout(r, 100));
      return readMockStore()
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, lim);
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

export function isFirebaseConfigured(): boolean {
  return hasFirebaseEnv();
}
