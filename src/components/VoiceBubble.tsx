import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { fitFontSize } from '../lib/fit';
import { formFor, opticalFix } from '../lib/palettes';
import type { Glyph } from '../lib/cloud';
import type { Align } from '../types';
interface Props {
    children?: ReactNode;
    text: string;
    bg: string;
    color: string;
    fontFamily: string;
    /** 자형 키(ttoryeot·deulseok…). 획 보정을 찾는 데만 쓴다 — 없으면 보정 없음 */
    font?: string;
    weight: number;
    width?: number;
    slant?: number;
    fontSize?: string;
    wave?: number;
    /** 줄 맞춤. 나무 · 구름의 제 정렬(균등 배분 · 아치 …)은 형상이 배치를 정하고 줄은 가운데에 선다 */
    align?: Align;
    size?: number;
    /** 말투 — 무게 축이 없는 얼굴이 무게 대신 쓰는 축(palettes.ts · MANNER) */
    manner?: number;
    /** 글자 크기를 부모 상자에 맞춰 채운다. 03·04의 물러선 상자만 쓴다 */
    fill?: boolean;
    /**
     * 3/5 막대의 자리(0~1). 있으면 모양을 서체별 표(palettes.ts · formFor)로
     * 계산한다 — 3/5 견본과 같은 모양이 된다. 없으면(옛 글) width·slant·weight
     * 그대로 그린다.
     */
    speed?: number;
    weightPos?: number;
    /** 글자를 한 자씩 따로 둔다(.ch, 띄어쓰기는 빼고). 벽의 구름이 한 글자씩 펄럭일 때만 */
    perChar?: boolean;
    /** 줄마다 더하는 자간(em) — 나무의 균등 배분 · 사다리꼴(cloud.ts treeLayout). 끝 글자 뒤 몫은 도로 뺀다 */
    lineTrack?: readonly number[];
    /** 한 자씩 놓은 자리(em)와 글 상자 — 구름의 휜 배치(cloud.ts beadArcFor). 있으면 줄 대신 이것을 그린다 */
    glyphs?: readonly Glyph[];
    glyphBox?: { w: number; h: number };
}
/**
 * 상자를 채우는 글자 크기 — 재서 정한다.
 *
 * fit.ts의 공식은 **줄바꿈 없는 한 줄**을 폭에 맞추는 계산이다. 벽은 가로로
 * 길어서 그게 맞지만, 03·04의 상자는 정사각이라 같은 식을 쓰면 16자가 17px로
 * 내려간다 — 한 줄로 펴서 폭에 맞추려 드니까.
 *
 * 정사각에서는 줄바꿈이 답의 일부다. 글이 몇 줄로 접히는지는 서체·무게·장평이
 * 다 바꾸므로 식으로 못 낸다. 그래서 **브라우저에 직접 물어본다** — 크기를
 * 올려 보고 상자를 넘는 순간을 이분법으로 찾는다.
 *
 * 폭은 .line-bubble이 88%로 붙박이라 글자가 커지면 폭 대신 줄 수가 는다.
 * 그래서 높이 하나만 보면 된다. 띄어쓰기 없는 긴 글은 접힐 데가 없어 옆으로
 * 흘러나가므로 scrollWidth도 같이 본다.
 *
 * ── 재는 동안 전환을 끄는 이유 ────────────────────────────────────
 * 이 이분법은 **쓴 값을 곧바로 다시 읽을 수 있다**는 데 전부를 건다. 그
 * 전제가 한 번 깨진 적이 있다: 모션을 끈 사용자에게 걸리던 전역
 * `transition-duration: 0.01ms`가 글자 크기까지 전환으로 만들어, 크기를 쓴
 * 직후 잰 값이 옛 값이었다. 답이 통째로 망가져 05의 글이 48px 자리에서
 * 10px(도착 직후)이나 239px(창이 흔들린 뒤)로 나왔다.
 *
 * 그 리셋은 global.css에서 0s로 고쳤다. 여기서 한 번 더 막는 것은 재는
 * 쪽의 전제를 남의 CSS에 맡기지 않기 위해서다 — 어디서든 전환이 다시
 * 붙어도 이 계산만은 성립한다.
 */
