import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import StepHeader from '../components/StepHeader';
import { tick } from '../components/SnapSwitch';
import { fontMap, formFor, hasWeightAxis, mannerDefault, opticalFix } from '../lib/palettes';
import { DEFAULT_TONE, STYLE_OPTIONS, type PartialTone } from '../lib/tone';
import { pick, useLang, type Pair } from '../lib/lang';
import type { ToneState } from '../types';

/* 이 화면의 말. 영어는 초안이다(2026-09-26, 영문판) */
const T = {
  back: { ko: '한 줄 다시 쓰기', en: 'Rewrite your line' },
  title: { ko: <>어떤 성격으로<br />말해볼까요?</>, en: <>Which character will you speak with?</> },
  lead: { ko: '마음에 드는 표현을 골라주세요.', en: 'Choose the expression you like.' },
  group: { ko: '성격 고르기', en: 'Choose a character' },
  /* 한 문장으로 줄였다(2026-09-29, 사용자 문구) */
  note: {
    ko: '성격은 앞으로 더 늘어날 예정이에요.',
    en: 'More characters are on the way.'
  } as Pair<ReactNode>,
  next: { ko: '이 성격으로 할게요', en: 'Use this character' }
};

interface Props {
  initialTone?: PartialTone | null;
  onBack: () => void;
  /** 초기 화면으로. 초안은 지우지 않는다 */
  onHome: () => void;
  onNext: (tone: PartialTone) => void;
}

/**
 * 02 성격 — 네 성격을 **2×2 네 칸**에서 고른다 (2026-09-27, 사용자).
 * 09-25부터 이틀은 세로 목록이었다 — 넷째 줄이 버튼 띠 밑에 가려 한 화면에
 * 넷이 안 보였다. 칸은 제목과 버튼 사이를 다 채우고 사이는 1px 십자 선이다.
 *
 * 칸마다 성격 이름 하나를 **그 성격의 서체로** 찍는다. 같은 날 한때 참여자가
 * 쓴 글 전문을 넣었다가(d65f87b) 되돌렸다 — 내 글이 그 서체로 어떻게 서는지는
 * 다음 화면(3/5 조율)의 첫 장면이 보여 준다. 여기서는 이름 네 개를 견준다.
 * 이름이 곧 큰 글자라, 왼쪽 위 작은 이름표는 걷었다(같은 낱말이 두 번 섰다).
 *
 * 네 칸은 화면 끝에서 끝까지 간다(app.css · .tone-choice .style-cards).
 *
 * ── 고르기: 테두리 칸 안의 판 (2026-09-29, 사용자 · 견본 A2) ──────────────
 * 3/5 · 4/5 조절판의 스위치와 같은 손맛이다. 네 칸이 테두리 칸 하나에 담기고,
 * 고른 칸에 회색 판(--grey-600)이 선다. 다른 칸을 누르면 판이 그리로 미끄러져
 * 붙고(대각선도 한 번에), 어디를 끌어도 판이 손가락을 상하좌우로 따라오다 칸을
 * 넘는 순간 진동(tick)과 함께 바뀌고, 놓으면 가까운 칸에 붙는다. 화살표 네 방향도
 * 된다. 빨강 면 + 체크이던 것을 걷었다 — 빨강은 '다음으로 가는 길'(아래 버튼)
 * 하나에 남는다. 고른 것은 색이 아니라 판(모양)이 말한다.
 *
 * **처음에는 판이 없다(절대원칙).** 판을 첫 칸에 세워 두면 시스템이 성격을 미리
 * 고른 셈이 된다. 처음 누르거나 끈 칸에 판이 나타나고, 그다음부터 옮긴다.
 * 고르는 것만으로는 넘어가지 않고 아래 버튼이 정한다.
 */
