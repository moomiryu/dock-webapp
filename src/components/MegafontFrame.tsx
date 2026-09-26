import type { CSSProperties, ReactNode } from 'react';
import BackButton from './BackButton';
import HomeButton from './HomeButton';
import { pick, useLang } from '../lib/lang';

const T = {
  back: { ko: '이전', en: 'Back' },
  home: { ko: '처음으로', en: 'Back to start' }
};

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
  /**
   * 같은 자리에 '처음으로'. 뒤로 갈 데가 없는 화면(도킹)이 쓴다 —
   * 글은 이미 보내졌고, 앞 화면으로 돌아가면 같은 글을 또 보낼 수 있었다.
   * onBack과 같이 주면 onBack이 이긴다.
   */
  onHome?: () => void;
}

export default function MegafontFrame({ phaseLabel, children, style, onBack, onHome }: Props) {
  const lang = useLang();
  return (
    <div className="mf-frame" style={style}>
      <div className="mf-header">
        {onBack ? <BackButton label={pick(T.back, lang)} onClick={onBack}/>
          : onHome ? <HomeButton label={pick(T.home, lang)} onClick={onHome}/>
          : <span>MEGAFONT</span>}
        <span>{phaseLabel}</span>
      </div>
      {children}
    </div>
  );
}
