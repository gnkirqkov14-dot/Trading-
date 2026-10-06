"""Проектни страници на инвеститора, архитекта и строителя – с доказателства за обекта.

Без платена търсачка. Откъде тръгваме:
  - вече кешираните търсения за обекта (адрес, инвеститор, проект);
  - официалните сайтове на фирмите: Търговски регистър (сайт/имейл), КАБ, КСБ, проверен домейн;
  - страниците, вече закачени към обекта (за повторна проверка);
и следваме връзките: карта на сайта (sitemap), менюта, PDF документи (договори, брошури), новини,
линкове към сайтовете на другите участници.

Страница „е за обекта“ само при конкретно доказателство:
  силно      – номер на разрешението, кадастрален идентификатор, УПИ + квартал + местност,
               точен адрес (улица и номер);
  по проект  – точното име на проекта, установено от страница със силно доказателство, заедно
               с името (или ЕИК) на инвеститора;
Квартал, търговско име или близка РЗП сами не стигат. Страница с идентификатори на ДРУГИ обекти
от базата (класации, списъци с проекти) не доказва роли – освен ако ролята е до нашия идентификатор.

Всеки факт пази: източник (линк), откъс, дата на публикация (само ако е посочена на страницата)
и дата на проверка.
"""
from __future__ import annotations

import hashlib
import json
import re
import subprocess
import tempfile
from datetime import date
from pathlib import Path
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

from bs4 import BeautifulSoup

from . import web
from .http import Http
from .ksb import normalize_name
from .runlog import RunLog, now

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "cache"
VERSION = 1

FREE_MAIL = {"gmail.com", "abv.bg", "mail.bg", "yahoo.com", "hotmail.com", "outlook.com", "dir.bg", "icloud.com"}
GENERIC_NAME = re.compile(r"(?i)^(начало|home|проекти|projects|новини|news|контакти|contacts|за нас|about|"
                          r"жилищн\w* сград\w*|ново строителство|апартаменти|продажби|галерия|gallery|"
                          r"предварителен договор|чертежи|паркинг|документи)$")
LEGAL = r"(?:ЕООД|ООД|ЕАД|АД|ЕТ|EOOD|OOD|EAD|AD|Ltd\.?)"
# Име на фирма/бюро след роля: „Изпълнител: Елит Строителна Компания ЕООД“, „Архитект: ИПА ЕООД“
NAME = (rf"(?P<name>[„\"«]?[A-ZА-Я0-9][\w\-&.]*[”\"»“]?(?:[ \t]+[„\"«]?[A-ZА-Я0-9&][\w\-&.]*[”\"»“]?){{0,4}}"
        rf"(?:[ \t,]+{LEGAL})?)")
ROLE_RX = {
    "архитект": re.compile(
        r"(?:(?<!\w)(?i:архитект(?:ура)?|архитектурно студио|архитектурно бюро|проектант|architects?|"
        r"architecture by|designed by)(?!\w)[ \t]*[:\-–—]?[ \t]*\n?[ \t]*|(?i:проектът е дело на|the work of)\s+@?)" + NAME),
    "строител": re.compile(
        r"(?:(?<!\w)(?i:главен изпълнител|генерален изпълнител|изпълнител|строител|general contractor|"
        r"contractor|built by)(?!\w)[ \t]*[:\-–—]?[ \t]*\n?[ \t]*)" + NAME),
}
NAME_STOP = re.compile(r"(?i)^(на|и|е|за|от|с|the|a|of|for|and|на проекта|проекта|сградата|обекта|"
                       r"контакти|статус|локация|категория|рзп|инвеститор|продавач|купувач|индекс|чертеж|"
                       r"наименование|мащаб|фаза|дата|подпис|проект|специалност|ръководител|възложител|"
                       r"част|архитектура|конструкции|конструктор|технически|работен|идеен)$")
EVENT_RX = [
    ("договор за главен изпълнител", re.compile(r"(?i)general contractor|главен изпълнител|генерален изпълнител")),
    ("излети основи", re.compile(r"(?i)foundation\w*\s+(?:\w+\s+){0,3}(?:laid|poured)|излети\s+основи|"
                                 r"основите\s+(?:\w+\s+){0,3}(?:са\s+)?излети")),
    ("първа копка / старт на строителството", re.compile(r"(?i)първа копка|стартира строителството|"
                                                          r"започна строителството|construction (?:has )?started")),
    ("груб строеж", re.compile(r"(?i)завърш\w+ груб строеж|груб строеж\s+(?:е\s+)?завършен|акт\s*14")),
    ("въведена в експлоатация", re.compile(r"(?i)акт\s*16|въведен\w* в експлоатация")),
]
# Копия на регистъра на НАГ: доказват разрешението, но не дават име на проект, роли или събития
REGISTER_MIRRORS = {"akt16.bg", "akt16.org", "govalert.eu", "m.govalert.eu", "nag.sofia.bg", "sofia.bg", "inspectorat-so.org"}


def is_mirror(url: str, title: str = "") -> bool:
    d = web.domain_of(url)
    return any(d == m or d.endswith("." + m) for m in REGISTER_MIRRORS) or \
        bool(re.match(r"(?i)\s*разрешение за строеж", title or ""))


PROJECT_URL_WORDS = re.compile(r"(?i)proekt|project|obekt|object|sgrad|resid|complex|kompleks|park|tower|"
                               r"home|living|zhilish|novini|news|stroitel|construction|gallery|galeria")
DOC_WORDS = re.compile(r"(?i)dogovor|договор|broshur|brochure|razreshenie|разрешение|spec|описание|akt|акт|"
                       r"\.pdf$")


# ---------------------------------------------------------------------------
# Изтегляне (с кеш, robots.txt и дневник на неуспехите)
# ---------------------------------------------------------------------------

class Fetcher:
    def __init__(self, log: RunLog, http: Http | None = None, cache: Path = CACHE / "web"):
        self.http = http or Http(delay=0.8, retries=1, timeout=20)
        self.log = log
        self.cache = cache
        self.robots: dict[str, RobotFileParser | None] = {}
        self.fetched_now = 0

    def _path(self, url: str) -> Path:
        return self.cache / (hashlib.sha1(url.encode()).hexdigest()[:16] + ".json")

    def allowed(self, url: str) -> bool:
        host = urlparse(url).netloc
        if host not in self.robots:
            rp = RobotFileParser()
            try:
                resp = self.http.get(f"{urlparse(url).scheme}://{host}/robots.txt", timeout=10)
                rp.parse(resp.text.splitlines())
            except Exception:
                rp = None  # няма robots.txt – разрешено
            self.robots[host] = rp
        rp = self.robots[host]
        return rp is None or rp.can_fetch("*", url)

    def get(self, url: str) -> dict | None:
        path = self._path(url)
        if path.exists():
            data = json.loads(path.read_text(encoding="utf-8"))
            return None if data.get("missing") else data
        if not self.allowed(url):
            self.log.log(f"  robots.txt забранява {url}")
            return None
        try:
            resp = self.http.get(url, timeout=25)
        except Exception as exc:
            if re.match(r"(404|410)\b", str(exc)):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps({"url": url, "missing": True}), encoding="utf-8")
                return None  # страницата я няма – не е временен неуспех
            self.log.failure("web", url, exc, url)  # не се кешира – при ново пускане се опитва пак
            return None
        if not re.search(r"charset", resp.headers.get("Content-Type", ""), re.I):
            resp.encoding = resp.apparent_encoding
        self.log.success("web", url)
        self.fetched_now += 1
        ctype = resp.headers.get("Content-Type", "")
        page = {"url": url, "final_url": resp.url, "fetched": now(), "type": "html", "title": "", "h1": "",
                "text": "", "links": [], "published": "", "published_how": ""}
        if "pdf" in ctype or url.lower().split("?")[0].endswith(".pdf"):
            page.update(type="pdf", text=pdf_text(resp.content))
        elif "xml" in ctype or url.lower().split("?")[0].endswith(".xml"):
            page.update(type="xml", text=resp.text[:2_000_000])  # карта на сайта – целият списък с адреси
        elif "html" in ctype or not ctype:
            page.update(parse_html(resp.text, resp.url))
        path.parent.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(".part")
        tmp.write_text(json.dumps(page, ensure_ascii=False), encoding="utf-8")
        tmp.replace(path)
        return page


