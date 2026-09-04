interface Props {
  /** 스크린리더가 읽을 목적지 — "처음으로", "자형 다시 정하기" 처럼 */
  label: string;
  onClick: () => void;
}

// 뒤로 가기 — 화면 좌상단의 고정 자리. 글자 없이 아이콘만 둔다.
export default function BackButton({ label, onClick }: Props) {
  return (
    <button type="button" className="z-back" onClick={onClick} aria-label={label}>
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden focusable="false">
        <path
          d="M14.5 5 L7.5 12 L14.5 19"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="square"
        />
      </svg>
    </button>
  );
}
