#!/usr/bin/env bash
#
# Последен оглед: наистина ли се четат медийните файлове (2035 броя) и
# крие ли data.db нещо в колоните Category/Value, които досега не видяхме.
#
# Това решава дали "робот, който чете папката" изобщо може да извади нещо,
# след като текстът на съобщенията е криптиран.
#
# ПОВЕРИТЕЛНОСТ: не отваря и не показва съдържание на снимки, документи или
# съобщения. За медията проверява само първите байтове (за да разбере истински
# файл ли е или криптиран боклук) и датите. За data.db показва имената на
# категориите и само типа/дължината на стойностите. Номерата се маскират.

set -uo pipefail

hr()      { printf '%s\n' '────────────────────────────────────────────────────────'; }
section() { printf '\n'; hr; printf '  %s\n' "$1"; hr; }
ok()      { printf '  ✅ %s\n' "$1"; }
warn()    { printf '  ⚠️  %s\n' "$1"; }
bad()     { printf '  ❌ %s\n' "$1"; }
info()    { printf '     %s\n' "$1"; }

mask() { sed -E 's/[0-9]{7,}/<номер>/g'; }
# Взима времената на много файлове наведнъж — 2000 отделни извиквания на stat
# бавят проверката с десетки секунди без причина.
mtimes_of() {
  local out
  out="$(printf '%s\n' "$1" | tr '\n' '\0' | xargs -0 stat -f '%m' 2>/dev/null)"
  case "$out" in ''|*[!0-9$'\n']*) out="$(printf '%s\n' "$1" | tr '\n' '\0' | xargs -0 stat -c '%Y' 2>/dev/null)" ;; esac
  printf '%s' "$out"
}

BASE="$HOME/Library/Application Support/ViberPC"

printf 'Оглед на медията и data.db — %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"

# ── 1. Наистина ли се четат медийните файлове ──────────────────────────

section '1. Четат ли се медийните файлове'

# Събираме медийните файлове (не тумбнейли — тях ги пропускаме).
media_list="$(find "$BASE" -type f \
  \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.pdf' \
     -o -iname '*.mp4' -o -iname '*.m4a' -o -iname '*.gif' -o -iname '*.doc*' \) \
  2>/dev/null)"

total="$(printf '%s\n' "$media_list" | grep -c . )"
info "Общо медийни файлове: $total"

if [ "${total:-0}" -eq 0 ]; then
  warn 'Няма медийни файлове за проверка.'
else
  # Разбивка по вид.
  printf '\n     По вид:\n'
  printf '%s\n' "$media_list" | sed -E 's/.*\.([^.]+)$/\1/' \
    | tr '[:upper:]' '[:lower:]' | sort | uniq -c | sort -rn \
    | while read -r c ext; do printf '        %5s  .%s\n' "$c" "$ext"; done

  # Проверка на първите байтове: истински файл или криптиран.
  # НЕ се показва съдържание — само дали разпознатият подпис съвпада.
  valid=0; checked=0; encrypted=0
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    checked=$(( checked + 1 ))
    sig="$(od -An -tx1 -N4 "$f" 2>/dev/null | tr -d ' \n')"
    case "$sig" in
      ffd8ff*)   valid=$(( valid + 1 )) ;;   # JPEG
      89504e47)  valid=$(( valid + 1 )) ;;   # PNG
      25504446)  valid=$(( valid + 1 )) ;;   # PDF (%PDF)
      47494638)  valid=$(( valid + 1 )) ;;   # GIF
      000000*)   valid=$(( valid + 1 )) ;;   # MP4/M4A (ftyp box)
      *)         encrypted=$(( encrypted + 1 )) ;;
    esac
    [ "$checked" -ge 30 ] && break
  done <<EOF
