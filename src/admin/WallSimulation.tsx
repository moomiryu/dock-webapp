// Wall projection — MEGAFONT's output side.
//
// 벽 = 하늘에 뜬 말들 + 도킹 장면(2026-10-20, 결정 3 · 4 · 5). 사흘치 글이 도트 집합체로 모여 하늘에 위에서부터 쌓여 있고
// (components/WallSky · lib/sky), 송출 사건이 오면(control/dock의 startId) 지목된 글이 화면 정중앙에 크게 선다 — 성격별 등장,
// 휭 퍼짐, 크게 머묾. 폰을 떼면(또는 30초) 그 자리에서 모여 꼬리가 솟고 작아지며 하늘의 제자리로 오른다.
// 이 파일은 글을 받고 도킹 신호를 읽어 WallSky에 넘긴다. 그리기는 WallSky가, 땅은 WallGround가, 작은 사람 둘은 WallWalkers가 한다.
// 그전(~10-19)의 나무 · 돌 · 구름 · 비눗방울 풍경(물리 · 큰 나무 · 큰 돌 · 비 · 새 떼 · 마네킹 나무)은 걷었다 — git 기록에 있다.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EMPHASIS_MS, STAY_MS } from '../lib/wall';
import WallGround from '../components/WallGround';
import WallWalkers, { type DockBeat } from '../components/WallWalkers';
import WallSky from '../components/WallSky';
import { SAMPLE_MESSAGES } from '../lib/samples';
import {
  isFirebaseConfigured,
  submitMessage,
  subscribeMessages,
  listMessagesSince,
  subscribeDock,
  waitIsFree,
  getMessage
} from '../lib/firebase';
import type { StoredMessage } from '../lib/firebase';

// ─── Tunables ─────────────────────────────────────────────────────────
const RECENT_N = 15;                            // fewer reads per poll (quota)
/**
 * 사흘 치 전부를 다시 받는 간격.
 *
 * 새 글과 지워진 테스트 글은 1분마다 최신 15개로 보고, 그보다 오래된 쪽은 한 시간에 한 번 받는다(2026-09-26). 오래된 글은 새로
 * 생기지 않고 지워지지도 않으니(규칙상 테스트 글만 지워진다) 한 시간 늦어도 달라질 것이 없다. 늘어나는 읽기는 글 수 × 24다.
 */
const POOL_REFRESH_MS = 60 * 60_000;
// 체류 기간은 lib/wall.ts 한 곳에서 정한다 (아카이브가 따로 없으니 이게 수명 전부)
const LOAD_TIMEOUT_MS = 20000;

/**
 * 도킹 신호를 보는 간격. 쉴 때와 누가 서 있을 때가 다르다.
 *
 * 이 화면은 24시간 돌고 Firestore 무료 할당은 하루 5만 번 읽기다. 2.5초면 3만 5천 번이라 여유가 있지만, 그 간격으로는 꽂은 뒤 벽이
 * 반응할 때까지 사람이 기다리는 게 보인다. 그래서 **07에 누가 서 있는 동안만** 0.5초로 당긴다.
 */
const DOCK_POLL_IDLE_MS = 2500;
const DOCK_POLL_WAIT_MS = 500;
/** 도킹 텀 — 꽂은 뒤 이만큼은 하늘이 그대로, 그다음 큰 말이 선다. 뗀 뒤에도 이만큼은 크게 머문다(결정 3 D: '3초 텀은 지금 그대로') */
const DOCK_TERM_MS = 3000;
/** 막 하늘에 오른 글을 목록에 붙잡아 두는 시간 — 목록 폴링(60초)이 아직 그 글을 못 받았으면 오르자마자 사흘이 지난 것으로 읽혀 터진다 */
const LINGER_MS = 5 * 60_000;

/**
 * 마지막으로 처리한 송출 사건의 번호.
 *
 * 화면이 다시 뜰 때(파이 재부팅·새로고침) 이게 없으면 아직 남아 있는 사건을 처음 보는 것으로 읽어 같은 글이 한 번 더 등장한다.
 * 브라우저에 적어 둔다.
 */
