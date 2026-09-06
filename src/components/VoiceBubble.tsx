import { fitFontSize } from '../lib/fit';

interface Props {
  text: string;
  bg: string;
  color: string;
  fontFamily: string;
  weight: number;
  width?: number;
  slant?: number;
  fontSize?: string;
}

/** The message owns its colour; the surrounding screen always stays black. */
export default function VoiceBubble({ text, bg, color, fontFamily, weight, width = 1, slant = 0, fontSize }: Props) {
  const allowance = Math.max(1, width) + Math.abs(Math.tan(slant * Math.PI / 180));
  return (
    <div className="voice-bubble" style={{ background: bg, color, fontFamily,
      fontSize: fontSize ?? `calc(${fitFontSize(text, { min: 3, max: 240 })} * 0.65 / ${allowance})` }}>
      <div className="voice-bubble-text" style={{ fontWeight: weight,
        fontVariationSettings: `"wght" ${weight}`, transform: `scaleX(${width}) skewX(${slant}deg)` }}>{text}</div>
    </div>
  );
}
