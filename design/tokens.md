# DOCK — 디자인 토큰

> 2026-05-18. 모든 화면이 따르는 스케일. 하드코드 px/ms 금지.
> 정의: `src/styles/tokens.css`

---

## 사용 원칙

1. **px 안 씀.** 항상 토큰을 통해서.
2. **간격은 4px 베이스**. 한글 정밀도에 맞춰 fine-grained.
3. **타입은 1.25 모듈러 스케일**. 베이스 14px.
4. **모션은 5단계**, 통일된 easing 둘 (`standard`, `emphasized`).
5. **색은 동적**. 팔레트는 `palettes-v2.ts`에서, 중립만 토큰.

---

## 간격 (Space)

4px 베이스 스케일.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--sp-0` | 0 | 리셋 |
| `--sp-1` | 4px | hairline gap, dense control gap |
| `--sp-2` | 8px | 컨트롤 행 간 |
| `--sp-3` | 12px | 소섹션 간 |
| `--sp-4` | 16px | 좌우 여백, 섹션 간 |
| `--sp-5` | 20px | 큰 여백 |
| `--sp-6` | 24px | 페이지 헤더 |
| `--sp-8` | 32px | 메이저 섹션 |
| `--sp-10` | 40px | 히어로 여백 |
| `--sp-12` | 48px | 페이지 상하 |
| `--sp-16` | 64px | 클라이맥스 여백 |
| `--sp-20` | 80px | 외벽 슬롯 간 |

---

## 타입 사이즈 (Type)

1.25 모듈러 스케일, 베이스 14.

| 토큰 | 값 | 용도 |
|---|---|---|
| `--fs-xs` | 10px | 작은 라벨, 시스템 텍스트 |
| `--fs-sm` | 12px | 컨트롤, 캡션 |
| `--fs-base` | 14px | 본문 |
| `--fs-md` | 16px | 인터랙티브 본문 |
| `--fs-lg` | 20px | 작은 헤딩 |
| `--fs-xl` | 28px | 헤딩 |
| `--fs-2xl` | 40px | 디스플레이 |
| `--fs-3xl` | 64px | 히어로 |
| `--fs-mega` | 240px | 거대 글리프 앵커 (viewport에 따라 override) |

## 타입 굵기 (Weight)

| 토큰 | 값 | 라벨 |
|---|---|---|
| `--fw-thin` | 100 | THIN |
| `--fw-light` | 300 | LGHT |
| `--fw-regular` | 400 | RGLR |
| `--fw-medium` | 500 | MED |
| `--fw-bold` | 700 | BOLD |
| `--fw-black` | 900 | BLAK |

## 라인 / 글자 사이

| 토큰 | 용도 |
|---|---|
| `--lh-tight 0.9` | 거대 디스플레이 |
| `--lh-snug 1.15` | 헤딩 |
| `--lh-base 1.4` | 본문 |
| `--lh-loose 1.7` | 가독성 강조 |
| `--ls-tight -0.04em` | 디스플레이 |
| `--ls-base -0.01em` | 본문 |
| `--ls-mono 0.08em` | 모노 라벨 |
| `--ls-mono-loose 0.18em` | spaced caps |

---

## 모션 (Motion)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--t-instant` | 100ms | 무감 (탭 피드백) |
| `--t-fast` | 150ms | 버튼 호버 |
| `--t-base` | 250ms | 전환, 색상 |
| `--t-slow` | 400ms | reveal |
| `--t-long` | 600ms | orchestrated |

| 이징 | 곡선 | 용도 |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | 대부분 |
| `--ease-emphasized` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | 드라마틱 |

---

## 보더 / 라운드

| 토큰 | 값 |
|---|---|
| `--bw-hair` | 1px |
| `--bw-thin` | 1.5px |
| `--bw-base` | 2px |
| `--bw-thick` | 4px |
| `--radius-none` | 0 |
| `--radius-sm` | 2px |
| `--radius-md` | 4px |
| `--radius-lg` | 8px |
| `--radius-pill` | 999px |

DOCK은 *각진* 미학이라 라운드 거의 안 씀. `--radius-md`(4px) 이상은 예외적 사용.

---

## Z-index

| 토큰 | 값 | 용도 |
|---|---|---|
| `--z-base` | 0 | 배경 |
| `--z-content` | 1 | 콘텐츠 |
| `--z-elevated` | 2 | 메시지/카드 |
| `--z-overlay` | 100 | 그레인, 오버레이 |
| `--z-modal` | 200 | 모달 |
| `--z-toast` | 300 | 알림 |

---

## 중립 색

팔레트 색(bg/text/graphic)은 `palettes-v2.ts`에서 무드별로 정의됨. 토큰엔 중립만.

| 토큰 | 값 |
|---|---|
| `--c-black` | `#000000` |
| `--c-white` | `#ffffff` |
| `--c-paper` | `#f5f4ed` |

---

## 텍스처

| 토큰 | 값 | 용도 |
|---|---|---|
| `--o-grain` | 0.05 | Riso 그레인 (v2 — 매우 옅음, v1 대비 절반 이하) |
| `--o-grain-strong` | 0.10 | 강조 그레인 (특정 화면) |

v1의 0.12는 *모든 화면에서 카니발 효과*를 만들었음. v2는 *조용한 무게*가 목표라 절반 이하.

---

## 한·영 라벨 페어링 (Sulki-and-Min idea-pairing)

축 라벨은 한글 + 영문 약어 짝.

| 한 | 영 |
|---|---|
| 활자 | FONT |
| 무게 | WGHT |
| 결 | TONE |
| 기울기 | SLNT |
| 크기 | SIZE |

CSS class: `.z-axis-label-kr` (Pretendard 700, 10px) + `.z-axis-label-en` (D2Coding 400, 8px, spaced caps).

---

## 레이아웃

| 토큰 | 값 |
|---|---|
| `--frame-max` | 480px (폰 컬럼 max-width) |

---

*이 문서가 진실. 코드가 어긋나면 코드를 고침.*
