// 외벽 코드 — 전송 직전의 현장 확인용 네 자리 숫자.
//
// 실제 설치에서는 이 숫자의 주인이 *외벽 디스플레이*다. 외벽에 상시 떠 있는
// 숫자를 폰에 옮겨 적어야 전송이 시작된다 = 그 자리에 실제로 서 있는 사람만
// 발화할 수 있다. (원격·대량 전송 차단)
//
// 지금은 목업이라 디스플레이가 없으므로 앱이 세션마다 하나 만들어 두고
// 코드 화면에서 대신 보여준다. 물리 단계에 들어가면 이 모듈이 Firestore의
// control 문서(또는 /wall이 발행하는 값)를 읽는 자리가 된다.

const KEY = 'megafont.wallcode.v1';

function generate(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/** 이 세션의 외벽 코드. 새로고침해도 같은 값이 유지된다. */
export function getWallCode(): string {
  try {
    const saved = sessionStorage.getItem(KEY);
    if (saved && /^\d{4}$/.test(saved)) return saved;
    const fresh = generate();
    sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch {
    // 프라이빗 모드 등 저장소가 막힌 환경 — 그때그때 새로 만든다.
    return generate();
  }
}

/** 전송을 마친 뒤 다음 사람을 위해 코드를 새로 뽑는다. */
export function rotateWallCode(): void {
  try {
    sessionStorage.setItem(KEY, generate());
  } catch {
    /* 저장소가 막혀 있으면 어차피 매번 새 값이다 */
  }
}
