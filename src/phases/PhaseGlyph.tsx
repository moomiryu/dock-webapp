import { useState, type CSSProperties } from 'react';
import BackButton from '../components/BackButton';
import { fontMap, opticalFix } from '../lib/palettes';
import { DEFAULT_TONE, STYLE_OPTIONS, type PartialTone } from '../lib/tone';
import type { ToneState } from '../types';
interface Props {
  initialTone?: PartialTone | null;
  onBack: () => void;
  onNext: (tone: PartialTone) => void;
}
export default function PhaseGlyph({ initialTone, onBack, onNext }: Props) {
  const [font, setFont] = useState<ToneState['font'] | null>(initialTone?.font ?? null);
  return (
    <div className="z-frame z1 tone-choice">
      <div className="z-header">
        <BackButton label="처음으로" onClick={onBack} /><span className="z-step-of">1 / 5 · 성격</span>
      </div>
      <div className="z-ask">
        {/* 줄바꿈 자리는 스케치가 정해 준 것이다 — 한 줄에 다 들어가지만
            '어떤 발화를'에서 한 번 끊어야 다음 줄의 물음이 선다. */}
        <h1>어떤 발화를<br />시작해볼까요?</h1>
        <p>마음에 드는 성격을 골라주세요.</p>
      </div>
      <div className="style-cards" role="group" aria-label="성격 고르기">
        {STYLE_OPTIONS.map(s => (
          <button key={s.val} type="button" className={'style-card ' + (font === s.val ? 'on' : '')}
            aria-pressed={font === s.val} onClick={() => setFont(s.val)}>
            {/* 서체마다 잉크가 차지하는 높이도 굵기도 달라 같은 크기·같은
                굵기로 안 보인다. 잰 값은 palettes.ts에 있다. */}
            <span className="style-card-name" style={{
              fontFamily: fontMap[s.val],
              '--optical': opticalFix[s.val]?.scale ?? 1,
              '--optical-stroke': (opticalFix[s.val]?.stroke ?? 0) + 'em'
            } as CSSProperties}>
              {s.label}
            </span>
          </button>
        ))}
      </div>
      <button className="primary-action" disabled={!font}
        onClick={() => font && onNext({ ...(initialTone ?? DEFAULT_TONE), font })}>이 성격으로 할게요</button>
    </div>
  );
}
