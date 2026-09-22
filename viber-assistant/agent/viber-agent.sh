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
# Съвпада с тавана на сървъра (3 разчитания на час). По-често значи роботът
# да качва по около мегабайт само за да чуе "таванът е изчерпан" — хабене на
# ток и трафик без нито един прочетен ред в повече.
VIBER_INTERVAL="${VIBER_INTERVAL:-1200}"

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

# Записва причина за бездействие, но само когато се СМЕНИ. Роботът върви
# денонощно: един и същи ред, повтарян хиляди пъти, е същото като мълчание.
# А пълното мълчание е още по-лошо — точно то направи първата диагностика
# невъзможна: нито грешка, нито успех, и няма как да се разбере дали Viber е
# затворен, или нещо се е счупило.
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
  osascript -l JavaScript 2>&1 <<'JXA'
ObjC.import('CoreGraphics');
function run() {
  // 0 = ВСИЧКИ прозорци, не само тези на текущото работно пространство.
  //
  // Тук имаше дефект, открит чак на живо: с опция 1 (само видимите) целият
  // списък се ограничава до текущия Space. Пуснат на цял екран, Viber е на
  // СВОЙ Space — щом собственикът работи другаде, прозорецът му не се води
  // видим и роботът не го намираше. Тоест виждаше Viber само докато човекът
  // гледа Viber, което е безполезно.
  //
  // 16 = без елементите на работния плот. Числата са изписани нарочно:
  // имената на тези константи не се намират надеждно през ObjC моста.
  var list = $.CGWindowListCopyWindowInfo(0 | 16, 0);
  if (!list) return 'ГРЕШКА: няма списък с прозорци';
  // castRefToObject е задължителен: CGWindowListCopyWindowInfo връща
  // CF-указател, а deepUnwrap сам не го разпознава и дава undefined.
  // Проверено на живата машина — без него целият списък е невидим.
  var windows = ObjC.deepUnwrap(ObjC.castRefToObject(list));
  if (!windows || windows.length === undefined) {
    return 'ГРЕШКА: списъкът не се разчита';
  }

  var best = '';
  for (var i = 0; i < windows.length; i++) {
    var w = windows[i];
    // Програмата се води "Rakuten Viber", не "Viber" — точното сравнение
    // никога не съвпадаше. Процесът обаче е "Viber", затова pgrep го
    // намираше и изглеждаше, че всичко е наред. Два различни низа за едно
    // и също нещо; затова тук се търси съвпадение по част от името.
    var owner = w.kCGWindowOwnerName;
    if (!owner || owner.indexOf('Viber') === -1) continue;
    if (w.kCGWindowLayer !== 0) continue;          // панели и подсказки
    var b = w.kCGWindowBounds;
    if (!b || b.Width < 400 || b.Height < 300) continue;  // не е главният
    // Видимият прозорец е за предпочитане: свитият в Dock може да върне
    // остаряло съдържание. Но ако друг няма, по-добре остарял от никакъв.
    if (w.kCGWindowIsOnscreen) return String(w.kCGWindowNumber);
    if (!best) best = String(w.kCGWindowNumber);
  }
  return best;
}
JXA
}

one_round() {
  if ! pgrep -qx 'Viber' 2>/dev/null; then
    note 'Viber е затворен — чакам да го отвориш'
    return 0
  fi

  local winid
  winid="$(viber_window_id)"
  case "$winid" in
    *ГРЕШКА*|*error*|*Error*)
      # Скриването на тези грешки (2>/dev/null) ме остави сляп при първата
      # диагностика: счупен JXA изглеждаше точно като затворен прозорец.
      note "търсенето на прозореца гръмна: $(printf '%s' "$winid" | head -c 160)"
      return 0 ;;
  esac
  winid="$(printf '%s' "$winid" | tr -d '[:space:]')"
  case "$winid" in
    [0-9]*) ;;
    *)
      # Търсенето на прозорци иска същото разрешение като снимането: без
      # Screen Recording имената на чуждите прозорци се връщат празни и
      # Viber просто не се намира. Затова причината се изписва и двете.
      note 'прозорецът на Viber не се намира — или е свит в Dock, или липсва разрешението за запис на екрана за ViberRobot'
      return 0 ;;
  esac

  local shot="$STATE_DIR/shot.png"
  rm -f "$shot"
  # -x: без звук и без трепване — човекът не бива да усеща робота.
  # -l: точно този прозорец, а не мястото му на екрана, за да може
  #     собственикът да работи върху Viber, без роботът да снима него.
  # -o: без сянката около прозореца.
  #
  # Грешката на screencapture НЕ се изхвърля. Изхвърлена беше в първата
  # версия и струва цял ден: дневникът казваше само "снимката излиза
  # празна", а това е следствие, не причина. Липсващо разрешение, затворен
  # прозорец и счупена команда изглеждаха еднакво. Сега се пише каквото
  # macOS наистина е казал.
  local snaperr
  snaperr="$(screencapture -x -o -l "$winid" "$shot" 2>&1)"
  snaperr="$(printf '%s' "$snaperr" | tr '\n' ' ' | head -c 200)"

  if [ ! -s "$shot" ]; then
    if [ -n "$snaperr" ]; then
      note "снимката не се получи — macOS каза: $snaperr"
    else
      note 'снимката излиза празна и macOS не каза нищо — почти сигурно липсва разрешението за запис на екрана (Screen Recording) за ViberRobot'
    fi
    return 0
  fi

  # Снимката стана — каквото и да е спирало преди, вече не спира.
  note ''

  # Намаляваме преди всичко останало. Retina дава над 2300 точки ширина, а
  # моделът и без това свежда всичко до 1568 — тоест плащаме за размер, който
  # се изхвърля. Освен това по-малката снимка прави хеша по-малко чувствителен
  # към дребни промени (мигаща точка "онлайн"), а всяка промяна струва пари.
  # sips е вграден в macOS, не се инсталира нищо.
  sips -Z 1100 "$shot" --out "$shot" >/dev/null 2>&1 || true

  # Първата и най-евтина спирачка: непроменен екран = нищо не се праща и
  # нищо не се плаща. Повечето цикли през деня свършват точно тук.
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

# Причината се забравя при пускане. Тя оцелява в файл между рестартите, а
# дедупликацията пише само при СМЯНА — тоест рестарт със същия проблем не
# записваше нищо и мълчанието изглеждаше като успех. Точно това обърка
# диагностиката на живо: човекът рестартира след даване на разрешение и
# видя празен дневник вместо отговор.
rm -f "$REASON_FILE"

log "роботът тръгна (на всеки ${VIBER_INTERVAL}s)"

while true; do
  one_round
  sleep "$VIBER_INTERVAL"
done
