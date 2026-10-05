"""Вероятен етап на строежа и „подходящ момент за фасада“ (PHOMI).

Актове 2 и 14 не са публични, затова етапът се изчислява от датата на влизане
в сила на разрешението и размера на сградата. Сградите с удостоверение за
въвеждане в експлоатация (Акт 16) се отбелязват като готови.
"""
from __future__ import annotations

import re
from datetime import date

FACADE_KINDS = {"Ново строителство", "Фасадна реновация", "Надстрояване / пристрояване"}


def months_since(iso: str | None, today: date | None = None) -> float | None:
    if not iso:
        return None
    d = date.fromisoformat(iso)
    today = today or date.today()
    return (today - d).days / 30.4


def stage(p: dict, today: date | None = None) -> tuple[str, str]:
    """-> (етап, код): code е 'hole' | 'rough' | 'late' | 'finish' | 'done' | ''."""
    if p.get("act16"):
        return "Въведена в експлоатация (Акт 16)", "done"
    m = months_since(p.get("in_force"), today)
    if m is None:
        return "", ""
    rzp = p.get("rzp_with_basement") or p.get("rzp") or 0
    # По-големите сгради се строят по-дълго до Акт 14
    rough_end = 9 if rzp < 1000 else 13 if rzp < 5000 else 18
    if p.get("kind") == "Фасадна реновация":
        return ("Предстои / в изпълнение", "rough") if m < 12 else ("Вероятно завършена", "finish")
    if m < 3:
        return "Подготовка / изкоп („на дупка“)", "hole"
    if m < rough_end:
        return "Груб строеж – преди Акт 14", "rough"
    if m < rough_end + 6:
        return "Около Акт 14 – фасада и довършителни", "late"
    return "След Акт 14 – довършителни", "finish"


def facade_window(p: dict) -> bool:
    """Подходящ момент за предлагане на фасадни панели."""
    return p.get("kind") in FACADE_KINDS and p.get("stage_code") in {"hole", "rough", "late"}


def site_key(region: str, kvartal: str, upi: str) -> str:
    upi_num = re.sub(r"\s+", "", (upi or "").split("-")[0]).upper()
    kv = re.sub(r"\D", "", kvartal or "")
    return f"{(region or '').strip().lower()}|{kv}|{upi_num}"


def mark_act16(permits: list[dict], certificates: list[dict]) -> int:
    """Свързва удостоверенията с разрешенията по КККР или район+квартал+УПИ."""
    by_kkkr = {c["kkkr"]: c for c in certificates if c.get("kkkr")}
    by_site = {site_key(c["region"], c["kvartal"], c["upi"]): c for c in certificates if c.get("upi")}
    hits = 0
    for p in permits:
        cert = by_kkkr.get(p.get("kkkr") or "-")
        if not cert:
            kv = re.search(r"Квартал по регулация:\s*([^,]+)", p.get("scope", ""))
            key = site_key(p.get("region", ""), kv.group(1) if kv else "", p.get("upi", ""))
            if not key.endswith("|"):
                cert = by_site.get(key)
        if cert and (cert.get("date") or "") >= (p.get("in_force") or ""):
            p["act16"] = {"number": cert["number"], "date": cert["date"]}
            hits += 1
    return hits
