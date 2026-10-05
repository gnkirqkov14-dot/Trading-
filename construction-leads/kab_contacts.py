"""Попълва контактите на архитектурните бюра от КАБ, които не са публикували
телефон/имейл: първо Търговски регистър (безплатно), после сайтът им (Google).

    python kab_contacts.py                 # само Търговски регистър
    python kab_contacts.py --web 300       # + до 300 Google търсения
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from leads import tr, web
from leads.enrich import google_cached
from leads.http import Http
from leads.ksb import normalize_name
from run import cached, log

ROOT = Path(__file__).parent
LEGAL = re.compile(r"\b(ЕООД|ООД|ЕАД|АД|ЕТ)\b")


def has_contact(b: dict) -> bool:
    return bool(b.get("phones") or b.get("emails"))


def add(b: dict, phones=(), emails=(), website: str = "", source: str = "") -> None:
    for ph in phones:
        ph = web._clean_phone(ph or "") or (ph or "").strip()
        if ph and ph not in b.setdefault("phones", []):
            b["phones"].append(ph)
    for em in emails:
        em = (em or "").strip().lower()
        if em and em not in b.setdefault("emails", []):
            b["emails"].append(em)
    if website and not b.get("website"):
        b["website"] = website
    if source:
        b.setdefault("contact_sources", [])
        if source not in b["contact_sources"]:
            b["contact_sources"].append(source)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--web", type=int, default=0, help="макс. брой Google търсения")
    args = ap.parse_args()
    path = ROOT / "output" / "architects.json"
    bureaus = json.loads(path.read_text(encoding="utf-8"))

    http_tr = Http(delay=6.0)
    todo = [b for b in bureaus if not has_contact(b) and LEGAL.search(b["name"])]
    log(f"Търговски регистър за {len(todo)} бюра ...")
    for i, b in enumerate(todo, 1):
        key = normalize_name(b["name"]) + "|" + tr._legal_form(b["name"])
        try:
            rec = cached("tr", key, lambda: tr.find_company(http_tr, b["name"]))
        except Exception:
            rec = None
        if rec:
            b["eik"] = rec["eik"]
            add(b, [rec["phone"]], [rec["email"]], rec["website"], "Търговски регистър")
        if i % 25 == 0:
            log(f"  {i}/{len(todo)} (с контакт: {sum(has_contact(x) for x in bureaus)})")
            path.write_text(json.dumps(bureaus, ensure_ascii=False), encoding="utf-8")
    path.write_text(json.dumps(bureaus, ensure_ascii=False), encoding="utf-8")

    if args.web:
        http = Http()
        rest = [b for b in bureaus if not has_contact(b) and not b.get("website")][:args.web]
        queries = {b["url"]: f'"{normalize_name(b["name"])}" архитект' for b in rest}
        results = google_cached(http, list(queries.values()), cached, log)
        log(f"Сайтове на {len(rest)} бюра ...")
        for b in rest:
            owners = " ".join(b.get("owners") or [])
            surnames = [web.translit(w) for w in re.findall(r"[А-Я][а-я]{3,}", owners)][-2:]
            for r in results.get(queries[b["url"]], []):
                url = r.get("url") or ""
                dom = re.sub(r"[^a-z0-9]", "", web.domain_of(url))
                if web.is_directory(url):
                    continue
                if web.matches_company(url, b["name"]) or any(s[:6] in dom for s in surnames if len(s) >= 5):
                    try:
                        found = cached("site", web.domain_of(url), lambda: web.site_contacts(http, url))
                    except Exception:
                        continue
                    if not found:
                        continue
                    add(b, found["phones"], found["emails"], found["website"], "сайт на бюрото")
                    break
        path.write_text(json.dumps(bureaus, ensure_ascii=False), encoding="utf-8")
    log(f"Готово: с контакт {sum(has_contact(x) for x in bureaus)} от {len(bureaus)}")


if __name__ == "__main__":
    main()