def pdf_text(data: bytes) -> str:
    if not data.startswith(b"%PDF") or len(data) > 20_000_000:
        return ""
    with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
        f.write(data)
        f.flush()
        try:
            out = subprocess.run(["pdftotext", "-l", "12", f.name, "-"], capture_output=True, timeout=60)
        except Exception:
            return ""
    return re.sub(r"[ \t]+", " ", out.stdout.decode("utf-8", "ignore"))[:60000]


def published_date(soup: BeautifulSoup, text: str) -> tuple[str, str]:
    """Дата на публикация, само ако страницата я посочва. Иначе ("", "")."""
    for attr, key in (("property", "article:published_time"), ("itemprop", "datePublished"),
                      ("name", "date"), ("name", "pubdate")):
        tag = soup.find("meta", attrs={attr: key})
        if tag and re.match(r"\d{4}-\d{2}-\d{2}", tag.get("content", "")):
            return tag["content"][:10], f"мета-данни ({key})"
    for script in soup.find_all("script", type="application/ld+json"):
        m = re.search(r'"datePublished"\s*:\s*"(\d{4}-\d{2}-\d{2})', script.string or "")
        if m:
            return m.group(1), "мета-данни (datePublished)"
    t = soup.find("time", attrs={"datetime": re.compile(r"^\d{4}-\d{2}-\d{2}")})
    if t:
        return t["datetime"][:10], "елемент <time> на страницата"
    # Видима дата до заглавието на новина: „News 28-04-2025 …“
    m = re.search(r"(?<!\d)(\d{1,2})[.\-/](\d{1,2})[.\-/](20\d\d)(?!\d)", text[:600])
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= d <= 31 and 1 <= mo <= 12:
            return f"{y:04d}-{mo:02d}-{d:02d}", "дата, изписана в началото на страницата"
    return "", ""


def parse_html(html: str, base: str) -> dict:
    soup = BeautifulSoup(html, "html.parser")
    links = []
    for a in soup.find_all("a", href=True):
        href = urljoin(base, a["href"].strip())
        if not href.startswith(("http://", "https://", "mailto:", "tel:")):
            continue
        parent = ""
        ul = a.find_parent("ul")
        li = ul.find_parent("li") if ul else None
        if li:  # подменю: „Vabul ONE → Предварителен договор“
            first = li.find("a")
            if first is not None and first is not a:
                parent = first.get_text(" ", strip=True)
        links.append([href, a.get_text(" ", strip=True)[:120], parent[:80]])
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    h1 = soup.find("h1")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    text = re.sub(r"\s+", " ", soup.get_text(" "))
    pub, how = published_date(soup, text)
    return {"title": title[:200], "h1": (h1.get_text(" ", strip=True) if h1 else "")[:200],
            "text": text[:60000], "links": links[:600], "published": pub, "published_how": how}


# ---------------------------------------------------------------------------
# Идентификатори на обекта
# ---------------------------------------------------------------------------

def _permit_rx(number: str) -> re.Pattern | None:
    m = re.match(r"\s*(\d+)\s*/\s*(\d{1,2})\.(\d{1,2})\.(\d{4})", number or "")
    if not m:
        return None
    n, d, mo, y = m.group(1), int(m.group(2)), int(m.group(3)), m.group(4)
    date_rx = rf"0?{d}\s*\.\s*0?{mo}\s*\.\s*(?:{y}|{y[2:]})(?!\d)"
    return re.compile(rf"(?<![\d/]){n}\s*(?:/|от)\s*{date_rx}")


def kkkr_ids(p: dict) -> list[str]:
    return list(dict.fromkeys(re.findall(r"\d{5}\.\d{1,5}\.\d{1,5}", p.get("kkkr") or "")))


def _kkkr_rx(ident: str) -> re.Pattern:
    # 68134.4090.1616 и 68134.4090.1616.6.14 (сграда в същия имот), но не 68134.4090.16160
    return re.compile(rf"(?<![\d.]){re.escape(ident)}(?!\d)")


def _street(p: dict) -> tuple[str, str] | None:
    m = re.search(r"(?:ул\.|бул\.)\s*[„\"]?([^,№„\"“”]+?)[“”\"]?\s*№\s*(\d+[а-яА-Я]?)", p.get("address") or "")
    return (m.group(1).strip(), m.group(2)) if m else None


def _upi(p: dict) -> tuple[str, str, str] | None:
    """(римско, номер, квартал) от „VI-1407-за ЖС“ и „Квартал по регулация: 44“."""
    m = re.match(r"\s*([IVXLC]+)\s*[-–]\s*(\d+)", p.get("upi") or "")
    k = re.search(r"Квартал по регулация:\s*([\w\-]+)", p.get("scope") or "")
    return (m.group(1), m.group(2), k.group(1)) if m and k else None


PLACE_STOP = {"софия", "жк", "ж.к.", "м.", "кв.", "местност", "район", "част", "части", "разширение", "нпз", "жг",
              "зона", "град", "гр.", "жилищни", "жилищна", "територии", "център", "север", "юг", "запад"}
# Квартали и райони на София – за откриване на страница за проект на същата фирма другаде
SOFIA_PLACES = set("""
младост люлин дружба надежда овча купел лозенец изгрев изток гео милев слатина подуяне сердика оборище средец
триадица възраждане илинден красна поляна красно село витоша бояна драгалевци симеоново панчарево банкя
кремиковци нови искър връбница студентски манастирски ливади хаджи димитър левски сухата река стрелбище
хиподрума борово гоце делчев белите брези лагера павлово княжево горна баня бъкстон мусагеница дианабад
редута яворов захарна фабрика обеля сеславци ботунец враждебна орландовци малинова долина кръстова вада
карпузица филиповци суходол модерно предградие бенковски гевгелийски разсадника коньовица света троица
""".split())
COMMON_NAME_WORDS = {"парк", "резиденс", "резидънс", "хоум", "хоумс", "тауър", "сити", "плаза", "гардън", "вю",
                     "хилс", "ривър", "лайф", "премиум", "нова", "нов", "нови", "център", "жилищен", "комплекс"}
OTHER_SECTION = re.compile(r"(?i)други проекти|още проекти|подобни проекти|свързани проекти|other projects|"
                           r"related projects|similar projects|next post|предишен проект|следващ проект|"
                           r"още от категорията|прочетете още|виж още")


def main_text(text: str) -> str:
    """Текстът до раздела „Други проекти“ – долните списъци с други обекти не се броят."""
    m = OTHER_SECTION.search(text or "", 300)
    return text[:m.start()] if m else (text or "")


def locality_words(p: dict) -> list[str]:
    words = re.findall(r"[а-яa-z0-9]{4,}", (p.get("locality") or "").lower())
    return [w for w in words if w not in PLACE_STOP]


def strong_ids(p: dict) -> list[tuple[str, re.Pattern]]:
    out = []
    for num in [p.get("number")] + [o.get("number") for o in p.get("other_permits") or []]:
        rx = _permit_rx(num or "")
        if rx:
            out.append((f"разрешение № {num}", rx))
    for k in kkkr_ids(p):
        out.append((f"кадастрален имот {k}", _kkkr_rx(k)))
    s = _street(p)
    if s:
        street, no = s
        out.append((f"адрес {street} № {no}", re.compile(
            rf"(?i){re.escape(street.split()[-1])}[„\"“”]?\s*(?:№|No\.?|N)?\s*{no}(?!\d)")))
    return out


