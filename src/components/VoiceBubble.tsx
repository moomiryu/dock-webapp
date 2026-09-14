import type { CSSProperties, ReactNode } from 'react';
import { fitFontSize } from '../lib/fit';
interface Props {
    children?: ReactNode;
    text: string;
    bg: string;
    color: string;
    fontFamily: string;
    weight: number;
    width?: number;
    slant?: number;
    fontSize?: string;
    wave?: number;
    align?: 'left' | 'center' | 'right';
    size?: number;
}
export default function VoiceBubble({ text, bg, color, fontFamily, weight, width = 1, slant = 0, fontSize, align = 'center', size = 44, children }: Props) {
    const scale = Math.min(60, Math.max(28, size)) / 44;
    return <div className="voice-bubble line-bubble" style={{ '--line-bg': bg, color, fontFamily, fontWeight: weight, fontVariationSettings: '"wght" ' + weight, textAlign: align, fontSize: fontSize ?? `calc(${fitFontSize(text, { min: 3, max: 240 })} * 0.52 * ${scale} / ${Math.max(1, width)})` } as CSSProperties}>
  <div className="voice-bubble-text line-bubble-text" style={{ textAlign: align, transform: `scaleX(${width})`, transformOrigin: align }}>
   {text.split('\n').map((line, i) => <div className="message-line" key={i}><span className="message-line-fill"><span style={{ fontStyle: slant ? 'oblique 12deg' : 'normal' }}>{line.split(/([A-Za-z0-9][A-Za-z0-9 .,!?'-]*)/g).map((part, j) => /[A-Za-z0-9]/.test(part) ? <span key={j} lang="en" style={{ fontStyle: slant ? 'italic' : 'normal' }}>{part}</span> : part || '\u200b')}</span></span></div>)}
   {children}
  </div>
 </div>;
}
