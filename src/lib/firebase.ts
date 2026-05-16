import type { Draft } from '../types';

interface FirestoreLike {
  addMessage(d: Draft): Promise<string>;
}

function hasFirebaseEnv(): boolean {
  return Boolean(
    import.meta.env.VITE_FIREBASE_API_KEY &&
      import.meta.env.VITE_FIREBASE_PROJECT_ID &&
      import.meta.env.VITE_FIREBASE_APP_ID
  );
}

async function buildRealClient(): Promise<FirestoreLike> {
  const [{ initializeApp }, { getFirestore, addDoc, collection, serverTimestamp }] = await Promise.all([
    import('firebase/app'),
    import('firebase/firestore')
  ]);

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
    }
  };
}

function buildMockClient(): FirestoreLike {
  return {
    async addMessage(d: Draft) {
      await new Promise((r) => setTimeout(r, 500));
      const id = 'mock-' + Date.now();
      console.info('[DOCK] (mock) submitted message:', id, d);
      return id;
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

export function isFirebaseConfigured(): boolean {
  return hasFirebaseEnv();
}
