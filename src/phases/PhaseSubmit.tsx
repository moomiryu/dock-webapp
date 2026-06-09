import { useEffect, useState } from 'react';
import MegafontFrame from '../components/MegafontFrame';
import { clearDraft } from '../lib/draft';
import { isFirebaseConfigured, submitMessage } from '../lib/firebase';
import type { Draft } from '../types';

type Status =
  | { kind: 'sending' }
  | { kind: 'sent'; id: string }
  | { kind: 'error'; message: string };

interface Props {
  draft: Draft | null;
  onRestart: () => void;
}

export default function PhaseSubmit({ draft, onRestart }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'sending' });

  useEffect(() => {
    if (!draft || !draft.text) {
      setStatus({ kind: 'error', message: '저장된 메시지가 없어요. 처음부터 다시 시작해주세요.' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const id = await submitMessage(draft);
        if (!cancelled) {
          clearDraft();
          setStatus({ kind: 'sent', id });
        }
      } catch (err) {
        if (!cancelled) {
          setStatus({ kind: 'error', message: (err as Error).message });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft]);

  return (
    <MegafontFrame phaseLabel="거치대에 올려주세요">
      <div className="guide-hero">
        {status.kind === 'sending' && (
          <>
            <div className="glyph" aria-hidden>↑</div>
            <h1>외벽으로 보내는 중…</h1>
            <p>잠시만요.</p>
          </>
        )}

        {status.kind === 'sent' && (
          <>
            <div className="glyph" aria-hidden>↓</div>
            <h1>이제 거치대에 올려주세요</h1>
            <p>
              폰을 슬롯에 가만히 꽂으면,<br />
              당신의 한 줄이 외벽 한가운데 떠올라요.
            </p>
            <p style={{ fontSize: 12, opacity: 0.5, marginTop: 4 }}>
              외벽엔 7일간 머무릅니다.
            </p>
            {!isFirebaseConfigured() && (
              <p style={{ fontSize: 10, opacity: 0.55 }}>
                (개발 모드 — Firebase 미연결, 로컬 mock 전송)
                <br />
                id: {status.id}
              </p>
            )}
            <button className="done-home-link" onClick={onRestart} style={{ marginTop: 18 }}>
              처음으로
            </button>
          </>
        )}

        {status.kind === 'error' && (
          <>
            <div className="glyph" aria-hidden>!</div>
            <h1>보내지 못했어요</h1>
            <p>{status.message}</p>
            <button className="primary-action" onClick={onRestart} style={{ marginTop: 8 }}>
              <span>다시 쓰기</span>
            </button>
          </>
        )}
      </div>
    </MegafontFrame>
  );
}
