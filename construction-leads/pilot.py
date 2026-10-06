"""Пилот: ЕИК от PDF-ите на разрешенията върху 30 обекта с висок приоритет за PHOMI.

    python pilot.py            # избор (веднъж), „преди“, обработка, „след“, отчет
Избраните обекти се пазят в output/pilot/selection.json, „преди“ – в before.json, за да е
сравнението върху едни и същи обекти, дори при повторно пускане след прекъсване.
Мрежа: само PDF-ите на 30-те разрешения (НАГ) и Търговския регистър/КСБ по ЕИК – безплатно.
"""
from __future__ import annotations

import csv
import json
import sys
from datetime import date
from pathlib import Path

from leads.classify import classify, score
from leads.eik_link import link_many, load_link
from leads.runlog import RunLog
from leads.stage import facade_window, stage
from run import finalize

ROOT = Path(__file__).parent
PILOT = ROOT / "output" / "pilot"
N = 30


def load_raw() -> list[dict]:
    permits = json.loads((ROOT / "output" / "permits.json").read_text(encoding="utf-8"))
    for p in permits:
        p["kind"], p["building_type"] = classify(p["object"])
        p["score"] = score(p)
        p["stage"], p["stage_code"] = stage(p)
        p["facade_window"] = facade_window(p)
    return permits


def inv_contacts(p: dict) -> list[dict]:
    return [c for c in p.get("contacts", []) if c.get("role", "").startswith("Инвеститор")]


def needs_work(p: dict) -> list[str]:
    why = []
    inv = inv_contacts(p)
    if not any(c.get("phones") or c.get("emails") for c in inv):
        why.append("няма контакт на инвеститора")
    if any(not c.get("eik") for c in inv) or not inv:
        why.append("няма ЕИК (несъвпадение по име)")
    return why


