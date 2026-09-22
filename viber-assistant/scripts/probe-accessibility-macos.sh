#!/usr/bin/env bash
#
# Проверка дали текстът в прозореца на Viber може да се чете през
# Accessibility API на macOS — същият механизъм, който ползват екранните
# четци за незрящи.
#
# Смисълът: базата със съобщенията е криптирана, но това, което е НА ЕКРАНА,
# може да е достъпно. Ако е — списъкът с чатове (кой е писал последен и кога)
# се чете, а оттам идва най-ценната функция: "кой клиент чака отговор".
#
# ПОВЕРИТЕЛНОСТ: НЕ извежда съдържание на съобщения. Само БРОИ елементи
# и текстови полета. Изходът е безопасен за споделяне.

set -uo pipefail

hr()      { printf '%s\n' '────────────────────────────────────────────────────────'; }
section() { printf '\n'; hr; printf '  %s\n' "$1"; hr; }
ok()      { printf '  ✅ %s\n' "$1"; }
warn()    { printf '  ⚠️  %s\n' "$1"; }
bad()     { printf '  ❌ %s\n' "$1"; }
info()    { printf '     %s\n' "$1"; }

printf 'Проверка за четене от екрана — %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"

section '1. Работи ли Viber'

if ! pgrep -qx 'Viber' 2>/dev/null; then
  bad 'Viber не работи.'
  info 'Пусни Viber, отвори го така, че да виждаш списъка с чатове,'
  info 'и пусни тази проверка отново.'
  exit 0
fi
ok 'Viber работи.'

section '2. Разрешение за достъпност'

# Тихо: при липса на разрешение osascript връща грешка, а не диалог.
perm="$(osascript -e 'tell application "System Events" to return (count of processes)' 2>&1)"
case "$perm" in
  *[!0-9]*|'')
    bad 'Терминалът НЯМА разрешение за достъпност.'
    info 'Дай му го така:'
    info '  System Settings → Privacy & Security → Accessibility'
    info '  → бутон "+" → Applications → Utilities → Terminal'
    info 'После ЗАТВОРИ Терминала, отвори го пак и пусни проверката наново.'
    printf '\n     (съобщението от системата: %s)\n' "$(printf '%s' "$perm" | head -2 | tr '\n' ' ')"
    exit 0
    ;;
esac
ok 'Разрешението е налично.'

section '3. Чете ли се прозорецът на Viber'

result="$(osascript <<'APPLESCRIPT' 2>&1
with timeout of 60 seconds
	tell application "System Events"
		if not (exists process "Viber") then return "NO_VIBER"
		tell process "Viber"
			if (count of windows) is 0 then return "NO_WINDOW"
			set elementCount to 0
			set textCount to 0
			try
				set allElements to entire contents of window 1
				set elementCount to count of allElements
				repeat with anElement in allElements
					try
						set theValue to value of anElement
						if theValue is not missing value then
							if (class of theValue is text) and (length of theValue > 2) then
								set textCount to textCount + 1
							end if
						end if
					end try
				end repeat
			on error errMsg
				return "ERROR:" & errMsg
			end try
			return "OK:" & elementCount & ":" & textCount
		end tell
	end tell
end timeout
APPLESCRIPT
)"

case "$result" in
  OK:*)
    elements="$(printf '%s' "$result" | cut -d: -f2)"
    texts="$(printf '%s' "$result" | cut -d: -f3)"
    info "Елементи в прозореца: $elements"
    info "От тях с четим текст:  $texts"
    printf '\n'
    if [ "${texts:-0}" -gt 20 ]; then
      ok 'ЧЕТЕ СЕ — текстът от прозореца е достъпен.'
      info 'Има реален път: четем списъка с чатове от екрана.'
    elif [ "${texts:-0}" -gt 0 ]; then
      warn 'Чете се съвсем малко текст.'
      info 'Вероятно Viber не излага съдържанието си, а само рамката на прозореца.'
      info 'Пробвай пак с отворен списък с чатове на преден план.'
    else
      bad 'НЕ СЕ ЧЕТЕ — прозорецът не излага никакъв текст.'
      info 'Viber рисува съдържанието си по начин, невидим за Accessibility API.'
    fi
    ;;
  NO_WINDOW)
    warn 'Viber работи, но няма отворен прозорец.'
    info 'Отвори прозореца на Viber и пусни проверката отново.'
    ;;
  NO_VIBER)
    bad 'Viber не е видим като процес.'
    ;;
  ERROR:*)
    bad 'Грешка при четенето.'
    info "$(printf '%s' "$result" | cut -d: -f2-)"
    ;;
  *)
    bad 'Неочакван резултат.'
    info "$result"
    ;;
esac

printf '\n  Изходът не съдържа съдържание на съобщения и може да се сподели.\n\n'
