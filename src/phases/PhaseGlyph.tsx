import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import StepHeader from '../components/StepHeader';
import { fontMap, opticalFix, opticalStroke } from '../lib/palettes';
import { foldLines } from '../lib/fit';
import { DEFAULT_TONE, STYLE_OPTIONS, type PartialTone } from '../lib/tone';
import type { ToneState } from '../types';

interface Props {
  /** 앞 화면에서 쓴 한 줄. 네 줄 모두에 이게 그 서체로 선다 */
  text: string;
  initialTone?: PartialTone | null;
  onBack: () => void;
  /** 초기 화면으로. 초안은 지우지 않는다 */
  onHome: () => void;
  onNext: (tone: PartialTone) => void;
}

/**
 * 02 성격 — 네 서체를 **세로 목록**으로 견준다 (2026-09-25).
 *
 * 2×2 격자였다. 칸이 좁아(390 화면에서 175px) 내 글을 두 줄까지만 보이고
 * 나머지를 가렸고, 고르면 그 칸이 화면을 차지하며 나머지가 접혔다. 이제
 * 네 줄이 화면 폭을 다 쓰고, 목록은 페이지와 함께 스크롤된다.
 *
 * ── 줄마다 ──────────────────────────────────────────────────────────
 *  · 왼쪽 위에 성격 이름(작게), 한가운데 내 글 **전문**(그 성격의 서체).
 *    자르지도 줄이지도(…) 않는다.
 *  · 넷은 **같은 줄에서 끊는다** — 벽의 줄 접기(foldLines, 한 줄 12자)를
 *    그대로 쓴다. 서체마다 폭이 달라 저절로 접게 두면 서체마다 줄 수가
 *    달라진다. 이렇게 하면 벽에 뜰 줄모양과도 같다.
 *  · 크기도 넷이 같다. 가장 넓은 서체의 가장 긴 줄이 줄 폭에 들어오는 크기를
 *    재서(sampleScale) 넷이 함께 쓴다. 위 한도는 이름이 쓰던 크기다.
 *  · 줄의 높이는 폭의 절반(2:1)이 기본이고 160px보다 낮아지지 않으며, 글이
 *    길면 그만큼 자란다. 넷을 한 화면에 맞추려고 줄이지 않는다.
 *
 * ── 고르기 ──────────────────────────────────────────────────────────
 * 줄 전체를 누른다. 고른 줄은 원래 쓰던 표현(붉은 면·흰 글자)에 **체크**가
 * 붙는다 — 색만으로 고른 것을 말하지 않는다. 체크 자리는 늘 비워 두어
 * 고르기 전후로 글자가 움직이지 않는다. 고르는 것만으로는 넘어가지 않고
 * 아래 버튼이 정한다. 줄이 자라거나 다른 줄이 접히는 일은 없다 — 그래서
 * '다른 성격 보기'도 없어졌다(그냥 다른 줄을 누르면 된다).
 */
