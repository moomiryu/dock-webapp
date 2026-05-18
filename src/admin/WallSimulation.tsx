// Wall projection simulator — the OUTPUT side of DOCK.
// What the 4×6m external projection would show.
//
// Spec: 11 messages floating bottom→top, each in its author's chosen tone,
// each with its own line pulse (desynced). Black canvas (the projection
// surface). New messages enter at the bottom, old ones drift off the top.
//
// For development this loops faster than 7 days — full cycle ~90s per message.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fontMap } from '../lib/palettes';
import { graphics as graphicsV2 } from '../lib/graphics-v2';
import { palettes as legacyPalettes } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { isFirebaseConfigured, listMessages, submitMessage } from '../lib/firebase';
import type { StoredMessage } from '../lib/firebase';
import type { ToneState } from '../types';

const SLOT_COUNT = 11;
const CYCLE_S = 90; // full bottom→top traversal in seconds

interface WallSlot {
  msg: StoredMessage;
  /** Animation offset 0..1 — where in the rise cycle this message starts */
  phase: number;
  /** Horizontal offset 0..1 */
  xOffset: number;
}

const LOAD_TIMEOUT_MS = 8000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error(`Firestore가 ${ms / 1000}초 안에 응답하지 않았어요. Firestore Database가 생성됐는지, 보안 규칙이 읽기를 허용하는지 확인해주세요.`)),
      ms
    );
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

export default function WallSimulation() {
  const [messages, setMessages] = useState<StoredMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [showOverlay, setShowOverlay] = useState(false);

  useEffect(() => {
    document.body.classList.add('wall-mode');
    document.body.classList.remove('themed');
    document.body.style.removeProperty('--bg-outer');
    return () => {
      document.body.classList.remove('wall-mode');
    };
  }, []);

  const load = useCallback(async () => {
    setError(null);
    try {
      const m = await withTimeout(listMessages(50), LOAD_TIMEOUT_MS);
      setMessages(m);
    } catch (err) {
      setError((err as Error).message);
      setMessages([]);  // stop spinner — show error state
    }
  }, []);

  useEffect(() => {
    load();
    const interval = window.setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  async function seedSamples() {
    if (seeding) return;
    setSeeding(true);
    const samples: Array<{ text: string; tone: ToneState }> = [
      { text: '저는 과기대를 사랑하는데 총장님은 아니신가봐요', tone: { font: 'gothic', tone: 1.0, wght: 900, slnt: 0, size: 56, paletteIdx: 0, graphicIdx: 0 } },
      { text: '등록금 어디 쓰는지 알려줘', tone: { font: 'myeongjo', tone: 0.7, wght: 700, slnt: -8, size: 48, paletteIdx: 1, graphicIdx: 3 } },
      { text: '내일 비 온대', tone: { font: 'mono', tone: 1.3, wght: 400, slnt: 0, size: 44, paletteIdx: 2, graphicIdx: 1 } },
      { text: '오늘 못 한 말', tone: { font: 'gothic', tone: 1.0, wght: 700, slnt: 0, size: 52, paletteIdx: 4, graphicIdx: 4 } },
      { text: '여기에 누가 있다', tone: { font: 'myeongjo', tone: 1.0, wght: 400, slnt: 0, size: 48, paletteIdx: 3, graphicIdx: -1 } }
    ];
    try {
      for (const s of samples) {
        await submitMessage({ text: s.text, tone: s.tone, startedAt: Date.now() });
      }
      await load();
    } catch (err) {
      setError('샘플 추가 실패: ' + (err as Error).message);
    } finally {
      setSeeding(false);
    }
  }

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

  const isEmpty = messages !== null && messages.length === 0;

  return (
    <div className="wall" onClick={(e) => {
      // Ignore clicks on action buttons inside empty/error states
      if ((e.target as HTMLElement).closest('button, a')) return;
      setShowOverlay((v) => !v);
    }}>
      {(messages === null || isEmpty || error) && (
        <div className="wall-empty">
          {messages === null && !error && (
            <>
              <div className="wall-empty-glyph">···</div>
              <div className="wall-empty-text">풍경 불러오는 중</div>
            </>
          )}

          {error && (
            <>
              <div className="wall-empty-glyph" style={{ color: '#f55' }}>!</div>
              <div className="wall-empty-text" style={{ color: '#f55', maxWidth: 420, textAlign: 'center', lineHeight: 1.6 }}>
                {error}
              </div>

              <div className="wall-error-actions">
                <button className="wall-cta" onClick={load}>다시 시도</button>
                <a className="wall-cta" href="/wall?mock=1">
                  데모 모드로 보기 →
                </a>
              </div>

              <div className="wall-error-help">
                <div className="wall-error-help-title">대부분 원인:</div>
                <ol className="wall-error-help-list">
                  <li>
                    Firestore Database가 아직 생성 안 됐을 수 있어요. {' '}
                    <a
                      href="https://console.firebase.google.com/project/dock-webapp/firestore"
                      target="_blank"
                      rel="noreferrer"
                      className="wall-error-help-link"
                    >
                      콘솔에서 확인 →
                    </a>
                    {' '}— "데이터베이스 만들기" 버튼이 보이면 미완료.
                  </li>
                  <li>
                    이미 생성됐다면 <strong>Rules</strong> 탭에서 읽기 허용 확인. 테스트 모드는 30일 후 닫힙니다.
                  </li>
                  <li>
                    네트워크 차단 (학교 와이파이가 *.googleapis.com 막는 경우 있음).
                  </li>
                </ol>
              </div>
            </>
          )}

          {isEmpty && !error && (
            <>
              <div className="wall-empty-glyph">···</div>
              <div className="wall-empty-text">아직 풍경에 발화가 없습니다</div>
              <button
                className="wall-cta"
                onClick={seedSamples}
                disabled={seeding}
              >
                {seeding ? '추가 중…' : '샘플 5개 추가하여 미리보기'}
              </button>
              <a href="/?stage=enter&mode=z" className="wall-link-secondary">
                또는 직접 메시지 쓰기 →
              </a>
            </>
          )}
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
  // Port the line-detection pattern from MessageTile: render word spans with
  // real whitespace between them so the browser can wrap on long messages,
  // then measure visual lines via getBoundingClientRect.
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const visible = text.trim();
    if (!visible) {
      el.innerHTML = '';
      return;
    }
    const words = visible.split(/\s+/);
    // CRITICAL: join with literal space so the browser has a wrap opportunity
    el.innerHTML = words.map((w) => `<span class="word">${escapeHtml(w)}</span>`).join(' ');
    const spans = el.querySelectorAll<HTMLSpanElement>('.word');

    // Detect visual lines based on each span's top coordinate
    let curTop: number | null = null;
    let curLine = -1;
    spans.forEach((s) => {
      const top = Math.round(s.getBoundingClientRect().top);
      if (curTop === null || Math.abs(top - curTop) > 5) {
        curLine++;
        curTop = top;
      }
      s.dataset.line = String(curLine);
    });
    const lineCount = curLine + 1;
    if (lineCount === 0) return;

    let idx = 0;
    function tick() {
      spans.forEach((s) => {
        s.classList.toggle('active', parseInt(s.dataset.line ?? '-1', 10) === idx);
      });
      idx = (idx + 1) % lineCount;
    }
    tick();
    const interval = window.setInterval(tick, 2400);
    return () => clearInterval(interval);
  }, [text]);

  return <div ref={containerRef} className="wall-text-inner" />;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}
