import { useEffect, useRef, useState } from 'react';
import DockFrame from '../components/DockFrame';

interface Props {
  initialText: string;
  onNext: (text: string) => void;
}

const MAX = 60;

export default function Phase04Write({ initialText, onNext }: Props) {
  const [text, setText] = useState(initialText);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Apply pink palette (palette 0) on mount so frame matches the rest
    const body = document.body;
    const root = document.documentElement;
    body.classList.add('themed');
    root.style.setProperty('--bg-outer', '#FCE7F3');
    body.style.setProperty('--bg-outer', '#FCE7F3');
  }, []);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const trimmed = text.trim();
  const canProceed = trimmed.length > 0;

  return (
    <DockFrame phaseLabel="PHASE 04 / 작성" style={{ ['--bg' as string]: '#FCE7F3', ['--text' as string]: '#C2185B' }}>
      <textarea
        ref={textareaRef}
        className="write-textarea"
        value={text}
        maxLength={MAX}
        placeholder="여기에 60자 이내로 적어주세요"
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
      />
      <div className="char-counter">
        {text.length} / {MAX}
      </div>

      <button
        className="primary-action"
        disabled={!canProceed}
        onClick={() => onNext(trimmed)}
        style={{ marginTop: 16 }}
      >
        <span>다음 — 톤 결정</span>
      </button>
    </DockFrame>
  );
}
