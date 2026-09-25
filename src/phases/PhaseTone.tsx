import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import StepHeader from '../components/StepHeader';
import { MANNER, SIZE_WORDS, SPEED_WORDS, STOPS, WEIGHT_WORDS, fontMap, formFor, hasWeightAxis, legacyFields, opticalFix, sizeAt, sizePos, snap, stopAt } from '../lib/palettes';
import { DEFAULT_TONE, type PartialTone } from '../lib/tone';
import { foldLines } from '../lib/fit';

interface Props {
    /** 앞 화면들에서 쓰고 고른 것. 견본이 이제 내 글이다 */
    text: string;
    initialTone: PartialTone;
    onBack: (tone: PartialTone) => void;
    /** 초기 화면으로. 초안은 지우지 않는다 */
    onHome: () => void;
    onNext: (tone: PartialTone) => void;
}

/**
 * 03 조율 — 두 장이다.
 *
 * 한 장에 제목·설명·견본·축 셋을 다 올렸더니 처음 보는 사람에게 요소가
 * 너무 많았다. **설명하는 장과 조작하는 장을 가른다** — 첫 장은 무엇을
 * 하는 자리인지만 말하고, 누르면 화면이 통째로 위로 밀려 올라가며 견본과
 * 축이 올라온다.
 *
 * ── 여기에 말풍선은 없다 ──────────────────────────────────────────────
 * 한때 이 화면에 최대 영역 틀과 진짜 말풍선을 세워 봤다(2026-09-19).
 * 크기 축이 '얼마나 쓰는가'라는 것은 분명해졌지만, 축 셋을 만지는 화면에
 * 도형까지 올라오니 무엇을 조절하는 중인지가 흐려졌다. 말풍선은 **색을
 * 고르는 화면**에서 처음 나온다 — 거기서는 면이 주인공이라 도형이 제
 * 일을 한다.
 *
 * 그래서 여기 견본은 글자뿐이다. 크기·빠르기·무게가 글에 어떻게 얹히는지만
 * 보여준다.
 *
 * ── 아래는 편집 도구다 (2026-09-20) ──────────────────────────────────
 * 축 셋을 세로로 쌓아 두었었다. 한 손으로 못 쓰는 배치였다 — 트랙이 화면
 * 폭을 다 쓰고(350px) 맨 위 축의 왼쪽 끝이 오른손 엄지 회전 중심에서
 * 405px인데, 이 기기에서 편한 엄지 호가 409px이다. '아주 작게'를 고르려면
 * 쥔 손을 고쳐 잡아야 했고, 다른 손에 팸플릿이 있으면 그게 안 된다.
 * 축을 옮길 때마다 손가락이 96~98px씩, 끝에서 끝까지 194px 움직였다.
 *
 * 사진 보정 앱들이 푸는 방식으로 바꿨다. 아래를 **컨트롤 패널 하나**로
 * 묶고, 축은 탭으로 고르고, 한 번에 한 축만 세운다. 탭 바로 아래에 값과
 * 잣대가 붙으니 고르는 자리와 만지는 자리 사이가 194 → 80px이 된다.
 *
 * ── 다섯 칸으로 돌아왔다 (2026-09-22) ────────────────────────────────
 * 그 사이 잔눈금을 끼운 **눈금자**를 세우고 넓은 면으로 밀게 했었다. 값은
 * 다섯뿐인데 화면은 연속인 물건처럼 보였다 — 잔눈금 넷은 갈 수 없는 자리를
 * 그려 놓은 것이고, 밀어도 결국 다섯 중 하나에 붙는다. 보이는 것과 되는
 * 일이 달랐다.
 *
 * **짧은 트랙 하나에 점 다섯.** 누르면 그 칸이고, 끌면 제일 가까운 칸에
 * 선다. 트랙이 화면을 가로지르지 않고 가운데 240px에 모여 있어 엄지 호
 * 안에 다 들어온다 — 한 손 문제를 트랙 길이로 푼다. 칸마다 48px이라
 * 터치 영역은 겹치지도 좁지도 않다.
 *
 * ± 버튼은 걷어냈다. 트랙이 그만큼 짧아져야 가운데로 모이고, 한 칸씩
 * 옮기는 길은 자판 화살표에 그대로 남아 있다(숨은 range 입력).
 *
 * ── 기본과 비교 ───────────────────────────────────────────────────────
 * **견본을 누르면** 다듬기 전이 선다. 다시 누르면 돌아온다.
 *
 * 버튼이었다(누르고 있는 동안만). 버튼은 조절 영역 위에 한 줄을 더 차지
 * 했고, 보는 자리와 누르는 자리가 떨어져 있었다 — 눈은 견본에 가 있는데
 * 손은 그 아래를 눌렀다. 보는 것 자체를 누르게 하면 그 거리가 0이 된다.
 *
 * 토글이면 '기본을 보는 채로 잣대를 만지는 사고'가 난다고 적어 두었었다.
 * 그 사고는 **조절하면 편집값으로 돌아오게** 해서 막는다 — 값을 만진 순간
 * 비교는 끝나고 바뀐 결과가 바로 보인다. 손을 떼는 대신 만지는 것이
 * 돌아오는 계기다.
 *
 * 숨은 손짓이 되지 않게 견본 안에 낮은 목소리로 '눌러서 기본과 비교'를
 * 적어 둔다. 비교 중에는 그 자리에 '기본' 표가 대신 선다.
 *
 * 원본의 기준은 **고른 성격의 기본값**이다(DEFAULT_TONE + font). 화면에
 * 들어온 시점이 아니다 — 조율에서 색으로 갔다가 뒤로 오면 그 시점 값이
 * 이미 제 편집값이라(PhaseGlyph가 initialTone을 그대로 넘긴다) '원본'을
 * 눌러도 아무 일이 안 일어난다. 움직이는 기준은 기준이 아니다.
 */

