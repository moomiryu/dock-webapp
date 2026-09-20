import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import BackButton from '../components/BackButton';
import { MANNER, fontMap, hasWeightAxis, opticalFix, opticalStroke, variationFor } from '../lib/palettes';
import { DEFAULT_TONE, type PartialTone } from '../lib/tone';
import { foldLines } from '../lib/fit';

interface Props {
    /** 앞 화면들에서 쓰고 고른 것. 견본이 이제 내 글이다 */
    text: string;
    initialTone: PartialTone;
    onBack: (tone: PartialTone) => void;
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
 * 한 손 문제는 트랙을 짧게(350 → 220px) 하는 것만으로는 안 끝난다. 값이
 * **절대 위치**에 묶여 있는 한 손가락은 그 자리로 가야 한다. 그래서 잣대
 * 아래에 **끄는 면**을 따로 둔다 — 엄지가 닿는 아무 데나 눌러 좌우로 밀면
 * 민 만큼 값이 옮겨간다. 트랙은 지금 어디인지를 보여주는 눈금자가 되고,
 * 조작은 넓은 면이 받는다.
 *
 * ── 원본 비교 ─────────────────────────────────────────────────────────
 * '원본' 버튼을 **누르고 있는 동안만** 다듬기 전이 보인다. 토글이 아닌
 * 이유는 되돌아올 일이 없어서다 — 토글이면 원본을 보는 채로 잣대를 만지는
 * 사고가 난다. 손을 떼면 제자리라 편집값이 구조적으로 지켜진다.
 *
 * 견본을 길게 누르는 방식(사진 앱 여럿이 그렇다)은 안 썼다. 한 번 쓰고 마는
 * 물건이라 숨은 손짓은 아무도 못 찾는다. 버튼을 눈에 보이게 두고, 누르는
 * 동안 견본 위에 '원본' 표식이 떠서 지금 보는 것이 무엇인지 말한다.
 *
 * 원본의 기준은 **고른 성격의 기본값**이다(DEFAULT_TONE + font). 화면에
 * 들어온 시점이 아니다 — 조율에서 색으로 갔다가 뒤로 오면 그 시점 값이
 * 이미 제 편집값이라(PhaseGlyph가 initialTone을 그대로 넘긴다) '원본'을
 * 눌러도 아무 일이 안 일어난다. 움직이는 기준은 기준이 아니다.
 */

/**
 * 끄는 면에서 한 칸을 옮기는 데 미는 거리 (px).
 *
 * 잣대와 손끝 감각을 맞춘다 — 트랙이 220px에 칸 사이가 넷이라 한 칸이
 * 55px이다. 면에서도 같은 거리라야 두 곳을 오갈 때 손이 다시 배우지 않는다.
 */
const DRAG_STEP = 56;

/**
 * 큰 눈금 하나를 몇으로 쪼개는가.
 *
 * 눈금의 일은 셋이고 서로 달라야 한다: **가운데 금**(붉은 선)이 지금 값,
 * **표**(.tone-home)가 기본값, 나머지 눈금이 자리다. 그 나머지를 큰 것과
 * 잔 것으로 다시 갈라서, 칸이 바뀌는 자리와 그 사이를 구별한다.
 */
const MINOR = 4;


/* ─── 도구 아이콘 ────────────────────────────────────────────────────
   넷뿐이라 그림 없이 이름만으로도 되지만, 원형 버튼은 이름을 넣을 자리가
   좁다. 이름은 버튼 아래에 따로 적고 안쪽에는 표시만 둔다.

   글자를 그리지 않는다 — 여기 놓일 '가'는 지금 고른 서체로 그려야 맞는데,
   서체마다 굵기도 폭도 달라 넷이 한 줄에 서면 크기가 제각각이 된다.
   무엇을 만지는지를 **도형의 성질**로 말한다: 크기는 커지는 사각형,
   빠르기는 기운 획, 무게는 굵기가 다른 두 줄, 말투는 모난 것과 둥근 것. */
const ICON: Record<string, ReactNode> = {
  size: (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      {/* 작은 것과 큰 것. 둘을 붙여 놨더니 한 덩어리로 읽혀서, 작은 쪽은
          테두리만 남기고 사이를 벌렸다. */}
      <rect x="2.5" y="14" width="7" height="7" rx="1.4" fill="none" strokeWidth="1.8" />
      <rect x="13" y="3" width="8.5" height="18" rx="1.8" />
    </svg>
  ),
  tone: (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M13.4 3.5 8.2 20.5" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M19.4 3.5 16.6 20.5" strokeWidth="2" strokeLinecap="round" opacity=".45" />
      <path d="M6.2 3.5 4.6 20.5" strokeWidth="2" strokeLinecap="round" opacity=".45" />
    </svg>
  ),
  wght: (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <rect x="3" y="5" width="18" height="2.2" rx="1.1" />
      <rect x="3" y="11" width="18" height="3.6" rx="1.8" />
      <rect x="3" y="17.6" width="18" height="1.2" rx=".6" />
    </svg>
  ),
  manner: (
    <svg viewBox="0 0 24 24" aria-hidden focusable="false">
      <path d="M3.4 20.6 12 3.4l3.1 6.2" strokeWidth="2.2" fill="none" strokeLinejoin="round" />
      <circle cx="16.2" cy="16" r="5.2" />
    </svg>
  )
};

/** 견본 행간. 낱자 두 개('발화')일 때 쓰던 1은 문장에서 줄끼리 붙는다 */
const STAGE_LH = 1.4;
/** 견본이 제 자리에서 쓰는 몫 — 가로·세로(%). 나머지는 숨 쉴 여백이다 */
const USE = { w: 86, h: 88 };

/**
 * 세 축. 차례는 스케치를 따른다 — 크기 · 빠르기 · 무게.
 *
 * 2026-09-15 알약 슬라이더에서 눈금 다섯 칸 버튼으로 되돌렸다. 슬라이더는
 * 손잡이가 글자 위에 얹혀 슬라이더인지 버튼인지 읽히지 않았고, 값이 연속인
 * 대신 **지금 무슨 축을 만지는지**가 화면에서 사라졌다 — 손잡이를 조금만
 * 밀어도 가운데 글자가 축 이름('크기')에서 잣대 이름('작게')으로 바뀌어서다.
 *
 * 다섯 칸으로 되돌리되 칸 안에 글자를 넣지 않는다. 제일 긴 잣대 이름이
 * '아주 묵직하게'라 320 화면에서는 한 칸이 51px인데 그 글자가 안 들어간다.
 * 대신 칸은 점의 크기로 "왼쪽이 적고 오른쪽이 많다"만 말하고, 축 이름과
 * 지금 고른 칸의 이름은 그 위 한 줄이 늘 글자로 들고 있는다.
 *
 * '빠르기'는 장평이다. 천천히 말하면 글자가 옆으로 퍼지고(1.3),
 * 빠르게 말하면 좁아진다(0.7) — 그래서 이 축만 큰 값이 오른쪽 끝이다.
 */
const AXES = [
    {
        key: 'size', label: '크기',
        stops: [28, 36, 44, 52, 60],
        names: ['아주 작게', '작게', '보통', '크게', '아주 크게']
    },
    {
        key: 'tone', label: '빠르기',
        stops: [0.7, 0.85, 1, 1.15, 1.3],
        names: ['아주 빠르게', '빠르게', '보통', '천천히', '아주 천천히']
    },
    {
        key: 'wght', label: '무게',
        stops: [300, 400, 500, 600, 700],
        names: ['아주 가볍게', '가볍게', '보통', '묵직하게', '아주 묵직하게']
    }
] as const;

/**
 * 기울기는 이제 제 축이 아니다 — 빠르기가 함께 정한다.
 *
 * 정렬·기울기 버튼 둘이 따로 서 있었는데, 기울기는 '빠르게 말하기'와 같은
 * 것을 다른 손짓으로 두 번 묻고 있었다. 빠르게 말하면 글자가 좁아지고
 * (장평 0.7) 앞으로 기운다 — 한 동작이다. 그래서 빠른 쪽 두 칸에만 붙는다.
 *
 * 처음엔 12도·24도였는데 '빠르게'가 기운 티가 안 났다. 한 칸씩 올려
 * **빠르게 24도, 아주 빠르게 32도**로 둔다.
 *
 * 32도인 이유: 견본을 24·28·32·36·40도로 한 장에 놓고 골랐다. 36도부터는
 * ㅂ과 ㅎ의 세로획이 '기울어진 글꼴'이 아니라 '찌그러진 도형'으로 읽힌다.
 * 게다가 이 칸은 장평 0.7이 함께 걸려서 좁고 기운 글자가 되는데, 그건
 * 벽에서 멀리 볼 때 제일 불리한 조합이다. 32가 마지막으로 골격이 버티는
 * 자리였다.
 *
 * 값은 음수 skewX 시절의 부호를 그대로 쓴다(0 · -24 · -32). 이미 보낸 글의
 * -12는 VoiceBubble이 절댓값으로 읽으므로 12도로 그대로 뜬다.
 */
const slantFor = (tone: number) => (tone <= 0.75 ? -32 : tone <= 0.9 ? -24 : 0);

type Axis = (typeof AXES)[number];

/** 저장된 값이 눈금에 정확히 없을 수 있다 — 제일 가까운 칸으로 읽는다 */
const nearest = (stops: readonly number[], v: number) =>
    stops.reduce((best, s, i) => (Math.abs(s - v) < Math.abs(stops[best] - v) ? i : best), 0);

export default function PhaseTone({ text, initialTone, onBack, onNext }: Props) {
    const [tone, setTone] = useState<PartialTone>(initialTone);
    /** 'intro' = 설명하는 장 · 'work' = 조작하는 장 */
    const [step, setStep] = useState<'intro' | 'work'>('intro');
    /** 패널에서 지금 세워 둔 항목 */
    const [axis, setAxis] = useState('size');
    /** '원본'을 누르고 있는 중인가 */
    const [compare, setCompare] = useState(false);
    const lines = foldLines(text);
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
    /** 지금 견본에 보이는 것. '원본'을 누르고 있는 동안만 다듬기 전이 선다 */
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
        /* 미는 동안에는 재지 않는다. 이 함수는 의존성 배열이 없어 렌더마다
           도는데(그래야 마지막 크기에서 잰 값으로 수렴한다), 잣대를 미는
           동안에는 pointermove마다 렌더가 나므로 초당 60~120번 강제 리플로우가
           된다 — getComputedStyle·offsetWidth·offsetHeight 셋 다 "지금 당장
           배치를 다시 계산해"라는 읽기다. 손이 제일 오래 머무는 동작이
           제일 무거워진다.

           건너뛰어도 값이 안 틀린다: 미는 동안 바뀌는 것은 크기와 장평뿐이고
           둘 다 글자 **골격**을 안 바꾼다(아래 계산이 base로 나눠 정규화한다).
           손을 떼면 다시 재서 맞춘다. */
        if (drag) return;
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
    const byLine = ((USE.w / (shape.w * Math.max(1, shown.tone))) * fill).toFixed(2);
    const byHeight = ((USE.h / shape.h) * fill).toFixed(2);
    /**
     * 끌고 있는 축과 손가락이 지금 가 있는 자리(0~1).
     *
     * 손잡이는 손가락을 그대로 따라가고 값은 제일 가까운 눈금으로 붙는다.
     * 손을 떼면 이 상태가 사라지면서 손잡이가 그 눈금 자리로 미끄러진다 —
     * 자석이 당기는 것처럼 보이는 건 그 미끄러짐이다(CSS transition).
     * 끄는 동안에는 그 transition을 꺼야 손가락이 늦게 따라온다.
     */
    const [drag, setDrag] = useState<{ key: string; at: number } | null>(null);
    /** 한 축을 i번 눈금으로. '빠르기'는 기울기도 같이 가져간다 */
    const pick = (a: Axis, i: number) => {
        const v = a.stops[i];
        setTone(t => ({ ...t, [a.key]: v, ...(a.key === 'tone' ? { slnt: slantFor(v) } : null) }));
    };

    /**
     * 패널이 다루는 것들. 축 셋과 말투를 **한 꼴로** 세운다.
     *
     * 말투는 값이 둘뿐이고 잣대가 아니라 버튼이지만, 탭에서는 나머지와
     * 같은 항목이고 끄는 면에서도 같은 손짓으로 움직인다 — 다루는 방식이
     * 항목마다 다르면 '편집 도구'가 아니라 화면 모음이 된다.
     */
    const tools = [
        ...AXES.filter(a => a.key !== 'wght' || hasWeightAxis(tone.font)).map(a => ({
            key: a.key as string,
            label: a.label,
            names: a.names as readonly string[],
            at: nearest(a.stops, tone[a.key]),
            /** 고른 성격의 기본 자리. 여기서 얼마나 옮겼는지를 이걸로 잰다 */
            def: nearest(a.stops, DEFAULT_TONE[a.key]),
            set: (i: number) => pick(a, i),
            manner: false
        })),
        ...(MANNER[tone.font] ? [{
            key: 'manner',
            label: '말투',
            names: MANNER[tone.font].labels as readonly string[],
            at: tone.manner ? 1 : 0,
            def: DEFAULT_TONE.manner,
            set: (i: number) => setTone(t => ({ ...t, manner: i })),
            manner: true
        }] : [])
    ];
    /* 고른 항목이 없어질 수 있다 — 무게는 서체에 따라 있고 없다 */
    const cur = tools.find(t => t.key === axis) ?? tools[0];
    const last = cur.names.length - 1;

    /**
     * 끄는 면. 누른 자리를 0으로 삼고 **민 거리만큼** 값을 옮긴다.
     *
     * 절대 위치가 아니라 상대 이동이라, 엄지가 닿는 아무 데서나 시작해도
     * 된다 — 한 손 조작을 푸는 것이 이 한 가지다.
     */
    const grab = useRef<{ x: number; at: number } | null>(null);
    const padDown = (e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        grab.current = { x: e.clientX, at: cur.at };
        setDrag({ key: cur.key, at: cur.at });
    };
    const padMove = (e: React.PointerEvent) => {
        const g = grab.current;
        if (!g) return;
        /* 눈금은 **손가락을 그대로** 따라간다(소수점 자리). 값은 그중
           제일 가까운 눈금으로 붙는다. 둘을 갈라 놓아야 미는 동안 화면이
           손과 같이 가고, 손을 뗄 때 자석처럼 붙는 것이 보인다. */
        const raw = Math.min(last, Math.max(0, g.at + (e.clientX - g.x) / DRAG_STEP));
        setDrag({ key: cur.key, at: raw });
        const i = Math.round(raw);
        if (i !== cur.at) cur.set(i);
    };
    const padUp = () => { grab.current = null; setDrag(null); };

    /* 누르고 있는 동안만 원본. 손을 떼거나 손가락이 버튼 밖으로 나가면
       바로 편집값으로 돌아온다 — 원본을 본 채로 잣대를 만질 길이 없다.
       자판으로도 같다: 스페이스/엔터를 누르고 있는 동안만이다. */
    const holdKey = (down: boolean) => (e: React.KeyboardEvent) => {
        if (e.key !== ' ' && e.key !== 'Enter') return;
        e.preventDefault();
        setCompare(down);
    };

    /* --optical-stroke: 무게 축이 없는 서체(당당한·다정한)에 획으로 대신
       답한다. 축이 있는 서체는 '0'이라 아무 일도 일어나지 않는다(palettes.ts). */
    const face = {
        fontFamily: fontMap[shown.font], fontWeight: shown.wght,
        fontVariationSettings: variationFor(shown.font, shown.wght, shown.manner),
        transform: 'scaleX(' + shown.tone + ')',
        fontStyle: shown.slnt ? `oblique ${Math.abs(shown.slnt)}deg` : 'normal',
        fontSize: `calc(min(${byLine}cqw, ${byHeight}cqh) * ${optic})`,
        '--optical-stroke': opticalStroke(shown.font, shown.wght)
    } as CSSProperties;

    return <div className={'z-frame z1 tone-adjust' + (drag ? ' is-dragging' : '')}>
 <div className="tone-deck" data-step={step}>

  {/* ── 첫 장: 무엇을 하는 자리인지만 ───────────────────────────── */}
  {/* 장 전체가 넘기는 손짓이다. 다만 **버튼 위는 아니다** — 머리줄의
      뒤로가기가 이 안에 들어 있어서, 뒤로 가려고 누른 탭이 onBack과
      setStep을 같이 돌렸다. 되돌리려는 손짓이 진행 손짓을 겸하면 안 된다. */}
  <section className="tone-pane tone-intro"
    onClick={e => { if (!(e.target as HTMLElement).closest('button')) setStep('work'); }}>
   <div className="z-glyph-stage has-face">
    <div className="z-header">
     <BackButton label="성격 다시 고르기" onClick={() => onBack(tone)}/>
     <span className="z-step-of">3 / 5 · 조율</span>
    </div>
    {/* is-brief를 뺐다 — 그 규칙은 3초 뒤 제목을 저절로 접는다. 여기서는
        설명이 사라지는 계기가 **누르는 손**이어야 한다. '가'와 같이 간다. */}
    <div className="z-ask">
     <h1>전하고 싶은 느낌으로<br />조절해보세요</h1>
     <p>발화의 크기, 빠르기, {hasWeightAxis(tone.font) ? '무게' : '말투'}를 정해봐요.</p>
    </div>
    {/* 삽화 자리. 아직 그려지지 않았다 — 지금은 '가' 한 글자가 대신 선다. */}
    <div className="tone-figure" aria-hidden="true" style={{ fontFamily: fontMap[tone.font] }}>발화</div>
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
    <div className="z-header">
     <BackButton label="설명 다시 보기" onClick={() => setStep('intro')}/>
     <span className="z-step-of">3 / 5 · 조율</span>
    </div>
    {/* 보조 도구 행 — 되돌리기와 비교.
        편집 패널 안에 있었다. 만지는 자리(도구·눈금)와 되무르는 자리가
        한 덩어리로 보여서, 값을 고르다 말고 '되돌리기'를 잘못 누를 수
        있는 배치였다. **손대는 일과 되무르는 일을 위아래로 가른다.**

        되돌리기는 기본값일 때 사라지지 않고 **꺼진 채로 남는다.** 나타났다
        사라지면 그 자리에 있던 비교 버튼이 매번 옮겨 간다 — 자리가 움직이는
        버튼은 손이 외울 수 없다. */}
    <div className="tone-aux">
     <button type="button" className="tone-aux-btn" disabled={cur.at === cur.def}
       onClick={() => cur.set(cur.def)}>되돌리기</button>
     {/* 비교는 되돌리기와 **다른 일**이다. 누르고 있는 동안만 기본을 보여
         주고 손을 떼면 그대로 돌아온다 — 바꾼 것을 잃지 않는다.
         길게 누르기 어려운 사람을 위해 같은 버튼이 자판에서는 토글이다. */}
     <button type="button" className={'tone-aux-btn' + (compare ? ' on' : '')}
       aria-pressed={compare} aria-label="기본과 비교. 누르고 있는 동안 고른 성격의 기본 상태가 보입니다"
       onPointerDown={() => setCompare(true)} onPointerUp={() => setCompare(false)}
       onPointerLeave={() => setCompare(false)} onPointerCancel={() => setCompare(false)}
       onKeyDown={holdKey(true)} onKeyUp={holdKey(false)}>기본과 비교</button>
    </div>
    {/* 견본은 글자뿐이다. 도형은 색을 고르는 화면에서 처음 나온다.
        한 겹을 더 두른 것은 **자리를 재기 위해서다** — 머리줄을 뺀 나머지가
        견본의 몫인데, 칸 전체를 기준으로 삼으면 머리줄 높이만큼 넘친다. */}
    <div className="z-glyph-fit">
     <div ref={glyph} className={'z-glyph is-line' + (shown.slnt ? ' is-gust' : '')} style={face}>
      <span>{lines.map((l, i) => <b key={i} className="z-glyph-char">{l}</b>)}</span>
     </div>
     {/* 지금 보는 것이 무엇인지는 견본 위에서 말한다 — 버튼 쪽에서만 말하면
         눈은 견본에 가 있는데 답은 손 밑에 있다.

         견본칸 **안에** 둔다. 바깥(견본면)에 두고 위에서부터 픽셀로 세어
         내리던 때는, 머리줄 위에 보조 도구 행이 하나 더 생기자 그 셈이
         틀려 표가 버튼과 겹쳤다. 칸 안에 두면 무엇이 위에 몇 줄 있든
         언제나 견본 바로 위다. */}
     {compare && <span className="tone-orig-chip">기본 상태</span>}
    </div>
   </div>

   {/* ── 편집 패널 ─────────────────────────────────────────────────
       사진 보정 앱의 짜임을 따른다: 큰 미리보기를 보면서 **도구를 하나
       고르고**, 그 아래 한 자리에서 다듬는다. 도구가 셋뿐이라 숨기지 않고
       다 내놓는다.

       위에서 아래로 — 지금 만지는 것의 이름과 값 · 도구 셋 · 공통 조절
       영역. 조절 영역은 도구에 따라 눈금자이거나 말투 버튼 둘이고, 자리와
       높이가 같아서 도구를 옮겨도 화면이 흔들리지 않는다. */}
   <div className="tone-panel">
    {/* 여기에 '크기 / 보통' 두 줄이 있었다(2026-09-22 삭제). 같은 화면에
        '크기'가 셋이었다 — 되돌리기 버튼, 이 라벨, 도구 이름. 고른 도구의
        고리가 이미 이름을 말하므로 라벨은 중복이고, 값은 눈금자 밑으로
        내려가 조절하는 자리 옆에 선다(아래 .tone-ruler-value). */}

    {/* 도구 셋. 고른 것은 테두리와 채움으로, 기본에서 바꾼 것은 점으로
        따로 표시한다 — 색 하나에 두 가지 뜻을 얹지 않는다. */}
    <div className="tone-picks" role="tablist" aria-label="조절할 것">
     {/* 고리는 **하나**다. 도구를 바꾸면 그 원으로 미끄러져 간다 — 원마다
         고리를 켜고 끄면 선택이 사라졌다 다른 데서 생기는 것으로 읽힌다.
         한 고리가 옮겨가면 같은 선택이 이동한 것이다(transitions.dev의
         tabs-sliding과 같은 결). */}
     <i className="tone-ring" aria-hidden
       style={{ '--i': tools.findIndex(x => x.key === cur.key) } as CSSProperties} />
     {tools.map(x =>
       <button key={x.key} type="button" role="tab" aria-selected={x.key === cur.key}
         className={'tone-pick' + (x.key === cur.key ? ' on' : '') + (x.at !== x.def ? ' moved' : '')}
         onClick={() => setAxis(x.key)}>
         <span className="tone-dial">
           {ICON[x.key]}
           {x.at !== x.def && <i className="tone-moved" aria-hidden />}
         </span>
         <span className="tone-pick-name">{x.label}</span>
         {x.at !== x.def && <span className="sr-only">바뀜</span>}
       </button>
     )}
    </div>

    {/* 공통 조절 영역. 눈금자일 때는 값이 그 밑에 붙고, 말투일 때는
        버튼 둘 자체가 값이다. 어느 쪽이든 높이가 같아서 '다음'이 안 움직인다. */}
    <div className="tone-area">
    {cur.manner
      ? <div className="z-manner" role="group" aria-label="말투">
          {MANNER[tone.font].labels.map((name, i) =>
            <button key={i} type="button"
              className={'z-manner-btn' + (cur.at === i ? ' on' : '')}
              aria-pressed={cur.at === i}
              style={{ fontFamily: fontMap[tone.font],
                fontVariationSettings: MANNER[tone.font].axes[i] } as CSSProperties}
              onClick={() => cur.set(i)}>{name}</button>
          )}
        </div>
      : <div className="tone-dial-row">
          <button type="button" className="tone-step" aria-label={`${cur.label} 한 칸 줄이기`}
            disabled={cur.at === 0} onClick={() => cur.set(Math.max(0, cur.at - 1))}>−</button>
          {/* 눈금자. 가운데 금은 붙박이고 눈금이 좌우로 밀린다 — 손가락이
              화면 끝까지 갈 일이 없다. 어디를 잡아 끌어도 민 만큼 옮겨간다. */}
          <div className="tone-ruler" style={{ '--at': drag?.key === cur.key ? drag.at : cur.at } as CSSProperties}
            onPointerDown={padDown} onPointerMove={padMove} onPointerUp={padUp} onPointerCancel={padUp}>
            <span className="tone-ruler-line" aria-hidden />
            {cur.names.flatMap((_, i) => {
              const out = [
                <span key={`n${i}`} className="tone-notch" style={{ '--i': String(i) } as CSSProperties} aria-hidden>
                  {i === cur.def && <i className="tone-home" />}
                </span>
              ];
              /* 칸 사이를 넷으로 쪼갠 잔눈금. 값은 다섯 칸뿐이라 큰 눈금만
                 두면 화면이 56px씩 뚝뚝 건너뛰고, 미는 손과 눈금이 따로
                 논다. 잔눈금이 있으면 얼마나 왔는지가 이어져 보인다. */
              if (i < last) for (let j = 1; j < MINOR; j++)
                out.push(<span key={`t${i}-${j}`} className="tone-tick"
                  style={{ '--i': String(i + j / MINOR) } as CSSProperties} aria-hidden />);
              return out;
            })}
            <input type="range" className="tone-ruler-input" min={0} max={cur.names.length - 1} step={1}
              value={cur.at} aria-label={cur.label} aria-valuetext={cur.names[cur.at]}
              onChange={e => cur.set(Number(e.target.value))} />
          </div>
          <button type="button" className="tone-step" aria-label={`${cur.label} 한 칸 늘리기`}
            disabled={cur.at === last} onClick={() => cur.set(Math.min(last, cur.at + 1))}>+</button>
        </div>}
    {/* 값은 가운데 금 바로 아래 — 조절하는 자리와 읽는 자리가 붙는다.
        말투는 버튼 글자가 곧 값이라 여기 안 적는다. */}
    {!cur.manner && <span className="tone-ruler-value" aria-live="polite">{cur.names[cur.at]}</span>}
    </div>
   </div>

   <button className="primary-action" onClick={() => onNext(tone)}>다음</button>
  </section>

 </div></div>;
}
