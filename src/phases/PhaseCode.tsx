import { useState } from 'react';
import { getWallCode } from '../lib/wallCode';

interface Props {
  onBack: () => void;
  onConfirm: () => void;
}

const CODE_LEN = 4;

// 전송 직전 현장 확인. 외벽에 떠 있는 네 자리를 옮겨 적어야 보내진다.
export default function PhaseCode({ onBack, onConfirm }: Props) {
  const [expected] = useState(getWallCode);
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  const filled = value.length === CODE_LEN;

  function handleChange(next: string) {
    setValue(next.replace(/\D/g, '').slice(0, CODE_LEN));
    setWrong(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!filled) return;
    if (value !== expected) {
      setWrong(true);
      setValue('');
      return;
    }
    onConfirm();
  }

  return (
    <form className="z-frame" onSubmit={handleSubmit}>
      <div className="z-header">
        <button type="button" className="z-back" onClick={onBack}>
          미리보기 다시
        </button>
        <span>4 / 4 · 확인</span>
      </div>

      <div className="code-stage">
        <h1 className="voice-h1">외벽의 숫자를 넣어주세요</h1>
        <p className="voice-body">
          외벽에 네 자리 숫자가 떠 있어요.<br />
          그 숫자를 넣어야 보낼 수 있어요.
        </p>

        <input
          className={'code-input ' + (wrong ? 'is-wrong' : '')}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="0000"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          aria-label="외벽에 표시된 네 자리 숫자"
        />

        {wrong && <div className="code-error">숫자가 달라요. 외벽을 다시 확인해주세요.</div>}

        {/* 목업 — 외벽 디스플레이가 없으니 앱이 대신 보여준다 */}
        <div className="code-mock">
          <span>목업 · 외벽 대신 여기 표시</span>
          <strong>{expected}</strong>
        </div>

        <p className="voice-fineprint">
          외벽 앞에 서 있는 사람만 보낼 수 있게 하는 절차예요.
        </p>
      </div>

      <button className="primary-action" type="submit" disabled={!filled}>
        <span>보내기</span>
      </button>

      <div className="z-progress">
        <span className="dot on" />
        <span className="dot on" />
        <span className="dot on" />
        <span className="dot on" />
        <span className="z-progress-label">자형 · 효과 · 미리보기 · 확인</span>
      </div>
    </form>
  );
}
