import type { ReactNode } from 'react';

interface Props {
  phaseLabel: string;
  children: ReactNode;
}

// 폰이 홈에 꽂힌 채로 읽는 화면(07·08)의 틀.
//
// 폰은 위쪽이 먼저 들어가 세로로 꽂힌다. 그래서 서 있는 사람에게는 화면의
// 아래 절반만 남는다. 위 절반에 무엇을 두든 그건 홈 안에서 혼자 빛난다.
// 그 절반을 없는 셈 치고, 읽어야 할 것은 전부 아래에 둔다.
//
// 손에 들고 볼 때(테스트·개발)에는 위 절반이 빗금과 라벨로 보여서
// 왜 아래만 쓰는지가 그 자체로 설명이 된다.
export default function DockedFrame({ phaseLabel, children }: Props) {
  return (
    <div className="dock-frame">
      <div className="dock-buried" aria-hidden>
        <div className="dock-buried-head">
          <span>MEGAFONT</span>
          <span>{phaseLabel}</span>
        </div>
        <span className="dock-buried-label">여기부터 위는 홈 안에 들어가 있어요</span>
      </div>

      <div className="dock-shown">{children}</div>
    </div>
  );
}
