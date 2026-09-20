/**
 * 배경을 오가는 작은 캐릭터의 부품.
 *
 * 받은 그림을 통짜로 넣지 않고 조각으로 나눠 둔다. 표정을 바꾸고 몸 색을
 * 갈아입혀야 하는데, 문자열째로 심으면 손댈 데가 없기 때문이다. 몸과
 * 다리는 `currentColor`라 CSS 한 줄로 파랑에서 빨강으로 건너간다.
 *
 * **걷는 움직임만은 옮겨 적지 않고 작가의 파일에서 그때그때 읽는다.**
 * 65프레임짜리 다리 모양 목록이라 옮겨 적으면 3만 자가 되고, 그런 사본은
 * 반드시 낡는다 — 2026-09-20에 폴더가 갈리면서 앱이 통째로 안 뜬 일이
 * 그것이었다. 읽는 쪽이 하나면 작가가 그림을 고치는 순간 화면도 같이 바뀐다.
 */
import walkSrc from '../../by_moomiryu/Renewal_v1/Character/people/Character_walk_v3.svg?raw';

const pick = (re: RegExp, what: string) => {
  const m = walkSrc.match(re);
  // 그림의 짜임이 바뀌면 조용히 멈추지 말고 무엇을 못 찾았는지 말하게 한다
  if (!m) throw new Error(`Character_walk_v3.svg에서 ${what}를 못 찾았다`);
  return m[1];
};

/** 원본 화판. 가로는 그림자가 눕는 만큼 넓다(533.26) — 몸은 17.13~349.34다 */
export const VIEW = { w: 366, h: 574.1 };

/**
 * 그림자. 몸 색과 달리 늘 같은 색이다 — 바닥에 지는 것이라.
 *
 * 자세에 따라 둘이다. 옆모습은 **보는 반대쪽으로 길게 눕고**(폭이 몸보다
 * 넓다), 정면은 발밑에 동그랗게 앉는다. 2026-09-20에 작가의 그림
 * (`Character/people/`)에서 그대로 옮겨 왔다 — 그 전에는 하나뿐이었고
 * 폭 172에 늘 가운데였다.
 *
 * 옆모습 그림자는 화판(366)보다 넓다. 자르지 않는다 — 걷는 쪽이 어디인지를
 * 말하는 것이 이 폭이라, 상자에 맞춰 줄이면 그 말이 없어진다.
 * (`.walker-art`의 overflow: visible이 그 일을 한다)
 */
/* 색은 여기 없다 — app.css의 .w-shade가 --char-shade로 칠한다.
   여기 적어 두면 같은 색이 두 곳에 산다. */
export const SHADOW = { cy: 541.81, ry: 32.28 };
export const SHADOW_SIDE = { cx: 266.63, rx: 266.63 };
export const SHADOW_FRONT = { cx: 183.24, rx: 183.46 };

/** 몸이 다리를 덮는 선. 이 아래로는 다리만 보인다 */
export const CLIP_H = Number(
  pick(/<clipPath id="upper-body-clip"><rect width="[\d.]+" height="([\d.]+)"/, '클립 높이')
);

/**
 * 걷기 한 벌.
 *
 * 다리 둘의 **모양 자체**가 65프레임에 걸쳐 바뀐다. 전에는 이걸 못 쓰고
 * 엉덩이에서 ±7도 돌리는 것으로 대신했는데(그때 다리 윗변도 360으로
 * 끌어올려야 했다), 이제 작가가 준 것을 그대로 쓴다.
 *
 * 몸은 다리와 따로 논다 — 발을 디딜 때 조금 내려앉고(translate) 그 박자로
 * 조금 기운다(rotate, 축은 엉덩이 183.23·449). 그래서 미끄러지지 않는다.
 *
 * 0프레임이 곧 **서 있는 자세**다. 멈춰 세울 때 시간을 0으로 돌리고
 * 재우면 작가가 그린 그 자세로 선다(HomeCrowd).
 */
export const WALK = {
  /** 한 바퀴 (ms). 그림에 적힌 값이다 */
  ms: Math.round(Number(pick(/dur="([\d.]+)s"/, '한 바퀴 길이')) * 1000),
  keyTimes: pick(/keyTimes="([^"]+)"/, '프레임 차례'),
  farRest: pick(/<path id="far-leg"[^>]*\sd="([^"]+)"/, '먼 다리'),
  nearRest: pick(/<path id="near-leg"[^>]*\sd="([^"]+)"/, '가까운 다리'),
  far: pick(/<path id="far-leg"[^>]*><animate[^>]*values="([^"]+)"/, '먼 다리의 걸음'),
  near: pick(/<path id="near-leg"[^>]*><animate[^>]*values="([^"]+)"/, '가까운 다리의 걸음'),
  bobRest: pick(/id="body-translation" transform="translate\(([^)]+)\)"/, '몸의 기본 자리'),
  bob: pick(/type="translate"[^>]*values="([^"]+)"/, '몸의 오르내림'),
  tiltRest: pick(/id="body-rotation" transform="rotate\(([^)]+)\)"/, '몸의 기본 기울기'),
  tilt: pick(/type="rotate"[^>]*values="([^"]+)"/, '몸의 기울기')
};

export const HEAD = { cx: 183.23, cy: 166.1, r: 166.1 };

export const BODY =
  'M349.34,166.11v332.2h-.01v27.43c0,8.88-7.19,16.07-16.07,16.07h-110.23c-8.87,0-16.07-7.19-16.07-16.07' +
  'v-27.43c0-13.11-10.62-23.73-23.73-23.73s-23.73,10.62-23.73,23.73v27.43c0,8.88-7.19,16.07-16.07,16.07' +
  'H33.2c-8.88,0-16.07-7.19-16.07-16.07V166.11h332.21Z';

/** 눈 흰자. 표정이 무엇이든 이건 그대로다 */
export const EYE_WHITE = { cx: 100.29, cy: 147.4, r: 59.67 };

/**
 * 정면일 때 생기는 **반대쪽 눈**까지의 거리.
 *
 * 옆모습은 눈이 하나다. 정면으로 돌면 하나가 더 보인다 — 작가의 그림에서
 * 두 눈은 100.29와 266.17에 있고, 그 가운데(183.23)가 몸의 한가운데다.
 * 그래서 반대쪽 눈은 이쪽 눈을 통째로 옮겨 놓은 것과 같다. 표정 넷을
 * 다시 그리지 않고 무리째 옮긴다 — 웃는 입도 같이 따라간다.
 */
export const EYE_FAR_DX = 165.88;

/**
 * 표정 넷. 흰자 안에서 검은자만 바뀐다.
 *
 * 메가폰트 앞에 서서 이것들을 차례로 보인다 — 쳐다보고(look), 놀라고
 * (wide), 한 번 깜빡이고(shut), 웃는다(smile). 웃는 순간 몸이 빨강이
 * 된다. 발화자가 되어 떠나는 것이 이 장면의 내용이다.
 */
export type WalkerEye = 'look' | 'wide' | 'shut' | 'smile';

/** 쳐다본다 — 검은자가 앞쪽(왼쪽)으로 쏠려 있다. 그림의 기본값이다 */
export const EYE_LOOK = { cx: 90.29, cy: 147.4, r: 36.32 };
/** 놀란다 — 검은자가 작아지고 한가운데로 온다 */
export const EYE_WIDE = { cx: 100.29, cy: 147.4, r: 18 };
/** 깜빡인다 */
export const EYE_SHUT = 'M 68 146 Q 100.29 170 132 146';
/** 웃는다 */
export const EYE_SMILE = 'M 66 138 Q 100.29 188 134 138';
