"""Регистър на разрешенията за строеж на Община Пловдив -> Excel (CSV).

Пуска се от компютър в България (сайтът isut.plovdiv.bg не отговаря на заявки от чужбина):

    python plovdiv_register.py

Нужен е само Python 3 (https://www.python.org/downloads/) – без допълнителни пакети.
Скриптът:
  1. отваря регистъра на разрешенията за строеж и регистъра на въведените в експлоатация строежи;
  2. взима таблицата от адреса, от който страницата я зарежда, по години и страници;
  3. записва:
       plovdiv_razreshenia.csv      – разрешенията за строеж (отваря се с Excel)
       plovdiv_vavedeni.csv         – въведените в експлоатация (за да отпаднат завършените)
       plovdiv_stranici/            – копие на първите страници (ако нещо не се разчете,
                                      изпратете ни тази папка, за да донастроим скрипта)
Чете само публични страници, с пауза между заявките. Не изпраща нищо никъде.
"""
from __future__ import annotations

import csv
import html
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

BASE = "isut.plovdiv.bg:998/registers.php"
REGISTERS = {
    "plovdiv_razreshenia": {"currentpage": "3", "submode": "5"},   # разрешения за строеж
    "plovdiv_vavedeni": {"currentpage": "3", "submode": "7"},      # въведени в експлоатация
}
MAX_PAGES = 3000
PAUSE = 0.7  # секунди между заявките – да не натоварваме сайта
HERE = Path(__file__).resolve().parent
SAVED = HERE / "plovdiv_stranici"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) plovdiv-register/1.0"


# ---------------------------------------------------------------------------
# Изтегляне (с бисквитка на сесията – сайтът я изисква)
# ---------------------------------------------------------------------------

import http.cookiejar

_JAR = http.cookiejar.CookieJar()
_OPENERS: dict[str, urllib.request.OpenerDirector] = {}


def _opener(scheme: str) -> urllib.request.OpenerDirector:
    if scheme not in _OPENERS:
        handlers = [urllib.request.HTTPCookieProcessor(_JAR)]
        if scheme == "https":
            handlers.append(urllib.request.HTTPSHandler(context=ssl.create_default_context()))
        _OPENERS[scheme] = urllib.request.build_opener(*handlers)
    return _OPENERS[scheme]


SCHEME = {"value": ""}  # https или http – каквото проработи първо


