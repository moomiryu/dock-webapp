import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import BackButton from '../components/BackButton';
import { fontMap, opticalFix, opticalStroke } from '../lib/palettes';
import { foldLines } from '../lib/fit';
import { DEFAULT_TONE, STYLE_OPTIONS, type PartialTone } from '../lib/tone';
import type { ToneState } from '../types';

interface Props {
  /** 앞 화면에서 쓴 한 줄. 고르고 나면 이게 통째로 뜬다 */
  text: string;
  initialTone?: PartialTone | null;
  onBack: () => void;
  onNext: (tone: PartialTone) => void;
}

/**
 * 02 성격 — 두 걸음이다.
 *
 * **고르는 걸음.** 네 칸에 성격 이름을 그 서체로 찍는다. 한때 여기에 내
 * 문장을 넣어 봤는데(2026-09-19), 칸이 195px이라 열두 자가 19px로 내려앉아
 * 획이 안 보였다. 여섯 자로 접어 키우니 이번엔 문장이 토막 났다. 칸은
 * 좁고, 좁은 칸에서 서체를 보여주는 건 결국 **한 낱말**이다.
 *
 * **확인하는 걸음.** 고르면 **그 칸이 아래를 통째로 차지하고** 내 글 전문이
 * 그 얼굴로 선다. 다른 화면으로 갈아타는 것이 아니라 누른 칸이 그대로
 * 커진 것이라, 무엇을 눌렀는지가 손에 남는다.
 *
 * 격자를 지우고 새 판을 그리는 대신 **칸 크기만 0으로 접는다** — 고른 칸의
 * 줄과 칸만 1fr로 남기고 나머지를 0fr로 보낸다. 같은 요소가 자리를 넓힌
 * 것이라 글자도 이어진다.
 *
 * **자라는 과정은 보이지 않는다(2026-09-20).** 한동안 그 사이를 이어
 * 붙였다(460 → 680 → 1360ms, 4080ms에 튕기는 것까지). 한 칸이 화면이 되는
 * 큰 움직임이라 무엇을 해도 급하게 밀어붙이는 인상이 남았다 — 고르는 일은
 * 조용한 일인데 화면이 먼저 서둘렀다. 지금은 누른 그 프레임에 바뀐다.
 * 무엇이 골라졌는지는 움직임이 아니라 색이 말한다. (app.css · .style-cards)
 */
export default function PhaseGlyph({ text, initialTone, onBack, onNext }: Props) {
  const [font, setFont] = useState<ToneState['font'] | null>(initialTone?.font ?? null);
  const at = font ? STYLE_OPTIONS.findIndex(s => s.val === font) : -1;
  const lines = text.trim() ? foldLines(text) : ['발화'];
  const longest = Math.max(1, ...lines.map(l => Array.from(l).length));
  // 전문이 붉은 면 폭의 82%에 들어가되, 줄이 많아지면 높이가 먼저 걸린다.
  // 높이는 vh로 잰다 — cqh를 쓰려면 container-type: size가 필요한데, 그러면
  // 붉은 면이 제 내용으로 높이를 못 정해 글자 크기가 0으로 풀린다.
  const guess = `min(${(82 / longest).toFixed(1)}cqw, ${(52 / lines.length).toFixed(1)}vh, 44px)`;
  /**
   * 고른 카드의 견본은 **잰 폭**으로 채운다(2026-09-22).
   *
   * 위의 guess는 한 글자를 1em으로 치는 어림이라 — 03과 같은 문제 — 실제
   * 자폭(0.5~0.8em)에서는 카드 폭의 35%만 썼다. 그린 것을 재서 카드 폭의
   * 86%, 높이의 55%에 먼저 닿는 쪽으로 맞춘다. 자폭은 크기에 정비례하므로
   * 한 번 재면 끝이고 1% 안의 흔들림은 버린다(PhaseTone과 같은 결).
   */
  const full = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = full.current;
    if (!el) return;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const card = el.parentElement as HTMLElement;
    if (!fs || !card) return;
    const per = { w: el.offsetWidth / fs, h: el.offsetHeight / fs };
    const next = Math.min((card.clientWidth * 0.86) / per.w, (card.clientHeight * 0.55) / per.h);
    if (next > 0 && (fit === null || Math.abs(next - fit) / next > 0.01)) setFit(next);
  });
  const size = fit === null ? guess : `${fit.toFixed(1)}px`;
  // 고른 칸의 줄·칸만 남기고 나머지를 0으로 접는다 (0·1번 = 윗줄, 0·2번 = 왼칸)
  const grid: CSSProperties | undefined = at < 0 ? undefined : {
    gridTemplateColumns: at % 2 === 0 ? '1fr 0fr' : '0fr 1fr',
    gridTemplateRows: at < 2 ? '1fr 0fr' : '0fr 1fr'
  };

  return (
    <div className={'z-frame z1 tone-choice' + (at >= 0 ? ' is-picked' : '')}>
      <div className="z-header">
        <BackButton label="한 줄 다시 쓰기" onClick={onBack} />
        <span className="z-step-of">2 / 5 · 성격</span>
      </div>
      <div className="z-ask">
        <h1>어떤 성격으로<br />말해볼까요?</h1>
        {at < 0 && <p>마음에 드는 것을 골라주세요.</p>}
      </div>

      <div className="style-cards" role="group" aria-label="성격 고르기" style={grid}>
        {/* '다른 성격 보기'는 제목 밑에 혼자 서 있었다 — 무엇을 되무르는지와
            떨어져 있어 독립된 버튼처럼 읽혔다. 되무를 대상(붉은 카드) 위에
            올린다. 옷은 03의 '되돌리기'와 같다(반투명 알약, .tone-aux-btn) —
            두 화면이 같은 자리에서 같은 손짓을 갖는다. 머리줄의 뒤로가기는
            **단계**를 되돌리고, 이건 이 안의 걸음을 되돌린다. */}
        {at >= 0 && <button type="button" className="glyph-reset" onClick={() => setFont(null)}>다른 성격 보기</button>}
        {STYLE_OPTIONS.map((s, i) => (
          <button key={s.val} type="button" className={'style-card ' + (at === i ? 'on' : '')}
            aria-pressed={at === i} aria-label={s.label} onClick={() => setFont(s.val)}>
            {at === i ? (
              <div ref={full} className="glyph-full-text" style={{
                fontFamily: fontMap[s.val],
                fontSize: size,
                '--optical-stroke': opticalStroke(s.val, 400),
                translate: `0 ${opticalFix[s.val]?.shift ?? 0}em`
              } as CSSProperties}>
                {lines.join('\n')}
              </div>
            ) : (
              /* 서체마다 잉크가 차지하는 높이도 굵기도 달라 같은 크기·같은
                 굵기로 안 보인다. 잰 값은 palettes.ts에 있다. */
              <span className="style-card-name" style={{
                fontFamily: fontMap[s.val],
                '--optical': opticalFix[s.val]?.scale ?? 1,
                /* 이 카드는 무게를 고르는 자리가 아니다 — CSS가 400으로 찍는다. */
                '--optical-stroke': opticalStroke(s.val, 400),
                '--optical-shift': (opticalFix[s.val]?.shift ?? 0) + 'em'
              } as CSSProperties}>
                {s.label}
              </span>
            )}
          </button>
        ))}
      </div>

      <button className="primary-action" disabled={!font}
        onClick={() => font && onNext({ ...(initialTone ?? DEFAULT_TONE), font })}>이 성격으로 할게요</button>
    </div>
  );
}
