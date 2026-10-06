"""Достоверност: етап на строежа и връзки обект–архитект / обект–строител.

Етап:
  потвърден     – официален документ (удостоверение за въвеждане в експлоатация, Акт 16)
                  или ръчно потвърждение в data/confirmations.csv (с източник и дата);
  приблизителен – изчислен по датата на разрешението и РЗП; текстът от обява („Акт 14 –
                  лято 2027“) се показва като допълнение, но не е потвърждение;
  неизвестен    – няма дата на влизане в сила.

Връзка обект–архитект/строител:
  потвърдена – ръчно потвърждение, или страница, която изрично посочва ролята („архитект: X“)
               и описва същия обект: споменава инвеститора И мястото (улица, местност, УПИ/КККР);
  кандидат   – всичко останало (само инвеститор или само улица не стига).
Всяка връзка пази: източник, линк, дата на извличане и основание.
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

from .ksb import normalize_name

ROOT = Path(__file__).resolve().parent.parent
CONFIRMATIONS = ROOT / "data" / "confirmations.csv"
CACHE = ROOT / "cache"

STAGE_WORDS = [("done", r"акт\s*16|въведен"), ("finish", r"акт\s*15|довършител"),
               ("late", r"акт\s*14|фасад"), ("rough", r"груб"), ("hole", r"изкоп|дупка|котлован")]


def load_confirmations(path: Path = CONFIRMATIONS) -> dict[str, list[dict]]:
    """{хеш или „номер|район“: [записи]} от ръчно попълнения CSV."""
    out: dict[str, list[dict]] = {}
    if not path.exists():
        return out
    with open(path, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if not (row.get("obekt") or "").strip() or not (row.get("pole") or "").strip():
                continue
            out.setdefault(row["obekt"].strip(), []).append(row)
    return out


def _confs(p: dict, confirmations: dict) -> list[dict]:
    return (confirmations.get(p.get("hash") or "-", []) +
            confirmations.get(f'{p.get("number")}|{p.get("region")}', []))


def apply_stage_status(p: dict, confirmations: dict, data_date: str) -> None:
    manual = [c for c in _confs(p, confirmations) if c["pole"].strip().lower() == "етап"]
    if manual:
        c = manual[-1]
        code = next((k for k, rx in STAGE_WORDS if re.search(rx, c["stoinost"].lower())), "")
        p["stage"] = c["stoinost"].strip()
        if code:
            p["stage_code"] = code
        p["stage_status"] = "потвърден"
        p["stage_evidence"] = {"source": c.get("iztochnik", "").strip() or "ръчно потвърждение",
                               "detail": c.get("belezhka", "").strip(), "date": c.get("data", "").strip()}
    elif p.get("act16"):
        p["stage_status"] = "потвърден"
        p["stage_evidence"] = {
            "source": "НАГ София – регистър на удостоверенията за въвеждане в експлоатация",
            "detail": f'Удостоверение № {p["act16"]["number"]}', "date": p["act16"].get("date", ""),
            "retrieved": data_date}
    elif p.get("in_force"):
        p["stage_status"] = "приблизителен"
        started = next((m for m in p.get("milestones", []) if "започнал" in m["what"]), None)
        if started and started.get("date"):
            # Приблизителният етап се смята от потвърденото начало, а не от датата на разрешението
            from .stage import stage as estimate
            p["stage"], p["stage_code"] = estimate({**p, "in_force": started["date"]})
        rzp = p.get("rzp_with_basement") or p.get("rzp")
        p["stage_evidence"] = {
            "source": "изчислено по датата на разрешението и РЗП",
            "detail": f'влязло в сила {p["in_force"]}' + (f", РЗП {round(rzp)} м²" if rzp else ""),
            "date": p["in_force"]}
    else:
        p["stage_status"] = "неизвестен"
        p["stage_evidence"] = {"source": "няма дата на влизане в сила на разрешението"}


# ---------------------------------------------------------------------------
# Връзки обект–архитект / обект–строител
# ---------------------------------------------------------------------------

def _page_cache(url: str) -> tuple[str, str]:
    """(текст, дата на извличане) на страница от кеша на find_architects."""
    path = CACHE / "pagetext" / (hashlib.sha1(url.encode()).hexdigest()[:16] + ".json")
    if not path.exists():
        return "", ""
    at = datetime.fromtimestamp(path.stat().st_mtime).isoformat(timespec="seconds")
    return json.loads(path.read_text(encoding="utf-8")) or "", at


NOT_BUILDING_ROLE = re.compile(r"(?i)интериор|фоайе|общи части|ландшафт|озеленяван|дизайн на|обзавеждан|"
                               r"осветлен|interior|landscape|lobby")


def _identifiers(p: dict, text: str) -> dict[str, bool]:
    """Инвеститор: пълното име (всички думи) на поне една фирма. Място: улица, местност, УПИ/КККР,
    като думите от името на инвеститора НЕ се броят за място (напр. „Ню Панчарево“ и с. Панчарево)."""
    low = re.sub(r"\s+", " ", (text or "").lower())
    inv_words: set[str] = set()
    inv = False
    for c in p.get("investor_companies", []):
        name = normalize_name(c)
        inv_words |= set(name.split())
        if len(name) >= 4 and name in low:
            inv = True
    if p.get("investor_eik") and p["investor_eik"].split(",")[0].strip() in low:
        inv = True
    candidates = []
    m = re.search(r"(?:ул\.|бул\.)\s*([^,№]+?)\s*№", p.get("address", "") or "")
    if m:
        candidates.append(m.group(1).strip().lower())
    loc = re.sub(r'["“”„]|^\s*(м\.|с\.|гр\.|ж\.к\.)\s*', "", (p.get("locality", "") or "").lower()).strip()
    if loc:
        candidates.append(loc)
    place = False
    for cand in candidates:
        words = [w for w in re.findall(r"[а-яa-z0-9]{4,}", cand) if w not in inv_words]
        if words and all(w in low for w in words[:2]):
            place = True
    for ident in (p.get("kkkr"),):
        if ident and ident.lower() in low:
            place = True
    return {"investor": inv, "place": place}


def _role_context_ok(text: str, mention: str) -> bool:
    """Споменаването не е за интериор/фоайе/озеленяване (тогава не е архитект на сградата)."""
    low = (text or "").lower()
    i = low.find((mention or "").lower()[:12])
    if i < 0:
        return False
    return not NOT_BUILDING_ROLE.search(low[max(0, i - 160):i + 40])


def build_links(p: dict, confirmations: dict) -> list[dict]:
    links = []
    for c in _confs(p, confirmations):
        role = c["pole"].strip().lower()
        if role in ("архитект", "строител"):
            links.append({"role": role, "name": c["stoinost"].strip(), "status": "потвърдена",
                          "basis": c.get("belezhka", "").strip() or "ръчно потвърждение",
                          "source": c.get("iztochnik", "").strip(), "url": "",
                          "date": c.get("data", "").strip()})
    confirmed_names = {(l["role"], normalize_name(l["name"])) for l in links}
    for a in p.get("architects", []):
        ev = a.get("evidence") or {}
        url = ev.get("url", "")
        text, at = _page_cache(url)
        ids = _identifiers(p, text)
        # Изрично споменаване = името е извадено от текст „архитект: …“; домейн (с точка) не е такова
        mention = ev.get("mention") or ""
        explicit = bool(mention) and not re.search(r"\.[a-z]{2,}$", mention)
        context_ok = explicit and _role_context_ok(text, mention)
        if explicit and context_ok and ids["investor"] and ids["place"]:
            status, basis = "потвърдена", (f'страницата посочва „{ev["mention"]}“ като архитект и описва '
                                           f'същия обект (инвеститор и място)')
        else:
            why = []
            if not explicit:
                why.append("ролята не е посочена изрично (намерено по сайт/домейн)")
            elif not context_ok:
                why.append("споменат за интериор/общи части/озеленяване, не като архитект на сградата")
            if not ids["investor"]:
                why.append("страницата не споменава инвеститора")
            if not ids["place"]:
                why.append("страницата не посочва мястото на обекта")
            status, basis = "кандидат", "; ".join(why) or "недостатъчно доказателства"
        if ("архитект", normalize_name(a.get("name", ""))) in confirmed_names:
            continue
        links.append({"role": "архитект", "name": a.get("name", ""), "status": status, "basis": basis,
                      "source": ev.get("title", "") or url, "url": url, "date": at or ""})
        a["link_status"] = status
    b = p.get("doc_builder")
    if b and ("строител", normalize_name(b.get("tr_name") or b["name"])) not in confirmed_names:
        ok = b.get("status") == "потвърден"
        links.append({"role": "строител", "name": b.get("tr_name") or b["name"],
                      "status": "потвърдена" if ok else "кандидат",
                      "basis": ("посочен като строител в протокол обр. 2 за откриване на строителната площадка; "
                                "ЕИК проверен в Търговския регистър") if ok else
                               f'посочен в протокол обр. 2, но {b.get("reason") or "ЕИК не е потвърден"}',
                      "source": "протокол обр. 2, прикачен към разрешението (регистър на НАГ)",
                      "url": b.get("url", ""), "date": b.get("date", "")})
        confirmed_names.add(("строител", normalize_name(b.get("tr_name") or b["name"])))
    for c in p.get("contacts", []):
        if "строител (КСБ)" in c.get("role", "") and ("строител", normalize_name(c["name"])) not in confirmed_names:
            links.append({"role": "строител", "name": c["name"], "status": "кандидат",
                          "basis": "инвеститорът е вписан в КСБ като строител – не доказва, че строи този обект",
                          "source": "КСБ – Централен професионален регистър на строителя",
                          "url": (c.get("links") or {}).get("КСБ", ""), "date": ""})
    return links
