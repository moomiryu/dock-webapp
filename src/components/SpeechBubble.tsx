import type { CSSProperties, ReactNode } from 'react';
import { waveVars } from './WaveBox';
import type { Bubble } from '../lib/bubbles';
import type { Boxed } from '../lib/fit';

/**
 * 말풍선 하나 — 윤곽과 그 안의 글.
 *
 * WaveBox와 하는 일은 같은데 몸이 다르다. WaveBox는 **정사각 둥근 상자**라
 * 크기를 한 변 하나로 받는다. 이쪽은 글이 정한 비례를 그대로 입으므로
 * 가로·세로가 따로 있고, 꼬리가 몸통 아래로 더 흘러내린다.
 * 폰의 03·04는 아직 WaveBox를 쓴다 — 거기선 글을 쓰는 중이라 아직 모양이
 * 정해지지 않았다(모양은 성격이 정한다).
 *
 * ── 왜 치수를 비율로 받는가 ───────────────────────────────────────────
 * 벽의 크기는 CSS가 vh로 들고 있다(--echo-side · --big-side). 그 값을 JS로
 * 읽어 px로 그리면 창이 바뀔 때마다 다시 그려야 하고, 그때마다 React를
 * 거친다. 그래서 fit.ts가 **최대 영역 한 변에 대한 비율**만 주고, 실제
 * 길이는 calc()가 맞춘다. 창이 바뀌면 CSS가 알아서 따라간다.
 *
 * 윤곽 경로만은 숫자가 필요하다. 모양이 비례에만 달려 있어 아무 단위로
 * 그려도 같으므로, 1000짜리 화판에 한 번 그리고 viewBox가 줄인다.
 */
const CANVAS = 1000;

interface Props {
  shape: Bubble;
  /** 최대 영역 한 변에 대한 비율 (fit.ts) */
  box: Boxed;
  /** 그 한 변을 가리키는 CSS 길이 — 'var(--echo-side)' 같은 것 */
  side: string;
  color: string;
  /** 물결의 세기 0~1 */
  strength?: number;
  /** 숨의 위상. 벽에 여러 개가 뜰 때 다 같이 뛰면 기계가 된다 */
  phase?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export default function SpeechBubble({ shape, box, side, color, strength, phase, className, style, children }: Props) {
  const w = box.w * CANVAS;
  const h = box.h * CANVAS;
  const tail = box.tail * CANVAS;
  const d = shape.path(w, h, box.unit * CANVAS);
  const vars = {
    ...(strength === undefined ? null : waveVars(strength)),
    ...(phase ? { '--wave-phase': phase } : null)
  } as CSSProperties;
  return (
    <div
      className={'speech-bubble' + (className ? ' ' + className : '')}
      style={{
        width: `calc(${side} * ${box.w.toFixed(4)})`,
        height: `calc(${side} * ${(box.h + box.tail).toFixed(4)})`,
        ...vars,
        ...style
      }}
    >
      {/* 몸통과 물결이 **같은 문자열**을 쓴다. 경로를 두 군데 두면 하나가
          반드시 어긋난다 — 물결은 그 윤곽이 번져 나가는 것이라 어긋나면
          다른 도형 둘이 겹친 것으로 보인다. */}
      <svg className="bubble-art" viewBox={`0 0 ${w.toFixed(1)} ${(h + tail).toFixed(1)}`} aria-hidden="true" focusable="false">
        <path className="bubble-ring" d={d} pathLength={100} fill="none" stroke={color} />
        <path className="bubble-core" d={d} fill={color} />
      </svg>
      <div className="bubble-text" style={{ height: `calc(${side} * ${box.h.toFixed(4)})` }}>{children}</div>
    </div>
  );
}
