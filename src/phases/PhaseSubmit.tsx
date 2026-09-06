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
  /** 폰이 홈에 꽂혔을 때 — 다음은 외벽에 떠 있는 화면(07) */
  onDocked: () => void;
  onRestart: () => void;
}

/** 전송 화면이 최소한 머무는 시간 (ms) */
const FLOOR_MS = 800;
/** 막대가 끝까지 찬 것을 보여주고 넘어가기까지 (ms) */
const SETTLE_MS = 340;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// 전송을 맡고, 그 상태에 따라 05(보내는 중)와 06(도킹)을 갈아 끼운다.
// 두 화면은 각자 파일로 나뉘어 있고 여기는 순서만 정한다.
export default function PhaseSubmit({ draft, onDocked, onRestart }: Props) {
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
        // 전송이 빠르면 이 화면이 한 프레임 스치고 사라진다. 그러면 보낸
        // 사람은 무언가 일어났는지조차 알 수 없다. 최소 시간을 지키고,
        // 응답이 온 뒤 막대를 끝까지 채워 '끝났다'를 눈으로 보여준 다음 넘긴다.
        const [id] = await Promise.all([submitMessage(draft), wait(FLOOR_MS)]);
        if (cancelled) return;
        setProgress(1);
        await wait(SETTLE_MS);
        if (cancelled) return;
        clearDraft();
        setStatus({ kind: 'sent', id });
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
      // 응답이 와서 1로 채운 뒤에는 되감지 않는다
      setProgress((p) => (p >= 1 ? p : Math.min(0.9, 1 - Math.exp(-t / 1.3))));
    }, 80);
    return () => clearInterval(id);
  }, [status.kind]);

  if (status.kind === 'sending') {
    return <PhaseProcessing progress={progress} />;
  }

  if (status.kind === 'sent') {
    return (
      <PhaseDocking
        onDocked={onDocked}
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
