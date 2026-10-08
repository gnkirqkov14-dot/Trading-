"""Камара на архитектите в България – регистър „Проектантски бюра“ (kab.bg).

Списъкът се филтрира по регионална колегия и е на страници по 20. Всяко бюро
има страница с адрес, имейл, телефон, лице за контакт, собственици
(архитектите) и служители.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from .http import Http

BASE = "https://kab.bg"
LIST = f"{BASE}/registr/proektantski-byura/"
COLLEGES = {"kc-sofia-grad": "София - град", "kc-sofia-oblast": "София - област"}

LABELS = ["Рег. № в КАБ", "Собственици", "Служители", "За контакт", "Адрес", "Е-mail", "E-mail",
          "Лице за контакт", "Телефон за контакт", "Уебсайт", "Уеб сайт", "Интернет страница", "Връзки"]


def list_bureaus(http: Http, college: str) -> list[dict]:
    out, page = [], 1
    while True:
        url = LIST if page == 1 else f"{LIST}page/{page}/"
        soup = BeautifulSoup(http.get(url, params={"kabcollege": college}, timeout=90).text, "html.parser")
        rows = 0
        for tr in soup.select("tr"):
            a = tr.find("a", href=re.compile(r"/beuro/"))
            tds = tr.find_all("td")
            if not a or len(tds) < 4:
                continue
            rows += 1
            cells = [td.get_text(" ", strip=True) for td in tds]
            out.append({"url": a["href"], "name": cells[1], "college": cells[2], "reg_no": cells[3]})
        if not rows or not soup.find("a", href=re.compile(rf"/page/{page + 1}/")):
            return out
        page += 1


def bureau(http: Http, url: str) -> dict:
    soup = BeautifulSoup(http.get(url, timeout=90).text, "html.parser")
    for tag in soup(["script", "style", "nav", "header"]):
        tag.decompose()
    text = re.sub(r"\s+", " ", soup.get_text(" | "))
    text = re.sub(r"(\|\s*)+", "| ", text)
    # Съдържанието на бюрото е след последното "Рег. № в КАБ"
    body = text[text.rfind("Рег. № в КАБ"):] if "Рег. № в КАБ" in text else ""

    def field(label: str) -> str:
        m = re.search(rf"{re.escape(label)}(?: \(\d+\))? \| (.*?)(?= \| (?:{'|'.join(map(re.escape, LABELS))})\b| \| Връзки|$)", body)
        return m.group(1).strip(" |") if m else ""

    emails = sorted({a["href"][7:].split("?")[0].strip().lower()
                     for a in soup.find_all("a", href=re.compile(r"^mailto:"))})
    phone = field("Телефон за контакт")
    website = field("Уебсайт") or field("Уеб сайт") or field("Интернет страница")
    return {
        "kab_url": url,
        "owners": [x.strip() for x in field("Собственици").split("|") if x.strip()],
        "staff": [x.strip() for x in field("Служители").split("|")
                  if x.strip() and x.strip() not in ("Проектанти", "Сътрудници")][:10],
        "address": " ".join(x.strip() for x in field("Адрес").split("|")),
        "contact_person": field("Лице за контакт"),
        "phones": [p.strip() for p in re.split(r"[,;]| \| ", phone) if p.strip()],
        "emails": emails or [e for e in re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", field("Е-mail") or field("E-mail"))],
        "website": website if "." in website else "",
    }
