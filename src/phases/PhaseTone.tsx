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

/* 되돌리기 — 글자였다가 아이콘이 됐다(2026-09-22). 같은 화면에서 '크기'가
   여러 번 읽히던 문제와, 되무르는 일이 만드는 일만큼 커 보이던 문제를
   한꺼번에 던다. 왼쪽으로 돌아가는 화살표 하나 — 무슨 항목을 되돌리는지는
   낭독되는 이름이 말한다('크기 되돌리기'). 아이콘은 20px이지만 누르는
   자리는 48px이다(.tone-revert). */
const REVERT = (
  <svg viewBox="0 0 24 24" aria-hidden focusable="false">
    <path d="M4.5 9.5h9.8a5.2 5.2 0 1 1 0 10.4H7.6" fill="none" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" />
    <path d="M8.6 4.8 3.8 9.5l4.8 4.7" fill="none" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
 * 빠르게 말하면 좁아진다(0.7).
 *
 * 방향을 뒤집었다(2026-09-24). 왼쪽이 '아주 빠르게'였는데, 다른 두 축은
 * 모두 오른쪽으로 갈수록 **더**(더 크게 · 더 묵직하게)라 이 축만 거꾸로
 * 읽혔다. 이제 오른쪽이 더 빠르다 — 칸이 오른쪽으로 갈수록 글자가 좁아지고
 * 빠른 쪽 두 칸(오른쪽 끝 둘)에서 기운다. 글자·값·기울기가 같이 뒤집히므로
 * 저장된 글은 그대로다: 값(장평)으로 저장되고 칸은 nearest가 값에서 찾는다.
 * 기본(1 · 보통)은 여전히 가운데 칸이다.
 */
const AXES = [
    {
        key: 'size', label: '크기',
        stops: [28, 36, 44, 52, 60],
        names: ['아주 작게', '작게', '보통', '크게', '아주 크게']
    },
    {
        key: 'tone', label: '빠르기',
        stops: [1.3, 1.15, 1, 0.85, 0.7],
        names: ['아주 천천히', '천천히', '보통', '빠르게', '아주 빠르게']
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
 * (장평 0.7) 앞으로 기운다 — 한 동작이다. 그래서 빠른 쪽 두 칸(오른쪽
 * 끝 둘)에만 붙는다.
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
    /** 견본을 눌러 기본 상태를 보고 있는가. 값을 만지면 편집값으로 돌아온다 */
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
    const byLine = ((USE.w / (shape.w * Math.max(1, shown.tone))) * fill).toFixed(2);
    const byHeight = ((USE.h / shape.h) * fill).toFixed(2);
    /** 한 축을 i번 칸으로. '빠르기'는 기울기도 같이 가져간다 */
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
            /* 비교 중에 값을 만지면 편집값으로 돌아온다 — 기본을 보는 채로
               잣대를 만지는 사고를 여기서 막는다(머리 주석 참조) */
            set: (i: number) => { setCompare(false); pick(a, i); },
            manner: false
        })),
        ...(MANNER[tone.font] ? [{
            key: 'manner',
            label: '말투',
            names: MANNER[tone.font].labels as readonly string[],
            at: tone.manner ? 1 : 0,
            def: DEFAULT_TONE.manner,
            set: (i: number) => { setCompare(false); setTone(t => ({ ...t, manner: i })); },
            manner: true
        }] : [])
    ];
    /* 고른 항목이 없어질 수 있다 — 무게는 서체에 따라 있고 없다 */
    const cur = tools.find(t => t.key === axis) ?? tools[0];
    const last = cur.names.length - 1;

    /**
     * 트랙 위의 손가락 — 누른 자리에서 **제일 가까운 칸**에 선다.
     *
     * 끌면 지나가는 칸마다 값이 따라오고, 손을 떼면 그 칸이다. 트랙이
     * 240px로 짧아 절대 위치라도 엄지 호 안에 다 들어온다(머리 주석).
     */
    const track = useRef<HTMLDivElement>(null);
    const slide = (e: React.PointerEvent) => {
        const el = track.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        /* 칸은 트랙을 last등분한 자리에 있다. 양 끝 칸은 반 칸 몫만 있으면
           집히므로 반올림으로 충분하다. */
        const i = Math.min(last, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * last)));
        if (i !== cur.at) cur.set(i);
    };
    const trackDown = (e: React.PointerEvent) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        slide(e);
    };
    const trackMove = (e: React.PointerEvent) => {
        if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
        slide(e);
    };

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
        fontFamily: fontMap[shown.font], fontWeight: shown.wght,
        fontVariationSettings: variationFor(shown.font, shown.wght, shown.manner),
        transform: 'scaleX(' + shown.tone + ')',
        fontStyle: shown.slnt ? `oblique ${Math.abs(shown.slnt)}deg` : 'normal',
        fontSize: `calc(min(${byLine}cqw, ${byHeight}cqh) * ${optic})`,
        '--optical-stroke': opticalStroke(shown.font, shown.wght)
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
    {/* 삽화 자리. 아직 그려지지 않았다 — 지금은 '발화' 두 글자가 대신
        서서 크기와 빠르기 축을 차례로 훑는다(app.css · toneDemo).
        연출은 전부 CSS에 있다: 여기서 상태를 만들지 않으므로 이 움직임이
        참여자가 고른 값에 닿을 길이 없다. */}
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
      <div ref={glyph} className={'z-glyph is-line' + (shown.slnt ? ' is-gust' : '')} style={face}>
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
   <div className="tone-panel">
    {/* 지금 만지는 것과 그 상태. 위계의 둘째 칸이다(미리보기 → **여기** →
        도구 → 다섯 칸 → 다음). 눈금자 밑에 있던 값을 여기로 올렸다 —
        항목 이름과 값이 떨어져 있으면 '무엇이 보통인지'를 눈이 이어야 한다.

        되돌리기가 이 줄 오른쪽 끝에 붙는다. 되무르는 대상이 바로 왼쪽에
        적혀 있어 무엇이 되돌아가는지가 자리로도 읽힌다. */}
    <div className="tone-now">
     <span className="tone-now-text">
      <span className="tone-now-name">{cur.label}</span>
      <span className="tone-now-value" aria-live="polite">{cur.names[cur.at]}</span>
     </span>
     {/* 기본값이면 되돌릴 것이 없다. **자리는 그대로 두고** 끈다 —
         나타났다 사라지는 버튼은 옆 것을 밀어 손이 자리를 못 외운다. */}
     <button type="button" className="tone-revert" disabled={cur.at === cur.def}
       aria-label={`${cur.label} 되돌리기`} onClick={() => cur.set(cur.def)}>{REVERT}</button>
    </div>

    {/* 도구 셋. 테두리도 고리도 없다(2026-09-22) — 원 테두리 위에 고리를
        한 겹 더 두르니 같은 것을 두 번 그리는 꼴이었고, 아래 다섯 칸까지
        더해 이 화면에만 둥근 테두리가 세 켜였다.

        고른 도구는 **아이콘 자리가 채워진다**(브랜드 면 + 흰 아이콘).
        안 고른 것은 면 없이 아이콘만. 바꾼 도구는 그것과 겹치지 않게
        작은 점으로 따로 말한다 — 채움 하나에 두 가지 뜻을 얹지 않는다. */}
    <div className="tone-picks" role="tablist" aria-label="조절할 것">
     {tools.map(x =>
       <button key={x.key} type="button" role="tab" aria-selected={x.key === cur.key}
         className={'tone-pick' + (x.key === cur.key ? ' on' : '')}
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

    {/* 공통 조절 영역. 다섯 칸 트랙이거나 말투 버튼 둘이고, 자리와 높이가
        같아서 도구를 옮겨도 '다음'이 안 움직인다. 값 글자는 위의 .tone-now로
        올라갔다 — 조절하는 자리 아래위로 글자가 겹치지 않는다. */}
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
      : /* 다섯 칸. 짧은 트랙 하나에 점 다섯이고, 칸마다 48px짜리 버튼이
           그 점을 덮는다 — 보이는 것은 작아도 손이 닿는 자리는 넉넉하다.
           트랙을 잡고 끌면 지나가는 칸마다 값이 따라오고 손을 떼면 제일
           가까운 칸에 선다(slide). */
        <div className="tone-track" ref={track} style={{ '--at': cur.at, '--last': last } as CSSProperties}
          onPointerDown={trackDown} onPointerMove={trackMove}>
          <span className="tone-track-line" aria-hidden />
          {/* 점은 버튼이 아니라 표식이다. 누르는 일은 트랙 하나가 받아
              제일 가까운 칸을 고른다 — 점마다 버튼을 두면 버튼 다섯이
              낭독기에서 트랙과 겹쳐 같은 것을 두 번 읽는다. */}
          {cur.names.map((_, i) =>
            <span key={i} className={'tone-stop' + (i === cur.at ? ' on' : '')}
              style={{ '--i': i } as CSSProperties} aria-hidden />
          )}
          {/* 진짜 입력은 트랙을 통째로 덮는다. 자판의 화살표키와 낭독기가
              이걸 잡는다 — ± 버튼을 걷어낸 자리를 여기가 받는다.
              손가락은 안 받는다(pointer-events: none): 네이티브 range는
              누른 자리로 값을 순간이동시키는데, 그 규칙과 위 버튼 다섯의
              규칙이 한 자리에서 부딪친다. */}
          <input type="range" className="tone-track-input" min={0} max={last} step={1}
            value={cur.at} aria-label={cur.label} aria-valuetext={cur.names[cur.at]}
            onChange={e => cur.set(Number(e.target.value))} />
        </div>}
    </div>

    {/* '다음'이 패널 안에 있다. 밖에 두면 패널과 버튼 사이에 흰 띠가 한 겹
        더 생겨, 이 화면에 색이 바뀌는 경계가 둘이 된다. 하나면 된다 —
        붉은 미리보기 / 회색 조작 영역. */}
    <button className="primary-action" onClick={() => onNext(tone)}>다음</button>
   </div>
  </section>

 </div></div>;
}
