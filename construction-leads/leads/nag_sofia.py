"""Регистрите на НАГ / Направление „Градско планиране и развитие“ – Столична община.

Сайтът nag.sofia.bg ползва Kendo гридове: страницата Index създава
`searchQueryId`, а данните идват като JSON от `.../Read` (или `Grid_ReadData`)
с параметри page / pageSize / sort. Филтрите по дата на сайта не се прилагат
надеждно, затова сортираме по дата низходящо и спираме, щом стигнем
началната дата.
"""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Iterator
from urllib.parse import quote
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

from .http import Http

BASE = "https://nag.sofia.bg"
SOFIA_TZ = ZoneInfo("Europe/Sofia")


def parse_ms_date(value) -> date | None:
    """'/Date(1790888400000)/' -> date (в часовата зона на София)."""
    if not value:
        return None
    m = re.search(r"-?\d+", str(value))
    if not m:
        return None
    return datetime.fromtimestamp(int(m.group()) / 1000, SOFIA_TZ).date()


class KendoRegister:
    """Общ четец за гридовете на nag.sofia.bg."""

    def __init__(self, http: Http, index_path: str, read_path: str):
        self.http = http
        self.index_path = index_path
        self.read_path = read_path
        self.query_id: str | None = None

    def _ensure_query(self) -> str:
        if self.query_id is None:
            html = self.http.get(BASE + self.index_path).text
            m = re.search(r"searchQueryId=([0-9a-f-]{36})", html)
            if not m:
                raise RuntimeError(f"Няма searchQueryId на {self.index_path}")
            self.query_id = m.group(1)
        return self.query_id

    def search(self, **params) -> None:
        """Изпълнява търсенето от формата (нужно за ОЕСУТ, където по
        подразбиране се показва само последният месец)."""
        qid = self._ensure_query()
        search_path = self.read_path.split("/")[1]
        self.http.get(
            f"{BASE}/{search_path}/Search",
            params={"searchQueryId": qid, **params},
            headers={"X-Requested-With": "XMLHttpRequest"},
        )

    def rows(self, sort: str, page_size: int = 100) -> Iterator[dict]:
        qid = self._ensure_query()
        page = 1
        while True:
            resp = self.http.post(
                f"{BASE}{self.read_path}",
                params={"searchQueryId": qid},
                data={"page": page, "pageSize": page_size, "sort": sort},
                headers={"X-Requested-With": "XMLHttpRequest"},
            ).json()
            data = resp.get("Data") or []
            yield from data
            if not data or page * page_size >= resp.get("Total", 0):
                return
            page += 1


# --------------------------------------------------------------------------
# Разрешения за строеж
# --------------------------------------------------------------------------

_LABEL = re.compile(r"(?:^|,\s*)([А-ЯA-Z][^,:]{1,40}):\s*")


def parse_scope(scope: str) -> dict[str, str]:
    """'Местност: X, УПИ: IV - 1216,1396, Адрес: гр. София, ул. Y' ->
    {'Местност': 'X', 'УПИ': 'IV - 1216,1396', 'Адрес': 'гр. София, ул. Y'}"""
    scope = scope or ""
    marks = list(_LABEL.finditer(scope))
    fields = {}
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(scope)
        fields[m.group(1).strip()] = scope[m.end():end].strip(" ,")
    return fields


def fetch_permits(http: Http, since: date, limit: int | None = None) -> list[dict]:
    reg = KendoRegister(http, "/RegisterBuildingPermitsPortal/Index",
                        "/RegisterBuildingPermitsPortal/Read")
    out: list[dict] = []
    for row in reg.rows(sort="TakeEffectFilter-desc"):
        in_force = parse_ms_date(row.get("TakeEffectFilter"))
        if in_force and in_force < since:
            break
        number = (row.get("Number") or "").strip()
        issued = None
        m = re.search(r"(\d{2})\.(\d{2})\.(\d{4})", number)
        if m:
            issued = date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        scope = row.get("Scope") or ""
        fields = parse_scope(scope)
        out.append({
            "source": "НАГ София – разрешение за строеж",
            "stage": "Разрешение за строеж",
            "number": number,
            "hash": row.get("Hash"),
            "status": row.get("Status"),
            "issued": issued.isoformat() if issued else None,
            "in_force": in_force.isoformat() if in_force else None,
            "issuer": row.get("Issuer"),
            "investor": (row.get("Employer") or "").strip(),
            "object": re.sub(r"\s+", " ", row.get("Object") or "").strip(),
            "region": row.get("Region"),
            "address": fields.get("Адрес", ""),
            "locality": fields.get("Местност", "").strip('"'),
            "upi": fields.get("УПИ", ""),
            "kkkr": fields.get("Идентификатор КККР (имот)", ""),
            "scope": scope,
            "url": f"{BASE}/RegisterInfo/Info?url={quote(row.get('Hash') or '')}",
            "map_url": f"{BASE}/OpenMap/Zones?administrativeDocument={quote(row.get('Hash') or '')}",
        })
        if limit and len(out) >= limit:
            break
    return out


