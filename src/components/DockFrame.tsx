import type { CSSProperties, ReactNode } from 'react';

interface Props {
  phaseLabel: string;
  children: ReactNode;
  style?: CSSProperties;
}

export default function DockFrame({ phaseLabel, children, style }: Props) {
  return (
    <div className="dock-frame" style={style}>
      <div className="dock-header">
        <span>DOCK</span>
        <span>{phaseLabel}</span>
      </div>
      {children}
    </div>
  );
}
