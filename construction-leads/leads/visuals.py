"""Визуализации на новите сгради.

Страниците от Google търсенето по инвеститора (сайт на проекта, портфолио
на архитекта, обяви, статии) почти винаги имат og:image – картинката, която
се показва при споделяне. Взимаме я, смаляваме я и я вграждаме в отчета.
Пазим линк към страницата-източник: авторските права са на архитекта или
инвеститора.
"""
from __future__ import annotations

import base64
import io
import re

from bs4 import BeautifulSoup
from PIL import Image

from . import web
from .http import Http
from .ksb import normalize_name

# Регистри и каталози без снимки на проекти (новините и обявите са позволени).
NO_IMAGE_DOMAINS = {
    "papagal.bg", "registryagency.bg", "yox.bg", "finansi.bg", "companybook.bg", "bulstat.bg",
    "sofia.bg", "eufunds.bg", "fico.bg", "bgfirma.com", "firmi.bg", "kik-info.com",
    "opencorporates.com", "ksb.bg", "kab.bg", "aop.bg", "eop.bg", "lex.bg", "ciela.net",
    "egov.bg", "bcc.bg", "gestapo.bg", "topograph.co", "govalert.eu", "firma.bg", "firmlocator.com",
    "company.guru", "uic.bg", "vat-search.eu", "justice.bg", "daibau.bg", "wherewework.bg",
    "akt16.bg", "stroitelite.eu", "rabota.bg", "jobs.bg", "zaplata.bg", "linkedin.com", "wikipedia.org",
}
# Сайтове за имоти и строителни новини, където има реални визуализации на проекти.
PROJECT_SITES = {
    "imot.bg", "homes.bg", "imoti.net", "address.bg", "yavlena.com", "bulgarianproperties.bg",
    "gradat.bg", "citybuild.bg", "ypi.bg", "luximmo.bg", "superimoti.bg", "arcoreal.bg",
    "unique-estates.bg", "imoteka.bg", "alo.bg", "novostroiki.bg", "novostroika.bg",
    "construction.bg", "stroitelstvo.info", "investor.bg", "capital.bg", "sofiainfo.bg",
    "bnr.bg", "dnevnik.bg", "archdaily.com", "architizer.com", "imoti.bg", "home2u.bg",
}
GOOD_TLDS = {"bg", "com", "eu", "net", "org", "studio", "design", "archi", "info", "biz", "co"}
BAD_IMAGE = re.compile(r"logo|favicon|icon|avatar|placeholder|default|blank|sprite", re.I)


def _loose(text: str) -> str:
    """Транслитерация + c/k, за да съвпаднат 'КАПИТОЛ' и 'Capitol'."""
    t = web.translit(text).replace("k", "c").replace("w", "v")
    return re.sub(r"[^a-z0-9]", "", t)


# Имена на квартали и места: „Изгрев Премиум“ не бива да съвпада с всяка обява в Изгрев
PLACE_WORDS = {_w for _w in """
софия sofia изгрев лозенец младост люлин витоша бояна драгалевци симеоново овча купел банкя
надежда красна поляна красно село лагера манастирски ливади студентски дружба слатина подуяне
оборище сердика средец триадица възраждане илинден връбница нови искър панчарево кремиковци
гоце делчев хиподрума стрелбище яворов изток иван вазов белите брези борово гео милев редута
хладилника бъкстон павлово княжево горна баня кръстова вада малинова долина полигона суха река
център premium премиум residence резиденс park парк tower тауър garden гардън city сити
""".split()}
# Обяви за отделни имоти – не са визуализация на новата сграда
SINGLE_UNIT = re.compile(r"(?i)\b(?:едностаен|двустаен|тристаен|четиристаен|многостаен|мезонет|"
                         r"гарсониера|ателие|апартамент|стая|къща под наем|офис под наем)\b")
PROJECT_WORDS = re.compile(r"(?i)ново строителство|комплекс|сграда|проект|residence|резиденс|"
                           r"жилищна|building|complex|визуализац")


def relevant(result: dict, company: str) -> bool:
    url = result.get("url") or ""
    host = web.domain_of(url)
    if not url or any(host == d or host.endswith("." + d) for d in NO_IMAGE_DOMAINS):
        return False
    hay = _loose(" ".join([url, result.get("title", ""), result.get("description", "")]))
    toks = [_loose(t) for t in re.split(r"[\s\-./]+", normalize_name(company)) if len(t) >= 4]
    toks = [t for t in toks if len(t) >= 4 and t not in {"invest", "group", "grup", "bild", "build",
                                                         "stroy", "stroi", "consult", "consult"}
            and t not in {_loose(w) for w in PLACE_WORDS}]
    return bool(toks) and any(t in hay for t in toks)


def _site_in(host: str, sites: set) -> bool:
    return any(host == d or host.endswith("." + d) for d in sites)


