import type { CSSProperties, ReactNode } from 'react';
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
export default function VoiceBubble({ text, bg, color, fontFamily, font, weight, width = 1, slant = 0, fontSize, align = 'center', size = 44, children }: Props) {
    const scale = Math.min(60, Math.max(28, size)) / 44;
    /* 무게가 '발랄한'만 못 움직인다 — 그 칸에서만 획이 대신 답한다.
       나머지 서체는 '0'이 와서 -webkit-text-stroke가 아무 일도 안 한다. */
    return <div className="voice-bubble line-bubble" style={{ '--line-bg': bg, color, fontFamily, fontWeight: weight, fontVariationSettings: '"wght" ' + weight, '--optical-stroke': opticalStroke(font ?? '', weight), textAlign: align, fontSize: fontSize ?? `max(14px, calc(${fitFontSize(text, { min: 3, max: 240 })} * 0.52 * ${scale} / ${Math.max(1, width)}))` } as CSSProperties}>
  <div className="voice-bubble-text line-bubble-text" style={{ textAlign: align, transform: `scaleX(${width})`, transformOrigin: align }}>
   {text.split('\n').map((line, i) => <div className="message-line" key={i}><span className="message-line-fill"><span style={{ fontStyle: slant ? `oblique ${Math.abs(slant)}deg` : 'normal' }}>{line.split(/([A-Za-z0-9][A-Za-z0-9 .,!?'-]*)/g).map((part, j) => /[A-Za-z0-9]/.test(part) ? <span key={j} lang="en" style={{ fontStyle: slant ? 'italic' : 'normal' }}>{part}</span> : part || '\u200b')}</span></span></div>)}
   {children}
  </div>
 </div>;
}
