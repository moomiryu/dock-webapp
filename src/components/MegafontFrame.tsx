import type { CSSProperties, ReactNode } from 'react';

interface Props {
  phaseLabel: string;
  children: ReactNode;
  style?: CSSProperties;
}

export default function MegafontFrame({ phaseLabel, children, style }: Props) {
  return (
    <div className="mf-frame" style={style}>
      <div className="mf-header">
        <span>MEGAFONT</span>
        <span>{phaseLabel}</span>
      </div>
      {children}
    </div>
  );
}