def trusted_page(result: dict, company: str, extra_domains: set) -> bool:
    """Сайтът на фирмата, сайт на архитекта от списъка или известен сайт за имоти."""
    url = result.get("url") or ""
    host = web.domain_of(url)
    if not url or host.rsplit(".", 1)[-1] not in GOOD_TLDS:
        return False
    if web.matches_company(url, company) and not web.is_directory(url):
        return True
    if not ((_site_in(host, PROJECT_SITES) or host in extra_domains) and relevant(result, company)):
        return False
    title = " ".join([result.get("title", ""), result.get("description", "")])
    # Обява за един апартамент без дума за проект/сграда – това не е визуализация на обекта
    return not (SINGLE_UNIT.search(title) and not PROJECT_WORDS.search(result.get("title", "")))


def og_image(http: Http, page_url: str) -> dict | None:
    resp = http.get(page_url, timeout=25)
    soup = BeautifulSoup(resp.text, "html.parser")
    tag = (soup.find("meta", property="og:image") or soup.find("meta", attrs={"name": "og:image"})
           or soup.find("meta", attrs={"name": "twitter:image"}))
    if not tag or not tag.get("content"):
        return None
    img = tag["content"].strip()
    if img.startswith("//"):
        img = "https:" + img
    elif img.startswith("/"):
        img = f"https://{web.domain_of(page_url)}{img}"
    if BAD_IMAGE.search(img):
        return None
    title = soup.find("meta", property="og:title")
    return {"image": img, "page": page_url,
            "title": (title.get("content") if title else (soup.title.string if soup.title else "")) or ""}


def thumbnail(http: Http, image_url: str, width: int = 360) -> str | None:
    """Сваля картинката и връща data: URI (JPEG, ~20–40 KB)."""
    raw = http.get(image_url, timeout=30).content
    img = Image.open(io.BytesIO(raw))
    if img.width < 300 or img.height < 160:  # твърде малка – вероятно иконка
        return None
    img = img.convert("RGB")
    img.thumbnail((width, width))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=72, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def add_visuals(permits: list[dict], results_by_query: dict[str, list], queries_for, http: Http,
                cache, log=print, max_pages: int = 4) -> int:
    """За всяко разрешение: първата надеждна страница с og:image -> p['visual']."""
    found = 0
    for p in permits:
        company = (p.get("investor_companies") or [""])[0]
        if not company:
            continue
        p.pop("visual", None)
        arch_domains = {web.domain_of(a.get("website", "")) for a in p.get("architects", [])}
        candidates, seen = [], set()
        for q in queries_for(p):
            for r in results_by_query.get(q, []):
                if r.get("url") not in seen and trusted_page(r, company, arch_domains):
                    seen.add(r["url"])
                    candidates.append(r)
        for r in candidates[:max_pages]:
            try:
                meta = cache("og", r["url"], lambda: og_image(http, r["url"]))
                if not meta:
                    continue
                thumb = cache("thumb", meta["image"], lambda: thumbnail(http, meta["image"]))
            except Exception:
                continue
            if thumb:
                p["visual"] = {**meta, "thumb": thumb}
                found += 1
                break
    log(f"  визуализации: {found}")
    return found


# --------------------------------------------------------------------------
# Последна проверка: по-добре без снимка, отколкото грешна снимка
# --------------------------------------------------------------------------

TYPE_WORDS = {
    "Жилищна – многофамилна": r"жилищ|residen|резиденс|апартамент|комплекс|homes?\b|living|сграда",
    "Смесено предназначение": r"жилищ|residen|резиденс|апартамент|комплекс|офис|office|mixed|сграда",
    "Жилищна – еднофамилна": r"къщ|house|villa|вил|резиденс|residen",
    "Офис / административна": r"офис|office|business|бизнес",
    "Логистика / промишленост": r"склад|логист|industr|warehouse|производ",
    "Търговска": r"търгов|retail|mall|мол\b|магазин|shop",
    "Хотел": r"хотел|hotel",
}


def visual_ok(p: dict) -> bool:
    """Снимката е от страница за конкретен проект и типът на сградата съвпада."""
    from urllib.parse import unquote, urlparse
    v = p.get("visual")
    if not v:
        return False
    path = unquote(urlparse(v.get("page", "")).path).strip("/").lower()
    if path in ("", "bg", "en", "ru", "index.php", "index.html", "home", "начало"):
        return False  # началната страница на фирмата – обща снимка, не на този обект
    need = TYPE_WORDS.get(p.get("building_type", ""))
    if not need:
        return False
    text = " ".join([v.get("title", ""), path]).lower()
    return bool(re.search(need, text))


def filter_visuals(permits: list[dict]) -> int:
    """Маха несигурните снимки и тези, които се повтарят за различни обекти."""
    from collections import Counter
    for p in permits:
        if p.get("visual") and not visual_ok(p):
            p.pop("visual")
    used = Counter(p["visual"]["page"] for p in permits if p.get("visual"))
    used_img = Counter(p["visual"]["image"] for p in permits if p.get("visual"))
    for p in permits:
        v = p.get("visual")
        if v and (used[v["page"]] > 1 or used_img[v["image"]] > 1):
            p.pop("visual")  # една и съща снимка за няколко обекта – значи е обща
    return sum(1 for p in permits if p.get("visual"))
