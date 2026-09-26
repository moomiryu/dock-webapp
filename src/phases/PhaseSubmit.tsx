import { useRef, useState } from 'react';
import PhasePreview from './PhasePreview';
import PhaseDocking from './PhaseDocking';
import MegafontFrame from '../components/MegafontFrame';
import { clearDraft } from '../lib/draft';
import { UserError, submitMessage } from '../lib/firebase';
import { pick, useLang } from '../lib/lang';
import type { Draft } from '../types';

const T = {
    offline: { ko: '인터넷이 끊겨 있어요. 연결을 확인하고 다시 보내주세요.', en: "You're offline. Check your connection and send it again." },
    failed: { ko: '보내는 중에 문제가 생겼어요. 다시 보내주세요.', en: 'Something went wrong while sending. Please send it again.' },
    label: { ko: '보내지 못함', en: 'Not sent' },
    title: { ko: '아직 벽에 닿지 않았어요', en: "It hasn't reached the wall yet" },
    empty: { ko: '보낼 글이 없어요. 처음부터 다시 시작해주세요.', en: 'There is nothing to send. Please start again from the beginning.' },
    restart: { ko: '처음부터', en: 'Start over' }
};
interface Props {
    draft: Draft | null;
    /** 07이 송출 확정을 알린다 — 파이가 잰 꽂힌 순간과 이 참여의 이름표 */
    onDocked: (startedAt: number, session: string) => void;
    onEdit: () => void;
    /** 미리보기의 X — 초기 화면으로. 초안은 지우지 않는다 */
    onHome: () => void;
    onRestart: () => void;
}
export default function PhaseSubmit({ draft, onDocked, onEdit, onHome, onRestart }: Props) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [id, setId] = useState<string | null>(null);
    const locked = useRef(false);
    const lang = useLang();
    async function send() { if (locked.current || !draft?.text || !draft.tone)
        return; locked.current = true; setBusy(true); setError(null); try {
        const result = await submitMessage(draft);
        clearDraft();
        setId(result);
    }
    catch (e) {
        /* 참여자에게 보일 오류(UserError)만 그대로 쓴다. 한글이 있는지로
           가르던 체는 영어 문구를 늘 걸러 냈다(firebase.ts). 언어는 오류가
           난 그 순간의 것이다(pick의 기본값) */
        setError(!navigator.onLine ? pick(T.offline) : e instanceof UserError ? e.message : pick(T.failed));
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
        return <MegafontFrame phaseLabel={pick(T.label, lang)}><div className="guide-hero"><h1>{pick(T.title, lang)}</h1><p>{pick(T.empty, lang)}</p><button className="primary-action" onClick={onRestart}>{pick(T.restart, lang)}</button></div></MegafontFrame>;
    return <PhasePreview text={draft.text} tone={draft.tone} onBack={onEdit} onHome={onHome} onConfirm={send} busy={busy} error={error}/>;
}
