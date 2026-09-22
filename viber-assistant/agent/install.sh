#!/usr/bin/env bash
#
# Слага робота на този Mac и го пуска да върви сам.
#
# След това роботът тръгва при всяко включване на компютъра и не иска
# никакво внимание. Спира се с: bash install.sh --махни
#
# Употреба:
#   bash install.sh https://имотсайт.com/api/viber/ingest ТОКЕН
#   bash install.sh --махни

set -uo pipefail

LABEL="com.imotpoint.viber-agent"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
CONFIG="$HOME/.viber-agent.conf"
HERE="$(cd "$(dirname "$0")" && pwd)"
AGENT="$HERE/viber-agent.sh"

ok()   { printf '  ✅ %s\n' "$1"; }
bad()  { printf '  ❌ %s\n' "$1"; }
info() { printf '     %s\n' "$1"; }

# ── Махане ─────────────────────────────────────────────────────────────

if [ "${1:-}" = "--махни" ] || [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null \
    || launchctl unload "$PLIST" 2>/dev/null
  rm -f "$PLIST"
  ok 'Роботът е спрян и махнат от автоматичното пускане.'
  info "Настройките остават в $CONFIG — изтрий ги ръчно, ако искаш."
  exit 0
fi

# ── Слагане ────────────────────────────────────────────────────────────

URL="${1:-}"
TOKEN="${2:-}"

if [ -z "$URL" ] || [ -z "$TOKEN" ]; then
  bad 'Липсват адрес и токен.'
  info 'Употреба:'
  info '  bash install.sh https://твоятсайт.com/api/viber/ingest ТОКЕН'
  exit 1
fi

case "$URL" in
  https://*) ;;
  *) bad 'Адресът трябва да започва с https:// — токенът пътува през него.'
     exit 1 ;;
esac

if [ ${#TOKEN} -lt 24 ]; then
  bad 'Токенът е твърде къс (трябват поне 24 знака).'
  exit 1
fi

if [ ! -f "$AGENT" ]; then
  bad "Не намирам viber-agent.sh до този скрипт ($AGENT)."
  exit 1
fi
chmod +x "$AGENT"

# Настройките съдържат токен — четими само от собственика.
umask 077
cat > "$CONFIG" <<CONF
# Настройки на Viber робота. Съдържа таен токен — не споделяй този файл.
VIBER_INGEST_URL="$URL"
VIBER_AGENT_TOKEN="$TOKEN"
VIBER_INTERVAL="120"
CONF
chmod 600 "$CONFIG"
ok "Настройките са записани в $CONFIG"

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST_EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>$AGENT</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <!-- Роботът сам си върти цикъла; ако все пак спре, launchd го вдига пак. -->
  <key>KeepAlive</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>$HOME/.viber-agent/launchd.log</string>
</dict>
</plist>
PLIST_EOF
ok "Автоматичното пускане е настроено ($PLIST)"

mkdir -p "$HOME/.viber-agent"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
if launchctl bootstrap "gui/$(id -u)" "$PLIST" 2>/dev/null \
   || launchctl load "$PLIST" 2>/dev/null; then
  ok 'Роботът работи.'
else
  bad 'Роботът не тръгна.'
  info "Виж $HOME/.viber-agent/launchd.log"
  exit 1
fi

printf '\n'
info 'Готово. Роботът вече гледа Viber сам и тръгва при всяко включване.'
info ''
info 'Две разрешения му трябват, ако още не са дадени'
info '(System Settings → Privacy & Security):'
info '  • Accessibility  — за да намира прозореца на Viber'
info '  • Screen Recording — за да го снима'
info ''
info "Какво прави в момента:  tail -f $HOME/.viber-agent/agent.log"
info 'Спиране:                bash install.sh --махни'
printf '\n'
