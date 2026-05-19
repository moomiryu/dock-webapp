// Wall projection simulator — DOCK's output side.
// v2: 국립중앙박물관 식 — horizontal multi-track scrolling, emphasis mode
// for newly arrived messages, max-age + recent-N filtering, real-time
// Firestore onSnapshot updates.
//
// Two modes per message:
//   - emphasis (EMPHASIS_MS after createdAt): solo at center, large, no scroll
//   - crowd: assigned to one of N horizontal tracks, scrolls left/right
//
// Black canvas with faint horizontal track lines (museum projector grid).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fontMap } from '../lib/palettes';
import { palettes as legacyPalettes } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { isFirebaseConfigured, submitMessage, subscribeMessages } from '../lib/firebase';
import type { StoredMessage } from '../lib/firebase';
import type { ToneState } from '../types';

// ─── Tunables ─────────────────────────────────────────────────────────
const RECENT_N = 24;                   // how many most-recent messages to display
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const EMPHASIS_MS = 12_000;            // newly arrived message stays solo at center (12s)
const LOAD_TIMEOUT_MS = 8000;

// Horizontal tracks — each is a fixed band on the wall.
// y: vertical position (% of viewport height)
// size: 'sm' | 'md' | 'lg'
// duration: seconds for one full traverse
// dir: 'left' (right→left) or 'right' (left→right)
const TRACKS: ReadonlyArray<{ y: number; size: 'sm' | 'md' | 'lg'; duration: number; dir: 'left' | 'right' }> = [
  { y: 8,  size: 'sm', duration: 95,  dir: 'left' },
  { y: 22, size: 'md', duration: 70,  dir: 'right' },
  { y: 38, size: 'lg', duration: 110, dir: 'left' },
  { y: 54, size: 'md', duration: 80,  dir: 'right' },
  { y: 70, size: 'sm', duration: 105, dir: 'left' },
  { y: 86, size: 'lg', duration: 60,  dir: 'right' }
];

const SIZE_PX: Record<'sm' | 'md' | 'lg', number> = { sm: 22, md: 34, lg: 52 };

// ─── Helpers ──────────────────────────────────────────────────────────

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function wallColorsFor(p: { bg: string; text: string; graphic: string }) {
  const ranked = [p.bg, p.text, p.graphic]
    .map((c) => ({ c, l: luminance(c) }))
    .sort((a, b) => b.l - a.l);
  return { text: ranked[0].c, graphic: ranked[1].c };
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// ─── Component ────────────────────────────────────────────────────────

export default function WallSimulation() {
  const [messages, setMessages] = useState<StoredMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Body mode
  useEffect(() => {
    document.body.classList.add('wall-mode');
    document.body.classList.remove('themed');
    document.body.style.removeProperty('--bg-outer');
    return () => {
      document.body.classList.remove('wall-mode');
    };
  }, []);

  // Tick `now` every second so emphasis transitions feel live
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Real-time Firestore subscription with a load-timeout fallback
  const initialLoadedRef = useRef(false);
  useEffect(() => {
    let timeoutId: number | null = null;
    timeoutId = window.setTimeout(() => {
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
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        setError(null);
        setMessages(msgs);
      },
      (err) => {
        initialLoadedRef.current = true;
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        setError(err.message);
        setMessages([]);
      }
    );

    return () => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      unsub();
    };
  }, []);

  // Filter + sort messages
  const visible = useMemo(() => {
    if (!messages) return [];
    return messages
      .filter((m) => now - m.createdAt < MAX_AGE_MS)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, RECENT_N);
  }, [messages, now]);

  // Newest message — eligible for emphasis if recently arrived
  const newest = visible[0];
  const newestAge = newest ? now - newest.createdAt : Infinity;
  const emphasisMsg = newest && newestAge < EMPHASIS_MS ? newest : null;

  // Crowd = everything else (or all when no emphasis)
  const crowd = useMemo(() => {
    if (!emphasisMsg) return visible;
    return visible.filter((m) => m.id !== emphasisMsg.id);
  }, [visible, emphasisMsg]);

  // Reload function for the retry button
  const retry = useCallback(() => {
    setError(null);
    setMessages(null);
    initialLoadedRef.current = false;
    // Force a remount by changing key — easier: reload subscribe via a no-op state bump
    window.location.reload();
  }, []);

  // Seed samples directly via submitMessage (writes to whatever client is active)
  async function seedSamples() {
    if (seeding) return;
    setSeeding(true);
    const samples: Array<{ text: string; tone: ToneState }> = [
      { text: '저는 과기대를 사랑하는데 총장님은 아니신가봐요', tone: { font: 'gothic', tone: 1.0, wght: 900, slnt: 0, size: 56, paletteIdx: 0, graphicIdx: 0 } },
      { text: '등록금 어디 쓰는지 알려줘', tone: { font: 'myeongjo', tone: 0.7, wght: 700, slnt: -8, size: 48, paletteIdx: 1, graphicIdx: 3 } },
      { text: '내일 비 온대', tone: { font: 'mono', tone: 1.3, wght: 400, slnt: 0, size: 44, paletteIdx: 2, graphicIdx: 1 } },
      { text: '오늘 못 한 말', tone: { font: 'gothic', tone: 1.0, wght: 700, slnt: 0, size: 52, paletteIdx: 4, graphicIdx: 4 } },
      { text: '여기에 누가 있다', tone: { font: 'song', tone: 1.0, wght: 400, slnt: 0, size: 48, paletteIdx: 3, graphicIdx: -1 } }
    ];
    try {
      for (const s of samples) {
        await submitMessage({ text: s.text, tone: s.tone, startedAt: Date.now() });
      }
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
      {/* Faint horizontal track lines (museum projector grid) */}
      <div className="wall-tracks-bg" aria-hidden>
        {TRACKS.map((t, i) => (
          <div key={i} className="wall-track-line" style={{ top: `${t.y}%` }} />
        ))}
      </div>

      {/* Empty/error/loading panel */}
      {(isLoading || isEmpty || error) && (
        <div className="wall-empty">
          {isLoading && (
            <>
              <div className="wall-empty-glyph">···</div>
              <div className="wall-empty-text">풍경을 불러오고 있어요</div>
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
              <div className="wall-empty-text">아직 풍경이 비어있어요</div>
              <div className="wall-empty-mode">
                {isFirebaseConfigured()
                  ? '저장소: Firestore (라이브)'
                  : '저장소: 로컬 mock (?mock=1)'}
              </div>
              <button className="wall-cta" onClick={seedSamples} disabled={seeding}>
                {seeding
                  ? '추가 중…'
                  : isFirebaseConfigured()
                    ? 'Firestore에 샘플 5개 추가'
                    : 'mock에 샘플 5개 추가'}
              </button>
              <a href="/?stage=enter&mode=z" className="wall-link-secondary">
                또는 직접 메시지 쓰기 →
              </a>
            </>
          )}
        </div>
      )}

      {/* Crowd (settled messages on horizontal tracks) */}
      {crowd.map((msg) => (
        <WallCrowdMessage key={msg.id} msg={msg} />
      ))}

      {/* Emphasis (newest message — solo at center for EMPHASIS_MS) */}
      {emphasisMsg && (
        <WallEmphasisMessage key={emphasisMsg.id} msg={emphasisMsg} ageMs={newestAge} />
      )}

      {showOverlay && (
        <div className="wall-overlay">
          <div className="wall-overlay-line">DOCK · WALL</div>
          <div className="wall-overlay-line">
            {visible.length}개 · 최대 {RECENT_N}개 · {Math.round(MAX_AGE_MS / 86_400_000)}일 안
          </div>
          <div className="wall-overlay-line">
            {isFirebaseConfigured() ? 'Firestore 연결됨' : '로컬 mock 데이터'}
          </div>
          <div className="wall-overlay-hint">화면 탭 → 정보 토글</div>
        </div>
      )}
    </div>
  );
}

