// 00 Splash — 웹폰트가 준비될 때까지의 자리.
// 자형이 이 앱의 내용이라, 폰트가 늦게 오면 첫 화면이 다른 글씨로 한 번 깜빡인다.
// 그 깜빡임을 사용자에게 보이지 않으려고 여기서 기다린다.
export default function PhaseSplash() {
  return (
    <div className="splash">
      <div className="splash-mark">MEGAFONT</div>
      <div className="splash-bar" role="progressbar" aria-label="준비 중">
        <i />
      </div>
      <div className="splash-note">글꼴을 준비하고 있어요</div>
    </div>
  );
}