export default function PhaseGlyph({ text, initialTone, onBack, onHome, onNext }: Props) {
  const [font, setFont] = useState<ToneState['font'] | null>(initialTone?.font ?? null);
  const at = font ? STYLE_OPTIONS.findIndex(s => s.val === font) : -1;
  const lines = text.trim() ? foldLines(text) : ['발화'];

  /**
   * 네 견본이 함께 쓰는 배율. 1이면 이름이 쓰던 크기(--fs-h1 × 서체 보정)다.
   *
   * 줄마다 그린 폭을 **재서**(서체·보정·획이 다 들어간 폭) 가장 긴 줄이 견본
   * 칸에 들어오는지 본다. 넷 중 가장 작은 값을 넷이 같이 쓴다. 잰 폭은 지금
   * 배율로 나눠 배율 1의 폭으로 바꿔 쓰므로, 한 번 맞추면 다시 재도 같은 답이
   * 나온다(되먹임이 없다). 폭은 3% 덜어 쓴다 — 반올림 1px에 줄이 넘친다.
   */
  const samples = useRef<Array<HTMLSpanElement | null>>([]);
  const [scale, setScale] = useState(1);
  const [remeasure, setRemeasure] = useState(0);
  useEffect(() => {
    const again = () => setRemeasure((n) => n + 1);
    window.addEventListener('resize', again);
    void document.fonts?.ready.then(again);
    return () => window.removeEventListener('resize', again);
  }, []);
  /* 안전장치: 같은 조건에서 고쳐 잡는 것은 세 번까지. 정상이면 첫 번에 끝난다 */
  const tries = useRef({ key: '', n: 0 });
  useLayoutEffect(() => {
    const key = `${text}|${remeasure}`;
    if (tries.current.key !== key) tries.current = { key, n: 0 };
    if (tries.current.n >= 3) return;
    let shared = 1;
    for (const el of samples.current) {
      const box = el?.parentElement;
      if (!el || !box) continue;
      const W = box.clientWidth * 0.97;
      if (!W) continue;
      const probe = document.createElement('span');
      probe.style.whiteSpace = 'pre';
      el.appendChild(probe);
      let widest = 0;
      for (const line of lines) {
        probe.textContent = line;
        widest = Math.max(widest, probe.getBoundingClientRect().width / scale);
      }
      el.removeChild(probe);
      if (widest > 0) shared = Math.min(shared, W / widest);
    }
    if (Math.abs(shared - scale) > 0.005) { tries.current.n += 1; setScale(shared); }
  }, [text, scale, remeasure]);

  return (
    <div className="z-frame z1 tone-choice">
      <StepHeader at={2} back={{ label: '한 줄 다시 쓰기', onClick: onBack }} onHome={onHome} />
      {/* 설명은 고른 뒤에도 남는다 — 사라지면 그만큼 목록이 위로 뛴다 */}
      <div className="z-ask">
        <h1>어떤 성격으로<br />말해볼까요?</h1>
        <p>마음에 드는 것을 골라주세요.</p>
      </div>

      <div className="style-cards" role="radiogroup" aria-label="성격 고르기"
        style={{ '--sample-scale': scale } as CSSProperties}>
        {STYLE_OPTIONS.map((s, i) => (
          <button key={s.val} type="button" role="radio" aria-checked={at === i}
            className={'style-card' + (at === i ? ' on' : '')}
            aria-label={s.label} onClick={() => setFont(s.val)}>
            {/* 이름·체크·견본은 낭독기에서 가린다 — 이름은 버튼 이름(aria-label)이
                읽고, 고른 상태는 aria-checked가 말한다 */}
            <span className="style-card-label" aria-hidden>{s.label}</span>
            <svg className="style-card-check" viewBox="0 0 24 24" aria-hidden focusable="false">
              <path d="M5.5 12.5 L10 17 L18.5 7.5" fill="none" stroke="currentColor"
                strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {/* 서체마다 잉크가 차지하는 높이도 굵기도 달라 같은 크기·같은
                굵기로 안 보인다. 잰 값은 palettes.ts에 있다. */}
            <span className="style-card-sample">
              <span ref={(el) => { samples.current[i] = el; }} className="style-card-name is-sample" aria-hidden style={{
                fontFamily: fontMap[s.val],
                '--optical': opticalFix[s.val]?.scale ?? 1,
                /* 이 줄은 무게를 고르는 자리가 아니다 — CSS가 400으로 찍는다. */
                '--optical-stroke': opticalStroke(s.val, 400),
                '--optical-shift': (opticalFix[s.val]?.shift ?? 0) + 'em'
              } as CSSProperties}>
                {lines.join('\n')}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* 확정 버튼은 화면 아래에 붙어 있고 제 바탕을 가진다 — 목록이 그 밑으로
          지나가도 글자와 겹쳐 보이지 않는다. 목록이 끝나면 버튼 위에서 끝난다. */}
      <div className="glyph-cta">
        <button className="primary-action" disabled={!font}
          onClick={() => font && onNext({ ...(initialTone ?? DEFAULT_TONE), font })}>이 성격으로 할게요</button>
      </div>
    </div>
  );
}
