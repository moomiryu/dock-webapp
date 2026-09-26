import { useState } from 'react';
import MegafontFrame from '../components/MegafontFrame';
import { FEEDBACK_MAX, submitFeedback } from '../lib/firebase';
import { STAY_DAYS } from '../lib/wall';
import { count, pick, useLang } from '../lib/lang';

/* 이 화면의 말. 영어는 초안이다(2026-09-26, 영문판). 장치가 하는 말(합니다체)은
   영어에서도 차분한 평서문으로 둔다 */
const T = {
    label: { ko: '완료', en: 'Done' },
    title: { ko: '발화 종료', en: 'Speech ended' },
    /* 이 문단은 세로로 쌓는 칸(app.css .done-after, flex)이라 글과 굵은 조각이
       늘 따로 선다. 한 문장으로 옮기면 'and'에서 끊겨 보여서, 영어는 두 문장으로
       나눠 그 자리가 문장 사이가 되게 한다 */
    after: {
        ko: <>메아리처럼 화면을 맴돌며,<br /><b>{STAY_DAYS}일 후에 사라집니다.</b></>,
        en: <>Like an echo, it will drift around the screen. <b>It disappears after {count(STAY_DAYS, 'day', 'days')}.</b></>
    },
    anonT: { ko: '익명성', en: 'Anonymity' },
    anonD: { ko: '누가 썼는지는 남지 않습니다.', en: 'No record is kept of who wrote it.' },
    rulesT: { ko: '운영 원칙', en: 'House rules' },
    rulesD: { ko: '타인에게 피해를 주거나 문제가 되는 글은 관리자가 삭제할 수 있습니다.', en: 'Lines that harm others or cause problems may be removed by an administrator.' },
    again: { ko: '한 줄 더 쓰기', en: 'Write another line' },
    /* 이름은 옮기지 않았다 — 로마자 표기는 본인이 정한다 */
    credits: { ko: '기획·디자인·개발 류주성', en: 'Concept · Design · Development 류주성' },
    cooling: { ko: '조금 전에 보내셨어요. 1분 뒤에 다시 보내주세요.', en: 'You sent one a moment ago. Please send again in 1 minute.' },
    fbTitle: { ko: '더 있었으면 하는 것, 불편했던 것', en: 'What you would like to see, what got in your way' },
    fbDesc: { ko: '새로운 말투나 고쳤으면 하는 점을 알려주세요.', en: "Tell us about a new tone you'd like, or anything we should fix." },
    fbDone: { ko: '제안을 보냈어요. 고맙습니다.', en: 'Your suggestion has been sent. Thank you.' },
    fbHolder: { ko: '예: 능청스러운 말투도 있었으면 좋겠어요', en: "e.g. I'd love a teasing, tongue-in-cheek tone too" },
    sending: { ko: '보내는 중', en: 'Sending' },
    send: { ko: '보내기', en: 'Send' }
};
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
    const lang = useLang();
    return <MegafontFrame phaseLabel={pick(T.label, lang)}><div className="done done-simple">
      <h1>{pick(T.title, lang)}</h1>
      <p className="done-after">{pick(T.after, lang)}</p>
      <dl className="info-rules">
        <div>
          <dt>{pick(T.anonT, lang)}</dt>
          <dd>{pick(T.anonD, lang)}</dd>
        </div>
        <div>
          <dt>{pick(T.rulesT, lang)}</dt>
          <dd>{pick(T.rulesD, lang)}</dd>
        </div>
      </dl>
      <button className="done-home-link" onClick={onRestart}>{pick(T.again, lang)}</button>
      <footer className="done-footer">
        <FeedbackForm />
        <p className="done-credits">© 2026 WoongandRyu<br />{pick(T.credits, lang)}</p>
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
    const lang = useLang();
    const trimmed = text.trim();
    const cooling = Date.now() - lastSent() < COOLDOWN_MS;
    async function send(e: React.FormEvent) {
        e.preventDefault();
        if (!trimmed || state !== 'idle') return;
        if (cooling) { setError(pick(T.cooling, lang)); return; }
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
      <h2 id="feedback-title" className="feedback-title">{pick(T.fbTitle, lang)}</h2>
      <p id="feedback-desc" className="feedback-desc">{pick(T.fbDesc, lang)}</p>
      {state === 'sent'
        ? <p className="feedback-done" role="status">{pick(T.fbDone, lang)}</p>
        : <>
          <textarea className="feedback-input" value={text} maxLength={FEEDBACK_MAX} rows={3}
            aria-labelledby="feedback-title" aria-describedby="feedback-desc"
            placeholder={pick(T.fbHolder, lang)}
            onChange={e => { setText(e.target.value); setError(null); }} />
          <div className="feedback-foot">
            {error && <span className="feedback-error" role="alert">{error}</span>}
            <button type="submit" className="feedback-send" disabled={!trimmed || state === 'busy'}
              aria-busy={state === 'busy'}>{pick(state === 'busy' ? T.sending : T.send, lang)}</button>
          </div>
        </>}
    </form>;
}
