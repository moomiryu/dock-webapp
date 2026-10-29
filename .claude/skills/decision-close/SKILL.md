---
name: decision-close
description: 확정된 결정(번호)을 문서에 마감한다 — 그 결정의 코드 커밋을 읽고 README.md · design/landscape.md를 맞추고, 기억 파일을 정리하고, 그 문서들만 집어 커밋한다. "결정 57 마감", "57 문서 맞춰줘", "문서 정리해줘", "README에 넣어줘"라고 할 때 사용. 번호 없이 부르면 문서에 아직 안 들어간 결정부터 찾는다.
allowed-tools: Read, Edit, Write, Grep, Glob, Bash(git log *), Bash(git show *), Bash(git diff *), Bash(git status *), Bash(git commit *), Bash(git reset *), Bash(git hash-object *), Bash(git read-tree *), Bash(git update-index *), Bash(git write-tree *), Bash(git commit-tree *), Bash(git update-ref *), Bash(npx oh-my-design-cli*)
---

# 결정 마감

디자이너가 화면에서 "좋다"로 확정한 결정을 지도(README · landscape.md)에 옮기는 일.
코드는 이미 커밋돼 있다. 이 스킬은 **문서만** 고친다. 화면은 바뀌지 않으니 중간에 묻지
않고 끝까지 한다 — 멈추는 건 아래 '멈출 때'뿐.

## 0. 어느 결정인가

번호를 받았으면 그 번호. 없으면 **마지막 문서 커밋 이후의 코드 커밋**이 문서에 안 들어간 것이다:

```bash
last=$(git log -1 --format=%h -E --grep="^(Bring|Rewrite) README")
git log --oneline $last..HEAD
```

그 목록을 디자이너에게 한 줄씩 한국어로 풀어 보여 주고 어디까지 마감할지 고르게 한다.
(번호를 커밋과 문서에서 뽑아 대조하는 방식은 쓰지 않는다 — 2026-10-29에 돌려 보니 25개 중
대부분이 가짜였다. 커밋이 옛 결정을 지나가며 언급하고, 문서는 번호 없이 이미 설명한다.)

## 1. 무엇이 바뀌었나 — 코드에서 읽는다

```bash
git log --oneline --grep="[Dd]ecision 57\b"           # 번호 바꿔서
git show <커밋>                                      # 각각 다 읽는다
```

기억 파일(`~/.claude/projects/c--dev-megafont-webapp/memory/` 에서 `결정 57` grep)에
디자이너가 한 말과 이유가 있다. **이유는 기억에서, 동작은 코드에서** 가져온다. 기억이
코드와 다르면 코드가 맞다.

아직 커밋 안 된 결정이면 멈춘다 — 문서가 코드보다 앞서면 안 된다.

## 2. README.md

- 화면 흐름 표(00 ~ 08)와 경로 표에서 그 결정이 닿는 줄을 모두 고친다
- 날짜와 결정 번호를 괄호로: `(2026-10-22 결정 56 — 그전엔 …)`. 뒤집힌 옛 동작은 '그전엔'으로 한 구절 남긴다
- **수치를 옮겨 적지 않는다.** 파일 이름과 토큰 이름(`WallSky.tsx`, `--t-hold`)으로 가리킨다
- 맨 아래 '아직 안 된 것'에서 이 결정으로 닫힌 것은 지우고, 새로 열린 것은 더한다

## 3. design/landscape.md

- 규칙을 현재형으로 고치고, 디자이너가 한 말을 따옴표째 붙인다
- 뒤집힌 옛 규칙은 지우지 않고 바로 아래 `- 그 전(결정 9 · 19, 기간): …`으로 내린다
- 다른 결정의 '열린 것'이 이걸로 닫혔으면 그 자리에 닫혔다고 적는다

## 4. 건드리지 않는 것

- **CLAUDE.md** — 디자이너가 시킬 때만
- **DESIGN.md** — 참여자 폰 화면의 계약. 결정이 폰 화면의 규칙(색 · 모양 · 버튼 · 여백)을 바꿀 때만 고치고,
  고쳤으면 `npx oh-my-design-cli@latest design-md validate DESIGN.md`가 통과하는지 본다
- 코드 파일 — 주석이 틀렸어도 이 스킬에선 적어만 두고 보고한다

## 5. 기억 정리

- 그 결정의 기억 파일: '문서' 할 일을 끝냈다고 적고, 남은 것만 남긴다
- `MEMORY.md`의 그 줄을 한 줄로 줄인다 — 다 끝난 결정은 "라이브 <커밋> · 문서 <커밋>"이면 충분하다
  (내용은 이제 README에 있다)

## 6. 커밋 — 내 문서만

다른 세션이 같은 폴더에서 동시에 커밋한다.

```bash
git diff --cached --stat                 # 남이 올려 둔 게 있으면 건드리지 않는다
git status --short README.md design/landscape.md DESIGN.md
```

- 그 파일들에 내 변경만 있으면 `git commit -o README.md design/landscape.md`처럼 **경로를 집어** 커밋
- 남의 덩어리가 섞여 있으면 임시 index로 내 덩어리만 — 방법은 기억 `concurrent_sessions_commit.md`
- 커밋 뒤 `git show --stat HEAD`로 내 파일만 들어갔는지 본다

메시지는 지금까지의 문서 커밋 결을 따른다(`git log --oneline --grep="Bring README"`):

```
Bring README and landscape.md up to decision 57, so the map stops saying <옛 이야기>

Decision 57 (<코드 커밋들>) changed <무엇>, but the docs still told <옛 문장>.

- Decision 57: <고친 곳 — 표의 어느 줄, landscape의 어느 절, 옛 규칙은 history로>
- DESIGN.md <고쳤으면 무엇 / 안 고쳤으면 왜>

Not done: CLAUDE.md, by instruction.
```

**push하지 않는다.** 배포는 `deploy` 스킬로, 디자이너가 말할 때.

## 멈출 때

- 결정의 코드가 아직 커밋 안 됐다
- 코드와 기억이 말하는 동작이 다르고, 어느 쪽이 디자이너 뜻인지 모르겠다
- 문서를 고치다 보니 다른 결정과 부딪친다

## 보고

한국어로 세 줄: 어느 결정을 / 어느 문서의 어디를 고쳤나 / 커밋 번호. 남은 것이 있으면 한 줄 더.
