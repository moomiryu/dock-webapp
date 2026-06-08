// Wall projection — MEGAFONT's output side.
// Trigger-driven: messages are cached as they arrive but NOT shown. When an
// operator sets control/display.showTrigger = true, the latest cached message
// is revealed (typewriter), held 6s, then hidden — and the trigger is reset.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fontMap } from '../lib/palettes';
import { palettes as legacyPalettes } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { graphics as wallGraphics } from '../lib/graphics-v2';
import {
  isFirebaseConfigured,
  submitMessage,
  subscribeMessages,
  subscribeShowTrigger,
  resetShowTrigger
} from '../lib/firebase';
import type { StoredMessage } from '../lib/firebase';
import type { ToneState } from '../types';

// ─── Tunables ─────────────────────────────────────────────────────────
const RECENT_N = 24;                          // how many recent messages to cache
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;   // 7 days
const DISPLAY_MS = 6000;                       // how long a triggered message stays
const LOAD_TIMEOUT_MS = 20000;

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

// ─── Component ────────────────────────────────────────────────────────

export default function WallSimulation() {
  const [messages, setMessages] = useState<StoredMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Currently revealed message (only set when triggered).
  const [displayed, setDisplayed] = useState<StoredMessage | null>(null);
  const [closing, setClosing] = useState(false);
  const [showCount, setShowCount] = useState(0);

  // Body mode
  useEffect(() => {
    document.body.classList.add('wall-mode');
    document.body.classList.remove('themed');
    document.body.style.removeProperty('--bg-outer');
    return () => {
      document.body.classList.remove('wall-mode');
    };
  }, []);

  // Tick `now` for the age filter
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Cache messages (do NOT display on arrival)
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

  // Recent, in-age messages (newest first)
  const visible = useMemo(() => {
    if (!messages) return [];
    return messages
      .filter((m) => now - m.createdAt < MAX_AGE_MS)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, RECENT_N);
  }, [messages, now]);

  // Keep the latest message in a ref so the trigger callback always sees it
  const latestRef = useRef<StoredMessage | null>(null);
  useEffect(() => {
    latestRef.current = visible[0] ?? null;
  }, [visible]);

  // Listen to control/display.showTrigger — reveal the latest on the rising edge
  const busyRef = useRef(false);
  useEffect(() => {
    const unsub = subscribeShowTrigger(
      (showTrigger) => {
        if (!showTrigger || busyRef.current) return;
        const latest = latestRef.current;
        busyRef.current = true;
        void resetShowTrigger(); // reset immediately so it fires once
        if (!latest) {
          busyRef.current = false;
          return;
        }
        setClosing(false);
        setDisplayed(latest);
        setShowCount((c) => c + 1);
        window.setTimeout(() => setClosing(true), DISPLAY_MS - 400);
        window.setTimeout(() => {
          setDisplayed(null);
          setClosing(false);
          busyRef.current = false;
        }, DISPLAY_MS);
      },
      () => {
        /* control read errors are non-fatal; keep waiting */
      }
    );
    return unsub;
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setMessages(null);
    initialLoadedRef.current = false;
    window.location.reload();
  }, []);

  // Seed samples directly via submitMessage
  async function seedSamples() {
    if (seeding) return;
    setSeeding(true);
    const samples: Array<{ text: string; tone: ToneState }> = [
      { text: '저는 과기대를 사랑하는데 총장님은 아니신가봐요', tone: { font: 'ttoryeot', tone: 1.0, wght: 700, slnt: 0, size: 56, paletteIdx: 0, graphicIdx: 0 } },
      { text: '등록금 어디 쓰는지 알려줘', tone: { font: 'chabun', tone: 0.7, wght: 700, slnt: -8, size: 48, paletteIdx: 1, graphicIdx: 3 } },
      { text: '내일 비 온대', tone: { font: 'doran', tone: 1.3, wght: 400, slnt: 0, size: 44, paletteIdx: 2, graphicIdx: 1 } },
      { text: '오늘 못 한 말', tone: { font: 'ttoryeot', tone: 1.0, wght: 700, slnt: 0, size: 52, paletteIdx: 4, graphicIdx: 4 } },
      { text: '여기에 누가 있다', tone: { font: 'deulseok', tone: 1.0, wght: 500, slnt: 0, size: 48, paletteIdx: 3, graphicIdx: -1 } }
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
      {/* Empty/error/loading panel */}
      {(isLoading || isEmpty || error) && (
        <div className="wall-empty">
          {isLoading && (
            <>
              <div className="wall-empty-glyph">···</div>
              <div className="wall-empty-text">외벽을 불러오고 있어요</div>
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
              <div className="wall-empty-text">아직 외벽이 비어있어요</div>
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
              <a href="/?stage=enter" className="wall-link-secondary">
                또는 직접 메시지 쓰기 →
              </a>
            </>
          )}
        </div>
      )}

      {/* Triggered message (revealed on control/display.showTrigger) */}
      {displayed && <WallShowMessage key={showCount} msg={displayed} closing={closing} />}

      {showOverlay && (
        <div className="wall-overlay">
          <div className="wall-overlay-line">MEGAFONT · WALL</div>
          <div className="wall-overlay-line">
            캐시 {visible.length}개 · 트리거 대기 {busyRef.current ? '· 표시 중' : ''}
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

// ─── Revealed message (typewriter, solo center) ──────────────────────

function WallShowMessage({ msg, closing }: { msg: StoredMessage; closing: boolean }) {
  const { color, graphic, graphicIdx, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);
  const chars = useMemo(() => Array.from(msg.text), [msg.text]);
  const hasGraphic = graphicIdx >= 0 && graphicIdx < wallGraphics.length;

  return (
    <div
      className={`wall-emphasis ${closing ? 'is-closing' : ''}`}
      style={{
        color,
        fontFamily,
        fontWeight: wght,
        fontVariationSettings: `"wght" ${wght}`
      }}
    >
      {hasGraphic && (
        <div
          className="wall-emphasis-graphic"
          style={{ color: graphic }}
          aria-hidden
          dangerouslySetInnerHTML={{ __html: wallGraphics[graphicIdx] }}
        />
      )}
      <div
        className="wall-emphasis-text"
        style={{ transform: `scaleX(${scaleX}) skewX(${skew}deg)` }}
      >
        {chars.map((ch, i) =>
          ch === '\n' ? (
            <br key={i} />
          ) : (
            <span key={i} className="wall-char" style={{ animationDelay: `${i * 0.07}s` }}>
              {ch === ' ' ? ' ' : ch}
            </span>
          )
        )}
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
    const fontFamily = tone ? fontMap[tone.font] : fontMap.botong;
    return {
      color: wallColors.text,
      graphic: wallColors.graphic,
      graphicIdx: tone?.graphicIdx ?? -1,
      fontFamily,
      wght: tone?.wght ?? 400,
      scaleX: tone?.tone ?? 1.0,
      skew: tone?.slnt ?? 0
    };
  }, [msg]);
}