function fitToBox(el: HTMLElement): number {
    const box = el.parentElement;
    if (!box || !box.clientWidth || !box.clientHeight) return 24;
    const limitH = box.clientHeight * 0.88;
    const limitW = box.clientWidth * 0.88;
    const prev = el.style.fontSize;
    const prevTransition = el.style.transition;
    el.style.transition = 'none';
    let lo = 10, hi = 240, best = 10;
    for (let i = 0; i < 9; i++) {                      // 230px를 9번 접으면 0.45px까지 좁혀진다
        const mid = (lo + hi) / 2;
        el.style.fontSize = mid + 'px';
        const r = el.getBoundingClientRect();
        if (r.height <= limitH && r.width <= limitW + 1 && el.scrollWidth <= el.clientWidth + 1) { best = mid; lo = mid; }
        else hi = mid;
    }
    el.style.fontSize = prev;
    el.style.transition = prevTransition;
    return Math.floor(best);
}
/**
 * 아래 계산의 바닥이 14px인 이유.
 *
 * fitFontSize의 min은 3px인데 그 값에 0.52와 크기 배율이 또 곱해진다 —
 * 60자를 쓰면 미리보기에서 1.6px까지 내려가 글이 얼룩이 됐다. 그 바닥은
 * 벽의 물리 크기를 흉내 내려던 값인데, 폰에서 작게 보이는 것과 벽에서
 * 작게 보이는 것은 같은 일이 아니다. 벽에서 60자는 한 글자가 3.5cm쯤이라
 * 멀리서도 읽힌다. 폰의 1.6px은 어디서도 안 읽힌다.
 *
 * 그래서 미리보기의 바닥은 **폰에서 읽히는 크기**로 잡는다. 곱셈 뒤에
 * max를 씌워야 바닥이 진짜 바닥이 된다 — 안쪽 clamp에 넣으면 뒤따르는
 * 곱셈이 다시 깎는다.
 */
