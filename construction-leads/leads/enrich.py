"""Контакти за фирмите от разрешенията: инвеститор, строителен надзор,
строител (ако инвеститорът е вписан в КСБ) и вероятен архитект.

Ред на източниците: Търговски регистър -> КСБ -> сайт на фирмата (намерен
чрез Google). Всичко се кешира, затова повторно пускане не тегли отново.
"""
from __future__ import annotations

from typing import Callable

from . import ksb, tr, visuals, web
from .classify import companies_in
from .http import Http

Cache = Callable[[str, str, Callable], object]


def _merge(contact: dict, phones=(), emails=(), website: str = "", source: str = "") -> None:
    for ph in phones:
        ph = web._clean_phone(ph or "") or (ph or "").strip()
        if ph and ph not in contact["phones"]:
            contact["phones"].append(ph)
    for em in emails:
        em = (em or "").strip().lower()
        if em and em not in contact["emails"]:
            contact["emails"].append(em)
    if website and not contact["website"]:
        contact["website"] = website if website.startswith("http") else "https://" + website
    if source and source not in contact["sources"]:
        contact["sources"].append(source)


def _new_contact(name: str) -> dict:
    return {"name": name, "eik": "", "phones": [], "emails": [], "website": "", "managers": [],
            "address": "", "sources": [], "links": {}, "is_builder": False, "works": []}


def company_contact(name: str, http_tr: Http, http: Http, cache: Cache) -> dict:
    c = _new_contact(name)
    key = ksb.normalize_name(name) + "|" + tr._legal_form(name)
    try:
        rec = cache("tr", key, lambda: tr.find_company(http_tr, name))
    except Exception:
        rec = None
    if rec:
        c["eik"] = rec["eik"]
        c["address"] = rec["address"]
        c["managers"] = [m for m in rec["managers"] if "Заличено" not in m]
        c["links"]["Търговски регистър"] = rec["tr_url"]
        _merge(c, [rec["phone"]], [rec["email"]], rec["website"], "Търговски регистър")
    try:
        prof = cache("ksb", ksb.normalize_name(name), lambda: ksb.find_company(http, name))
    except Exception:
        prof = None
    if prof:
        c["is_builder"] = True
        c["eik"] = c["eik"] or prof["eik"]
        c["works"] = prof.get("works", [])[:12]
        c["links"]["КСБ"] = prof["ksb_url"]
        if not c["managers"]:
            c["managers"] = prof["representatives"]
        for block in (prof["office"], prof["seat"]):
            _merge(c, [block.get("phone")], [block.get("email")], block.get("website"), "КСБ")
    return c


def enrich(permits: list[dict], http: Http, cache: Cache, use_web: bool = True,
           architects_min_score: int = 55, log=print,
           kab_by_domain: dict | None = None, web_filter=lambda p: True,
           only=lambda p: True) -> dict[str, dict]:
    http_tr = Http(delay=2.0)  # Търговският регистър връща 429 при по-често
    roles: dict[str, set] = {}
    for p in permits:
        if not only(p):
            continue
        for name in p.get("investor_companies", []):
            roles.setdefault(name, set()).add("Инвеститор")
        for name in companies_in(p.get("supervision", "")):
            roles.setdefault(name, set()).add("Строителен надзор")

    log(f"Контакти на {len(roles)} фирми (Търговски регистър + КСБ) ...")
    contacts: dict[str, dict] = {}
    for i, name in enumerate(sorted(roles), 1):
        contacts[name] = company_contact(name, http_tr, http, cache)
        contacts[name]["roles"] = sorted(roles[name])
        if i % 25 == 0:
            log(f"  {i}/{len(roles)}")

    if use_web:
        # 1) сайт на фирмите без телефон или имейл
        web_names = {n for p in permits if web_filter(p) for n in p.get("investor_companies", [])
                     + companies_in(p.get("supervision", ""))}
        missing = [n for n, c in contacts.items() if not (c["phones"] and c["emails"]) and n in web_names]
        queries = {n: company_query(n) for n in missing}
        # 2) вероятен архитект на големите нови сгради
        arch_permits = [p for p in permits if p.get("kind") == "Ново строителство" and web_filter(p)
                        and p.get("score", 0) >= architects_min_score and p.get("investor_companies")]
        arch_q = {p["number"]: architect_query(p) for p in arch_permits}
        # Ред по важност: при ограничен бюджет първо отиват най-добрите обекти
        arch_numbers = {p["number"] for p in arch_permits}
        ordered = []
        for p in sorted((p for p in permits if web_filter(p)), key=lambda p: -p.get("score", 0)):
            ordered += [queries[n] for n in p.get("investor_companies", []) if n in queries]
            ordered += [queries[n] for n in companies_in(p.get("supervision", "")) if n in queries]
            if p["number"] in arch_numbers:
                ordered += [project_query(p), arch_q[p["number"]]]
        results = google_cached(http, ordered + list(queries.values()), cache, log)

        log(f"Сайтове на {len(missing)} фирми ...")
        for name in missing:
            c = contacts[name]
            site = c["website"] or web.pick_company_site(results.get(queries[name], []), name)
            if not site:
                continue
            try:
                found = cache("site", web.domain_of(site), lambda: web.site_contacts(http, site))
            except Exception:
                continue
            _merge(c, found["phones"], found["emails"], found["website"], "сайт на фирмата")

        log(f"Архитекти за {len(arch_permits)} обекта ...")
        add_architects(arch_permits, results, contacts, http, cache, kab_by_domain or {})

        log(f"Визуализации за {len(arch_permits)} обекта ...")
        visuals.add_visuals(arch_permits, results, visual_queries, http, cache, log)

    for p in permits:
        p["contacts"] = []
        for name in p.get("investor_companies", []):
            c = contacts.get(name) or {**_new_contact(name), "roles": ["Инвеститор"]}
            p["contacts"].append({**c, "role": "Инвеститор" + (" и строител (КСБ)" if c["is_builder"] else "")})
        for name in companies_in(p.get("supervision", "")):
            if name in contacts:
                p["contacts"].append({**contacts[name], "role": "Строителен надзор"})
        for a in p.get("architects", []):
            p["contacts"].append(architect_contact(a))
        inv = [c for c in p["contacts"] if c["role"].startswith("Инвеститор")]
        p["investor_phone"] = ", ".join(sum((c["phones"][:2] for c in inv), []))
        p["investor_email"] = ", ".join(sum((c["emails"][:2] for c in inv), []))
        p["investor_website"] = next((c["website"] for c in inv if c["website"]), "")
        p["investor_eik"] = ", ".join(c["eik"] for c in inv if c["eik"])
        p["investor_managers"] = "; ".join(sum((c["managers"][:2] for c in inv), []))
        p["architect"] = "; ".join(
            f'{a["name"]} {" ".join(a["phones"][:1])} {" ".join(a["emails"][:1])}'.strip()
            for a in p.get("architects", []))
    return contacts


