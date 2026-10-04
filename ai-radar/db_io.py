"""Мост между базата на таблото (ArtifactData) и скриптовете.

    python3 db_io.py import work/dbread work/
        dbread/ е папката от ArtifactData read с out_dir (sources/, history/, prefs/).
        Прави work/user_sources.json, history.json, prefs.json, prev_topics.json.

    python3 db_io.py statuses work/
        От work/resolved_sources.json прави work/source_updates.json —
        {doc_id, data} за ArtifactData batch "update" на sources/<doc_id>.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


def read_dir(p: Path) -> dict[str, dict]:
    return {f.stem: json.loads(f.read_text(encoding="utf-8")) for f in sorted(p.glob("*.json"))} if p.exists() else {}


def cmd_import(dbread: Path, work: Path) -> None:
    sources = [{"doc_id": k, **v} for k, v in read_dir(dbread / "sources").items()]
    history = list(read_dir(dbread / "history").values())
    prefs = read_dir(dbread / "prefs").get("main", {})
    prev = {}
    for h in sorted(history, key=lambda h: h.get("date", "")):
        for tid, t in (h.get("topics") or {}).items():
            prev[tid] = {"id": tid, "name": t.get("name"), "category": t.get("category"), "last_seen": h.get("date"),
                         "importance": t.get("importance")}
    for name, data in (("user_sources", sources), ("history", history), ("prefs", prefs),
                       ("prev_topics", sorted(prev.values(), key=lambda t: t["last_seen"] or "", reverse=True)[:60])):
        (work / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(sources)} източника, {len(history)} дни история, {len(prev)} предишни теми, prefs: {sorted(prefs)}")


def cmd_statuses(work: Path) -> None:
    """Само промените: статус/канал/RSS, които се различават от записаното в базата (иначе batch-ът расте с всеки източник)."""
    cur = {s["doc_id"]: s for s in json.loads((work / "user_sources.json").read_text(encoding="utf-8"))}
    ups = []
    for r in json.loads((work / "resolved_sources.json").read_text(encoding="utf-8")):
        if not r.get("doc_id"):
            continue
        data = {k: r[k] for k in ("status", "error", "channel_id", "resolved_name", "feed_url") if r.get(k) is not None}
        old = cur.get(r["doc_id"], {})
        changed = {k: v for k, v in data.items() if old.get(k) != v}
        if old.get("error") and r.get("status") == "ok":
            changed["error"] = {"__delete__": True}
        if changed:
            ups.append({"doc_id": r["doc_id"], "data": changed})
    (work / "source_updates.json").write_text(json.dumps(ups, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{len(ups)} обновявания на източници → {work / 'source_updates.json'}")


if __name__ == "__main__":
    if len(sys.argv) >= 4 and sys.argv[1] == "import":
        cmd_import(Path(sys.argv[2]), Path(sys.argv[3]))
    elif len(sys.argv) >= 3 and sys.argv[1] == "statuses":
        cmd_statuses(Path(sys.argv[2]))
    else:
        print(__doc__)
        sys.exit(2)
