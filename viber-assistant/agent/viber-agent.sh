#!/usr/bin/env bash
#
# Роботът, който стои на Mac-а и гледа Viber вместо човека.
#
# На всеки цикъл: снима прозореца на Viber, сравнява го с предишната снимка и
# ако нещо се е променило — праща я на сървъра, който я разчита и записва кой
# чака отговор. Човекът не пипа нищо.
#
# Нарочно е на чист bash: ползва само команди, вградени в macOS
# (screencapture, osascript, shasum, base64, curl). Нула инсталации — нито
# Python, нито Node. На машината на собственика нищо не се слага.
#
# Ключът на Anthropic НЕ е тук. Роботът праща снимката на сървъра, а сървърът
# говори с модела — така ключът не се озовава на лаптоп.
#
# Настройки: ~/.viber-agent.conf (виж install.sh)

set -uo pipefail

CONFIG="${VIBER_AGENT_CONFIG:-$HOME/.viber-agent.conf}"
# shellcheck source=/dev/null
[ -f "$CONFIG" ] && . "$CONFIG"

VIBER_INGEST_URL="${VIBER_INGEST_URL:-}"
VIBER_AGENT_TOKEN="${VIBER_AGENT_TOKEN:-}"
# Две минути е компромис: достатъчно често, за да не изпуснеш клиент, и
# достатъчно рядко, за да не се трупа сметка. Сървърът и без това отказва
# по-често от веднъж на 45 секунди.
VIBER_INTERVAL="${VIBER_INTERVAL:-120}"

STATE_DIR="$HOME/.viber-agent"
LAST_HASH_FILE="$STATE_DIR/last-hash"
REASON_FILE="$STATE_DIR/last-reason"
LOG="$STATE_DIR/agent.log"

mkdir -p "$STATE_DIR"

log() {
  printf '%s  %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"
  # Дневникът се реже сам: роботът върви с месеци, а никой не го гледа,
  # докато нещо не се счупи.
  if [ "$(wc -l < "$LOG" 2>/dev/null || echo 0)" -gt 5000 ]; then
    tail -n 2000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
  fi
}

# Записва причина за бездействие, но само когато се СМЕНИ. Роботът върви на
# всеки две минути, денонощно: един и същи ред, повтарян хиляди пъти, е същото
# като мълчание. А пълното мълчание е още по-лошо — точно то направи първата
# диагностика невъзможна: нито грешка, нито успех, и няма как да се разбере
# дали Viber е затворен, или нещо се е счупило.
note() {
  local previous
  previous="$(cat "$REASON_FILE" 2>/dev/null || true)"
  if [ "$previous" != "$1" ]; then
    printf '%s' "$1" > "$REASON_FILE"
    [ -n "$1" ] && log "$1"
  fi
}

if [ -z "$VIBER_INGEST_URL" ] || [ -z "$VIBER_AGENT_TOKEN" ]; then
  log "ГРЕШКА: липсва VIBER_INGEST_URL или VIBER_AGENT_TOKEN в $CONFIG"
  exit 1
fi

# Връща "x,y,w,h" на прозореца на Viber, или празно, ако го няма.
viber_window_bounds() {
  osascript 2>/dev/null <<'APPLESCRIPT'
tell application "System Events"
	if not (exists process "Viber") then return ""
	tell process "Viber"
		if (count of windows) is 0 then return ""
		set p to position of window 1
		set s to size of window 1
		return (item 1 of p as text) & "," & (item 2 of p as text) & "," & ¬
		       (item 1 of s as text) & "," & (item 2 of s as text)
	end tell
end tell
APPLESCRIPT
}

one_round() {
  if ! pgrep -qx 'Viber' 2>/dev/null; then
    note 'Viber е затворен — чакам да го отвориш'
    return 0
  fi

  local bounds
  bounds="$(viber_window_bounds)"
  case "$bounds" in
    [0-9-]*,*,*,*) ;;
    *'not allowed'*|*-25211*)
      note 'няма разрешение за достъпност (Accessibility) за ViberRobot'
      return 0 ;;
    *)
      note 'Viber работи, но няма отворен прозорец'
      return 0 ;;
  esac

  local shot="$STATE_DIR/shot.png"
  rm -f "$shot"
  # -x: без звук и без трепване на екрана. Човекът не бива да усеща робота.
  screencapture -x -R "$bounds" "$shot" 2>/dev/null

  if [ ! -s "$shot" ]; then
    note 'снимката излиза празна — няма разрешение за запис на екрана (Screen Recording) за ViberRobot'
    return 0
  fi

  # Най-важната спирачка за сметката: непроменен екран = нищо не се праща.
  # Повечето цикли през деня свършват точно тук и не струват нищо.
  # Снимката стана — каквото и да е спирало преди, вече не спира.
  note ''

  local hash previous
  hash="$(shasum -a 256 "$shot" | cut -d' ' -f1)"
  previous="$(cat "$LAST_HASH_FILE" 2>/dev/null || true)"
  if [ "$hash" = "$previous" ]; then
    return 0
  fi

  # Снимката е над мегабайт, а base64 я раздува с още една трета. През
  # аргумент на командния ред не минава (ARG_MAX), затова тялото се сглобява
  # във файл и curl го чете оттам.
  local payload="$STATE_DIR/payload.json"
  {
    printf '{"token":"%s","media_type":"image/png","image":"' "$VIBER_AGENT_TOKEN"
    base64 -i "$shot" | tr -d '\n'
    printf '"}'
  } > "$payload"

  local response code
  response="$(curl -sS --max-time 120 -w '\n%{http_code}' \
    -X POST -H 'Content-Type: application/json' \
    --data-binary @"$payload" "$VIBER_INGEST_URL" 2>&1)"
  code="$(printf '%s' "$response" | tail -1)"

  rm -f "$payload"

  if [ "$code" = "200" ]; then
    # Хешът се запомня само при успех. Инак една мрежова грешка би скрила
    # промяната завинаги — следващият цикъл би я сметнал за вече изпратена.
    printf '%s' "$hash" > "$LAST_HASH_FILE"
    log "изпратено: $(printf '%s' "$response" | sed '$d')"
  else
    log "сървърът отказа ($code): $(printf '%s' "$response" | sed '$d' | head -c 200)"
  fi
}

log "роботът тръгна (на всеки ${VIBER_INTERVAL}s)"

while true; do
  one_round
  sleep "$VIBER_INTERVAL"
done
