import { useEffect, useId, useRef, useState, type RefObject } from 'react';

/**
 * 획을 살찌우는 두께. 글자 크기에 대한 비율이라 어디서든 같은 모양이 나온다.
 * 이 두께가 곧 '글자와 윤곽 사이의 여백'이고, 동시에 낱글자를 서로 닿게
 * 만드는 힘이다. 얇으면 글자마다 떨어진 섬이 되고 (0.3em에서 글자가 윤곽
 * 밖으로 삐져나온다), 두꺼우면 다시 둥근 사각형으로 부풀어 오른다 (0.9em).
 * 0.5em이 글자를 다 덮으면서 줄마다의 굴곡이 남는 자리다.
 */
export const STROKE_EM = 0.5;

/** 번짐 반경 대 글자 크기. 줄과 줄 사이를 건너 붙일 만큼은 되어야 한다. */
export const BLUR_RATIO = 0.16;

/**
 * 물결 하나의 크기. 잡음 주파수는 픽셀의 역수라서 이것도 글자 크기를
 * 따라가야 한다 -- 고정하면 폰에서는 물결 하나가 말풍선보다 커져 통째로
 * 밀리기만 하고, 벽에서는 잘게 일어 종이가 찢어진 것처럼 보인다.
 * 글자 크기의 약 네 배마다 마루가 하나 온다.
 */
const WAVE_FREQ_K = 0.26;

interface Props {
  id: string;
  /**
   * 글자를 서로 뭉치게 하는 번짐 반경 (px).
   * 폰에서는 13px, 벽에서는 180px인 같은 글이라 고정값을 둘 수 없다 —
   * 쓰는 쪽이 실제 글자 크기를 재서 넘긴다.
   */
  blur: number;
  /** 가장자리가 일렁이는 폭 (px). 0이면 고요하다. */
  wave?: number;
  /** 물결의 잘기 (px의 역수). 글자 크기에서 계산해 넘긴다. */
  freq?: number;
  /** 한 번 일렁이는 데 걸리는 시간 (초) */
  wavePeriod?: number;
}

/**
 * 글자 크기를 재서 번짐·일렁임을 픽셀로 돌려준다.
 *
 * 크기가 vw·cqw·calc로 들어오는 데다 벽과 폰이 열 배 넘게 차이 나므로
 * 값을 미리 알 수 없다. 실제로 그려진 크기를 읽어 비례로 잡는 수밖에 없다.
 */
export function useGoo(waveRatio = 0): {
  hostRef: RefObject<HTMLDivElement>;
  filterId: string;
  blur: number;
  wave: number;
  freq: number;
  px: number;
} {
  const hostRef = useRef<HTMLDivElement>(null);
  const filterId = 'goo' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const [px, setPx] = useState(16);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const measure = () => {
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (Number.isFinite(size) && size > 0) setPx(size);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  return {
    hostRef,
    filterId,
    blur: px * BLUR_RATIO,
    wave: px * waveRatio,
    freq: WAVE_FREQ_K / px,
    px
  };
}

// 메타볼(가위) 필터.
//
// 하는 일은 두 단계뿐이다. 먼저 글자를 뭉갠다(feGaussianBlur). 그러면 이웃한
// 획끼리 반투명하게 겹친다. 그 다음 알파를 극단으로 밀어붙여(feColorMatrix)
// 겹친 자리는 완전히 채우고 나머지는 지운다. 남는 것은 낱글자가 아니라
// '글이 놓인 자리'의 윤곽이다 -- 줄이 짧으면 그만큼 좁아지고, 낱말 사이가
// 뜨면 잘록해진다. 둥근 사각형이 절대 만들 수 없는 형태다.
//
// alpha 행의 24 / -11 이 그 문턱이다. 24가 기울기, -11이 자르는 높이라
// 알파가 약 0.46을 넘는 자리만 살아남는다. 값이 크면 가장자리가 날카로워지고
// 작으면 물러진다.
//
// wave를 주면 그 위에 결을 하나 더 얹는다. 잡음을 만들어(feTurbulence)
// 그 잡음만큼 윤곽을 밀어낸다(feDisplacementMap). 잡음의 주파수를 천천히
// 오가게 하면 형태가 끓듯 일렁인다 -- 물에 잠긴 글자가 흔들리는 결이다.
export default function MetaballFilter({ id, blur, wave = 0, freq = 0.004, wavePeriod = 9 }: Props) {
  return (
    <svg className="mf-defs" aria-hidden focusable="false">
      <defs>
        <filter
          id={id}
          // 번지고 밀려난 만큼 바깥으로 자리를 내준다. 기본 여유(10%)로는
          // 살찌운 획이 상자 밖에서 잘린다.
          x="-30%"
          y="-45%"
          width="160%"
          height="190%"
          colorInterpolationFilters="sRGB"
        >
          <feGaussianBlur in="SourceGraphic" stdDeviation={blur} result="blurred" />
          <feColorMatrix
            in="blurred"
            type="matrix"
            values="1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 24 -11"
            result="goo"
          />
          {wave > 0 && (
            <>
              {/* 옥타브 하나면 족하다. 둘을 겹치면 두 배 주파수의 잔결이
                  더해져 가장자리가 찢어진 종이처럼 까끌해진다 -- 물이 아니라
                  파본이 된다. */}
              <feTurbulence
                type="fractalNoise"
                baseFrequency={freq.toFixed(5)}
                numOctaves={1}
                seed={7}
                result="noise"
              >
                <animate
                  attributeName="baseFrequency"
                  dur={`${wavePeriod}s`}
                  values={`${freq.toFixed(5)}; ${(freq * 1.5).toFixed(5)}; ${freq.toFixed(5)}`}
                  calcMode="spline"
                  keySplines="0.4 0 0.6 1; 0.4 0 0.6 1"
                  repeatCount="indefinite"
                />
              </feTurbulence>
              <feDisplacementMap
                in="goo"
                in2="noise"
                scale={wave}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </>
          )}
        </filter>
      </defs>
    </svg>
  );
}
