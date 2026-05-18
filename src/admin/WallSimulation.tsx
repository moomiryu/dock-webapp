// Wall projection simulator — the OUTPUT side of DOCK.
// What the 4×6m external projection would show.
//
// Spec: 11 messages floating bottom→top, each in its author's chosen tone,
// each with its own line pulse (desynced). Black canvas (the projection
// surface). New messages enter at the bottom, old ones drift off the top.
//
// For development this loops faster than 7 days — full cycle ~90s per message.

import { useEffect, useMemo, useState } from 'react';
import { fontMap } from '../lib/palettes';
import { graphics as graphicsV2 } from '../lib/graphics-v2';
import { palettes as legacyPalettes } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { isFirebaseConfigured, listMessages } from '../lib/firebase';
import type { StoredMessage } from '../lib/firebase';

const SLOT_COUNT = 11;
const CYCLE_S = 90; // full bottom→top traversal in seconds

interface WallSlot {
  msg: StoredMessage;
  /** Animation offset 0..1 — where in the rise cycle this message starts */
  phase: number;
  /** Horizontal offset 0..1 */
  xOffset: number;
}

export default function WallSimulation() {
  const [messages, setMessages] = useState<StoredMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    document.body.classList.add('wall-mode');
    document.body.classList.remove('themed');
    document.body.style.removeProperty('--bg-outer');
    return () => {
      document.body.classList.remove('wall-mode');
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const m = await listMessages(50);
        if (!cancelled) setMessages(m);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    }
    load();
    // Re-poll every 30s for new messages
    const interval = window.setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  // Build 11 slots from available messages
  const slots = useMemo<WallSlot[]>(() => {
    if (!messages || messages.length === 0) return [];
    const slots: WallSlot[] = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const msg = messages[i % messages.length];
      // Stable pseudo-random phase + x based on i (and msg id to avoid same-msg duplicates colliding)
      const seed = hashStr(msg.id + ':' + i);
      const phase = (seed % 1000) / 1000;
      const xOffset = ((seed >> 10) % 1000) / 1000;
      slots.push({ msg, phase, xOffset });
    }
    return slots;
  }, [messages]);

  return (
    <div className="wall" onClick={() => setShowOverlay((v) => !v)}>
      {error && <div className="wall-error">{error}</div>}

      {(!messages || messages.length === 0) && !error && (
        <div className="wall-empty">
          <div className="wall-empty-glyph">···</div>
          <div className="wall-empty-text">
            {messages === null ? '풍경 불러오는 중' : '아직 풍경에 발화가 없습니다'}
          </div>
        </div>
      )}

      {slots.map((slot, i) => (
        <WallMessage key={`${slot.msg.id}-${i}`} slot={slot} index={i} />
      ))}

      {showOverlay && (
        <div className="wall-overlay">
          <div className="wall-overlay-line">DOCK · WALL SIMULATION</div>
          <div className="wall-overlay-line">
            {messages?.length ?? 0}개 발화 · 11 slot · 90s cycle
          </div>
          <div className="wall-overlay-line">
            {isFirebaseConfigured() ? 'Firebase 연결됨' : '로컬 mock 데이터'}
          </div>
          <div className="wall-overlay-hint">화면 탭 → 정보 토글</div>
        </div>
      )}
    </div>
  );
}

function WallMessage({ slot, index }: { slot: WallSlot; index: number }) {
  const { msg, phase, xOffset } = slot;
  const tone = msg.tone;

  // Resolve palette: prefer v2 moods (paletteIdx now refers to mood index 0-4)
  // Backwards-compat with old legacy palettes (paletteIdx 0-9)
  const pal = useMemo(() => {
    if (!tone) return moods[3]; // CLASSIC fallback
    const mood = moods[tone.paletteIdx];
    if (mood) return mood;
    const legacy = legacyPalettes[tone.paletteIdx];
    if (legacy) return { bg: legacy.bg, text: legacy.text, graphic: legacy.graphic };
    return moods[3];
  }, [tone]);

  const fontFamily = tone ? fontMap[tone.font] : fontMap.gothic;
  const wght = tone?.wght ?? 400;
  const lowWght = Math.max(100, Math.round(wght * 0.5));
  const scaleX = tone?.tone ?? 1.0;
  const skew = tone?.slnt ?? 0;
  const size = tone?.size ?? 40;

  // CSS animation delay so each starts at its own phase
  const animDelay = -(phase * CYCLE_S);

  return (
    <div
      className="wall-msg"
      style={{
        ['--cycle' as string]: `${CYCLE_S}s`,
        ['--x-offset' as string]: `${(xOffset - 0.5) * 20}vw`,
        ['--anim-delay' as string]: `${animDelay}s`,
        ['--wght-base' as string]: String(lowWght),
        ['--wght-active' as string]: String(wght),
        ['--pulse-delay' as string]: `${index * 0.4}s`,
        color: pal.text
      }}
    >
      {tone && tone.graphicIdx >= 0 && tone.graphicIdx < graphicsV2.length && (
        <div
          className="wall-msg-graphic"
          style={{ color: pal.graphic }}
          dangerouslySetInnerHTML={{ __html: graphicsV2[tone.graphicIdx] }}
        />
      )}
      <div
        className="wall-msg-text"
        style={{
          fontFamily,
          fontSize: Math.min(size * 0.7, 56) + 'px',
          transform: `scaleX(${scaleX}) skewX(${skew}deg)`
        }}
      >
        <WallText text={msg.text} />
      </div>
    </div>
  );
}

function WallText({ text }: { text: string }) {
  // Same line-pulse pattern as Z2 / MessageTile — split into word spans
  // and toggle .active per line on a 2.4s interval.
  const [activeLine, setActiveLine] = useState(0);
  const words = text.split(/\s+/);
  const [lineMap, setLineMap] = useState<number[]>([]);

  useEffect(() => {
    // Recompute lineMap by querying DOM bounds after render
    const id = window.setTimeout(() => {
      const container = document.getElementById('wall-text-probe-' + text.slice(0, 8));
      void container;
      // We just toggle by index instead — simpler for the simulation
      setLineMap(words.map((_, i) => i % 3));
    }, 16);
    return () => clearTimeout(id);
  }, [text]);

  useEffect(() => {
    const lineCount = Math.max(1, Math.max(...(lineMap.length ? lineMap : [0])) + 1);
    const interval = window.setInterval(() => {
      setActiveLine((l) => (l + 1) % lineCount);
    }, 2400);
    return () => clearInterval(interval);
  }, [lineMap]);

  return (
    <>
      {words.map((w, i) => (
        <span
          key={i}
          className={'word ' + ((lineMap[i] ?? 0) === activeLine ? 'active' : '')}
        >
          {w}{' '}
        </span>
      ))}
    </>
  );
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