def investor_names(p: dict) -> list[str]:
    return [n for n in (normalize_name(c) for c in p.get("investor_companies", [])) if len(n) >= 4]


def assess(page: dict, p: dict, other_index: dict[str, set[str]] | None = None) -> dict:
    """Какво доказва страницата за обекта p. other_index: идентификатор -> хешове на обекти в базата."""
    text = page.get("text") or ""
    low = text.lower()
    strong = []
    for label, rx in strong_ids(p):
        m = rx.search(text)
        if m:
            strong.append({"what": label, "pos": m.start(), "snippet": snippet(text, m.start(), m.end())})
    upi = _upi(p)
    if upi:
        roman, num, kv = upi
        m = re.search(rf"(?<![A-Z]){roman}\s*[-–]\s*{num}(?!\d)", text)
        if m and re.search(rf"(?i)(?:кв\.|квартал)\s*{re.escape(kv)}(?![\w])", text) and \
                any(w in low for w in locality_words(p)):
            strong.append({"what": f"УПИ {roman}-{num}, кв. {kv}, {p.get('locality')}", "pos": m.start(),
                           "snippet": snippet(text, m.start(), m.end())})
    names = []
    for n in investor_names(p):
        if n not in normalize_name(text):
            continue
        if all(w in SOFIA_PLACES or w in COMMON_NAME_WORDS for w in n.split()):
            # „Парк Надежда“ АД ≠ парк „Надежда“: при име от общи думи – само с правната форма до него
            words = r"[\s„\"“”«»]*".join(map(re.escape, n.split()))
            if not re.search(rf"(?i){words}[\s„\"“”«»]*,?\s*(?:ЕООД|ООД|ЕАД|АД)(?![\wа-я])", text):
                continue
        names.append(n)
    eiks = [c.get("eik") for c in p.get("contacts", []) if c.get("role", "").startswith("Инвеститор")
            and c.get("eik") and c["eik"] in text]
    others = set()
    for ident in re.findall(r"(?<![\d.])\d{5}\.\d{1,5}\.\d{1,5}(?!\d)", text):
        others |= (other_index or {}).get(ident, set()) - {p["hash"]}
    PLACE_WORDS = SOFIA_PLACES
    ours = set(locality_words(p)) | set(re.findall(r"[а-я]{4,}", (p.get("region") or "").lower())) | \
        {w for n in investor_names(p) for w in n.split()} | {"софия", "sofia"}
    main_low = main_text(text).lower()
    other_places = sorted(w for w in PLACE_WORDS if len(w) >= 5 and w not in ours
                          and not any(w in o or o in w for o in ours)
                          and re.search(rf"(?:кв\.|ж\.?\s?к\.?|район|квартал|м\.|местност|(?<![а-я])в)\s*[„\"“]?{w}", main_low))
    m = re.search(r"(?i)адрес\s*:?\s*((?:ул\.|бул\.)\s*[„\"]?[^,\n]{3,40}?\s*№?\s*\d+)", text)
    stated_address = m.group(1).strip() if m else ""
    rzp = [float(re.sub(r"[\s ]", "", x).replace(",", ".")) for x in re.findall(
        r"(?i)(?:РЗП|разгъната застроена площ)[^0-9]{0,30}(\d{1,3}(?:[\s ]\d{3})+|\d{3,6})(?:[.,]\d+)?", main_text(text))]
    own_rzp = [x for x in (p.get("rzp"), p.get("rzp_with_basement")) if x]
    rzp_match = [x for x in rzp if any(abs(x - o) / o <= 0.03 for o in own_rzp)]
    return {"strong": strong, "investor": names + eiks, "locality": [w for w in locality_words(p) if w in low],
            "stated_address": stated_address, "rzp_match": rzp_match,
            "main_locality": [w for w in locality_words(p) if w in main_low],
            "other_objects": sorted(others), "other_places": other_places}


def snippet(text: str, start: int, end: int, pad: int = 140) -> str:
    return ("…" if start > pad else "") + text[max(0, start - pad):end + pad].strip() + "…"


# ---------------------------------------------------------------------------
# Име на проекта и роли
# ---------------------------------------------------------------------------

def clean_project_name(s: str, investor: list[str]) -> str:
    s = re.split(r"\s+[|–—]\s+|\s+-\s+", s or "")[0].strip(" „\"“”")
    if not s or len(s) < 4 or len(s) > 60 or GENERIC_NAME.match(s) or normalize_name(s) in investor:
        return ""
    return s


def name_in(text: str, name: str) -> re.Match | None:
    """Точно име на проекта като цяла фраза: „Vabul ONE“ не съвпада с „Vabul Residence“."""
    return re.search(rf"(?i)(?<![\w]){re.escape(name)}(?![\w])", text or "")


def roles_in(text: str, near: int | None = None, window: int = 1500) -> list[dict]:
    """Изрични роли в текста; ако near е зададено – само в близост до идентификатора на обекта."""
    out = []
    for role, rx in ROLE_RX.items():
        for m in rx.finditer(text or ""):
            if near is not None and abs(m.start() - near) > window:
                continue
            name = re.sub(r"\s+", " ", m.group("name")).strip(" .,;:„\"“”«»")
            name = re.split(r"(?<=[А-ЯA-Zа-яa-z]{3})\.\s+", name)[0].strip(" .,")
            cut = re.search(rf"[\s,]+{LEGAL}(?![\w])", name)
            if cut:
                name = name[:cut.end()].strip(" ,")
            name = re.split(r"(?i)\s+(?:Конструктор|Инвеститор|Статус|Локация|Категория|РЗП|За проекта|"
                            r"Изпълнител|Архитект|located|is|which|that|за|е|в|на|от|с|и)(?![\wа-я])", name)[0].strip(" .,")
            first = name.split()[0].strip(".,;:") if name.split() else ""
            if not name or NAME_STOP.match(name) or NAME_STOP.match(first) or len(name) < 3 \
                    or not re.search(r"[A-Za-zА-Яа-я]{3}", name):
                continue
            out.append({"role": role, "name": name, "pos": m.start(),
                        "snippet": snippet(text, m.start(), m.end(), 100)})
    return out


def events_in(page: dict) -> list[dict]:
    if not page.get("published"):
        return []  # без дата – историческото събитие няма как да се датира; не измисляме
    out = []
    head = (page.get("title", "") + " " + page.get("h1", "") + " " + (page.get("text") or "")[:1500])
    for what, rx in EVENT_RX:
        m = rx.search(head)
        if m:
            out.append({"what": what, "date": page["published"], "date_how": page.get("published_how", ""),
                        "url": page["url"], "snippet": snippet(head, m.start(), m.end(), 100)})
    return out


# ---------------------------------------------------------------------------
# Фирми: ЕИК, официален сайт, контакти
# ---------------------------------------------------------------------------

def tr_cached(eik: str) -> dict | None:
    path = CACHE / "tr_eik" / (hashlib.sha1(eik.encode()).hexdigest()[:16] + ".json")
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else None


