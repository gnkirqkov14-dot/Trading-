#!/usr/bin/env python3
"""Възстановява предишния анализ от записания в таблото брой (ако work/prev липсва — нов контейнер).

Употреба: python3 rebuild_prev.py work/dbread <дата> work/prev_analysis.json
Чете digests/<дата>.json и digest_items/<дата>-N.json (от `ArtifactData get ... out_dir`).
Елементите, отбелязани „off“, не се пазят в брой, затова при следващото разделяне
ще се покажат като нови — това е безобидно.
"""
import json
import sys
from pathlib import Path


def load(p: Path) -> dict:
    d = json.loads(p.read_text(encoding="utf-8"))
    return d.get("data", d)


def main(dbread: Path, date: str, out: Path) -> None:
    dg = load(dbread / "digests" / f"{date}.json")
    items = {}
    for n in range(1, 50):
        p = dbread / "digest_items" / f"{date}-{n}.json"
        if not p.exists():
            break
        for it in load(p)["items"]:
            a = {k: it[k] for k in ("t", "s", "imp", "v") if it.get(k) is not None}
            if it["id"].startswith("w:"):
                a.update(k=it.get("kind", "article"), title=it.get("title"), url=it.get("url"),
                         src=it.get("src") or it.get("channel"))
            items[it["id"]] = a
    keep = ("id", "name", "category", "summary", "why", "importance", "hype", "people", "watch", "read")
    topics = [{k: t[k] for k in keep if k in t} for t in dg["topics"]]
    analysis = {"date": dg["date"], "brief": dg["brief"], "topics": topics, "items": items,
                "people": [{k: p[k] for k in ("name", "said", "items") if k in p} for p in dg["people"]]}
    out.write_text(json.dumps(analysis, ensure_ascii=False), encoding="utf-8")
    print(f"{len(topics)} теми, {len(items)} елемента → {out}")


if __name__ == "__main__":
    main(Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3]))
