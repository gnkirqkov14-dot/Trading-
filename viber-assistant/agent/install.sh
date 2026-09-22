#!/usr/bin/env bash
#
# Слага робота на този Mac и го пуска да върви сам.
#
# ⚠️ Две неща тук са научени на живо и не бива да се "опростяват" обратно:
#
# 1. Роботът се опакова като приложение (ViberRobot.app), а не се пуска
#    направо като скрипт. macOS дава разрешението за запис на екрана на
#    КОНКРЕТНА програма. Когато launchd пуска скрипта, програмата за
#    системата е /bin/bash — на него разрешение не се дава. Затова
#    разрешението, дадено на Терминала, не важеше и снимките излизаха празни.
#
# 2. В приложението стои САМО мъничък стартер, който никога не се променя.
#    Самият робот живее ОТВЪН, в ~/.viber-agent/viber-agent.sh.
#    Причината е скъпо платена: macOS помни разрешението по подписа на
#    приложението. Докато роботът беше вътре, всяко обновяване сменяше
#    подписа, системата го смяташе за друга програма и разрешението тихо
#    спираше да важи — ключето в настройките си стоеше включено, а снимките
#    пак излизаха празни. Сега обновяванията не пипат приложението и
#    разрешението се дава веднъж завинаги.
#
# Употреба:
#   bash install.sh https://имотсайт.com/api/viber/ingest ТОКЕН
#   bash install.sh --махни

set -uo pipefail

LABEL="com.imotpoint.viber-robot"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
CONFIG="$HOME/.viber-agent.conf"
STATE_DIR="$HOME/.viber-agent"
AGENT_DEST="$STATE_DIR/viber-agent.sh"
APP="$HOME/Applications/ViberRobot.app"
EXEC="$APP/Contents/MacOS/ViberRobot"
STAMP="$APP/Contents/Resources/launcher-version"
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
  rm -f "$AGENT_DEST"
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

mkdir -p "$STATE_DIR" "$HOME/Library/LaunchAgents" "$HOME/Applications"

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

# ── Самият робот (ИЗВЪН приложението) ──────────────────────────────────

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null
launchctl bootout "gui/$(id -u)/com.imotpoint.viber-agent" 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/com.imotpoint.viber-agent.plist"

cp "$AGENT" "$AGENT_DEST"
chmod +x "$AGENT_DEST"
ok "Роботът е обновен: $AGENT_DEST"

# ── Приложението (стартерът — променя се почти никога) ─────────────────

# Версията на стартера. Пипа се САМО когато самият стартер трябва да се
# смени. Всяка смяна на това число значи ново разрешение от собственика,
# затова не се пипа при обикновени поправки в робота.
#
# Нарочно се пази само числото, без кой вариант е използван (компилиран или
# скрипт). Инак се получава капан: ако компилирането веднъж не стане и се
# запише "скрипт", следващото пускане пак ще иска компилиран, ще пресъздаде
# приложението и ще поиска ново разрешение — при всяко обновяване, завинаги.
WANT="3"
HAVE="$(cat "$STAMP" 2>/dev/null || true)"

if [ "$HAVE" = "$WANT" ] && [ -x "$EXEC" ]; then
  REBUILT=0
  ok 'Приложението остава непокътнато — разрешението му важи и занапред.'
else
  REBUILT=1
  rm -rf "$APP"
  mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

  cat > "$APP/Contents/Info.plist" <<'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key>
  <string>ViberRobot</string>
  <key>CFBundleDisplayName</key>
  <string>ViberRobot</string>
  <key>CFBundleIdentifier</key>
  <string>com.imotpoint.viber-robot</string>
  <key>CFBundleExecutable</key>
  <string>ViberRobot</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleVersion</key>
  <string>3</string>
  <key>CFBundleShortVersionString</key>
  <string>3.0</string>
  <key>LSBackgroundOnly</key>
  <true/>
