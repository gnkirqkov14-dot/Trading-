"""Действащи архитекти в Пловдивска област – само от Google (търсене + Google Maps), без регистъра на КАБ.

Действащ = има работещ сайт, имейл и телефон на сайта (или в Google Maps), и сайтът е на архитект/проектант
от Пловдив или областта.

    python plovdiv_google_arch.py  ->  output/plovdiv/google_arhitekti_deistvashti.json
"""
from __future__ import annotations

import json
import re
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from leads import web
from leads.http import Http

ROOT = Path(__file__).parent
DIR = ROOT / "output" / "plovdiv"
OUT = DIR / "google_arhitekti_deistvashti.json"
SEARCH_CACHE = DIR / "google_arhitekti_search.json"

AREA = ("Пловдив", "Асеновград", "Карлово", "Раковски", "Стамболийски", "Първомай", "Хисаря", "Сопот", "Съединение",
        "Куклен", "Перущица", "Кричим", "Брезово", "Калофер", "Садово", "Марица", "Родопи", "Калояново")
QUERIES = (
    [f"архитект {t}" for t in AREA]
    + ["архитектурно студио Пловдив", "архитектурно бюро Пловдив", "архитектурна фирма Пловдив", "проектантско бюро Пловдив",
       "проектиране на къщи Пловдив", "проектиране на жилищни сгради Пловдив", "архитект Пловдив контакти",
       "архитект Пловдив проекти", "architect Plovdiv", "architecture studio Plovdiv", "architectural design Plovdiv",
       "архитектурно проектиране Пловдив цена", "архитект за къща Пловдив", "инвестиционен проект архитект Пловдив",
       "интериорен архитект Пловдив", "архитектурно ателие Пловдив", "проектант сгради Асеновград", "архитект Пловдивска област"]
)
# каталози, медии, обяви – не са сайтът на самото бюро
MORE_DIRECTORIES = ("zlatnistranici.bg", "goldenpages.bg", "arhitekti.bg", "bgarchitect.com", "plovdiv24.bg",
                    "plovdivnow.bg", "trafficnews.bg", "maritsa.bg", "pariteni.bg", "spisanie8.bg", "dir.bg",
                    "abv.bg", "vesti.bg", "stroitelstvo.info", "build.bg", "kashti.bg", "yellowpages.bg",
                    "bulgarian-architects.com", "architectures.bg", "houzz.com", "glassdoor.com", "indeed.com",
                    "plovdiv.bg", "government.bg", "uni-plovdiv.bg", "luac.bg", "uacg.bg", "tu-plovdiv.bg",
                    "bnb.bg", "nsi.bg", "ebay.com", "amazon.com", "emag.bg", "praktiker.bg", "mr-bricolage.bg")
ARCH_RX = re.compile(r"(?i)архитект|architect|проектиране|проектант|interior design|интериор")
AREA_RX = re.compile(r"(?i)" + "|".join(AREA) + r"|Plovdiv|Asenovgrad|Karlovo|Rakovski|Stamboliyski")
CONTACT_RX = re.compile(r"(?i)contact|kontakt|контакт")
PHONE_032 = re.compile(r"^\+35932")


def directory(url: str) -> bool:
    host = web.domain_of(url)
    return web.is_directory(url) or any(host == d or host.endswith("." + d) for d in MORE_DIRECTORIES)


def visit(http: Http, site: str) -> dict | None:
    """Началната страница + страницата „Контакти“: име, текст, имейли, телефони."""
    root = f"{urlparse(site).scheme or 'https'}://{urlparse(site).netloc}"
    pages, seen, texts = [root], set(), []
    phones, emails, title = [], [], ""
    while pages and len(seen) < 3:
        page = pages.pop(0)
        if page in seen:
            continue
        seen.add(page)
        try:
            resp = http.get(page, timeout=20)
        except Exception:
            continue
        if resp.status_code >= 400 or "html" not in resp.headers.get("Content-Type", "html"):
            continue
        soup = BeautifulSoup(resp.text, "html.parser")
        if not title and soup.title:
            title = soup.title.get_text(" ", strip=True)
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("mailto:"):
                emails.append(href[7:].split("?")[0])
            elif href.startswith("tel:"):
                phones.append(href[4:])
            elif CONTACT_RX.search(href + " " + a.get_text(" ")):
                full = urljoin(page, href)
                if web.domain_of(full) == web.domain_of(root) and full not in seen:
                    pages.insert(0, full)
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = soup.get_text(" ")
        texts.append(text)
        phones += web.PHONE_RX.findall(text)
        emails += web.EMAIL_RX.findall(text)
    if not texts:
        return None
    phones = list(dict.fromkeys(p for p in map(web._clean_phone, phones) if p))[:3]
    emails = list(dict.fromkeys(e.strip(".").lower() for e in emails if not web.BAD_EMAIL.search(e)))[:3]
    text = " ".join(texts)
    return {"website": root, "title": title[:120], "phones": phones, "emails": emails,
            "arch": bool(ARCH_RX.search(title + " " + text[:20000])),
            "area": bool(AREA_RX.search(text)) or any(PHONE_032.match(p) for p in phones)}


def main() -> None:
    http = Http(delay=0.5, retries=1, timeout=20)
    if SEARCH_CACHE.exists():
        found = json.loads(SEARCH_CACHE.read_text(encoding="utf-8"))
    else:
        found = web.google(Http(), QUERIES)
        SEARCH_CACHE.write_text(json.dumps(found, ensure_ascii=False, indent=1), encoding="utf-8")
    sites: dict[str, dict] = {}
    for q, results in found.items():
        for r in results:
            url = r.get("url") or ""
            if url and not directory(url):
                sites.setdefault(web.domain_of(url), {"url": url, "google": r.get("title", ""), "query": q})
    # бюрата от Google Maps в областта, които имат сайт (plovdiv_maps.py)
    maps = {}
    for x in json.loads((DIR / "maps_arhitekti_vsichki.json").read_text(encoding="utf-8")):
        if x.get("website") and not directory(x["website"]):
            dom = web.domain_of(x["website"])
            maps[dom] = x
            sites.setdefault(dom, {"url": x["website"], "google": "", "query": "Google Maps"})

    def one(item):
        dom, s = item
        own = Http(delay=0.3, retries=1, timeout=20)
        try:
            return dom, visit(own, s["url"])
        except Exception:
            return dom, None
    with ThreadPoolExecutor(max_workers=12) as pool:
        got = dict(pool.map(one, sites.items()))

    out = []
    for dom, s in sites.items():
        v, m = got.get(dom), maps.get(dom)
        if not v:
            continue
        phones = v["phones"] or ([m["phone"]] if m and m.get("phone") else [])
        emails = v["emails"] or (m.get("emails") if m else [])
        in_area = bool(m) or v["area"]
        if not (v["arch"] and in_area and phones and emails):
            continue
        name = (m or {}).get("title") or re.split(r"\s[|–—-]\s", v["title"] or s["google"])[0].strip() or dom
        out.append({"name": name, "website": v["website"], "phones": phones, "emails": emails,
                    "town": (m or {}).get("town") or "", "address": (m or {}).get("address") or "",
                    "rating": (m or {}).get("totalScore"), "reviews": (m or {}).get("reviewsCount"),
                    "maps": (m or {}).get("url") or "", "found_by": s["query"]})
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(sites)} сайта проверени, {len(out)} действащи архитекти с сайт + имейл + телефон -> {OUT}")


if __name__ == "__main__":
    main()
