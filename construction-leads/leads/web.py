"""Търсене в Google (през Apify) и извличане на телефони/имейли от сайтове.

Използва се, когато фирмата няма контакти в регистрите: намираме сайта ѝ
и четем началната страница и страницата „Контакти“. Същото търсене по
името на инвеститора често показва и архитектурното студио на проекта.
"""
from __future__ import annotations

import os
import re
import time
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .http import Http
from .ksb import normalize_name

APIFY = "https://api.apify.com/v2"
ACTOR = "apify~google-search-scraper"

# Каталози и регистри – не са сайтът на самата фирма.
DIRECTORY_DOMAINS = {
    "papagal.bg", "registryagency.bg", "yox.bg", "finansi.bg", "companybook.bg", "bulstat.bg",
    "sofia.bg", "eufunds.bg", "facebook.com", "linkedin.com", "instagram.com", "youtube.com",
    "imot.bg", "homes.bg", "imoti.net", "address.bg", "bazar.bg", "olx.bg", "b2bmap.com",
    "fico.bg", "bgfirma.com", "firmi.bg", "kik-info.com", "opencorporates.com", "dnevnik.bg",
    "capital.bg", "gradat.bg", "investor.bg", "24chasa.bg", "trud.bg", "novini.bg", "mediapool.bg",
    "bnr.bg", "bntnews.bg", "segabg.com", "nova.bg", "btvnovinite.bg", "wikipedia.org",
    "ksb.bg", "kab.bg", "aop.bg", "eop.bg", "google.com", "bing.com", "tiktok.com", "x.com",
    "twitter.com", "archdaily.com", "behance.net", "pinterest.com", "rabota.bg", "jobs.bg",
    "zaplata.bg", "infobusiness.bcci.bg", "bcc.bg", "bcci.bg", "egov.bg", "lex.bg", "ciela.net",
}

TRANSLIT = str.maketrans({
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ж": "zh", "з": "z", "и": "i",
    "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s",
    "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sht",
    "ъ": "a", "ь": "y", "ю": "yu", "я": "ya",
})

PHONE_RX = re.compile(r"(?:\+359|00359|\b0)[\s/.-]*(?:\(?\d\)?[\s/.-]*){8,9}\b")
EMAIL_RX = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
BAD_EMAIL = re.compile(r"\.(png|jpe?g|gif|webp|svg)$|sentry|wixpress|example\.|domain\.|"
                       r"@sentry|noreply|no-reply", re.I)


def translit(text: str) -> str:
    return (text or "").lower().translate(TRANSLIT)


