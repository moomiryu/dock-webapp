import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import StepHeader from '../components/StepHeader';
import CloudBubble from '../components/CloudBubble';
import { cloudForTone } from '../lib/cloud';
import { fontMap, formFor, opticalFix } from '../lib/palettes';
import { DEFAULT_TONE, STYLE_OPTIONS, type PartialTone } from '../lib/tone';
import { pick, useLang, type Pair } from '../lib/lang';
import type { ToneState } from '../types';

/* 이 화면의 말. 영어는 초안이다(2026-09-26, 영문판) */
const T = {
  back: { ko: '한 줄 다시 쓰기', en: 'Rewrite your line' },
  title: { ko: <>어떤 성격으로<br />말해볼까요?</>, en: <>Which character will you speak with?</> },
  lead: { ko: '마음에 드는 것을 골라주세요.', en: 'Choose the one you like.' },
  group: { ko: '성격 고르기', en: 'Choose a character' },
  /* 줄은 문장 단위로 바꾼다(사용자 결정) — 문장 사이에서 한 번 끊는다 */
  note: {
    ko: <>성격은 앞으로 더 늘어나요.<br />해 보고 싶은 성격이 있다면 마지막 화면에 적어 주세요.</>,
    en: <>More characters are on the way.<br />If there is one you'd like to try, tell us on the last screen.</>
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
 * ── 고르기 ──────────────────────────────────────────────────────────
 * 칸 전체를 누른다. 고른 칸에는 그 성격의 말풍선 모양이 선다(2026-09-28 —
 * 아래 ChoiceShape). 붉은 면 + 체크였던 것을 바꿨다. 고르기 전후로 이름은 한
 * 픽셀도 움직이지 않는다. 고르는 것만으로는 넘어가지 않고 아래 버튼이 정한다.
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

/** 고른 칸의 모양이 칸에서 차지하는 몫 — 박스를 넘지 않는다(2026-09-28 견본 ③의 한정) */
const SHAPE_SHARE = 0.85;
/** 모양을 그리는 기준 길이. CloudBubble은 이 길이 × 비율로 크기를 잡는다 */
const SHAPE_SIDE = 1000;

/**
 * 고른 칸의 힌트 — **그 성격의 말풍선 모양**(2026-09-28, 사용자).
 *
 * 고른 칸을 빨간 면으로 통째로 칠하던 것을, 그 성격이 벽에서 입을 모양으로
 * 칠한다(차분한 = 돌, 당당한 = 별 …). 무엇을 골랐는지와 함께 **그 태도가 어떤
 * 꼴로 서는지**를 미리 보여 준다. 태도는 여전히 이름으로 고른다 — 모양으로
 * 고르게 하지 않는다(절대원칙 · landscape.md).
 *
 * 모양은 따로 들고 있지 않다. 벽 · 4/5 · 5/5와 같은 cloudForTone과 CloudBubble을
 * 그대로 부르므로, 형상이 바뀌면(다른 세션이 돌 · 별 · 꽃 · 나비를 다듬는 중)
 * 이 힌트도 같이 바뀐다. 이름 글자로 지은 모양이라 같은 성격은 늘 같은 모양이다.
 *
 * 크기는 칸의 85% 안으로 한정한다 — 벽의 규칙 그대로 이름을 감싸면 별의 뿔이
 * 칸을 넘었다(견본 ①). 이름 크기는 그대로 두고, 모양에 겹친 글자만 흰색이 된다
 * (견본 (나)) — 모양 그림을 가림판(mask)으로 씌운 흰 이름을 검은 이름 위에 얹는다.
 */
function ChoiceShape({ font, name, cell, face }: { font: ToneState['font']; name: string; cell: { w: number; h: number }; face: CSSProperties }) {
  const cloud = useMemo(() => cloudForTone([name], { font, speed: 0.5, weight: 0.5, manner: 0 }), [font, name]);
  const u = Math.min((SHAPE_SHARE * cell.w) / cloud.w, (SHAPE_SHARE * cell.h) / cloud.h);
  const W = cloud.w * u, H = cloud.h * u;
  const box = { unit: u / SHAPE_SIDE, w: W / SHAPE_SIDE, h: H / SHAPE_SIDE, tail: 0 };
  /* SVG의 칠은 CSS 변수를 못 읽는다 — 토큰의 값을 읽어 넘긴다 */
  const color = useMemo(() => getComputedStyle(document.documentElement).getPropertyValue('--brand-strong').trim(), []);
  const art = useRef<HTMLSpanElement>(null);
  const [mask, setMask] = useState<string | null>(null);
  /* 그려진 모양을 가림판으로 옮긴다. useEffect인 이유: 픽셀 구름은 CloudBubble이
     제 useEffect에서 칸을 찍는다 — 그보다 뒤(자식 먼저)에 떠야 빈 가림판이 안 된다 */
  useEffect(() => {
    const svg = art.current?.querySelector('svg');
    if (!svg) return;
    const c = svg.cloneNode(true) as SVGSVGElement;
    c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    c.setAttribute('width', String(W));
    c.setAttribute('height', String(H));
    setMask(`url("data:image/svg+xml,${encodeURIComponent(new XMLSerializer().serializeToString(c))}")`);
  }, [cloud, W, H]);
  return <>
    <span ref={art} className="choice-shape" aria-hidden>
      <CloudBubble cloud={cloud} box={box} side={`${SHAPE_SIDE}px`} color={color} still />
    </span>
    {mask && <span className="choice-ink" aria-hidden
      style={{ WebkitMaskImage: mask, maskImage: mask, WebkitMaskSize: `${W}px ${H}px`, maskSize: `${W}px ${H}px` }}>
      <span className="style-card-name" style={face}>{name}</span>
    </span>}
  </>;
}

export default function PhaseGlyph({ initialTone, onBack, onHome, onNext }: Props) {
  const [font, setFont] = useState<ToneState['font'] | null>(initialTone?.font ?? null);
  const lang = useLang();
  const at = font ? STYLE_OPTIONS.findIndex(s => s.val === font) : -1;

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

  /* 칸 하나의 크기 — 고른 칸의 모양을 그 안에 한정하려고 잰다. 네 칸은 같은 크기다 */
  const [cell, setCell] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const first = list.current?.firstElementChild as HTMLElement | null;
    if (!first) return;
    const measure = () => setCell({ w: first.clientWidth, h: first.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(first);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="z-frame z1 tone-choice">
      <StepHeader at={2} back={{ label: pick(T.back, lang), onClick: onBack }} onHome={onHome} />
      {/* 설명은 고른 뒤에도 남는다 — 사라지면 그만큼 목록이 위로 뛴다 */}
      <div className="z-ask">
        <h1>{pick(T.title, lang)}</h1>
        <p>{pick(T.lead, lang)}</p>
      </div>

      <div ref={list} className="style-cards" role="radiogroup" aria-label={pick(T.group, lang)}>
        {STYLE_OPTIONS.map((s, i) => {
          const name = lang === 'en' ? s.en : s.label;
          return (
          <button key={s.val} type="button" role="radio" aria-checked={at === i}
            className={'style-card' + (at === i ? ' on' : '')}
            aria-label={name} onClick={() => setFont(s.val)}>
            {/* 고른 칸에는 체크 대신 그 성격의 모양이 선다(2026-09-28) — 모양 자체가
                '골랐다'를 색이 아닌 꼴로 말한다. 낭독기는 aria-checked로 안다 */}
            {at === i && cell && <ChoiceShape font={s.val} name={name} cell={cell} face={faceOf(s.val)} />}
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
          onClick={() => font && onNext({ ...(initialTone ?? DEFAULT_TONE), font })}>{pick(T.next, lang)}</button>
      </div>
    </div>
  );
}
