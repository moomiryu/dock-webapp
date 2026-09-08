import { useState } from 'react';
import BackButton from '../components/BackButton';
import StepRail from '../components/StepRail';
import { moods } from '../lib/palettes-v2';
import { fontMap } from '../lib/palettes';
import VoiceBubble from '../components/VoiceBubble';
import type { ToneState } from '../types';

interface Props {
  text: string;
  tone: ToneState;
  onBack: (tone: ToneState) => void;
  onNext: (tone: ToneState) => void;
}

export default function PhaseColor({ text, tone, onBack, onNext }: Props) {
  const [index, setIndex] = useState(((tone.paletteIdx % moods.length) + moods.length) % moods.length);
  const selected = moods[index];
  const current = { ...tone, paletteIdx: index };
  return (
    <div className="z-frame color-choice">
      <div className="z-header">
        <BackButton label="한 줄 다시 쓰기" onClick={() => onBack(current)} />
        <span>4 / 5 · 색</span>
      </div>
      <StepRail step={4} />
      <div className="z-ask">
        <h1>어떤 색으로 발화를 남겨볼까요?</h1>
      </div>
      <div className="color-preview-stage">
        <div className="color-preview">
          <VoiceBubble text={text} bg={selected.bg} color={selected.text} fontFamily={fontMap[tone.font]}
            weight={tone.wght} width={tone.tone} slant={tone.slnt} />
        </div>
        <p className="screen-ratio-note">실제 스크린 비율이에요.</p>
      </div>
      <fieldset className="color-options">
        <legend className="sr-only">발화 색 조합</legend>
        <div className="color-swatches">
          {moods.map((mood, i) => (
            <label className="color-option" key={mood.id}>
              <input type="radio" name="message-color" value={i} checked={index === i}
                aria-label={`${mood.name} 색 조합`} onChange={() => setIndex(i)} />
              <span className="color-swatch" style={{ background: `linear-gradient(90deg, ${mood.bg} 50%, ${mood.text} 50%)` }} />
            </label>
          ))}
        </div>
      </fieldset>
      <p className="color-caption" aria-live="polite">{index + 1} / {moods.length} 색 조합</p>
      <button className="primary-action" onClick={() => onNext(current)}>이 색으로 할게요</button>
    </div>
  );
}
