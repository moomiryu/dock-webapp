import { useState, type CSSProperties } from 'react';
import BackButton from '../components/BackButton';
import { fontMap, opticalFix, opticalStroke } from '../lib/palettes';
import { foldLines } from '../lib/fit';
import { DEFAULT_TONE, STYLE_OPTIONS, type PartialTone } from '../lib/tone';
import type { ToneState } from '../types';
interface Props {
  /** 앞 화면에서 쓴 한 줄. 네 칸의 견본이 된다 */
  text: string;
  initialTone?: PartialTone | null;
  onBack: () => void;
  onNext: (tone: PartialTone) => void;
}
/**
 * 02 성격.
 *
 * ── 칸이 보여주는 것이 바뀌었다 (2026-09-19) ──────────────────────────
 * 전에는 칸마다 제 이름을 그 서체로 찍었다('당당한'을 서울남산으로). 그런데
 * 그러면 **네 칸이 서로 다른 낱말**이라, 무엇을 견주는 것인지 알 수 없다.
 * 골격이 비슷한 두 칸(당당한·발랄한)이 특히 그랬다.
 *
 * 순서를 뒤집어 글이 먼저 오게 되면서 네 칸에 **같은 글자**를 놓을 수 있게
 * 됐다 — 방금 쓴 내 문장이다. 같은 받침, 같은 조사, 같은 띄어쓰기를 네 번
 * 찍으면 차이가 서체에서만 온다.
 *
 * 이름은 아래 작은 글씨로 남긴다 — 앱의 어휘라 사라지면 안 된다.
 */
export default function PhaseGlyph({ text, initialTone, onBack, onNext }: Props) {
  const [font, setFont] = useState<ToneState['font'] | null>(initialTone?.font ?? null);
  /**
   * 칸 안에서만 짧게 접는다 — 벽의 12자와는 다른 값이다.
   *
   * 벽의 줄(12자)을 그대로 넣었더니 195px 칸에서 19px이 됐다. 이름 세 글자를
   * 36px로 찍던 자리라 획이 거의 안 보이고, 정작 견주라는 서체 차이가 그
   * 크기에서 사라진다. 여섯 자로 접어 세 줄까지만 쓰면 36px이 그대로 나온다.
   *
   * 문장이 토막 나 보이지만 이 칸은 읽는 자리가 아니라 **획을 보는 자리**다.
   * 네 칸이 같은 글자를 쓴다는 것만 지켜지면 된다.
   */
  const CARD_CHARS = 6, CARD_ROWS = 3;
  const sample = (text.trim() ? foldLines(text, CARD_CHARS).slice(0, CARD_ROWS) : ['발화']);
  const chars = Math.max(1, ...sample.map((l) => Array.from(l).length));
  // 칸 폭의 86%에 맞춘다 — 이름을 찍던 시절의 상한과 같은 비율이다.
  const fit = (86 / chars).toFixed(1);
  return (
    <div className="z-frame z1 tone-choice">
      <div className="z-header">
        <BackButton label="한 줄 다시 쓰기" onClick={onBack} /><span className="z-step-of">2 / 5 · 성격</span>
      </div>
      <div className="z-ask">
        <h1>어떤 성격으로<br />말해볼까요?</h1>
        <p>마음에 드는 것을 골라주세요.</p>
      </div>
      <div className="style-cards" role="group" aria-label="성격 고르기">
        {STYLE_OPTIONS.map(s => (
          <button key={s.val} type="button" className={'style-card ' + (font === s.val ? 'on' : '')}
            aria-pressed={font === s.val} aria-label={s.label} onClick={() => setFont(s.val)}>
            {/* 서체마다 잉크가 차지하는 높이도 굵기도 달라 같은 크기·같은
                굵기로 안 보인다. 잰 값은 palettes.ts에 있다. */}
            <span className="style-card-name" style={{
              fontFamily: fontMap[s.val],
              '--optical': opticalFix[s.val]?.scale ?? 1,
              '--card-fit': fit + 'cqw',
              /* 이 카드는 무게를 고르는 자리가 아니다 — CSS가 400으로 찍는다.
                 사다리의 400 칸을 그대로 가져온다. */
              '--optical-stroke': opticalStroke(s.val, 400),
              '--optical-shift': (opticalFix[s.val]?.shift ?? 0) + 'em'
            } as CSSProperties}>
              {sample.map((l, i) => <span key={i} className="style-card-line">{l}</span>)}
            </span>
            <span className="style-card-tag">{s.label}</span>
          </button>
        ))}
      </div>
      <button className="primary-action" disabled={!font}
        onClick={() => font && onNext({ ...(initialTone ?? DEFAULT_TONE), font })}>이 성격으로 할게요</button>
    </div>
  );
}
