#!/usr/bin/env bash
#
# Слага робота на този Mac и го пуска да върви сам.
#
# ⚠️ Роботът се опакова като приложение (ViberRobot.app), а не се пуска
# направо като скрипт. Причината е научена от живо: macOS дава разрешението
# за запис на екрана на КОНКРЕТНА програма. Когато launchd пуска скрипта,
# програмата за системата е /bin/bash — а на него разрешение не се дава.
# Затова разрешението, дадено на Терминала, не важи за автоматично пуснатия
# робот и снимките излизаха празни. Приложението има собствено име и иконка
# в списъка с разрешения, тоест може да получи своето.
#
# Употреба:
#   bash install.sh https://имотсайт.com/api/viber/ingest ТОКЕН
#   bash install.sh --махни

set -uo pipefail

LABEL="com.imotpoint.viber-robot"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
CONFIG="$HOME/.viber-agent.conf"
APP="$HOME/Applications/ViberRobot.app"
EXEC="$APP/Contents/MacOS/ViberRobot"
HERE="$(cd "$(dirname "$0")" && pwd)"
AGENT="$HERE/viber-agent.sh"

ok()   { printf '  ✅ %s\n' "$1"; }
bad()  { printf '  ❌ %s\n' "$1"; }
warn() { printf '  ⚠️  %s\n' "$1"; }
info() { printf '     %s\n' "$1"; }

# ── Махане ─────────────────────────────────────────────────────────────

if [ "${1:-}" = "--махни" ] || [ "${1:-}" = "--remove" ]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null \
    || launchctl unload "$PLIST" 2>/dev/null
  # Старото име от първата версия, ако е останало.
  launchctl bootout "gui/$(id -u)/com.imotpoint.viber-agent" 2>/dev/null
  rm -f "$PLIST" "$HOME/Library/LaunchAgents/com.imotpoint.viber-agent.plist"
  rm -rf "$APP"
  ok 'Роботът е спрян, махнат от автоматичното пускане и изтрит.'
  info "Настройките остават в $CONFIG — изтрий ги ръчно, ако искаш."
  info 'Разрешенията му остават в System Settings; махни ги оттам при нужда.'
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

# Настройките съдържат токен — четими само от собственика.
umask 077
cat > "$CONFIG" <<CONF
# Настройки на Viber робота. Съдържа таен токен — не споделяй този файл.
VIBER_INGEST_URL="$URL"
VIBER_AGENT_TOKEN="$TOKEN"
VIBER_INTERVAL="1200"
CONF
chmod 600 "$CONFIG"
# Стеснената маска важеше само за файла с токена. Приложението отдолу трябва
# да е с обичайни права — бъндъл с 700 обърква macOS при проверка на подписа.
umask 022
ok "Настройките са записани в $CONFIG"

# ── Приложението ───────────────────────────────────────────────────────

# Спираме стария робот (под двете имена), преди да пипаме файловете му.
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
launchctl bootout "gui/$(id -u)/com.imotpoint.viber-agent" 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/com.imotpoint.viber-agent.plist"

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS"

cat > "$APP/Contents/Info.plist" <<'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>ViberRobot</string>
  <key>CFBundleDisplayName</key>
  <string>Viber робот</string>
  <key>CFBundleIdentifier</key>
  <string>com.imotpoint.viber-robot</string>
  <key>CFBundleExecutable</key>
  <string>ViberRobot</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleVersion</key>
  <string>1</string>
  <key>CFBundleShortVersionString</key>
  <string>1.0</string>
  <!-- Без иконка в Dock и без прозорец: роботът работи мълчаливо. -->
  <key>LSBackgroundOnly</key>
  <true/>
  <!-- Текстът, който macOS показва, когато поиска разрешение. -->
  <key>NSCameraUsageDescription</key>
  <string>Роботът снима прозореца на Viber, за да види кой чака отговор.</string>
</dict>
PLIST_EOF
printf '</plist>\n' >> "$APP/Contents/Info.plist"

cp "$AGENT" "$EXEC"
chmod +x "$EXEC"

# Подпис "на място": без него по-новите macOS не задържат разрешението и
# то се губи при всяко пускане. Не е истински сертификат — достатъчно е
# системата да разпознава приложението като едно и също.
if command -v codesign >/dev/null 2>&1; then
  if codesign --force --deep --sign - "$APP" 2>/dev/null; then
    ok 'Приложението е подписано (за да не се губи разрешението).'
  else
    warn 'Подписването не стана — разрешението може да се иска повторно.'
  fi
fi
ok "Приложението е създадено: $APP"

# ── Автоматичното пускане ──────────────────────────────────────────────

mkdir -p "$HOME/Library/LaunchAgents" "$HOME/.viber-agent"

# Пуска се ИЗПЪЛНИМИЯТ ФАЙЛ НА ПРИЛОЖЕНИЕТО, не bash със скрипт като аргумент.
# Така macOS вижда ViberRobot, а не /bin/bash, и разрешението важи.
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
    <string>$EXEC</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>$HOME/.viber-agent/launchd.log</string>
</dict>
</plist>
PLIST_EOF
ok "Автоматичното пускане е настроено"

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
printf '  ━━━ ОСТАВА ЕДНО РАЗРЕШЕНИЕ ━━━\n\n'
info 'Дай го на "ViberRobot" — НЕ на Терминала. Разрешението важи за'
info 'програмата, която снима, а вече това е роботът.'
info ''
info 'System Settings → Privacy & Security → Screen & System Audio Recording'
info '  → бутон "+" → папката Applications в твоята домашна папка'
info '  → избери ViberRobot → включи ключето'
info ''
info 'Ако не се вижда в прозореца за избор, натисни ⌘⇧G и напиши:'
info "  $APP"
info ''
info 'Accessibility НЕ му трябва — роботът вече намира прозореца другояче.'
info 'Ако си добавил "bash" някъде в разрешенията, можеш да го махнеш.'
printf '\n'
info "Какво прави:  tail -20 ~/.viber-agent/agent.log"
info 'Спиране:      bash install.sh --махни'
printf '\n'
