"""Контакти за пловдивските бюра от КАБ, за които няма телефон или имейл: търсене в Google (Apify)
и сайтът на бюрото, само когато домейнът отговаря на името му.

    python plovdiv_kab_google.py  ->  output/plovdiv/kab_google_kontakti.json
"""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path

from leads import web
from leads.http import Http
from leads.runlog import RunLog

ROOT = Path(__file__).parent
ARCH = ROOT / "output" / "plovdiv" / "arhitekti.csv"
OUT = ROOT / "output" / "plovdiv" / "kab_google_kontakti.json"
LEGAL = re.compile(r"(?i)[\"„“”']|\b(е?оод|еад|ад|ет|свободна професия|едноличен търговец)\b")


def core(name: str) -> str:
    return re.sub(r"\s+", " ", LEGAL.sub(" ", name)).strip()


def main() -> None:
    log = RunLog("plovdiv_kab_google")
    with ARCH.open(encoding="utf-8-sig") as f:
        rows = [r for r in csv.DictReader(f, delimiter=";") if not r["Телефон"].strip() and not r["Имейл"].strip()]
    done = json.loads(OUT.read_text(encoding="utf-8")) if OUT.exists() else {}
    todo = [r for r in rows if (r["Рег. № КАБ"] or r["Бюро"]) not in done]
    log.log(f"{len(rows)} бюра без контакт, нови за търсене: {len(todo)}")
    http = Http(delay=0.6, retries=1, timeout=20)
    queries = {(r["Рег. № КАБ"] or r["Бюро"]): f'"{core(r["Бюро"])}" архитект Пловдив' for r in todo}
    results = web.google(http, list(queries.values())) if queries else {}
    for r in todo:
        key, name = r["Рег. № КАБ"] or r["Бюро"], core(r["Бюро"])
        res = results.get(queries[key], [])
        entry = {"name": r["Бюро"], "phones": [], "emails": [], "website": "", "source": ""}
        site = web.pick_company_site(res, name)
        if site:
            try:
                c = web.site_contacts(http, site)
                entry.update(phones=c["phones"], emails=c["emails"], website=c["website"], source=site)
            except Exception as exc:
                log.failure("site", site, exc, site)
        if not entry["phones"]:
            # телефон в описанието на резултат, чието заглавие съдържа името на бюрото
            for x in res:
                if name.lower() in (x.get("title") or "").lower():
                    m = web.PHONE_RX.search(x.get("description") or "")
                    ph = web._clean_phone(m.group(0)) if m else ""
                    if ph and not ph.startswith("+3590"):
                        entry.update(phones=[ph], source=entry["source"] or x["url"])
                        break
        done[key] = entry
    OUT.write_text(json.dumps(done, ensure_ascii=False, indent=1), encoding="utf-8")
    log.log(f"с телефон {sum(1 for e in done.values() if e['phones'])}, с имейл "
            f"{sum(1 for e in done.values() if e['emails'])} от {len(done)} -> {OUT}")


if __name__ == "__main__":
    main()
