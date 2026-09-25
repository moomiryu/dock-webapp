import { useState } from 'react';
import MegafontFrame from '../components/MegafontFrame';
import { FEEDBACK_MAX, submitFeedback } from '../lib/firebase';
import { STAY_DAYS } from '../lib/wall';
interface Props {
    stillDocked: boolean;
    onRestart: () => void;
}
/**
 * 발화 종료. 튜토리얼 마지막 장('그러면 끝입니다')이 여기로 왔다(2026-09-24).
 * 사라지는 날짜와 익명·삭제 원칙은 **다 하고 난 뒤**에 읽혀야 제 뜻이 선다 —
 * 시작도 전에 들으면 규칙 목록일 뿐이다. 3일은 wall.ts에서 받아 온다.
 *
 * 불변성('보낸 뒤에는 수정할 수 없습니다')은 여기 두지 않는다. 행동 **전에**
 * 알아야 하는 것이라 5/5 확인 화면이 들고 있다 — 다 보낸 뒤에 말하면 늦다.
 *
 * 2026-09-25: '한 줄 더 쓰기' 아래에 푸터가 붙었다 — 의견 칸과 만든 사람 줄.
 * 상자 없이 화면 끝까지 가는 선 하나와 여백으로만 묶는다. 테두리 칸 버튼은
 * '한 줄 더 쓰기' 하나뿐이다(이 화면의 주 행동). '보내기'는 글자 버튼이다.
 */
export default function PhaseDone({ onRestart }: Props) {
    return <MegafontFrame phaseLabel="완료"><div className="done done-simple">
      <h1>발화 종료</h1>
      <p className="done-after">메아리처럼 화면을 맴돌며,<br /><b>{STAY_DAYS}일 후에 사라집니다.</b></p>
      <dl className="info-rules">
        <div>
          <dt>익명성</dt>
          <dd>누가 썼는지는 남지 않습니다.</dd>
        </div>
        <div>
          <dt>운영 원칙</dt>
          <dd>타인에게 피해를 주거나 문제가 되는 글은 관리자가 삭제할 수 있습니다.</dd>
        </div>
      </dl>
      <button className="done-home-link" onClick={onRestart}>한 줄 더 쓰기</button>
      <footer className="done-footer">
        <FeedbackForm />
        <p className="done-credits">© 2026 WoongandRyu<br />기획·디자인·개발 류주성</p>
      </footer>
    </div></MegafontFrame>;
}

/** 같은 기기에서 다시 보낼 수 있기까지 — 연달아 보내기를 앱에서 막는다(서버가 없어 규칙은 못 센다) */
const COOLDOWN_MS = 60_000;
const LAST_KEY = 'megafont.feedback.last';
const lastSent = () => { try { return Number(localStorage.getItem(LAST_KEY) ?? 0); } catch { return 0; } };

/**
 * 의견 칸. 받는 것은 본문뿐이고(보낸 시각은 서버가 적는다), 이메일 같은 다른
 * 것은 묻지 않는다. 빈 글은 보내지 않는다. 보내면 칸이 닫히고 그 자리에
 * 고맙다는 한 줄이 선다 — 같은 화면에서 두 번 보낼 수 없다.
 */
function FeedbackForm() {
    const [text, setText] = useState('');
    const [state, setState] = useState<'idle' | 'busy' | 'sent'>('idle');
    const [error, setError] = useState<string | null>(null);
    const trimmed = text.trim();
    const cooling = Date.now() - lastSent() < COOLDOWN_MS;
    async function send(e: React.FormEvent) {
        e.preventDefault();
        if (!trimmed || state !== 'idle') return;
        if (cooling) { setError('조금 전에 보내셨어요. 1분 뒤에 다시 보내주세요.'); return; }
        setState('busy'); setError(null);
        try {
            await submitFeedback(trimmed);
            try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* 막힌 저장소 — 이번 화면만 막는다 */ }
            setState('sent');
        } catch (err) {
            setError((err as Error).message);
            setState('idle');
        }
    }
    return <form className="feedback" onSubmit={send} aria-labelledby="feedback-title">
      <h2 id="feedback-title" className="feedback-title">더 있었으면 하는 것, 불편했던 것</h2>
      <p id="feedback-desc" className="feedback-desc">새로운 말투나 고쳤으면 하는 점을 알려주세요.</p>
      {state === 'sent'
        ? <p className="feedback-done" role="status">제안을 보냈어요. 고맙습니다.</p>
        : <>
          <textarea className="feedback-input" value={text} maxLength={FEEDBACK_MAX} rows={3}
            aria-labelledby="feedback-title" aria-describedby="feedback-desc"
            placeholder="예: 능청스러운 말투도 있었으면 좋겠어요"
            onChange={e => { setText(e.target.value); setError(null); }} />
          <div className="feedback-foot">
            {error && <span className="feedback-error" role="alert">{error}</span>}
            <button type="submit" className="feedback-send" disabled={!trimmed || state === 'busy'}
              aria-busy={state === 'busy'}>{state === 'busy' ? '보내는 중' : '보내기'}</button>
          </div>
        </>}
    </form>;
}