CATEGORY_WORDS = {
    "първа": 1, "втора": 2, "трета": 3, "четвърта": 4, "пета": 5, "шеста": 6,
}


def _num(text: str) -> float | None:
    try:
        return float(text.replace(" ", "").replace(",", "."))
    except ValueError:
        return None


def fetch_permit_detail(http: Http, permit_hash: str) -> dict:
    """Детайли: категория, РЗП/ЗП, строителен надзор, линк към PDF."""
    html = http.get(f"{BASE}/RegisterInfo/Info", params={"url": permit_hash}).text
    soup = BeautifulSoup(html, "html.parser")
    detail: dict = {}
    for tr in soup.select("table.registerRsAlignBtnCell tr"):
        tds = tr.find_all("td", recursive=False)
        if len(tds) < 2:
            continue
        label = tds[0].get_text(" ", strip=True).rstrip(":")
        value_td = tds[-1]
        value = value_td.get_text("\n", strip=True)
        if label.startswith("Строеж/Обект"):
            lines = [line.strip() for line in value.split("\n") if line.strip()]
            if lines and lines[0].lower() in CATEGORY_WORDS:
                detail["category"] = CATEGORY_WORDS[lines[0].lower()]
            text = " ".join(lines)
            for key, pattern in (
                ("rzp_with_basement", r"РЗП със сутерен\s*=\s*([\d\s.,]+)"),
                ("rzp", r"РЗП\s*=\s*([\d\s.,]+)"),
                ("zp", r"(?<!Р)ЗП\s*=\s*([\d\s.,]+)"),
            ):
                m = re.search(pattern, text)
                if m:
                    detail[key] = _num(m.group(1).strip(" ,."))
        elif label.startswith("Строителен надзор"):
            detail["supervision"] = value.replace("\n", " ").strip()
        elif "заличени лични данни" in label:
            a = value_td.find("a", href=True)
            if a:
                detail["pdf_url"] = BASE + a["href"]
    return detail


# --------------------------------------------------------------------------
# Визи за проектиране (най-ранният етап: още няма проект)
# --------------------------------------------------------------------------

def fetch_visas(http: Http, since: date) -> list[dict]:
    reg = KendoRegister(http, "/registervisasofproection",
                        "/RegisterVisasOfProection/Grid_ReadData")
    out = []
    for row in reg.rows(sort="DateFilter-desc"):
        d = parse_ms_date(row.get("DateFilter"))
        if d and d < since:
            break
        files = [f for f in (row.get("FileNames") or "").split(";") if f.strip()]
        out.append({
            "source": "НАГ София – виза за проектиране",
            "stage": "Виза за проектиране",
            "number": row.get("RegNumber"),
            "issued": d.isoformat() if d else None,
            "issuer": row.get("Issuer"),
            "region": row.get("RegionName"),
            "basis": row.get("Basis"),
            "scope": row.get("Scope"),
            "files": [f"{BASE}/FileBrowser/File?path={quote(f.strip())}" for f in files],
        })
    return out


# --------------------------------------------------------------------------
# Протоколи от ОЕСУТ (сканирани PDF – за тях трябва OCR)
# --------------------------------------------------------------------------

def fetch_oesut_protocols(http: Http, since: date) -> list[dict]:
    reg = KendoRegister(http, "/OesutProtocol/Index/", "/OesutProtocol/Grid_ReadData")
    reg.search(FromDate=f"{since.day}.{since.month}.{since.year} г.",
               ToDate=f"{date.today().day}.{date.today().month}.{date.today().year} г.")
    out = []
    for row in reg.rows(sort="Date-desc"):
        d = parse_ms_date(row.get("Date"))
        if d and d < since:
            break
        files = []
        for part in (row.get("FilePath") or "").split(";"):
            if "&" in part:
                path = part.split("&", 1)[1].strip()
                files.append(f"{BASE}/FileBrowser/File?path={quote(path)}")
        out.append({
            "number": row.get("InnerNumber"),
            "type": row.get("Type"),
            "date": d.isoformat() if d else None,
            "files": files,
        })
    return out
