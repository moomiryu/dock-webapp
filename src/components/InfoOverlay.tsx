import { useEffect } from 'react';
import { STAY_DAYS } from '../lib/wall';

interface Props {
  onClose: () => void;
}

// 프로젝트 정보 — 홈에서 열리는 덮개.
// 사용자 테스트에서 참가자가 설명 없이도 "이게 뭔지" 알 수 있어야 해서,
// 규칙(글자 수·머무는 기간·수정 불가·익명)을 여기 한 자리에 모았다.
export default function InfoOverlay({ onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="info-overlay" role="dialog" aria-modal="true" aria-label="프로젝트 정보">
      <div className="info-head">
        <span>프로젝트 정보</span>
        <button type="button" className="info-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>
      </div>

      <div className="info-body">
        <h2>캠퍼스 외벽에 한 줄을 둡니다</h2>
        <p>
          MEGAFONT는 학생이 공공의 자리에 자기 말을 두는 장치입니다.
          무엇을 말할지뿐 아니라 <b>어떤 형식으로 말할지</b>까지 직접 정합니다.
        </p>

        <dl className="info-rules">
          <div>
            <dt>길이</dt>
            <dd>한 번에 60자까지</dd>
          </div>
          <div>
            <dt>크기</dt>
            <dd>외벽 2.4 × 1.5 m</dd>
          </div>
          <div>
            <dt>기간</dt>
            <dd>올라간 뒤 {STAY_DAYS}일간 머무릅니다</dd>
          </div>
          <div>
            <dt>수정</dt>
            <dd>보낸 뒤에는 고칠 수 없습니다</dd>
          </div>
          <div>
            <dt>이름</dt>
            <dd>누가 썼는지 남지 않습니다</dd>
          </div>
          <div>
            <dt>삭제</dt>
            <dd>문제가 되는 글은 관리자가 내립니다</dd>
          </div>
          <div>
            <dt>보관</dt>
            <dd>따로 모아두지 않습니다</dd>
          </div>
        </dl>

        <p className="info-foot">
          보관함은 없습니다. {STAY_DAYS}일 동안 외벽에 떠 있는 동안이 이 말의 전부이고,
          그 뒤에는 남지 않습니다.
        </p>
      </div>

      <button type="button" className="primary-action" onClick={onClose}>
        <span>닫기</span>
      </button>
    </div>
  );
}
