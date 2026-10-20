import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import StepHeader from '../components/StepHeader';
import SnapSwitch from '../components/SnapSwitch';
import DotBubble from '../components/DotBubble';
import { foldLines } from '../lib/fit';
import { arrangementsFor, defaultAlign } from '../lib/aggregate';
import { colorsFor, type ColorPair } from '../lib/palettes-v2';
import { messageColors } from '../lib/messageStyle';
import { pick, useLang } from '../lib/lang';
import { tokenMs } from '../lib/motion';
import type { Align, ToneState } from '../types';
import { tick } from '../components/SnapSwitch';   // 룰렛이 한 칸 멈출 때의 진동(2026-09-29)

/* 이 화면의 말. 영어는 초안이다(2026-09-26, 영문판) */
const T = {
    back: { ko: '조율 다시', en: 'Tune again' },
    /* 색과 함께 정렬 방식도 고르게 되면서 '담기'로 묶었다(2026-09-28, 디자이너 문구).
       '포장'은 "말을 포장한다(미화)"로 먼저 읽혀서 버렸다 */
    title: { ko: '발화를 어떻게 담아볼까요?', en: 'How would you like to hold your line?' },
    /* '정렬 방식'은 '모양'이 됐다(2026-10-01, 디자이너 — 이 화면의 이름은 전부 '모양'으로) */
    lead: { ko: <>발화가 지닌 태도를 떠올리며,<br />모양과 색을 골라 말을 담을 그릇을 그려봐요.</>,
      en: <>Think of the attitude your line carries,<br />then pick a shape and a colour to draw the vessel that holds it.</> },
    /* 룰렛 오른쪽 ▲▼의 낭독 이름 */
    prevColour: { ko: '이전 색', en: 'Previous colour' },
    nextColour: { ko: '다음 색', en: 'Next colour' },
    next: { ko: '이렇게 담을게요', en: 'Hold it like this' },
    /* 첫 장 — 3/5와 같은 말(2026-09-28) */
    start: { ko: '위로 밀어서 시작해요', en: 'Swipe up to start' },
    /* 조정판의 두 잣대 — 3/5의 [이름 | 잣대] 줄과 같은 꼴(2026-09-28) */
    colour: { ko: '색', en: 'Colour' },
    /* 2026-10-01까지 '정렬'(디자이너 — 고르면 실루엣이 바뀌니 '모양'). 값(tone.align)과 코드의 이름은 그대로 */
    align: { ko: '모양', en: 'Shape' },
    /* 모양 스위치 칸의 말 — 3/5 말투 스위치처럼 칸 안에 짧은 말로. 세 칸, 네 성격 공통(2026-10-20, 디자이너 — 결정 31): 기본 · 미소 ·
       단호(사선). 그전의 열두 칸(계단 · 단상 · 아치 · 탑 · 내리막 · 징검다리 · 하이킥 …)은 빠졌다 — 그 옛 글은 기본으로 선다 */
    center: { ko: '기본', en: 'Basic' },
    smile: { ko: '미소', en: 'Smile' },
    slant: { ko: '단호', en: 'Firm' }
};
/** 모양 칸의 이름 — 그 칸이 없으면 값 그대로(생길 일은 없다) */
const alignWord = (a: Align) => (T as unknown as Record<string, { ko: string; en: string } | undefined>)[a] ?? { ko: a, en: a };

/*
 * 모양 잣대의 선택지(lib/aggregate.ts · arrangementsFor) — 네 성격 공통 기본 · 미소 · 단호(2026-10-20 결정 31, 그전엔 성격마다 셋씩 열두 칸).
 * 고르면 미리보기의 말이 낱개부터 다시 모여 그 배치로 선다. 값은 tone.align으로 저장되고 벽까지 간다 — 참여자가 고른 모양이 벽에 그대로 나온다(절대원칙).
 */