def domain_of(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def is_directory(url: str) -> bool:
    host = domain_of(url)
    return any(host == d or host.endswith("." + d) for d in DIRECTORY_DOMAINS)


def name_tokens(company: str) -> list[str]:
    base = normalize_name(company)
    toks = [translit(t) for t in re.split(r"[\s\-./]+", base) if len(t) >= 3]
    toks += [t for t in re.split(r"[\s\-./]+", base) if len(t) >= 3 and t.isascii()]
    return [re.sub(r"[^a-z0-9]", "", t) for t in toks if t]


def matches_company(url: str, company: str) -> bool:
    """Домейнът съдържа дума от името (на латиница), напр. capitol ↔ КАПИТОЛ."""
    dom = re.sub(r"[^a-z0-9]", "", domain_of(url).rsplit(".", 1)[0])
    toks = [t for t in name_tokens(company) if len(t) >= 4 and t not in
            {"invest", "group", "grup", "bild", "build", "stroy", "consult", "konsult", "bulgaria"}]
    return any(t in dom for t in toks)


# --------------------------------------------------------------------------
# Google през Apify
# --------------------------------------------------------------------------

COST_PER_QUERY = 0.0055  # USD на заявка (измерено: 0.0045–0.0056)


def _norm_q(q: str) -> str:
    return re.sub(r"\s+", " ", q or "").strip().lower()


def queries_affordable(http: Http) -> int | None:
    """Колко нови Google заявки позволява оставащият месечен бюджет в Apify.
    Резерв APIFY_RESERVE_USD (по подразбиране 0.30 $) не се харчи. None = неизвестно."""
    token = os.environ.get("APIFY_TOKEN")
    params = {"token": token} if token else {}
    reserve = float(os.environ.get("APIFY_RESERVE_USD", "0.30"))
    try:
        data = http.get(f"{APIFY}/users/me/limits", params=params).json()["data"]
        left = data["limits"]["maxMonthlyUsageUsd"] - data["current"]["monthlyUsageUsd"]
    except Exception:
        return None
    return max(0, int((left - reserve) / COST_PER_QUERY))


def google(http: Http, queries: list[str], timeout: int = 900) -> dict[str, list[dict]]:
    """Пуска всички заявки в един Apify run и връща {заявка: [резултати]}."""
    if not queries:
        return {}
    token = os.environ.get("APIFY_TOKEN")
    params = {"token": token} if token else {}
    run = http.post(f"{APIFY}/acts/{ACTOR}/runs", params=params, json={
        "queries": "\n".join(queries), "maxPagesPerQuery": 1, "resultsPerPage": 10,
        "countryCode": "bg", "languageCode": "bg", "mobileResults": False,
    }).json()["data"]
    started = time.time()
    while run["status"] in ("READY", "RUNNING"):
        if time.time() - started > timeout:
            raise TimeoutError("Apify търсенето не приключи навреме")
        time.sleep(10)
        run = http.get(f"{APIFY}/actor-runs/{run['id']}", params=params).json()["data"]
    if run["status"] != "SUCCEEDED":
        raise RuntimeError(f"Apify run {run['id']}: {run['status']}")
    items = http.get(f"{APIFY}/datasets/{run['defaultDatasetId']}/items", params=params).json()
    by_norm = {_norm_q(q): q for q in queries}
    out: dict[str, list[dict]] = {}
    for item in items:
        term = (item.get("searchQuery") or {}).get("term", "")
        term = by_norm.get(_norm_q(term), term)
        out.setdefault(term, []).extend(
            {"url": r.get("url"), "title": r.get("title", ""), "description": r.get("description", "")}
            for r in item.get("organicResults") or [])
    return out


# --------------------------------------------------------------------------
# Контакти от сайт
# --------------------------------------------------------------------------

def _clean_phone(raw: str) -> str:
    digits = re.sub(r"[^\d+]", "", raw)
    if digits.startswith("00359"):
        digits = "+359" + digits[5:]
    if digits.startswith("0"):
        digits = "+359" + digits[1:]
    return digits if 12 <= len(digits) <= 13 else ""


def site_contacts(http: Http, url: str, max_pages: int = 3) -> dict:
    """Началната страница + до 2 страници „Контакти“ -> телефони и имейли."""
    root = f"{urlparse(url).scheme or 'https'}://{urlparse(url).netloc}"
    pages, seen = [url if urlparse(url).path not in ("", "/") else root], set()
    phones: list[str] = []
    emails: list[str] = []
    while pages and len(seen) < max_pages:
        page = pages.pop(0)
        if page in seen:
            continue
        seen.add(page)
        try:
            resp = http.get(page, timeout=20)
        except Exception:
            continue
        if "html" not in resp.headers.get("Content-Type", "html"):
            continue
        soup = BeautifulSoup(resp.text, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if href.startswith("mailto:"):
                emails.append(href[7:].split("?")[0])
            elif href.startswith("tel:"):
                phones.append(href[4:])
            elif re.search(r"contact|kontakt|контакт", href + " " + a.get_text(" "), re.I):
                full = urljoin(page, href)
                if domain_of(full) == domain_of(root) and full not in seen:
                    pages.insert(0, full)
        for tag in soup(["script", "style", "noscript"]):
            tag.decompose()
        text = soup.get_text(" ")
        phones += PHONE_RX.findall(text)
        emails += EMAIL_RX.findall(text)
    phones = list(dict.fromkeys(p for p in map(_clean_phone, phones) if p))
    emails = list(dict.fromkeys(e.strip(".").lower() for e in emails if not BAD_EMAIL.search(e)))
    return {"website": root, "phones": phones[:4], "emails": emails[:4]}


def pick_company_site(results: list[dict], company: str) -> str | None:
    for r in results:
        if r.get("url") and not is_directory(r["url"]) and matches_company(r["url"], company):
            return r["url"]
    return None


def pick_architects(results: list[dict], company: str, kab_by_domain: dict | None = None,
                    exclude_domain: str = "") -> list[dict]:
    """Архитект на проекта: сайт на бюро от регистъра на КАБ, или архитектурен
    сайт (.bg/.com/.eu с „arch“ в домейна), в който се споменава инвеститорът."""
    from .visuals import relevant  # избягваме цикличен import
    kab_by_domain = kab_by_domain or {}
    found, seen = [], set()
    for r in results:
        url = r.get("url") or ""
        dom = domain_of(url)
        if not url or is_directory(url) or dom == exclude_domain or dom in seen:
            continue
        kab = kab_by_domain.get(dom)
        archy = (re.search(r"arch|arh", dom.replace("search", "")) and dom.rsplit(".", 1)[-1] in {"bg", "com", "eu"}
                 and relevant(r, company))
        if kab or archy:
            seen.add(dom)
            found.append({"url": url, "title": r.get("title", ""), "domain": dom, "kab": kab})
    return found[:2]
