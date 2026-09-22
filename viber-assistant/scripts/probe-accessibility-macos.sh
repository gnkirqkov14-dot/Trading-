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

section '1. С каква технология е писан Viber'

# Решава дали си струва да се гони достъпността. Програмите на Electron
# (Chromium) нарочно НЕ градят дърво за достъпност, докато не усетят екранен
# четец — но това може да се включи насила. При Qt такъв ключ няма.
toolkit='неизвестна'
fw='/Applications/Viber.app/Contents/Frameworks'

if [ -d "$fw" ]; then
  if ls "$fw" 2>/dev/null | grep -qi 'electron'; then
    toolkit='Electron'
  elif ls "$fw" 2>/dev/null | grep -qi '^Qt'; then
    toolkit='Qt'
  fi
fi

if [ "$toolkit" = 'неизвестна' ]; then
  bin="$(ls /Applications/Viber.app/Contents/MacOS/ 2>/dev/null | head -1)"
  if [ -n "$bin" ]; then
    libs="$(otool -L "/Applications/Viber.app/Contents/MacOS/$bin" 2>/dev/null)"
    printf '%s' "$libs" | grep -qi 'electron' && toolkit='Electron'
    printf '%s' "$libs" | grep -qi 'libqt\|QtCore' && toolkit='Qt'
  fi
fi

case "$toolkit" in
  Electron)
    ok 'Electron (Chromium).'
    info 'Има шанс: дървото за достъпност може да се включи насила.'
    info 'Малкият брой елементи по-долу може да е само защото спи.'
    ;;
  Qt)
    warn 'Qt.'
    info 'Qt рисува всичко сам и рядко излага съдържание за достъпност.'
    info 'Ако и проверката по-долу покаже малко елементи — пътят е затворен.'
    ;;
  *)
    warn 'Не можах да определя технологията.'
    info 'Съдържанието на папката Frameworks:'
    ls "$fw" 2>/dev/null | head -8 | sed 's/^/       /'
    ;;
esac

section '2. Работи ли Viber'

if ! pgrep -qx 'Viber' 2>/dev/null; then
  bad 'Viber не работи.'
  info 'Пусни Viber, отвори го така, че да виждаш списъка с чатове,'
  info 'и пусни тази проверка отново.'
  exit 0
fi
ok 'Viber работи.'

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
  *-25211*|*'not allowed assistive access'*)
    bad 'Терминалът НЯМА разрешение за достъпност.'
    info 'Дай му го така:'
    info '  System Settings → Privacy & Security → Accessibility'
    info '  → бутон "+" → Applications → Utilities → Terminal'
    info 'После ЗАТВОРИ Терминала изцяло (⌘Q), отвори го пак и пусни наново.'
    ;;
  *)
    bad 'Неочакван резултат.'
    info "$result"
    ;;
esac

printf '\n  Изходът не съдържа съдържание на съобщения и може да се сподели.\n\n'
