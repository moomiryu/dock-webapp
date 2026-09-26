import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { pick, useLang } from '../lib/lang';

const T = {
  erase: { ko: '만든 발화 기록이 사라져요.', en: 'What you made will be deleted.' },
  ask: { ko: '정말 종료하시겠어요?', en: 'Are you sure you want to leave?' },
  yes: { ko: '네', en: 'Yes' },
  no: { ko: '아니오', en: 'No' }
};

interface Props {
  /** 스크린리더가 읽을 목적지 — "처음으로" */
  label: string;
  onClick: () => void;
}

/**
 * 처음으로 — 뒤로 가기가 서던 그 자리에, 그 크기로.
 *
 * 도킹 화면에는 뒤로 갈 데가 없다. 글은 이미 벽으로 갔고, 그 앞 화면(미리보기)은
 * '보낼까요'를 묻는 자리라 거기로 돌아가면 같은 글을 한 번 더 보낼 수 있었다.
 * 그렇다고 아무 문도 없이 두면 꽂지 않기로 한 사람이 화면에 갇힌다 —
 * 그래서 문은 남기되 **뒤가 아니라 처음으로** 낸다.
 *
 * 자리와 상자를 뒤로 가기와 똑같이 쓴다(.z-back). 왼쪽 위 그 자리는 이 앱에서
 * '여기서 나가는 문'이고, 모양만 집으로 바뀌어 어디로 나가는지를 말한다.
 *
 * 획은 2.2다 — 갈매기(2.6)보다 가늘다. 집은 선이 다섯이라 같은 굵기로
 * 그리면 한 획짜리 갈매기보다 훨씬 검게 보인다.
 *
 * **한 번 더 묻는다.** 이 자리는 뒤로 가기와 같은 자리라, 앞 화면들에서
 * 스무 번 눌러 온 손이 여기서도 습관으로 누른다. 그런데 여기서는 그 한 번이
 * 되돌릴 수 없다 — 쓰던 것이 사라지고 처음으로 간다. 자리를 옮겨 실수를
 * 막는 대신(옮기면 나가는 문이 어디 있는지 알 수 없게 된다) 묻는 쪽을 골랐다.
 */
export default function HomeButton({ label, onClick }: Props) {
  const [asking, setAsking] = useState(false);
  const backRef = useRef<HTMLButtonElement>(null);
  const lang = useLang();

  return (
    <>
      <button ref={backRef} type="button" className="z-back" onClick={() => setAsking(true)} aria-label={label}>
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden focusable="false">
          <path
            d="M3.5 11.2 L12 4 L20.5 11.2 M6.2 9.6 V20 H17.8 V9.6"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
      </button>
      {asking && (
        <AskLeave desc={pick(T.erase, lang)} onYes={onClick}
          onNo={() => { setAsking(false); backRef.current?.focus(); }} />
      )}
    </>
  );
}

/**
 * 한 번 더 묻는 창 — "정말 종료하시겠어요?" + 한 줄 + 네 / 아니오.
 *
 * 도킹의 '처음으로'(쓰던 것이 사라진다)와 작성 1~5단계의 X(초기 화면으로,
 * 쓰던 글은 남는다 — 2026-09-26 사용자 결정)가 같은 창을 쓴다. 물음은 같고
 * 아래 한 줄만 그 자리에서 실제로 일어나는 일을 말한다.
 *
 * 창은 문서 맨 바깥(body)에 띄운다. 머리줄이 움직이는 상자(transform) 안에
 * 들어 있으면, 화면을 덮어야 할 막이 그 상자 안에 갇힌다.
 *
 * 열리면 창 안(네)으로 초점을 옮긴다. ESC는 '아니오'와 같다 — 물음에서
 * 빠져나오는 쪽이 늘 안전한 쪽이다. 초점을 누르던 버튼으로 돌려주는 것은
 * onNo를 준 쪽이 한다.
 */
export function AskLeave({ desc, onYes, onNo }: { desc: string; onYes: () => void; onNo: () => void }) {
  const titleId = useId();
  const yesRef = useRef<HTMLButtonElement>(null);
  const lang = useLang();
  /* 부모가 다시 그려질 때마다 초점을 '네'로 되돌리지 않도록, 여는 순간 한 번만 */
  const no = useRef(onNo);
  no.current = onNo;
  useEffect(() => {
    yesRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); no.current(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  return createPortal(
    <div className="ask-veil" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="ask-card">
        <h2 id={titleId}>{pick(T.ask, lang)}</h2>
        <p>{desc}</p>
        <div className="ask-answers">
          <button ref={yesRef} type="button" className="ask-yes" onClick={onYes}>{pick(T.yes, lang)}</button>
          <button type="button" className="ask-no" onClick={() => no.current()}>{pick(T.no, lang)}</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
