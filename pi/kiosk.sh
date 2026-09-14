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

# 와이파이가 붙기 전에 열면 빈 화면이 된다
sleep 8

# --password-store=basic 이 그 '키링이 잠겼습니다' 창을 막는다.
# 크로미움이 비밀번호 금고를 아예 안 건드리게 하는 스위치다.
exec chromium-browser \
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
