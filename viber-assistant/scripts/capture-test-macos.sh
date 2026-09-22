#!/usr/bin/env bash
#
# Първото парче от робота: снима прозореца на Viber сам, без човек да пипа.
#
# Проверява дали снимката излиза четима — от това зависи дали роботът може
# да чете списъка с чатове, след като текстът в базата е криптиран.
#
# ВАЖНО ЗА ПОВЕРИТЕЛНОСТТА: за разлика от предишните проверки, ТАЗИ снимка
# СЪДЪРЖА истински съобщения. Остава само на твоя Mac, на работния плот.
# НЕ я изпращай на никого, включително на мен — погледни я ти и кажи с думи
# дали се чете.

set -uo pipefail

hr()      { printf '%s\n' '────────────────────────────────────────────────────────'; }
section() { printf '\n'; hr; printf '  %s\n' "$1"; hr; }
ok()      { printf '  ✅ %s\n' "$1"; }
warn()    { printf '  ⚠️  %s\n' "$1"; }
bad()     { printf '  ❌ %s\n' "$1"; }
info()    { printf '     %s\n' "$1"; }

OUT="$HOME/Desktop/viber-proba.png"

printf 'Проба на автоматичната снимка — %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"

section '1. Отворен ли е Viber'

if ! pgrep -qx 'Viber' 2>/dev/null; then
  bad 'Viber не работи. Пусни го, отвори списъка с чатове и опитай пак.'
  exit 0
fi
ok 'Viber работи.'

section '2. Къде е прозорецът му'

bounds="$(osascript <<'APPLESCRIPT' 2>&1
tell application "System Events"
	if not (exists process "Viber") then return "NO_PROC"
	tell process "Viber"
		if (count of windows) is 0 then return "NO_WINDOW"
		set p to position of window 1
		set s to size of window 1
		return (item 1 of p as text) & "," & (item 2 of p as text) & "," & ¬
		       (item 1 of s as text) & "," & (item 2 of s as text)
	end tell
end tell
APPLESCRIPT
)"

case "$bounds" in
  NO_PROC|NO_WINDOW)
    bad 'Viber няма отворен прозорец. Отвори го и опитай пак.'
    exit 0 ;;
  *-25211*|*'not allowed'*)
    bad 'Липсва разрешение за достъпност.'
    info 'System Settings → Privacy & Security → Accessibility → Terminal'
    exit 0 ;;
  [0-9-]*,*,*,*) ;;
  *)
    bad 'Не успях да намеря прозореца.'
    info "$bounds"
    exit 0 ;;
esac

w="$(printf '%s' "$bounds" | cut -d, -f3)"
h="$(printf '%s' "$bounds" | cut -d, -f4)"
ok "Прозорец намерен: ${w}x${h} точки."

section '3. Снимката'

rm -f "$OUT" 2>/dev/null
# -x = без звук и без трепване на екрана; човекът не бива да усеща нищо.
screencapture -x -R "$bounds" "$OUT" 2>/dev/null

if [ ! -f "$OUT" ]; then
  bad 'Снимката не се получи.'
  info 'Най-вероятно липсва разрешение за запис на екрана:'
  info '  System Settings → Privacy & Security → Screen Recording'
  info '  → бутон "+" → Applications → Utilities → Terminal'
  info 'После ЗАТВОРИ Терминала изцяло (⌘Q), отвори го пак и пусни наново.'
  exit 0
fi

size="$(stat -f '%z' "$OUT" 2>/dev/null || stat -c '%s' "$OUT" 2>/dev/null || echo 0)"
case "$size" in ''|*[!0-9]*) size=0 ;; esac
kb=$(( size / 1024 ))

dims="$(sips -g pixelWidth -g pixelHeight "$OUT" 2>/dev/null \
        | awk '/pixel(Width|Height)/ {printf "%s ", $2}')"

info "Файл: ~/Desktop/viber-proba.png"
info "Размер: ${kb} KB"
[ -n "$dims" ] && info "Размери: $dims точки"

printf '\n'
if [ "$kb" -lt 20 ]; then
  warn 'Снимката е подозрително малка — вероятно е празна или черна.'
  info 'Това почти винаги значи липсващо разрешение за запис на екрана.'
  info '  System Settings → Privacy & Security → Screen Recording → Terminal'
  info 'После затвори Терминала с ⌘Q, отвори го пак и пусни наново.'
else
  ok 'Снимката изглежда пълноценна.'
fi

section '4. Твоята работа сега'

info 'Отвори ~/Desktop/viber-proba.png (двоен клик) и виж:'
info ''
info '  • Вижда ли се списъкът с чатовете?'
info '  • Четат ли се имената на клиентите?'
info '  • Виждат ли се часовете и откъсите от последните съобщения?'
info ''
warn 'НЕ ми я изпращай — вътре има истински съобщения.'
info 'Просто ми кажи с думи дали се чете.'
printf '\n'
