import { useEffect, useState } from 'react';
import MessageTile from '../components/MessageTile';
import { listMessages } from '../lib/firebase';
import type { StoredMessage } from '../lib/firebase';

// Public archive — every utterance posted so far, separate from the /wall
// projection. Reuses the admin grid styling but with a friendlier framing
// and no internal message ids.
export default function ArchiveView() {
  const [messages, setMessages] = useState<StoredMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.remove('themed');
    document.body.style.removeProperty('--bg-outer');

    let cancelled = false;
    (async () => {
      try {
        const m = await listMessages(100);
        if (!cancelled) setMessages(m);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="admin-wall archive">
      <header className="admin-wall__header">
        <a className="archive__home-link" href="/">← 처음으로</a>
        <div className="admin-wall__title">MEGAFONT · 아카이브</div>
        <div className="admin-wall__meta">
          <span>지금까지의 발화</span>
          {messages && <span> · {messages.length}개</span>}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {!messages && !error && <div className="admin-wall__loading">불러오는 중…</div>}

      {messages && messages.length === 0 && (
        <div className="admin-wall__empty">
          아직 올라온 발화가 없어요.<br />
          <a href="/?stage=enter">첫 한 줄 남기기</a>
        </div>
      )}

      {messages && messages.length > 0 && (
        <div className="admin-wall__grid">
          {messages.map((m) => (
            <article key={m.id} className="admin-wall__cell">
              <MessageTile text={m.text} tone={m.tone} />
              <footer className="admin-wall__cell-meta">
                <time>{formatTime(m.createdAt)}</time>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  const diffMs = Date.now() - ms;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return '방금';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
