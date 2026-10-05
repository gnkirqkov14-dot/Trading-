"""Търси архитекта на всяка нова сграда от output/permits.json.

    python find_architects.py && python run.py --report-only

Ползва кешираните Google търсения по инвеститора + нови търсения по адреса,
отваря страниците на проекта, вади името на архитекта и го сверява с КАБ.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from leads import web
from leads.architects import (KabIndex, address_query, mentions, name_query, page_text,
                              stage_hints, street_of)
from leads.enrich import (_merge, _new_contact, architect_contact, directory_links, google_cached,
                          visual_queries)
from leads.http import Http
from leads.visuals import NO_IMAGE_DOMAINS, _loose, relevant
from run import architects_for_report, cached, log

ROOT = Path(__file__).parent
MAX_PAGES = 6


def keywords(p: dict) -> list[str]:
    """Думи, по които страницата трябва да е за този обект."""
    keys = []
    street = street_of(p.get("address", ""))
    if street:
        keys.append(_loose(re.sub(r"^(ул\.|бул\.)\s*", "", street).split()[0]))
    for c in p.get("investor_companies", []):
        keys += [_loose(t) for t in re.split(r"[\s\-./\"„“]+", c) if len(t) >= 5
                 and t.upper() not in {"ЕООД", "ИНВЕСТ", "БИЛД", "СТРОЙ", "ГРУП", "КОНСУЛТ"}]
    return [k for k in keys if len(k) >= 4]


def candidate_pages(p: dict, results: dict, queries: list[str]) -> list[dict]:
    keys = keywords(p)
    out, seen = [], set()
    for q in queries:
        for r in results.get(q, []):
            url = r.get("url") or ""
            host = web.domain_of(url)
            if not url or url in seen or any(host == d or host.endswith("." + d) for d in NO_IMAGE_DOMAINS):
                continue
            if host.endswith(("facebook.com", "instagram.com", "youtube.com", "linkedin.com")):
                continue
            hay = _loose(" ".join([url, r.get("title", ""), r.get("description", "")]))
            if any(k in hay for k in keys):
                seen.add(url)
                out.append(r)
    return out[:MAX_PAGES]


def safe_page_text(http: Http, url: str) -> str:
    """Текстът на страницата или "" – и неуспехът се кешира, за да не се пробва всеки път."""
    try:
        return page_text(http, url)
    except Exception:
        return ""


def resolve(name: str, kab: KabIndex, http: Http, results_by_name: dict) -> dict:
    """Име на архитект/бюро -> контакт (КАБ или сайт от Google)."""
    c = _new_contact(name)
    b = kab.find(name)
    if b:
        c["name"] = b["name"] + (f" ({name})" if name.startswith("арх.") else "")
        c["managers"] = (b.get("owners") or [])[:3]
        directory_links(c, b)
        c["in_kab"] = bool(b.get("kab_url"))
        _merge(c, b.get("phones", []), b.get("emails", []), b.get("website", ""),
               "КАБ" if b.get("kab_url") else "Google Maps")
    if not (c["phones"] or c["emails"]):
        toks = [t for t in re.split(r"\s+", web.translit(name.replace("арх.", ""))) if len(t) >= 4]
        for r in results_by_name.get(name_query(name), []):
            url = r.get("url") or ""
            dom = web.domain_of(url)
            if web.is_directory(url) or dom.rsplit(".", 1)[-1] not in {"bg", "com", "eu", "net", "studio"}:
                continue
            title = _loose(r.get("title", "") + " " + r.get("description", ""))
            if any(t[:6] in re.sub(r"[^a-z]", "", dom) for t in toks) or (
                    re.search(r"arch|arh", dom) and any(_loose(t)[:5] in title for t in name.split() if len(t) > 3)):
                try:
                    found = cached("site", dom, lambda: web.site_contacts(http, url))
                except Exception:
                    continue
                _merge(c, found["phones"], found["emails"], found["website"], "сайт на архитекта")
                c["links"]["Сайт"] = found["website"]
                break
    return c


def main(min_score: int = 50) -> None:
    out = ROOT / "output"
    permits = json.loads((out / "permits.json").read_text(encoding="utf-8"))
    kab = KabIndex(architects_for_report(out))
    # Само обектите в момента за фасада, най-добрите първи (при ограничен бюджет за Google)
    targets = sorted((p for p in permits if p.get("kind") == "Ново строителство" and p.get("score", 0) >= min_score
                      and p.get("facade_window", True)), key=lambda p: -p.get("score", 0))
    http = Http()
    page_http = Http(retries=1, timeout=15)  # чужди сайтове: без дълги повторни опити

    queries = {p["number"]: [address_query(p)] + (visual_queries(p) if p.get("investor_companies") else [])
               for p in targets}
    results = google_cached(http, list(dict.fromkeys(q for qs in queries.values() for q in qs)), cached, log)

    log(f"Страници на проектите за {len(targets)} обекта ...")
    found_names: dict[str, list[tuple[str, dict]]] = {}
    for i, p in enumerate(targets, 1):
        names = []
        for r in candidate_pages(p, results, queries[p["number"]]):
            text = cached("pagetext", r["url"], lambda: safe_page_text(page_http, r["url"]))
            if not text:
                continue
            for n in mentions(text):
                names.append((n, {"url": r["url"], "title": r.get("title", "")}))
            for h in stage_hints(text):
                p.setdefault("stage_hints", [])
                if h not in [x["text"] for x in p["stage_hints"]]:
                    p["stage_hints"].append({"text": h, "url": r["url"]})
            dom = web.domain_of(r["url"])
            if re.search(r"arch|arh", dom.replace("search", "")) and relevant(r, (p.get("investor_companies") or [""])[0] or p.get("locality", "")):
                names.append((dom, {"url": r["url"], "title": r.get("title", "")}))
        found_names[p["number"]] = names
        if i % 20 == 0:
            log(f"  {i}/{len(targets)}")

    unresolved = sorted({n for names in found_names.values() for n, _ in names if not kab.find(n)})
    log(f"Имена за търсене в Google: {len(unresolved)}")
    by_name = google_cached(http, [name_query(n) for n in unresolved], cached, log)

    with_arch = 0
    for p in targets:
        archs, seen = [], set()
        for name, evidence in found_names[p["number"]]:
            c = resolve(name, kab, http, by_name)
            if c["name"] in seen:
                continue
            seen.add(c["name"])
            c["evidence"] = {**evidence, "mention": name}
            archs.append(c)
        # Първо тези с контакт и от КАБ
        archs.sort(key=lambda a: (not a.get("in_kab"), not (a["phones"] or a["emails"])))
        p["architects"] = archs[:3]
        p["contacts"] = [c for c in p.get("contacts", []) if not c["role"].startswith("Архитект")]
        p["contacts"] += [architect_contact(a) for a in p["architects"]]
        p["architect"] = "; ".join(
            f'{a["name"]} {" ".join(a["phones"][:1])} {" ".join(a["emails"][:1])}'.strip() for a in p["architects"])
        with_arch += bool(p["architects"])
    log(f"Обекти с архитект: {with_arch} от {len(targets)}")
    log(f"Обекти с етап от обявите (Акт 14/16): {sum(bool(p.get('stage_hints')) for p in targets)}")
    (out / "permits.json").write_text(json.dumps(permits, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
