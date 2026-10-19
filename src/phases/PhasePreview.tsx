import { useState } from 'react';
import StepHeader from '../components/StepHeader';
import DotBubble from '../components/DotBubble';
import { colorsOf } from '../lib/messageStyle';
import { foldLines } from '../lib/fit';
import { pick, useLang } from '../lib/lang';
import type { ToneState } from '../types';

/* 이 화면의 말. 영어는 초안이다(2026-09-26, 영문판) */
const T = {
    back: { ko: '다시 담기', en: 'Hold it again' },
    title: { ko: '이렇게 보여요', en: 'This is how it will look' },
    lock: { ko: '보낸 뒤에는 수정할 수 없어요.', en: "You can't edit it after sending." },
    frame: { ko: '벽에 뜨는 모습', en: 'How it will appear on the wall' },
    replay: { ko: '다시 보기', en: 'Replay' },
    kept: { ko: '쓰신 글은 그대로 있어요. 사라지지 않았어요.', en: "Your line is still here. It hasn't been lost." },
    sending: { ko: '전송 중', en: 'Sending' },
    retry: { ko: '다시 보낼게요', en: 'Send it again' },
    send: { ko: '이대로 보낼게요', en: 'Send it as it is' }
};
interface Props {
    text: string;
    tone: ToneState;
    onConfirm: () => void;
    onBack: () => void;
    /** 초기 화면으로. 초안은 지우지 않는다(전송 전이다) */
    onHome: () => void;
    busy?: boolean;
    error?: string | null;
}
/**
 * 5/5 미리보기 — **벽이 그리는 것을 그대로 그린다** (2026-09-24).
 *
 * 전에는 이 화면만의 목업이었다: 샘플 글 여섯이 알약 모양으로 흐르고, 내
 * 글이 튀어 올랐다 작아지는 연출을 따로 짜 두었다. 벽과 다른 코드라서
 * 구름·줄바꿈·크기·등장이 벽과 조금씩 달랐다 — 미리보기가 거짓말을 했다.
 *
 * 이제 벽의 큰 말과 한 코드다 — 2026-10-20(결정 3 · 4)부터 도트 집합체의 큰 말(DotBubble · show): 화면 정중앙에 낱개 상태가
 * 폭의 80%까지, 성격별 등장(쿵 · 몽글 · 착 · 뿅) → 휭 퍼짐 → 머묾 → 모임 → 꼬리. 색 · 줄 접기는 벽과 같은 함수(colorsOf · foldLines).
 * 크기는 이 칸을 재서 정한다.
 *
 * 그 칸은 2026-09-27부터 16:9 액자가 아니라 **화면 전체**다(사용자) — 화면째
 * 검정이고 머리줄과 보내기 버튼 사이가 통째로 벽이다. 벽의 비율이 아니라
 * 이 폰에서 어떻게 뜨는지를 보여 준다(app.css · '5/5는 화면 전체가 벽이다').
 *
 * '꽂혀 있는 동안 · 그 뒤 3일' 표시와 흘러가는 샘플 글은 걷었다. 시간의
 * 이야기는 발화 종료 화면이 한다. 여기 남는 보조 조작은 '다시 보기' 하나다 —
 * 등장을 한 번 더 본다.
 */
/** 크게 머무는 시간(초) — 벽은 도킹이 끝날 때까지(최대 30초), 미리보기는 견본처럼 잠깐 */
const HOLD = 3;

export default function PhasePreview({ text, tone, onConfirm, onBack, onHome, busy = false, error }: Props) {
    const [run, setRun] = useState(0);
    const lang = useLang();
    // 벽과 같은 색 · 줄(2026-10-20, 결정 3 — 큰 말은 DotBubble의 show: 성격별 등장 → 휭 → 머묾 → 모임 → 꼬리)
    const { bg, text: fg } = colorsOf({ id: 'preview', text, tone, createdAt: 0 });
    const lines = foldLines(text);
    return <div className="z-frame preview-screen"><StepHeader at={5} back={{ label: pick(T.back, lang), onClick: () => { if (!busy) onBack(); } }}
      onHome={() => { if (!busy) onHome(); }} />
 {/* 여기가 마지막이라는 것을 말로 해 둔다. 이 뒤(도킹)에는 '이전'이 없다 —
     글은 이미 보내진 뒤라, 거기서 나가는 문은 처음으로만 난다.
     '보낸 뒤에는 수정할 수 없어요'는 튜토리얼 마지막 장의 불변성이 옮겨 온
     것이다 — 행동 **전에** 알아야 하는 것이라 발화 종료 화면이 아니라
     여기 둔다(2026-09-24).

     버튼이 '준비됐어요'였다. **진짜 잠기는 순간이 여기인데** 그 라벨은
     무슨 일이 일어나는지 말하지 않는다 — 다른 확정 버튼은 전부 대상을
     말한다('다 썼어요' · '이렇게 담을게요'). '이대로'가 방금 본 미리보기를
     가리켜서 무엇이 보내지는지가 버튼 안에서 끝나고, 실패했을 때의
     '다시 보낼게요'와도 말이 이어진다. */}
 <div className="z-ask is-brief"><h1>{pick(T.title, lang)}</h1><p>{pick(T.lock, lang)}</p></div>
 <div className="proj-stage"><div className="sim">
  <div className="sim-frame is-wall" aria-label={pick(T.frame, lang)}>
   {/* 벽의 큰 말과 같은 등장 — 정중앙에 크게 서서 잠깐 머문 뒤 모여 꼬리가 솟는다(벽은 도킹이 끝날 때까지 머문다) */}
   <DotBubble key={run} mode="show" hold={HOLD} lines={lines} tone={tone} bg={bg} fg={fg} />
  </div>
  {/* 보조 조작은 이것 하나. 테두리만 있는 작은 버튼이라 아래의 채움
      버튼(보내기)과 무게가 다르다 — 다음으로 가는 길과 섞이지 않는다. */}
  <div className="sim-legend">
   <button type="button" className="sim-replay" onClick={() => setRun(r => r + 1)}>{pick(T.replay, lang)}</button>
  </div>
 </div></div>
 {error && <p role="alert" className="error-banner">{error}<br />{pick(T.kept, lang)}</p>}
 <button className="primary-action" disabled={busy} aria-busy={busy} aria-label={pick(busy ? T.sending : error ? T.retry : T.send, lang)} onClick={onConfirm}>{busy ? <span className="cta-loading" aria-hidden>…</span> : pick(error ? T.retry : T.send, lang)}</button></div>;
}
