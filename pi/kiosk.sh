#!/bin/bash
# 부팅하면 벽 화면 하나만 뜬다. 브라우저 창도, 주소창도, 마우스도 없다.
set -u
URL="${MEGAFONT_URL:-https://megafont.vercel.app/wall}"

# 화면이 저절로 꺼지면 설치물이 죽은 것처럼 보인다. 절전을 끈다.
# (X11이면 xset, Wayland면 wlopm — 둘 중 있는 것만 듣는다)
xset s off -dpms s noblank 2>/dev/null || true
wlopm --on '*' 2>/dev/null || true

# 지난번에 깨끗이 안 닫혔다는 안내창이 뜨면 벽을 가린다. 흔적을 지운다.
PROFILE="$HOME/.config/chromium/Default/Preferences"
[ -f "$PROFILE" ] && sed -i 's/"exit_type":"Crashed"/"exit_type":"Normal"/' "$PROFILE" 2>/dev/null || true

# 인터넷이 잡히기 전에 열면 크로미움이 오류 페이지를 띄우고 **거기서 영영
# 안 움직인다** — 다시 시도하는 법이 없다. 8초를 기다리던 것을 2026-09-22에
# 걷어냈다: 처음 보는 와이파이는 붙는 데 8초보다 오래 걸릴 수 있고, 그러면
# 벽 대신 오류 페이지가 설치물이 된다. 이제 벽 주소가 실제로 응답할 때까지
# 기다린다. 2분을 넘기면 그냥 연다 — 그때는 망 자체가 없는 것이라 어차피
# 사람이 봐야 한다.
for _ in $(seq 1 60); do
  curl -s -o /dev/null --max-time 2 "$URL" && break
  sleep 2
done

# 브라우저 이름이 판마다 다르다. 옛 라즈베리파이 OS는 chromium-browser,
# 요즘(Bookworm부터)은 chromium이다. 2026-09-22 첫 실기에서 이 줄이
# chromium-browser만 부르는 바람에 부팅 뒤 화면이 그냥 검었다 — 없는 이름을
# 부르면 스크립트가 조용히 끝나고, 데스크톱은 뜨는데 벽만 안 뜬다.
BROWSER="$(command -v chromium-browser || command -v chromium)"
[ -n "$BROWSER" ] || { echo "chromium이 없다. sudo apt install chromium"; exit 1; }

# --password-store=basic 이 그 '키링이 잠겼습니다' 창을 막는다.
# 크로미움이 비밀번호 금고를 아예 안 건드리게 하는 스위치다.
exec "$BROWSER" \
  --kiosk \
  --app="$URL" \
  --password-store=basic \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-features=Translate,TranslateUI \
  --check-for-update-interval=31536000 \
  --autoplay-policy=no-user-gesture-required \
  --start-fullscreen
