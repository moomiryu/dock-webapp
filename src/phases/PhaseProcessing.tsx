import MegafontFrame from '../components/MegafontFrame';

interface Props {
  /** 0..1 — 실제 완료율이 아니라 경과 시간 기반 추정치 */
  progress: number;
}

// 05 Processing — 전송 중.
// 단일 요청이라 진짜 완료율은 알 수 없다. 그래서 진행바는 시간 기반으로
// 90%까지만 차오르고, 응답이 오면 다음 화면으로 넘어간다.
// 멈춘 화면보다 낫고, 거짓 100%보다 정직하다.
export default function PhaseProcessing({ progress }: Props) {
  const pct = Math.round(progress * 100);
  return (
    <MegafontFrame phaseLabel="보내는 중">
      <div className="guide-hero">
        <h1>외벽으로 보내는 중…</h1>
        <p>잠시만요.</p>

        <div
          className="send-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <i style={{ width: `${pct}%` }} />
        </div>
        <div className="send-pct">{pct}%</div>
      </div>
    </MegafontFrame>
  );
}
