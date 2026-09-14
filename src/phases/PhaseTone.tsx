import { useState } from 'react';
import BackButton from '../components/BackButton';
import { fontMap } from '../lib/palettes';
import { type PartialTone } from '../lib/tone';
interface Props {
    initialTone: PartialTone;
    onBack: (tone: PartialTone) => void;
    onNext: (tone: PartialTone) => void;
}
/**
 * 견본 글자 크기 = 크기 값 × 이것.
 *
 * 스케치의 '발화'는 잉크로 224.2×120.1 — 133px쯤이다. 끝(60)까지 밀었을 때
 * 장평까지 겹쳐도 화면 밖으로 나가지 않아야 한다:
 *   2 글자 × 0.853em × (60 × k) × 장평 1.3 ≤ 390 − 좌우 40  →  k ≤ 2.63
 * 2026-09-15: 크기가 두 잣대(28·60)로 바뀌면서 2.2로 내렸다. '크게'가
 * 60 × 2.2 = 132px — 스케치에서 잰 133px이다.
 */
const GLYPH_SCALE = 2.2;

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

/** 저장된 값이 눈금에 정확히 없을 수 있다 — 제일 가까운 칸으로 읽는다 */
const nearest = (stops: readonly number[], v: number) =>
    stops.reduce((best, s, i) => (Math.abs(s - v) < Math.abs(stops[best] - v) ? i : best), 0);

export default function PhaseTone({ initialTone, onBack, onNext }: Props) {
    const [tone, setTone] = useState<PartialTone>(initialTone);
    return <div className="z-frame z1 tone-adjust">
 <div className="z-glyph-stage has-face">
  <div className="z-header"><BackButton label="성격 다시 고르기" onClick={() => onBack(tone)}/><span className="z-step-of">2 / 5 · 조율</span></div>
  <div className="z-ask">
   <h1>전하고 싶은 느낌으로<br />조절해보세요</h1>
   <p>발화의 크기, 빠르기, 무게를 정해봐요.</p>
  </div>
  <div className="z-glyph" style={{ fontFamily: fontMap[tone.font], fontWeight: tone.wght, fontVariationSettings: '"wght" ' + tone.wght, transform: 'scaleX(' + tone.tone + ')', fontSize: tone.size * GLYPH_SCALE + 'px' }}><span>발화</span></div>
 </div>
 <div className="z-axes">
  {AXES.map(a => {
      const at = nearest(a.stops, tone[a.key]);
      return <div key={a.key} className="z-axis-line" role="group" aria-label={a.label}>
        <div className="z-axis-head">
          <span className="z-axis-label">{a.label}</span>
          <span className="z-axis-value">{a.names[at]}</span>
        </div>
        <div className="z-steps">
          {a.stops.map((s, i) =>
            <button key={i} type="button" className={'z-step ' + (i === at ? 'on' : '')}
              aria-pressed={i === at} aria-label={`${a.label} ${a.names[i]}`}
              onClick={() => setTone(t => ({ ...t, [a.key]: s }))}>
              {/* 점이 커지는 것만으로 "왼쪽이 적고 오른쪽이 많다"를 말한다.
                  칸 안에 글자를 넣으면 좁은 화면에서 잣대 이름이 잘린다. */}
              <span className="z-step-dot" style={{ width: 6 + i * 3, height: 6 + i * 3 }}/>
            </button>
          )}
        </div>
      </div>;
  })}
 </div>
 <button className="primary-action" onClick={() => onNext(tone)}>다음</button></div>;
}