class Registry:
    """Фирми по име -> ЕИК (Търговски регистър, точно и единствено съвпадение) и бюра в КАБ."""

    def __init__(self, kab_rows: list[dict], log: RunLog):
        from .architects import KabIndex
        self.kab = KabIndex(kab_rows)
        self.kab_by_domain = {web.domain_of(b["website"] if b["website"].startswith("http") else "https://" + b["website"]): b
                              for b in kab_rows if b.get("website")}
        self.http = Http(delay=6.0)
        self.log = log

    def _cached(self, kind: str, key: str, fetch):
        path = CACHE / kind / (hashlib.sha1(key.encode()).hexdigest()[:16] + ".json")
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
        try:
            value = fetch()
            self.log.success(kind, key)
        except Exception as exc:
            self.log.failure(kind, key, exc)
            return None
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
        return value

    def tr_record(self, eik: str) -> dict | None:
        from . import tr
        rec = self._cached("tr_eik", eik, lambda: tr.deed(self.http, eik))
        return rec if rec and rec.get("tr_name") else None

    def resolve(self, name: str, role: str = "", domains: set[str] | None = None) -> dict:
        """{'eik', 'tr', 'kab', 'how'}. ЕИК само при едно точно съвпадение по име (и правна форма).
        Съкратено име („ИПА Архитекти“ -> „ИПА“) се приема само ако имейлът/сайтът във вписването в
        Търговския регистър е на домейн, свързан с участника (domains)."""
        from difflib import SequenceMatcher
        from . import tr
        out = {"eik": "", "tr": None, "kab": None, "how": ""}
        if role == "архитект":
            b = self.kab.find(name)
            if b and (name.startswith("арх") or SequenceMatcher(
                    None, normalize_name(b["name"]), normalize_name(name)).ratio() >= 0.8):
                out["kab"] = b
        form = tr._legal_form(name)
        target = normalize_name(name)
        words = target.split()
        tries = [target] + [" ".join(words[:k]) for k in range(len(words) - 1, 0, -1)
                            if all(w in GENERIC_TAIL for w in re.split(r"[\s\-]+", " ".join(words[k:])) if w)]
        m = re.match(r"([A-Z]{2,5})\b", name.strip())
        if m:  # „IPA - Architecture and more“ -> „ипа“ (приема се само с проверка по домейна)
            tries.append(m.group(1).translate(LAT2CYR).lower())
        for i, t in enumerate(tries):
            if len(t) < 2:
                continue
            hits = self._cached("tr_search", t, lambda: tr.search(self.http, t)) or []
            exact = [h for h in hits if not h.get("isPhysical") and normalize_name(h.get("name", "")) == t
                     and (not form or tr._legal_form(h.get("companyFullName", "")) == form)]
            if len(exact) > 1:
                out["how"] = f"{len(exact)} фирми с име „{t}“ в Търговския регистър – не се избира"
                return out
            if len(exact) == 1:
                rec = self.tr_record(exact[0]["ident"])
                if i == 0:
                    own = set(official_domains({"tr": rec}))
                    if form or own & (domains or set()):
                        out.update(eik=exact[0]["ident"], tr=rec,
                                   how="единствено точно съвпадение по име" + (" и правна форма" if form else "")
                                       + " в Търговския регистър")
                    else:  # без правна форма и без сайт за сверка – вероятно, но не сигурно
                        out.update(eik=exact[0]["ident"], tr=rec, uncertain=True,
                                   how="единствено съвпадение по име в Търговския регистър, но източникът не посочва "
                                       "правна форма или ЕИК – ЕИК за проверка")
                    return out
                own = set(official_domains({"tr": rec}))
                if own & (domains or set()):
                    out.update(eik=exact[0]["ident"], tr=rec,
                               how=f"„{t}“ в Търговския регистър; имейлът/сайтът там е на {sorted(own & domains)[0]}")
                    return out
                out["how"] = f"„{t}“ има в Търговския регистър, но домейнът не се потвърждава"
                return out
        out["how"] = out["how"] or "няма съвпадение по име в Търговския регистър"
        return out


LAT2CYR = str.maketrans("ABCDEFGHIJKLMNOPRSTUVZY", "АБЦДЕФГХИЙКЛМНОПРСТУВЗЙ")
GENERIC_TAIL = {"архитекти", "architects", "architecture", "студио", "studio", "бюро", "архитектурно", "and", "more",
                "строителна", "компания", "group", "груп"}


def official_domains(entity: dict) -> dict[str, str]:
    """{домейн: основание} – само от регистрите (не от търсачка)."""
    out = {}
    rec = entity.get("tr") or {}
    if rec.get("website"):
        out[web.domain_of(rec["website"] if rec["website"].startswith("http") else "https://" + rec["website"])] = \
            "сайтът е вписан в Търговския регистър"
    if rec.get("email") and rec["email"].split("@")[-1].lower() not in FREE_MAIL:
        out.setdefault(rec["email"].split("@")[-1].lower(), "имейлът в Търговския регистър е на този домейн")
    kab = entity.get("kab") or {}
    where = "регистъра на КАБ" if kab.get("kab_url") else "профила на бюрото в Google Maps"
    if kab.get("website"):
        w = kab["website"] if kab["website"].startswith("http") else "https://" + kab["website"]
        out.setdefault(web.domain_of(w), f"сайтът е посочен в {where}")
    for e in kab.get("emails") or []:
        d = e.split("@")[-1].lower()
        if d not in FREE_MAIL:
            out.setdefault(d, f"имейлът в {where} е на този домейн")
    return out


def fake_phone(phone: str) -> bool:
    """Примерни номера от формите: +359123456789, +359012345678, 0000000, 8888888."""
    d = re.sub(r"\D", "", phone)[3:]
    return bool(re.search(r"(\d)\1{5}", d) or d.lstrip("0").startswith("12345") or "345678" in d)


def contacts_from(page: dict, own_domain: str) -> dict:
    """Телефони и имейли от страница на собствения домейн. Имейл на чужд домейн не се взима."""
    phones, emails, foreign = [], [], []
    for href, _, _ in page.get("links") or []:
        if href.startswith("tel:"):
            phones.append(href[4:])
        elif href.startswith("mailto:"):
            emails.append(href[7:].split("?")[0])
    text = page.get("text") or ""
    for m in web.PHONE_RX.finditer(text):
        before, after = text[max(0, m.start() - 25):m.start()], text[m.end():m.end() + 6]
        labelled = re.search(r"(?i)тел|phone|gsm|моб|mob|факс|fax|\bт\.|\bt\.|звънн|обадет", before)
        if (m.group(0).lstrip().startswith(("+359", "00359")) or labelled) and \
                not re.match(r"\s*(?:€|лв|евро|eur|bgn|м2|м²|кв)", after, re.I):
            phones.append(m.group(0))  # цени и площи не са телефони
    emails += web.EMAIL_RX.findall(text)
    ph = list(dict.fromkeys(x for x in map(web._clean_phone, phones)
                            if x and not fake_phone(x) and not x.startswith("+3590")))
    em = []
    for e in dict.fromkeys(e.strip(".").lower() for e in emails if not web.BAD_EMAIL.search(e)):
        d = e.split("@")[-1]
        if d == own_domain or d.endswith("." + own_domain) or own_domain.endswith("." + d) or d in FREE_MAIL:
            em.append(e)
        else:
            foreign.append(e)
    return {"phones": ph[:4], "emails": em[:4], "foreign_emails": foreign[:4]}


def domain_matches_name(domain: str, company: str) -> bool:
    """capitol.bg ↔ „КАПИТОЛ БИЛД“; vabul.com ↔ „ВА БУЛ СЪРВИЗ“ (слети първи думи); поне 5 букви."""
    def loose(x: str) -> str:
        return x.replace("k", "c").replace("w", "v")
    label = loose(re.sub(r"[^a-z0-9]", "", domain.split(".")[-2] if domain.count(".") >= 1 else domain))
    if len(label) < 5 or web.is_directory("https://" + domain):
        return False
    words = [loose(re.sub(r"[^a-z0-9]", "", web.translit(w))) for w in normalize_name(company).split()]
    words = [w for w in words if w]
    joined = "".join(words)
    generic = {"invest", "group", "grup", "build", "bild", "stroy", "consult", "konsult", "bulgaria", "property",
               "properties", "propartiz", "estate", "development", "holding", "homes"}
    if any(len(w) >= 5 and w not in generic and w in label for w in words):
        return True
    return len(joined) >= 5 and (label.startswith(joined[:max(5, len(label) - 2)]) and joined.startswith(label[:5]))


