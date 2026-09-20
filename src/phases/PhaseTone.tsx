import { useState, type CSSProperties } from 'react';
import BackButton from '../components/BackButton';
import { MANNER, fontMap, hasWeightAxis, opticalFix, opticalStroke, variationFor } from '../lib/palettes';
import { type PartialTone } from '../lib/tone';
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
 */

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
    const fill = tone.size / 60;
    const byLine = ((USE.w / longest) * fill / Math.max(1, tone.tone)).toFixed(2);
    const byHeight = ((USE.h / (lines.length * STAGE_LH)) * fill).toFixed(2);
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

    /* --optical-stroke: 무게 축이 없는 서체(당당한·다정한)에 획으로 대신
       답한다. 축이 있는 서체는 '0'이라 아무 일도 일어나지 않는다(palettes.ts). */
    const face = {
        fontFamily: fontMap[tone.font], fontWeight: tone.wght,
        fontVariationSettings: variationFor(tone.font, tone.wght, tone.manner),
        transform: 'scaleX(' + tone.tone + ')',
        fontStyle: tone.slnt ? `oblique ${Math.abs(tone.slnt)}deg` : 'normal',
        fontSize: `calc(min(${byLine}cqw, ${byHeight}cqh) * ${opticalFix[tone.font]?.scale ?? 1})`,
        '--optical-stroke': opticalStroke(tone.font, tone.wght)
    } as CSSProperties;

    return <div className="z-frame z1 tone-adjust">
 <div className="tone-deck" data-step={step}>

  {/* ── 첫 장: 무엇을 하는 자리인지만 ───────────────────────────── */}
  <section className="tone-pane tone-intro" onClick={() => setStep('work')}>
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
    <div className="tone-figure" aria-hidden="true" style={{ fontFamily: fontMap[tone.font] }}>가</div>
    <span className="tone-more">화면을 누르면 시작해요</span>
   </div>
  </section>

  {/* ── 둘째 장: 견본과 축 셋 ──────────────────────────────────── */}
  <section className="tone-pane tone-work">
   <div className="z-glyph-stage has-face">
    <div className="z-header">
     <BackButton label="설명 다시 보기" onClick={() => setStep('intro')}/>
     <span className="z-step-of">3 / 5 · 조율</span>
    </div>
    {/* 견본은 글자뿐이다. 도형은 색을 고르는 화면에서 처음 나온다.
        한 겹을 더 두른 것은 **자리를 재기 위해서다** — 머리줄을 뺀 나머지가
        견본의 몫인데, 칸 전체를 기준으로 삼으면 머리줄 높이만큼 넘친다. */}
    <div className="z-glyph-fit">
     <div className={'z-glyph is-line' + (tone.slnt ? ' is-gust' : '')} style={face}>
      <span>{lines.map((l, i) => <b key={i} className="z-glyph-char">{l}</b>)}</span>
     </div>
    </div>
   </div>
   <div className="z-axes">
    {/* 무게가 없는 얼굴에는 무게를 안 묻는다 — 없는 축의 손잡이를 밀면
        아무 일도 안 일어나는데 손잡이만 움직인다(palettes.ts · MANNER).
        그 자리는 아래의 말투 버튼이 받는다. */}
    {AXES.filter(a => a.key !== 'wght' || hasWeightAxis(tone.font)).map(a => {
        const at = nearest(a.stops, tone[a.key]);          // 값이 붙어 있는 눈금
        const last = a.stops.length - 1;
        // 손잡이 자리: 끄는 동안은 손가락, 놓으면 눈금
        const pos = drag?.key === a.key ? drag.at : at / last;
        return <div key={a.key} className="z-axis-line" role="group" aria-label={a.label}>
          <div className="z-axis-head">
            <span className="z-axis-label">{a.label}</span>
            <span className="z-axis-value">{a.names[at]}</span>
          </div>
          <div className={'z-steps' + (drag?.key === a.key ? ' is-dragging' : '')}
            style={{ '--at': pos } as CSSProperties}>
            <span className="z-steps-thumb" aria-hidden="true"/>
            {/* 점이 커지는 것만으로 "왼쪽이 적고 오른쪽이 많다"만 말한다.
                눈금 안에 글자를 넣으면 좁은 화면에서 잣대 이름이 잘린다. */}
            {a.stops.map((_, i) =>
              <span key={i} className={'z-step-dot' + (i === at ? ' on' : '')}
                style={{ width: 6 + i * 3, height: 6 + i * 3 }} aria-hidden="true"/>
            )}
            <input type="range" className="z-steps-input" min={0} max={1} step={0.001} value={pos}
              aria-label={a.label} aria-valuetext={a.names[at]}
              onChange={e => { const v = Number(e.target.value); setDrag({ key: a.key, at: v }); pick(a, Math.round(v * last)); }}
              onPointerUp={() => setDrag(null)} onPointerCancel={() => setDrag(null)}
              onBlur={() => setDrag(null)}
              onKeyDown={e => {
                  // 화살표는 0.001씩 움직여 봐야 눈금이 안 바뀐다 — 한 칸씩 옮긴다.
                  const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1
                      : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1
                      : e.key === 'Home' ? -last : e.key === 'End' ? last : 0;
                  if (!d) return;
                  e.preventDefault();
                  setDrag(null);
                  pick(a, Math.min(last, Math.max(0, at + d)));
              }}/>
          </div>
        </div>;
    })}
    {/* 말투 — 값이 둘뿐이라 손잡이가 아니라 버튼이다. 안내서도 그렇게 그렸다.
        고른 쪽의 이름이 그 얼굴로 쓰여 있어서, 누르기 전에 무엇이 되는지가
        글자 자체로 보인다. */}
    {MANNER[tone.font] && (
      <div className="z-axis-line" role="group" aria-label="말투">
        <div className="z-axis-head">
          <span className="z-axis-label">말투</span>
          <span className="z-axis-value">{MANNER[tone.font].labels[tone.manner ? 1 : 0]}</span>
        </div>
        <div className="z-manner">
          {MANNER[tone.font].labels.map((name, i) =>
            <button key={i} type="button"
              className={'z-manner-btn' + ((tone.manner ? 1 : 0) === i ? ' on' : '')}
              aria-pressed={(tone.manner ? 1 : 0) === i}
              style={{ fontFamily: fontMap[tone.font],
                fontVariationSettings: MANNER[tone.font].axes[i] } as CSSProperties}
              onClick={() => setTone(t => ({ ...t, manner: i }))}>{name}</button>
          )}
        </div>
      </div>
    )}
   </div>
   <button className="primary-action" onClick={() => onNext(tone)}>다음</button>
  </section>

 </div></div>;
}
