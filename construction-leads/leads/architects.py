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
    r"(?![а-яА-Яa-zA-Z])\s*[:\-–—]?\s*"
    r"((?:арх\.\s*)?(?:[А-Я]\.\s*)?[„\"«]?[А-ЯA-Z][\wА-Яа-я\-]+(?:[ \t]+[„\"«]?[А-ЯA-Z0-9][\wА-Яа-я\-\"“”»]*){0,3}"
    r"(?:\s+(?:ЕООД|ООД|ЕАД|АД))?)",
)
NAV_JUNK = re.compile(r"English|Начало|Изписване|Search|Вход|Меню|Menu|Home|Контакти|Cookie", re.I)
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
        if NAV_JUNK.search(name):
            continue
        studio = re.match(r"(?i)архитектурн[оа]\s+(?:студио|бюро)", m.group(0))
        if re.fullmatch(r"(арх\.\s*)?[А-ЯA-Z][а-яa-z]+", name) and not name.startswith("арх") and not studio:
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
        # Съкращения: „ИПА“ -> „IPA - Architecture and more“ (само при едно съвпадение)
        if re.fullmatch(r"[A-ZА-Я]{2,5}", name.strip()):
            from .visuals import _loose
            ab = _loose(name)
            hits = [b for bn, b in self.by_name.items() if _loose(bn).startswith(ab)]
            if len(hits) == 1:
                return hits[0]
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


# „Акт 14 – март 2027“, „Акт 16: Q2 2027“, „очакван Акт 14 през 2027 г.“
ACT_HINT = re.compile(
    r"(?i)(?:очакван\w*\s+|предвид\w*\s+|планиран\w*\s+|издаден\w*\s+|получен\w*\s+)?"
    r"акт\s*(?:обр(?:азец|\.)\s*)?(?:№\s*)?(14|15|16)\b[^.;\n]{0,70}")
YEAR = re.compile(r"20(2[4-9]|3[0-2])")
JUNK_HINT = re.compile(r"(?i)разрешения\s*\d|документи|без такса|филт|търсене|сортир")


def stage_hints(text: str) -> list[str]:
    """Изречения за Акт 14/15/16 с година – етапът според самия инвеститор."""
    out = []
    for m in ACT_HINT.finditer(text or ""):
        frag = re.sub(r"\s+", " ", m.group(0)).strip(" ,:-–")
        before = (text[max(0, m.start() - 6):m.start()] or "").lower()
        if re.search(r"(?:^|\s)(?:на|има)\s*$", before):  # „сградата е на Акт 14“
            frag = before.strip().split()[-1] + " " + frag
        if JUNK_HINT.search(frag):
            continue  # менюта и филтри на сайтове за имоти, статистики
        several = len(re.findall(r"(?i)акт\s*1[456]", frag)) > 1
        if YEAR.search(frag) or (not several and re.search(r"(?i)издаден|получен|въведен|^(на|има) акт", frag)):
            out.append(frag[:90])
    return list(dict.fromkeys(out))[:3]