interface Props {
    text: string;
    tone: ToneState;
    onBack: (tone: ToneState) => void;
    /** 초기 화면으로. 초안은 지우지 않는다 */
    onHome: () => void;
    onNext: (tone: ToneState) => void;
    /** 5/5에서 뒤로가기로 돌아왔는가 — 그러면 첫 장 없이 고르는 장에서 선다 */
    returning?: boolean;
}
/**
 * 04 색.
 *
 * 화면은 03이 **물러선 그 모습** 그대로다 — 검은 화면에 한 덩이가 놓이고
 * 가장자리에서 물결이 번진다. 03에서 자판을 내려 그 형태를 보고 있었는데,
 * 04로 넘어왔다고 다른 액자로 갈아타면 방금 본 것이 사라진다. 여기서는
 * 쓰지 않으니 자판이 올라올 일도 없다 — 물러선 상태가 이 화면의 기본이다.
 *
 * 16:10 액자에 줄여 보여 주던 '실제 스크린 비율'은 걷어냈다. 그건 벽에서
 * 어떻게 보이는지를 묻는 화면(05)이 할 일인데 여기서 먼저 답해 버리면,
 * 색을 고르는 동안 글이 손톱만 해져서 정작 고르려는 색이 안 보인다.
 *
 * 이 단계에서 달라지는 것은 하나뿐이다: **색판이 아래에서 올라온다.**
 * 그래서 단계가 넘어간 게 아니라 색만 꺼내 든 것으로 읽힌다.
 *
 * ── 말풍선이 여기서 처음 나온다 ───────────────────────────────────────
 * 한때 조율 화면부터 도형을 세워 봤는데, 축 셋을 만지는 자리에 도형까지
 * 올라오니 무엇을 조절하는 중인지가 흐려졌다. 여기는 **면이 주인공**인
 * 화면이라 도형이 제 일을 한다 — 고른 색이 그 윤곽을 입는다.
 *
 * 크기는 DotBubble이 무대(.color-stage)를 재서 정한다 — 낱개 · 모임 · 꼬리가 다 들게. 말의 모양은 벽과 같은
 * lib/aggregate.ts가 짓는다(2026-10-20, 결정 3).
 */

/**
 * 룰렛이 도는 짝 — **성격마다 제 여덟 짝**(2026-09-29, 디자이너 확정 · palettes-v2 ATTITUDE_COLORS).
 *
 * 그 전에는 네 성격이 옛 열 짝(moods)에서 겹치는 둘을 뺀 여덟을 같이 돌았다. 옛 짝의 데이터는
 * 그대로 둔다 — 옛 메시지의 paletteIdx가 거기 걸려 있다.
 */
const pairAt = (pairs: readonly ColorPair[], bg: string, text: string) => pairs.findIndex((m) =>
    m.bg.toUpperCase() === bg.toUpperCase() && m.text.toUpperCase() === text.toUpperCase());
/**
 * 처음 들어오면 흰 바탕 · 검정 글자(2026-09-29, 사용자) — 흰 짝이 있는 성격(당당한)에서. 없는 성격은
 * 제 첫 짝에서. 3/5를 마친 형식은 작업용 하늘색(messageStyle · DRAFT_COLORS)을 들고 오는데 그건
 * 고를 수 있는 짝이 아니다 — 고른 짝이 아니면(다른 성격의 짝을 고른 뒤 돌아와도) 여기서 시작하고,
 * 한 번 고른 뒤에는 그 짝이 남는다(App · saveTone).
 */
const firstOf = (pairs: readonly ColorPair[]) => Math.max(0, pairs.findIndex((m) => m.id === 'white'));
/**
 * 조정판(--grey-50)과 거의 같은 옅은 칠 — '이렇게 담을게요'가 판에 묻히지 않게 진한 회색 칸으로(app.css
 * [data-pale]). 흰 짝만 그랬다(판과 대비 1.05, 2026-09-29 사용자가 견본에서 골랐다). 성격별 짝에서는 판과의 색 거리
 * (ΔE2000)가 20 아래인 다섯 — 흰(미색, 7.9) · 얼음(10.2) · 돌빛(13.8) · 연청(16.4) · 시안(18.3). 시안은 2026-10-01
 * 유머를 누르며 들어왔다. 그 위(연분홍 20.3 · 살구 20.8 · 라벤더 22.9)는 제 빛깔로 판과 갈린다
 */
