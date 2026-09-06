// Read-only: list the latest messages in Firestore with timestamps.
// Use to verify a phone submission actually reached the database.
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';

const env = {};
for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID
});
const db = getFirestore(app);
const snap = await getDocs(query(collection(db, 'messages'), orderBy('createdAt', 'desc'), limit(10)));
console.log(`${snap.size} docs (newest first):`);
for (const d of snap.docs) {
  const ts = d.data().createdAt?.toMillis?.();
  const when = ts ? new Date(ts).toISOString() : '(pending)';
  console.log(' •', when, '—', JSON.stringify(d.data().text));
}
process.exit(0);
