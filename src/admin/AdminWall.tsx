import { useEffect, useState } from 'react';
import MessageTile from '../components/MessageTile';
import { isFirebaseConfigured, listMessages } from '../lib/firebase';
import type { StoredMessage } from '../lib/firebase';

export default function AdminWall() {
  const [messages, setMessages] = useState<StoredMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.body.classList.remove('themed');
    document.body.style.removeProperty('--bg-outer');

    let cancelled = false;
    (async () => {
      try {
        const m = await listMessages(50);
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
    <div className="admin-wall">
      <header className="admin-wall__header">
        <div className="admin-wall__title">DOCK · 외벽 미리보기</div>
        <div className="admin-wall__meta">
          {isFirebaseConfigured() ? (
            <span>Firebase 연결됨</span>
          ) : (
            <span>로컬 mock 데이터 (Firebase 미설정)</span>
          )}
          {messages && <span> · {messages.length}개</span>}
        </div>
      </header>

      {error && <div className="error-banner">{error}</div>}

      {!messages && !error && <div className="admin-wall__loading">불러오는 중…</div>}

      {messages && messages.length === 0 && (
        <div className="admin-wall__empty">
          아직 메시지가 없어요.<br />
          <a href="/?stage=enter">새 메시지 쓰기</a>
        </div>
      )}

      {messages && messages.length > 0 && (
        <div className="admin-wall__grid">
          {messages.map((m) => (
            <article key={m.id} className="admin-wall__cell">
              <MessageTile text={m.text} tone={m.tone} />
              <footer className="admin-wall__cell-meta">
                <time>{formatTime(m.createdAt)}</time>
                <span className="admin-wall__cell-id">{m.id}</span>
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