const SEEN_KEY = 'megafont.wall.seenStart';
function readSeen(): string {
  try {
    return localStorage.getItem(SEEN_KEY) ?? '';
  } catch {
    return '';
  }
}
function writeSeen(id: string): void {
  try {
    localStorage.setItem(SEEN_KEY, id);
  } catch {
    /* 저장이 막힌 브라우저 — 이번 세션 동안은 ref가 대신 기억한다 */
  }
}
function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function WallSimulation() {
  const [messages, setMessages] = useState<StoredMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  /** 지금 도킹한 글 — key가 바뀌면 새 도킹, release = 해제(WallSky) */
  const [dock, setDock] = useState<{ msg: StoredMessage; key: number; release: boolean } | null>(null);
  /** 도킹의 박자 — WallSky가 적고 작은 사람이 읽는다(올려다보기 · 글자마다 폴짝) */
  const beat = useRef<DockBeat | null>(null);
  /** 소리의 결을 그릴 곳 — 땅 뒤(WallSky가 그린다) */
  const waves = useRef<HTMLCanvasElement>(null);
  /** 막 하늘에 오른 글(LINGER_MS) */
  const [linger, setLinger] = useState<StoredMessage | null>(null);

  useEffect(() => {
    document.body.classList.add('wall-mode');
    document.body.classList.remove('themed');
    document.body.style.removeProperty('--bg-outer');
    return () => {
      document.body.classList.remove('wall-mode');
    };
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Cache messages (the sky source)
  const initialLoadedRef = useRef(false);
  useEffect(() => {
    let timeoutId: number | null = window.setTimeout(() => {
      if (!initialLoadedRef.current) {
        setError(
          `Firestore가 ${LOAD_TIMEOUT_MS / 1000}초 안에 응답하지 않았어요. Firestore Database가 생성됐는지, 보안 규칙이 읽기를 허용하는지 확인해주세요.`
        );
        setMessages([]);
      }
    }, LOAD_TIMEOUT_MS);
    const unsub = subscribeMessages(
      RECENT_N,
      (msgs) => {
        initialLoadedRef.current = true;
        if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }
        setError(null);
        setMessages(msgs);
      },
      (err) => {
        if (timeoutId !== null) { clearTimeout(timeoutId); timeoutId = null; }
        // Only surface an error on the very first load. Once the sky is up, ignore transient failures (e.g. a 429 burst) so it doesn't blank.
        if (!initialLoadedRef.current) {
          initialLoadedRef.current = true;
          setError(err.message);
          setMessages([]);
        }
      }
    );
    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      unsub();
    };
  }, []);

  // 사흘 치 전부 — 최신 15개보다 오래된 쪽을 채운다(POOL_REFRESH_MS). 못 받아도 벽을 비우지 않는다
  const [pool, setPool] = useState<StoredMessage[]>([]);
  useEffect(() => {
    let cancelled = false;
    const load = () => listMessagesSince(Date.now() - STAY_MS).then((msgs) => { if (!cancelled) setPool(msgs); }, () => {});
    void load();
    const id = window.setInterval(load, POOL_REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const visible = useMemo(() => {
    if (!messages) return [];
    // 최신 15개가 다 찼으면 그보다 오래된 것은 사흘 치 목록에서 잇는다. 겹치는 구간은 최신 쪽을 믿는다 — 1분마다 새로 보니 지워진
    // 테스트 글이 거기서 먼저 빠진다. 15개가 안 찼으면 그게 이미 전부다.
    const edge = messages.length < RECENT_N ? -Infinity : Math.min(...messages.map((m) => m.createdAt));
    const list = [...messages, ...pool.filter((m) => m.createdAt < edge)]
      .filter((m) => now - m.createdAt < STAY_MS)
      .sort((a, b) => b.createdAt - a.createdAt);
    // 도킹 중인 글 · 막 하늘에 오른 글이 목록에 아직 없으면(폴링 전) 끼워 넣는다 — 없으면 하늘이 사흘 지난 것으로 읽어 터뜨린다
    for (const m of [linger, dock?.msg]) if (m && !list.some((x) => x.id === m.id)) list.unshift(m);
    return list;
  }, [messages, pool, now, dock, linger]);

  // '최신 글'을 따로 들고 있지 않는다. 지목된 글을 못 가져왔을 때 그걸로 대신 띄우던 길이 있었고, 그 길이 남의 글을 남의 발화로 만들었다.
  const listRef = useRef<StoredMessage[]>([]);
  useEffect(() => { listRef.current = visible; }, [visible]);

  // 송출 사건 → 지목된 글을 크게. **번호가 전과 다를 때만.** 전에는 깃발 하나가 올라간 것을 보고 띄웠다 — 그래서 벽이 다시 뜨면
  // 아직 올라가 있던 깃발이 새 사건으로 읽혔다.
  const seenIdRef = useRef<string>(readSeen());
  const keyRef = useRef(0);
  /** 지금 사건 — 큰 말이 섰나(텀 뒤) · 해제했나 · 타이머들 */
  const runRef = useRef<{ msg: StoredMessage; key: number; shown: boolean; released: boolean } | null>(null);
  const termTimerRef = useRef(0), closeTimerRef = useRef(0), lingerTimerRef = useRef(0);
  useEffect(() => {
    // 끝 — 폰을 뗐거나 30초. 뗀 뒤 잠시(텀) 크게 머물다 해제한다. 큰 말이 아직 서기 전(도킹 텀)에 뗐으면 아무 일도 없다
    const land = () => {
      const R = runRef.current;
      if (!R || R.released) return;
      R.released = true;
      clearTimeout(closeTimerRef.current);
      if (!R.shown) { clearTimeout(termTimerRef.current); runRef.current = null; return; }
      const go = () => {
        setDock((d) => (d && d.key === R.key ? { ...d, release: true } : d));
        // 하늘로 오른 뒤 한동안 목록에 붙잡아 둔다
        setLinger(R.msg);
        clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = window.setTimeout(() => setLinger(null), LINGER_MS);
      };
      if (prefersReducedMotion()) go(); else termTimerRef.current = window.setTimeout(go, DOCK_TERM_MS);
    };
    const show = (msg: StoredMessage, startedAt: number) => {
      clearTimeout(termTimerRef.current);
      clearTimeout(closeTimerRef.current);
      const R = { msg, key: ++keyRef.current, shown: false, released: false };
      runRef.current = R;
      const open = () => { R.shown = true; setDock({ msg, key: R.key, release: false }); };
      if (prefersReducedMotion()) open(); else termTimerRef.current = window.setTimeout(open, DOCK_TERM_MS);
      // EMPHASIS_MS는 상한이고, 세는 곳은 **꽂힌 순간**이다. 벽이 신호를 몇 초 늦게 알아채도 폰과 같은 시각에 끝난다
      closeTimerRef.current = window.setTimeout(land, Math.max(0, EMPHASIS_MS - (Date.now() - startedAt)));
    };
    // 개발 모드의 손잡이 — mock 벽에는 도킹 신호가 없다(firebase.ts subscribeDock). 견본을 찍는 쪽이 글 id로 도킹 · 해제를 부른다
    if (import.meta.env.DEV) Object.assign(window, {
      __wallDock: (id: string) => { const m = listRef.current.find((x) => x.id === id); if (m) show(m, Date.now()); },
      __wallUndock: () => land()
    });

    const unsub = subscribeDock(
      (s) => {
        // ── 끝났나 ── 폰이 적은 끝난 시각, 또는 홈에서 꽂힘이 풀린 것. 뒤엣것이 있어서 폰이 꺼지거나 인터넷이 끊겨도 30초를 멍하니 기다리지 않는다
        const ended = s.endedAt > 0 || (!s.plugged && s.switchAt > s.startedAt);
        if (ended && s.startId === seenIdRef.current) land();
        // ── 새 사건인가 ──
        if (!s.startId || s.startId === seenIdRef.current) return;
        // 번호를 먼저 적는다. 글을 가져오는 동안 다음 바퀴가 같은 사건을 또 집으면 한 발화가 두 번 등장한다
        seenIdRef.current = s.startId;
        writeSeen(s.startId);
        if (s.endedAt > 0) return;                            // 이미 끝난 사건
        if (Date.now() - s.startedAt >= EMPHASIS_MS) return;  // 지나간 사건
        // **어느 글인지 모르면 아무 일도 일어나지 않는다.** '최신'으로 대충 넘기면 방금 쓴 사람이 앞사람 글을 제 발화로 보게 된다
        if (!s.startMessage) return;
        const known = listRef.current.find((m) => m.id === s.startMessage);
        if (known) { show(known, s.startedAt); return; }
        void getMessage(s.startMessage).then((fetched) => { if (fetched) show(fetched, s.startedAt); });
      },
      () => { /* 잠깐 못 읽는 것으로 하늘을 건드리지 않는다 */ },
      // 자주 봐야 하는 자리는 둘이다 — 07에 누가 서 있는 동안(등장이 늦지 않게) · 큰 말이 서 있는 동안(폰을 뗐을 때 곧바로 접히게)
      (s) => {
        if (runRef.current && !runRef.current.released) return DOCK_POLL_WAIT_MS;
        return s && !waitIsFree(s) ? DOCK_POLL_WAIT_MS : DOCK_POLL_IDLE_MS;
      }
    );
    return () => {
      clearTimeout(termTimerRef.current);
      clearTimeout(closeTimerRef.current);
      clearTimeout(lingerTimerRef.current);
      unsub();
    };
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setMessages(null);
    initialLoadedRef.current = false;
    window.location.reload();
  }, []);

  async function seedSamples() {
    if (seeding) return;
    setSeeding(true);
    try {
      // 04 미리보기와 같은 목록 (lib/samples)
      for (const s of SAMPLE_MESSAGES) await submitMessage({ text: s.text, tone: s.tone, startedAt: Date.now() });
    } catch (err) {
      setError('샘플 추가 실패: ' + (err as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  const isLoading = messages === null && !error;
  const isEmpty = messages !== null && visible.length === 0;

  return (
    <div
      className="wall"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button, a')) return;
        setShowOverlay((v) => !v);
      }}
    >
      {/* Empty/error/loading panel */}
      {(isLoading || isEmpty || error) && (
        <div className="wall-empty">
          {isLoading && (
            <>
              <div className="wall-empty-glyph">···</div>
              <div className="wall-empty-text">벽을 불러오고 있어요</div>
            </>
          )}
          {error && (
            <>
              <div className="wall-empty-glyph" style={{ color: '#f55' }}>!</div>
              <div className="wall-empty-text" style={{ color: '#f55', maxWidth: 420, textAlign: 'center', lineHeight: 1.6 }}>
                {error}
              </div>
              <div className="wall-error-actions">
                <button className="wall-cta" onClick={retry}>다시 시도</button>
                <a className="wall-cta" href="/wall?mock=1">데모 모드로 보기 →</a>
              </div>
            </>
          )}
          {isEmpty && !error && (
            <>
              <div className="wall-empty-glyph">···</div>
              <div className="wall-empty-text">아직 벽이 비어 있어요</div>
              <div className="wall-empty-mode">
                {isFirebaseConfigured() ? '저장소: Firestore (라이브)' : '저장소: 로컬 mock (?mock=1)'}
              </div>
              <button className="wall-cta" onClick={seedSamples} disabled={seeding}>
                {seeding ? '추가 중…' : isFirebaseConfigured() ? 'Firestore에 샘플 5개 추가' : 'mock에 샘플 5개 추가'}
              </button>
              <a href="/?stage=enter" className="wall-link-secondary">또는 직접 메시지 쓰기 →</a>
            </>
          )}
        </div>
      )}

      {/* 소리의 결(결정 9) — 도킹 때만 기기에서 퍼진다. 말과 땅 뒤라 땅보다 먼저 놓는다(WallSky가 그린다) */}
      <canvas ref={waves} className="wall-waves" aria-hidden="true" />
      {/* 바닥 — 땅 띠와 그 속의 로고타입(결정 6). 말들 뒤. 왼쪽 위의 원 배지는 뺐다 */}
      <WallGround />
      {/* 하늘 · 도킹 — 처음 받은 목록으로 쌓는다(받기 전에 쌓으면 받은 글이 모두 아래에서 올라오는 것으로 읽힌다) */}
      {messages !== null && <WallSky list={visible} dock={dock} beat={beat} waves={waves} />}
      {/* 벽의 작은 사람 둘 — 땅 위를 걷는다 */}
      <WallWalkers beat={beat} />

      {showOverlay && (
        <div className="wall-overlay">
          <div className="wall-overlay-line">MEGAFONT · WALL</div>
          <div className="wall-overlay-line">하늘 {visible.length}개 {dock ? (dock.release ? '· 하늘로 오르는 중' : '· 도킹 중') : '· 트리거 대기'}</div>
          <div className="wall-overlay-line">{isFirebaseConfigured() ? 'Firestore 연결됨' : '로컬 mock 데이터'}</div>
          <div className="wall-overlay-hint">화면 탭 → 정보 토글</div>
        </div>
      )}
    </div>
  );
}