/**
 * 누른 것으로 칠 손가락의 흔들림 한도 (px).
 *
 * 견본을 누르면 기본과 비교다. 그런데 화면을 쓸어 넘기거나 글자를 끌어
 * 고르려던 손짓도 pointerup으로 끝나므로, 움직인 거리가 이보다 크면
 * 누른 것으로 치지 않는다.
 */
const TAP_SLOP = 10;


/** 견본 행간. 낱자 두 개('발화')일 때 쓰던 1은 문장에서 줄끼리 붙는다 */
const STAGE_LH = 1.4;
/** 견본이 제 자리에서 쓰는 몫 — 가로·세로(%). 나머지는 숨 쉴 여백이다 */
const USE = { w: 86, h: 88 };

/**
 * 칸을 지날 때의 짧은 진동. 브라우저의 진동 기능이 있으면(안드로이드) 그걸 쓴다.
 *
 * 아이폰 사파리는 그 기능을 주지 않아 우회한다(사용자 결정, 2026-09-25).
 * iOS 18부터 사파리는 켜기/끄기 스위치(checkbox switch)가 바뀔 때 짧게
 * 진동하므로, 화면에 안 보이는 스위치 하나를 두고 칸을 지날 때마다 대신
 * 누른다. 정식 기능이 아니다 — 애플이 막거나 그 전 iOS면 조용히 안 울리고,
 * 조작은 그대로 된다. 스위치는 머리(head)에 두어 앱의 어떤 칸에도 닿지 않는다.
 */
let hiddenSwitch: HTMLLabelElement | null = null;
function tick() {
    if (typeof navigator === 'undefined') return;
    if ('vibrate' in navigator) { navigator.vibrate(8); return; }
    try {
        if (!hiddenSwitch) {
            hiddenSwitch = document.createElement('label');
            hiddenSwitch.setAttribute('aria-hidden', 'true');
            hiddenSwitch.style.display = 'none';
            const input = document.createElement('input');
            input.type = 'checkbox';
            input.setAttribute('switch', '');
            input.tabIndex = -1;
            hiddenSwitch.appendChild(input);
            document.head.appendChild(hiddenSwitch);
        }
        hiddenSwitch.click();
    } catch { /* 못 울려도 조작은 그대로 */ }
}

