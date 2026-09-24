import { useMemo, useState, type CSSProperties } from 'react';
import BackButton from '../components/BackButton';
import { BIG_SIDE_MAX_VW, BIG_SIDE_VH, WallShowMessage } from '../admin/WallSimulation';
import type { StoredMessage } from '../lib/firebase';
import type { ToneState } from '../types';
interface Props {
    text: string;
    tone: ToneState;
    onConfirm: () => void;
    onBack: () => void;
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
 * 기준이 되는 한 변뿐이다: 벽은 화면(vh·vw)에 대고 재고, 여기서는 16:9
 * 액자(cqh·cqw)에 대고 같은 비율로 잰다.
 *
 * '꽂혀 있는 동안 · 그 뒤 3일' 표시와 흘러가는 샘플 글은 걷었다. 시간의
 * 이야기는 발화 종료 화면이 한다. 여기 남는 보조 조작은 '다시 보기' 하나다 —
 * 등장을 한 번 더 본다.
 */
export default function PhasePreview({ text, tone, onConfirm, onBack, busy = false, error }: Props) {
    const [run, setRun] = useState(0);
    // 벽 부품이 받는 꼴. 아직 저장 전이라 id·시각은 이 화면의 자리표다
    const msg = useMemo<StoredMessage>(() => ({ id: 'preview', text, tone, createdAt: 0 }), [text, tone]);
    const frame = { '--big-side': `min(${BIG_SIDE_VH}cqh, ${BIG_SIDE_MAX_VW}cqw)` } as CSSProperties;
    return <div className="z-frame preview-screen"><div className="z-header"><BackButton label="색 다시 고르기" onClick={() => { if (!busy)
        onBack(); }}/><span className="z-step-of">5 / 5 · 미리보기</span></div>
 {/* 여기가 마지막이라는 것을 말로 해 둔다. 이 뒤(도킹)에는 '이전'이 없다 —
     글은 이미 보내진 뒤라, 거기서 나가는 문은 처음으로만 난다.
     '보낸 뒤에는 수정할 수 없어요'는 튜토리얼 마지막 장의 불변성이 옮겨 온
     것이다 — 행동 **전에** 알아야 하는 것이라 발화 종료 화면이 아니라
     여기 둔다(2026-09-24).

     버튼이 '준비됐어요'였다. **진짜 잠기는 순간이 여기인데** 그 라벨은
     무슨 일이 일어나는지 말하지 않는다 — 다른 확정 버튼은 전부 대상을
     말한다('다 썼어요' · '이 색으로 할게요'). '이대로'가 방금 본 미리보기를
     가리켜서 무엇이 보내지는지가 버튼 안에서 끝나고, 실패했을 때의
     '다시 보낼게요'와도 말이 이어진다. */}
 <div className="z-ask is-brief"><h1>이렇게 보여요</h1><p>보낸 뒤에는 수정할 수 없어요.</p></div>
 <div className="proj-stage"><div className="sim">
  <div className="sim-frame is-wall" style={frame} aria-label="벽에 뜨는 모습">
   <WallShowMessage key={run} msg={msg} land={null} startedAt={0} />
  </div>
  {/* 보조 조작은 이것 하나. 테두리만 있는 작은 버튼이라 아래의 채움
      버튼(보내기)과 무게가 다르다 — 다음으로 가는 길과 섞이지 않는다. */}
  <div className="sim-legend">
   <button type="button" className="sim-replay" onClick={() => setRun(r => r + 1)}>다시 보기</button>
  </div>
 </div></div>
 {error && <p role="alert" className="error-banner">{error}<br />쓰신 글은 그대로 있어요. 사라지지 않았어요.</p>}
 <button className="primary-action" disabled={busy} aria-busy={busy} aria-label={busy ? '전송 중' : error ? '다시 보낼게요' : '이대로 보낼게요'} onClick={onConfirm}>{busy ? <span className="cta-loading" aria-hidden>…</span> : error ? '다시 보낼게요' : '이대로 보낼게요'}</button></div>;
}