export default function VoiceBubble({ text, bg, color, fontFamily, font, weight, width = 1, slant = 0, fontSize, align: alignIn = 'center', size = 44, manner = 0, fill, speed, weightPos, perChar, lineTrack, glyphs, glyphBox, children }: Props) {
    /* 글 맞춤은 셋뿐이다 — 나머지 정렬은 형상(cloud.ts)이 줄 · 자리로 이미 풀어 넘긴다 */
    const align = alignIn === 'left' || alignIn === 'right' ? alignIn : 'center';
    /* 모양은 서체별 표 하나가 정한다(2026-09-25). 3/5 견본 · 4/5 · 미리보기 ·
       벽이 모두 이 한 줄을 지난다. 세로 비율과 둥켈의 폭 축, 차분한의 자간이
       여기서 붙는다. */
    const f = formFor({ font: font ?? '', tone: width, slnt: slant, wght: weight, manner, speed, weight: weightPos, align: alignIn });
    const scale = Math.min(60, Math.max(28, size)) / 44;
    /* 서체마다 같은 크기가 다르게 보인다(palettes.ts · opticalFix). 02에서만
       고쳐 두고 여기서 안 고치면, 성격을 고른 화면과 그 뒤 화면들의 글자
       크기가 서로 다르다 — 고르고 나면 글이 커지거나 작아진 것처럼 보인다.
       셋 다 이 한 줄을 지나므로 여기서 한 번만 곱한다. */
    const optic = opticalFix[font ?? '']?.scale ?? 1;
    const body = useRef<HTMLDivElement>(null);
    const [filled, setFilled] = useState(24);
    /* 상자가 420ms에 걸쳐 줄어드는 동안 계속 다시 잰다. 프레임마다 아홉 번씩
       재는 건 과하니 rAF로 한 프레임에 한 번으로 묶는다. useLayoutEffect라
       칠하기 전에 끝난다 — 처음 뜰 때 24px이 스쳐 보이지 않는다. */
    useLayoutEffect(() => {
        const el = body.current;
        if (!fill || !el || !el.parentElement) return;
        let waiting = 0;
        const refit = () => { waiting = 0; setFilled(fitToBox(el)); };
        refit();
        const ro = new ResizeObserver(() => { if (!waiting) waiting = requestAnimationFrame(refit); });
        ro.observe(el.parentElement);
        return () => { ro.disconnect(); if (waiting) cancelAnimationFrame(waiting); };
    }, [fill, text, fontFamily, weight, width, slant, align]);
    /* 기울기는 줄마다 skewX로 건다(2026-09-29). font-style: oblique였는데, 이 서체들엔 기운
       글꼴이 없어 브라우저가 흉내 내고, 크롬에서 재 보니 9°는 안 기울고 18°는 14°로 고정이었다 —
       속도 잣대의 끝 두 칸이 표와 다르게 섰다. 줄 하나를 제자리에서 기울이므로 여러 줄이 계단처럼
       밀리지 않고, 기운 만큼 넓어진 폭(행간 × tan)은 cloud.ts · lineWidth가 이미 셈에 넣고 있다.
       영문 조각에만 따로 걸던 italic도 이 한 번에 들어간다 */
    const lean: CSSProperties = f.slant ? { display: 'inline-block', transform: `skewX(${-f.slant}deg)` } : {};
    /* 무게 축이 없는 서체는 못 움직인다 — 그 칸에서만 획이 대신 답한다.
       나머지 서체는 '0'이 와서 -webkit-text-stroke가 아무 일도 안 한다. */
    return <div ref={body} className={'voice-bubble line-bubble' + (fill ? ' is-fill' : '')} style={{ '--line-bg': bg, color, fontFamily, fontWeight: f.weight, fontVariationSettings: f.variation, '--optical-stroke': f.stroke, letterSpacing: f.letterSpacing, textAlign: align, fontSize: fill ? `${filled * optic}px` : `calc((${fontSize ?? `max(14px, calc(${fitFontSize(text, { min: 3, max: 240 })} * 0.52 * ${scale} / ${Math.max(1, f.scaleX)}))`}) * ${optic})` } as CSSProperties}>
  {glyphs && glyphBox ? (
   /* 휜 배치 — 한 자씩 제 자리 · 제 기울기로. 장평 · 세로 비율도 글자마다 건다(줄 전체를 누르면 호가 찌그러진다).
      안쪽 .ch는 벽의 펄럭임이 움직이는 자리다 — 자리 · 기울기는 바깥이 들고 있어 서로 안 덮는다 */
   <div className="voice-bubble-text line-bubble-text is-arc" style={{ width: `${glyphBox.w.toFixed(4)}em`, height: `${glyphBox.h.toFixed(4)}em` }}>
    {glyphs.map((g, i) => <span key={i} className="arc-glyph" style={{ left: `${g.x.toFixed(4)}em`, top: `${g.y.toFixed(4)}em`,
      transform: `translate(-50%, -50%) rotate(${g.a.toFixed(4)}rad) scale(${f.scaleX}, ${f.scaleY})${f.slant ? ` skewX(${-f.slant}deg)` : ''}` }}><span className="ch">{g.c}</span></span>)}
    {children}
   </div>
  ) : (
  <div className="voice-bubble-text line-bubble-text" style={{ textAlign: align, transform: `scale(${f.scaleX}, ${f.scaleY})`, transformOrigin: align }}>
   {text.split('\n').map((line, i) => <div className="message-line" key={i}><span className="message-line-fill"><span style={{ ...lean, ...trackStyle(lineTrack?.[i], f.letterSpacing) }}>{perChar ? (line ? Array.from(line).map((c, j) => (c.trim() ? <span key={j} className="ch">{c}</span> : c)) : '\u200b') : line.split(/([A-Za-z0-9][A-Za-z0-9 .,!?'-]*)/g).map((part, j) => /[A-Za-z0-9]/.test(part) ? <span key={j} lang="en">{part}</span> : part || '\u200b')}</span></span></div>)}
   {children}
  </div>
  )}
 </div>;
}

/** 줄 하나에 더하는 자간 — 원래 자간(em) 위에 더하고, 끝 글자 뒤로 붙는 몫은 오른쪽 여백으로 도로 뺀다 */
function trackStyle(t: number | undefined, base: string): CSSProperties {
    if (!t) return {};
    return { letterSpacing: `${(t + (parseFloat(base) || 0)).toFixed(4)}em`, marginRight: `${(-t).toFixed(4)}em` };
}
