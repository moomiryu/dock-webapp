import type { CSSProperties, ReactNode } from 'react';

/**
 * 숨 쉬는 상자의 물결 한 겹.
 *
 * 참고 자료(`design sketch/motion reference_2.gif`, 400×400 · 30프레임 · 20ms)를
 * 프레임마다 덩어리로 뜯어 재서 나온 값이다. 도는 게 아니었다 — 날의 각도는
 * 30프레임 내내 44.74°로 붙박이였고, 대신 이런 일이 벌어진다:
 *
 *   · 물결은 몸통 가장자리(r=112, 몸통 반폭 109의 1.028배)에서 태어나
 *     바깥(r=128, 1.174배)까지 번지며 두께가 4.1px → 1.0px로 얇아진다
 *   · 한 겹뿐이다. 한 겹이 사라질 때쯤 다음 겹이 태어난다 — 600ms 주기
 *   · 네 귀퉁이에 걸친 네 토막이고, 변 한가운데가 끊겨 있다
 *   · 몸통은 물결이 떨어져 나가는 순간 넓이가 31660까지 줄었다가
 *     34475로 돌아온다 = 한 변으로 치면 2.2%
 *
 * 끊긴 자리는 점선(stroke-dasharray)으로 낸다. 네 토막을 따로 그리면
 * 모서리 반지름이 바뀔 때마다 네 경로를 다시 계산해야 한다.
 *
 * 몸통이 함께 여위는 것은 `.wave-core` 한 줄이 맡는다(app.css) — 물결과
 * 같은 600ms를 세야 해서 주기가 한곳에 있다.
 *
 * ── strength ──────────────────────────────────────────────────────────
 * 04 작성 화면은 언제나 1이다. 위 표의 값이 그대로 나온다.
 *
 * 벽에서는 이 값이 줄어든다. 발화하는 동안 물결이 서서히 잦아들어야 하고
 * (30초에 걸쳐), 잔상으로 남은 뒤에도 계속 숨은 쉬어야 하기 때문이다.
 * 줄어드는 것은 **번지는 거리와 짙기** 둘뿐이다 — 주기(600ms)와 몸통이
 * 여위는 폭(2.2%)은 건드리지 않는다. 그 둘까지 늦추면 다른 사물이 된다.
 *
 * strength를 안 주면 아무것도 적지 않는다. 그러면 감싼 쪽(WaveBox)이
 * 내려주는 값을 물려받고, 그마저 없으면 @property의 초기값 = 표의 값이다.
 */
export function WaveRing({ color, strength }: { color: string; strength?: number }) {
    const style = strength === undefined ? undefined : waveVars(strength);
    return <svg className="wave-ring" style={style} viewBox="0 0 240 240" aria-hidden="true" focusable="false">
  <rect className="wave-ring-path" x="20" y="20" width="200" height="200" rx="34" fill="none" stroke={color}/>
 </svg>;
}

/**
 * 세기 하나를 물결의 두 값으로 편다. 1.028은 태어나는 자리라 고정이고,
 * 줄어드는 건 거기서 얼마나 멀리 가느냐(0.146)뿐이다. 1이면 1.174 — 표 그대로.
 */
export function waveVars(strength: number): CSSProperties {
    return { '--wave-reach': 1.028 + 0.146 * strength, '--wave-ink': strength } as CSSProperties;
}

interface BoxProps {
    color: string;
    /** 물결의 세기 0~1. 안 주면 CSS가 정한다(초기값 1) */
    strength?: number;
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
}

/**
 * 숨 쉬는 상자. 04에서 자판을 내리면 화면이 물러서 남는 그 한 덩이를,
 * 벽에서도 쓸 수 있게 상자 하나로 묶은 것이다.
 *
 * 몸통이 그 색이고(글 뒤에 알약을 두르지 않는다), 물결은 몸통 가장자리에서
 * 난다. 몸통이 여위는 것과 물결이 떨어지는 것이 같은 600ms를 세야 하므로
 * 둘 다 이 안에 있고, 위상(--wave-phase)도 상자 단위로 준다 — 벽에 여러
 * 개가 뜰 때 다 같이 뛰면 기계가 된다.
 *
 * 크기는 주지 않는다. 폰은 316px, 벽은 vh — 쓰는 쪽이 안다.
 */
export default function WaveBox({ color, strength, className, style, children }: BoxProps) {
    const vars = strength === undefined ? null : waveVars(strength);
    return <div className={'wave-box wave-core' + (className ? ' ' + className : '')}
      style={{ background: color, ...vars, ...style }}>
  <WaveRing color={color}/>
  {children}
 </div>;
}
