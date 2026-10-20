"""Архитектите от Google Maps за Пловдив и областта: слива изтеглените файлове и взима имейл от сайта им.

Файловете output/plovdiv/maps_arhitekti*.json са резултати от Apify (compass/crawler-google-places).
Имейлите се взимат само от собствения домейн на бюрото (начална страница + страница „контакти“).

    python plovdiv_maps.py  ->  output/plovdiv/maps_arhitekti_vsichki.json
"""
from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from leads import web
from leads.http import Http
from leads.projects import Fetcher, contacts_from
from leads.runlog import RunLog

ROOT = Path(__file__).parent
DIR = ROOT / "output" / "plovdiv"
OUT = DIR / "maps_arhitekti_vsichki.json"

ARCH_CATS = {"Архитект", "Архитектурна фирма", "Архитектурен дизайнер", "Проектантско бюро", "Инженер-конструктор"}
# Пловдивска област: градовете по адреса в Google Maps
TOWNS = ("Пловдив", "Асеновград", "Карлово", "Раковски", "Стамболийски", "Първомай", "Хисаря", "Сопот", "Съединение",
         "Куклен", "Перущица", "Кричим", "Брезово", "Калофер", "Садово", "Лъки", "Клисура", "Марково", "Труд",
         "Цалапица", "Белащица", "Брестник", "Кадиево", "Костиево", "Радиново", "Скутаре", "Войводиново")
CONTACT = re.compile(r"(?i)contact|kontakt|контакт|about|за-нас|za-nas")


def is_arch(x: dict) -> bool:
    cat, title = x.get("categoryName"), x.get("title") or ""
    if re.search(r"(?i)музей|museum|галерия|училище|община", title):
        return False
    cats = set(x.get("categories") or []) | {cat}
    return bool(cats & ARCH_CATS) or bool(re.search(r"(?i)\bарх|archi|проектант", title))


def town(x: dict) -> str:
    """Градът от адреса – след пощенския код („4000 Пловдив“) или полето city; не името на улица."""
    m = re.search(r"\b\d{4}\s+(?:гр\.\s*|с\.\s*)?([А-Я][а-я]+(?:\s[А-Я][а-я]+)?)", x.get("address") or "")
    place = m.group(1) if m else (x.get("city") or "")
    return next((t for t in TOWNS if place.startswith(t)), "")


def emails_of(f: Fetcher, site: str) -> list[str]:
    dom = web.domain_of(site)
    home = f.get(site if "://" in site else "https://" + site)
    if not home:
        return []
    found = contacts_from(home, dom)["emails"]
    if not found:
        for href, anchor, _ in home.get("links") or []:
            if web.domain_of(href) == dom and CONTACT.search(href + " " + anchor):
                pg = f.get(href)
                if pg:
                    found = contacts_from(pg, dom)["emails"]
                if found:
                    break
    return found[:3]


def main() -> None:
    log = RunLog("plovdiv_maps")
    places: dict[str, dict] = {}
    for path in sorted(DIR.glob("maps_arhitekti*.json")):
        if path == OUT:
            continue
        for x in json.loads(path.read_text(encoding="utf-8")):
            key = x.get("placeId") or x.get("title")
            if key and is_arch(x) and town(x):
                places.setdefault(key, x)
    old = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else []
    known = {x.get("placeId") or x.get("title"): x.get("emails") for x in old}
    todo = [x for k, x in places.items() if x.get("website") and k not in known]

    def one(x: dict) -> tuple[str, list[str]]:
        own = Fetcher(log, http=Http(delay=0.5, retries=1, timeout=15))
        try:
            return x.get("placeId") or x["title"], emails_of(own, x["website"])
        except Exception as exc:
            log.failure("site", x["website"], exc, x["website"])
            return x.get("placeId") or x["title"], []
    with ThreadPoolExecutor(max_workers=12) as pool:
        got = dict(pool.map(one, todo))
    out = []
    for k, x in places.items():
        out.append({"placeId": x.get("placeId"), "title": x.get("title"), "categoryName": x.get("categoryName"),
                    "town": town(x), "address": x.get("address"), "phone": x.get("phone"), "website": x.get("website"),
                    "emails": got.get(k, known.get(k)) or [], "totalScore": x.get("totalScore"),
                    "reviewsCount": x.get("reviewsCount"), "url": x.get("url")})
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    log.log(f"{len(out)} бюра в областта, с телефон {sum(1 for x in out if x['phone'])}, "
            f"с имейл {sum(1 for x in out if x['emails'])} -> {OUT}")


if __name__ == "__main__":
    main()
