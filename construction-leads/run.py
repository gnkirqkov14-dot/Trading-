"""Събира нови строителни обекти за София и прави CSV / JSON / HTML отчет.

    python run.py --days 30
    python run.py --days 7 --no-web        # само регистрите, без Google
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

from leads import nag_sofia
from leads.enrich import enrich, kab_domains
from leads.classify import classify, companies_in, score
from leads.http import Http
from leads.stage import facade_window, mark_act16, stage
from leads.ksb import normalize_name
from leads.visuals import _loose
from leads.web import _clean_phone, domain_of
from leads.report import write_html

ROOT = Path(__file__).parent
CACHE = ROOT / "cache"


def cached(name: str, key: str, fetch, overwrite: bool = False):
    """Кеш на диск, за да не теглим един и същ детайл/профил повторно."""
    folder = CACHE / name
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / (hashlib.sha1(key.encode()).hexdigest()[:16] + ".json")
    if path.exists() and not overwrite:
        return json.loads(path.read_text(encoding="utf-8"))
    value = fetch()
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    return value


def builders_for_report(out: Path) -> list[dict]:
    """Справочникът от builders.py (ако е пускан), сведен до нужното за отчета."""
    path = out / "builders.json"
    if not path.exists():
        return []
    rows = []
    for b in json.loads(path.read_text(encoding="utf-8")):
        blocks = [b.get("office") or {}, b.get("seat") or {}]
        phones = list(dict.fromkeys(filter(None, (_clean_phone(x.get("phone", "")) or x.get("phone", "").strip()
                                                   for x in blocks))))
        emails = list(dict.fromkeys(x.get("email", "").strip().lower() for x in blocks if "@" in x.get("email", "")))
        rows.append({
            "name": b.get("name", ""), "eik": b.get("eik", ""), "ksb_url": b.get("ksb_url", ""),
            "list_groups": b.get("list_groups", []), "works": b.get("works", []),
            "representatives": b.get("representatives", []),
            "phones": phones, "emails": emails,
            "website": next((x.get("website", "").strip() for x in blocks if x.get("website", "").strip()), ""),
        })
    rows.sort(key=lambda r: (not r["phones"], r["name"].lower()))
    return rows


def architects_for_report(out: Path) -> list[dict]:
    """Справочникът от architects.py (КАБ), почистен за отчета."""
    path = out / "architects.json"
    if not path.exists():
        return []
    rows = []
    for a in json.loads(path.read_text(encoding="utf-8")):
        address, website = a.get("address", ""), a.get("website", "")
        m = re.search(r"\s*(?:България\s*)?Уебсайт\s*(\S+)", address)
        if m:
            website = website or m.group(1)
            address = address[:m.start()]
        rows.append({
            **{k: a.get(k) for k in ("name", "college", "reg_no", "kab_url", "owners", "staff", "contact_person")},
            "address": address.strip(" ,"),
            "website": website,
            "phones": a.get("phones", []),
            "emails": [e for e in a.get("emails", []) if not e.endswith("@kab.bg")],
        })
    merge_maps(rows, out)
    rows.sort(key=lambda r: (not (r["phones"] or r["emails"]), r["name"].lower().strip('"„ ')))
    return rows


MAPS_CATEGORIES = {"Архитект", "Архитектурна фирма", "Архитектурен дизайнер", "Интериорен дизайнер",
                   "Ландшафтен архитект", "Архитектурно бюро"}


def merge_maps(rows: list[dict], out: Path) -> None:
    """Добавя архитектурните бюра от Google Maps (output/maps_architects*.json):
    съвпадение с КАБ по сайт, телефон или име, иначе нов запис."""
    places = {}
    for f in sorted(out.glob("maps_architects*.json")):
        for x in json.loads(f.read_text(encoding="utf-8")):
            if x.get("placeId") and not x.get("permanentlyClosed"):
                places[x["placeId"]] = x
    by_domain, by_phone, by_name = {}, {}, {}
    for r in rows:
        if r.get("website"):
            by_domain[domain_of(r["website"] if "//" in r["website"] else "https://" + r["website"])] = r
        for ph in r["phones"]:
            by_phone[_clean_phone(ph) or ph] = r
        by_name[_loose(normalize_name(r["name"]))] = r
    for x in places.values():
        title, cat = x.get("title") or "", x.get("categoryName") or ""
        if cat not in MAPS_CATEGORIES and not re.search(r"(?i)арх|arch", title):
            continue
        phone = _clean_phone(x.get("phone") or "") or (x.get("phone") or "")
        dom = domain_of(x["website"]) if x.get("website") else ""
        r = (by_domain.get(dom) if dom else None) or (by_phone.get(phone) if phone else None) \
            or by_name.get(_loose(normalize_name(title)))
        if r is None:
            r = {"name": title, "college": "", "reg_no": "", "kab_url": "", "owners": [], "staff": [],
                 "contact_person": "", "address": x.get("address") or "", "website": "",
                 "phones": [], "emails": []}
            rows.append(r)
        if phone and phone not in r["phones"]:
            r["phones"].append(phone)
        if x.get("website") and not r.get("website"):
            r["website"] = x["website"]
        r["maps_url"] = x.get("url") or ""
        r["rating"] = x.get("totalScore")
        r["category"] = cat


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--days", type=int, default=540, help="колко дни назад (по дата на влизане в сила)")
    ap.add_argument("--limit", type=int, default=None, help="макс. брой разрешения (за тест)")
    ap.add_argument("--no-details", action="store_true", help="без детайлите (РЗП, категория, надзор)")
    ap.add_argument("--no-contacts", action="store_true", help="без търсене на контакти")
    ap.add_argument("--no-web", action="store_true", help="без Google/сайтове (само регистрите)")
    ap.add_argument("--out", default=str(ROOT / "output"))
    ap.add_argument("--web-min-score", type=int, default=55,
                    help="Google/сайтове само за обекти с поне тази оценка в момента за фасада")
    ap.add_argument("--report-only", action="store_true", help="само нов report.html от записаните данни")
    args = ap.parse_args()

    since = date.today() - timedelta(days=args.days)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    if args.report_only:
        load = lambda n: json.loads((out / n).read_text(encoding="utf-8"))
        permits = load("permits.json")
        dates = [p["in_force"] for p in permits if p.get("in_force")]
        if dates:  # началото на данните, а не на --days
            since = date.fromisoformat(min(dates))
        write_html(out / "report.html", permits, load("visas.json"), load("oesut.json"),
                   since, builders_for_report(out), architects_for_report(out))
        log(f"Готово: {out / 'report.html'}")
        return
    http = Http()

    log(f"Разрешения за строеж от {since} ...")
    permits = nag_sofia.fetch_permits(http, since, limit=args.limit)
    log(f"  {len(permits)} разрешения")

    for i, p in enumerate(permits, 1):
        if not args.no_details and p.get("hash"):
            try:
                p.update(cached("permit", p["hash"],
                                lambda: nag_sofia.fetch_permit_detail(http, p["hash"])))
            except Exception as exc:  # един счупен детайл не спира всичко
                log(f"  детайл {p['number']}: {exc}")
            if i % 25 == 0:
                log(f"  детайли {i}/{len(permits)}")
        p["kind"], p["building_type"] = classify(p["object"])
        p["investor_companies"] = companies_in(p["investor"])
        p["investor_is_company"] = bool(p["investor_companies"]) or "ОБЩИНА" in p["investor"].upper()
        p["score"] = score(p)

    log("Удостоверения за въвеждане в експлоатация (Акт 16) ...")
    certificates = nag_sofia.fetch_occupancy(http, since)
    log(f"  {len(certificates)} удостоверения, свързани с разрешения: {mark_act16(permits, certificates)}")
    for p in permits:
        p["stage"], p["stage_code"] = stage(p)
        p["facade_window"] = facade_window(p)

    companies: dict[str, dict] = {}
    if not args.no_contacts:
        companies = enrich(permits, http, cached, use_web=not args.no_web, log=log,
                           web_filter=lambda p: p["facade_window"] and p["score"] >= args.web_min_score,
                           only=lambda p: p["facade_window"],
                           kab_by_domain=kab_domains(architects_for_report(out)))

    permits.sort(key=lambda p: p.get("in_force") or "", reverse=True)
    permits.sort(key=lambda p: p["score"], reverse=True)

    log(f"Визи за проектиране от {since} ...")
    visas = nag_sofia.fetch_visas(http, since)
    log(f"  {len(visas)} визи")

    log(f"Протоколи от ОЕСУТ от {since} ...")
    protocols = nag_sofia.fetch_oesut_protocols(http, since)
    log(f"  {len(protocols)} протокола")

    # ---- запис ----
    (out / "permits.json").write_text(json.dumps(permits, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "visas.json").write_text(json.dumps(visas, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "oesut.json").write_text(json.dumps(protocols, ensure_ascii=False, indent=1), encoding="utf-8")
    (out / "companies.json").write_text(json.dumps(companies, ensure_ascii=False, indent=1), encoding="utf-8")

    cols = ["score", "facade_window", "stage", "kind", "building_type", "category", "rzp", "rzp_with_basement",
            "number", "in_force", "region", "address", "object", "investor", "investor_eik",
            "investor_managers", "investor_phone", "investor_email", "investor_website",
            "supervision", "architect",
            "url", "pdf_url", "map_url"]
    with open(out / "permits.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(permits)
    with open(out / "visas.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["issued", "number", "region", "basis", "scope", "files"],
                           extrasaction="ignore")
        w.writeheader()
        for v in visas:
            w.writerow({**v, "files": " ".join(v["files"])})

    write_html(out / "report.html", permits, visas, protocols, since, builders_for_report(out),
               architects_for_report(out))
    log(f"Готово: {out}")


if __name__ == "__main__":
    main()
