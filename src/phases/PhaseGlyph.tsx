import { useEffect, useRef, useState, type CSSProperties } from 'react';
import StepHeader from '../components/StepHeader';
import { fontMap, formFor, opticalFix } from '../lib/palettes';
import { DEFAULT_TONE, STYLE_OPTIONS, type PartialTone } from '../lib/tone';
import type { ToneState } from '../types';

interface Props {
  initialTone?: PartialTone | null;
  onBack: () => void;
  /** 초기 화면으로. 초안은 지우지 않는다 */
  onHome: () => void;
  onNext: (tone: PartialTone) => void;
}

/**
 * 02 성격 — 네 성격을 **세로 목록**으로 고른다 (2026-09-25).
 *
 * 줄마다 성격 이름 하나를 **그 성격의 서체로** 찍는다. 같은 날 한때 참여자가
 * 쓴 글 전문을 넣었다가(d65f87b) 되돌렸다 — 내 글이 그 서체로 어떻게 서는지는
 * 다음 화면(3/5 조율)의 첫 장면이 보여 준다. 여기서는 이름 네 개를 견준다.
 * 이름이 곧 큰 글자라, 왼쪽 위 작은 이름표는 걷었다(같은 낱말이 두 번 섰다).
 *
 * 목록은 화면 끝에서 끝까지 가고 줄 사이는 1px 선이다. 줄 높이는 폭의 절반과
 * 160 중 큰 값 이상이다(app.css).
 *
 * ── 고르기 ──────────────────────────────────────────────────────────
 * 줄 전체를 누른다. 고른 줄은 붉은 면에 **체크**가 붙는다 — 색만으로 고른
 * 것을 말하지 않는다. 체크 자리는 늘 비워 두어 고르기 전후로 글자가 움직이지
 * 않는다. 고르는 것만으로는 넘어가지 않고 아래 버튼이 정한다.
 */
/** 3/5 기본형(막대 가운데 · 말투 첫째 칸)의 글자 모양 — palettes.ts · formFor */
function faceOf(font: string): CSSProperties {
  const f = formFor({ font, speed: 0.5, weight: 0.5, manner: 0 });
  return {
    fontFamily: fontMap[font],
    fontWeight: f.weight,
    fontVariationSettings: f.variation,
    letterSpacing: f.letterSpacing,
    transform: `scale(${f.scaleX}, ${f.scaleY})`,
    '--optical': opticalFix[font]?.scale ?? 1,
    '--optical-stroke': f.stroke,
    '--optical-shift': (opticalFix[font]?.shift ?? 0) + 'em'
  } as CSSProperties;
}

export default function PhaseGlyph({ initialTone, onBack, onHome, onNext }: Props) {
  const [font, setFont] = useState<ToneState['font'] | null>(initialTone?.font ?? null);
  const at = font ? STYLE_OPTIONS.findIndex(s => s.val === font) : -1;

  /**
   * 아래에 줄이 더 있는가 (2026-09-25).
   *
   * 390·430 화면에서는 셋째 줄 아래끝이 확정 버튼 띠의 윗끝과 거의 맞아서,
   * 넷째 줄(다정한)이 있다는 것이 안 보였다 — 목록이 거기서 끝난 것처럼
   * 읽혔다. 마지막 줄이 띠 밑에 가려 있는 동안만 띠 위에 선 하나와 아래
   * 화살표를 세운다. 끝까지 내리거나 처음부터 다 보이면 둘 다 거둔다.
   */
  const list = useRef<HTMLDivElement>(null);
  const band = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const check = () => {
      const last = list.current?.lastElementChild;
      const cta = band.current;
      if (!last || !cta) return;
      setMore(last.getBoundingClientRect().bottom > cta.getBoundingClientRect().top + 1);
    };
    check();
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    void document.fonts?.ready.then(check);
    return () => { window.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, []);

  return (
    <div className="z-frame z1 tone-choice">
      <StepHeader at={2} back={{ label: '한 줄 다시 쓰기', onClick: onBack }} onHome={onHome} />
      {/* 설명은 고른 뒤에도 남는다 — 사라지면 그만큼 목록이 위로 뛴다 */}
      <div className="z-ask">
        <h1>어떤 성격으로<br />말해볼까요?</h1>
        <p>마음에 드는 것을 골라주세요.</p>
      </div>

      <div ref={list} className="style-cards" role="radiogroup" aria-label="성격 고르기">
        {STYLE_OPTIONS.map((s, i) => (
          <button key={s.val} type="button" role="radio" aria-checked={at === i}
            className={'style-card' + (at === i ? ' on' : '')}
            aria-label={s.label} onClick={() => setFont(s.val)}>
            <svg className="style-card-check" viewBox="0 0 24 24" aria-hidden focusable="false">
              <path d="M5.5 12.5 L10 17 L18.5 7.5" fill="none" stroke="currentColor"
                strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* 서체마다 잉크가 차지하는 높이도 굵기도 달라 같은 크기·같은
                굵기로 안 보인다. 잰 값은 palettes.ts에 있다. 이름은 낭독기가
                버튼 이름(aria-label)으로 읽으므로 글자는 가린다.

                모양은 **3/5의 기본형** 그대로다(2026-09-25) — 막대 셋이 가운데
                ('보통'), 말투는 첫째 칸. 당당한은 폭 700 · 세로 75%, 유머있는은
                굵기 840, 차분한은 무게 445 · 자간 −25, 다정한은 획 0.1pt. 여기서
                고르고 3/5로 넘어가도 글자 모양이 바뀌지 않는다. */}
            <span className="style-card-name" aria-hidden style={faceOf(s.val)}>
              {s.label}
            </span>
          </button>
        ))}
      </div>

      {/* 목록 아래 안내 한 줄(2026-09-25). 입력칸·버튼 없이 글자만. 성격이
          넷으로 끝나지 않는다는 것과, 바라는 성격을 어디에 적으면 되는지
          (완료 화면의 의견 칸)를 말한다. 선택을 권하지 않는다 — 절대원칙. */}
      {/* 줄은 문장 단위로 바꾼다(사용자 결정) — 문장 사이에서 한 번 끊는다 */}
      <p className="glyph-note">성격은 앞으로 더 늘어나요.<br />해 보고 싶은 성격이 있다면 마지막 화면에 적어 주세요.</p>

      {/* 확정 버튼은 화면 아래에 붙어 있고 제 바탕을 가진다 — 목록이 그 밑으로
          지나가도 글자와 겹쳐 보이지 않는다. 목록이 끝나면 버튼 위에서 끝난다. */}
      <div ref={band} className={'glyph-cta' + (more ? ' has-more' : '')}>
        {/* 아래에 더 있다는 표시. 누르는 물건이 아니고 낭독기에도 읽히지 않는다 —
            낭독기는 목록의 네 항목을 이미 다 센다 */}
        <svg className="glyph-more" viewBox="0 0 24 24" aria-hidden focusable="false">
          <path d="M5 9 L12 16 L19 9" fill="none" stroke="currentColor" strokeWidth="2.6"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <button className="primary-action" disabled={!font}
          onClick={() => font && onNext({ ...(initialTone ?? DEFAULT_TONE), font })}>이 성격으로 할게요</button>
      </div>
    </div>
  );
}
