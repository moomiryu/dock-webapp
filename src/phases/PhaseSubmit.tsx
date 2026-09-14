import { useRef, useState } from 'react';
import PhasePreview from './PhasePreview';
import PhaseDocking from './PhaseDocking';
import MegafontFrame from '../components/MegafontFrame';
import { clearDraft } from '../lib/draft';
import { submitMessage } from '../lib/firebase';
import type { Draft } from '../types';
interface Props {
    draft: Draft | null;
    onDocked: () => void;
    onEdit: () => void;
    onRestart: () => void;
}
export default function PhaseSubmit({ draft, onDocked, onEdit, onRestart }: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [id, setId] = useState<string | null>(null);
    const locked = useRef(false);
    async function send() { if (locked.current || !draft?.text || !draft.tone)
        return; locked.current = true; setBusy(true); setError(null); try {
        const result = await submitMessage(draft);
        clearDraft();
        setId(result);
    }
    catch (e) {
        const raw = e instanceof Error ? e.message : String(e);
        setError(!navigator.onLine ? '인터넷이 끊겨 있어요. 연결을 확인하고 다시 보내주세요.' : /[가-힣]/.test(raw) ? raw : '보내는 중에 문제가 생겼어요. 다시 보내주세요.');
    }
    finally {
        locked.current = false;
        setBusy(false);
    } }
    // 보내진 뒤에는 뒤(onEdit)가 아니라 처음(onRestart)으로만 나갈 수 있다 —
    // 미리보기로 돌아가면 같은 글을 또 보낼 수 있었다.
    if (id)
        return <PhaseDocking messageId={id} onDocked={onDocked} onHome={onRestart}/>;
    if (!draft?.text || !draft.tone)
        return <MegafontFrame phaseLabel="보내지 못함"><div className="guide-hero"><h1>아직 벽에 닿지 않았어요</h1><p>보낼 글이 없어요. 처음부터 다시 시작해주세요.</p><button className="primary-action" onClick={onRestart}>처음부터</button></div></MegafontFrame>;
    return <PhasePreview text={draft.text} tone={draft.tone} onBack={onEdit} onConfirm={send} busy={busy} error={error}/>;
}
