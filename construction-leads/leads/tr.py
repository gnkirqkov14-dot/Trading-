"""Търговски регистър (Агенция по вписванията) – portal.registryagency.bg.

Публичното API на портала дава по ЕИК: седалище и адрес на управление
(често с телефон и имейл), управители, предмет на дейност и сайт, ако е
вписан. Търсенето по име връща списък с ЕИК.
"""
from __future__ import annotations

import html as htmllib
import re

from .http import Http
from .ksb import normalize_name

API = "https://portal.registryagency.bg/CR/api"

PHONE_RX = re.compile(r"Телефон:\s*([+\d][\d\s/()-]{5,})")
EMAIL_RX = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
WEB_RX = re.compile(r"Интернет страница:\s*(\S+)")

def _text(fragment: str) -> str:
    fragment = re.sub(r"<br\s*/?>", "\n", fragment or "")
    return re.sub(r"[ \t]+", " ", htmllib.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def _legal_form(full_name: str) -> str:
    m = re.search(r"\b(ЕООД|ООД|ЕАД|АД|ЕТ|КД|СД)\b", full_name or "", re.I)
    return m.group(1).upper() if m else ""


def search(http: Http, name: str) -> list[dict]:
    resp = http.get(f"{API}/Deeds/Summary", params={"name": name, "page": 1, "pageSize": 25})
    try:
        return resp.json() or []
    except ValueError:
        return []


def deed(http: Http, eik: str) -> dict:
    data = http.get(f"{API}/Deeds/{eik}").json()
    fields: dict[str, list[str]] = {}
    for section in data.get("sections") or []:
        for sub in section.get("subDeeds") or []:
            for group in sub.get("groups") or []:
                for f in group.get("fields") or []:
                    if f.get("htmlData"):
                        fields.setdefault(f["nameCode"], []).append(f["htmlData"])

    address_html = " ".join(fields.get("CR_F_5_L", []))
    address = _text(address_html)
    phone = PHONE_RX.search(address)
    email = EMAIL_RX.search(address)
    web = WEB_RX.search(address)
    managers = []
    for code in ("CR_F_7_L", "CR_F_10_L", "CR_F_23_L"):  # управители, съвет на директорите, ед. собственик
        for frag in fields.get(code, []):
            for part in re.split(r"<hr[^>]*>", frag):
                t = _text(part).split(", Държава")[0].strip()
                if t and t not in managers:
                    managers.append(t)
    address_line = re.split(r"\s*Телефон:|\s*Адрес на електронна поща:|\s*Интернет страница:", address)[0]
    return {
        "eik": eik,
        "tr_name": data.get("companyName") or "",
        "address": re.sub(r"\s*\n\s*", ", ", address_line.replace("Държава: БЪЛГАРИЯ", "")).strip(" ,"),
        "phone": re.sub(r"\s+", " ", phone.group(1)).strip(" ,") if phone else "",
        "email": email.group(0) if email else "",
        "website": web.group(1).strip(" ,") if web else "",
        "managers": managers[:5],
        "activity": _text(" ".join(fields.get("CR_F_6_L", [])))[:300],
        "tr_url": f"https://portal.registryagency.bg/CR/Reports/ActiveConditionTabResult?uic={eik}",
    }


def find_company(http: Http, company_name: str) -> dict | None:
    """Име от разрешението ('„МГРУП“ ЕООД') -> запис от ТР при точно съвпадение
    на името и правната форма; при няколко еднакви имена връща None."""
    target = normalize_name(company_name)
    form = _legal_form(company_name)
    if len(target) < 2:
        return None
    hits = [h for h in search(http, target)
            if not h.get("isPhysical") and normalize_name(h.get("name", "")) == target
            and (not form or _legal_form(h.get("companyFullName", "")) == form)]
    if len(hits) != 1:
        return None
    return deed(http, hits[0]["ident"])
