// Wall projection — MEGAFONT's output side.
// Landscape (풍경): cached messages always drift across horizontal tracks.
// On a switch trigger (control/display.showTrigger -> true) the latest message
// "comes out" — a full-bleed, mood-coloured, typewriter emphasis on top of the
// landscape — then fades back to reveal the drifting crowd again.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fontMap } from '../lib/palettes';
import { palettes as legacyPalettes } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { EMPHASIS_MS, STAY_MS } from '../lib/wall';
import { brightestColor } from '../lib/wallColor';
import { SAMPLE_MESSAGES } from '../lib/samples';
import {
  isFirebaseConfigured,
  submitMessage,
  subscribeMessages,
  subscribeShowTrigger,
  resetShowTrigger,
  getMessage
} from '../lib/firebase';
import type { StoredMessage } from '../lib/firebase';

// ─── Tunables ─────────────────────────────────────────────────────────
const RECENT_N = 15;                            // fewer reads per poll (quota)
// 체류 기간은 lib/wall.ts 한 곳에서 정한다 (아카이브가 따로 없으니 이게 수명 전부)
const LOAD_TIMEOUT_MS = 20000;

// Three well-spaced tracks; blocks drift horizontally. Phase is distributed
// evenly per track (not random) so same-speed blocks keep a constant gap and
// never overlap.
const TRACKS: ReadonlyArray<{ y: number; duration: number; dir: 'left' | 'right' }> = [
  { y: 20, duration: 150, dir: 'left' },
  { y: 50, duration: 190, dir: 'right' },
  { y: 80, duration: 165, dir: 'left' }
];
const LANDSCAPE_N = 12; // recent messages in the drifting landscape (denser)

// ─── Helpers ──────────────────────────────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────

