"""Пилот: архитект, строител и служебни контакти от проектни страници – 10 съществуващи обекта.

    python pilot_sites.py
Избор (веднъж, пази се в output/pilot_sites/selection.json):
  - 5 обекта, към които извличането вече е закачило архитект (за проверка на грешни връзки);
  - 5 обекта с най-висока оценка без архитект;
  все ново строителство за фасада, фирма-инвеститор, РЗП ≥ 5000 м², различни инвеститори,
  без ръчни потвърждения (data/confirmations.csv).
„Преди“ се записва преди първата обработка. Без платени услуги: кешираните търсения, регистрите
и обхождане на официалните сайтове.
"""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

from leads import projects
from leads.architects import address_query
from leads.enrich import architect_query, company_query, project_query
from leads.evidence import load_confirmations
from leads.runlog import RunLog
from pilot import load_raw
from run import architects_for_report, finalize

ROOT = Path(__file__).parent
OUT = ROOT / "output" / "pilot_sites"
N = 10


def eligible(final: list[dict], confs: dict) -> list[dict]:
    seen, out = set(), []
    for p in final:
        if not (p.get("facade_window") and p["kind"] == "Ново строителство" and p.get("investor_companies")):
            continue
        if p["hash"] in confs or f'{p["number"]}|{p["region"]}' in confs:
            continue
        if (p.get("rzp_with_basement") or p.get("rzp") or 0) < 5000 or p["investor_companies"][0] in seen:
            continue
        seen.add(p["investor_companies"][0])
        out.append(p)
    return out