/**
 * 막대 하나 — 끊김 없이 흐른다(2026-09-25, 작업 지침 8번).
 *
 * 5칸 버튼 줄이던 것을 연속 막대로 바꿨다. 모든 값이 세 지점 사이를
 * 이어서 변하고(palettes.ts · formFor), 오른쪽 위의 말만 가장 가까운 지점의
 * 것을 따른다. 숫자는 보이지 않는다.
 *
 * 브라우저의 range 입력을 그대로 쓰고 모양만 바꾼다 — 끌기·누른 자리로
 * 옮기기·자판의 화살표·낭독기가 전부 따라온다. 막대는 1px 선, 세 지점에
 * 짧은 눈금, 손잡이는 16px 원: 가만히 있을 때 채워져 있고 누르는 동안에는
 * 테두리만 남는다(반전). 누르는 자리는 막대 전체 높이 44px이다.
 */
function Slider({ name, words, value, onChange }: {
    name: string; words: readonly string[]; value: number; onChange: (v: number) => void;
}) {
    /* 다섯 칸(2026-09-25, 작업 지침 13번). 끄는 동안은 부드럽게 흐르고, 손을
       떼면 가장 가까운 칸에 붙는다. 오른쪽 위의 말은 늘 손잡이가 있는 칸의
       말이다. 칸을 지날 때마다 짧게 진동한다(tick — 아이폰은 우회).

       옮기는 동안 손잡이는 속이 빈 원이다. 폰에서는 손가락으로 끄는 동안
       :active가 유지되지 않는 브라우저가 있어 '옮기는 중'을 직접 적는다. */
    const [moving, setMoving] = useState(false);
    const live = useRef(value);
    live.current = value;
    const lastStop = useRef(stopAt(value));
    const move = (v: number) => {
        const i = stopAt(v);
        if (i !== lastStop.current) {
            lastStop.current = i;
            tick();
        }
        onChange(v);
    };
    const release = () => {
        setMoving(false);
        const snapped = snap(live.current);
        lastStop.current = stopAt(snapped);
        if (snapped !== live.current) onChange(snapped);
    };
    /* 자판은 칸 단위로 — 화살표 한 번에 한 칸 */
    const key = (e: React.KeyboardEvent) => {
        const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
        const edge = e.key === 'Home' ? 0 : e.key === 'End' ? STOPS - 1 : null;
        if (step === undefined && edge === null) return;
        e.preventDefault();
        const i = edge ?? Math.min(STOPS - 1, Math.max(0, stopAt(live.current) + step!));
        lastStop.current = i;
        onChange(i / (STOPS - 1));
    };
    const word = words[stopAt(value)];
    return <div className="tslider">
     <div className="tslider-lab">
      <span className="tslider-name">{name}</span>
      <span className="tslider-word" aria-hidden>{word}</span>
     </div>
     <div className={'tslider-track' + (moving ? ' is-moving' : '')}>
      {/* 막대 선은 첫 눈금에서 시작해 끝 눈금에서 끝난다 — 옆으로 삐져나오지
          않고 끝은 직각이다. 손잡이 가운데가 그 두 끝 사이를 오간다.
          --at까지가 지나온 막대, 그 뒤가 남은 막대(색은 app.css) */}
      <i className="tslider-line" style={{ '--at': value } as CSSProperties} aria-hidden />
      {Array.from({ length: STOPS }, (_, i) =>
        <i key={i} className="tslider-tick" style={{ '--p': i / (STOPS - 1) } as CSSProperties} aria-hidden />)}
      <input type="range" min={0} max={1000} step={1} value={Math.round(value * 1000)}
        aria-label={name} aria-valuetext={word}
        onPointerDown={() => setMoving(true)} onPointerUp={release} onPointerCancel={release}
        onTouchStart={() => setMoving(true)} onTouchEnd={release} onTouchCancel={release}
        onKeyDown={key} onBlur={() => setMoving(false)}
        onChange={e => move(Number(e.target.value) / 1000)} />
     </div>
    </div>;
}

