import { useEffect, useState } from 'react';
import MessageTile from '../components/MessageTile';
import { adminSignIn, isFirebaseConfigured, listFeedback, listMessages } from '../lib/firebase';
import type { Feedback, StoredMessage } from '../lib/firebase';

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
        <div className="admin-wall__title">MEGAFONT · 벽 미리보기</div>
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

      <FeedbackList />
    </div>
  );
}

/**
 * 받은 제안(완료 화면의 의견 칸, 2026-09-25). 관리자만 읽는다 — 이메일·
 * 비밀번호로 로그인하면 그 표(idToken)로 읽고, 표는 이 탭이 닫힐 때까지만
 * 쥔다(sessionStorage). 규칙(firestore.rules · feedback)이 관리자 계정 하나만
 * 통과시킨다. 가장 최근이 위, 줄 사이는 1px 선.
 */
const TOKEN_KEY = 'megafont.admin.idToken';
function FeedbackList() {
  const [token, setToken] = useState<string | null>(() => {
    if (!isFirebaseConfigured()) return 'mock';
    try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
  });
  const [items, setItems] = useState<Feedback[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    listFeedback(token).then((l) => { if (!cancelled) { setItems(l); setError(null); } })
      .catch((e: Error) => { if (!cancelled) { setError(e.message); setItems(null); try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* */ } setToken(null); } });
    return () => { cancelled = true; };
  }, [token]);
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const t = await adminSignIn(email.trim(), password);
      try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* */ }
      setPassword('');
      setToken(t);
    } catch (err) { setError((err as Error).message); }
  }
  return (
    <section className="admin-feedback" aria-labelledby="admin-feedback-title">
      <h2 id="admin-feedback-title" className="admin-feedback__title">
        제안{items ? ` ${items.length}건` : ''} <span className="admin-feedback__note">가장 최근이 위</span>
      </h2>
      {error && <p className="admin-feedback__error" role="alert">{error}</p>}
      {!token && (
        <form className="admin-feedback__login" onSubmit={signIn}>
          <label>관리자 이메일<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>비밀번호<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          <button type="submit">로그인</button>
        </form>
      )}
      {token && !items && !error && <p className="admin-feedback__note">불러오는 중…</p>}
      {items && items.length === 0 && <p className="admin-feedback__note">아직 받은 제안이 없어요.</p>}
      {items && items.length > 0 && (
        <ul className="admin-feedback__list">
          {items.map((f) => (
            <li key={f.id}>
              <time>{new Date(f.createdAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
              <p>{f.text}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
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
