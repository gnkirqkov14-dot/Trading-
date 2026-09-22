#!/usr/bin/env bash
#
# Диагностика на Viber Desktop за macOS.
#
# Отговаря на един въпрос: може ли този Mac да бъде източник на данни
# за Viber асистента, или базата е криптирана и трябва друг подход.
#
# ПОВЕРИТЕЛНОСТ: скриптът НЕ чете и НЕ извежда съдържание на съобщения,
# имена на контакти или телефонни номера. Извежда само пътища, версии,
# имена на таблици/колони и броя редове. Изходът е безопасен за споделяне.
#
# Употреба:  bash diagnose-macos.sh
#            bash diagnose-macos.sh > ~/viber-diagnostika.txt

set -uo pipefail

SQLITE_MAGIC='SQLite format 3'
found_any_db=0
found_readable_db=0
schema_ok=0
permission_denied=0

# Скрива потребителското име от изхода, за да може да се споделя.
short_path() { printf '%s' "${1/#$HOME/\~}"; }

hr()      { printf '%s\n' '────────────────────────────────────────────────────────'; }
section() { printf '\n'; hr; printf '  %s\n' "$1"; hr; }
ok()      { printf '  ✅ %s\n' "$1"; }
warn()    { printf '  ⚠️  %s\n' "$1"; }
bad()     { printf '  ❌ %s\n' "$1"; }
info()    { printf '     %s\n' "$1"; }

printf 'Диагностика на Viber Desktop — %s\n' "$(date '+%Y-%m-%d %H:%M:%S')"
printf 'macOS %s (%s)\n' "$(sw_vers -productVersion 2>/dev/null || echo '?')" "$(uname -m)"

# ── 1. Инсталирано ли е приложението ───────────────────────────────────

section '1. Приложението Viber'

viber_app=''
for candidate in "/Applications/Viber.app" "$HOME/Applications/Viber.app"; do
  [ -d "$candidate" ] && { viber_app="$candidate"; break; }
done

if [ -z "$viber_app" ]; then
  # Резервно търсене, ако е на нестандартно място.
  viber_app="$(mdfind -onlyin /Applications -onlyin "$HOME/Applications" \
                 'kMDItemFSName == "Viber.app"' 2>/dev/null | head -1)"
fi

if [ -n "$viber_app" ] && [ -d "$viber_app" ]; then
  ok "Намерено: $viber_app"
  version="$(defaults read "$viber_app/Contents/Info" CFBundleShortVersionString 2>/dev/null \
             || echo '?')"
  bundle_id="$(defaults read "$viber_app/Contents/Info" CFBundleIdentifier 2>/dev/null \
               || echo '?')"
  info "Версия:    $version"
  info "Bundle ID: $bundle_id"

  # Пясъчник? Това решава КЪДЕ е базата.
  if codesign -d --entitlements - "$viber_app" 2>/dev/null \
       | grep -q 'com\.apple\.security\.app-sandbox'; then
    warn 'Приложението е В ПЯСЪЧНИК (най-вероятно от Mac App Store).'
    info 'Базата тогава е в ~/Library/Containers/, а не в Application Support.'
    info 'Агентът ще има нужда от Full Disk Access, за да я чете.'
  else
    ok 'Приложението НЕ е в пясъчник (инсталирано директно от viber.com).'
    info 'Базата е на стандартното място и се чете без допълнителни права.'
  fi

  if pgrep -qx 'Viber' 2>/dev/null; then
    ok 'Viber в момента работи.'
  else
    warn 'Viber в момента НЕ работи — пусни го поне веднъж преди проверката.'
  fi
else
  bad 'Viber.app не е намерен. Инсталирай Viber Desktop и го активирай с номера си.'
  info 'Без активиран десктоп клиент няма локална база и няма откъде да четем.'
fi

# ── 2. Къде е базата ───────────────────────────────────────────────────

section '2. Локация на базата данни'

candidate_dirs=(
  "$HOME/Library/Application Support/ViberPC"
  "$HOME/Library/Containers/com.viber.osx/Data/Library/Application Support/ViberPC"
  "$HOME/Library/Containers/com.viber.mac/Data/Library/Application Support/ViberPC"
)

# Плюс всичко "viber"-подобно в ~/Library, в случай че пътят се е сменил.
while IFS= read -r extra; do
  [ -n "$extra" ] && candidate_dirs+=("$extra")
done < <(find "$HOME/Library" -maxdepth 6 -type d -iname '*viberpc*' 2>/dev/null)

# Премахване на дубликати.
unique_dirs=()
for d in "${candidate_dirs[@]}"; do
  skip=0
  for seen in ${unique_dirs[@]+"${unique_dirs[@]}"}; do
    [ "$d" = "$seen" ] && { skip=1; break; }
  done
  [ $skip -eq 0 ] && unique_dirs+=("$d")
done

db_files=()
for dir in ${unique_dirs[@]+"${unique_dirs[@]}"}; do
  if [ ! -d "$dir" ]; then
    continue
  fi

  if [ ! -r "$dir" ]; then
    bad "Няма право за четене: $dir"
    permission_denied=1
    continue
  fi

  ok "Директория: $dir"
  while IFS= read -r db; do
    db_files+=("$db")
  done < <(find "$dir" -maxdepth 3 -type f -name '*.db' 2>/dev/null)
done