// ─── Crowd message (horizontal track scroll) ────────────────────────

function WallCrowdMessage({ msg }: { msg: StoredMessage }) {
  const trackIdx = hashStr(msg.id) % TRACKS.length;
  const track = TRACKS[trackIdx];
  // Phase offset so messages don't all stack at the same x
  const phaseSeed = (hashStr(msg.id + '#x') % 1000) / 1000;
  const animDelay = -phaseSeed * track.duration;

  const { color, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);

  return (
    <div
      className={`wall-crowd track-${track.dir}`}
      style={{
        top: `${track.y}%`,
        fontSize: SIZE_PX[track.size] + 'px',
        animationDuration: `${track.duration}s`,
        animationDelay: `${animDelay}s`,
        color,
        fontFamily,
        fontWeight: wght,
        fontVariationSettings: `"wght" ${wght}`,
        transform: `scaleX(${scaleX}) skewX(${skew}deg)`
      }}
    >
      {msg.text}
    </div>
  );
}

// ─── Emphasis message (solo center, fades into crowd) ──────────────

function WallEmphasisMessage({ msg, ageMs }: { msg: StoredMessage; ageMs: number }) {
  const { color, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);

  // Three sub-phases inside emphasis window:
  //   0..1500ms      → entering (slight zoom in)
  //   1500..EMPH-2s  → held solo at full size
  //   last 2s        → shrinking down toward crowd
  const enterMs = 1500;
  const settleMs = 2000;
  let stage: 'enter' | 'hold' | 'settle' = 'hold';
  if (ageMs < enterMs) stage = 'enter';
  else if (ageMs > EMPHASIS_MS - settleMs) stage = 'settle';

  return (
    <div
      className={`wall-emphasis stage-${stage}`}
      style={{
        color,
        fontFamily,
        fontWeight: wght,
        fontVariationSettings: `"wght" ${wght}`
      }}
    >
      <div
        className="wall-emphasis-text"
        style={{ transform: `scaleX(${scaleX}) skewX(${skew}deg)` }}
      >
        {msg.text}
      </div>
      <div className="wall-emphasis-meta">
        방금 풍경에 합류
      </div>
    </div>
  );
}

// ─── Shared style derivation ─────────────────────────────────────────

function useDerivedStyle(msg: StoredMessage) {
  return useMemo(() => {
    const tone = msg.tone;
    let pal;
    if (!tone) {
      pal = moods[3]; // CLASSIC fallback
    } else {
      const mood = moods[tone.paletteIdx];
      if (mood) pal = mood;
      else {
        const legacy = legacyPalettes[tone.paletteIdx];
        pal = legacy ? { bg: legacy.bg, text: legacy.text, graphic: legacy.graphic } : moods[3];
      }
    }
    const wallColors = wallColorsFor(pal);
    const fontFamily = tone ? fontMap[tone.font] : fontMap.gothic;
    return {
      color: wallColors.text,
      fontFamily,
      wght: tone?.wght ?? 400,
      scaleX: tone?.tone ?? 1.0,
      skew: tone?.slnt ?? 0
    };
  }, [msg]);
}