$(printf '%s\n' "$media_list" | head -30)
EOF

  printf '\n     Проверени подписи: %s файла\n' "$checked"
  if [ "$valid" -gt 0 ] && [ "$encrypted" -eq 0 ]; then
    ok "И $valid-те се четат — истински файлове, НЕ криптирани."
    info 'Тоест снимките и документите от клиенти са достъпни.'
  elif [ "$valid" -gt 0 ]; then
    warn "$valid се четат, но $encrypted изглеждат криптирани/непознати."
  else
    bad 'Нито един не се разпозна — вероятно криптирани.'
  fi

  # Обхват на датите — колко назад стига архивът.
  stamps="$(mtimes_of "$(printf '%s\n' "$media_list" | head -2000)" | grep -E '^[0-9]+$' | sort -n)"
  oldest="$(printf '%s\n' "$stamps" | head -1)"
  newest="$(printf '%s\n' "$stamps" | tail -1)"
  if [ -n "$newest" ] && [ "$newest" -gt 0 ] 2>/dev/null; then
    printf '\n     Най-стар файл:  %s\n' "$(date -r "$oldest" '+%Y-%m-%d' 2>/dev/null || date -d "@$oldest" '+%Y-%m-%d' 2>/dev/null)"
    printf '     Най-нов файл:   %s\n' "$(date -r "$newest" '+%Y-%m-%d' 2>/dev/null || date -d "@$newest" '+%Y-%m-%d' 2>/dev/null)"
    info 'Датите позволяват подредба по време, дори без текста.'
  else
    warn 'Не успях да прочета датите на файловете.'
  fi

  # Организирани ли са по контакт (подпапки)?
  printf '\n'
  subdirs="$(printf '%s\n' "$media_list" | sed -E "s#^$BASE/##" | awk -F/ '{print $1"/"$2}' | sort -u | grep -c .)"
  info "Медията е разпределена в ~$subdirs подпапки."
  info '(Ако са малко и общи — значи НЕ са подредени по клиент.)'
fi

# ── 2. Крие ли data.db нещо в Category/Value ───────────────────────────

section '2. Какво има в data.db (колони Category и Value)'

command -v sqlite3 >/dev/null 2>&1 || { warn 'Няма sqlite3.'; exit 0; }

db="$(find "$BASE" -type f -name 'data.db' 2>/dev/null | head -1)"
if [ -z "$db" ]; then
  warn 'data.db не е намерен.'
else
  tmp="$(mktemp "${TMPDIR:-/tmp}/vibermedia.XXXXXX" 2>/dev/null)"
  for ext in '' '-wal' '-shm'; do
    [ -f "${db}${ext}" ] && cp "${db}${ext}" "${tmp}${ext}" 2>/dev/null
  done

  # Кои категории има и колко от всяка — това е контролиран речник, безопасно е.
  printf '\n     Категории (име → брой):\n'
  sqlite3 -readonly "$tmp" \
    "SELECT COALESCE(Category,'(празна)'), COUNT(*) FROM DataTable
     GROUP BY Category ORDER BY COUNT(*) DESC;" 2>/dev/null \
    | while IFS='|' read -r cat cnt; do
        printf '        %6s  %s\n' "$cnt" "$(printf '%s' "$cat" | mask)"
      done

  # За най-голямата категория — какъв е Value: тип и дължина, БЕЗ съдържание.
  printf '\n     Каква е стойността (Value) — тип и дължина, без съдържание:\n'
  sqlite3 -readonly "$tmp" \
    "SELECT typeof(Value), length(CAST(Value AS TEXT)) FROM DataTable
     WHERE Value IS NOT NULL LIMIT 20;" 2>/dev/null \
    | sort | uniq -c \
    | while read -r c rest; do
        printf '        %4s пъти:  %s\n' "$c" "$rest"
      done

  rm -f "$tmp" "${tmp}-wal" "${tmp}-shm" 2>/dev/null
fi

# ── 3. Извод ───────────────────────────────────────────────────────────

section '3. Извод'
info 'Ако медийните файлове се четат — робот, който чете папката, може да'
info 'извади поне архив от снимки/документи от клиенти, подреден по дата,'
info 'дори текстът на съобщенията да остане криптиран.'

printf '\n  Изходът не съдържа съдържание на съобщения или файлове.\n\n'