export default function WallSimulation() {
  const [messages, setMessages] = useState<StoredMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Triggered emphasis (on top of the landscape)
  const [emphMsg, setEmphMsg] = useState<StoredMessage | null>(null);
  const [emphClosing, setEmphClosing] = useState(false);
  const [emphKey, setEmphKey] = useState(0);

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

  // Cache messages (the landscape source)
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
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        // Only surface an error on the very first load. Once the landscape is
        // up, ignore transient failures (e.g. a 429 burst) so it doesn't blank.
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

  const visible = useMemo(() => {
    if (!messages) return [];
    return messages
      .filter((m) => now - m.createdAt < STAY_MS)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, RECENT_N);
  }, [messages, now]);

  const latestRef = useRef<StoredMessage | null>(null);
  const listRef = useRef<StoredMessage[]>([]);
  useEffect(() => {
    latestRef.current = visible[0] ?? null;
    listRef.current = visible;
  }, [visible]);

  // Switch trigger → 지목된 글을 크게. 상승 엣지(false→true)에서만.
  const prevTriggerRef = useRef(false);
  const dockedRef = useRef(false);
  const closeTimerRef = useRef(0);
  const hideTimerRef = useRef(0);
  useEffect(() => {
    const show = (msg: StoredMessage) => {
      clearTimeout(closeTimerRef.current);
      clearTimeout(hideTimerRef.current);
      setEmphClosing(false);
      setEmphMsg(msg);
      setEmphKey((k) => k + 1);
      // EMPHASIS_MS는 상한이다. 대개는 아래 '폰이 빠졌다'가 먼저 끝낸다.
      closeTimerRef.current = window.setTimeout(() => setEmphClosing(true), EMPHASIS_MS - 400);
      hideTimerRef.current = window.setTimeout(() => {
        setEmphMsg(null);
        setEmphClosing(false);
      }, EMPHASIS_MS);
    };

    const closeNow = () => {
      clearTimeout(closeTimerRef.current);
      clearTimeout(hideTimerRef.current);
      setEmphClosing(true);
      hideTimerRef.current = window.setTimeout(() => {
        setEmphMsg(null);
        setEmphClosing(false);
      }, 400);
    };

    const unsub = subscribeShowTrigger(
      (showTrigger, showId, docked) => {
        // 폰이 빠지는 순간 큰 목소리가 끝나고 메아리로 남는다.
        // 강조를 끝내는 건 타이머가 아니라 사람이다 — 타이머는 아무도 빼지
        // 않았을 때를 위한 상한일 뿐이다.
        const wasDocked = dockedRef.current;
        dockedRef.current = docked;
        if (wasDocked && !docked) closeNow();

        const rising = showTrigger && !prevTriggerRef.current;
        prevTriggerRef.current = showTrigger;
        if (!rising) return;
        void resetShowTrigger();

        // 방금 꽂은 사람의 글이 무엇인지 신호가 지목해준다.
        // 목록은 60초마다 갱신되므로 그 안에 없을 수 있다 — 그러면 직접 가져온다.
        // 여기서 '최신'으로 대충 넘기면 방금 쓴 사람이 앞사람 글을 보게 된다.
        const known = showId ? listRef.current.find((m) => m.id === showId) : null;
        if (known) {
          show(known);
          return;
        }
        if (showId) {
          void getMessage(showId).then((fetched) => {
            const msg = fetched ?? latestRef.current;
            if (msg) show(msg);
          });
          return;
        }
        const latest = latestRef.current;
        if (latest) show(latest);
      },
      () => {
        /* control read errors are non-fatal */
      }
    );
    return () => {
      clearTimeout(closeTimerRef.current);
      clearTimeout(hideTimerRef.current);
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
      // 04 미리보기의 풍경과 같은 목록 (lib/samples)
      for (const s of SAMPLE_MESSAGES) {
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

      {/* Landscape — multi-line blocks (line breaks kept, no effect, one size)
          drifting horizontally on evenly-spaced tracks */}
      {visible.slice(0, LANDSCAPE_N).map((msg, i, arr) => (
        <WallBlock key={msg.id} msg={msg} index={i} total={arr.length} />
      ))}

      {/* Triggered emphasis on top */}
      {emphMsg && <WallShowMessage key={emphKey} msg={emphMsg} closing={emphClosing} />}

      {showOverlay && (
        <div className="wall-overlay">
          <div className="wall-overlay-line">MEGAFONT · WALL</div>
          <div className="wall-overlay-line">
            풍경 {visible.length}개 {emphMsg ? '· 강조 중' : '· 트리거 대기'}
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

// ─── Landscape block (drifting multi-line message) ──────────────────

const WallBlock = memo(function WallBlock({ msg, index, total }: { msg: StoredMessage; index: number; total: number }) {
  const track = TRACKS[index % TRACKS.length];
  const posInTrack = Math.floor(index / TRACKS.length);
  const countInTrack = Math.max(1, Math.ceil(total / TRACKS.length));

  // 한 트랙 안에서는 균등 간격이라 같은 속도끼리 겹치지 않는다.
  // 거기에 트랙마다 시작점을 어긋내야 메시지가 적을 때도 화면이 고르게 찬다 —
  // 이게 없으면 글이 세 개일 때 셋 다 위상 0에서 같이 출발해, 설치 첫날
  // 벽이 대부분 비어 있다가 한 덩어리가 지나가는 꼴이 된다.
  const trackOffset = (index % TRACKS.length) / TRACKS.length;
  const phase = (posInTrack / countInTrack + trackOffset) % 1;
  const animDelay = -phase * track.duration;
  const { crowdColor, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);
  const lines = useMemo(() => msg.text.split('\n'), [msg.text]);

  return (
    <div
      className={`wall-block track-${track.dir}`}
      style={{ top: `${track.y}%`, animationDuration: `${track.duration}s`, animationDelay: `${animDelay}s` }}
    >
      <div
        className="wall-block-inner"
        style={{
          color: crowdColor,
          fontFamily,
          fontWeight: wght,
          fontVariationSettings: `"wght" ${wght}`,
          transform: `scaleX(${scaleX}) skewX(${skew}deg)`
        }}
      >
        {lines.map((line, li) => (
          <div className="wall-line" key={li}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── Triggered emphasis (full-bleed mood, typewriter) ───────────────

const WallShowMessage = memo(function WallShowMessage({ msg, closing }: { msg: StoredMessage; closing: boolean }) {
  const { bg, text, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);
  const lines = useMemo(() => msg.text.split('\n'), [msg.text]);
  let charIdx = 0;

  // Auto-fit: more text → smaller. Longest line fits the width, line count fits
  // the height; CSS min() takes whichever is more constrained.
  const longest = Math.max(1, ...lines.map((l) => Array.from(l).length));
  const fitSize = `clamp(40px, min(${(88 / longest).toFixed(2)}vw, ${(82 / (lines.length * 1.25)).toFixed(2)}vh), 240px)`;

  return (
    <div className={`wall-show ${closing ? 'is-closing' : ''}`} style={{ background: bg, color: text }}>
      <div
        className="wall-emphasis-text"
        style={{
          fontSize: fitSize,
          transform: `scaleX(${scaleX}) skewX(${skew}deg)`,
          fontFamily,
          fontWeight: wght,
          fontVariationSettings: `"wght" ${wght}`
        }}
      >
        {lines.map((line, li) => (
          <div className="wall-line" key={li}>
            {Array.from(line).map((ch, ci) => {
              const delay = charIdx * 0.1;
              charIdx += 1;
              return (
                <span key={ci} className="wall-char" style={{ animationDelay: `${delay}s` }}>
                  {ch === ' ' ? ' ' : ch}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── Shared style derivation ─────────────────────────────────────────

function useDerivedStyle(msg: StoredMessage) {
  return useMemo(() => {
    const tone = msg.tone;
    let pal;
    if (!tone) {
      pal = moods[3];
    } else {
      const mood = moods[tone.paletteIdx];
      if (mood) pal = mood;
      else {
        const legacy = legacyPalettes[tone.paletteIdx];
        pal = legacy ? { bg: legacy.bg, text: legacy.text } : moods[3];
      }
    }
    const fontFamily = tone ? fontMap[tone.font] : fontMap.botong;
    return {
      bg: pal.bg,
      text: pal.text,
      crowdColor: brightestColor(pal),
      fontFamily,
      wght: tone?.wght ?? 400,
      scaleX: tone?.tone ?? 1.0,
      skew: tone?.slnt ?? 0
    };
  }, [msg]);
}
