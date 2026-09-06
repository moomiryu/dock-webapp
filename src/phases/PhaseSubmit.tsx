import { useCallback, useEffect, useRef, useState } from 'react';
import MegafontFrame from '../components/MegafontFrame';
import PhaseProcessing from './PhaseProcessing';
import PhaseDocking from './PhaseDocking';
import { clearDraft } from '../lib/draft';
import { isFirebaseConfigured, submitMessage } from '../lib/firebase';
import type { Draft } from '../types';

type Status =
  | { kind: 'sending' }
  | { kind: 'sent'; id: string }
  | { kind: 'error'; message: string; detail?: string };

interface Props {
  draft: Draft | null;
  /** 폰이 홈에 꽂혔을 때 — 다음은 벽에 떠 있는 화면(07) */
  onDocked: () => void;
  /** 실패했을 때 고쳐 쓰러 돌아가는 길 (04 미리보기) */
  onEdit: () => void;
  onRestart: () => void;
}

/** 전송 화면이 최소한 머무는 시간 (ms) */
const FLOOR_MS = 800;
/** 막대가 끝까지 찬 것을 보여주고 넘어가기까지 (ms) */
const SETTLE_MS = 340;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * 실패 사유를 사람이 읽을 수 있는 말로 옮긴다.
 * 원문(HTTP 상태·Firestore 코드)은 버리지 않고 접어 둔다 — 현장에서
 * 무엇이 잘못됐는지 물어볼 사람이 필요하다.
 */
function explain(err: unknown): { message: string; detail?: string } {
  const raw = err instanceof Error ? err.message : String(err);

  // 연결 자체가 끊긴 건 우리가 가장 잘 안다 — 아래 어떤 사유보다 먼저다
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { message: '인터넷이 끊겨 있어요. 연결을 확인하고 다시 보내주세요.', detail: raw };
  }

  // lib/firebase.ts는 이미 사람 말로 옮겨서 던진다. 그 위에 한 겹 더 씌우면
  // 같은 이야기가 두 번 나온다.
  if (/[가-힣]/.test(raw)) return { message: raw };

  if (/timeout|abort|network|failed to fetch/i.test(raw)) {
    return { message: '벽에 닿지 못했어요. 잠시 뒤 다시 보내주세요.', detail: raw };
  }
  if (/40[13]|permission/i.test(raw)) {
    return { message: '지금은 글을 받을 수 없는 상태예요. 운영자에게 알려주세요.', detail: raw };
  }
  return { message: '보내는 중에 문제가 생겼어요. 다시 보내주세요.', detail: raw };
}

// 전송을 맡고, 그 상태에 따라 05(보내는 중)와 06(도킹)을 갈아 끼운다.
// 두 화면은 각자 파일로 나뉘어 있고 여기는 순서만 정한다.
export default function PhaseSubmit({ draft, onDocked, onEdit, onRestart }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'sending' });
  const [progress, setProgress] = useState(0);
  const [attempt, setAttempt] = useState(0);

  // 한 번의 시도는 한 번만 보낸다.
  //
  // StrictMode는 개발에서 효과를 두 번 돌리고, 그때마다 submitMessage를
  // 부르면 같은 한 줄이 벽에 두 번 뜬다(실제로 그렇게 됐다). cancelled
  // 플래그는 상태 갱신만 막지 요청은 못 막는다. 그래서 시도 번호로
  // 약속을 캐싱해 두 번째 실행이 같은 약속을 기다리게 한다 —
  // 요청은 하나, 결과는 양쪽 다 받는다.
  const sending = useRef<{ attempt: number; promise: Promise<string> } | null>(null);

  useEffect(() => {
    if (!draft || !draft.text) {
      setStatus({ kind: 'error', message: '보낼 글이 없어요. 처음부터 다시 시작해주세요.' });
      return;
    }
    let cancelled = false;
    setStatus({ kind: 'sending' });
    setProgress(0);
    (async () => {
      try {
        // 전송이 빠르면 이 화면이 한 프레임 스치고 사라진다. 그러면 보낸
        // 사람은 무언가 일어났는지조차 알 수 없다. 최소 시간을 지키고,
        // 응답이 온 뒤 막대를 끝까지 채워 '끝났다'를 눈으로 보여준 다음 넘긴다.
        if (!sending.current || sending.current.attempt !== attempt) {
          sending.current = { attempt, promise: submitMessage(draft) };
        }
        const [id] = await Promise.all([sending.current.promise, wait(FLOOR_MS)]);
        if (cancelled) return;
        setProgress(1);
        await wait(SETTLE_MS);
        if (cancelled) return;
        clearDraft();
        setStatus({ kind: 'sent', id });
      } catch (err) {
        if (!cancelled) {
          // 초안은 지우지 않는다. 실패한 전송 때문에 쓴 글을 잃으면 안 된다.
          setStatus({ kind: 'error', ...explain(err) });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draft, attempt]);

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

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (status.kind === 'sending') {
    return <PhaseProcessing progress={progress} />;
  }

  if (status.kind === 'sent') {
    return (
      <PhaseDocking
        messageId={status.id}
        onDocked={onDocked}
        devNote={
          isFirebaseConfigured()
            ? null
            : `개발 모드 — Firebase 미연결, 로컬 mock 전송 · id ${status.id}`
        }
      />
    );
  }

  const hasDraft = Boolean(draft?.text);

  return (
    <MegafontFrame phaseLabel="보내지 못함">
      <div className="guide-hero">
        <h1>아직 벽에 닿지 않았어요</h1>
        <p>{status.message}</p>

        {hasDraft && (
          <p className="fail-keep">쓰신 글은 그대로 있어요. 사라지지 않았습니다.</p>
        )}

        {hasDraft ? (
          <>
            <button className="primary-action" onClick={retry}>
              <span>다시 보내기</span>
            </button>
            <button className="done-home-link" onClick={onEdit}>
              고쳐 쓰기
            </button>
          </>
        ) : (
          <button className="primary-action" onClick={onRestart}>
            <span>처음부터</span>
          </button>
        )}

        {status.detail && <p className="dev-note">{status.detail}</p>}
      </div>
    </MegafontFrame>
  );
}
