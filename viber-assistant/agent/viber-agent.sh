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

# Връща номера на прозореца на Viber, или празно, ако го няма.
#
# Защо номер на прозорец, а не правоъгълник от екрана: `screencapture -R`
# снима КАКВОТО Е НА ТОВА МЯСТО, а не конкретния прозорец. Работи ли човекът
# нещо върху Viber, роботът би изпратил чуждия прозорец — и грешно, и
# недопустимо за поверителността. `screencapture -l` взема съдържанието на
# самия прозорец, дори когато е отзад.
viber_window_id() {
  osascript -l JavaScript 2>/dev/null <<'JXA'
ObjC.import('CoreGraphics');
function run() {
  // 1 = само видими прозорци, 16 = без елементите на работния плот.
  // Числата са изписани нарочно: имената на тези константи не се
  // намират надеждно през ObjC моста.
  var windows = ObjC.deepUnwrap($.CGWindowListCopyWindowInfo(1 | 16, 0));
  if (!windows) return '';
  for (var i = 0; i < windows.length; i++) {
    var w = windows[i];
    if (w.kCGWindowOwnerName !== 'Viber') continue;
    if (w.kCGWindowLayer !== 0) continue;          // панели и подсказки
    var b = w.kCGWindowBounds;
    if (!b || b.Width < 400 || b.Height < 300) continue;  // не е главният
    return String(w.kCGWindowNumber);
  }
  return '';
}
JXA
}

one_round() {
  if ! pgrep -qx 'Viber' 2>/dev/null; then
    note 'Viber е затворен — чакам да го отвориш'
    return 0
  fi

  local winid
  winid="$(viber_window_id | tr -d '[:space:]')"
  case "$winid" in
    [0-9]*) ;;
    *)
      note 'Viber работи, но прозорецът му не се вижда (свит в Dock?)'
      return 0 ;;
  esac

  local shot="$STATE_DIR/shot.png"
  rm -f "$shot"
  # -x: без звук и без трепване — човекът не бива да усеща робота.
  # -l: точно този прозорец, а не мястото му на екрана, за да може
  #     собственикът да работи върху Viber, без роботът да снима него.
  # -o: без сянката около прозореца.
  screencapture -x -o -l "$winid" "$shot" 2>/dev/null

  if [ ! -s "$shot" ]; then
    note 'снимката излиза празна — няма разрешение за запис на екрана (Screen Recording) за ViberRobot'
    return 0
  fi

  # Най-важната спирачка за сметката: непроменен екран = нищо не се праща.
  # Повечето цикли през деня свършват точно тук и не струват нищо.
  # Снимката стана — каквото и да е спирало преди, вече не спира.
  note ''

  # Намаляваме преди всичко останало. Retina дава над 2300 точки ширина, а
  # моделът и без това свежда всичко до 1568 — тоест плащаме за размер, който
  # се изхвърля. Освен това по-малката снимка прави хеша по-малко чувствителен
  # към дребни промени (мигаща точка "онлайн"), а всяка промяна струва пари.
  # sips е вграден в macOS, не се инсталира нищо.
  sips -Z 1100 "$shot" --out "$shot" >/dev/null 2>&1 || true

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

  local body
  body="$(printf '%s' "$response" | sed '$d')"

  if [ "$code" != "200" ]; then
    log "сървърът отказа ($code): $(printf '%s' "$body" | head -c 200)"
    return 0
  fi

  # 200 не значи "прочетено". Сървърът връща и "skipped", когато е отказал
  # разход заради таван. Такава снимка НЕ е обработена, затова хешът ѝ не се
  # запомня — инак щеше да се смята за изпратена и да не се опита повече.
  case "$body" in
    *'"skipped"'*)
      note "сървърът спря разхода: $(printf '%s' "$body" | head -c 120)"
      return 0 ;;
  esac

  # Хешът се запомня само при истински успех. Инак една мрежова грешка би
  # скрила промяната завинаги — следващият цикъл би я сметнал за изпратена.
  printf '%s' "$hash" > "$LAST_HASH_FILE"
  note ''
  log "изпратено: $body"
}

log "роботът тръгна (на всеки ${VIBER_INTERVAL}s)"

while true; do
  one_round
  sleep "$VIBER_INTERVAL"
done
