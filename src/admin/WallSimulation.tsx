// Wall projection — MEGAFONT's output side.
//
// 벽은 숨 쉬는 상자들의 풍경이다. 사흘치 글이 저마다 작은 파동 상자로 세
// 줄을 흘러다닌다(잔상). 스위치가 올라가면(control/display.showTrigger) 지목된
// 글이 검정 위에 큰 상자로 서서 세게 숨 쉬고, 30초에 걸쳐 잦아들다가, 제
// 크기로 내려앉아 다른 잔상들 사이에 섞인다. 끝은 사건이 아니라 가라앉음이다.
//
// 상자의 생김새는 04 작성 화면에서 자판을 내리면 남는 그 한 덩이와 같다
// (components/WaveBox).

import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import WaveBox from '../components/WaveBox';
import { fontMap } from '../lib/palettes';
import { palettes as legacyPalettes } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import { EMPHASIS_MS, STAY_MS } from '../lib/wall';
import VoiceBubble from '../components/VoiceBubble';
import { sizeScale } from '../lib/messageStyle';
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

// ─── 파동 상자의 치수 ─────────────────────────────────────────────────
// 발화하는 동안 서는 큰 상자와, 그 뒤 풍경에 남는 잔상. 둘의 글자 크기가
// 한 변에 정비례해야 내려앉을 때 배율 하나로 정확히 포개진다.
/** 발화 중인 상자의 한 변. 16:10에서 72vh = 45vw */
const BIG_SIDE_VH = 72;
/** 폰으로 /wall을 열었을 때처럼 세로가 긴 화면의 상한 */
const BIG_SIDE_MAX_VW = 88;
/** 잔상의 한 변 */
const ECHO_SIDE_VH = 22;
/** 잔상이 숨 쉬는 세기. 발화의 30초는 1에서 여기까지 내려온다 */
const ECHO_STRENGTH = 0.3;
/** 큰 목소리가 잔상으로 내려앉는 시간 */
const LAND_MS = 1200;
/** 세기를 새로 내려주는 간격. 그 사이는 CSS transition이 잇는다 */
const CALM_TICK_MS = 250;
/** 상자 안에서 글이 쓰는 폭 — 한 변에 대한 비율 */
const INNER = 0.76;
/** 이 글자 수를 넘는 줄은 접는다. 04와 같이 크기는 그대로 두고 줄을 늘린다 */
const CHARS_PER_LINE = 12;

/** CSS가 같은 치수를 보게 내려준다. 벽의 루트에 한 번 */
const WALL_VARS = {
  '--big-side': `min(${BIG_SIDE_VH}vh, ${BIG_SIDE_MAX_VW}vw)`,
  '--echo-side': `${ECHO_SIDE_VH}vh`,
  '--land-ms': `${LAND_MS}ms`
} as CSSProperties;

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * 상자 한 변에 대한 글자 크기의 비율. 결과가 한 변에 정비례해야 한다 —
 * 큰 상자와 잔상이 같은 함수를 쓰면 내려앉을 때 배율 하나로 글까지 포개진다.
 *
 * 짧은 글은 한 줄에 맞추고(CHARS_PER_LINE까지), 긴 글은 접어서 넓이에 맞춘다.
 * 넓이 쪽: N자를 줄간 1.5로 채우면 N × 1.5 × F² ≤ inner², F = inner / √(1.5N).
 * 04와 같은 태도다 — 열두 자를 넘으면 크기는 그대로 두고 줄이 늘어난다.
 */
function boxFontRatio(text: string, scaleX: number, size: number | undefined): number {
  const wide = Math.max(1, scaleX);
  const chars = Math.max(1, Array.from(text.replace(/\n/g, '')).length);
  const longest = Math.max(1, ...text.split('\n').map((l) => Array.from(l).length));
  const byLine = INNER / Math.min(longest, CHARS_PER_LINE) / wide;
  const byArea = INNER / Math.sqrt(1.5 * chars * wide);
  return Math.min(byArea, byLine * sizeScale(size ?? 44));
}

/** 큰 상자가 내려앉을 자리. 화면 가운데에서의 거리(px)와 배율 */
type Land = { dx: number; dy: number; scale: number };
/** 도착점을 못 재면 제자리에서 잔상 크기로 가라앉는다 */
const SINK: Land = { dx: 0, dy: 0, scale: ECHO_SIDE_VH / BIG_SIDE_VH };

/**
 * 그 글의 잔상이 지금 어디 있는지 재서, 큰 상자가 거기로 가는 길을 만든다.
 * 잔상은 흘러가는 중이라 LAND_MS 동안 갈 거리만큼 앞을 겨눈다 — 안 그러면
 * 도착한 순간 쌍둥이가 한 상자 폭쯤 비켜 있다.
 * 배율은 rect가 아니라 치수로 낸다. rect는 숨 쉬는 중이라 2.2% 흔들린다.
 */