def select(final: list[dict]) -> list[dict]:
    cands = [p for p in final if p.get("facade_window") and p.get("investor_companies")
             and p.get("pdf_url") and needs_work(p)]
    cands.sort(key=lambda p: (-p["score"], p.get("in_force") or ""))
    # Половината без ЕИК (неясно съвпадение), половината без контакт – и двата проблема се тестват
    no_eik = [p for p in cands if "няма ЕИК (несъвпадение по име)" in needs_work(p)]
    rest = [p for p in cands if p not in no_eik]
    chosen = no_eik[:N // 2] + rest[:N - min(len(no_eik), N // 2)]
    return [{"hash": p["hash"], "number": p["number"], "region": p["region"], "score": p["score"],
             "investor": p["investor"], "why": needs_work(p)} for p in chosen[:N]]


def metrics(final_by_hash: dict, selection: list[dict]) -> list[dict]:
    rows = []
    for s in selection:
        p = final_by_hash.get(s["hash"])
        if p is None:
            # обединен в друг ред (още разрешения за същия имот)
            p = next((q for q in final_by_hash.values()
                      if any(o.get("hash") == s["hash"] for o in q.get("other_permits", []))), {})
        inv = inv_contacts(p)
        rows.append({
            "hash": s["hash"], "number": s["number"], "investor": s["investor"], "score": s["score"],
            "eik": ", ".join(c.get("eik", "") for c in inv if c.get("eik")),
            "eik_status": ", ".join(c.get("eik_status", "") for c in inv if c.get("eik_status")),
            "eik_reason": " | ".join(c.get("eik_reason", "") for c in inv if c.get("eik_reason")),
            "contact": bool(p.get("investor_phone") or p.get("investor_email")),
            "phone": p.get("investor_phone", ""), "email": p.get("investor_email", ""),
            "links_confirmed": sum(1 for l in p.get("links", []) if l["status"] == "потвърдена"),
            "links_candidate": sum(1 for l in p.get("links", []) if l["status"] != "потвърдена"),
            "stage_status": p.get("stage_status", ""),
            "milestones": len(p.get("milestones", [])),
            "document": p.get("attached_document", ""),
            "builder_confirmed": sum(1 for l in p.get("links", []) if l["role"] == "строител" and l["status"] == "потвърдена"),
        })
    return rows


def main() -> None:
    PILOT.mkdir(parents=True, exist_ok=True)
    log = RunLog("pilot")
    raw = load_raw()
    sel_path, before_path = PILOT / "selection.json", PILOT / "before.json"
    if not sel_path.exists():
        # „Преди“ = без резултатите от PDF-ите (изчисляваме, преди да има кеш за тях)
        if any(load_link(p["hash"]) for p in raw if p.get("hash")):
            sys.exit("Има вече обработени PDF-и – „преди“ няма да е чисто. Изтрийте cache/eiklink.")
        final = finalize([dict(p) for p in raw], date.today().isoformat())
        selection = select(final)
        sel_path.write_text(json.dumps(selection, ensure_ascii=False, indent=1), encoding="utf-8")
        before = metrics({p["hash"]: p for p in final}, selection)
        before_path.write_text(json.dumps(before, ensure_ascii=False, indent=1), encoding="utf-8")
        log.log(f"Избрани {len(selection)} обекта; „преди“ е записано")
    selection = json.loads(sel_path.read_text(encoding="utf-8"))
    before = json.loads(before_path.read_text(encoding="utf-8"))

    by_hash = {p["hash"]: p for p in raw}
    targets = [by_hash[s["hash"]] for s in selection]
    name_eiks = {}
    for p in targets:
        for c in inv_contacts(p):
            if c.get("eik"):
                name_eiks[c["name"]] = c["eik"]
    log.log(f"PDF и ЕИК за {len(targets)} обекта (продължава от кеша) ...")
    link_many(targets, name_eiks, log, step="pilot")

    final = finalize([dict(p) for p in raw], date.today().isoformat())
    after = metrics({p["hash"]: p for p in final}, selection)
    (PILOT / "after.json").write_text(json.dumps(after, ensure_ascii=False, indent=1), encoding="utf-8")
    write_report(before, after, log)


def write_report(before: list[dict], after: list[dict], log: RunLog) -> None:
    b, a = {r["hash"]: r for r in before}, {r["hash"]: r for r in after}
    def count(rows, f): return sum(1 for r in rows if f(r))
    statuses = {}
    for r in after:
        for st in (r["eik_status"] or "без решение").split(", "):
            statuses[st] = statuses.get(st, 0) + 1
    lines = [
        f"# Пилот: ЕИК от PDF-ите на разрешенията ({len(after)} обекта)", "",
        "| Показател | Преди | След |", "|---|---|---|",
        f"| С ЕИК на инвеститора | {count(before, lambda r: r['eik'])} | {count(after, lambda r: r['eik'])} |",
        f"| ЕИК потвърден от PDF + Търговски регистър | 0 | {count(after, lambda r: 'потвърден' in r['eik_status'])} |",
        f"| ЕИК за проверка (неясно / противоречие) | – | {count(after, lambda r: 'за проверка' in r['eik_status'])} |",
        f"| ЕИК не е разчетен от PDF | – | {count(after, lambda r: 'не е разчетен' in r['eik_status'])} |",
        f"| С контакт на инвеститора | {count(before, lambda r: r['contact'])} | {count(after, lambda r: r['contact'])} |",
        f"| Доказани връзки (архитект/строител) | {sum(r['links_confirmed'] for r in before)} | {sum(r['links_confirmed'] for r in after)} |",
        f"| Потвърден текущ етап (Акт 16 / ръчно) | {count(before, lambda r: r['stage_status'] == 'потвърден')} | {count(after, lambda r: r['stage_status'] == 'потвърден')} |",
        f"| Потвърдено начало на строежа (протокол обр. 2) | {count(before, lambda r: r.get('milestones'))} | {count(after, lambda r: r.get('milestones'))} |",
        f"| Потвърден строител (протокол + ЕИК в ТР) | {count(before, lambda r: r.get('builder_confirmed'))} | {count(after, lambda r: r.get('builder_confirmed'))} |",
        "", "Вид на документа, прикачен към разрешението: " + ", ".join(
            f"{k}: {v}" for k, v in sorted(__import__('collections').Counter(r.get('document') or '–' for r in after).items())),
        "", "## По обекти", "",
        "| № | Инвеститор | ЕИК преди | ЕИК след | Статус | Контакт преди → след | Причина |",
        "|---|---|---|---|---|---|---|",
    ]
    for h, r in a.items():
        rb = b.get(h, {})
        lines.append(f"| {r['number']} | {r['investor'][:40]} | {rb.get('eik') or '–'} | {r['eik'] or '–'} | "
                     f"{r['eik_status'] or '–'} | {'да' if rb.get('contact') else 'не'} → {'да' if r['contact'] else 'не'} | "
                     f"{(r['eik_reason'] or '')[:90]} |")
    (PILOT / "pilot_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    with open(PILOT / "za_proverka.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["Разрешение", "Инвеститор", "Статус", "Причина"])
        for r in after:
            if "потвърден" not in r["eik_status"]:
                w.writerow([r["number"], r["investor"], r["eik_status"], r["eik_reason"]])
    log.log(f"Отчет: {PILOT / 'pilot_report.md'}")


if __name__ == "__main__":
    main()
