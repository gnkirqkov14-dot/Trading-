"""Справочник: проектантски бюра от регистъра на КАБ (София) с контакти.

    python architects.py
"""
from __future__ import annotations

import json
from pathlib import Path

from leads import kab
from leads.http import Http
from run import cached, log

ROOT = Path(__file__).parent


def main() -> None:
    out = ROOT / "output"
    out.mkdir(exist_ok=True)
    http = Http(delay=0.8, timeout=90)
    bureaus = []
    for code, label in kab.COLLEGES.items():
        listed = cached("kab_list", code, lambda: kab.list_bureaus(http, code))
        log(f"{label}: {len(listed)} бюра")
        bureaus += listed
    result = []
    for i, b in enumerate(bureaus, 1):
        try:
            detail = cached("kab_bureau", b["url"], lambda: kab.bureau(http, b["url"]))
        except Exception as exc:
            log(f"  {b['name']}: {exc}")
            continue
        result.append({**b, **detail})
        if i % 50 == 0:
            log(f"  {i}/{len(bureaus)}")
            (out / "architects.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    (out / "architects.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    log(f"Готово: {len(result)} бюра -> output/architects.json")


if __name__ == "__main__":
    main()
