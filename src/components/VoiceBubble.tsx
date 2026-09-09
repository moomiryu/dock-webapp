import MetaballFilter, { STROKE_EM, useGoo } from './MetaballFilter';
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
  /** 가장자리가 일렁이는 폭 — 글자 크기에 대한 비율. 0이면 고요하다. */
  wave?: number;
}

/** The message owns its colour; the surrounding screen always stays black. */
export default function VoiceBubble({
  text,
  bg,
  color,
  fontFamily,
  weight,
  width = 1,
  slant = 0,
  fontSize,
  wave = 0
}: Props) {
  const allowance = Math.max(1, width) + Math.abs(Math.tan((slant * Math.PI) / 180));
  const goo = useGoo(wave);

  const textStyle = {
    fontWeight: weight,
    fontVariationSettings: `"wght" ${weight}`,
    transform: `scaleX(${width}) skewX(${slant}deg)`
  } as const;

  return (
    <div
      ref={goo.hostRef}
      className="voice-bubble"
      style={{
        ['--blob' as string]: bg,
        color,
        fontFamily,
        fontSize: fontSize ?? `calc(${fitFontSize(text, { min: 3, max: 240 })} * 0.65 / ${allowance})`
      }}
    >
      <MetaballFilter id={goo.filterId} blur={goo.blur} wave={goo.wave} freq={goo.freq} />

      {/* 아래층 — 글자를 살찌워 서로 닿게 한 뒤 필터가 하나로 뭉친다.
          이게 곧 말풍선의 몸이다. 캡슐을 그리는 게 아니라 글이 놓인
          자리가 그대로 형태가 된다. */}
      <div className="voice-blob" style={{ filter: `url(#${goo.filterId})` }} aria-hidden>
        <div
          className="voice-bubble-text"
          style={{ ...textStyle, WebkitTextStrokeWidth: `${STROKE_EM}em` }}
        >
          {text}
        </div>
      </div>

      {/* 위층 — 읽는 글자. 아래층과 같은 상자에서 같은 규칙으로 줄바꿈되므로
          두 층이 어긋나지 않는다. */}
      <div className="voice-bubble-text" style={textStyle}>
        {text}
      </div>
    </div>
  );
}
