import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { fitFontSize } from '../lib/fit';
import { opticalStroke } from '../lib/palettes';
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
    align?: 'left' | 'center' | 'right';
    size?: number;
    /** 글자 크기를 부모 상자에 맞춰 채운다. 03·04의 물러선 상자만 쓴다 */
    fill?: boolean;
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
 */
function fitToBox(el: HTMLElement): number {
    const box = el.parentElement;
    if (!box || !box.clientWidth || !box.clientHeight) return 24;
    const limitH = box.clientHeight * 0.88;
    const limitW = box.clientWidth * 0.88;
    const prev = el.style.fontSize;
    let lo = 10, hi = 240, best = 10;
    for (let i = 0; i < 9; i++) {                      // 230px를 9번 접으면 0.45px까지 좁혀진다
        const mid = (lo + hi) / 2;
        el.style.fontSize = mid + 'px';
        const r = el.getBoundingClientRect();
        if (r.height <= limitH && r.width <= limitW + 1 && el.scrollWidth <= el.clientWidth + 1) { best = mid; lo = mid; }
        else hi = mid;
    }
    el.style.fontSize = prev;
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
export default function VoiceBubble({ text, bg, color, fontFamily, font, weight, width = 1, slant = 0, fontSize, align = 'center', size = 44, fill, children }: Props) {
    const scale = Math.min(60, Math.max(28, size)) / 44;
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
    /* 무게가 '발랄한'만 못 움직인다 — 그 칸에서만 획이 대신 답한다.
       나머지 서체는 '0'이 와서 -webkit-text-stroke가 아무 일도 안 한다. */
    return <div ref={body} className="voice-bubble line-bubble" style={{ '--line-bg': bg, color, fontFamily, fontWeight: weight, fontVariationSettings: '"wght" ' + weight, '--optical-stroke': opticalStroke(font ?? '', weight), textAlign: align, fontSize: fill ? `${filled}px` : (fontSize ?? `max(14px, calc(${fitFontSize(text, { min: 3, max: 240 })} * 0.52 * ${scale} / ${Math.max(1, width)}))`) } as CSSProperties}>
  {/* 한글은 띄어쓰기에서만 줄이 바뀐다(word-break: normal). 그래서 60자를
      붙여 쓰면 접힐 데가 없어 한 줄로 흘러나가고, 상자에 맞추려는 계산이
      바닥까지 내려가 10px짜리 얼룩이 됐다. anywhere는 **들어갈 데가 없을 때만**
      글자 사이를 끊는다 — 띄어쓰기가 있는 보통 글의 줄바꿈은 그대로다. */}
  <div className="voice-bubble-text line-bubble-text" style={{ textAlign: align, transform: `scaleX(${width})`, transformOrigin: align, overflowWrap: fill ? 'anywhere' : undefined }}>
   {text.split('\n').map((line, i) => <div className="message-line" key={i}><span className="message-line-fill"><span style={{ fontStyle: slant ? `oblique ${Math.abs(slant)}deg` : 'normal' }}>{line.split(/([A-Za-z0-9][A-Za-z0-9 .,!?'-]*)/g).map((part, j) => /[A-Za-z0-9]/.test(part) ? <span key={j} lang="en" style={{ fontStyle: slant ? 'italic' : 'normal' }}>{part}</span> : part || '\u200b')}</span></span></div>)}
   {children}
  </div>
 </div>;
}