</dict>
PLIST_EOF
  printf '</plist>\n' >> "$APP/Contents/Info.plist"

  BUILT=''
  if command -v swiftc >/dev/null 2>&1; then
    # Истинска програма, а не скрипт. Причината е в разрешението: скриптът
    # се изпълнява от /bin/bash и за системата програмата е bash.
    # Компилираната програма си има собствена самоличност, а роботът, който
    # тя пуска, наследява нейното разрешение — точно както screencapture
    # работи от Терминала, защото Терминалът има разрешението.
    WORK="$(mktemp -d "${TMPDIR:-/tmp}/viberlaunch.XXXXXX")"
    # Файлът се казва main.swift нарочно: Swift позволява код направо в
    # тялото на файла само там. С друго име компилаторът отказва.
    SRC="$WORK/main.swift"
    cat > "$SRC" <<'SWIFT_EOF'
import Foundation

// Стартерът не прави нищо сам. Пуска робота и чака. Така остава
// непроменен между обновяванията и разрешението му не се губи.
let script = NSHomeDirectory() + "/.viber-agent/viber-agent.sh"

guard FileManager.default.isReadableFile(atPath: script) else {
    FileHandle.standardError.write(Data("няма робот на \(script)\n".utf8))
    exit(66)
}

let robot = Process()
robot.executableURL = URL(fileURLWithPath: "/bin/bash")
robot.arguments = [script]

do {
    try robot.run()
} catch {
    FileHandle.standardError.write(Data("роботът не тръгна: \(error)\n".utf8))
    exit(70)
}

robot.waitUntilExit()
exit(robot.terminationStatus)
SWIFT_EOF
    if swiftc -O -o "$EXEC" "$SRC" >/dev/null 2>&1; then
      BUILT='swift'
      ok 'Стартерът е компилиран.'
    else
      warn 'Компилирането не стана — минавам на резервния вариант.'
    fi
    rm -rf "$WORK"
  fi

  if [ -z "$BUILT" ]; then
    cat > "$EXEC" <<'SHELL_EOF'
#!/bin/bash
# Стартер. Не се променя — робота го пази ~/.viber-agent/viber-agent.sh.
exec /bin/bash "$HOME/.viber-agent/viber-agent.sh"
SHELL_EOF
  fi

  chmod +x "$EXEC"
  printf '%s' "$WANT" > "$STAMP"

  # Подпис "на място": без него по-новите macOS не задържат разрешението.
  # Не е истински сертификат — достатъчно е системата да разпознава
  # приложението като едно и също при всяко пускане.
  if command -v codesign >/dev/null 2>&1; then
    if codesign --force --deep --sign - "$APP" 2>/dev/null; then
      ok 'Приложението е подписано.'
    else
      warn 'Подписването не стана — разрешението може да се иска повторно.'
    fi
  fi
  ok "Приложението е създадено: $APP"
fi

# ── Автоматичното пускане ──────────────────────────────────────────────

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
  <string>$STATE_DIR/launchd.log</string>
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
  info "Виж $STATE_DIR/launchd.log"
  exit 1
fi

printf '\n'
if [ "$REBUILT" = "1" ]; then
  printf '  ━━━ ОСТАВА ЕДНО РАЗРЕШЕНИЕ (ПОСЛЕДЕН ПЪТ) ━━━\n\n'
  info 'Приложението е ново, затова macOS иска разрешението наново.'
  info 'Оттук нататък обновяванията НЕ го пипат и това няма да се повтаря.'
  info ''
  info 'System Settings → Privacy & Security → Screen & System Audio Recording'
  info '  1. ако там вече пише ViberRobot — махни го с бутона "−"'
  info '  2. бутон "+" → ⌘⇧G → залепи:'
  info "       $APP"
  info '  3. избери ViberRobot → включи ключето'
  info ''
  info 'После:'
  info "  launchctl kickstart -k gui/\$(id -u)/$LABEL"
else
  printf '  ━━━ ГОТОВО ━━━\n\n'
  info 'Приложението не е пипано, значи разрешението му важи.'
fi
printf '\n'
info "Какво прави:  tail -20 $STATE_DIR/agent.log"
info 'Спиране:      bash install.sh --махни'
printf '\n'
