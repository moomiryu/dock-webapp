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
    <MegafontFrame phaseLabel="외벽에 합류했어요">
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
            <div className="glyph" aria-hidden>✶</div>
            <h1>외벽에 합류했어요</h1>
            <p>
              7일간 외벽에 머무릅니다.
            </p>
            {!isFirebaseConfigured() && (
              <p style={{ fontSize: 10, opacity: 0.55 }}>
                (개발 모드 — Firebase 미연결, 로컬 mock 전송)
                <br />
                id: {status.id}
              </p>
            )}
            <div className="done-actions">
              <a className="primary-action" href="/archive">
                <span>아카이브 보기 →</span>
              </a>
              <button className="done-home-link" onClick={onRestart}>
                처음으로
              </button>
            </div>
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
