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
    "egov.bg", "bcc.bg", "rabota.bg", "jobs.bg", "zaplata.bg", "linkedin.com", "wikipedia.org",
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


def relevant(result: dict, company: str) -> bool:
    url = result.get("url") or ""
    host = web.domain_of(url)
    if not url or any(host == d or host.endswith("." + d) for d in NO_IMAGE_DOMAINS):
        return False
    hay = _loose(" ".join([url, result.get("title", ""), result.get("description", "")]))
    toks = [_loose(t) for t in re.split(r"[\s\-./]+", normalize_name(company)) if len(t) >= 4]
    toks = [t for t in toks if len(t) >= 4 and t not in {"invest", "group", "grup", "bild", "build",
                                                         "stroy", "stroi", "consult", "consult"}]
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
    return (_site_in(host, PROJECT_SITES) or host in extra_domains) and relevant(result, company)


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
