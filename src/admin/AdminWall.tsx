import { useCallback, useEffect, useState } from 'react';
import MessageTile from '../components/MessageTile';
import { adminSignIn, deleteMessage, isFirebaseConfigured, listFeedback, listMessagesSince } from '../lib/firebase';
import type { Feedback, StoredMessage } from '../lib/firebase';
import { STAY_MS } from '../lib/wall';

/**
 * 관리자 로그인 — 이메일 · 비밀번호로 받은 표(idToken)를 이 탭이 닫힐 때까지만
 * 쥔다(sessionStorage). 표는 한 시간 간다. 규칙(firestore.rules · isAdmin)이 관리자
 * 계정 하나만 통과시킨다.
 *
 * 맨 위에 하나다(2026-10-20). 제안 목록 밑에 있던 것을 글 내리기와 같이 쓰려고
 * 올렸다 — 한 번 로그인하면 둘 다 된다.
 */
const TOKEN_KEY = 'megafont.admin.idToken';
function readToken(): string | null {
  if (!isFirebaseConfigured()) return 'mock';
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export default function AdminWall() {
  const [messages, setMessages] = useState<StoredMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(readToken);
  const [authError, setAuthError] = useState<string | null>(null);
  /** 표가 안 먹으면(시간이 지났거나 권한이 없으면) 버리고 다시 로그인하게 한다.
      FeedbackList의 효과가 이걸 지켜보므로 한 번만 만든다 — 매번 새로 만들면 효과가 매번 다시 돈다 */
  const dropToken = useCallback((why: string) => {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* */ }
    setToken(null);
    setAuthError(why);
  }, []);

  useEffect(() => {
    document.body.classList.remove('themed');
    document.body.style.removeProperty('--bg-outer');

    let cancelled = false;
    (async () => {
      try {
        /* 벽에 지금 떠 있는 사흘 치 전부(2026-10-20). 최근 50개로 자르던 것을
           바꿨다 — 붐비는 날 50개 밖으로 밀린 글은 내릴 수가 없었다 */
        const m = await listMessagesSince(Date.now() - STAY_MS);
        if (!cancelled) setMessages(m);
      } catch (err) {
        if (!cancelled) setError((err as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * 글을 벽에서 내린다. 되돌릴 수 없으니 한 번 묻는다 — 어느 글인지 본문을
   * 같이 보여 준다. 브라우저의 확인 창을 쓴다: 운영자 화면이고, 묻는 것이 전부다.
   */
  async function takeDown(m: StoredMessage) {
    if (!token) return;
    if (!window.confirm(`이 글을 벽에서 내릴까요? 되돌릴 수 없어요.\n\n${m.text}`)) return;
    try {
      await deleteMessage(m.id, token);
      setMessages((list) => list?.filter((x) => x.id !== m.id) ?? list);
    } catch (e) {
      dropToken((e as Error).message);
    }
  }

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

      {!token && <AdminLogin error={authError} onToken={(t) => { setAuthError(null); setToken(t); }} />}

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
              {token && <button type="button" className="admin-wall__takedown" onClick={() => takeDown(m)}>내리기</button>}
            </article>
          ))}
        </div>
      )}

      <FeedbackList token={token} onDenied={dropToken} />
    </div>
  );
}

function AdminLogin({ error, onToken }: { error: string | null; onToken: (t: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState<string | null>(null);
  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setFailed(null);
    try {
      const t = await adminSignIn(email.trim(), password);
      try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* */ }
      setPassword('');
      onToken(t);
    } catch (err) { setFailed((err as Error).message); }
  }
  const say = failed ?? error;
  return (
    <form className="admin-login" onSubmit={signIn}>
      <p className="admin-login__note">관리자로 로그인하면 글을 내리고 제안을 읽을 수 있어요.</p>
      {say && <p className="admin-login__error" role="alert">{say}</p>}
      <label>관리자 이메일<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
      <label>비밀번호<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      <button type="submit">로그인</button>
    </form>
  );
}

/**
 * 받은 제안(완료 화면의 의견 칸, 2026-09-25). 관리자만 읽는다 — 위 로그인의
 * 표로 읽는다. 가장 최근이 위, 줄 사이는 1px 선.
 */
function FeedbackList({ token, onDenied }: { token: string | null; onDenied: (why: string) => void }) {
  const [items, setItems] = useState<Feedback[] | null>(null);
  useEffect(() => {
    if (!token) { setItems(null); return; }
    let cancelled = false;
    listFeedback(token).then((l) => { if (!cancelled) setItems(l); })
      .catch((e: Error) => { if (!cancelled) onDenied(e.message); });
    return () => { cancelled = true; };
  }, [token, onDenied]);
  return (
    <section className="admin-feedback" aria-labelledby="admin-feedback-title">
      <h2 id="admin-feedback-title" className="admin-feedback__title">
        제안{items ? ` ${items.length}건` : ''} <span className="admin-feedback__note">가장 최근이 위</span>
      </h2>
      {!token && <p className="admin-feedback__note">로그인하면 보여요.</p>}
      {token && !items && <p className="admin-feedback__note">불러오는 중…</p>}
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