def site_owner_ok(page: dict, entity_name: str, eik: str) -> bool:
    """Сайтът е на фирмата: името (без правната форма) или ЕИК се срещат на страницата/в заглавието."""
    n = normalize_name(entity_name)
    hay = normalize_name((page.get("title") or "") + " " + (page.get("text") or ""))
    toks = [t for t in n.split() if len(t) >= 3]
    lat = web.translit(n).replace(" ", "")
    return bool((eik and eik in (page.get("text") or "")) or (n and n in hay) or
                (lat and len(lat) >= 4 and lat in re.sub(r"[^a-z]", "", (page.get("title") or "").lower())) or
                (len(toks) >= 2 and all(t in hay for t in toks)))


# ---------------------------------------------------------------------------
# Обхождане за един обект
# ---------------------------------------------------------------------------

def seed_urls(p: dict, queries: list[str]) -> list[str]:
    out = []
    for q in queries:
        path = CACHE / "google" / (hashlib.sha1(q.encode()).hexdigest()[:16] + ".json")
        if not path.exists():
            continue
        for r in json.loads(path.read_text(encoding="utf-8")) or []:
            u = r.get("url") or ""
            if u and not web.is_directory(u) and not web.domain_of(u).endswith(("facebook.com", "instagram.com")):
                out.append(u)
    for a in p.get("architects") or []:
        u = (a.get("evidence") or {}).get("url")
        if u:
            out.append(u)
    return list(dict.fromkeys(out))


def sitemap_urls(f: Fetcher, domain: str, limit: int = 400) -> list[str]:
    urls = []
    for path in ("/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"):
        page = f.get(f"https://{domain}{path}")
        if not page:
            continue
        locs = re.findall(r"https?://[^\s<>\"]+", page.get("text") or "")
        for loc in locs:
            if loc.endswith(".xml") and len(urls) < limit:
                sub = f.get(loc)
                urls += re.findall(r"https?://[^\s<>\"]+", (sub or {}).get("text") or "")
            else:
                urls.append(loc)
        if urls:
            break
    return [u for u in dict.fromkeys(urls) if web.domain_of(u) == domain and not
            re.search(r"(?i)\.(xml|jpe?g|png|gif|webp|svg|mp4)(\?|$)", u)][:limit]


def url_score(url: str, anchor: str, words: list[str]) -> int:
    hay = web.translit(url + " " + anchor)
    return (3 * sum(1 for w in words if w and w in hay) + (2 if PROJECT_URL_WORDS.search(hay) else 0)
            + (2 if DOC_WORDS.search(url) else 0))


def crawl_domain(f: Fetcher, domain: str, words: list[str], max_pages: int = 20) -> list[dict]:
    """Начална страница + карта на сайта; първо адресите с думи на обекта/проекта и документите."""
    home = f.get(f"https://{domain}/") or f.get(f"https://www.{domain}/")
    pages = [home] if home else []
    cands = {u: url_score(u, "", words) for u in sitemap_urls(f, domain)}
    for href, anchor, parent in (home or {}).get("links", []):
        if web.domain_of(href) == domain:
            cands[href] = max(cands.get(href, 0), url_score(href, anchor + " " + parent, words))
    for u, sc in sorted(cands.items(), key=lambda x: -x[1])[:max_pages]:
        if sc <= 0:
            break
        pg = f.get(u)
        if pg:
            pages.append(pg)
    return pages


def linked_docs(page: dict, words: list[str], limit: int = 6) -> list[tuple[str, str, str]]:
    """PDF/документи и новини, свързани от страницата: (линк, текст на връзката, родител в менюто)."""
    out = []
    for href, anchor, parent in page.get("links") or []:
        if href.lower().split("?")[0].endswith(".pdf") and (DOC_WORDS.search(href + " " + anchor)
                                                          or any(w in web.translit(href) for w in words)):
            out.append((href, anchor, parent))
    return out[:limit]