def select(final: list[dict]) -> list[dict]:
    pool = eligible(final, load_confirmations())
    with_arch = [p for p in pool if p.get("architects")][:N // 2]
    without = [p for p in pool if not p.get("architects")][:N - len(with_arch)]
    return [{"hash": p["hash"], "number": p["number"], "region": p["region"], "investor": p["investor"],
             "why": "вече има автоматично закачен архитект" if p in with_arch else "висока оценка, без архитект"}
            for p in with_arch + without]


def portfolio_domains() -> list[str]:
    """Сайтовете на бюрата от КАБ и на строителите от КСБ (от регистрите, без търсачка)."""
    from leads import web
    doms = []
    for r in architects_for_report(ROOT / "output"):
        if r.get("website"):
            doms.append(web.domain_of(r["website"] if r["website"].startswith("http") else "https://" + r["website"]))
    for f in sorted((ROOT / "cache" / "ksb_profile").glob("*.json")):
        prof = json.loads(f.read_text(encoding="utf-8")) or {}
        for block in (prof.get("office") or {}, prof.get("seat") or {}):
            w = (block.get("website") or "").strip()
            if w and "." in w:
                doms.append(web.domain_of(w if w.startswith("http") else "https://" + w))
    return [d for d in dict.fromkeys(doms) if d and not web.is_directory("https://" + d)]


def queries(p: dict) -> list[str]:
    return [address_query(p), architect_query(p), project_query(p), company_query(p["investor_companies"][0])]


def find(final: list[dict], h: str) -> dict:
    return next((p for p in final if p["hash"] == h), None) or next(
        (p for p in final if any(o.get("hash") == h for o in p.get("other_permits") or [])), {})


def metrics(p: dict) -> dict:
    links = p.get("links") or []
    def people(prefix):
        return [c for c in p.get("contacts", []) if c.get("role", "").startswith(prefix)]
    ok_names = {(l["role"], l["name"]) for l in links if l["status"] == "потвърдена"}
    ok_eiks = {(l["role"], l.get("eik")) for l in links if l["status"] == "потвърдена" and l.get("eik")}
    def confirmed(prefix, role):
        return [c for c in people(prefix) if (role, c["name"]) in ok_names or (role, c.get("eik")) in ok_eiks]
    arch, build = confirmed("Архитект", "архитект"), confirmed("Строител", "строител")
    inv = people("Инвеститор")
    return {
        "arch_confirmed": [l["name"] for l in links if l["role"] == "архитект" and l["status"] == "потвърдена"],
        "arch_candidates": [l["name"] for l in links if l["role"] == "архитект" and l["status"] != "потвърдена"],
        "builder_confirmed": [l["name"] for l in links if l["role"] == "строител" and l["status"] == "потвърдена"],
        "builder_candidates": [l["name"] for l in links if l["role"] == "строител" and l["status"] != "потвърдена"],
        "arch_phones": sorted({x for c in arch for x in c.get("phones", [])}),
        "arch_emails": sorted({x for c in arch for x in c.get("emails", [])}),
        "builder_phones": sorted({x for c in build for x in c.get("phones", [])}),
        "builder_emails": sorted({x for c in build for x in c.get("emails", [])}),
        "investor_phones": sorted({x for c in inv for x in c.get("phones", [])}),
        "investor_emails": sorted({x for c in inv for x in c.get("emails", [])}),
        "investor_website": next((c.get("website") for c in inv if c.get("website")), ""),
        "review": p.get("review") or [],
        "rejected": [r for r in p.get("rejected_sources") or [] if "автоматична" in r.get("reason", "")],
        "project_name": (p.get("project_name") or {}).get("name", ""),
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    log = RunLog("pilot_sites")
    raw = load_raw()
    sel_path, before_path = OUT / "selection.json", OUT / "before.json"
    if not sel_path.exists() or not before_path.exists():
        if any(projects.load(p["hash"]) for p in raw if p.get("hash")):
            sys.exit("Има вече резултати в cache/projects – „преди“ няма да е чисто.")
        final = finalize([dict(p) for p in raw], date.today().isoformat())
        if not sel_path.exists():
            sel_path.write_text(json.dumps(select(final), ensure_ascii=False, indent=1), encoding="utf-8")
        selection = json.loads(sel_path.read_text(encoding="utf-8"))
        before = {s["hash"]: metrics(find(final, s["hash"])) for s in selection}
        before_path.write_text(json.dumps(before, ensure_ascii=False, indent=1), encoding="utf-8")
    selection = json.loads(sel_path.read_text(encoding="utf-8"))
    before = json.loads(before_path.read_text(encoding="utf-8"))

    # Обектите от базата във вида, в който ги вижда отчетът (със слети разрешения и контакти)
    final = finalize([dict(p) for p in raw], date.today().isoformat())
    by_hash = {s["hash"]: find(final, s["hash"]) for s in selection}
    reg = projects.Registry(architects_for_report(ROOT / "output"), log)
    f = projects.Fetcher(log)
    index = projects.other_object_index(raw)
    checked = date.today().isoformat()
    seeds_path = OUT / "portfolio_seeds.json"
    if not seeds_path.exists():
        doms = portfolio_domains()
        log.log(f"Обратно търсене в картите на {len(doms)} сайта на бюра (КАБ) и строители (КСБ) ...")
        scan = projects.Fetcher(log, http=projects.Http(delay=0.5, retries=1, timeout=12))
        seeds = projects.portfolio_seeds(scan, doms, [by_hash[s["hash"]] for s in selection])
        seeds_path.write_text(json.dumps(seeds, ensure_ascii=False, indent=1), encoding="utf-8")
    seeds = json.loads(seeds_path.read_text(encoding="utf-8"))
    for i, s in enumerate(selection, 1):
        if projects.load(s["hash"]):
            continue  # вече обработен – продължаваме оттам, докъдето е стигнато
        p = by_hash[s["hash"]]
        log.log(f"[{i}/{len(selection)}] {p['number']} {p['investor'][:50]}")
        res = projects.investigate(p, f, reg, queries(p), index, checked, seeds.get(s["hash"], []))
        projects.save(res)
        log.checkpoint("pilot_sites", done=i, total=len(selection), last=s["hash"])
    final = finalize([dict(p) for p in raw], date.today().isoformat())
    after = {s["hash"]: metrics(find(final, s["hash"])) for s in selection}
    (OUT / "after.json").write_text(json.dumps(after, ensure_ascii=False, indent=1), encoding="utf-8")
    write_report(selection, before, after, final, log)


def _n(rows, key):
    return sum(len(r[key]) for r in rows.values())


def write_report(selection, before, after, final, log) -> None:
    b, a = before, after
    lines = [f"# Пилот: проектни страници, архитект, строител и контакти ({len(selection)} обекта)", "",
             "| Показател | Преди | След |", "|---|---|---|"]
    for label, key in [("Потвърдени архитекти", "arch_confirmed"), ("Архитекти – кандидати", "arch_candidates"),
                       ("Потвърдени строители", "builder_confirmed"), ("Строители – кандидати", "builder_candidates"),
                       ("Телефони на потвърдени архитекти", "arch_phones"), ("Имейли на потвърдени архитекти", "arch_emails"),
                       ("Телефони на потвърдени строители", "builder_phones"), ("Имейли на потвърдени строители", "builder_emails"),
                       ("Телефони на инвеститори", "investor_phones"), ("Имейли на инвеститори", "investor_emails"),
                       ("Неясни случаи за преглед", "review"), ("Открити грешни връзки", "rejected")]:
        lines.append(f"| {label} | {_n(b, key)} | {_n(a, key)} |")
    lines += ["", "Всичко в колона „След“ е намерено автоматично; ръчни допълнения за тези обекти няма.", ""]
    for s in selection:
        h = s["hash"]
        p = find(final, h)
        res = projects.load(h) or {}
        lines += [f"## {p['number']} – {p['investor'][:70]}", "",
                  f"{p.get('region')}, {p.get('locality')}; КККР {p.get('kkkr') or '–'}; "
                  f"[регистър]({p.get('url')}) · избран: {s['why']}", ""]
        if a[h]["project_name"]:
            lines.append(f"**Проект:** {a[h]['project_name']}")
        for l in [x for x in p.get("links") or [] if x.get("auto")]:
            lines.append(f"- **{l['role']} – {l['status']}:** {l['name']}{' (ЕИК ' + l['eik'] + ')' if l.get('eik') else ''} – "
                         f"{l['basis']}. Източник: [{l['url'][:70]}]({l['url']})"
                         f"{' · публикувано ' + l['published'] if l.get('published') else ''} · проверено {l['date']}")
            lines.append(f"  > {l.get('snippet', '')[:300]}")
        for c in p.get("contacts", []):
            for ev in c.get("contact_evidence") or []:
                if ev.get("checked") == res.get("checked"):
                    lines.append(f"- контакт ({ev['source']}) – {c['name']}: {', '.join(c['phones'][:3])} "
                                 f"{', '.join(c['emails'][:3])} – [{ev['url'][:60]}]({ev['url']}); сайтът: {ev['note']}")
        for r in a[h]["rejected"]:
            lines.append(f"- **грешна връзка:** {r['source']} – {r['reason']} – [{r['url'][:60]}]({r['url']})")
        for r in a[h]["review"]:
            lines.append(f"- за преглед: {r['what']} – {r['reason']} – [{(r.get('url') or '')[:60]}]({r.get('url', '')})")
        pages = res.get("pages") or []
        ok = [x for x in pages if x["verdict"].startswith("за обекта") or x["verdict"] == "няколко обекта"]
        mirrors = sum(1 for x in pages if x["verdict"] == "копие на регистъра")
        lines.append(f"- прегледани страници: {len(pages)}; за обекта: {len(ok)}; копия на регистъра: {mirrors}; "
                     f"сайт на инвеститора: {', '.join(res.get('sites', {}).get('инвеститор', {})) or 'не е намерен'}")
        for x in ok:
            lines.append(f"  - [{x['url'][:80]}]({x['url']}) – {x['verdict']}: {x['basis'][:160]}"
                         f"{' · публикувано ' + x['published'] + ' (' + x['published_how'] + ')' if x['published'] else ''}")
        lines.append("")
    (OUT / "report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    log.log(f"Отчет: {OUT / 'report.md'}")


if __name__ == "__main__":
    main()
