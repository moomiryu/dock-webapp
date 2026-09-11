---
name: deploy
description: MEGAFONT를 검사하고 프로덕션(megafont.vercel.app)에 배포한다. 작업이 끝나 라이브에 올릴 때, 또는 "배포해줘"라고 할 때 사용. main에 push하면 곧바로 설치물에 나가므로 사람이 직접 불러야 한다.
disable-model-invocation: true
allowed-tools: Read, Bash(npx tsc *), Bash(npm run build), Bash(node scripts/*), Bash(git status *), Bash(git diff *), Bash(git log *), Bash(git add *), Bash(git commit *), Bash(curl *)
---

# 배포

`main`에 push하는 순간 학생들이 쓰는 설치물에 나간다. 되돌리려면 다시 push해야
하고, 그 사이 시간은 되돌릴 수 없다. 그래서 순서가 있다.

**한 단계라도 실패하면 멈추고 알린다.** 다음 단계로 넘어가지 않는다.

## 1. 코드가 성립하는가

```bash
npx tsc --noEmit
npm run build
```

## 2. 화면이 성립하는가

dev 서버가 떠 있어야 한다. 안 떠 있으면 `npm run dev`를 백그라운드로 띄우고
`curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/`가 200을 줄
때까지 기다린다.

```bash
node scripts/audit-a11y.mjs     # 11개 화면. 위반 0이 기준선이다
node scripts/e2e-dock.mjs       # 폰↔벽 왕복. 60초 폴링을 기다리므로 오래 걸린다
```

`audit-a11y`는 **위반이 0이 아니면 회귀다.** 한 건이라도 나오면 멈춘다.

`e2e-dock`은 실제 Firestore에 테스트 글을 쓰고 끝나면 지운다. 마지막 줄이
"테스트 글 삭제: 완료"인지 확인한다 — 안 지워졌으면 그 글이 사흘 동안 벽에
떠 있는다.

CSS나 토큰을 건드렸다면 `scripts/verify-tokens.mjs`로 전후 계산값을 대조한다.

## 3. 커밋

`git status --short`로 무엇이 나가는지 먼저 본다. 예상 밖의 파일이 있으면 멈춘다.

커밋 메시지는 이 저장소의 결을 따른다 — **무엇을 바꿨는지가 아니라 왜 그래야
했는지**를 적는다. 기존 메시지를 몇 개 읽고 맞춘다. 제목은 명령형 한 줄,
본문은 문제 → 증거(수치) → 선택 → 안 한 것.

## 4. push와 확인 — 여기서 멈추고 물어본다

**push는 사용자에게 확인받고 한다.** 확인을 받았으면:

```bash
git push origin main
```

그리고 **정말 나갔는지 눈으로 확인한다.** Vercel이 빌드하는 데 30초쯤 걸리고,
로컬 빌드와 해시가 다를 수 있으므로 *번들 이름이 바뀌는 것*을 본다:

```bash
for i in $(seq 1 12); do
  h=$(curl -s -H 'Cache-Control: no-cache' https://megafont.vercel.app/ \
      | grep -o 'assets/index-[A-Za-z0-9_-]*\.js' | head -1)
  echo "$(date +%H:%M:%S)  $h"
  [ -n "$prev" ] && [ "$h" != "$prev" ] && { echo "반영됨"; break; }
  prev=$h; sleep 20
done
```

해시가 바뀐 것만으로는 부족하다. **바뀐 내용이 실제로 라이브에 있는지** 본다 —
CSS를 고쳤으면 배포된 번들에서 그 값을 읽고, 화면을 고쳤으면
`scripts/lib/drive.mjs`의 `open({ live: true })`로 프로덕션을 직접 몰아 본다.

## 보고

무엇이 나갔는지, 검사 결과 수치, 라이브에서 확인한 값을 적는다.
"배포했습니다"로 끝내지 않는다 — 확인한 근거를 같이 준다.
