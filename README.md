# MEGAFONT

캠퍼스 공공 발화 시스템. 학생이 폰으로 한 줄을 쓰고 그 **형식까지 직접 정해**
캠퍼스 벽에 올린다. 올라간 글은 사흘 동안 다른 말들 사이를 흘러다니다
사라진다. 따로 보관하지 않는다 — 떠 있는 동안이 곧 기록이다.

> **쓰면, 저 벽에 뜹니다**

라이브: **https://megafont.vercel.app**

---

## 화면 흐름

```
00 Splash        웹폰트를 기다린다 (최소 2초)
01 Intro         워드마크 · "처음이세요?" → [처음이에요: 6장 소개 → 시작] / [써봤어요: 바로]
02 말투          다정한 / 발랄한 / 당당한 / 차분한 + 굵기·너비·기울기(버튼 셋)
03 한 줄        입력창이 곧 벽 미리보기. 60자. 색 10조합
04 벽에서 보기      16:10 액자 — 실제 벽과 같은 비율·같은 크기 계산
05 전송 중       파문 + 링 (최소 800ms 노출)
06 도킹 안내     "홈에 꽂아주세요" + 꽂으면 무엇이 일어나는지
07 벽에 떠 있음 고개를 들게 하는 화면. 30초는 상한, 끝내는 건 폰을 빼는 사람
08 완료          "폰만 가져가세요" + 그 뒤의 이야기
```

07·08은 폰이 홈에 꽂힌 채로 읽는 화면이라 **화면 아래 절반만** 쓴다.
폰이 위쪽부터 들어가서 서 있는 사람에게는 그만큼만 보이기 때문이다.
(08은 07에서 '폰을 뺐어요'를 눌러 온 경우에만 화면 전체를 쓴다.)

07·08은 Norman의 *평가의 간극*을 메우는 자리다. 행동만 지시하고 결과를
알리지 않으면 사용자는 자기 행동이 통했는지 알 수 없다. 설계 근거는
[design/instructions.md](design/instructions.md)에 정리되어 있다.

## 경로

| 경로 | 무엇 |
|:--|:--|
| `/` | 입력 앱 (위 흐름) |
| `/?stage=enter` | NFC 태그 진입 — 홈을 건너뛰고 자형부터 |
| `/wall` | 벽 출력. 3트랙 풍경 + 도킹 시 강조(최대 30초, 폰을 빼면 즉시 종료) |
| `/admin` | 저장된 메시지 목록 |
| `?mock=1` | Firestore 대신 localStorage. 어느 경로에나 붙는다 |

## 한곳에서 정하는 값

| 파일 | 담긴 것 |
|:--|:--|
| [src/lib/wall.ts](src/lib/wall.ts) | 벽 크기(2.4×1.5m), 체류 기간(3일), 강조 상한(30초) |
| [src/lib/fit.ts](src/lib/fit.ts) | 액자에 글을 맞추는 계산. 03·04·`/wall`이 공유 |
| [src/lib/palettes-v2.ts](src/lib/palettes-v2.ts) | 색 10조합 (배경+글자) |
| [src/lib/palettes.ts](src/lib/palettes.ts) | 자형 4종 → 실제 서체 매핑 |

체류 기간이나 강조 시간을 바꾸면 화면 카피와 벽 필터가 함께 따라간다.

## 스택

- **Vite 6** + **React 18** + **TypeScript**
- **vite-plugin-pwa** (Workbox)
- **Firestore** — SDK가 아니라 REST로 직접 호출한다 (iOS에서 SDK 전송이
  실패한 이력이 있어 `74e775a`에서 갈아탔다)
- 배포: **Vercel** — `main`에 push하면 자동으로 나간다 (약 30초)

## 실행

```bash
npm install
npm run dev        # http://localhost:5173
npm run typecheck
npm run build
```

### 화면 캡처

dev 서버를 띄운 채로:

```bash
npm i --no-save playwright-core
node scripts/shoot-screens.mjs
```

시스템에 설치된 Chrome/Edge를 그대로 쓴다(브라우저를 내려받지 않는다).
`?mock=1`로 돌기 때문에 캡처 과정의 전송이 실제 벽에 닿지 않는다.
결과는 [design/screens/](design/screens/)에 390×844 @2x로 떨어진다.

## 서체

| 자형 | 계열 | 실제 서체 |
|:--|:--|:--|
| 다정한 | 손글씨 | jjgulwol (붓글씨 — '다정'보다 '서예'에 가깝다는 의심 있음) |
| 발랄한 | 둥근고딕 | Sunflower |
| 당당한 | 고딕 | 서울남산 |
| 차분한 | 명조 | 김정철명조 |

Adobe Fonts 킷(`zhl0ile`)에서 오고, Sunflower·Orbit·Pretendard는
`public/fonts`와 CDN에 있다. 워드마크만 Space Mono를 여덟 글자 서브셋으로
받는다.

**'발랄한'과 '당당한'이 골격을 공유한다.** Sunflower와 서울남산 둘 다
네모틀 산세리프라, 두 칸의 차이가 사실상 굵기로만 읽힌다 — 그런데 굵기는
이미 별도 축이 하는 일이다. 네 칸이 서로 벌어지려면 '발랄한' 자리의 서체를
먼저 바꿔야 한다. (실제 렌더 확인: `node scripts/shoot-faces.mjs`)

## 문서

| 문서 | 내용 |
|:--|:--|
| [design/instructions.md](design/instructions.md) | 안내판 문안, 앱 인스트럭션 원칙, 어휘 규칙 |
| [design/direction-v0.md](design/direction-v0.md) | 절대원칙 — 편집권은 발화자에게, 시스템은 추천하지 않는다 |
| [design/reference-adoption.md](design/reference-adoption.md) | 참조 디자인 채택 기록 + 검사 스크립트 돌리는 법 |
| [design/references.md](design/references.md) | 레퍼런스 |

**디자인 토큰은 문서가 아니라 [src/styles/tokens.css](src/styles/tokens.css)에 있다.**
`design/tokens.md`는 2026-05 시점의 옛 체계를 적어 둔 기록이다.

`design/` 안에서 맨 위에 `> **날짜 시점의 기록이다**` 가 붙은 문서는 그때의
결정을 남긴 것이고, 거기 적힌 화면 이름·버튼 문구·수치는 지금과 다르다.
왜 그렇게 정했는지를 볼 때만 읽는다.

## 아직 안 된 것

- 손글씨 서체 조달
- 도킹 감지 — 06→07, 07→08 전환이 지금은 버튼이다. 실제로는 NFC·센서가 부른다
- '발랄한' 서체 — 지금 Sunflower가 '당당한'(고딕)과 골격이 겹친다 (사용자 테스트의 선결 조건)
- 본체가 벽을 보고 서는가 — 앱 카피의 '저 벽'이 여기에 걸려 있다
- 물리 트랙 전반 (본체·프로젝터·Pi). `/wall`이 그 미리보기
- 출시 전 보안: Firestore 규칙 좁히기, App Check, rate limit
- 관리자 삭제 경로
