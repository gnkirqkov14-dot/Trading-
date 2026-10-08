"""Файлове за Excel: обектите в момента за фасада с контактите по роли
и справочникът на архитектите. UTF-8 с BOM, за да се отварят правилно в Excel."""
from __future__ import annotations

import csv
from pathlib import Path


def _join(items, n=3) -> str:
    return ", ".join([x for x in (items or []) if x][:n])


def _role(p: dict, prefix: str) -> list[dict]:
    return [c for c in p.get("contacts", []) if c.get("role", "").startswith(prefix)]


def write_leads(path: Path, permits: list[dict]) -> int:
    cols = ["Оценка", "Етап", "Етап от обявите", "Вид", "Тип сграда", "Категория", "РЗП м²",
            "Влязло в сила", "Район", "Адрес / местност", "Обект",
            "Инвеститор", "ЕИК", "Управител", "Телефон инвеститор", "Имейл инвеститор", "Сайт инвеститор",
            "Строителен надзор", "Телефон надзор", "Имейл надзор",
            "Архитект", "Телефон архитект", "Имейл архитект",
            "Група инвеститори (общ телефон/имейл)", "Обекти на инвеститора в списъка",
            "Разрешение", "Още разрешения за същия имот", "Линк към разрешението"]
    rows = [p for p in permits if p.get("facade_window")]
    rows.sort(key=lambda p: (-p.get("score", 0), p.get("in_force") or ""))
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(cols)
        for p in rows:
            inv, sup, arch = _role(p, "Инвеститор"), _role(p, "Строителен надзор"), _role(p, "Архитект")
            w.writerow([
                p.get("score"), p.get("stage", ""), " | ".join(h["text"] for h in p.get("stage_hints", [])),
                p.get("kind", ""), p.get("building_type", ""), p.get("category") or "",
                round(p.get("rzp_with_basement") or p.get("rzp") or 0) or "",
                p.get("in_force", ""), p.get("region", ""), p.get("address") or p.get("locality", ""),
                p.get("object", ""),
                p.get("investor", ""), _join([c.get("eik") for c in inv]),
                _join(sum((c.get("managers", [])[:1] for c in inv), [])),
                _join(sum((c.get("phones", []) for c in inv), [])), _join(sum((c.get("emails", []) for c in inv), [])),
                _join([c.get("website") for c in inv], 1),
                p.get("supervision", ""), _join(sum((c.get("phones", []) for c in sup), [])),
                _join(sum((c.get("emails", []) for c in sup), [])),
                _join([c.get("name") for c in arch], 2), _join(sum((c.get("phones", []) for c in arch), [])),
                _join(sum((c.get("emails", []) for c in arch), [])),
                _join(sorted({n for c in inv for n in (c.get("group") or [])}), 6),
                max([c.get("group_objects") or 1 for c in inv] or [""]),
                p.get("number", ""), _join([o["number"] for o in p.get("other_permits", [])], 6), p.get("url", ""),
            ])
    return len(rows)


def write_architects(path: Path, architects: list[dict]) -> int:
    cols = ["Бюро", "Архитекти", "Телефон", "Имейл", "Сайт", "Адрес", "Рег. № КАБ", "Колегия",
            "Профил в КАБ", "Google Maps", "Оценка в Google"]
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(cols)
        for a in architects:
            w.writerow([a.get("name", ""), _join((a.get("owners") or []) + (a.get("staff") or []), 4),
                        _join(a.get("phones")), _join(a.get("emails")), a.get("website", ""),
                        a.get("address", ""), a.get("reg_no", ""), a.get("college", ""),
                        a.get("kab_url", ""), a.get("maps_url", ""), a.get("rating") or ""])
    return len(architects)