const PALE = new Set(['white', 'stone', 'ice', 'mist', 'cyan']);

/**
 * 첫 장의 시연(2026-09-28, 사용자) — 3/5에서 다듬은 내 글이 위에서 굴러 떨어져
 * 가운데 말풍선에 들어가고, 그 말풍선이 색 짝을 차례로 갈아입는다.
 *
 * 떨어져 들어가는 움직임은 CSS(app.css · colorDemoFall · colorDemoInk)가 하고(말풍선은
 * 처음부터 서 있다), 색은 이 부품의 제 상태가 돈다 — 참여자가 고른 색(bg · fg)에는 닿지 않는다. 룰렛의
 * 성격의 여덟 짝(pairs)을 같은 시간씩 차례로 도므로 어느 색도 권하지 않는다(절대원칙). 시작은 지금 색이다.
 * 움직임 줄이기를 켠 사람에게는 떨어지지도 돌지도 않는다.
 */
function ColorDemo({ lines, tone, from, pairs }: { lines: string[]; tone: ToneState; from: number; pairs: readonly ColorPair[] }) {
    const [i, setI] = useState(from);
    useEffect(() => {
        if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        /* 박자는 토큰에서 읽는다 — 글이 나타나 자리 잡는 동안(--t-hold × 2.4)은 첫 색 그대로,
           그 뒤 --t-hold × 1.5마다 한 짝씩 */
        const hold = tokenMs('--t-hold', 700);
        let iv = 0;
        const t = window.setTimeout(() => {
            iv = window.setInterval(() => setI((k) => (k + 1) % pairs.length), hold * 1.5);
        }, hold * 2.4);
        return () => { window.clearTimeout(t); window.clearInterval(iv); };
    }, []);
    const m = pairs[i % pairs.length];
    /* 말은 처음부터 모여 서 있고(꼬리까지) 글만 제자리에서 옅게 나타난다(app.css · colorDemoIn) */
    return <DotBubble lines={lines} tone={tone} bg={m.bg} fg={m.text} still />;
}

/**
 * 색 룰렛(2026-09-29, 사용자 — 참고는 mastercard.com/businessoutcomes의 세로로 굴러가는
 * 숫자 창, 가져온 것은 그 굴러가는 방식 하나다). 짝 여덟을 트랙에 다 늘어놓던 것을 걷고,
 * 알약 창 하나에 **지금 짝 하나만** 세운다. 위아래로 쓸거나 오른쪽 ▲▼를 누르면 이웃
 * 짝이 위나 아래에서 굴러 들어와 한 짝에 멈춘다. 끝에서 처음으로 이어진다.
 *
 * **한 번의 손짓은 한 칸이다.** 옆으로 넘기던 트랙은 관성 스크롤이라 폰에서 가볍게
 * 튕겨도 여러 색을 건너뛰었다(사용자). 여기서는 끄는 거리를 창 한 칸으로 묶고, 놓으면
 * 속도와 상관없이 다음 · 이전 · 제자리 셋 중 하나로만 간다 — 한 칸의 4분의 1을 넘겨
 * 끌었으면 넘어가고, 아니면 돌아온다. 도는 중에 누른 것은 한 칸씩 차례로 가되 둘까지만
 * 기다린다(키를 누르고 있어도 끝없이 쌓이지 않게).
 *
 * 창은 [이전 · 지금 · 다음] 세 칸을 세로로 쌓은 띠를 한 칸만큼 올려 가운데를 보인다.
 * 돌 때는 띠를 한 칸 더 밀고, 다 가면 부모가 고른 짝을 바꾸며 띠를 가운데로 되돌린다 —
 * 같은 그림 안에서 일어나므로(useLayoutEffect) 튀지 않는다. 시간 · 곡선은 3/5 게이지가
 * 놓았을 때 붙는 값과 같다(--t-return · --ease-standard).
 */
