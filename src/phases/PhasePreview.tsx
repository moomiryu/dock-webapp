import { useRef } from 'react';
import StepHeader from '../components/StepHeader';
import DotBubble from '../components/DotBubble';
import PreviewYard, { roomOf, type Rim } from '../components/PreviewYard';
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
 * 5/5 미리보기 — **4/5에서 담은 말풍선을 그대로 보여 주고, 마지막 확인만 받는다** (2026-10-21, 결정 47).
 *
 * 디자이너가 실제 폰에서 본 것: "미리보기 화면에서 끄트머리에 뭐가 보이기만 하고, 중앙에 메시지가 안 뜬다. 다시 보기 버튼도
 * 없애고, 이전 단계의 결과를 그대로 보여 주고 마지막 컨펌만 받는 창으로". 그전(2026-10-20 ~ 21)에는 벽의 큰 말과 한 코드였다
 * (DotBubble show — 정중앙에 크게, 성격별 등장 → 휭 퍼짐 → 머묾 → 모임). 10-20부터 아이폰에서만 이 화면이 비는 일이 있었는데
 * 원인은 끝내 못 찾았다 — 큰 말 등장을 걷으며 그 길도 함께 없어졌다.
 *
 * 이제 4/5와 같은 그림(DotBubble pick)을 **다 모인 마지막 모습으로 멈춰**(still) 무대 가운데에 둔다. 색 · 성격 · 모양 · 크기 셈이
 * 4/5와 같고, 등장 움직임은 없다. 색 · 줄 접기는 벽과 같은 함수(colorsOf · foldLines).
 *
 * 2026-10-29(디자이너): 그 말의 밑동에서 꼬리가 자라고(결정 56의 예외 — 폰에서 꼬리가 있는 곳은 여기뿐), 벽의 작은 사람 둘이 뛰어들어
 * 기뻐하고, 말풍선에서 튕겨 떨어진 부스러기를 눈덩이로 굴려 화면 밖으로 내보낸다(PreviewYard). 한 번만.
 *
 * 무대는 2026-09-27부터 **화면 전체**다(사용자) — 화면째 검정이고 머리줄과 보내기 버튼 사이가 통째로 무대다
 * (app.css · '5/5는 화면 전체가 벽이다'). 시간의 이야기는 발화 종료 화면이 한다.
 */
export default function PhasePreview({ text, tone, onConfirm, onBack, onHome, busy = false, error }: Props) {
    const lang = useLang();
    // 벽과 같은 색 · 줄 — 그림은 4/5와 같은 DotBubble(pick)의 다 모인 모습(결정 47)
    const { bg, text: fg } = colorsOf({ id: 'preview', text, tone, createdAt: 0 });
    const lines = foldLines(text);
    const rim = useRef<Rim | null>(null);
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
   {/* 4/5에서 '이렇게 담을게요'를 누를 때의 그 말 — 모양(기본 · 미소 · 단호)은 tone.align이 정한다 */}
   <DotBubble still lines={lines} tone={tone} bg={bg} fg={fg}
     tail={{ room: roomOf, onRim: (dots, at, floor) => { rim.current = { dots, at, floor }; } }} />
   <PreviewYard rim={rim} color={bg} />
  </div>
 </div></div>
 {error && <p role="alert" className="error-banner">{error}<br />{pick(T.kept, lang)}</p>}
 <button className="primary-action" disabled={busy} aria-busy={busy} aria-label={pick(busy ? T.sending : error ? T.retry : T.send, lang)} onClick={onConfirm}>{busy ? <span className="cta-loading" aria-hidden>…</span> : pick(error ? T.retry : T.send, lang)}</button></div>;
}