def investigate(p: dict, f: Fetcher, reg: Registry, queries: list[str], other_index: dict,
                checked: str, extra_seeds: list[str] | None = None) -> dict:
    """Всичко намерено за обекта – с доказателства. Нищо не се записва в самия обект тук."""
    inv_names = investor_names(p)
    words = [web.translit(w) for w in locality_words(p)]
    res = {"version": VERSION, "hash": p["hash"], "checked": checked, "project_names": [], "pages": [],
           "links": [], "contacts": [], "events": [], "rejected": [], "candidates": [], "sites": {}}

    # 1) Официален сайт на инвеститора – само от регистрите или проверен по име/ЕИК
    inv_contact = next((c for c in p.get("contacts", []) if c.get("role", "").startswith("Инвеститор")), {})
    inv_eik = inv_contact.get("eik", "")
    inv_entity = {"tr": reg.tr_record(inv_eik) if inv_eik else None, "kab": None}
    domains = official_domains(inv_entity)
    stored = inv_contact.get("website") or ""
    if stored and web.domain_of(stored) not in domains:
        domains[web.domain_of(stored)] = "записан досега като сайт на инвеститора (за проверка)"
    inv_name = inv_contact.get("name", "")
    for u in seed_urls(p, queries):
        d = web.domain_of(u)
        if d in domains or not domain_matches_name(d, inv_name):
            continue
        home = f.get(f"https://{d}/")
        if home and site_owner_ok(home, inv_name, inv_eik):
            domains[d] = "домейнът съдържа името на инвеститора и сайтът го посочва"
    # Линк от страница, която посочва инвеститора, към домейн с неговото име (ip-arch.com -> vabul.com)
    for u in seed_urls(p, queries)[:15]:
        pg = f.get(u)
        if not pg or not assess(pg, p)["investor"]:
            continue
        for href, _, _ in pg.get("links") or []:
            d = web.domain_of(href)
            if href.startswith("http") and d not in domains and domain_matches_name(d, inv_name):
                domains[d] = f"към сайта води {web.domain_of(u)}, която посочва инвеститора; домейнът съвпада с името"
    res["sites"]["инвеститор"] = domains

    # 2) Страници: семена + сайтът на инвеститора + документите от тях
    pages: dict[str, dict] = {}
    for u in seed_urls(p, queries)[:15] + list(extra_seeds or []):
        pg = f.get(u)
        if pg:
            pages[u] = pg
    for d in domains:
        for pg in crawl_domain(f, d, words + [web.translit(n) for n in inv_names]):
            pages[pg["url"]] = pg

    def evaluate(pg: dict) -> dict:
        a = assess(pg, p, other_index)
        return {"url": pg["url"], "title": pg.get("title", ""), "type": pg.get("type"), **a,
                "published": pg.get("published", ""), "published_how": pg.get("published_how", "")}

    evals = {u: evaluate(pg) for u, pg in pages.items()}
    # документи, свързани от страници на сайта на инвеститора или от потвърдени страници
    for u, pg in list(pages.items()):
        if web.domain_of(u) in domains or evals[u]["strong"]:
            for href, anchor, parent in linked_docs(pg, words):
                if href not in pages:
                    doc = f.get(href)
                    if doc:
                        doc["anchor"], doc["menu_parent"], doc["linked_from"] = anchor, parent, u
                        pages[href] = doc
                        evals[href] = evaluate(doc)

    # Сайт на инвеститора е потвърден, ако страница или документ от него съдържа името или ЕИК;
    # иначе контактите от него не се приписват (за преглед), а несвързан сайт е грешна връзка
    verified = {}
    for d, why in domains.items():
        from_registry = why.startswith(("сайтът е вписан", "имейлът в Търговския"))
        own = [u for u, pg in pages.items() if web.domain_of(u) == d and site_owner_ok(pg, inv_name, inv_eik)]
        if from_registry or own:
            verified[d] = why if from_registry else f"{why}; името/ЕИК на инвеститора е на {own[0]}"
        elif domain_matches_name(d, inv_name):
            res["candidates"].append({"what": f"сайт на инвеститора {d}", "url": f"https://{d}/",
                                      "reason": "домейнът съвпада с името, но на сайта не са намерени името или ЕИК"})
        else:
            res["rejected"].append({"what": f"сайт на инвеститора {d}", "url": stored if stored and web.domain_of(stored) == d else f"https://{d}/",
                                    "reason": "на сайта няма името или ЕИК на инвеститора и домейнът не е по името му",
                                    "checked": checked})
    domains = verified
    res["sites"]["инвеститор"] = domains

    # 3) Име на проекта – от страница/документ със силно доказателство
    for u, ev in evals.items():
        pg = pages[u]
        if not ev["strong"] or ev["other_objects"] or is_mirror(u, pg.get("title", "")):
            continue
        menu = [parent for q in pages.values() for href, anchor, parent in q.get("links") or [] if href == u and parent]
        for cand in menu + [pg.get("h1"), pg.get("title"), pg.get("anchor")]:
            name = clean_project_name(cand or "", inv_names)
            if name and name not in [x["name"] for x in res["project_names"]]:
                res["project_names"].append({"name": name, "url": u, "basis": ev["strong"][0]["what"],
                                             "snippet": ev["strong"][0]["snippet"]})
                break

    # 4) Следване на връзки от потвърдените страници към други сайтове (архитект, строител, новини)
    for u, ev in list(evals.items()):
        if not (ev["strong"] or chained(pages[u], ev, res["project_names"])):
            continue
        for href, anchor, parent in (pages[u].get("links") or [])[:300]:
            if not href.startswith("http") or web.is_directory(href) or href in pages:
                continue
            if web.domain_of(href) == web.domain_of(u):
                continue
            pn = [x["name"] for x in res["project_names"]]
            if any(name_in(web.translit(href) + " " + anchor, web.translit(n)) or name_in(anchor, n) for n in pn) \
                    or PROJECT_URL_WORDS.search(href):
                pg = f.get(href)
                if pg:
                    pages[href] = pg
                    evals[href] = evaluate(pg)
    # Сайтове, към които водят линкове от страниците на проекта (архитект/строител) – начални страници
    # се отварят по-долу само за участниците с проверен сайт.

    # 5) Решение за всяка страница
    for u, ev in evals.items():
        pg = pages[u]
        verdict, basis = "не е за обекта", "няма разрешение, кадастрален имот, УПИ или точен адрес на обекта"
        if ev["strong"] and is_mirror(u, pg.get("title", "")):
            verdict, basis = "копие на регистъра", ("повтаря данните от регистъра на НАГ (" + ev["strong"][0]["what"] +
                                                    ") – не дава архитект, строител или събития")
        elif ev["strong"] and ev["other_objects"]:
            verdict, basis = "няколко обекта", (f'страницата съдържа и {len(ev["other_objects"])} други обекта от '
                                                f'базата – ролите се приемат само до нашия идентификатор')
        elif ev["strong"]:
            verdict, basis = "за обекта", ev["strong"][0]["what"]
        elif chained(pg, ev, res["project_names"]):
            pn = chained(pg, ev, res["project_names"])
            verdict, basis = "за обекта (по име на проекта)", (
                f'„{pn["name"]}“ (установено от {pn["basis"]} на {pn["url"]}) + инвеститор „{ev["investor"][0]}“')
        elif ev["investor"] and ev["rzp_match"] and ev["main_locality"] and not ev["other_places"]:
            verdict, basis = "за обекта (по съчетание)", (
                f'инвеститор „{ev["investor"][0]}“ + място „{ev["locality"][0]}“ + РЗП {ev["rzp_match"][0]:.0f} м² '
                f'(в рамките на 3% от регистъра)')
        elif ev["other_objects"]:
            verdict, basis = "друг обект", "страницата посочва кадастрален имот на друг обект от базата"
        elif ev["investor"] and ev["stated_address"] and not ev["locality"] and not _street(p):
            verdict, basis = "друг обект", (f'страницата посочва адрес „{ev["stated_address"]}“, а обектът е в '
                                            f'{p.get("locality") or p.get("region")}')
        elif ev["investor"] and ev["other_places"] and not ev["locality"]:
            verdict, basis = "друг обект", (f'страницата е за проект на същия инвеститор в {", ".join(ev["other_places"][:2])}, '
                                            f'а обектът е в {p.get("locality") or p.get("region")}')
        res["pages"].append({"url": u, "title": pg.get("title", "")[:120], "verdict": verdict, "basis": basis,
                             "published": ev["published"], "published_how": ev["published_how"],
                             "evidence": (ev["strong"][0]["snippet"] if ev["strong"] else ""),
                             "linked_from": pg.get("linked_from", "")})

    # 6) Роли от страниците за обекта
    found: dict[tuple, dict] = {}
    for rec in res["pages"]:
        if not rec["verdict"].startswith("за обекта") and rec["verdict"] != "няколко обекта":
            continue
        pg, ev = pages[rec["url"]], evals[rec["url"]]
        near = ev["strong"][0]["pos"] if rec["verdict"] == "няколко обекта" else None
        body = (pg.get("text") or "") if near is not None else main_text(pg.get("text") or "")
        for r in roles_in(body, near):
            if normalize_name(r["name"]) in inv_names:
                continue  # инвеститорът не е архитект/строител на себе си
            key = (r["role"], normalize_name(r["name"]))
            found.setdefault(key, {**r, "sources": []})["sources"].append(
                {"url": rec["url"], "snippet": r["snippet"], "published": rec["published"],
                 "page_basis": rec["basis"], "verdict": rec["verdict"]})
        for e in ([] if is_mirror(rec["url"], pg.get("title", "")) else events_in(pg)):
            if rec["verdict"].startswith("за обекта"):
                res["events"].append({**e, "historical": True, "checked": checked,
                                      "page_basis": rec["basis"]})

    # Сайтът на страницата е на архитектурно бюро от КАБ -> бюрото е архитект (портфолио)
    for rec in res["pages"]:
        if not rec["verdict"].startswith("за обекта"):
            continue
        b = reg.kab_by_domain.get(web.domain_of(rec["url"]))
        if b:
            key = ("архитект", normalize_name(b["name"]))
            found.setdefault(key, {"role": "архитект", "name": b["name"], "sources": []})["sources"].append(
                {"url": rec["url"], "snippet": f'портфолио на бюрото ({web.domain_of(rec["url"])}, '
                                               f'{"в регистъра на КАБ" if b.get("kab_url") else "сайтът е от профила му в Google Maps"})',
                 "published": rec["published"], "page_basis": rec["basis"], "verdict": rec["verdict"]})

    # 7) Участниците: ЕИК, официален сайт, контакти
    from .visuals import _loose
    for (role, _), r in sorted(found.items(), key=lambda kv: -len(kv[1]["sources"])):
        src_domains = {web.domain_of(x["url"]) for x in r["sources"]}
        kab0 = reg.kab_by_domain.get(next(iter(src_domains))) if len(src_domains) == 1 else None
        if kab0 and role == "архитект" and r["name"] == kab0["name"]:
            src_domains |= set(official_domains({"kab": kab0}))
        same = next((l for l in res["links"] if l["role"] == role and l["status"] == "потвърдена" and (
            _loose(r["name"].split()[0])[:3] and _loose(r["name"].split()[0]) in _loose(l["name"] + " " + " ".join(l.get("domains", []))))), None)
        if same:  # „ИПА Архитекти“ = вече потвърденото „IPA - Architecture and more“
            same["sources"] += r["sources"]
            same.setdefault("also_named", []).append(r["name"])
            if not same["eik"]:
                ent = reg.resolve(r["name"], role, src_domains | set(same.get("domains", [])))
                if ent["eik"]:
                    same.update(eik=ent["eik"], eik_how=ent["how"])
            continue
        ent = reg.resolve(r["name"], role, src_domains | {d for l in res["links"] for d in l.get("domains", [])})
        if role == "архитект" and not ent["kab"] and kab0:
            ent["kab"] = kab0
        if role == "архитект" and not ent["eik"] and ent["kab"]:
            ent2 = reg.resolve(ent["kab"]["name"], role, src_domains | set(official_domains({"kab": ent["kab"]})))
            ent["eik"], ent["tr"] = ent2["eik"], ent2["tr"]
            ent["how"] = ent2["how"] or ent["how"]
        if role == "архитект" and not ent["kab"] and ent["tr"]:
            dom = official_domains({"tr": ent["tr"]})
            for d in dom:
                if d in reg.kab_by_domain:
                    ent["kab"] = reg.kab_by_domain[d]
        strong_src = [s for s in r["sources"] if s["verdict"] in ("за обекта", "няколко обекта")]
        named = ent["eik"] or ent["kab"]
        status = "потвърдена" if r["sources"] and named else "кандидат"
        why = []
        if not named:
            why.append("фирмата не е намерена еднозначно в Търговския регистър/КАБ: " + (ent["how"] or "няма съвпадение"))
        if ent.get("uncertain"):
            res["candidates"].append({"what": f'ЕИК на {r["name"]}: {ent["eik"]}', "reason": ent["how"],
                                      "url": r["sources"][0]["url"]})
        link = {"role": role, "eik_status": "за проверка" if ent.get("uncertain") else ("потвърден" if ent["eik"] else ""),
                "name": (ent["tr"] or {}).get("tr_name") if ent["tr"] and not ent.get("uncertain") else
                        ((ent["kab"] or {}).get("name") or r["name"]),
                "mentioned_as": r["name"], "eik": ent["eik"], "eik_how": ent["how"],
                "status": status, "reason": "; ".join(why),
                "basis": ("изрично посочен" + (" в документ/страница с " + strong_src[0]["page_basis"] if strong_src
                                               else " на страница за същия проект: " + r["sources"][0]["page_basis"])),
                "sources": r["sources"], "checked": checked,
                "domains": sorted(official_domains(ent))}
        res["links"].append(link)
        if status != "потвърдена":
            res["candidates"].append({"what": f"{role}: {r['name']}", "reason": link["reason"],
                                      "url": r["sources"][0]["url"]})
            continue
        doms = official_domains(ent)
        res["sites"][link["name"]] = doms
        for d in doms:
            home = f.get(f"https://{d}/") or f.get(f"https://www.{d}/")
            if not home:
                continue
            contact_pages = [home] + [f.get(h) for h, a, _ in home.get("links", [])
                                      if web.domain_of(h) == d and re.search(r"(?i)contact|kontakt|контакт", h + " " + a)][:2]
            for cp in filter(None, contact_pages):
                c = contacts_from(cp, d)
                if c["phones"] or c["emails"]:
                    res["contacts"].append({"participant": link["name"], "eik": ent["eik"], "role": role,
                                            "scope": "общ фирмен контакт", "phones": c["phones"],
                                            "emails": c["emails"], "foreign_emails": c["foreign_emails"],
                                            "url": cp["url"], "site_basis": doms[d], "checked": checked})
                    break

    # Контакт за проекта: страница за обекта на сайта на инвеститора
    for rec in res["pages"]:
        d = web.domain_of(rec["url"])
        if rec["verdict"].startswith("за обекта") and d in domains and pages[rec["url"]].get("type") == "html":
            c = contacts_from(pages[rec["url"]], d)
            if c["phones"] or c["emails"]:
                res["contacts"].append({"participant": inv_contact.get("name", ""), "eik": inv_eik, "role": "инвеститор",
                                        "scope": "контакт за проекта", "phones": c["phones"], "emails": c["emails"],
                                        "foreign_emails": c["foreign_emails"], "url": rec["url"],
                                        "site_basis": domains[d], "checked": checked})
    # Общ контакт на инвеститора от проверения му сайт
    for d, why in domains.items():
        home = f.get(f"https://{d}/") or f.get(f"https://www.{d}/")
        if home:
            c = contacts_from(home, d)
            if c["phones"] or c["emails"]:
                res["contacts"].append({"participant": inv_contact.get("name", ""), "eik": inv_eik, "role": "инвеститор",
                                        "scope": "общ фирмен контакт", "phones": c["phones"], "emails": c["emails"],
                                        "foreign_emails": c["foreign_emails"], "url": home["url"],
                                        "site_basis": why, "checked": checked})
    flag_shared_phones(res)

    # 8) Повторна проверка на вече закачените архитекти
    for a in p.get("architects") or []:
        u = (a.get("evidence") or {}).get("url")
        rec = next((x for x in res["pages"] if x["url"] == u), None)
        if rec is None:
            continue
        if rec["verdict"] in ("друг обект", "няколко обекта"):
            res["rejected"].append({"what": f'архитект „{a.get("name")}“', "url": u, "reason": rec["basis"],
                                    "checked": checked})
        elif rec["verdict"] == "не е за обекта":
            res["candidates"].append({"what": f'архитект „{a.get("name")}“ (досегашна връзка)',
                                      "reason": "страницата не доказва обекта: " + rec["basis"], "url": u})
    return res