function ColorRoll({ at, onPick, labelledBy, lang, pairs, stroke = false }: {
    at: number; onPick: (i: number) => void; labelledBy: string; lang: ReturnType<typeof useLang>; pairs: readonly ColorPair[];
    /** 획 처리(유머있는 = 비, 2026-10-04 디자이너) — 검은 알약에 색 테두리 · 색 이름. 비는 칠한 면도 짝 글자색도 없어 미리보기와 같은 모습으로 */
    stroke?: boolean;
}) {
    const win = useRef<HTMLDivElement>(null);
    const strip = useRef<HTMLDivElement>(null);
    const busy = useRef(false);
    const queued = useRef(0);
    const drag = useRef<{ y: number; dy: number } | null>(null);
    const atRef = useRef(at);
    atRef.current = at;
    const n = pairs.length;
    const wrap = (i: number) => ((i % n) + n) % n;
    const shift = (px: number) => `translateY(calc(${px}px - 100% / 3))`;
    const settle = () => {
        strip.current?.getAnimations().forEach((a) => a.cancel());
        if (strip.current) strip.current.style.transform = '';
        win.current?.classList.remove('is-rolling');
        busy.current = false;
        if (queued.current) {
            const d = Math.sign(queued.current) as 1 | -1;
            queued.current -= d;
            requestAnimationFrame(() => roll(d, 0));
        }
    };
    /* 부모가 짝을 바꾼 그림에서 띠를 가운데로 — 칠하기 전에 */
    useLayoutEffect(settle, [at]);
    function roll(dir: -1 | 0 | 1, from: number) {
        const el = strip.current;
        if (!el) return;
        busy.current = true;
        win.current?.classList.add('is-rolling');
        const root = getComputedStyle(document.documentElement);
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const a = el.animate(
            [{ transform: shift(from) }, { transform: `translateY(${-(1 + dir) * 100 / 3}%)` }],
            { duration: still ? 0 : tokenMs('--t-return', 220),
              easing: root.getPropertyValue('--ease-standard').trim() || 'ease-out', fill: 'forwards' });
        /* 새 짝에 멈추는 순간 짧게 운다 — 3/5 스위치 · 2/5 판이 칸을 넘을 때와 같은 진동(2026-09-29,
           사용자). 구를 때 흐리던 가장자리를 걷고 그 자리를 손끝이 받는다. 제자리로 돌아올 때는 울지 않는다 */
        a.finished.then(() => { if (dir) { tick(); onPick(wrap(atRef.current + dir)); } else settle(); }).catch(() => {});
    }
    const step = (dir: -1 | 1) => {
        if (busy.current || drag.current) { queued.current = Math.max(-2, Math.min(2, queued.current + dir)); return; }
        roll(dir, 0);
    };
    const pair = pairs[at];
    return <div className={'color-roll' + (stroke ? ' is-stroke' : '')}>
     <div ref={win} className="color-roll-window" role="spinbutton" tabIndex={0}
       aria-labelledby={labelledBy} aria-valuenow={at + 1} aria-valuemin={1} aria-valuemax={n}
       aria-valuetext={pick(pair.name, lang)}
       onKeyDown={(e) => {
           if (e.key === 'ArrowDown') { e.preventDefault(); step(1); }
           else if (e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
       }}
       onPointerDown={(e) => {
           if (busy.current) return;
           e.currentTarget.setPointerCapture(e.pointerId);
           drag.current = { y: e.clientY, dy: 0 };
       }}
       onPointerMove={(e) => {
           const d = drag.current;
           if (!d || !strip.current) return;
           const h = e.currentTarget.clientHeight;
           d.dy = Math.max(-h, Math.min(h, e.clientY - d.y));
           win.current?.classList.add('is-rolling');
           strip.current.style.transform = shift(d.dy);
       }}
       onPointerUp={(e) => {
           const d = drag.current;
           drag.current = null;
           if (!d) return;
           if (!d.dy) { settle(); return; }
           const q = e.currentTarget.clientHeight / 4;
           /* 손가락이 올라가면(띠가 위로) 아래의 다음 짝이 들어온다 */
           roll(d.dy <= -q ? 1 : d.dy >= q ? -1 : 0, d.dy);
       }}
       onPointerCancel={() => { const d = drag.current; drag.current = null; if (d) roll(0, d.dy); }}>
      <div ref={strip} className="color-roll-strip">
       {[-1, 0, 1].map((o) => {
           const m = pairs[wrap(at + o)];
           /* 창 안의 글자는 그 짝의 이름 — 바탕은 칠, 글자는 글자색. '가' 한 자였다(2026-09-29, 디자이너 — "실제 색 이름을") */
           return <div key={o} className="color-roll-item" style={stroke ? { color: m.bg } : { background: m.bg, color: m.text }} aria-hidden>
            {pick(m.name, lang)}</div>;
       })}
      </div>
     </div>
     <div className="color-roll-arrows">
      <button type="button" aria-label={pick(T.prevColour, lang)} onClick={() => step(-1)}>
       <svg viewBox="0 0 12 7" aria-hidden><path d="M6 0 12 7H0z" /></svg></button>
      <button type="button" aria-label={pick(T.nextColour, lang)} onClick={() => step(1)}>
       <svg viewBox="0 0 12 7" aria-hidden><path d="M0 0h12L6 7z" /></svg></button>
     </div>
    </div>;
}

export default function PhaseColor({ text, tone, onBack, onHome, onNext, returning = false }: Props) {
    const initial = messageColors(tone);
    const lang = useLang();
    /* 고른 짝 — 룰렛의 자리. 이 성격의 짝이 아니면(작업용 하늘색 · 다른 성격의 짝) 흰 짝 또는 첫 짝에서 시작한다(firstOf) */
    const PAIRS = colorsFor(tone.font);
    const [at, setAt] = useState(() => { const i = pairAt(PAIRS, initial.bg, initial.text); return i >= 0 ? i : firstOf(PAIRS); });
    const bg = PAIRS[at].bg;
    const fg = PAIRS[at].text;
    /* 모양 — 조정판의 둘째 잣대(2026-09-28). 전에 고른 값이 이 성격의 것이면 그것, 아니면 기본 */
    const ALIGNS = arrangementsFor(tone.font);
    const [align, setAlign] = useState<Align>(tone.align && ALIGNS.includes(tone.align) ? tone.align : defaultAlign(tone.font));
    const current = { ...tone, align, backgroundColor: bg, textColor: fg };
    // 줄은 한 줄 12자 — 모든 성격이 같다(fit.ts · foldLines)
    const lines = foldLines(text);
    /* 두 장(2026-09-28, 3/5와 같은 흐름): 'intro' = 설명과 시연 · 'work' = 고르는 장.
       moved는 한 번이라도 넘긴 뒤인지 — 처음 들어올 때는 둘째 장이 움직이지 않고 숨어 있다.
       첫 장은 앞으로 들어올 때만 선다(2026-09-29, 사용자) — 뒤로가기에서는 과정 미리보기가
       한 번도 나오지 않는다. 5/5에서 돌아오면 곧장 고르는 장이고, 고르는 장의 뒤로가기는
       첫 장이 아니라 3/5로 간다 */
    const [step, setStep] = useState<'intro' | 'work'>(returning ? 'work' : 'intro');
    const [moved, setMoved] = useState(false);
    const start = () => { setMoved(true); setStep('work'); };
    return <div className="z-frame compose-screen color-choice is-pulled"
      data-step={step} data-moved={moved ? '' : undefined} data-pair={PAIRS[at].id} data-pale={PALE.has(PAIRS[at].id) ? '' : undefined}
      style={{ '--pane-bg': bg, '--chrome-ink': fg } as CSSProperties}>
 {/* ── 첫 장: 무엇을 하는 자리인지 + 시연 (2026-09-28) ──────────────────
     3/5의 첫 장과 같은 흐름이다. 장 전체가 넘기는 손짓이되 버튼 위는 아니다
     (머리줄의 뒤로가기를 누른 탭이 넘김까지 돌리면 안 된다). 아래의 고르는
     장은 그대로 두고 이 장이 위를 덮는다 — 누르면 위로 빠지고 고르는 장이
     아래에서 올라온다(app.css · .color-intro). 뒤로 돌아온 길에는 이 장을 아예 달지
     않는다 — 숨긴 채 시연만 돌 까닭이 없다. */}
 {/* 위로 쓸어도 넘긴다(2026-10-21) — 3/5 첫 장과 같다 */}
 {!returning && <section className="color-intro" onClick={e => { if (!(e.target as HTMLElement).closest('button')) start(); }}
  onPointerDown={e => { e.currentTarget.dataset.swipeY = String(e.clientY); }}
  onPointerUp={e => { if (Number(e.currentTarget.dataset.swipeY) - e.clientY > 32) start(); }}>
  <StepHeader at={4} back={{ label: pick(T.back, lang), onClick: () => onBack(current) }} onHome={onHome} />
  <div className="z-ask">
   <h1>{pick(T.title, lang)}</h1>
   <p>{pick(T.lead, lang)}</p>
  </div>
  <div className="color-stage color-demo">
   {/* 늘 달아 둔다 — 넘길 때 위로 빠지는 장에 시연이 그대로 실려 간다 */}
   <ColorDemo lines={lines} tone={current} from={at} pairs={PAIRS} />
  </div>
  <button type="button" className="tone-more" onClick={start}>{pick(T.start, lang)}</button>
 </section>}
 <div className="proj-stage is-bleed"><div className="proj-fit">
  <div className="proj-frame compose-editor is-pulled">
   <StepHeader className="compose-chrome" at={4} back={{ label: pick(T.back, lang), onClick: () => onBack(current) }} onHome={onHome} />
   {/* 제목과 안내는 첫 장으로 옮겼다(2026-09-28) — 3/5처럼 고르는 장은 위가
       미리보기, 아래가 조정판이다. 무엇을 하는 자리인지는 첫 장이 말한다 */}
   <div className="color-stage">
    {/* 벽과 같은 말 — 모양을 고를 때마다 낱개부터 다시 모인다 */}
    <DotBubble lines={lines} tone={current} align={align} bg={bg} fg={fg} play={align} />
   </div>
  </div>
 </div></div>
 {/* ── 조정판 (2026-09-28) — 3/5와 같은 회색 판, [이름 | 잣대] 두 줄 ──────── */}
 <div className="tone-panel color-panel">
  {/* 배경과 글자가 한 짝이라 따로 고르지 않는다 — 창 하나가 그 짝을 통째로
      보여 준다(바탕은 배경색, 가운데 '가'는 글자색). 한 번에 한 짝(위 ColorRoll). */}
  <div className="tslider">
   <span className="tslider-name" id="color-name">{pick(T.colour, lang)}</span>
   <ColorRoll at={at} onPick={setAt} labelledBy="color-name" lang={lang} pairs={PAIRS} />
  </div>
  <div className="tslider">
   <span className="tslider-name" id="align-name">{pick(T.align, lang)}</span>
   {/* 3/5 말투 스위치와 같은 부품이다(2026-09-28, 사용자 — "3단계 UI를 적극 활용",
       같은 앱이니 같은 분위기) — 칸 수는 성격의 정렬 수(셋 또는 넷) */}
   <SnapSwitch labels={ALIGNS.map((a) => pick(alignWord(a), lang))} at={ALIGNS.indexOf(align)}
     onPick={(i) => setAlign(ALIGNS[i])} labelledBy="align-name" />
  </div>
  <button className="primary-action" onClick={() => onNext(current)}>{pick(T.next, lang)}</button>
 </div></div>;
}
