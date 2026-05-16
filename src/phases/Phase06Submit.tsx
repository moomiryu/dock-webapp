import { useEffect, useState } from 'react';
import DockFrame from '../components/DockFrame';
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

export default function Phase06Submit({ draft, onRestart }: Props) {
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
    <DockFrame phaseLabel="PHASE 06 / 도킹 완료">
      <div className="guide-hero">
        {status.kind === 'sending' && (
          <>
            <div className="glyph" aria-hidden>↑</div>
            <h1>외벽으로 보내는 중…</h1>
            <p>잠시만 기다려주세요.</p>
          </>
        )}

        {status.kind === 'sent' && (
          <>
            <div className="glyph" aria-hidden>✶</div>
            <h1>메시지가 외벽에 떠올랐어요</h1>
            <p>
              7일 동안 풍경의 일부가 됩니다.<br />
              이제 폰을 거치대에서 떼셔도 좋아요.
            </p>
            {!isFirebaseConfigured() && (
              <p style={{ fontSize: 10, opacity: 0.55 }}>
                (개발 모드 — Firebase 미연결, 로컬 mock 전송)
                <br />
                id: {status.id}
              </p>
            )}
          </>
        )}

        {status.kind === 'error' && (
          <>
            <div className="glyph" aria-hidden>!</div>
            <h1>전송에 실패했어요</h1>
            <p>{status.message}</p>
            <button className="primary-action" onClick={onRestart} style={{ marginTop: 8 }}>
              <span>처음으로</span>
            </button>
          </>
        )}
      </div>
    </DockFrame>
  );
}
