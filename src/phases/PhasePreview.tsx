import { useEffect, useState } from 'react';
import BackButton from '../components/BackButton';
import VoiceBubble from '../components/VoiceBubble';
import { fontMap } from '../lib/palettes';
import { messageColors } from '../lib/messageStyle';
import { STAY_DAYS } from '../lib/wall';
import { SAMPLE_MESSAGES } from '../lib/samples';
import type { ToneState } from '../types';
interface Props {
    text: string;
    tone: ToneState;
    onConfirm: () => void;
    onBack: () => void;
    busy?: boolean;
    error?: string | null;
}
export default function PhasePreview({ text, tone, onConfirm, onBack, busy = false, error }: Props) {
    const [stage, setStage] = useState('empty');
    const [run, setRun] = useState(0);
    const colors = messageColors(tone);
    useEffect(() => { if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setStage('hold');
        return;
    } setStage('empty'); const timers = [setTimeout(() => setStage('burst'), 600), setTimeout(() => setStage('hold'), 1650), setTimeout(() => setStage('settle'), 3250), setTimeout(() => setStage('ambient'), 4200)]; return () => timers.forEach(clearTimeout); }, [run]);
    return <div className="z-frame preview-screen"><div className="z-header"><BackButton label="색 다시 고르기" onClick={() => { if (!busy)
        onBack(); }}/><span className="z-step-of">5 / 5 · 미리보기</span></div>
 {/* 여기가 마지막이라는 것을 말로 해 둔다. 이 뒤(도킹)에는 '이전'이 없다 —
     글은 이미 보내진 뒤라, 거기서 나가는 문은 처음으로만 난다. */}
 <div className="z-ask is-brief"><h1>이렇게 보여요</h1><p>메시지를 수정할 수 있는 마지막 단계에요.</p></div><div className="proj-stage"><div className={'sim is-' + stage}><div className="sim-frame">
 <div className="sim-crowd" aria-hidden>{SAMPLE_MESSAGES.map((s, i) => { const m = messageColors(s.tone); return <div key={i} className="sim-lane" style={{ top: (i % 2 ? 80 : 20) + '%', animationDuration: '34s', animationDelay: -(i * 5) + 's' }}><span className="sim-crowd-item" style={{ background: m.bg, color: m.text, fontFamily: fontMap[s.tone.font] }}>{s.text}</span></div>; })}</div>
 <div className="sim-mine-lane"><div className="sim-mine"><VoiceBubble text={text} bg={colors.bg} color={colors.text} fontFamily={fontMap[tone.font]} font={tone.font} weight={tone.wght} width={tone.tone} slant={tone.slnt} align={tone.align} size={tone.size}/></div></div>
 </div><div className="sim-legend"><span className={stage === 'hold' || stage === 'burst' ? 'on' : ''}>꽂혀 있는 동안</span><span className={stage === 'ambient' || stage === 'settle' ? 'on' : ''}>그 뒤 {STAY_DAYS}일</span><button type="button" className="sim-replay" onClick={() => setRun(r => r + 1)}>다시 보기</button></div></div></div>
 {error && <p role="alert" className="error-banner">{error}<br />쓰신 글은 그대로 있어요. 사라지지 않았습니다.</p>}
 <button className="primary-action" disabled={busy} aria-busy={busy} aria-label={busy ? '전송 중' : error ? '다시 보낼게요' : '준비됐어요'} onClick={onConfirm}>{busy ? <span className="cta-loading" aria-hidden>…</span> : error ? '다시 보낼게요' : '준비됐어요'}</button></div>;
}
