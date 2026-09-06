interface Props {
  /** 1 말투 · 2 다듬기 · 3 한 줄 · 4 색 · 5 벽에서 보기 */
  step: 1 | 2 | 3 | 4 | 5;
}

const NAMES = ['말투', '다듬기', '한 줄', '색', '벽에서 보기'];

// 다섯 단계의 진행.
//
// 그전에는 점 세 개와 단계 이름이 기본 버튼 *아래*에 있었다. 참조 계약에서
// xlarge 버튼은 화면의 마지막 요소이고, 그 아래에 무언가를 더 두면 어디서
// 끝나는지가 흐려진다. 그래서 진행 표시를 위로 올리고, 상단 바의 구분선이
// 그대로 막대가 되게 했다 — 줄 하나가 두 가지 일을 한다.
//
// 상단 바가 이미 "1 / 5 · 말투"라고 말하므로 여기에 글자를 더 두지 않는다.
export default function StepRail({ step }: Props) {
  return (
    <div
      className="z-rail"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={NAMES.length}
      aria-valuenow={step}
      aria-label={`${NAMES.length}단계 중 ${step}단계 · ${NAMES[step - 1]}`}
    >
      <i style={{ width: `${(step / NAMES.length) * 100}%` }} />
    </div>
  );
}