def fetch(url: str, data: dict | None = None, referer: str = "") -> tuple[str, str]:
    """(html, окончателен адрес). Опитва https, после http (сайтът е на порт 998). data -> POST."""
    last = None
    if url.startswith("http"):
        candidates = [url]
    elif SCHEME["value"]:
        candidates = [f'{SCHEME["value"]}://{url}']
    else:
        candidates = [f"https://{url}", f"http://{url}"]
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    for u in candidates:
        for attempt in range(3):
            try:
                headers = {"User-Agent": UA}
                if body is not None:
                    headers.update({"X-Requested-With": "XMLHttpRequest",
                                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"})
                if referer:
                    headers["Referer"] = referer
                req = urllib.request.Request(u, data=body, headers=headers)
                with _opener(urllib.parse.urlparse(u).scheme).open(req, timeout=90) as resp:
                    raw = resp.read()
                    charset = resp.headers.get_content_charset()
                    final = resp.geturl()
                SCHEME["value"] = SCHEME["value"] or urllib.parse.urlparse(u).scheme
                return decode(raw, charset), final
            except ssl.SSLError as exc:
                last = exc
                break  # опитваме http
            except urllib.error.HTTPError as exc:
                last = exc
                if exc.code in (404, 403):
                    break
                time.sleep(3 * (attempt + 1))
            except Exception as exc:  # временни мрежови грешки
                last = exc
                time.sleep(3 * (attempt + 1))
    raise RuntimeError(f"не се отваря {url}: {last}")


def decode(raw: bytes, charset: str | None) -> str:
    if not charset:
        m = re.search(rb'charset=["\']?([\w-]+)', raw[:3000], re.I)
        charset = m.group(1).decode() if m else None
    for enc in filter(None, [charset, "utf-8", "windows-1251"]):
        try:
            return raw.decode(enc)
        except (LookupError, UnicodeDecodeError):
            continue
    return raw.decode("utf-8", "replace")


# ---------------------------------------------------------------------------
# Разчитане на таблиците и линковете
# ---------------------------------------------------------------------------

class Page(HTMLParser):
    """Всички таблици (редове с клетки и линкове в тях) и всички линкове на страницата."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tables: list[list[dict]] = []
        self._stack: list[list[dict]] = []
        self._row: dict | None = None
        self._cell: list[str] | None = None
        self._cell_links: list[str] = []
        self._is_th = False
        self.links: list[tuple[str, str]] = []
        self._a: str | None = None
        self._a_text: list[str] = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "table":
            self._stack.append([])
        elif tag == "tr" and self._stack:
            self._row = {"cells": [], "links": [], "th": False}
        elif tag in ("td", "th") and self._row is not None:
            self._cell, self._cell_links, self._is_th = [], [], tag == "th"
        elif tag == "br" and self._cell is not None:
            self._cell.append(" ")
        elif tag == "a":
            self._a, self._a_text = a.get("href"), []
            if self._cell is not None and a.get("href"):
                self._cell_links.append(a["href"])

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._row is not None and self._cell is not None:
            self._row["cells"].append(re.sub(r"\s+", " ", "".join(self._cell)).strip())
            self._row["links"] += self._cell_links
            self._row["th"] = self._row["th"] or self._is_th
            self._cell = None
        elif tag == "tr" and self._row is not None and self._stack:
            if self._row["cells"]:
                self._stack[-1].append(self._row)
            self._row = None
        elif tag == "table" and self._stack:
            self.tables.append(self._stack.pop())
        elif tag == "a" and self._a is not None:
            self.links.append((self._a, re.sub(r"\s+", " ", "".join(self._a_text)).strip()))
            self._a = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)
        if self._a is not None:
            self._a_text.append(data)


def main_table(page: Page) -> tuple[list[str], list[dict]]:
    """Таблицата с най-много редове с поне 4 колони; първият ред (или редът с <th>) е заглавен."""
    best: list[dict] = []
    for t in page.tables:
        rows = [r for r in t if len(r["cells"]) >= 4]
        if len(rows) > len(best):
            best = rows
    if not best:
        return [], []
    head_i = next((i for i, r in enumerate(best[:3]) if r["th"]), 0)
    header = [c or f"Колона {i + 1}" for i, c in enumerate(best[head_i]["cells"])]
    data = [r for r in best[head_i + 1:] if r["cells"] != best[head_i]["cells"]]
    return header, data


PAGE_PARAM = re.compile(r"(?i)^(page|pg|p|pn|pagenum|pageno|start|offset|from|currentrec|rec|br|stranica)$")


def page_links(page: Page, base: str, params: dict) -> list[str]:
    """Линковете към другите страници на същия регистър (същият submode, друг номер на страница)."""
    out = []
    for href, text in page.links:
        if not href or href.startswith(("javascript", "mailto", "#")):
            continue
        full = urllib.parse.urljoin(base, html.unescape(href))
        parsed = urllib.parse.urlparse(full)
        if "registers.php" not in parsed.path:
            continue
        q = dict(urllib.parse.parse_qsl(parsed.query))
        if q.get("submode") != params["submode"]:
            continue
        if any(PAGE_PARAM.match(k) for k in q) or re.fullmatch(r"\d+|»|›|>|>>|следваща|напред|последна", text.lower()):
            out.append(full)
    return out


# ---------------------------------------------------------------------------
# Обхождане на един регистър: таблицата идва от user/classes/<файл>.php (POST),
# филтър по година (field=year&value=ГГГГ) и страници (page=N)
# ---------------------------------------------------------------------------

YEARS = [str(y) for y in range(time.localtime().tm_year, 2021, -1)]  # последните години (вкл. текущата)
EMPTY = {f"field{i}": "" for i in range(1, 7)} | {f"date{i}": "" for i in range(1, 5)}


def pages_in(text: str) -> int:
    nums = [int(n) for n in re.findall(r"selectPage\(\s*'?(\d+)'?\s*\)", text)]
    return max(nums) if nums else 1


def crawl(name: str, params: dict) -> int:
    page_url = f"{BASE}?{urllib.parse.urlencode(params)}"
    first, final_page = fetch(page_url)          # отваря сесията (бисквитка)
    regfile = re.search(rf"case '{params['submode']}':\s*registerfile = '([^']+)'", first)
    userid = re.search(r"userid=\"\s*\+\s*'(\d+)'", first)
    regfile = regfile.group(1) if regfile else {"5": "__regs_list_sr.php", "7": "__regs_list_uve.php"}[params["submode"]]
    userid = userid.group(1) if userid else "8"
    data_url = urllib.parse.urljoin(final_page, f"user/classes/{regfile}?submode={params['submode']}&userid={userid}")
    print(f"  данни от: {data_url}")
    header: list[str] = []
    rows_seen: set[tuple] = set()
    SAVED.mkdir(exist_ok=True)
    with open(HERE / f"{name}.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        for year in YEARS:
            page, n_pages = 1, 1
            while page <= n_pages and page <= MAX_PAGES:
                form = {"field": "year", "value": year, **EMPTY, "page": str(page)}
                try:
                    text, _ = fetch(data_url, form, referer=final_page)
                except Exception as exc:
                    print(f"  ! {year}, стр. {page}: {exc}")
                    break
                if page == 1:
                    n_pages = pages_in(text)
                    if year == YEARS[0]:
                        (SAVED / f"{name}_dannite_{year}_1.html").write_text(text, encoding="utf-8")
                parsed = Page()
                parsed.feed(text)
                h, data = main_table(parsed)
                if h and not header:
                    header = h
                    w.writerow(["Година (филтър)"] + header + ["Линк към записа"])
                new = 0
                for r in data:
                    cells = r["cells"] + [""] * (len(header) - len(r["cells"]))
                    sig = tuple(cells)
                    if sig in rows_seen:
                        continue
                    rows_seen.add(sig)
                    link = urllib.parse.urljoin(data_url, html.unescape(r["links"][0])) if r["links"] else ""
                    w.writerow([year] + cells + [link])
                    new += 1
                f.flush()
                print(f"  {name} {year}: страница {page}/{n_pages}, нови редове {new}, общо {len(rows_seen)}")
                page += 1
                time.sleep(PAUSE)
    if not rows_seen:
        print(f"  ! В {name} не е разчетена таблица. Изпратете ни папката {SAVED.name}.")
    return len(rows_seen)


def main() -> int:
    print("Регистри на Община Пловдив (isut.plovdiv.bg)")
    total = 0
    for name, params in REGISTERS.items():
        print(f"\n{name} ...")
        total += crawl(name, params)
    print(f"\nГотово. Файловете са в: {HERE}")
    print("Изпратете ни plovdiv_razreshenia.csv и plovdiv_vavedeni.csv (и папката plovdiv_stranici, "
          "ако някой файл е празен).")
    return 0 if total else 1


if __name__ == "__main__":
    sys.exit(main())