/** 3/5 기본형(막대 가운데 · 말투 첫째 칸)의 글자 모양 — palettes.ts · formFor */
function faceOf(font: string): CSSProperties {
  const f = formFor({ font, speed: 0.5, weight: 0.5, manner: mannerDefault(font) });
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
  const lang = useLang();
  const at = font ? STYLE_OPTIONS.findIndex(s => s.val === font) : -1;

  /* 판의 자리 — 칸 하나를 1로 센 가로(x) · 세로(y), 0 ~ 1(2×2). 끄는 동안만 값이 있다 */
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const press = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);
  const radios = useRef<Array<HTMLButtonElement | null>>([]);
  const pickCell = (i: number) => { if (i !== at) { tick(); setFont(STYLE_OPTIONS[i].val); } };
  const cellOf = (p: { x: number; y: number }) => Math.round(p.y) * 2 + Math.round(p.x);
  /* 손가락 자리 → 판 가운데의 자리. 첫 칸 가운데에서 끝 칸 가운데까지만 간다 */
  const posAt = (cx: number, cy: number) => {
    const a = radios.current[0]?.getBoundingClientRect();
    const b = radios.current[3]?.getBoundingClientRect();
    if (!a || !b) return { x: 0, y: 0 };
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    return { x: clamp((cx - a.left - a.width / 2) / (b.left - a.left || 1)),
             y: clamp((cy - a.top - a.height / 2) / (b.top - a.top || 1)) };
  };
  const down = (e: React.PointerEvent) => {
    if (press.current) return;                                   // 한 손가락만 따른다(SnapSwitch와 같다)
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    list.current?.setPointerCapture(e.pointerId);
  };
  const moveTo = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p || e.pointerId !== p.id) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;   // 누르기와 끌기를 가른다
    p.moved = true;
    const pos = posAt(e.clientX, e.clientY);
    setDrag(pos);
    pickCell(cellOf(pos));
  };
  const up = (e: React.PointerEvent) => {
    const p = press.current;
    if (!p || e.pointerId !== p.id) return;
    press.current = null;
    if (p.moved) setDrag(null);                                  // 놓으면 가까운 칸에 붙는다
    else pickCell(cellOf(posAt(e.clientX, e.clientY)));          // 누르면 그 칸으로 미끄러진다
  };
  const cancel = (e: React.PointerEvent) => { if (press.current?.id === e.pointerId) { press.current = null; setDrag(null); } };
  /* 화살표 — 2×2 안에서 옆 · 위아래 칸으로. 고르기 전이면 초점이 있는 칸(첫 칸)에서 출발한다 */
  const key = (e: React.KeyboardEvent) => {
    const d = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[e.key];
    if (!d) return;
    e.preventDefault();
    const from = at >= 0 ? at : Math.max(0, radios.current.findIndex((r) => r === document.activeElement));
    const col = Math.min(1, Math.max(0, (from % 2) + d[0]));
    const row = Math.min(1, Math.max(0, Math.floor(from / 2) + d[1]));
    const to = row * 2 + col;
    pickCell(to);
    radios.current[to]?.focus();
  };
  const shown = drag ?? (at >= 0 ? { x: at % 2, y: Math.floor(at / 2) } : null);
  const shownCell = shown ? cellOf(shown) : -1;

  /**
   * 아래에 줄이 더 있는가 (2026-09-25).
   *
   * 390·430 화면에서는 셋째 줄 아래끝이 확정 버튼 띠의 윗끝과 거의 맞아서,
   * 넷째 줄(다정한)이 있다는 것이 안 보였다 — 목록이 거기서 끝난 것처럼
   * 읽혔다. 마지막 줄이 띠 밑에 가려 있는 동안만 띠 위에 선 하나와 아래
   * 화살표를 세운다. 끝까지 내리거나 처음부터 다 보이면 둘 다 거둔다.
   * 2×2가 된 뒤로는(2026-09-27) 네 칸이 이름 높이 밑으로 눌릴 만큼 낮은
   * 화면에서만 선다.
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
      <StepHeader at={2} back={{ label: pick(T.back, lang), onClick: onBack }} onHome={onHome} />
      {/* 설명은 고른 뒤에도 남는다 — 사라지면 그만큼 목록이 위로 뛴다 */}
      <div className="z-ask">
        <h1>{pick(T.title, lang)}</h1>
        <p>{pick(T.lead, lang)}</p>
      </div>

      <div ref={list} className={'style-cards' + (drag ? ' is-moving' : '')}
        role="radiogroup" aria-label={pick(T.group, lang)}
        onPointerDown={down} onPointerMove={moveTo} onPointerUp={up}
        onPointerCancel={cancel} onLostPointerCapture={cancel} onKeyDown={key}>
        {/* 판 — 고르기 전에는 없다. 처음 서는 순간은 제자리에서 나타난다(미끄러져
            오지 않는다 — 올 곳이 없었다). app.css · .style-thumb */}
        {shown && <i className="style-thumb" aria-hidden
          style={{ '--x': shown.x, '--y': shown.y } as CSSProperties} />}
        {STYLE_OPTIONS.map((s, i) => {
          const name = lang === 'en' ? s.en : s.label;
          return (
          <button key={s.val} type="button" role="radio" aria-checked={at === i}
            tabIndex={at === i || (at < 0 && i === 0) ? 0 : -1}
            ref={(el) => { radios.current[i] = el; }}
            className={'style-card' + (shownCell === i ? ' on' : '')}
            aria-label={name}
            /* 자판(Enter · Space)과 낭독기로 고를 때. 손가락은 위 pointer가 맡는다 */
            onClick={(e) => { if (e.detail === 0) pickCell(i); }}>
            {/* 서체마다 잉크가 차지하는 높이도 굵기도 달라 같은 크기·같은
                굵기로 안 보인다. 잰 값은 palettes.ts에 있다. 이름은 낭독기가
                버튼 이름(aria-label)으로 읽으므로 글자는 가린다.

                모양은 **3/5의 기본형** 그대로다(2026-09-25) — 막대 셋이 가운데
                ('보통'), 말투는 첫째 칸. 당당한은 폭 700 · 세로 75%, 유머있는은
                굵기 840, 차분한은 무게 445 · 자간 −25, 다정한은 획 0.1pt. 여기서
                고르고 3/5로 넘어가도 글자 모양이 바뀌지 않는다. */}
            <span className="style-card-name" aria-hidden style={faceOf(s.val)}>
              {name}
            </span>
          </button>
          );
        })}
      </div>

      {/* 목록 아래 안내 한 줄(2026-09-25). 입력칸·버튼 없이 글자만. 성격이
          넷으로 끝나지 않는다는 것과, 바라는 성격을 어디에 적으면 되는지
          (완료 화면의 의견 칸)를 말한다. 선택을 권하지 않는다 — 절대원칙. */}
      <p className="glyph-note">{pick(T.note, lang)}</p>

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
          onClick={() => {
            if (!font) return;
            /* 성격이 바뀌면 말투는 그 성격의 앞 칸에서 시작한다(palettes.ts · mannerDefault). 말투가 없는 성격(무게를
               묻는 성격 — 당당한도 2026-10-04부터)은 말투를 비워 둔다: 당당한의 새 글이 말투로 나무를 고른 옛 글과 갈린다.
               같은 성격으로 돌아온 길이면 고른 말투를 그대로 둔다 */
            const base = initialTone ?? DEFAULT_TONE;
            const keep = initialTone?.font === font && base.manner !== undefined;
            onNext({ ...base, font, manner: hasWeightAxis(font) ? undefined : keep ? base.manner : mannerDefault(font) });
          }}>{pick(T.next, lang)}</button>
      </div>
    </div>
  );
}
