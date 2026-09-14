import { useEffect, useState } from 'react';
import { releaseDock } from '../lib/firebase';
import { EMPHASIS_SEC } from '../lib/wall';
interface Props {
    onDone: (pulled: boolean) => void;
}
export default function PhaseOnWall({ onDone }: Props) {
    const [left, setLeft] = useState(EMPHASIS_SEC);
    useEffect(() => { const start = Date.now(); const id = window.setInterval(() => { const remaining = Math.max(0, EMPHASIS_SEC - (Date.now() - start) / 1000); setLeft(remaining); if (remaining <= 0) {
        clearInterval(id);
        onDone(false);
    } }, 100); return () => clearInterval(id); }, [onDone]);
    return <div className="onwall-screen"><div className="onwall"><div className="onwall-count" aria-label="남은 발화 시간">{Math.ceil(left)}</div><span className="onwall-cap">최대 {EMPHASIS_SEC}초</span><button className="onwall-release" onClick={() => { void releaseDock(); onDone(true); }}>폰을 뺐어요</button></div></div>;
}
