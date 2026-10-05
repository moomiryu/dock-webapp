import { memo, useMemo } from 'react';
import CloudBubble from './CloudBubble';
import VoiceBubble from './VoiceBubble';
import RainPreview from './RainPreview';
import { cloudForTone, cloudShape, linesFor, personaFor, stoneWhole, type Cloud } from '../lib/cloud';
import { bubbleAt, fillFromLegacySize, type Boxed } from '../lib/fit';
import { fontMap, rainShapeOf, palettes as legacyPalettes } from '../lib/palettes';
import { moods } from '../lib/palettes-v2';
import type { StoredMessage } from '../lib/firebase';

/* 벽의 큰 발화(WallShowMessage)와 글 하나의 구름 · 색 · 서체 — /wall(WallSimulation)과 폰 5/5 미리보기(PhasePreview)가
   같이 쓴다. 2026-10-06 벽 파일에서 뗐다: 폰이 이것을 빌리느라 벽 전체(물리 계산 · 땅 · 작은 사람, 약 240KB)를 함께 받았다. */

// ─── 파동 상자의 치수 (벽 파일의 같은 절에서 옮김) ───────────────────
/**
 * 발화 중인 상자의 한 변.
 *
 * 72였다. 그 값은 16:10 벽에서 고른 것인데 실물이 16:9로 확인되면서
 * (wall.ts) 같은 vh가 폭의 45%에서 40.5%로 줄었다 — 벽 전체가 납작해진
 * 만큼 글이 작아진 셈이다. 재서 다시 골랐다(2.5 × 1.41m 기준):
 *
 *   72vh  60자가 벽 높이의 67% · 글자 6.5cm · 편히 읽히는 거리 4.7m
 *   85vh                  79% · 7.6cm · 5.5m
 *   95vh                  88% · 8.5cm · 6.1m   ← 여기
 *  100vh                  93% · 9.0cm · 6.5m
 *
 * 100vh는 60자에서 위아래 4.9cm만 남아 구름이 벽 가장자리에 붙는다.
 * 95vh면 8.4cm가 남는다. 짧은 글은 어차피 제 크기만 쓰므로(6자는 높이의
 * 39%) 이 값은 **가장 긴 글이 넘지 않는 선**으로 잡는다.
 */
export const BIG_SIDE_VH = 95;
/** 폰으로 /wall을 열었을 때처럼 세로가 긴 화면의 상한 */
export const BIG_SIDE_MAX_VW = 88;

/** 큰 상자가 내려앉을 자리. 화면 가운데에서의 거리(px)와 배율 */
export type Land = { dx: number; dy: number; scale: number };

/**
 * 이 글이 쓰는 틀 — 최대 영역 한 변에 대한 **비율**로.
 *
 * 잔상과 강조가 같은 값을 쓴다. 둘의 차이는 곱하는 한 변뿐이라
 * (--echo-side · --big-side) 내려앉을 때 배율 하나로 포개진다.
 */
export function cloudOf(msg: StoredMessage): { lines: string[]; cloud: Cloud; box: Boxed } {
  const lines = linesFor(msg.text, msg.tone);   // 한 줄 12자 — 모든 성격(cloud.ts)
  // 씨앗은 글 자체 — 04 미리보기와 같은 구름이 뜬다(cloud.ts)
  const cloud = cloudForTone(lines, msg.tone);
  return { lines, cloud, box: bubbleAt(lines, cloudShape(cloud), fillFromLegacySize(msg.tone?.size)) };
}

/** 유머있는 = 비(2026-10-04) — 몸(새)이 아니라 비 층(WallRain)이 그린다. 옛 서체 키(song)도 */
export const isRainMsg = (m: StoredMessage) => personaFor(m.tone?.font).key === 'deulseok';

// ─── 발화 (검정 위의 큰 상자. 잦아들다 내려앉는다) ────────────────────
// 폰의 5/5 미리보기(PhasePreview)가 이것을 그대로 빌려 쓴다 — 벽과 따로
// 그리면 서체·구름·줄바꿈 중 하나가 반드시 어긋난다.

/* 말풍선 때는 물결이 30초에 걸쳐 잦아들어 잔상의 세기에 닿았다(calmAt).
   구름은 강조와 잔상이 같은 숨(중)을 쉰다 — 크기만 내려앉는다. */
export const WallShowMessage = memo(function WallShowMessage({ msg, land, centerText }: { msg: StoredMessage; land: Land | null; startedAt: number; centerText?: boolean }) {
  const { bg, text, fontFamily, wght, scaleX, skew } = useDerivedStyle(msg);
  // 돌은 배까지 한 덩이로(cloud.ts stoneWhole, 2026-10-04) — 바닥 없이 서는 큰 상자(폰 5/5 미리보기가 빌려 쓴다)
  const { lines, cloud, box } = useMemo(() => {
    const o = cloudOf(msg), whole = stoneWhole(o.cloud);
    return whole === o.cloud ? o : { ...o, cloud: whole, box: bubbleAt(o.lines, cloudShape(whole), fillFromLegacySize(msg.tone?.size)) };
  }, [msg]);

  const landing = land !== null;
  // 유머있는(비) — 검정 위에 큰 줄기 하나가 내린다(폰 4/5 · 5/5와 같은 부품). 내려앉을 때는 검정과 함께 걷힌다
  if (isRainMsg(msg)) return (
    <div className={`wall-show is-rain${landing ? ' is-landing' : ''}`}>
      <RainPreview text={msg.text} color={bg} shape={rainShapeOf(msg.tone?.align)} speed={msg.tone?.speed} weight={msg.tone?.weight} manner={msg.tone?.manner} />
    </div>
  );
  const boxStyle = land
    ? { transform: `translate(${land.dx.toFixed(1)}px, ${land.dy.toFixed(1)}px) scale(${land.scale.toFixed(4)})` }
    : undefined;

  return (
    <div className={`wall-show${landing ? ' is-landing' : ''}`}>
      <div className="wall-show-box" style={boxStyle}>
        <CloudBubble cloud={cloud} box={box} side="var(--big-side)" color={bg} centerText={centerText}>
          <VoiceBubble text={lines.join('\n')} bg={bg} color={text} fontFamily={fontFamily} font={msg.tone?.font} weight={wght}
            width={scaleX} slant={skew} align={msg.tone?.align} size={msg.tone?.size} manner={msg.tone?.manner}
          speed={msg.tone?.speed} weightPos={msg.tone?.weight}
            fontSize={`calc(var(--big-side) * ${box.unit.toFixed(4)})`} />
        </CloudBubble>
      </div>
    </div>
  );
});

// ─── Shared style derivation ─────────────────────────────────────────

/** 한 글의 칠 · 글자색 — 벽이 그리는 색 그대로(물리 계산의 읽힘도 이것으로 잰다) */
export function colorsOf(msg: StoredMessage): { bg: string; text: string } {
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
  return { bg: tone?.backgroundColor ?? pal.bg, text: tone?.textColor ?? pal.text };
}

export function useDerivedStyle(msg: StoredMessage) {
  return useMemo(() => {
    const tone = msg.tone, { bg, text } = colorsOf(msg);
    const fontFamily = tone ? fontMap[tone.font] : fontMap.botong;
    return {
      bg,
      text,
      fontFamily,
      wght: tone?.wght ?? 400,
      scaleX: tone?.tone ?? 1.0,
      skew: tone?.slnt ?? 0
    };
  }, [msg]);
}
