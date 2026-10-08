"""Преизчислява архитектите и визуализациите на вече събраните обекти
(output/permits.json) – от кешираните Google резултати, без нови разходи.

    python visuals.py && python run.py --report-only
"""
from __future__ import annotations

import json
from pathlib import Path

from leads.enrich import (add_architects, architect_contact, google_cached, kab_domains,
                          visual_queries)
from leads.http import Http
from leads.visuals import add_visuals
from run import architects_for_report, cached, log

ROOT = Path(__file__).parent


def main(min_score: int = 55) -> None:
    out = ROOT / "output"
    permits = json.loads((out / "permits.json").read_text(encoding="utf-8"))
    contacts = json.loads((out / "companies.json").read_text(encoding="utf-8"))
    targets = [p for p in permits if p.get("kind") == "Ново строителство"
               and p.get("score", 0) >= min_score and p.get("investor_companies")]
    http = Http()
    results = google_cached(http, sorted({q for p in targets for q in visual_queries(p)}), cached, log)

    log(f"Архитекти за {len(targets)} обекта ...")
    add_architects(targets, results, contacts, http, cached, kab_domains(architects_for_report(out)))
    for p in targets:
        p["contacts"] = [c for c in p.get("contacts", []) if not c["role"].startswith("Архитект")]
        p["contacts"] += [architect_contact(a) for a in p["architects"]]
        p["architect"] = "; ".join(
            f'{a["name"]} {" ".join(a["phones"][:1])} {" ".join(a["emails"][:1])}'.strip()
            for a in p["architects"])
    log(f"  с архитект: {sum(bool(p['architects']) for p in targets)}")

    log(f"Визуализации за {len(targets)} обекта ...")
    add_visuals(targets, results, visual_queries, http, cached, log)
    (out / "permits.json").write_text(json.dumps(permits, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