def chained(pg: dict, ev: dict, project_names: list[dict]) -> dict | None:
    """Страница за същия проект: точното име на проекта + инвеститорът, без чужди обекти."""
    if ev["other_objects"] or not ev["investor"]:
        return None
    text = (pg.get("title") or "") + " " + (pg.get("text") or "")
    return next((pn for pn in project_names if name_in(text, pn["name"])), None)


def flag_shared_phones(res: dict) -> None:
    """Един и същ телефон при различни участници -> за проверка (не се приписва на никого)."""
    owners: dict[str, set] = {}
    for c in res["contacts"]:
        for ph in c["phones"]:
            owners.setdefault(ph, set()).add(c["eik"] or c["participant"])
    for c in res["contacts"]:
        shared = [ph for ph in c["phones"] if len(owners[ph]) > 1]
        if shared:
            c["phones"] = [ph for ph in c["phones"] if ph not in shared]
            res["candidates"].append({"what": f'телефон {", ".join(shared)}', "url": c["url"],
                                      "reason": "същият телефон е намерен при друг участник – не се приписва"})


def other_object_index(permits: list[dict]) -> dict[str, set[str]]:
    idx: dict[str, set[str]] = {}
    for p in permits:
        for k in kkkr_ids(p):
            idx.setdefault(k, set()).add(p["hash"])
    return idx


# ---------------------------------------------------------------------------
# Запис и прилагане към съществуващия обект
# ---------------------------------------------------------------------------

def result_path(permit_hash: str) -> Path:
    return CACHE / "projects" / (hashlib.sha1(permit_hash.encode()).hexdigest()[:16] + ".json")


