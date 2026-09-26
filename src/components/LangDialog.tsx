import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { setLang, useLang, type Lang } from '../lib/lang';
import { HomeX } from './StepHeader';

/**
 * 홈 캐릭터를 누르면 뜨는 창 (2026-09-26, 사용자 결정).
 *
 * 틀은 확인 창(AskLeave · .ask-veil/.ask-card)과 같다 — 화면을 덮고 가운데에
 * 흰 카드. 처음엔 아래에서 올라오는 판이었는데, 이 앱이 이미 쓰는 가운데
 * 창으로 맞췄다(사용자 결정).
 *
 * 지금은 한 가지 — 화면 언어를 고르는 두 칸 스위치(3/5 말투와 같은 부품,
 * .tswitch · R12). 고르면 그 자리에서 바로 바뀌고 창은 열린 채 남는다.
 * 닫기는 ✕ · 창 바깥 · ESC.
 *
 * 언어 이름은 늘 **그 언어로** 적고(한국어 · English), 제목도 두 언어를 함께
 * 둔다 — 이 창을 찾는 사람은 지금 화면의 언어를 못 읽는 사람이다. 영어
 * 조각에는 lang="en"을 붙인다: 낭독기가 영어 목소리로 읽고, Whois 획 덧대기가
 * 그 조각에만 걸린다(app.css).
 */
const LANGS: Array<{ val: Lang; label: string }> = [
  { val: 'ko', label: '한국어' },
  { val: 'en', label: 'English' }
];

export default function LangDialog({ onClose }: { onClose: () => void }) {
  const lang = useLang();
  const titleId = useId();
  const chosen = useRef<HTMLButtonElement>(null);
  /* 누르던 자리로 초점을 돌려준다 — 창이 닫혀도 손(자판)이 제자리에 있게 */
  const opener = useRef<Element | null>(typeof document !== 'undefined' ? document.activeElement : null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    chosen.current?.focus();
    const back = opener.current;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close.current(); } };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (back instanceof HTMLElement) back.focus();
    };
  }, []);

  return createPortal(
    <div className="ask-veil lang-veil" onClick={(e) => { if (e.target === e.currentTarget) close.current(); }}>
      <div className="ask-card lang-card" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <HomeX onClick={() => close.current()} label="닫기 · Close" />
        <h2 id={titleId}><span lang="ko">언어</span> · <span lang="en">Language</span></h2>
        {/* `한국어 [ | ] English` — 맞닿은 네모 두 칸, 말은 바깥 양옆,
            고른 쪽 칸이 채워진다 */}
        <div className="tswitch" role="radiogroup" aria-labelledby={titleId}>
          {LANGS.map((l) => (
            <button key={l.val} type="button" role="radio" lang={l.val}
              ref={lang === l.val ? chosen : undefined}
              aria-checked={lang === l.val}
              className={'tswitch-side' + (lang === l.val ? ' on' : '')}
              onClick={() => setLang(l.val)}>
              <span className="tswitch-word">{l.label}</span>
              <i className="tswitch-cell" aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
