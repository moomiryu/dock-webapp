#!/bin/bash
# 파이에서 한 번만 돌린다. 둘을 심는다:
#   1) 부팅하면 벽 화면이 전체화면으로 뜬다      (자동 시작 항목)
#   2) 홈의 스위치를 읽어 벽에 알린다            (systemd 서비스)
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

chmod +x "$HERE/kiosk.sh" "$HERE/switch.py"

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

systemctl --user daemon-reload
# enable --now 는 이미 도는 서비스를 건드리지 않는다 — 값을 고치고 이 파일을
# 다시 돌려도 옛 값으로 계속 돌았다. 늘 다시 띄워서 지금 값을 읽게 한다.
systemctl --user enable megafont-switch.service
systemctl --user restart megafont-switch.service
# 로그인 안 해도 서비스가 돌게 (설치물은 사람이 로그인하지 않는다)
sudo loginctl enable-linger "$USER" || true

echo
echo "심었다."
echo "  스위치 상태 :  systemctl --user status megafont-switch"
echo "  스위치 로그 :  sudo journalctl -f _SYSTEMD_USER_UNIT=megafont-switch.service"
echo "  벽          :  재부팅하면 뜬다 —  sudo reboot"
