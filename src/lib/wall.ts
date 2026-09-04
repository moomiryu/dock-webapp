// 외벽의 물리 사양과 시간. 화면 카피와 필터가 같은 숫자를 봐야 해서 여기 모은다.

/** 실제 디스플레이 — 2.4 × 1.5 m (16:10) */
export const WALL_W_M = 2.4;
export const WALL_H_M = 1.5;

/**
 * 외벽에 머무는 기간.
 * 별도의 아카이브는 두지 않는다 — 이 사흘 동안 풍경에 떠 있는 것이 곧 기록이고,
 * 지나면 남지 않는다. 사라짐이 이 장치의 성질이다.
 */
export const STAY_DAYS = 3;
export const STAY_MS = STAY_DAYS * 24 * 60 * 60 * 1000;
