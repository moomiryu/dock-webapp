---
name: peek
description: 돌고 있는 앱을 브라우저로 직접 열어 화면을 보거나 값을 재는 방법. 화면이 어떻게 보이는지 확인할 때, 계산된 스타일·좌표·색을 재야 할 때, 자판이 올라온 높이나 벽 크기에서 깨지는지 볼 때 사용. 코드를 읽어서 짐작하지 말고 이걸 쓴다.
allowed-tools: Read, Write, Edit, Bash(node *), Bash(npm run dev), Bash(curl *), Bash(rm *), Bash(python *)
---

# 앱을 들여다보기

코드만 읽고 "이렇게 보일 것이다"라고 말하지 않는다. 열어서 본다.
이 프로젝트에서 틀렸던 판단은 대부분 안 열어봐서 틀렸다.

## 먼저

dev 서버가 떠 있어야 한다.

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/
```

200이 아니면 `npm run dev`를 백그라운드로 띄우고 200이 될 때까지 기다린다.

## 탐침 쓰는 법

상용구를 다시 쓰지 않는다. `scripts/lib/drive.mjs`가 브라우저 띄우기와
화면 이동을 들고 있다.

```js
import { open, toCompose, toWall, shootPair } from './scripts/lib/drive.mjs';

const { page, close } = await open();        // 기본 390×844 · ko-KR · ?mock=1
await toCompose(page, '여기서 크게 말해본 적 없다');
await page.screenshot({ path: `${SCRATCH}/03.png` });
await close();
```

**이동 함수**: `toHome` · `toVoice(font)` · `toShape` · `toCompose(text)` ·
`toColor` · `toPreview` · `toDock` · `toWall`

**크기**: `open({ size: 'phone' })` 기본 · `'wall'` 1280×800 (16:10) ·
`'keyboard'` 390×380 (한글 자판이 올라왔을 때 남는 높이)

**그 밖의 옵션**: `scale: 2` 확대해 볼 때 · `reduced: true` 모션을 멈춰야
찍히는 것(캐릭터는 계속 떠다녀서 그냥은 element screenshot이 timeout 난다) ·
`live: true` 프로덕션을 본다 · `real: true` `?mock=1` 없이 **실제 Firestore에
쓴다**(테스트 글을 반드시 지울 것)

## 탐침 파일은 스크래치패드에

프로젝트 루트에 `peek-tmp.mjs` 같은 걸 만들지 않는다. 시스템 프롬프트가 알려준
스크래치패드 디렉터리에 만들고, 보고 나면 지운다. 되풀이해서 쓸 값이 있으면
그때 `scripts/`에 `verify-*.mjs`로 승격시킨다.

스크래치패드는 프로젝트 밖이라 `drive.mjs`를 **`file:///` URL로** 부른다.
Windows 절대경로(`C:/...`)를 그냥 쓰면 ESM 로더가 거부한다.

```js
import { open, toCompose } from 'file:///C:/dev/dock-webapp/scripts/lib/drive.mjs';
```

## 눈으로 판정하지 않는다

**값을 잴 수 있으면 잰다.** "간격이 좀 어색한데"가 아니라 수치를 읽는다.

```js
await page.evaluate(() => {
  const el = document.querySelector('.primary-action');
  const r = el.getBoundingClientRect();
  return { 하단: r.bottom, 뷰포트: innerHeight, 색: getComputedStyle(el).backgroundColor };
});
```

**움직이는 것은 두 시점을 찍어 뺀다.** 파동의 세기를 이 방법으로 골랐다.

```js
const [a, b] = await shootPair(page, '.wall-show .voice-bubble', SCRATCH, 'wave');
```

```python
from PIL import Image, ImageChops
d = ImageChops.difference(Image.open(a).convert('L'), Image.open(b).convert('L'))
moved = sum(d.histogram()[31:])        # 31 = 잡음 문턱
```

## 자주 무는 것

- **움직이는 것에 element screenshot을 쓰면 timeout 난다** ("element is not
  stable"). 그건 요소가 멈출 때까지 기다리는데, 캐릭터와 벽 블록은 안 멈춘다.
  멈춰 세우고 찍으려면 `open({ reduced: true })`, 움직이는 채로 재려면
  `shootPair`(자리를 한 번 재 두고 페이지에서 오려낸다 — 기다리지 않는다).
- **폰↔벽 왕복은 `?mock=1`로 안 된다.** mock은 페이지마다 따로 논다. 두 화면을
  이어 보려면 `real: true`로 실제 Firestore를 쓰고, 끝나면 테스트 글을 지운다.
  (그 절차는 `scripts/e2e-dock.mjs`에 이미 있다 — 새로 짜기 전에 그걸 본다.)
- **Bash 히어독 안에서 백슬래시가 한 겹 벗겨진다.** `\n`이나 `\s`가 들어가는
  문자열로 파일을 고치려 하면 안 맞는다. 앵커를 백슬래시 없는 것으로 잡거나
  Write 도구를 쓴다.
