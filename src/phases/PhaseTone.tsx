import { useState, type CSSProperties } from 'react';
import BackButton from '../components/BackButton';
import { fontMap } from '../lib/palettes';
import { type PartialTone } from '../lib/tone';
import { bubbleAt, fillFromLegacySize, foldLines } from '../lib/fit';
import { bubbleFor } from '../lib/bubbles';
import SpeechBubble from '../components/SpeechBubble';
import VoiceBubble from '../components/VoiceBubble';
import { DRAFT_COLORS } from '../lib/messageStyle';
interface Props {
    /** 앞 화면들에서 쓰고 고른 것. 견본이 이제 내 글이다 */
    text: string;
    initialTone: PartialTone;
    onBack: (tone: PartialTone) => void;
    onNext: (tone: PartialTone) => void;
}
/**
 * 견본이 '발화' 두 글자에서 **내 글**로 바뀌었다 (2026-09-19).
 *
 * 옛 배율(2.2)은 스케치의 '발화'를 잉크로 재서 나온 값이라 **두 글자**를
 * 전제했다 — 2글자 × 0.853em × (60 × k) × 장평 1.3 ≤ 390 − 40. 열두 자짜리
 * 문장에는 그 식이 통째로 안 맞는다.
 *
 * 대신 무대에 맞춘다. 가장 긴 줄이 무대 폭의 86%에 들어가고(칸이 좁아져도
 * 글자가 밖으로 안 나간다), 줄 수가 늘면 높이가 먼저 걸린다. 크기 축은 그
 * 위에 배율로 얹힌다 — 이 화면에서 축은 절대 크기가 아니라 **얼마나 쓰는가**를
 * 말한다(근거는 lib/fit.ts의 SIZE_FILLS).
 */
/**
 * 무대에 그리는 **최대 영역**. 벽에서 말풍선이 차지할 수 있는 가장 큰
 * 자리(1.08m 정사각)를 폰 화면에 줄여 놓은 것이다.
 *
 * 이게 없으면 크기 축이 말을 못 한다. 축은 절대 크기가 아니라 '얼마나
 * 쓰는가'인데(lib/fit.ts의 SIZE_FILLS), 붉은 면 한가운데 글자만 떠 있으면
 * **무엇에 대한 73%인지**가 화면에 없다. 점선 네모가 그 무엇이다.
 *
 * 폰은 벽보다 19배 작아서 이 안의 글자가 12px쯤으로 작다. 읽으라고 두는
 * 자리가 아니다 — 말풍선이 네모를 얼마나 채우는지를 보는 자리고, 읽히는지는
 * 미리보기가 맡는다.
 */
const AREA = 'min(88cqw, 196px)';

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
 * 04에 정렬·기울기 버튼 둘이 따로 서 있었는데, 기울기는 '빠르게 말하기'와
 * 같은 것을 다른 손짓으로 두 번 묻고 있었다. 빠르게 말하면 글자가 좁아지고
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
    const lines = foldLines(text);
    const longest = Math.max(1, ...lines.map((l) => Array.from(l).length));
    void longest;
    const shape = bubbleFor(tone.font);
    const box = bubbleAt(lines, shape, fillFromLegacySize(tone.size));
    // 장평이 넓어지면 글이 그만큼 옆으로 퍼진다 — fit.ts는 장평을 모른다
    const em = (box.unit / Math.max(1, tone.tone)).toFixed(4);
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
    return <div className="z-frame z1 tone-adjust">
 <div className="z-glyph-stage has-face">
  <div className="z-header"><BackButton label="성격 다시 고르기" onClick={() => onBack(tone)}/><span className="z-step-of">3 / 5 · 조율</span></div>
  <div className="z-ask is-brief">
   <h1>전하고 싶은 느낌으로<br />조절해보세요</h1>
   <p>발화의 크기, 빠르기, 무게를 정해봐요.</p>
  </div>
  {/* 점선 네모가 최대 영역이고, 그 안의 말풍선이 축이 정한 만큼을 쓴다.
      색은 아직 안 골랐으니 작업용 바탕(DRAFT_COLORS)이다 — 다음 화면에서
      열 조합 중 하나로 갈아탄다. */}
  <div className="tone-area" style={{ '--tone-area': AREA } as CSSProperties}>
   <SpeechBubble shape={shape} box={box} side="var(--tone-area)" color={DRAFT_COLORS.backgroundColor}>
    <VoiceBubble text={lines.join('\n')} bg={DRAFT_COLORS.backgroundColor} color={DRAFT_COLORS.textColor}
      fontFamily={fontMap[tone.font]} font={tone.font} weight={tone.wght} width={tone.tone}
      slant={tone.slnt} align="center" size={tone.size}
      fontSize={`calc(var(--tone-area) * ${em})`} />
   </SpeechBubble>
  </div>
 </div>
 <div className="z-axes">
  {AXES.map(a => {
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
          {/* 점이 커지는 것만으로 "왼쪽이 적고 오른쪽이 많다"를 말한다.
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
 </div>
 <button className="primary-action" onClick={() => onNext(tone)}>다음</button></div>;
}