/**
 * 말투 — 맞닿은 네모 두 칸, 말은 칸 바깥 양옆(R12, 2026-09-25).
 * `온화한 [ | ] 예리한`. 켜고 끄기가 아니라 대등한 둘이다 — 고른 칸은 채우고
 * 반대쪽은 칸의 선과 말이 옅어진다. 버튼 하나가 말과 칸을 함께 품어서 말을
 * 눌러도 칸을 눌러도 고른다. 말에는 그 말투의 글자 모양을 입힌다.
 */
function MannerSwitch({ font, at, onPick }: { font: string; at: number; onPick: (i: number) => void }) {
    const m = MANNER[font];
    return <div className="tslider">
     <div className="tslider-lab">
      <span className="tslider-name" id="tswitch-name">말투</span>
      <span className="tslider-word" aria-hidden>{m.labels[at ? 1 : 0]}</span>
     </div>
     <div className="tswitch" role="radiogroup" aria-labelledby="tswitch-name">
      {m.labels.map((label, i) =>
        <button key={i} type="button" role="radio" aria-checked={(at ? 1 : 0) === i}
          className={'tswitch-side' + ((at ? 1 : 0) === i ? ' on' : '')}
          onClick={() => onPick(i)}>
          <span className="tswitch-word"
            style={{ fontFamily: fontMap[font], fontVariationSettings: m.axes[i] } as CSSProperties}>{label}</span>
          <i className="tswitch-cell" aria-hidden />
        </button>)}
     </div>
    </div>;
}

