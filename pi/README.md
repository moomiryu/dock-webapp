# 파이 — 벽을 띄우고 스위치를 읽는다

파이가 하는 일은 둘뿐이다. **벽 화면은 여기 없다** — 그건 웹이고 Vercel에
있다. 파이는 그걸 열어 보여줄 뿐이다.

| 파일 | 하는 일 |
|:--|:--|
| `kiosk.sh` | 부팅하면 `/wall`을 전체화면으로 연다 |
| `switch.py` | 홈의 스위치(11번 핀)를 읽어 벽에 알린다 |
| `install.sh` | 위 둘을 부팅에 심는다. 한 번만 돌린다 |

## 배선

| 스위치 | 파이 |
|:--|:--|
| 한쪽 | 11번 핀 (GPIO 17) |
| 반대쪽 | 6번 핀 (GND) |

저항은 안 단다 — 파이 안의 풀업을 쓴다.

## 까는 법

```bash
# 개발 PC에서 파이로 옮긴다
scp -r pi <사용자>@<파이주소>:~/megafont

# 파이에서
cd ~/megafont
cp megafont.env.example megafont.env
nano megafont.env        # 값 세 개를 채운다
bash install.sh
sudo reboot
```

## 신호가 흐르는 길

```
폰이 홈에 꽂힘
   → 스위치 닫힘 (11번 핀)
   → switch.py 가 control/display.switch = true 를 쓴다
   → 07 도킹 화면의 폰이 그걸 보고, 제 글의 id를 실어 벽에 신호를 보낸다
   → 벽이 그 글을 큰 상자로 띄운다 (30초에 걸쳐 잦아듦)
폰을 뺌
   → 스위치 열림 → switch = false → 폰이 벽에 "끝났다"
   → 큰 상자가 잔상으로 내려앉는다
```

**스위치는 '어느 글이냐'를 모른다.** 그건 폰이 안다. 그래서 스위치는 참/거짓
하나만 쓰고, 글을 지목하는 일은 폰이 하던 그대로 둔다.

## 안 될 때

| 증상 | 볼 곳 |
|:--|:--|
| 스위치를 눌러도 아무 일 없음 | `journalctl --user -u megafont-switch -f` |
| 벽이 안 뜸 | 와이파이. `megafont.env`의 `MEGAFONT_URL` |
| 옛날 벽이 뜸 | 아직 배포 안 된 것이다 |
| "키링이 잠겼습니다" 창 | `kiosk.sh`의 `--password-store=basic`이 막는다 |
