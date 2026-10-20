#!/bin/bash
# 파이에서 한 번만 돌린다. 셋을 심는다:
#   1) 부팅하면 벽 화면이 전체화면으로 뜬다      (자동 시작 항목)
#   2) 홈의 스위치를 읽어 벽에 알린다            (systemd 서비스)
#   3) 벽의 끄기 버튼으로 파이를 끈다            (systemd 서비스 + 끄는 명령 하나의 권한 + 크로미움 정책)
#      다시 돌려도 된다 — 2026-10-21에 3)이 더해졌으니 그전에 깐 파이는 한 번 더 돌린다
#
#   cd ~/megafont && bash install.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$HERE/megafont.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "megafont.env 가 없다. megafont.env.example 을 복사해 값을 채워라."
  exit 1
fi

# 값이 자리표시자 그대로면 여기서 멈춘다. 2026-09-22 첫 실기에서 이걸 안
# 막아서, 서비스가 '여기에-firebase-api-key'를 그대로 들고 뜬 채 403만 찍었다.
# switch.py는 값이 비었는지만 보지 그 값이 말이 되는지는 안 본다.
if grep -q '여기에-' "$ENV_FILE"; then
  echo "megafont.env 에 아직 안 채운 값이 있다:"
  grep -n '여기에-' "$ENV_FILE" | sed 's/^/  /'
  echo "채운 뒤 다시 돌려라:  nano $ENV_FILE && bash install.sh"
  exit 1
fi

chmod +x "$HERE/kiosk.sh" "$HERE/switch.py" "$HERE/power.py"

# ── 1. 부팅하면 벽 ────────────────────────────────────────────
# XDG 자동 시작은 라즈베리파이 OS의 어느 데스크톱(labwc·wayfire·LXDE)에서나
# 똑같이 듣는다. 창 관리자마다 다른 파일을 고치지 않아도 된다.
mkdir -p "$HOME/.config/autostart"
cat > "$HOME/.config/autostart/megafont-wall.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=MEGAFONT Wall
Exec=/bin/bash -lc 'set -a; . $ENV_FILE; set +a; exec $HERE/kiosk.sh'
X-GNOME-Autostart-enabled=true
DESKTOP

# ── 2. 스위치 ────────────────────────────────────────────────
# 사용자 서비스로 둔다 — sudo 없이 GPIO를 읽을 수 있고(gpio 그룹),
# 죽으면 5초 뒤 저절로 다시 선다.
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/megafont-switch.service" <<UNIT
[Unit]
Description=MEGAFONT dock switch
After=network-online.target

[Service]
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/python3 $HERE/switch.py
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
UNIT

# ── 3. 끄기 버튼 ─────────────────────────────────────────────
# 벽 오른쪽 아래의 끄기 버튼이 두드리는 문지기(power.py). 스위치처럼 사용자 서비스로 —
# 파이 자신(127.0.0.1)에서, 벽 주소에서 온 신호만 받는다.
cat > "$HOME/.config/systemd/user/megafont-power.service" <<UNIT
[Unit]
Description=MEGAFONT wall power-off button

[Service]
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/python3 $HERE/power.py
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
UNIT

# 끄는 명령 하나만 비밀번호 없이 허락한다(다른 sudo는 그대로). 틀린 sudoers는 sudo 전체를
# 막으므로, visudo로 검사해 틀렸으면 지우고 끄기 버튼 없이 계속한다.
SYSTEMCTL="$(command -v systemctl)"
echo "$USER ALL=(root) NOPASSWD: $SYSTEMCTL poweroff" | sudo tee /etc/sudoers.d/megafont-power >/dev/null
sudo chmod 440 /etc/sudoers.d/megafont-power
if ! sudo visudo -cf /etc/sudoers.d/megafont-power >/dev/null; then
  sudo rm -f /etc/sudoers.d/megafont-power
  echo "끄는 권한을 못 심었다 — 끄기 버튼은 안 듣는다(나머지는 그대로)."
fi

# 크롬 142부터 웹 페이지가 기기 안의 프로그램을 부르면 '로컬 네트워크 접근' 허락 창이 뜬다.
# 키오스크엔 누를 사람이 없으니 벽 주소의 출처만 미리 허락해 둔다(크로미움 관리 정책 —
# 이름이 chromium · chromium-browser 둘이라 두 자리에 다 둔다).
URL="$(grep -E '^MEGAFONT_URL=' "$ENV_FILE" | cut -d= -f2-)"
ORIGIN="$(echo "${URL:-https://megafont.vercel.app/wall}" | sed -E 's#^(https?://[^/]+).*#\1#')"
for D in /etc/chromium/policies/managed /etc/chromium-browser/policies/managed; do
  sudo mkdir -p "$D"
  echo "{ \"LocalNetworkAccessAllowedForUrls\": [\"$ORIGIN\"] }" | sudo tee "$D/megafont.json" >/dev/null
done

systemctl --user daemon-reload
# enable --now 는 이미 도는 서비스를 건드리지 않는다 — 값을 고치고 이 파일을
# 다시 돌려도 옛 값으로 계속 돌았다. 늘 다시 띄워서 지금 값을 읽게 한다.
systemctl --user enable megafont-switch.service megafont-power.service
systemctl --user restart megafont-switch.service megafont-power.service
# 로그인 안 해도 서비스가 돌게 (설치물은 사람이 로그인하지 않는다)
sudo loginctl enable-linger "$USER" || true

echo
echo "심었다."
echo "  스위치 상태 :  systemctl --user status megafont-switch"
echo "  스위치 로그 :  sudo journalctl -f _SYSTEMD_USER_UNIT=megafont-switch.service"
echo "  끄기 버튼   :  systemctl --user status megafont-power  (받는 출처 $ORIGIN)"
echo "  벽          :  재부팅하면 뜬다 —  sudo reboot"
