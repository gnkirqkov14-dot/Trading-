#!/usr/bin/env bash
#
# Оглед на цялата папка на Viber: какво изобщо има вътре и какво от него
# се чете. Базата със съобщенията е криптирана, но останалото досега не е
# разглеждано — може да съдържа нещо полезно (например кога за последно е
# имало активност по всеки чат).
#
# ПОВЕРИТЕЛНОСТ: не извежда съдържание на съобщения. Стойностите се показват
# само ако са къси и очевидно технически (числа, true/false, кратки думи).
# Всичко останало се показва като тип и дължина. Дългите числа се маскират.

set -uo pipefail

hr()      { printf '%s\n' '────────────────────────────────────────────────────────'; }
section() { printf '\n'; hr; printf '  %s\n' "$1"; hr; }
ok()      { printf '  ✅ %s\n' "$1"; }
warn()    { printf '  ⚠️  %s\n' "$1"; }
info()    { printf '     %s\n' "$1"; }

mask() { sed -E 's/[0-9]{7,}/<номер>/g'; }

# macOS ползва BSD stat; резервният вариант е за проверка на скрипта другаде.
fsize() { stat -f '%z' "$1" 2>/dev/null || stat -c '%s' "$1" 2>/dev/null || echo 0; }

# Тилдата се пише през променлива: инак bash я разширява обратно до $HOME
# и потребителското име остава в изхода.
short_path() { local t='~'; printf '%s' "${1/#$HOME/$t}" | mask; }

BASE="$HOME/Library/Application Support/ViberPC"
CACHE="$HOME/Library/Caches/Viber Media S.à r.l/ViberPC"

printf 'Оглед на папката на Viber — %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"

section '1. Какво има в папката'

for dir in "$BASE" "$CACHE"; do
  [ -d "$dir" ] || continue
  printf '\n  ▸ %s\n\n' "$(short_path "$dir")"
  # Най-големите 25 файла — там е същественото.
  find "$dir" -type f 2>/dev/null \
    | while read -r f; do printf '%s %s\n' "$(fsize "$f")" "$f"; done \
    | sort -rn | head -25 \
    | while read -r size path; do
        mb=$(( size / 1024 / 1024 ))
        rel="${path#$dir/}"
        if [ "$mb" -ge 1 ]; then
          printf '      %6s MB  %s\n' "$mb" "$(printf '%s' "$rel" | mask)"
        else
          printf '      %6s KB  %s\n' "$(( size / 1024 ))" "$(printf '%s' "$rel" | mask)"
        fi
      done
done

section '2. Папки с прикачени файлове'

# Снимките и файловете, които клиентите пращат, често НЕ са криптирани.
for d in "$BASE"/*/ "$CACHE"/*/; do
  [ -d "$d" ] || continue
  n="$(find "$d" -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' \
        -o -iname '*.pdf' -o -iname '*.mp4' -o -iname '*.m4a' \) 2>/dev/null | wc -l | tr -d ' ')"
  if [ "${n:-0}" -gt 0 ]; then
    ok "$(short_path "$d") — $n медийни файла"
  fi
done
printf '\n'
info 'Ако тук има много файлове, поне снимките и документите от клиенти'
info 'са достъпни, дори текстът да не е.'

section '3. Какво пише в четимите бази'

command -v sqlite3 >/dev/null 2>&1 || { warn 'Няма sqlite3.'; exit 0; }

SQLITE_MAGIC='SQLite format 3'

find "$BASE" "$CACHE" -type f -name '*.db' 2>/dev/null | while read -r db; do
  header="$(head -c 15 "$db" 2>/dev/null | LC_ALL=C tr -d '\0')"
  [ "$header" = "$SQLITE_MAGIC" ] || continue

  printf '\n  ▸ %s\n' "$(short_path "$db")"

  tmp="$(mktemp "${TMPDIR:-/tmp}/viberinspect.XXXXXX" 2>/dev/null)" || continue
  for ext in '' '-wal' '-shm'; do
    [ -f "${db}${ext}" ] && cp "${db}${ext}" "${tmp}${ext}" 2>/dev/null
  done

  sqlite3 -readonly "$tmp" \
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" \
    2>/dev/null | while read -r t; do
      [ -n "$t" ] || continue
      cols="$(sqlite3 -readonly "$tmp" "PRAGMA table_info(\"$t\");" 2>/dev/null \
               | cut -d'|' -f2 | paste -sd',' - | sed 's/,/, /g')"
      cnt="$(sqlite3 -readonly "$tmp" "SELECT COUNT(*) FROM \"$t\";" 2>/dev/null)"
      printf '\n      Таблица %s (%s реда)\n' "$t" "$cnt"
      printf '        колони: %s\n' "$cols"

      first="$(printf '%s' "$cols" | cut -d, -f1)"
      [ -n "$first" ] || continue

      # Само имената на ключовете плюс тип и дължина на стойността.
      # Самите стойности — единствено ако са къси и очевидно технически.
      printf '        какво има вътре (първите 25):\n'
      sqlite3 -readonly "$tmp" "
        SELECT
          substr(CAST(\"$first\" AS TEXT),1,44),
          typeof(\"$first\"),
          length(CAST(\"$first\" AS TEXT))
        FROM \"$t\" LIMIT 25;" 2>/dev/null \
        | while IFS='|' read -r val typ len; do
            case "$val" in
              ''|*[!A-Za-z0-9_.:/-]*) printf '          [%s, %s знака]\n' "$typ" "$len" ;;
              *) printf '          %s\n' "$(printf '%s' "$val" | mask)" ;;
            esac
          done
    done

  rm -f "$tmp" "${tmp}-wal" "${tmp}-shm" 2>/dev/null
done

printf '\n  Изходът не съдържа съдържание на съобщения и може да се сподели.\n\n'