def add_architects(permits: list[dict], results: dict, contacts: dict, http: Http, cache: Cache,
                   kab_by_domain: dict) -> None:
    """p['architects'] от Google резултатите за „<инвеститор> архитект“."""
    for p in permits:
        inv = contacts.get(p["investor_companies"][0], {})
        own = web.domain_of(inv.get("website", "")) if inv.get("website") else ""
        archs = []
        for hit in web.pick_architects(results.get(architect_query(p), []), p["investor_companies"][0],
                                       kab_by_domain, exclude_domain=own):
            try:
                found = cache("site", hit["domain"], lambda: web.site_contacts(http, hit["url"]))
            except Exception:
                found = {"website": "https://" + hit["domain"], "phones": [], "emails": []}
            kab = hit.get("kab")
            a = _new_contact(kab["name"] if kab else hit["domain"])
            a["evidence"] = {"title": hit["title"], "url": hit["url"]}
            if kab:
                a["managers"] = kab.get("owners", [])[:3]
                directory_links(a, kab)
                _merge(a, kab.get("phones", []), kab.get("emails", []), kab.get("website", ""),
                       "КАБ" if kab.get("kab_url") else "Google Maps")
            _merge(a, found["phones"], found["emails"], found["website"], "сайт на бюрото")
            a["in_kab"] = bool(kab and kab.get("kab_url"))
            archs.append(a)
        p["architects"] = archs


def directory_links(contact: dict, bureau: dict) -> None:
    """Линкове към записа на бюрото в справочника (КАБ и/или Google Maps)."""
    if bureau.get("kab_url"):
        contact["links"]["КАБ"] = bureau["kab_url"]
    if bureau.get("maps_url"):
        contact["links"]["Google Maps"] = bureau["maps_url"]


def architect_contact(a: dict) -> dict:
    role = "Архитект (бюро в КАБ)" if a.get("in_kab") else "Архитект (вероятен)"
    return {**a, "role": role}


def kab_domains(architects: list[dict]) -> dict[str, dict]:
    """{домейн на сайта на бюрото: запис от КАБ}"""
    out = {}
    for b in architects:
        if b.get("website"):
            out[web.domain_of(b["website"] if "//" in b["website"] else "https://" + b["website"])] = b
    return out


def core_name(p: dict) -> str:
    return ksb.normalize_name(p["investor_companies"][0])


def architect_query(p: dict) -> str:
    return f'"{core_name(p)}" архитект'


def project_query(p: dict) -> str:
    """Търсене на страницата на проекта (там са визуализациите)."""
    return f'"{core_name(p)}" проект София'


def company_query(name: str) -> str:
    return f'"{ksb.normalize_name(name)}" {tr._legal_form(name)}'.strip()


def visual_queries(p: dict) -> list[str]:
    return [project_query(p), architect_query(p), company_query(p["investor_companies"][0])]


def google_cached(http: Http, queries: list[str], cache: Cache, log=print) -> dict[str, list]:
    """Google резултати с кеш на заявка; новите заявки отиват в един Apify run."""
    out, todo = {}, []
    for q in dict.fromkeys(queries):
        hit = cache("google", q, lambda: None)
        if hit is None:
            todo.append(q)
        else:
            out[q] = hit
    if todo:
        cap = web.queries_affordable(http)
        if cap is not None and len(todo) > cap:
            log(f"  бюджетът в Apify стига за {cap} от {len(todo)} нови заявки; "
                f"останалите (с по-нисък приоритет) се пропускат")
            todo = todo[:cap]
    if todo:
        log(f"Google търсене (Apify): {len(todo)} заявки ...")
        try:
            fresh = web.google(http, todo)
        except Exception as exc:  # без интернет/бюджет – продължаваме с кеша
            log(f"  Google търсенето не успя: {exc}")
            fresh = None
        if fresh is not None:
            for q in todo:
                out[q] = fresh.get(q, [])
                cache("google", q, lambda: out[q], overwrite=True)
    for q in queries:
        out.setdefault(q, [])
    return out