export default function PhaseTone({ text, initialTone, onBack, onHome, onNext }: Props) {
    /* 막대 자리가 없는 초안(슬라이더 전에 만든 것)은 가운데('보통')에서 시작한다 */
    const [tone, setTone] = useState<PartialTone>(() => {
        const t = { ...initialTone, speed: initialTone.speed ?? 0.5, weight: initialTone.weight ?? 0.5 };
        return { ...t, ...legacyFields(t) };
    });
    /** 'intro' = 설명하는 장 · 'work' = 조작하는 장 */
    const [step, setStep] = useState<'intro' | 'work'>('intro');
    /** 견본을 눌러 기본 상태를 보고 있는가. 값을 만지면 편집값으로 돌아온다 */
    const [compare, setCompare] = useState(false);
    const lines = foldLines(text);

    /**
     * 첫 장면의 견본 — '발화' 두 글자였던 자리에 **내 글**이 선다(2026-09-25).
     *
     * 시연(toneDemo)이 크기를 1.18배까지, 폭을 1.3배까지 늘린다. 가장 커지는
     * 순간에도 칸 밖으로 나가지 않는 크기를 **재서** 정한다: 줄마다 그린 폭 ×
     * 1.3이 칸 폭에, 줄 수 × 행간 × 1.18이 칸 높이에 들어와야 한다. 짧은 글이
     * 한없이 커지지 않게 '발화' 때의 크기(칸 폭 46% · 화면 높이 28%)를 위
     * 한도로 둔다. 줄은 벽의 줄 접기(foldLines)가 정한 그대로다.
     */
    const figure = useRef<HTMLDivElement>(null);
    const figText = useRef<HTMLSpanElement>(null);
    const [fig, setFig] = useState<number | null>(null);
    const [refit, setRefit] = useState(0);
    useEffect(() => {
        const again = () => setRefit((n) => n + 1);
        window.addEventListener('resize', again);
        void document.fonts?.ready.then(again);
        return () => window.removeEventListener('resize', again);
    }, []);
    /* 안전장치: 같은 조건에서 고쳐 잡는 것은 세 번까지. 정상이면 첫 번에 끝난다 */
    const figTries = useRef({ key: '', n: 0 });
    useLayoutEffect(() => {
        const box = figure.current;
        const span = figText.current;
        if (!box || !span) return;
        const key = `${text}|${tone.font}|${refit}`;
        if (figTries.current.key !== key) figTries.current = { key, n: 0 };
        if (figTries.current.n >= 3) return;
        const fs = parseFloat(getComputedStyle(span).fontSize);
        const W = box.clientWidth;
        const H = box.clientHeight;
        if (!fs || !W || !H) return;
        // 글자 크기 1px당 폭·높이 — 시연이 걸어 둔 배율(scale)은 offset 값에 안 들어간다
        const perW = span.offsetWidth / fs;
        const perH = span.offsetHeight / fs;
        if (!perW || !perH) return;
        const cap = Math.min(W * 0.46, window.innerHeight * 0.28);
        const next = Math.min(cap, (W * 0.97) / (perW * 1.3), (H * 0.97) / (perH * 1.18));
        if (fig === null || Math.abs(next - fig) / next > 0.01) { figTries.current.n += 1; setFig(next); }
    }, [text, tone.font, refit, fig]);
    const longest = Math.max(1, ...lines.map((l) => Array.from(l).length));
    /**
     * 견본 크기 — **제 자리를 재서 정한다.**
     *
     * 세로 몫을 150px이라는 **적어 둔 숫자**로 잡고 있었다(2026-09-20에
     * 재서 알았다). 실제 칸은 398px이라, 몇 줄이든 그 3분의 1짜리 가상의
     * 칸에 욱여넣고 있었다 — 60자짜리 긴 글이 15.7px까지 내려앉아 읽히지
     * 않았고, 칸의 28%만 쓰고 나머지는 빈 채였다. 이제 cqh로 칸에게
     * 직접 묻는다(.z-glyph-fit이 container-type: size를 들고 있다).
     *
     * 크기 축은 그대로 곱한다 — '얼마를 쓸 것인가'가 이 축의 뜻이고,
     * 그 몫이 칸에 대한 비율이라야 벽에서도 같은 값이 된다(fit.ts).
     *
     * 장평은 **가로에만** 건다. scaleX는 세로를 건드리지 않는데 그동안
     * 세로 쪽을 나누고 있었다. 좁아지는 쪽(0.7·0.85)은 나누지 않는다 —
     * 그 두 칸에는 기울기가 함께 붙어서, 좁아진 만큼을 기운 획이 도로
     * 가져간다.
     */
    /** 지금 견본에 보이는 것. 비교 중일 때만 다듬기 전이 선다 */
    const shown = compare ? { ...DEFAULT_TONE, font: tone.font } : tone;
    const fill = shown.size / 60;
    /**
     * 제일 긴 줄이 **글자 크기 1px당 몇 px인가.** 재서 안다.
     *
     * 여기 있던 계산은 한 글자를 1em으로 쳤다(USE.w / 글자수). 실제로는
     * 재 보니 0.51~0.81em이라 — 서체마다 다르다 — '아주 크게'가 칸의
     * 44~69%밖에 안 썼고, 같은 '아주 크게'인데 당당한과 다정한이 한눈에
     * 다른 크기였다(390 화면 실측: 153px 대 243px).
     *
     * 자폭은 서체만이 아니라 **말투(가변 축)와 무게와 글자 자체**가 정한다.
     * 넷을 표로 들고 있으면 서체가 갈릴 때마다 그 표가 낡는다 — 실제로
     * 2026-09-20에 서체 넷이 통째로 갈렸다. 그래서 적어 두지 않고 그려진
     * 것을 잰다. 자폭은 크기에 정비례하므로 한 번 재면 끝이고(1px당 값),
     * 1%보다 적게 달라진 재기는 버려서 다시 그리지 않는다.
     */
    const glyph = useRef<HTMLDivElement>(null);
    const optic = opticalFix[shown.font]?.scale ?? 1;
    const [run, setRun] = useState<{ w: number; h: number } | null>(null);
    useLayoutEffect(() => {
        const el = glyph.current;
        if (!el) return;
        /* **바탕 크기**로 나눈다. 최종 크기에는 서체별 잉크 보정(optic)이
           이미 곱해져 있는데, 아래 계산은 그 보정을 곱하기 **전**의 값을
           내놓기 때문이다. 같은 자리에서 재야 셈이 딱 맞는다. */
        const base = parseFloat(getComputedStyle(el).fontSize) / optic;
        if (!base) return;
        /* offsetWidth·offsetHeight는 배치 값이라 scaleX(빠르기)가 안 들어간다 —
           장평은 아래에서 따로 나눈다. */
        let w = 0;
        el.querySelectorAll<HTMLElement>('.z-glyph-char').forEach((b) => { w = Math.max(w, b.offsetWidth); });
        const next = { w: w / base, h: el.offsetHeight / base };
        const off = (a: number, b: number) => !b || Math.abs(a - b) / a > 0.01;
        if (next.w > 0 && (!run || off(next.w, run.w) || off(next.h, run.h))) setRun(next);
    });
    /* 아직 한 번도 못 쟀으면 옛 어림값(한 글자 = 1em)으로 그린다. 그 한
       프레임 뒤에 잰 값으로 다시 선다. */
    const shape = run ?? { w: longest, h: lines.length * STAGE_LH };
    /* 장평·기울기로 넓어진 글이 칸을 넘을 때만, 넘지 않을 만큼 줄인다
       (2026-09-25, 사용자 결정 — 안 잘리게, 유동적으로). 넘지 않으면 고른
       크기 그대로다. 넓어진 폭 = 줄 폭 × 장평 + 기울기가 밀어낸 몫(1em × tan).
       세로 비율은 1 이하라 높이는 늘 들어온다. */
    const form = formFor(shown);
    const tanS = Math.tan((form.slant * Math.PI) / 180);
    const byLine = Math.min((USE.w / shape.w) * fill, USE.w / (shape.w * form.scaleX + tanS)).toFixed(2);
    const byHeight = ((USE.h / shape.h) * fill).toFixed(2);
    /**
     * 막대를 옮긴다. 비교 중이었으면 편집값으로 돌아온다 — 기본을 보는 채로
     * 막대를 만지는 사고를 막는다. 옛 칸(tone · slnt · wght)도 함께 적어 둔다
     * (palettes.ts · legacyFields).
     */
    const set = (patch: Partial<PartialTone>) => {
        setCompare(false);
        setTone(t => { const n = { ...t, ...patch }; return { ...n, ...legacyFields(n) }; });
    };
    const speed = tone.speed ?? 0.5;
    const weight = tone.weight ?? 0.5;

    /**
     * 견본을 눌러 기본과 비교. 토글이다 — 한 번 누르면 기본, 다시 누르면
     * 편집값. 쓸어 넘기거나 글자를 끌어 고르려던 손짓은 누른 것으로 치지
     * 않는다(TAP_SLOP).
     */
    const tap = useRef<{ x: number; y: number } | null>(null);
    const faceDown = (e: React.PointerEvent) => { tap.current = { x: e.clientX, y: e.clientY }; };
    const faceUp = (e: React.PointerEvent) => {
        const t = tap.current;
        tap.current = null;
        if (!t) return;
        if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > TAP_SLOP) return;
        setCompare(c => !c);
    };
    /* 자판·스위치·낭독기도 같은 토글을 쓴다 */
    const faceKey = (e: React.KeyboardEvent) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        setCompare(c => !c);
    };

    /* --optical-stroke: 무게 축이 없는 서체(당당한·다정한)에 획으로 대신
       답한다. 축이 있는 서체는 '0'이라 아무 일도 일어나지 않는다(palettes.ts). */
    const face = {
        fontFamily: fontMap[shown.font], fontWeight: form.weight,
        fontVariationSettings: form.variation,
        transform: `scale(${form.scaleX.toFixed(3)}, ${form.scaleY.toFixed(3)})`,
        fontStyle: form.slant ? `oblique ${form.slant.toFixed(1)}deg` : 'normal',
        letterSpacing: form.letterSpacing,
        fontSize: `calc(min(${byLine}cqw, ${byHeight}cqh) * ${optic})`,
        '--optical-stroke': form.stroke
    } as CSSProperties;

    return <div className="z-frame z1 tone-adjust">
 <div className="tone-deck" data-step={step}>

  {/* ── 첫 장: 무엇을 하는 자리인지만 ───────────────────────────── */}
  {/* 장 전체가 넘기는 손짓이다. 다만 **버튼 위는 아니다** — 머리줄의
      뒤로가기가 이 안에 들어 있어서, 뒤로 가려고 누른 탭이 onBack과
      setStep을 같이 돌렸다. 되돌리려는 손짓이 진행 손짓을 겸하면 안 된다. */}
  <section className="tone-pane tone-intro"
    onClick={e => { if (!(e.target as HTMLElement).closest('button')) setStep('work'); }}>
   <div className="z-glyph-stage has-face">
    <StepHeader at={3} back={{ label: '성격 다시 고르기', onClick: () => onBack(tone) }} onHome={onHome} />
    {/* is-brief를 뺐다 — 그 규칙은 3초 뒤 제목을 저절로 접는다. 여기서는
        설명이 사라지는 계기가 **누르는 손**이어야 한다. '가'와 같이 간다. */}
    <div className="z-ask">
     <h1>전하고 싶은 느낌으로<br />조절해보세요</h1>
     <p>발화의 크기, 속도, {hasWeightAxis(tone.font) ? '무게' : '말투'}를 정해봐요.</p>
    </div>
    {/* 삽화 자리. 아직 그려지지 않았다 — 지금은 '발화' 두 글자가 대신
        서서 크기와 빠르기 축을 차례로 훑는다(app.css · toneDemo).
        연출은 전부 CSS에 있다: 여기서 상태를 만들지 않으므로 이 움직임이
        참여자가 고른 값에 닿을 길이 없다. */}
    <div ref={figure} className="tone-figure" aria-hidden="true"
      style={{ fontFamily: fontMap[tone.font], ...(fig ? { '--fig': `${fig.toFixed(1)}px` } : null) } as CSSProperties}>
     <span ref={figText} className="tone-figure-text">{lines.join('\n')}</span>
    </div>
    {/* 글자였다. 그러면 이 장에서 **앞으로 가는 길이 손가락뿐**이라
        자판·스위치·낭독기를 쓰는 사람은 03에 들어와 빠져나갈 수가 없었다
        (탭을 눌러 보면 뒤로가기 하나를 지나 안 보이는 둘째 장으로 굴러
        떨어졌다). 보이는 모습은 그대로 두고 버튼으로 바꾼다 — 이름은
        화면에 적힌 그 문장이어야 한다(눈에 보이는 글자와 낭독되는 이름이
        어긋나면 음성으로 조작하는 사람이 부를 이름을 잃는다). */}
    <button type="button" className="tone-more" onClick={() => setStep('work')}>화면을 누르면 시작해요</button>
   </div>
  </section>

  {/* ── 둘째 장: 견본과 편집 패널 ──────────────────────────────── */}
  <section className="tone-pane tone-work">
   <div className="z-glyph-stage has-face">
    <StepHeader at={3} back={{ label: '설명 다시 보기', onClick: () => setStep('intro') }} onHome={onHome} />
    {/* 견본은 글자뿐이다. 도형은 색을 고르는 화면에서 처음 나온다.
        한 겹을 더 두른 것은 **자리를 재기 위해서다** — 머리줄을 뺀 나머지가
        견본의 몫인데, 칸 전체를 기준으로 삼으면 머리줄 높이만큼 넘친다.

        **이 칸 자체가 누르는 자리다**(기본과 비교). 위에 있던 보조 도구 행
        둘은 없어졌다 — 비교는 보는 것에 얹혔고, 되돌리기는 아래 패널에서
        지금 항목 옆에 선다. */}
    <div className="tone-face" role="button" tabIndex={0} aria-pressed={compare}
      aria-label={compare ? '기본 상태를 보는 중. 눌러서 편집한 상태로 돌아가기' : '눌러서 기본과 비교'}
      onPointerDown={faceDown} onPointerUp={faceUp}
      onPointerCancel={() => { tap.current = null; }} onKeyDown={faceKey}>
     <div className="z-glyph-fit">
      <div ref={glyph} className={'z-glyph is-line' + (form.slant ? ' is-gust' : '')} style={face}>
       <span>{lines.map((l, i) => <b key={i} className="z-glyph-char">{l}</b>)}</span>
      </div>
     </div>
     {/* 견본 아래 **제 줄**이다. 겹쳐 띄우던 때는 320 화면에서 글자와 12px
         까지 붙었고, 표의 아랫선이 색 경계에 0px으로 닿았다 — 겹치지 않은
         것이지 자리가 있는 것이 아니었다. 줄로 두면 견본칸이 그만큼 줄고
         (cqh로 재므로 글자 크기가 저절로 따라온다) 어느 화면에서도 위아래가
         같은 여백을 갖는다.

         한 자리에서 둘이 번갈아 선다: 편집 중이면 **안내**(낮은 목소리),
         비교 중이면 **'기본'**(또렷한 표). 자리가 안 옮겨 다니므로 눈이
         한 곳만 본다. */}
     <div className="tone-face-foot">
      {compare
        ? <span className="tone-orig-chip">기본</span>
        : <span className="tone-compare-hint" aria-hidden>눌러서 기본과 비교</span>}
     </div>
    </div>
   </div>

   {/* ── 편집 패널 ─────────────────────────────────────────────────
       사진 보정 앱의 짜임을 따른다: 큰 미리보기를 보면서 **도구를 하나
       고르고**, 그 아래 한 자리에서 다듬는다. 도구가 셋뿐이라 숨기지 않고
       다 내놓는다.

       위에서 아래로 — 지금 만지는 것의 이름과 값 · 도구 셋 · 공통 조절
       영역. 조절 영역은 도구에 따라 눈금자이거나 말투 버튼 둘이고, 자리와
       높이가 같아서 도구를 옮겨도 화면이 흔들리지 않는다. */}
   {/* ── 편집 패널 ─────────────────────────────────────────────────
       막대 셋을 한꺼번에 세운다(2026-09-25, 배치 A). 크기 · 속도, 그리고 무게
       (차분한·다정한) 또는 말투 스위치(당당한·유머있는). 도구를 골라 하나씩
       만지던 탭은 걷었다. 작은 화면(320)에서는 이 판이 줄지 않고 위의 견본
       칸이 줄어든다(견본 칸은 남는 자리를 받는다). */}
   <div className="tone-panel">
    <Slider name="크기" words={SIZE_WORDS} value={sizePos(tone.size)}
      onChange={v => set({ size: +sizeAt(v).toFixed(2) })} />
    <Slider name="속도" words={SPEED_WORDS[tone.font] ?? SIZE_WORDS} value={speed}
      onChange={v => set({ speed: v })} />
    {hasWeightAxis(tone.font)
      ? <Slider name="무게" words={WEIGHT_WORDS} value={weight} onChange={v => set({ weight: v })} />
      : <MannerSwitch font={tone.font} at={tone.manner ?? 0} onPick={i => set({ manner: i })} />}

    {/* '다음'이 패널 안에 있다. 밖에 두면 패널과 버튼 사이에 흰 띠가 한 겹
        더 생겨, 이 화면에 색이 바뀌는 경계가 둘이 된다. 하나면 된다 —
        붉은 미리보기 / 회색 조작 영역. */}
    <button className="primary-action" onClick={() => onNext(tone)}>다음</button>
   </div>
  </section>

 </div></div>;
}
