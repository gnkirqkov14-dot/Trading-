#!/usr/bin/env bash
#
# Как да се намери прозорецът на Viber — проверка на всички налични начини.
#
# Първият опит (JXA + ObjC.deepUnwrap) върна "undefined" на живата машина:
# CGWindowListCopyWindowInfo дава CF-указател, който JXA не разпознава сам.
# Вместо да се гадае вариант по вариант, тук се пробват всички наведнъж и
# се отчита кой работи.
#
# ПОВЕРИТЕЛНОСТ: извеждат се само ИМЕНА НА ПРОГРАМИ и размери на прозорци —
# нищо от съдържанието им. Изходът е безопасен за споделяне.

set -uo pipefail

hr()      { printf '%s\n' '────────────────────────────────────────────────────────'; }
section() { printf '\n'; hr; printf '  %s\n' "$1"; hr; }
ok()      { printf '  ✅ %s\n' "$1"; }
bad()     { printf '  ❌ %s\n' "$1"; }
info()    { printf '     %s\n' "$1"; }

printf 'Търсене на прозореца на Viber — %s\n' "$(date '+%H:%M:%S')"

section '1. Работи ли Viber'
if pgrep -qx 'Viber' 2>/dev/null; then
  ok 'Viber работи.'
else
  bad 'Viber НЕ работи — пусни го и опитай пак.'
fi

section '2. Вариантите през JavaScript (JXA)'

osascript -l JavaScript 2>&1 <<'JXA'
ObjC.import('CoreGraphics');

function tryIt(label, fn) {
  try {
    var v = fn();
    return '  ' + label + ': ' + v;
  } catch (e) {
    return '  ' + label + ': ГРЪМНА — ' + e;
  }
}

function run() {
  var out = [];
  var raw = $.CGWindowListCopyWindowInfo(0 | 16, 0);
  out.push(raw ? '  списъкът се получава' : '  списъкът НЕ се получава');

  out.push(tryIt('A  deepUnwrap(raw)', function () {
    var a = ObjC.deepUnwrap(raw);
    return (a && a.length !== undefined) ? a.length + ' прозореца ✅' : 'undefined ❌';
  }));

  out.push(tryIt('B  deepUnwrap(castRefToObject)', function () {
    var b = ObjC.deepUnwrap(ObjC.castRefToObject(raw));
    return (b && b.length !== undefined) ? b.length + ' прозореца ✅' : 'undefined ❌';
  }));

  out.push(tryIt('C  castRefToObject().count', function () {
    return ObjC.castRefToObject(raw).count + ' прозореца ✅';
  }));

  out.push(tryIt('D  имената през B', function () {
    var d = ObjC.deepUnwrap(ObjC.castRefToObject(raw));
    var names = [];
    for (var i = 0; i < d.length && names.length < 10; i++) {
      if (d[i].kCGWindowOwnerName) names.push(d[i].kCGWindowOwnerName);
    }
    return names.length ? names.join(', ') : 'няма имена ❌';
  }));

  out.push(tryIt('E  Viber през B', function () {
    var e = ObjC.deepUnwrap(ObjC.castRefToObject(raw));
    for (var i = 0; i < e.length; i++) {
      var w = e[i];
      if (w.kCGWindowOwnerName !== 'Viber') continue;
      var b = w.kCGWindowBounds;
      return 'номер ' + w.kCGWindowNumber + ', слой ' + w.kCGWindowLayer +
             ', ' + (b ? b.Width + 'x' + b.Height : '?') +
             ', видим: ' + w.kCGWindowIsOnscreen + ' ✅';
    }
    return 'Viber не е в списъка ❌';
  }));

  return out.join('\n');
}
JXA

section '3. Резервни пътища, ако JavaScript не става'

if command -v swift >/dev/null 2>&1; then
  ok 'swift е наличен — може да се компилира мъничка помощна програма.'
else
  info 'swift липсва (инсталира се с: xcode-select --install)'
fi

if /usr/bin/python3 -c 'import Quartz' >/dev/null 2>&1; then
  ok 'python3 има Quartz — това също върши работа.'
else
  info 'python3 няма Quartz.'
fi

section '4. Какво чака'
info 'Прати ми целия изход. От него се вижда кой вариант работи и'
info 'роботът се оправя веднага, без повече гадаене.'
printf '\n'
