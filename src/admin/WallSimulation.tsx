// Wall projection — MEGAFONT's output side.
// Landscape (풍경): cached messages always drift across horizontal tracks.
// On a switch trigger (control/display.showTrigger -> true) the latest message
// "comes out" — a full-bleed, mood-coloured, typewriter emphasis on top of the
// landscape — then fades back to reveal the drifting crowd again.

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
const RECENT_N = 24;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const EMPHASIS_MS = 10_000; // how long a triggered message stays solo at center
const LOAD_TIMEOUT_MS = 20000;

// Fixed, well-separated slots (block CENTER, % of viewport). Each block sits in
// its own slot and only gently floats in place — so blocks never overlap.
const SLOTS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 20, y: 22 },
  { x: 52, y: 18 },
  { x: 82, y: 28 },
  { x: 30, y: 52 },
  { x: 70, y: 50 },
  { x: 18, y: 80 },
  { x: 52, y: 82 },
  { x: 84, y: 76 }
];
const LANDSCAPE_N = SLOTS.length; // how many recent messages drift as the landscape

// ─── Helpers ──────────────────────────────────────────────────────────

function luminance(hex: string): number {
  const h = hex.replace('#', '');
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Brightest of the mood's three colors — readable on the black landscape.
function brightestColor(p: { bg: string; text: string; graphic: string }): string {
  return [p.bg, p.text, p.graphic].sort((a, b) => luminance(b) - luminance(a))[0];
}

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

  const visible = useMemo(() => {
    if (!messages) return [];
    return messages
      .filter((m) => now - m.createdAt < MAX_AGE_MS)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, RECENT_N);
  }, [messages, now]);

  const latestRef = useRef<StoredMessage | null>(null);
  useEffect(() => {
    latestRef.current = visible[0] ?? null;
  }, [visible]);

  // Switch trigger → emphasize the latest, on the rising edge (false→true)
  const prevTriggerRef = useRef(false);
  const closeTimerRef = useRef(0);
  const hideTimerRef = useRef(0);
  useEffect(() => {
    const unsub = subscribeShowTrigger(
      (showTrigger) => {
        const rising = showTrigger && !prevTriggerRef.current;
        prevTriggerRef.current = showTrigger;
        if (!rising) return;
        void resetShowTrigger();
        const latest = latestRef.current;
        if (!latest) return;
        clearTimeout(closeTimerRef.current);
        clearTimeout(hideTimerRef.current);
        setEmphClosing(false);
        setEmphMsg(latest);
        setEmphKey((k) => k + 1);
        closeTimerRef.current = window.setTimeout(() => setEmphClosing(true), EMPHASIS_MS - 400);
        hideTimerRef.current = window.setTimeout(() => {
          setEmphMsg(null);
          setEmphClosing(false);
        }, EMPHASIS_MS);
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

      {/* Landscape — multi-line blocks in fixed slots, gently floating, each
          keeping its own line breaks + effect + margin (no overlap) */}
      {visible.slice(0, LANDSCAPE_N).map((msg, i) => (
        <WallBlock key={msg.id} msg={msg} index={i} />
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

const WallBlock = memo(function WallBlock({ msg, index }: { msg: StoredMessage; index: number }) {
  const slot = SLOTS[index % SLOTS.length];
  const { crowdColor, graphicIdx, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);
  const lines = useMemo(() => msg.text.split('\n'), [msg.text]);
  const hasGraphic = graphicIdx >= 0 && graphicIdx < wallGraphics.length;
  const dur = 11 + (index % 5) * 2; // gentle float, desynced per slot

  return (
    <div
      className="wall-block"
      style={{ left: `${slot.x}%`, top: `${slot.y}%`, animationDuration: `${dur}s`, animationDelay: `${-index * 1.7}s` }}
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
        {hasGraphic && (
          <div
            className="wall-block-graphic"
            style={{ color: crowdColor }}
            aria-hidden
            dangerouslySetInnerHTML={{ __html: wallGraphics[graphicIdx] }}
          />
        )}
        <div className="wall-block-text">
          {lines.map((line, li) => (
            <div className="wall-line" key={li}>
              {line}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

// ─── Triggered emphasis (full-bleed mood, typewriter) ───────────────

const WallShowMessage = memo(function WallShowMessage({ msg, closing }: { msg: StoredMessage; closing: boolean }) {
  const { bg, text, graphic, blend, graphicIdx, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);
  const lines = useMemo(() => msg.text.split('\n'), [msg.text]);
  const hasGraphic = graphicIdx >= 0 && graphicIdx < wallGraphics.length;
  let charIdx = 0;

  return (
    <div className={`wall-show ${closing ? 'is-closing' : ''}`} style={{ background: bg, color: text }}>
      {hasGraphic && (
        <div
          className="wall-emphasis-graphic"
          style={{ color: graphic, mixBlendMode: blend }}
          aria-hidden
          dangerouslySetInnerHTML={{ __html: wallGraphics[graphicIdx] }}
        />
      )}
      <div
        className="wall-emphasis-text"
        style={{
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
        pal = legacy ? { bg: legacy.bg, text: legacy.text, graphic: legacy.graphic } : moods[3];
      }
    }
    const blend = (pal as { blend?: 'multiply' | 'screen' }).blend ?? 'multiply';
    const fontFamily = tone ? fontMap[tone.font] : fontMap.botong;
    return {
      bg: pal.bg,
      text: pal.text,
      graphic: pal.graphic,
      blend,
      crowdColor: brightestColor(pal),
      graphicIdx: tone?.graphicIdx ?? -1,
      fontFamily,
      wght: tone?.wght ?? 400,
      scaleX: tone?.tone ?? 1.0,
      skew: tone?.slnt ?? 0
    };
  }, [msg]);
}
