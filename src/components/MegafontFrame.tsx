import type { CSSProperties, ReactNode } from 'react';
import BackButton from './BackButton';

interface Props {
  phaseLabel: string;
  children: ReactNode;
  style?: CSSProperties;
  /**
   * 주면 머리줄 왼쪽의 워드마크 자리가 '이전'으로 바뀐다.
   * 그 자리는 다른 화면 전부에서 뒤로 가기가 서는 자리다 — 한 화면만
   * 로고를 세워 두면 돌아갈 데가 없는 화면처럼 보인다.
   */
  onBack?: () => void;
}

export default function MegafontFrame({ phaseLabel, children, style, onBack }: Props) {
  return (
    <div className="mf-frame" style={style}>
      <div className="mf-header">
        {onBack ? <BackButton label="이전" onClick={onBack}/> : <span>MEGAFONT</span>}
        <span>{phaseLabel}</span>
      </div>
      {children}
    </div>
  );
}
