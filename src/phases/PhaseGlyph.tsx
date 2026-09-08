import { useState } from 'react';
import BackButton from '../components/BackButton';
import StepRail from '../components/StepRail';
import { fontMap } from '../lib/palettes';
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
        <BackButton label="처음으로" onClick={onBack} />
        <span>1 / 5 · 말투</span>
      </div>
      <StepRail step={1} />
      <div className="z-ask">
        <h1>어떤 발화를 시작해볼까요?</h1>
        <p>마음에 드는 성격을 하나 골라주세요.</p>
      </div>
      <div className="style-cards" role="group" aria-label="말투 고르기">
        {STYLE_OPTIONS.map(s => (
          <button key={s.val} type="button" className={'style-card ' + (font === s.val ? 'on' : '')}
            aria-pressed={font === s.val} onClick={() => setFont(s.val)}>
            <span className="style-card-name" style={{ fontFamily: fontMap[s.val] }}>{s.label}</span>
            <span className="style-card-check" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none"><path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
          </button>
        ))}
      </div>
      <button className="primary-action" disabled={!font}
        onClick={() => font && onNext({ ...(initialTone ?? DEFAULT_TONE), font })}>이 말투로 할게요</button>
    </div>
  );
}
