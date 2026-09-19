import { useEffect } from 'react';

// 00 Splash — 웹폰트가 준비될 때까지의 자리.
// 자형이 이 앱의 내용이라, 폰트가 늦게 오면 첫 화면이 다른 글씨로 한 번 깜빡인다.
// 그 깜빡임을 사용자에게 보이지 않으려고 여기서 기다린다.
//
// 이 화면은 그냥 사라지지 않는다. 사라지는 순간 App이 같은 빨강의 막을
// 홈 위에 깔고, 그 막이 캐릭터가 서는 자리로 좁혀 든다 — 빨강이 지워지는
// 것이 아니라 **캐릭터가 되는 것**으로 보이게 하려는 것이다.
export default function PhaseSplash({ onLand }: { onLand?: () => void }) {
  // 걷히기 직전에 막을 올려 둔다. 두 화면이 한 프레임이라도 어긋나면
  // 빨강과 흰 바탕 사이가 한 번 번쩍인다.
  useEffect(() => () => onLand?.(), [onLand]);
  return (
    <div className="splash">
      <div className="splash-bar" role="progressbar" aria-label="준비 중">
        <i />
      </div>
      <div className="splash-note">글꼴을 준비하고 있어요</div>
    </div>
  );
}
