"""Събира нови строителни обекти за София и прави CSV / JSON / HTML отчет.

    python run.py --days 30
    python run.py --days 7 --no-ksb        # без търсене на контакти в КСБ
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from datetime import date, timedelta
from pathlib import Path

from leads import ksb, nag_sofia
from leads.classify import classify, companies_in, score
from leads.http import Http
from leads.report import write_html

ROOT = Path(__file__).parent
CACHE = ROOT / "cache"


def cached(name: str, key: str, fetch):
    """Кеш на диск, за да не теглим един и същ детайл/профил повторно."""
    folder = CACHE / name
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / (hashlib.sha1(key.encode()).hexdigest()[:16] + ".json")
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    value = fetch()
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    return value


def log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--days", type=int, default=90, help="колко дни назад (по дата на влизане в сила)")
    ap.add_argument("--limit", type=int, default=None, help="макс. брой разрешения (за тест)")
    ap.add_argument("--no-details", action="store_true", help="без детайлите (РЗП, категория, надзор)")
    ap.add_argument("--no-ksb", action="store_true", help="без търсене на фирмите в КСБ")
    ap.add_argument("--out", default=str(ROOT / "output"))
    args = ap.parse_args()

    since = date.today() - timedelta(days=args.days)
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
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

    companies: dict[str, dict] = {}
    if not args.no_ksb:
        names = {c for p in permits for c in p["investor_companies"]}
        log(f"Търсене на {len(names)} фирми-възложители в регистъра на КСБ ...")
        for name in sorted(names):
            key = ksb.normalize_name(name)
            try:
                prof = cached("ksb", key or "empty", lambda: ksb.find_company(http, name))
            except Exception as exc:
                log(f"  КСБ {name}: {exc}")
                prof = None
            if prof:
                companies[name] = prof
        log(f"  {len(companies)} намерени в КСБ")
        for p in permits:
            prof = next((companies[c] for c in p["investor_companies"] if c in companies), None)
            if prof:
                c = prof["office"] if prof["office"].get("phone") else prof["seat"]
                p["investor_eik"] = prof["eik"]
                p["investor_phone"] = c.get("phone", "")
                p["investor_email"] = c.get("email", "")
                p["investor_website"] = c.get("website", "")
                p["investor_ksb_url"] = prof["ksb_url"]

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

    cols = ["score", "kind", "building_type", "category", "rzp", "rzp_with_basement",
            "number", "in_force", "region", "address", "object", "investor", "investor_eik",
            "investor_phone", "investor_email", "investor_website", "supervision",
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

    write_html(out / "report.html", permits, visas, protocols, since)
    log(f"Готово: {out}")


if __name__ == "__main__":
    main()