if [ ${#db_files[@]} -eq 0 ]; then
  bad 'Не е намерена нито една .db база.'
  info 'Или Viber Desktop не е активиран с телефонния номер, или пътят е нов.'
  info 'Ако горе пише "в пясъчник", пробвай скрипта след даване на Full Disk Access'
  info 'на Терминала: System Settings → Privacy & Security → Full Disk Access.'
fi

# ── 3. Криптирана ли е — най-важната проверка ──────────────────────────

section '3. Криптирана ли е базата (решаващият въпрос)'

for db in ${db_files[@]+"${db_files[@]}"}; do
  found_any_db=1
  size="$(stat -f '%z' "$db" 2>/dev/null)"
  case "$size" in ''|*[!0-9]*) size=0 ;; esac
  size_mb=$(( size / 1024 / 1024 ))
  printf '\n  Файл: %s\n' "$(short_path "$db")"
  info "Размер: ${size_mb} MB (${size} байта)"

  if [ ! -r "$db" ]; then
    bad 'Няма право за четене на файла.'
    permission_denied=1
    continue
  fi

  header="$(head -c 15 "$db" 2>/dev/null | LC_ALL=C tr -d '\0')"
  if [ "$header" = "$SQLITE_MAGIC" ]; then
    ok 'ОБИКНОВЕН SQLite — чете се директно. Това е добрата новина.'
    found_readable_db=1
  else
    bad 'НЕ е обикновен SQLite — най-вероятно криптирана (SQLCipher).'
    info 'Ако всички бази излязат такива, вариант A отпада и минаваме на'
    info 'Viber Business акаунт (вариант C).'
  fi
done

# ── 4. Схема — какво точно има вътре ───────────────────────────────────

section '4. Схема на четимите бази'

if ! command -v sqlite3 >/dev/null 2>&1; then
  bad 'Няма команда sqlite3 — не мога да покажа схемата.'
  info 'На macOS тя е вградена в /usr/bin/sqlite3. Ако липсва, инсталирай'
  info 'Xcode Command Line Tools:  xcode-select --install'
elif [ $found_readable_db -eq 0 ]; then
  warn 'Няма четима база — няма схема за показване.'
else
  for db in ${db_files[@]+"${db_files[@]}"}; do
    [ -r "$db" ] || continue
    header="$(head -c 15 "$db" 2>/dev/null | LC_ALL=C tr -d '\0')"
    [ "$header" = "$SQLITE_MAGIC" ] || continue

    printf '\n  ▸ %s\n\n' "$(short_path "$db")"

    # Работим върху копие: базата е в WAL режим и Viber я държи отворена.
    tmp="$(mktemp "${TMPDIR:-/tmp}/viberdiag.XXXXXX" 2>/dev/null)"
    if [ -z "$tmp" ]; then
      warn 'Не успях да създам временен файл — пропускам тази база.'
      continue
    fi
    for ext in '' '-wal' '-shm'; do
      [ -f "${db}${ext}" ] && cp "${db}${ext}" "${tmp}${ext}" 2>/dev/null
    done

    tables="$(sqlite3 -readonly "$tmp" \
                "SELECT name FROM sqlite_master WHERE type='table'
                 AND name NOT LIKE 'sqlite_%' ORDER BY name;" 2>/dev/null)"

    if [ -z "$tables" ]; then
      warn 'Не успях да прочета схемата (заключена или повредена база).'
    else
      while IFS= read -r t; do
        [ -n "$t" ] || continue
        count="$(sqlite3 -readonly "$tmp" "SELECT COUNT(*) FROM \"$t\";" 2>/dev/null || echo '?')"
        printf '      %-34s %8s реда\n' "$t" "$count"

        # Колоните само на таблиците, които ни трябват за асистента.
        case "$(printf '%s' "$t" | tr '[:upper:]' '[:lower:]')" in
          *message*|*conversation*|*contact*|*chat*|*participant*)
            cols="$(sqlite3 -readonly "$tmp" "PRAGMA table_info(\"$t\");" 2>/dev/null \
                     | cut -d'|' -f2 | paste -sd',' - | sed 's/,/, /g')"
            [ -n "$cols" ] && printf '        └─ %s\n' "$cols"
            ;;
        esac
      done <<< "$tables"
      schema_ok=1
    fi

    rm -f "$tmp" "${tmp}-wal" "${tmp}-shm" 2>/dev/null
  done
fi

# ── 5. Заключение ──────────────────────────────────────────────────────

section '5. Заключение'

if [ $found_readable_db -eq 1 ]; then
  if [ $schema_ok -eq 1 ]; then
    ok 'ВАРИАНТ A Е ВЪЗМОЖЕН — базата се чете и схемата е видима.'
    info 'Следваща стъпка: агент на този Mac, който следи базата и подава към Supabase.'
  else
    warn 'Базата е обикновен SQLite, но схемата не се прочете.'
    info 'Форматът е обнадеждаващ. Пусни скрипта пак при затворен Viber.'
  fi
elif [ $found_any_db -eq 1 ]; then
  bad 'ВАРИАНТ A ОТПАДА — базите съществуват, но са криптирани.'
  info 'Следваща стъпка: Viber Business акаунт (вариант C).'
elif [ $permission_denied -eq 1 ]; then
  warn 'НЕЯСНО — липсват права за четене.'
  info 'Дай Full Disk Access на Терминала и пусни скрипта пак:'
  info 'System Settings → Privacy & Security → Full Disk Access → + → Terminal.'
else
  warn 'НЕЯСНО — не е намерена база.'
  info 'Инсталирай и АКТИВИРАЙ Viber Desktop с телефонния си номер,'
  info 'изчакай да се синхронизират чатовете и пусни скрипта отново.'
fi

printf '\n  Изходът по-горе не съдържа съдържание на съобщения и може да се сподели.\n\n'
