import type { Draft, ToneState } from '../types';
import { getLang, pick, type Pair } from './lang';

/**
 * 참여자에게 **그대로 보여 줄** 오류 (2026-09-26, 영문판).
 *
 * 화면(PhaseSubmit)은 오류 글에 한글이 있는지로 보여 줄지를 가렸다 — 영어
 * 문구는 그 체에 걸려 늘 '문제가 생겼어요'로 바뀌었다. 이제 이 종류인지로
 * 가른다. 글은 던지는 순간의 언어로 만든다.
 */
export class UserError extends Error {}
const say = (pair: Pair) => new UserError(pick(pair, getLang()));

const E = {
  wall: { ko: '벽에 닿지 못했어요. 잠시 뒤 다시 보내주세요.', en: "Couldn't reach the wall. Please try again in a moment." },
  length: { ko: '1~200자로 적어주세요.', en: 'Please write between 1 and 200 characters.' },
  feedback: { ko: '보내지 못했어요. 잠시 뒤 다시 보내주세요.', en: "Couldn't send it. Please try again in a moment." }
};

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
    if (!res.ok) throw new Error(`벽을 불러오지 못했어요 (${res.status})`);
    const json = (await res.json()) as { documents?: RestDoc[] };
    return (json.documents ?? []).map(restDocToStored);
  }
  /**
   * 벽으로 보내는 조율 값. 2026-09-25 슬라이더가 막대 자리(speed · weight)를
   * 새로 들고 있는데, 벽의 쓰기 규칙(firestore.rules · validTone)은 아직 그
   * 두 칸을 모른다 — 보내면 전송째 거부된다. 규칙을 고쳐 배포할 때까지는
   * 옛 칸(tone · slnt · wght, palettes.ts · legacyFields가 적어 둔 것)만
   * 보낸다. 규칙이 나가면 이 거름을 걷는다.
   */
  function toneForWall(t: Draft['tone']) {
    if (!t) return t;
    const { speed, weight, ...rest } = t;
    void speed; void weight;
    return rest;
  }
  return {
    async addMessage(d: Draft) {
      const body = {
        fields: {
          text: { stringValue: d.text },
          tone: toFsValue(toneForWall(d.tone)),
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
        throw say(E.wall);
      });
      if (!res.ok) throw say(E.wall);
      const json = (await res.json()) as { name?: string };
      return json.name ? (json.name.split('/').pop() ?? 'rest') : 'rest-' + Date.now();
    },
    listMessages: list,
    subscribeMessages(lim, cb, onError) {
      // REST has no realtime stream — poll. 60s: the landscape refreshes once a
      // minute. Polling faster blows through Firestore's free-tier daily read
      // quota (50k/day) on a 24/7 wall.
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
      const id = window.setInterval(tick, 60000);
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

// ─── 도킹 신호 (control/dock 문서 하나) ───────────────────────────────
//
// 여기 흐르는 것은 두 종류다. **섞으면 안 된다.**
//
//   상태 — 지금 홈에 폰이 꽂혀 있나(`plugged`). 파이가 쓴다.
//   사건 — 이 참여의 송출이 시작됐다(`startId`·`startedAt`). 폰이 쓴다.
//
// 전에는 상태 하나(showTrigger)가 둘을 겸했다. 그래서 셋이 깨졌다.
// 벽을 새로고침하면 켜져 있던 깃발이 새 사건으로 읽혀 같은 글이 또 떴고,
// 두 화면이 **각자 신호를 알아챈 시각**부터 30초를 세어 최대 3초 어긋났고,
// 07에 선 폰이 둘이면 둘 다 제 글을 쏘았다.
//
// 이제 사건에 고유번호와 시작 시각이 붙는다. 번호가 전과 같으면 아무 일도
// 하지 않는다 — 새로고침이 사건을 만들지 못한다. 30초는 양쪽 다
// `startedAt`에서 센다. 사건을 쓸 수 있는 폰은 대기 자리의 주인 하나뿐이다.
//
// 문서를 `control/display`가 아니라 새로 판 이유: 그 문서에는 옛 필드가
// 남아 있고, 이름이 겹치는 칸(`docked`)을 새 뜻으로 다시 쓰면 배포가 반쯤
// 된 동안 옛 값이 새 판정을 오염시킨다.
const DOCK_DOC = 'control/dock';

/** 대기 자리의 유효기간. 폰이 이 시간 넘게 갱신을 멈추면 빈자리로 본다.
 *  07 화면의 폰은 5초마다 갱신하므로 살아 있는 폰은 밀려나지 않는다. */
export const WAIT_STALE_MS = 15_000;

/** 파이가 이 시간 넘게 조용하면 설치물이 끊긴 것으로 본다.
 *  파이는 30초마다 살아 있음을 적는다. */
export const PI_STALE_MS = 90_000;

export interface DockState {
  /** 지금 홈에 폰이 꽂혀 있나 — 파이가 쓰는 물리 상태 */
  plugged: boolean;
  /** 눌릴 때마다 새로 생기는 번호. 같은 번호면 같은 꽂음이다 */
  switchId: string;
  /** 파이가 잰 그 순간(ms). 벽은 파이가 띄운 브라우저라 시계가 같다 */
  switchAt: number;
  /** 파이가 마지막으로 살아 있던 시각 */
  piAt: number;
  /** 지금 꽂을 차례인 폰 */
  waitSession: string;
  waitMessage: string;
  waitAt: number;
  /** 확정된 송출 사건 — 폰과 벽이 같이 보는 하나 */
  startId: string;
  startSession: string;
  startMessage: string;
  startedAt: number;
  endedAt: number;
}

const EMPTY_DOCK: DockState = {
  plugged: false,
  switchId: '',
  switchAt: 0,
  piAt: 0,
  waitSession: '',
  waitMessage: '',
  waitAt: 0,
  startId: '',
  startSession: '',
  startMessage: '',
  startedAt: 0,
  endedAt: 0
};

function fsStr(f: Record<string, FsValue> | undefined, k: string): string {
  return (f?.[k] as { stringValue?: string } | undefined)?.stringValue ?? '';
}

function fsNum(f: Record<string, FsValue> | undefined, k: string): number {
  const v = f?.[k] as { integerValue?: string; doubleValue?: number } | undefined;
  if (!v) return 0;
  if (typeof v.doubleValue === 'number') return v.doubleValue;
  return v.integerValue ? parseInt(v.integerValue, 10) : 0;
}

function toDockState(fields: Record<string, FsValue> | undefined): DockState {
  return {
    plugged: (fields?.plugged as { booleanValue?: boolean } | undefined)?.booleanValue === true,
    switchId: fsStr(fields, 'switchId'),
    switchAt: fsNum(fields, 'switchAt'),
    piAt: fsNum(fields, 'piAt'),
    waitSession: fsStr(fields, 'waitSession'),
    waitMessage: fsStr(fields, 'waitMessage'),
    waitAt: fsNum(fields, 'waitAt'),
    startId: fsStr(fields, 'startId'),
    startSession: fsStr(fields, 'startSession'),
    startMessage: fsStr(fields, 'startMessage'),
    startedAt: fsNum(fields, 'startedAt'),
    endedAt: fsNum(fields, 'endedAt')
  };
}

/** 문서 한 번 읽기. 못 읽으면 던진다 — 빈 상태와 구별해야 한다.
 *  끊긴 것을 '아무도 안 꽂았다'로 읽으면 화면이 조용히 거짓말을 한다. */
export async function readDock(): Promise<DockState | null> {
  if (!hasFirebaseEnv()) return null;
  const res = await withTimeout(fetch(`${FS_BASE}/${DOCK_DOC}?key=${FS_KEY}`), 8000);
  if (res.status === 404) return { ...EMPTY_DOCK }; // 아직 아무도 안 쓴 문서
  if (!res.ok) throw new Error(`dock read ${res.status}`);
  const json = (await res.json()) as { fields?: Record<string, FsValue> };
  return toDockState(json.fields);
}

/** 지정한 칸만 고친다. 다른 칸은 남의 것이라 건드리면 안 된다 —
 *  문서를 통째로 쓰면 파이가 방금 올린 꽂힘이 지워진다. */
async function patchDock(fields: Record<string, FsValue>): Promise<boolean> {
  if (!hasFirebaseEnv()) return false;
  const mask = Object.keys(fields)
    .map((k) => `updateMask.fieldPaths=${k}`)
    .join('&');
  try {
    const res = await withTimeout(
      fetch(`${FS_BASE}/${DOCK_DOC}?key=${FS_KEY}&${mask}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      }),
      8000
    );
    return res.ok;
  } catch {
    return false;
  }
}

const fsInt = (n: number): FsValue => ({ integerValue: String(Math.round(n)) });

/**
 * 문서를 되풀이해 읽는다. 간격을 **함수로** 받는 이유가 있다.
 *
 * 벽은 24시간 도는데 Firestore 무료 할당은 하루 5만 번 읽기다. 쉬는 동안
 * 2.5초면 3만 5천 번이라 여유가 있지만, 그 간격으로는 꽂은 뒤 벽이 반응할
 * 때까지 사람이 기다리는 게 보인다. 그래서 **누가 07에 서 있는 동안만**
 * 0.5초로 당긴다 — 대기가 길지 않아 늘어나는 읽기는 얼마 안 된다.
 */
export function subscribeDock(
  cb: (state: DockState) => void,
  onError: (e: Error) => void,
  intervalMs: (state: DockState | null) => number
): () => void {
  if (!hasFirebaseEnv()) return () => {};
  let cancelled = false;
  let timer = 0;
  let last: DockState | null = null;
  const tick = async () => {
    if (cancelled) return;
    try {
      const s = await readDock();
      if (cancelled) return;
      if (s) {
        last = s;
        cb(s);
      }
    } catch (e) {
      if (!cancelled) onError(e as Error);
    }
    if (!cancelled) timer = window.setTimeout(tick, intervalMs(last));
  };
  void tick();
  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}

/** 대기 자리가 비었나 — 주인이 없거나, 갱신이 끊긴 지 오래됐거나. */
export function waitIsFree(s: DockState, now = Date.now()): boolean {
  return !s.waitSession || now - s.waitAt > WAIT_STALE_MS;
}

/**
 * 대기 자리에 이름을 올린다. **먼저 온 폰이 지킨다** —
 * 살아 있는 주인이 이미 있으면 빼앗지 않고 false를 돌려준다.
 *
 * 07에 서 있는 동안 같은 함수를 되풀이해 부른다. 자기가 주인일 때는 시각만
 * 새로 적는 갱신이 되고, 그게 멈추면 15초 뒤 자리가 풀린다.
 */
export async function claimWait(
  session: string,
  messageId: string,
  known?: DockState
): Promise<boolean> {
  // 방금 읽은 상태가 있으면 그걸 쓴다 — 07에 선 폰은 0.5초마다 읽고 있어서,
  // 여기서 또 읽으면 같은 문서를 두 배로 읽는다.
  const s = known ?? (await readDock().catch(() => null));
  if (!s) return false;
  const mine = s.waitSession === session;
  if (!mine && !waitIsFree(s)) return false;
  return patchDock({
    waitSession: { stringValue: session },
    waitMessage: { stringValue: messageId },
    waitAt: fsInt(Date.now())
  });
}

/** 자리를 내놓는다. 내 자리일 때만 — 남이 이미 가져갔으면 그대로 둔다. */
export async function clearWait(session: string): Promise<void> {
  const s = await readDock().catch(() => null);
  if (!s || s.waitSession !== session) return;
  await patchDock({
    waitSession: { stringValue: '' },
    waitMessage: { stringValue: '' },
    waitAt: fsInt(0)
  });
}

/**
 * 송출 시작을 확정한다. 대기 자리의 주인만 부를 수 있다.
 *
 * `startedAt`은 폰의 시계가 아니라 **파이가 잰 꽂힌 순간**이다. 벽은 파이가
 * 띄운 브라우저라 둘의 시계가 같고, 폰은 이 값과 제 시계의 차이를 알아서
 * 보정한다. 그래서 두 화면의 30초가 같은 곳에서 출발한다.
 *
 * `startId`를 꽂음 번호와 세션으로 짜 두면 같은 꽂음에 두 번 불러도 같은
 * 번호가 나온다 — 재시도가 두 번째 등장을 만들지 못한다.
 *
 * 돌아오는 값이 null이면 **아직 시작하지 않은 것이다.** 부른 쪽은 화면을
 * 넘기지 말고 다시 시도해야 한다 — 벽이 모르는데 폰만 '발화 중'이라고
 * 말하는 것이 이 함수가 막으려는 상황이다.
 */
export async function startBroadcast(p: {
  session: string;
  messageId: string;
  startedAt: number;
  switchId: string;
}): Promise<{ startId: string; startedAt: number } | null> {
  const startId = `${p.switchId}:${p.session}`;
  // 대기 자리를 같은 쓰기로 비운다. 송출이 시작된 뒤에도 자리를 쥐고 있으면
  // 뒷사람이 08 화면(최대 30초) 내내 07에서 기다리게 된다.
  const ok = await patchDock({
    startId: { stringValue: startId },
    startSession: { stringValue: p.session },
    startMessage: { stringValue: p.messageId },
    startedAt: fsInt(p.startedAt),
    endedAt: fsInt(0),
    waitSession: { stringValue: '' },
    waitMessage: { stringValue: '' },
    waitAt: fsInt(0)
  });
  return ok ? { startId, startedAt: p.startedAt } : null;
}

/** 강조가 끝났다. 폰을 뺀 시각을 적는다 — 벽은 이걸 보고 큰 목소리를 접는다. */
export async function endBroadcast(at: number): Promise<boolean> {
  return patchDock({ endedAt: fsInt(at) });
}

/**
 * 파이 없이 꽂음을 흉내 낸다. **개발과 왕복 검사 전용.**
 *
 * 실제 설치에서는 `pi/switch.py`가 같은 칸을 쓴다. 이 함수 덕에 파이가 없는
 * 책상에서도 폰과 벽의 왕복을 그대로 볼 수 있다.
 */
export async function fakeSwitch(on: boolean): Promise<boolean> {
  const now = Date.now();
  return patchDock({
    plugged: { booleanValue: on },
    ...(on ? { switchId: { stringValue: `fake-${now}` } } : null),
    switchAt: fsInt(now),
    piAt: fsInt(now)
  });
}

/**
 * 목록에 아직 안 들어온 글을 id로 직접 집어 온다.
 * 풍경 목록은 60초마다 갱신되는데 도킹 신호는 곧바로 닿는다 — 그 사이를
 * 메우지 않으면 방금 쓴 사람이 제 글을 못 본다.
 */
export async function getMessage(id: string): Promise<StoredMessage | null> {
  if (!hasFirebaseEnv() || !id) return null;
  try {
    const res = await withTimeout(fetch(`${FS_BASE}/messages/${id}?key=${FS_KEY}`), 8000);
    if (!res.ok) return null;
    return restDocToStored((await res.json()) as RestDoc);
  } catch {
    return null;
  }
}

// ─── 제안 — 완료 화면의 의견 칸 (2026-09-25) ───────────────────────────
//
// 저장하는 것은 **보낸 시각과 본문 둘뿐**이다. 누가 보냈는지, 어느 기기인지,
// 어느 글을 보낸 뒤인지는 받지 않는다. 시각은 서버가 적는다(요청 시각) — 폰이
// 적으면 꾸밀 수 있다. 규칙(firestore.rules · feedback)이 같은 것을 한 번 더
// 본다: 새로 만들기만, 두 칸만, 1~200자.
//
// 읽는 것은 관리자뿐이다. /admin이 관리자 계정(이메일·비밀번호)으로 로그인해
// 받은 표(idToken)를 붙여 읽는다. SDK 없이 REST로 한다(이 파일의 다른 길과 같다).
//
// 연달아 보내기는 **앱에서만** 막는다(PhaseDone: 보내면 칸이 닫히고, 같은
// 기기는 1분 뒤에야 다시). 로그인도 서버도 없는 구조라 규칙은 '같은 사람'을
// 알아볼 수 없다 — 진짜로 막으려면 App Check나 서버가 필요하다(README).

export const FEEDBACK_MAX = 200;
export interface Feedback { id: string; text: string; createdAt: number }
const FEEDBACK_MOCK = 'megafont.mock.feedback.v1';

function randomId(n = 20): string {
  const abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => abc[b % abc.length]).join('');
}

export async function submitFeedback(text: string): Promise<void> {
  const t = text.trim();
  if (!t || Array.from(t).length > FEEDBACK_MAX) throw say(E.length);
  if (!hasFirebaseEnv()) {
    const list = JSON.parse(localStorage.getItem(FEEDBACK_MOCK) ?? '[]') as Feedback[];
    list.unshift({ id: 'mock-' + Date.now(), text: t, createdAt: Date.now() });
    localStorage.setItem(FEEDBACK_MOCK, JSON.stringify(list.slice(0, 100)));
    return;
  }
  const project = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  const body = {
    writes: [{
      update: { name: `projects/${project}/databases/(default)/documents/feedback/${randomId()}`, fields: { text: { stringValue: t } } },
      updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
      currentDocument: { exists: false }
    }]
  };
  const res = await withTimeout(fetch(`${FS_BASE}:commit?key=${FS_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }), 15000).catch(() => { throw say(E.feedback); });
  if (!res.ok) throw say(E.feedback);
}

/** 관리자 로그인 — Firebase Auth REST. 돌려받은 idToken은 한 시간 간다 */
export async function adminSignIn(email: string, password: string): Promise<string> {
  if (!hasFirebaseEnv()) return 'mock';
  const res = await withTimeout(fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FS_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  }), 15000);
  if (!res.ok) throw new Error('로그인하지 못했어요. 이메일과 비밀번호를 확인해주세요.');
  const json = (await res.json()) as { idToken?: string };
  if (!json.idToken) throw new Error('로그인하지 못했어요.');
  return json.idToken;
}

export async function listFeedback(idToken: string): Promise<Feedback[]> {
  if (!hasFirebaseEnv()) return JSON.parse(localStorage.getItem(FEEDBACK_MOCK) ?? '[]') as Feedback[];
  const url = `${FS_BASE}/feedback?key=${FS_KEY}&pageSize=200&orderBy=${encodeURIComponent('createdAt desc')}`;
  const res = await withTimeout(fetch(url, { headers: { Authorization: `Bearer ${idToken}` } }), 15000);
  if (res.status === 401 || res.status === 403) throw new Error('읽을 권한이 없어요. 관리자 계정으로 다시 로그인해주세요.');
  if (!res.ok) throw new Error(`제안을 불러오지 못했어요 (${res.status})`);
  const json = (await res.json()) as { documents?: Array<{ name: string; fields?: { text?: { stringValue?: string }; createdAt?: { timestampValue?: string } } }> };
  return (json.documents ?? []).map((d) => ({
    id: d.name.split('/').pop() ?? '',
    text: d.fields?.text?.stringValue ?? '',
    createdAt: Date.parse(d.fields?.createdAt?.timestampValue ?? '') || 0
  }));
}
