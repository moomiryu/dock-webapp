import BackButton from './BackButton';
import StepOf from './StepOf';

interface Props {
  at: 1 | 2 | 3 | 4 | 5;
  /** 왼쪽 뒤로가기 — 화면마다 목적지가 다르다 */
  back: { label: string; onClick: () => void };
  /** 오른쪽 X — 초기 화면으로. 쓰던 초안은 지우지 않는다(App의 goHome) */
  onHome: () => void;
  /** 머리줄 상자의 이름. 4/5는 색 면 위에 뜨는 .compose-chrome을 쓴다 */
  className?: string;
}

/**
 * 작성 1~5단계의 머리줄 — 왼쪽 뒤로가기 · 가운데 점 다섯 · 오른쪽 X (2026-09-25).
 *
 * 가운데는 **화면의 정확한 가운데**다. 세 칸 격자(1fr auto 1fr)라 양옆 버튼의
 * 유무·폭과 상관없이 점이 움직이지 않는다. 1/5에서 글을 쓰는 동안 뒤로가기가
 * 숨을 때도 자리는 비워 둔 채 숨는다(app.css).
 *
 * X는 뒤로가기와 같은 상자(.z-back 44×44)·같은 획(2.6)·같은 색이다. 큰 원형
 * 바탕은 두지 않는다. **전송 기록을 지우지 않는다** — 그건 도킹 화면의 홈
 * 버튼(확인을 거친다)만 한다. 도킹 화면은 이 머리줄을 쓰지 않는다.
 */
export default function StepHeader({ at, back, onHome, className = 'z-header' }: Props) {
  return (
    <div className={className + ' step-header'}>
      <BackButton label={back.label} onClick={back.onClick} />
      <StepOf at={at} />
      <HomeX onClick={onHome} />
    </div>
  );
}

/**
 * 오른쪽 X — 초기 화면으로. 작성 단계 머리줄과 튜토리얼 머리줄이 같은 것을 쓴다.
 * 상자·획·색은 그 자리의 뒤로가기(.z-back)를 따른다 — 튜토리얼에서는 뒤로가기가
 * 흐린 색·가는 획(app.css .info-head > .z-back)이라 X도 같이 그렇게 선다.
 */
export function HomeX({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="z-back z-home" onClick={onClick} aria-label="초기 화면으로 돌아가기">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden focusable="false">
        <path d="M7 7 L17 17 M17 7 L7 17" fill="none" stroke="currentColor"
          strokeWidth="2.6" strokeLinecap="round" />
      </svg>
    </button>
  );
}
