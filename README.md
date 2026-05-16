# DOCK Webapp

캠퍼스 공공 발화 시스템 **DOCK**의 사용자 폰 PWA. NFC 거치대에 폰을 태깅하면 자동 실행되어, 60자 메시지 작성 → 톤 결정 → 외벽 전송까지 안내합니다.

> Phase 04 (작성) → Phase 05 (톤 결정) → Phase 05b (재태깅 안내) → Phase 06 (전송 완료)

## 스택

- **Vite 6** + **React 18** + **TypeScript**
- **vite-plugin-pwa** (Workbox manifest + service worker)
- **Firebase Web SDK** (Firestore, 선택)
- 배포: **Vercel 무료 플랜** (자동 감지)

## NFC 플로우

폰을 R2 거치대에 태깅하면 NFC URL의 `?stage=` 파라미터로 진입 지점이 결정됩니다:

| URL                                  | 동작                                                  |
| ------------------------------------ | ----------------------------------------------------- |
| `https://<host>/?stage=enter`        | Phase 04 작성 화면 진입 (또는 작성 중인 draft 이어 받기) |
| `https://<host>/?stage=submit`       | 저장된 draft를 Firebase로 전송 후 Phase 06 화면 표시   |
| `https://<host>/` (파라미터 없음)    | 개발용 — Phase 04로 시작                               |

- Phase 04에서 **다음 — 톤 결정** → Phase 05로 이동 (URL 변경 없음, draft는 `localStorage`에 저장)
- Phase 05에서 **맡기기** → Phase 05b 재태깅 안내 화면으로 이동
- 사용자가 폰을 NFC에 다시 태깅 → `?stage=submit` URL이 열림 → Phase 06에서 전송 처리

## 실행

```bash
# 의존성 설치
npm install

# 개발 서버 (http://localhost:5173)
npm run dev

# 타입체크
npm run typecheck

# 프로덕션 빌드 (→ dist/)
npm run build

# 빌드 결과 미리보기
npm run preview
```

### URL로 단계 점프 (개발 중)

브라우저에서 직접 열어 흐름 확인:

- `http://localhost:5173/?stage=enter` — 시작
- `http://localhost:5173/?stage=submit` — (draft가 localStorage에 있을 때) 전송 화면

## Firebase 설정 (선택)

Firebase가 설정되지 않으면 전송이 자동으로 **mock 모드**(500ms 지연 후 성공)로 동작합니다. 실제 Firestore에 메시지를 저장하려면:

1. [Firebase Console](https://console.firebase.google.com/)에서 프로젝트 생성 → Firestore Database 활성화 (테스트 모드 또는 적절한 보안 규칙)
2. **프로젝트 설정 → 일반 → 내 앱 → 웹 앱 추가** 에서 SDK 구성값 복사
3. `.env.example`을 `.env.local`로 복사하고 값 채우기:

```bash
cp .env.example .env.local
```

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=your-proj.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-proj
VITE_FIREBASE_STORAGE_BUCKET=your-proj.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
```

저장 스키마 (Firestore `messages` 컬렉션):

```ts
{
  text: string,              // 60자 메시지
  tone: {
    font: 'mono' | 'gothic' | 'myeongjo',
    tone: number,            // 0.7 / 1.0 / 1.3
    wght: number,            // 100..900
    slnt: number,            // 0 또는 -8
    size: number,            // px
    paletteIdx: number,      // 0..9
    graphicIdx: number       // -1..4
  },
  startedAt: number,         // ms epoch
  createdAt: Timestamp       // serverTimestamp()
}
```

## Vercel 배포 (무료 플랜)

1. 이 폴더를 GitHub 저장소에 푸시
2. Vercel에서 **Import Project** → 저장소 선택 → 빌드 설정 자동 감지 (Vite)
3. **Settings → Environment Variables** 에서 `VITE_FIREBASE_*` 값들 추가 (선택)
4. Deploy

NFC 태그에 `https://<your-domain>.vercel.app/?stage=enter` URL을 쓰면 됩니다.

> 무료 플랜으로 충분합니다: 빌드 + 정적 호스팅 + SSL + 글로벌 CDN. Firestore도 Spark(무료) 플랜에서 일일 한도 내 사용 가능.

## 폴더 구조

```
dock-webapp/
├── index.html
├── public/
│   └── icon.svg               # PWA 아이콘
├── src/
│   ├── main.tsx               # 엔트리 + SW 등록
│   ├── App.tsx                # URL stage → 화면 라우팅
│   ├── types.ts
│   ├── styles/
│   │   └── global.css         # 프로토타입 스타일 이식 + 공통 스타일
│   ├── components/
│   │   └── DockFrame.tsx      # 헤더 + 알약 프레임 wrapper
│   ├── phases/
│   │   ├── Phase04Write.tsx   # 60자 텍스트 입력
│   │   ├── Phase05Tone.tsx    # 톤 결정 (프로토타입 본체)
│   │   ├── Phase05bDock.tsx   # "다시 태깅해주세요" 안내
│   │   └── Phase06Submit.tsx  # Firebase 전송 + 완료
│   └── lib/
│       ├── palettes.ts        # 10 팔레트, 폰트맵, 5 그래픽 SVG
│       ├── stage.ts           # ?stage= 파싱
│       ├── draft.ts           # localStorage draft 저장/로드
│       └── firebase.ts        # 동적 import + mock fallback
├── vite.config.ts             # PWA plugin 설정
├── vercel.json                # SPA 라우팅 fallback
├── tsconfig.json
├── package.json
└── .env.example
```

## 알려진 한계

- 한글 가변폰트에는 `wdth`/`slnt` 가변 축이 없어 CSS `transform: scaleX/skewX`로 흉내냅니다. `OBLQ`(-8도)에서 자모가 살짝 일그러집니다 — 디자인 명세서에서 수용한 한계.
- PWA 아이콘은 SVG 1장으로 시작. 출시 전 192/512 PNG 생성 권장.
- 음성 분석은 `getUserMedia` + Web Audio API. 로컬 분석만 수행하며, 녹음이 끝나는 즉시 미디어 스트림과 AudioContext를 폐기합니다 (오디오는 서버로 전송하지 않음).
- Service Worker는 `vite-plugin-pwa`로 `autoUpdate` 모드. JSDelivr CDN 폰트는 CacheFirst, Firebase 요청은 NetworkFirst로 캐시.

## 참고

- 원본 디자인 명세서: [`../DOCK_Phase05_design_spec.md`](../DOCK_Phase05_design_spec.md)
- 원본 프로토타입: [`../dock-phase05-prototype.html`](../dock-phase05-prototype.html)
- 영감: GT Mechanik (gt-mechanik.com)
- 원전: Ghim, Y. G. (2021). *Archives of Design Research, 34(4), 7-21.*
