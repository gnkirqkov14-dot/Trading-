"""Справочник: всички строители и подизпълнители от КСБ за София с контакти.

    python builders.py            # групи 1.1–1.4 (сгради) и 5 (отделни СМР)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from leads import ksb
from leads.http import Http
from run import cached, log

ROOT = Path(__file__).parent


def main() -> None:
    out = ROOT / "output"
    out.mkdir(exist_ok=True)
    http = Http()
    firms: dict[str, dict] = {}
    for code, label in ksb.GROUPS.items():
        listed = ksb.list_firms(http, code)
        log(f"{label}: {len(listed)} фирми")
        for f in listed:
            firms.setdefault(f["ksb_id"], {**f, "list_groups": []})["list_groups"].append(label)

    log(f"Общо {len(firms)} уникални фирми, сваляне на профилите ...")
    result = []
    for i, (kid, f) in enumerate(firms.items(), 1):
        try:
            prof = cached("ksb_profile", kid, lambda: ksb.profile(http, kid))
        except Exception as exc:
            log(f"  {f['name']}: {exc}")
            continue
        result.append({**prof, "name": prof.get("name") or f["name"],
                       "list_groups": f["list_groups"]})
        if i % 100 == 0:
            log(f"  {i}/{len(firms)}")
            (out / "builders.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    (out / "builders.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    log(f"Готово: {len(result)} профила -> output/builders.json")


if __name__ == "__main__":
    sys.exit(main())
