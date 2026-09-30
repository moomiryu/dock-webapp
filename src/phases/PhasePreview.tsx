import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import StepHeader from '../components/StepHeader';
import { BIG_SIDE_MAX_VW, BIG_SIDE_VH, WallShowMessage } from '../admin/WallSimulation';
import type { StoredMessage } from '../lib/firebase';
import { fillFromLegacySize, phoneSide } from '../lib/fit';
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
 * 이제 /wall의 발화 부품(WallShowMessage)을 빌려 온다. 색을 읽는 법, 구름,
 * 줄 접기, 글자 크기, 들어오는 결(wallBoxIn)이 벽과 한 코드다. 다른 것은
 * 기준이 되는 한 변뿐이다: 벽은 화면(vh·vw)에 대고 재고, 여기서는 그 칸
 * (cqh·cqw)에 대고 같은 비율로 잰다.
 *
 * 그 칸은 2026-09-27부터 16:9 액자가 아니라 **화면 전체**다(사용자) — 화면째
 * 검정이고 머리줄과 보내기 버튼 사이가 통째로 벽이다. 벽의 비율이 아니라
 * 이 폰에서 어떻게 뜨는지를 보여 준다(app.css · '5/5는 화면 전체가 벽이다').
 * 2026-09-29부터는 크기도 벽의 비율을 따르지 않는다 — 폰에서 잘 보이게 늘린다(아래 frame).
 *
 * '꽂혀 있는 동안 · 그 뒤 3일' 표시와 흘러가는 샘플 글은 걷었다. 시간의
 * 이야기는 발화 종료 화면이 한다. 여기 남는 보조 조작은 '다시 보기' 하나다 —
 * 등장을 한 번 더 본다.
 */
export default function PhasePreview({ text, tone, onConfirm, onBack, onHome, busy = false, error }: Props) {
    const [run, setRun] = useState(0);
    const lang = useLang();
    // 벽 부품이 받는 꼴. 아직 저장 전이라 id·시각은 이 화면의 자리표다
    const msg = useMemo<StoredMessage>(() => ({ id: 'preview', text, tone, createdAt: 0 }), [text, tone]);
    /* 한 변 — 벽 부품이 쓰는 벽 비율(높이 95% · 폭 88% 중 작은 쪽)을 폰에서 잘 보이게 늘린다
       (2026-09-29, 사용자 — 폰에서 너무 작았다. fit.ts · phoneSide). 말풍선의 비례(폭 · 높이가
       한 변의 몇 배인가)는 **그려진 말풍선을 재서** 얻는다: 벽 부품이 글을 어떻게 접고 어떤
       모양을 짓는지를 여기서 다시 계산하지 않으려고(둘이 어긋나면 크기가 틀린다). 자(side)는
       같은 한 변을 폭으로 가진 보이지 않는 막대다 — 말풍선도 자도 같은 한 변에 비례하니 둘의
       비는 한 변을 늘려도 같다. 칠하기 전에 잰다. */
    const base = `min(${BIG_SIDE_VH}cqh, ${BIG_SIDE_MAX_VW}cqw)`;
    const [shape, setShape] = useState<{ w: number; h: number } | null>(null);
    const frameRef = useRef<HTMLDivElement>(null);
    const side = useRef<HTMLElement>(null);
    useLayoutEffect(() => {
        const measure = () => {
            const bubble = frameRef.current?.querySelector<HTMLElement>('.wall-show-box > *');
            const unit = side.current?.offsetWidth;
            if (!bubble || !unit) return;
            const w = bubble.offsetWidth / unit, h = bubble.offsetHeight / unit;
            setShape((s) => (s && Math.abs(s.w - w) < 0.001 && Math.abs(s.h - h) < 0.001 ? s : { w, h }));
        };
        measure();
        const ro = new ResizeObserver(measure);
        if (frameRef.current) ro.observe(frameRef.current);
        return () => ro.disconnect();
    }, [msg]);
    const frame = { '--big-side': shape ? phoneSide(base, shape.w, shape.h, fillFromLegacySize(tone.size)) : base } as CSSProperties;
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
  <div ref={frameRef} className="sim-frame is-wall" style={frame} aria-label={pick(T.frame, lang)}>
   <i ref={side} className="preview-side" aria-hidden />
   {/* 폰 미리보기는 글을 화면 한가운데에(2026-09-30, 디자이너) — 벽의 강조는 그대로 */}
   <WallShowMessage key={run} msg={msg} land={null} startedAt={0} centerText />
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