function aimAt(id: string): Land | null {
  const block = document.querySelector<HTMLElement>(`.wall-block[data-id="${CSS.escape(id)}"]`);
  const box = block?.querySelector<HTMLElement>('.wave-box');
  if (!block || !box) return null;
  const r = box.getBoundingClientRect();
  const dir = block.classList.contains('track-left') ? -1 : 1;
  const durS = parseFloat(getComputedStyle(block).animationDuration) || 0;
  const lead = durS > 0 ? ((window.innerWidth + block.offsetWidth) / (durS * 1000)) * LAND_MS * dir : 0;
  const bigSide = Math.min(window.innerHeight * BIG_SIDE_VH, window.innerWidth * BIG_SIDE_MAX_VW) / 100;
  const echoSide = (window.innerHeight * ECHO_SIDE_VH) / 100;
  return {
    dx: r.left + r.width / 2 + lead - window.innerWidth / 2,
    dy: r.top + r.height / 2 - window.innerHeight / 2,
    scale: echoSide / bigSide
  };
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
  const [emphLand, setEmphLand] = useState<Land | null>(null);
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
    const list = messages
      .filter((m) => now - m.createdAt < STAY_MS)
      .sort((a, b) => b.createdAt - a.createdAt);
    // 발화 중인 글이 목록에 아직 없으면(폴링 전) 끼워 넣는다 — 잔상 자리가
    // 있어야 내려앉을 곳이 있다. 폴링이 따라오면 같은 id라 그대로 합쳐진다.
    if (emphMsg && !list.some((m) => m.id === emphMsg.id)) list.unshift(emphMsg);
    return list.slice(0, RECENT_N);
  }, [messages, now, emphMsg]);

  const latestRef = useRef<StoredMessage | null>(null);
  const listRef = useRef<StoredMessage[]>([]);
  useEffect(() => {
    latestRef.current = visible[0] ?? null;
    listRef.current = visible;
  }, [visible]);

  // Switch trigger → 지목된 글을 크게. 상승 엣지(false→true)에서만.
  const prevTriggerRef = useRef(false);
  const dockedRef = useRef(false);
  const emphIdRef = useRef<string | null>(null);
  const closeTimerRef = useRef(0);
  const hideTimerRef = useRef(0);
  useEffect(() => {
    // 큰 목소리가 끝나는 방식은 하나다 — 잔상 자리로 내려앉는다.
    // 타이머가 끝내든 사람이 폰을 빼든 같은 길로 간다.
    const land = () => {
      clearTimeout(closeTimerRef.current);
      clearTimeout(hideTimerRef.current);
      const id = emphIdRef.current;
      setEmphLand((id && aimAt(id)) || SINK);
      hideTimerRef.current = window.setTimeout(() => {
        setEmphMsg(null);
        setEmphLand(null);
        emphIdRef.current = null;
      }, LAND_MS);
    };

    const show = (msg: StoredMessage) => {
      clearTimeout(closeTimerRef.current);
      clearTimeout(hideTimerRef.current);
      emphIdRef.current = msg.id;
      setEmphLand(null);
      setEmphMsg(msg);
      setEmphKey((k) => k + 1);
      // EMPHASIS_MS는 상한이다. 대개는 아래 '폰이 빠졌다'가 먼저 내려앉힌다.
      closeTimerRef.current = window.setTimeout(land, EMPHASIS_MS);
    };

    const unsub = subscribeShowTrigger(
      (showTrigger, showId, docked) => {
        // 폰이 빠지는 순간 큰 목소리가 끝나고 메아리로 남는다.
        // 강조를 끝내는 건 타이머가 아니라 사람이다 — 타이머는 아무도 빼지
        // 않았을 때를 위한 상한일 뿐이다.
        const wasDocked = dockedRef.current;
        dockedRef.current = docked;
        if (wasDocked && !docked) land();

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
      style={WALL_VARS}
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

      {/* 풍경 — 잔상들이 세 줄을 흘러간다. 발화 중인 글의 잔상은 자리만
          지키고 숨어 있다가(is-ghost) 큰 상자가 내려앉는 순간 드러난다 */}
      {visible.slice(0, LANDSCAPE_N).map((msg, i, arr) => (
        <WallBlock key={msg.id} msg={msg} index={i} total={arr.length} ghost={emphMsg?.id === msg.id} />
      ))}

      {/* 발화 — 검정 위에 큰 상자 하나 */}
      {emphMsg && <WallShowMessage key={emphKey} msg={emphMsg} land={emphLand} />}

      {showOverlay && (
        <div className="wall-overlay">
          <div className="wall-overlay-line">MEGAFONT · WALL</div>
          <div className="wall-overlay-line">
            풍경 {visible.length}개 {emphMsg ? (emphLand ? '· 내려앉는 중' : '· 발화 중') : '· 트리거 대기'}
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

// ─── 잔상 (풍경의 한 칸, 흘러가는 작은 상자) ─────────────────────────

const WallBlock = memo(function WallBlock({ msg, index, total, ghost }: { msg: StoredMessage; index: number; total: number; ghost: boolean }) {
  const track = TRACKS[index % TRACKS.length];
  const posInTrack = Math.floor(index / TRACKS.length);
  const countInTrack = Math.max(1, Math.ceil(total / TRACKS.length));

  // 한 트랙 안에서는 균등 간격이라 같은 속도끼리 겹치지 않는다.
  // 거기에 트랙마다 시작점을 어긋내야 메시지가 적을 때도 화면이 고르게 찬다 —
  // 이게 없으면 글이 세 개일 때 셋 다 위상 0에서 같이 출발해, 설치 첫날
  // 벽이 대부분 비어 있다가 한 덩어리가 지나가는 꼴이 된다.
  const trackOffset = (index % TRACKS.length) / TRACKS.length;
  // 0.5를 더해 새 글은 트랙 **가운데**서 출발한다. 큰 상자가 내려앉을 자리가
  // 화면 안에 있어야 해서다 — 재 보니 넷 중 하나는 쌍둥이가 화면 밖(x=1308)에
  // 있었고, 그러면 큰 상자가 벽 밖으로 날아간다. 가운데서 30초를 흘러도
  // 한 바퀴의 20%라 여전히 화면 안이다. 간격은 다 같이 밀리므로 그대로다.
  const phase = (0.5 + posInTrack / countInTrack + trackOffset) % 1;
  const animDelay = -phase * track.duration;
  const { bg, text, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);
  const ratio = useMemo(() => boxFontRatio(msg.text, scaleX, msg.tone?.size), [msg.text, scaleX, msg.tone?.size]);
  // 숨도 어긋낸다. 137은 600과 서로소라 열두 개가 같은 위상에 모이지 않는다.
  const breath = -((index * 137) % 600);

  return (
    <div
      className={`wall-block track-${track.dir}${ghost ? ' is-ghost' : ''}`}
      data-id={msg.id}
      style={{ top: `${track.y}%`, animationDuration: `${track.duration}s`, animationDelay: `${animDelay}s`, '--wave-phase': `${breath}ms` } as CSSProperties}
    >
      <WaveBox color={bg} strength={ECHO_STRENGTH}>
        <VoiceBubble text={msg.text} bg={bg} color={text} fontFamily={fontFamily} font={msg.tone?.font} weight={wght}
          width={scaleX} slant={skew} align={msg.tone?.align} size={msg.tone?.size}
          fontSize={`calc(var(--echo-side) * ${ratio.toFixed(4)})`} />
      </WaveBox>
    </div>
  );
});

// ─── 발화 (검정 위의 큰 상자. 잦아들다 내려앉는다) ────────────────────

const WallShowMessage = memo(function WallShowMessage({ msg, land }: { msg: StoredMessage; land: Land | null }) {
  const { bg, text, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);
  const ratio = useMemo(() => boxFontRatio(msg.text, scaleX, msg.tone?.size), [msg.text, scaleX, msg.tone?.size]);

  // 30초에 걸쳐 잦아든다. 상한까지 가면 잔상의 세기에 닿는다 — 그래서
  // 내려앉을 때 세기는 이미 거기 있고, 일찍 빼면 남은 만큼을 마저 내린다.
  const [strength, setStrength] = useState(1);
  useEffect(() => {
    const born = performance.now();
    const id = window.setInterval(() => {
      const t = Math.min(1, (performance.now() - born) / EMPHASIS_MS);
      setStrength(1 - (1 - ECHO_STRENGTH) * t);
    }, CALM_TICK_MS);
    return () => clearInterval(id);
  }, []);

  const landing = land !== null;
  const boxStyle = land
    ? { transform: `translate(${land.dx.toFixed(1)}px, ${land.dy.toFixed(1)}px) scale(${land.scale.toFixed(4)})` }
    : undefined;
  // 내려앉는 동안은 세기도 그 시간에 맞춰 잇는다
  const calm = landing ? ({ '--wave-calm': `${LAND_MS}ms` } as CSSProperties) : undefined;

  return (
    <div className={`wall-show${landing ? ' is-landing' : ''}`}>
      <div className="wall-show-box" style={boxStyle}>
        <WaveBox color={bg} strength={landing ? ECHO_STRENGTH : strength} style={calm}>
          <VoiceBubble text={msg.text} bg={bg} color={text} fontFamily={fontFamily} font={msg.tone?.font} weight={wght}
            width={scaleX} slant={skew} align={msg.tone?.align} size={msg.tone?.size}
            fontSize={`calc(var(--big-side) * ${ratio.toFixed(4)})`} />
        </WaveBox>
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
      bg: tone?.backgroundColor ?? pal.bg,
      text: tone?.textColor ?? pal.text,
      fontFamily,
      wght: tone?.wght ?? 400,
      scaleX: tone?.tone ?? 1.0,
      skew: tone?.slnt ?? 0
    };
  }, [msg]);
}