def save(res: dict) -> None:
    path = result_path(res["hash"])
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    tmp.write_text(json.dumps(res, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)


def load(permit_hash: str) -> dict | None:
    path = result_path(permit_hash or "")
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if data.get("version") == VERSION else None


def apply_projects(p: dict) -> None:
    """Добавя автоматично намереното към обекта, без да презаписва потвърдено (ръчно/протокол)."""
    from .enrich import _merge, _new_contact
    res = load(p.get("hash") or "")
    if not res:
        return
    p["auto_check"] = {"checked": res["checked"], "pages": res["pages"], "sites": res["sites"]}
    if res["project_names"] and not p.get("project_name"):
        pn = res["project_names"][0]
        p["project_name"] = {"name": pn["name"], "source": "автоматично: " + pn["basis"], "url": pn["url"],
                             "published": "", "checked": res["checked"], "note": pn["snippet"]}
    rejected_urls = {r["url"] for r in res["rejected"]}
    if rejected_urls:
        p.setdefault("rejected_sources", []).extend(
            {"source": r["what"], "url": r["url"], "reason": "автоматична проверка: " + r["reason"],
             "checked": r["checked"]} for r in res["rejected"])
        p["architects"] = [a for a in p.get("architects") or [] if (a.get("evidence") or {}).get("url") not in rejected_urls]
        p["stage_hints"] = [h for h in p.get("stage_hints") or [] if h.get("url") not in rejected_urls]
        p["contacts"] = [c for c in p.get("contacts", []) if (c.get("evidence") or {}).get("url") not in rejected_urls]
        for c in p["contacts"]:
            if c.get("role", "").startswith("Инвеститор") and c.get("website") in rejected_urls:
                # сайтът не е на инвеститора – махаме го (телефоните от него също не са на инвеститора)
                c["website"] = ""
                if "сайт на фирмата" in c.get("sources", []):
                    c["phones"], c["emails"] = [], []
                    c["sources"] = [x for x in c["sources"] if x != "сайт на фирмата"]
    p["review"] = list(res["candidates"])
    p["auto_links"] = res["links"]
    # досегашен кандидат от страница, която вече доказва потвърдено бюро, се заменя от него
    ok_urls = {x["url"] for l in res["links"] if l["role"] == "архитект" and l["status"] == "потвърдена"
               for x in l["sources"]}
    if ok_urls:
        p["architects"] = [a for a in p.get("architects") or [] if (a.get("evidence") or {}).get("url") not in ok_urls]
        p["contacts"] = [c for c in p.get("contacts", []) if not (c.get("role", "").startswith("Архитект")
                                                                  and (c.get("evidence") or {}).get("url") in ok_urls)]
    for e in res["events"]:
        p.setdefault("milestones", []).append({"what": e["what"], "date": e["date"], "label": "Съобщено",
                                               "historical": True, "source": "автоматично: " + e["url"],
                                               "url": e["url"], "retrieved": res["checked"]})
    contacts_by = {}
    for c in res["contacts"]:
        contacts_by.setdefault((c["role"], c["eik"] or c["participant"]), []).append(c)
    for link in res["links"]:
        if link["status"] != "потвърдена":
            continue
        role_name = "Архитект – потвърдена" if link["role"] == "архитект" else "Строител"
        existing = next((c for c in p.get("contacts", []) if link["eik"] and c.get("eik") == link["eik"]), None)
        conflict = next((c for c in p.get("contacts", []) if c.get("role", "").startswith(role_name[:8])
                         and c.get("eik") and c["eik"] != link["eik"] and c.get("link_evidence")), None)
        if conflict:  # потвърдено ръчно за друга фирма – не се презаписва
            p["review"].append({"what": f'{link["role"]}: {link["name"]}', "url": link["sources"][0]["url"],
                                "reason": f'ръчно е потвърден {conflict["name"]}'})
            continue
        sure_eik = link["eik"] if link.get("eik_status") != "за проверка" else ""
        existing = existing if sure_eik else None
        c = existing or {**_new_contact(link["name"]), "eik": sure_eik, "role": role_name}
        if not sure_eik and link["eik"]:
            c["eik_status"], c["eik_reason"] = "за проверка", f'вероятен ЕИК {link["eik"]}: {link["eik_how"]}'
        rec = tr_cached(sure_eik) if sure_eik else None
        if rec:
            c["managers"] = c.get("managers") or [m for m in rec.get("managers", []) if "Заличено" not in m]
            c["address"] = c.get("address") or rec.get("address", "")
            c.setdefault("links", {})["Търговски регистър"] = rec.get("tr_url", "")
        c["link_basis"] = c.get("link_basis") or link["basis"]
        c["link_date"] = c.get("link_date") or link["checked"]
        c.setdefault("link_evidence", []).extend(
            {"source": "автоматично", "url": s["url"], "snippet": s["snippet"], "published": s["published"],
             "checked": link["checked"]} for s in link["sources"][:3])
        for k in contacts_by.get((link["role"], link["eik"] or link["name"]), []):
            _merge(c, k["phones"], k["emails"], "https://" + web.domain_of(k["url"]), f'сайт ({k["scope"]})')
            c.setdefault("contact_evidence", []).append(
                {"source": k["scope"], "url": k["url"], "note": k["site_basis"], "checked": k["checked"]})
        if not existing:
            p.setdefault("contacts", []).append(c)
    inv = next((c for c in p.get("contacts", []) if c.get("role", "").startswith("Инвеститор")), None)
    for k in contacts_by.get(("инвеститор", (inv or {}).get("eik") or (inv or {}).get("name", "")), []):
        if inv is None:
            break
        _merge(inv, k["phones"], k["emails"], "https://" + web.domain_of(k["url"]), f'сайт на инвеститора ({k["scope"]})')
        inv.setdefault("contact_evidence", []).append(
            {"source": k["scope"], "url": k["url"], "note": k["site_basis"], "checked": k["checked"]})


def link_entries(p: dict, existing: list[dict]) -> list[dict]:
    """Автоматичните връзки като редове за отчета; не дублира и не сваля ръчно потвърдените."""
    have = {(l["role"], normalize_name(l["name"])) for l in existing}
    have_eik = {(l["role"], l.get("eik")) for l in existing if l.get("eik")}
    out = []
    for l in p.get("auto_links") or []:
        if (l["role"], normalize_name(l["name"])) in have or (l["eik"] and (l["role"], l["eik"]) in have_eik):
            continue
        src = l["sources"][0]
        out.append({"role": l["role"], "name": l["name"], "eik": l["eik"] if l.get("eik_status") != "за проверка" else "",
                    "eik_note": l["eik_how"] if l.get("eik_status") == "за проверка" else "", "status": l["status"],
                    "basis": l["basis"] + (f' ({l["reason"]})' if l.get("reason") else ""),
                    "source": "автоматично намерено", "url": src["url"], "snippet": src["snippet"],
                    "published": src.get("published", ""), "date": l["checked"], "auto": True,
                    "sources": l["sources"]})
    return out


# ---------------------------------------------------------------------------
# Обратно търсене: карти на сайтовете на бюрата (КАБ) и строителите (КСБ)
# ---------------------------------------------------------------------------

GENERIC_TOKENS = {"invest", "investment", "investmant", "group", "grup", "build", "bild", "stroy", "stroi",
                  "consult", "konsult", "bulgaria", "property", "properties", "propartiz", "estate", "development",
                  "holding", "homes", "sofia", "park", "residence", "rezidens", "premium", "proekt", "project",
                  "kompleks", "complex", "service", "servis", "trade", "treyd", "company", "kompani"}


def slug_tokens(p: dict) -> list[str]:
    """Отличителни думи на инвеститора (на латиница), по които се търси в адресите на страниците."""
    out = []
    for n in investor_names(p):
        for w in n.split():
            t = web.translit(w).replace("k", "c")
            t = re.sub(r"[^a-z0-9]", "", t)
            if len(t) >= 5 and t not in GENERIC_TOKENS:
                out.append(t)
    return list(dict.fromkeys(out))


def portfolio_seeds(f: Fetcher, domains: list[str], objects: list[dict], per_object: int = 8) -> dict[str, list[str]]:
    """{хеш: [адреси]} – страници от сайтовете, чийто адрес съдържа отличителна дума на инвеститора."""
    from concurrent.futures import ThreadPoolExecutor
    toks = {p["hash"]: slug_tokens(p) for p in objects}
    out: dict[str, list[str]] = {h: [] for h in toks}

    def one(d: str) -> list[str]:
        # отделна връзка за всеки сайт: паузата между заявките към един сайт се запазва
        own = Fetcher(f.log, http=Http(delay=f.http.base_delay, retries=1, timeout=f.http.timeout), cache=f.cache)
        try:
            return sitemap_urls(own, d, limit=1500)
        except Exception as exc:
            f.log.failure("sitemap", d, exc, f"https://{d}/")
            return []
    with ThreadPoolExecutor(max_workers=16) as pool:
        all_urls = list(pool.map(one, domains))
    for urls in all_urls:
        for u in urls:
            slug = urlparse(u).path.lower().replace("k", "c")
            for h, ts in toks.items():
                if len(out[h]) < per_object and any(t in slug for t in ts):
                    out[h].append(u)
    return out
