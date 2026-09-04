import { useEffect, useState } from 'react';
import MegafontFrame from '../components/MegafontFrame';
import PhaseProcessing from './PhaseProcessing';
import PhaseDocking from './PhaseDocking';
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

// 전송을 맡고, 그 상태에 따라 05(보내는 중)와 06(도킹)을 갈아 끼운다.
// 두 화면은 각자 파일로 나뉘어 있고 여기는 순서만 정한다.
export default function PhaseSubmit({ draft, onRestart }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'sending' });
  const [progress, setProgress] = useState(0);

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

  // 완료율을 알 수 없는 단일 요청이라, 경과 시간으로 90%까지만 채운다.
  useEffect(() => {
    if (status.kind !== 'sending') return;
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const t = (Date.now() - startedAt) / 1000;
      setProgress(Math.min(0.9, 1 - Math.exp(-t / 1.3)));
    }, 80);
    return () => clearInterval(id);
  }, [status.kind]);

  if (status.kind === 'sending') {
    return <PhaseProcessing progress={progress} />;
  }

  if (status.kind === 'sent') {
    return (
      <PhaseDocking
        onRestart={onRestart}
        devNote={
          isFirebaseConfigured()
            ? null
            : `개발 모드 — Firebase 미연결, 로컬 mock 전송 · id ${status.id}`
        }
      />
    );
  }

  return (
    <MegafontFrame phaseLabel="실패">
      <div className="guide-hero">
        <h1>보내지 못했어요</h1>
        <p>{status.message}</p>
        <button className="primary-action" onClick={onRestart}>
          <span>다시 쓰기</span>
        </button>
      </div>
    </MegafontFrame>
  );
}
