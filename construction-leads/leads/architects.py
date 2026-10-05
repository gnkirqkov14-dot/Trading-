"""Намиране на архитекта на конкретен обект.

Архитектът не пише в регистъра на разрешенията. Затова:
1. търсим в Google по адреса/местността и по инвеститора;
2. отваряме страниците на проекта (сайт на инвеститора, обяви, статии,
   портфолио на архитекти) и вадим името на архитекта от текста;
3. сверяваме името с регистъра на КАБ (бюра, собственици, служители), а ако
   го няма там – търсим сайта му в Google за телефон и имейл.
"""
from __future__ import annotations

import re

from bs4 import BeautifulSoup

from . import web
from .http import Http
from .ksb import normalize_name

STOP = {"столична", "софия", "главен", "главния", "община", "общината", "камара", "съюз",
        "проект", "проекта", "проектът", "сграда", "сградата", "жилищна", "на", "и", "за",
        "the", "and", "of", "for", "project", "building", "design", "interior", "landscape",
        "ландшафт", "интериор", "конструкция", "конструктор", "част", "вик", "ел", "овк"}

# „Архитект: арх. Иван Петров“, „Архитектурно студио X“, „Проектант: Y ООД“, „Architect: Z“
MENTION = re.compile(
    r"(?i:(?<![а-я])архитект(?:ът|и)?|архитектурн[оа]\s+(?:студио|бюро)|проектант(?:ът|и)?|"
    r"автор(?:и)?\s+на\s+проекта|architects?|architecture\s+by|designed\s+by)"
    r"\s*[:\-–—]?\s*"
    r"((?:арх\.\s*)?(?:[А-Я]\.\s*)?[„\"«]?[А-ЯA-Z][\wА-Яа-я\-]+(?:[ \t]+[„\"«]?[А-ЯA-Z0-9][\wА-Яа-я\-\"“”»]*){0,3}"
    r"(?:\s+(?:ЕООД|ООД|ЕАД|АД))?)",
)
INITIAL_NAME = re.compile(r"арх\.\s*([А-Я])\.\s*([А-Я][а-я]+(?:-[А-Я][а-я]+)?)")


def page_text(http: Http, url: str) -> str:
    resp = http.get(url, timeout=25)
    if "html" not in resp.headers.get("Content-Type", "html"):
        return ""
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "nav", "footer"]):
        tag.decompose()
    return re.sub(r"\s+", " ", soup.get_text(" "))[:40000]


def mentions(text: str) -> list[str]:
    out = []
    for m in MENTION.finditer(text or ""):
        name = m.group(1).strip(" .,„\"«»“”")
        words = [w.strip(".„\"«»“”").lower() for w in name.split()]
        if not words or all(w in STOP or len(w) < 3 for w in words if w != "арх"):
            continue
        if re.fullmatch(r"(арх\.\s*)?[А-ЯA-Z][а-яa-z]+", name) and not name.startswith("арх"):
            continue  # единична дума без „арх.“ – твърде шумно
        out.append(name)
    for m in INITIAL_NAME.finditer(text or ""):
        out.append(f"арх. {m.group(1)}. {m.group(2)}")
    return list(dict.fromkeys(out))


# --------------------------------------------------------------------------
# Сверяване с регистъра на КАБ
# --------------------------------------------------------------------------

def _person_key(full: str) -> tuple[str, str]:
    """'арх. Красимир Пампоров' -> ('к', 'пампоров')"""
    parts = [p for p in re.sub(r"арх\.|инж\.|д-р|проф\.|доц\.", " ", full or "", flags=re.I).split() if p]
    if len(parts) < 2:
        return "", ""
    return parts[0][0].lower(), parts[-1].strip(".,").lower()


class KabIndex:
    def __init__(self, bureaus: list[dict]):
        self.by_name: dict[str, dict] = {}
        self.by_person: dict[tuple, list[dict]] = {}
        for b in bureaus:
            self.by_name[normalize_name(b["name"])] = b
            for person in (b.get("owners") or []) + (b.get("staff") or []):
                self.by_person.setdefault(_person_key(person), []).append(b)

    def find(self, name: str) -> dict | None:
        n = normalize_name(name.replace("арх.", ""))
        if n in self.by_name:
            return self.by_name[n]
        for bname, b in self.by_name.items():
            if len(n) >= 6 and (n in bname or bname in n):
                return b
        key = _person_key(name)
        hits = self.by_person.get(key, [])
        if len({h["name"] for h in hits}) == 1:
            return hits[0]
        return None


# --------------------------------------------------------------------------
# Заявки
# --------------------------------------------------------------------------

def street_of(address: str) -> str:
    m = re.search(r"((?:ул\.|бул\.)\s*[^,№]+?)\s*№\s*([\w\-]+)", address or "")
    return f"{m.group(1).strip()} {m.group(2)}" if m else ""


def address_query(p: dict) -> str:
    street = street_of(p.get("address", ""))
    if street:
        return f'"{street}" София жилищна сграда'
    loc = re.sub(r'["“”„]', "", p.get("locality", "")).strip().title()
    return f'{loc} София ново строителство {p.get("building_type", "").split("–")[0].strip().lower()}'.strip()


def name_query(name: str) -> str:
    return f'"{name.replace("арх. ", "")}" архитект София'
