import { useState, type CSSProperties } from 'react';
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
 * 스케치의 '발화'는 잉크로 224.2×120.1 — 133px쯤이다. 그 크기를 기본값(44)에
 * 맞추면 슬라이더를 끝(60)까지 밀었을 때 장평까지 겹쳐 글자가 화면 밖으로
 * 나간다. 그래서 *끝에서 간신히 들어가는* 값으로 잡았다:
 *   2 글자 × 0.853em × (60 × k) × 장평 1.3 ≤ 390 − 좌우 40  →  k ≤ 2.63
 *
 * 2026-09-15: 크기가 두 잣대(28·60)로 바뀌면서 2.2로 내렸다. '크게'가
 * 60 × 2.2 = 132px — 스케치에서 잰 133px이다.
 */
const GLYPH_SCALE = 2.2;

/**
 * 세 축. 차례는 스케치를 따른다 — 크기 · 빠르기 · 무게.
 *
 * 2026-09-15 스케치가 슬라이더의 옷을 갈아입혔다. 알약 하나가 통째로 트랙이고,
 * 그 위를 알약꼴 손잡이가 달린다(Slider Sketch.svg — 흰 몸에 청록 막대,
 * 원형은 쓰지 않는다). 가운데 글자는 눈금이 아니라 **지금 어느 쪽에 와
 * 있는지**를 말한다: 한가운데 근처에서는 축 이름('크기')이고, 한쪽으로
 * 기울면 그쪽 잣대의 이름('작게'·'크게')으로 바뀐다. 스케치 _3의 알약에
 * 축 이름이 적혀 있는 건 아직 아무 쪽으로도 안 간 상태여서다.
 *
 * 값은 계속 이어져 있다. 두 낱말은 잣대의 이름이지 값의 개수가 아니다.
 *
 * '빠르기'는 장평이다. 천천히 말하면 글자가 옆으로 퍼지고(1.3),
 * 빠르게 말하면 좁아진다(0.7) — 그래서 이 축만 큰 값이 왼쪽이다.
 */
const AXES = [
    { key: 'size', label: '크기', min: 28, max: 60, step: 1, low: '작게', high: '크게' },
    { key: 'tone', label: '빠르기', min: 0.7, max: 1.3, step: 0.01, low: '빠르게', high: '천천히' },
    { key: 'wght', label: '무게', min: 300, max: 700, step: 10, low: '가볍게', high: '묵직하게' }
] as const;

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
      const v = tone[a.key];
      const at = (v - a.min) / (a.max - a.min);          // 0~1
      return <label key={a.key} className="tone-pill" style={{ '--at': at } as CSSProperties}>
        <span className="tone-pill-word">{Math.abs(at - 0.5) < 0.08 ? a.label : at > 0.5 ? a.high : a.low}</span>
        <input type="range" min={a.min} max={a.max} step={a.step} value={v}
          aria-label={`${a.label}. ${a.low}에서 ${a.high}까지`}
          onChange={e => setTone(t => ({ ...t, [a.key]: Number(e.target.value) }))}/>
      </label>;
  })}
 </div>
 <button className="primary-action" onClick={() => onNext(tone)}>다음</button></div>;
}
