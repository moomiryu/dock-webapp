import { useCallback, useEffect, useState } from 'react';
import { enterFullscreen, exitFullscreen, isFullscreen, screenMode } from '../lib/fullscreen';
import type { ScreenMode } from '../lib/fullscreen';

// 주소창을 지우는 버튼.
//
// 접속 주소는 QR로만 들어오게 하려고 길게 만들 예정이라, 화면 아래 주소창에
// 그 긴 주소가 계속 떠 있으면 눈에 거슬린다. 브라우저마다 지울 수 있는 방법이
// 달라서 상황을 먼저 보고 그에 맞는 것만 내민다.
export default function FullscreenToggle() {
  const [mode, setMode] = useState<ScreenMode>(() => screenMode());
  const [howto, setHowto] = useState(false);

  useEffect(() => {
    const sync = () => setMode(screenMode());
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    const mq = window.matchMedia('(display-mode: standalone)');
    mq.addEventListener?.('change', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      mq.removeEventListener?.('change', sync);
    };
  }, []);

  const onClick = useCallback(async () => {
    if (isFullscreen()) {
      await exitFullscreen();
      setMode(screenMode());
      return;
    }
    if (screenMode() === 'install') {
      setHowto(true);
      return;
    }
    await enterFullscreen();
    setMode(screenMode());
  }, []);

  // 이미 주소창이 없으면 이 버튼은 할 일이 없다
  if (mode === 'clean') return null;

  return (
    <>
      <button type="button" className="fs-btn" onClick={onClick}>
        전체 화면
      </button>

      {howto && (
        <div className="fs-howto" role="dialog" aria-modal="true" aria-label="전체 화면으로 여는 법">
          <div className="fs-howto-card">
            <h2>주소창 없이 보려면</h2>
            <p>
              아이폰 사파리에는 전체 화면 기능이 없습니다.
              대신 한 번만 이렇게 하면 주소창 없이 열립니다.
            </p>
            <ol className="fs-steps">
              <li>화면 아래 <b>공유</b>(네모에 화살표)를 누릅니다</li>
              <li>목록에서 <b>홈 화면에 추가</b>를 고릅니다</li>
              <li>홈 화면에 생긴 <b>MEGAFONT</b>로 다시 엽니다</li>
            </ol>
            <button type="button" className="primary-action" onClick={() => setHowto(false)}>
              <span>알겠어요</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
