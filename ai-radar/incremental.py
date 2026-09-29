"""Повторно ползване на вече готов анализ (напр. „Обнови сега“ в същия ден).

    python3 incremental.py split work/prev_analysis.json work/
        -> work/compact_new.json: само елементите без анотация + списък с темите
    python3 incremental.py merge work/prev_analysis.json work/analysis_new.json work/
        -> work/analysis.json: старите анотации + новите (новите печелят)
"""
import json
import sys
from pathlib import Path


def split(prev_p: Path, work: Path) -> None:
    prev = json.loads(prev_p.read_text(encoding="utf-8"))
    comp = json.loads((work / "compact.json").read_text(encoding="utf-8"))
    done = prev.get("items", {})
    new = [i for i in comp["items"] if i["id"] not in done]
    topics = [{k: t.get(k) for k in ("id", "name", "category", "importance", "hype")} for t in prev["topics"]]
    (work / "compact_new.json").write_text(json.dumps({"generated_at": comp["generated_at"], "existing_topics": topics,
                                                       "items": new}, ensure_ascii=False, indent=0), encoding="utf-8")
    print(f"{len(new)} нови елемента от {len(comp['items'])}")


def merge(prev_p: Path, new_p: Path, work: Path) -> None:
    prev = json.loads(prev_p.read_text(encoding="utf-8"))
    new = json.loads(new_p.read_text(encoding="utf-8"))
    topics = {t["id"]: t for t in prev["topics"]}
    for t in new.get("topics", []):
        topics[t["id"]] = {**topics.get(t["id"], {}), **t}
    live = {i["id"] for i in json.loads((work / "compact.json").read_text(encoding="utf-8"))["items"]}
    items = {k: v for k, v in {**prev.get("items", {}), **new.get("items", {})}.items() if k in live or k.startswith("w:")}
    ok = set(items) | {k for k in items if k.startswith("w:")}
    for t in topics.values():  # махни препратки към елементи, които вече ги няма
        t["watch"] = [i for i in t.get("watch") or [] if i in ok]
        t["read"] = [i for i in t.get("read") or [] if i in ok]
    out = {**prev, **{k: v for k, v in new.items() if k in ("brief", "people", "date") and v},
           "topics": list(topics.values()), "items": items}
    d = new.get("discovered") or {}
    if d.get("people") or d.get("channels"):
        out["discovered"] = d
    (work / "analysis.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"{len(out['topics'])} теми, {len(out['items'])} анотации")


if __name__ == "__main__":
    if sys.argv[1] == "split":
        split(Path(sys.argv[2]), Path(sys.argv[3]))
    else:
        merge(Path(sys.argv[2]), Path(sys.argv[3]), Path(sys.argv[4]))
