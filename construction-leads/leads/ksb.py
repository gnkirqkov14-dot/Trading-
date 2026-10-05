"""Централен професионален регистър на строителя (КСБ) – register.ksb.bg.

Публичната справка дава за всяка вписана фирма: ЕИК, представляващи,
седалище, телефон, имейл, сайт, групи/категории строежи и деклариран опит.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from .http import Http

BASE = "https://register.ksb.bg"

LEGAL_FORMS = r"\b(ЕООД|ООД|ЕАД|АД|КД|КДА|СД|ЕТ|ДЗЗД|ДЗД)\b"


def normalize_name(name: str) -> str:
    """'„ИСА 2000“ ЕООД' -> 'иса 2000' (без кавички и правна форма)."""
    name = re.sub(r"[\"'„“”«»]", " ", name or "")
    name = re.sub(LEGAL_FORMS, " ", name, flags=re.I)
    return re.sub(r"\s+", " ", name).strip().lower()


def search(http: Http, name: str = "", eik: str = "") -> list[dict]:
    resp = http.post(f"{BASE}/spravki.php", data={
        "findEIK": eik, "findNAME": name, "filter1": "Търси вписани в регистъра",
    })
    soup = BeautifulSoup(resp.text, "html.parser")
    results = []
    for a in soup.find_all("a", href=re.compile(r"pub_view\.php\?id_members=\d+")):
        tr = a.find_parent("tr")
        cells = [td.get_text(" ", strip=True) for td in tr.find_all("td")] if tr else []
        cells = [c for c in cells if c]
        results.append({
            "ksb_id": re.search(r"id_members=(\d+)", a["href"]).group(1),
            "eik": cells[0] if cells else "",
            "name": cells[1] if len(cells) > 1 else "",
            "protocol": cells[-1] if cells else "",
        })
    return results


def _after(text: str, label: str, stop: str = r"\|") -> str:
    m = re.search(rf"{label}\s*\|?\s*([^|]*)", text)
    return m.group(1).strip() if m else ""


def profile(http: Http, ksb_id: str) -> dict:
    html = http.get(f"{BASE}/pub_view.php", params={"id_members": ksb_id}).text
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style"]):
        tag.decompose()
    text = re.sub(r"\s+", " ", soup.get_text(" | "))
    text = re.sub(r"(\|\s*)+", "| ", text)

    seat = text.split("5. Седалище на строителя", 1)[-1].split("6. Адрес", 1)[0]
    mail = text.split("6. Адрес за кореспонденция", 1)[-1].split("7. Текстова", 1)[0]

    def contact(block: str) -> dict:
        return {
            "city": _after(block, "град\\(село\\):"),
            "street": (_after(block, "улица,/ж.к.,бл.,вх.,ет.,ап./:") + " " +
                       _after(block, "номер:")).strip(" ,"),
            "phone": (_after(block, "тел.код:") + " " + _after(block, "Телефон:")).strip(),
            "email": _after(block, "E-mail:"),
            "website": _after(block, "Уеб сайт:"),
        }

    reps = []
    rep_block = text.split("4. Лице/а/, представляващо/и/ Строителя", 1)[-1].split("5. Седалище", 1)[0]
    for m in re.finditer(r"\| (\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| [^|]+ \| ([^|]+) \|", rep_block):
        reps.append(f"{m.group(2).strip()} {m.group(4).strip()} – {m.group(5).strip()}")

    groups = re.findall(r"\b(\d\.\d) строежи от ([^;|]+?категория)", text)
    about = _after(text, "7. Текстова информация за строителя, ограничена до 10 реда или 600 знака")
    return {
        "ksb_id": ksb_id,
        "ksb_url": f"{BASE}/pub_view.php?id_members={ksb_id}",
        "eik": _after(text, "ЕИК по БУЛСТАТ:"),
        "representatives": reps,
        "seat": contact(seat),
        "office": contact(mail),
        "groups": [f"{g} {c}" for g, c in groups],
        "about": about if not about.startswith("8.") else "",
    }


def find_company(http: Http, company_name: str) -> dict | None:
    """Точно съвпадение по нормализирано име -> профил, иначе None."""
    target = normalize_name(company_name)
    if len(target) < 3:
        return None
    for hit in search(http, name=target):
        if normalize_name(hit["name"]) == target:
            return profile(http, hit["ksb_id"])
    return None
