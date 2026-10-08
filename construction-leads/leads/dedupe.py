"""Почистване на повторения преди отчета и файловете за Excel.

- един обект с няколко разрешения (или едно разрешение, върнато два пъти от
  регистъра) -> един ред с „още разрешения“;
- една фирма с различно изписване -> един контакт (по ЕИК / нормализирано име);
- телефони в един формат (+359...), без повторения и без текст вместо номер;
- фирми с общ телефон/имейл -> „група“ (например инвеститор с няколко дружества);
- справочникът на архитектите: едно бюро, записано няколко пъти -> един ред.
"""
from __future__ import annotations

import re
from collections import defaultdict

from .ksb import normalize_name
from .web import domain_of


def normalize_phone(raw: str, default_area: str = "2") -> str:
    """'02 9151-858' / '0888 123 456' / '981-94-39' (София) -> '+35929151858' ...
    Връща "" за текст, който не е телефон."""
    digits = re.sub(r"\D", "", raw or "")
    if (raw or "").strip().startswith("+") and digits.startswith("359"):
        digits = digits[3:]
    elif digits.startswith("00359"):
        digits = digits[5:]
    elif digits.startswith("359") and len(digits) >= 11:
        digits = digits[3:]
    elif digits.startswith("0"):
        digits = digits[1:]
    elif len(digits) == 7 and default_area:  # градски номер без код
        digits = default_area + digits
    if not 8 <= len(digits) <= 10:
        return ""
    return "+359" + digits


def _uniq(items):
    return list(dict.fromkeys(x for x in items if x))


def clean_contact(c: dict) -> dict:
    c = dict(c)
    c["phones"] = _uniq(normalize_phone(p) for p in c.get("phones", []))
    c["emails"] = _uniq((e or "").strip().lower() for e in c.get("emails", []) if "@" in (e or ""))
    return c


def display_name(name: str) -> str:
    """Еднакво изписване: кавички „…“ и единични интервали."""
    name = re.sub(r"\s+", " ", name or "").strip()
    form = re.search(r"\b(ЕООД|ООД|ЕАД|АД|ЕТ|КД|СД)\s*$", name)
    if not form:
        return name
    core = re.sub(r"[\"'„“”«»]", "", name[:form.start()]).strip(" ,")
    return f"„{core}“ {form.group(1)}" if core else name


def _company_key(c: dict) -> str:
    return c.get("eik") or normalize_name(c.get("name", "")) + "|" + c.get("role", "")


def merge_contacts(contacts: list[dict]) -> list[dict]:
    """Една фирма в една роля -> един контакт с обединени телефони и имейли."""
    out: dict[tuple, dict] = {}
    for c in map(clean_contact, contacts):
        role = c.get("role", "")
        key = (role.split(" ")[0], c.get("eik") or normalize_name(c.get("name", "")))
        if key not in out:
            out[key] = {**c, "name": display_name(c.get("name", ""))}
            continue
        m = out[key]
        m["phones"] = _uniq(m["phones"] + c["phones"])
        m["emails"] = _uniq(m["emails"] + c["emails"])
        m["website"] = m.get("website") or c.get("website", "")
        m["managers"] = _uniq((m.get("managers") or []) + (c.get("managers") or []))
    return list(out.values())


# --------------------------------------------------------------------------
# Обекти
# --------------------------------------------------------------------------

def site_key(p: dict) -> str:
    if p.get("kkkr"):
        return p["kkkr"]
    kv = re.search(r"Квартал по регулация:\s*([^,]+)", p.get("scope", ""))
    upi = (p.get("upi") or "").split("-")[0].strip()
    if not upi:
        return "hash:" + (p.get("hash") or p.get("number", ""))
    return f'{p.get("region")}|{kv.group(1).strip() if kv else ""}|{upi}'


def dedupe_permits(permits: list[dict]) -> list[dict]:
    """Едно разрешение два пъти или няколко разрешения за един имот и инвеститор -> един ред."""
    groups: dict[tuple, list[dict]] = defaultdict(list)
    order = []
    for p in permits:
        key = (site_key(p), normalize_name(p.get("investor", "")))
        if key not in groups:
            order.append(key)
        groups[key].append(p)
    out = []
    for key in order:
        ps = groups[key]
        # Основен ред: най-високата оценка, при равенство – най-новото разрешение
        ps.sort(key=lambda p: (-(p.get("score") or 0), -(int((p.get("in_force") or "0").replace("-", "")))))
        main = dict(ps[0])
        others, seen = [], {main.get("hash")}
        for p in ps[1:]:
            if p.get("hash") in seen:
                continue  # същото разрешение, върнато втори път
            seen.add(p.get("hash"))
            others.append({"number": p.get("number"), "hash": p.get("hash"), "object": p.get("object"), "url": p.get("url"),
                           "in_force": p.get("in_force")})
            main["contacts"] = (main.get("contacts") or []) + (p.get("contacts") or [])
            main["stage_hints"] = (main.get("stage_hints") or []) + [
                h for h in p.get("stage_hints") or [] if h not in (main.get("stage_hints") or [])]
            main["architects"] = (main.get("architects") or []) + [
                a for a in p.get("architects") or [] if a.get("name") not in
                {x.get("name") for x in main.get("architects") or []}]
            main["visual"] = main.get("visual") or p.get("visual")
            main["facade_window"] = main.get("facade_window") or p.get("facade_window")
        if others:
            main["other_permits"] = others
        main["contacts"] = merge_contacts(main.get("contacts") or [])
        out.append(main)
    return out


def group_investors(permits: list[dict], max_group: int = 6) -> None:
    """Инвеститори с общ телефон или имейл (напр. „АСД Пропъртис 1/2/3“) -> една група."""
    parent: dict[str, str] = {}

    def find(x):
        while parent.setdefault(x, x) != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a, b):
        parent[find(a)] = find(b)

    names: dict[str, str] = {}
    links: dict[str, set] = defaultdict(set)  # телефон/имейл -> фирми
    for p in permits:
        for c in p.get("contacts", []):
            if not c.get("role", "").startswith("Инвеститор"):
                continue
            node = "c:" + (c.get("eik") or normalize_name(c["name"]))
            names[node] = c["name"]
            for ph in c.get("phones", []):
                links["p:" + ph].add(node)
            for em in c.get("emails", []):
                links["e:" + em].add(node)
    for key, nodes in links.items():
        # Телефон на счетоводител/агент, вписан за много фирми, не ги прави една група
        if 1 < len(nodes) <= max_group:
            first, *rest = sorted(nodes)
            for n in rest:
                union(first, n)
    members: dict[str, set] = defaultdict(set)
    for node, name in names.items():
        members[find(node)].add(name)
    counts: dict[str, int] = defaultdict(int)
    for p in permits:
        roots = {find("c:" + (c.get("eik") or normalize_name(c["name"])))
                 for c in p.get("contacts", []) if c.get("role", "").startswith("Инвеститор")}
        for r in roots:
            counts[r] += 1
    for p in permits:
        for c in p.get("contacts", []):
            if not c.get("role", "").startswith("Инвеститор"):
                continue
            root = find("c:" + (c.get("eik") or normalize_name(c["name"])))
            group = sorted(members[root])
            if len(group) > 1:
                c["group"] = group
            if counts[root] > 1:
                c["group_objects"] = counts[root]


# --------------------------------------------------------------------------
# Справочник на архитектите
# --------------------------------------------------------------------------

GENERIC_WORDS = {"архитектурно", "архитектурна", "архитектурен", "студио", "бюро", "архитект", "архитекти",
                 "architecture", "architects", "architect", "studio", "design", "дизайн", "проект", "проекти",
                 "и", "and", "&", "фирма", "агенция", "ателие", "atelier", "офис", "office"}


def dedupe_architects(rows: list[dict]) -> list[dict]:
    """Едно бюро, записано няколко пъти (КАБ/Maps, няколко дружества с един телефон) -> един ред."""
    for r in rows:
        r["phones"] = _uniq(normalize_phone(p) for p in r.get("phones", []))
        r["emails"] = _uniq((e or "").strip().lower() for e in r.get("emails", []) if "@" in (e or ""))
    parent = list(range(len(rows)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    seen: dict[str, int] = {}
    for i, r in enumerate(rows):
        keys = ["p:" + p for p in r["phones"]] + ["e:" + e for e in r["emails"]]
        if r.get("website"):
            keys.append("w:" + domain_of(r["website"] if "//" in r["website"] else "https://" + r["website"]))
        if r.get("kab_url"):
            keys.append("k:" + r["kab_url"])
        nm = normalize_name(r.get("name", ""))
        if set(re.findall(r"[\wа-я]+", nm)) - GENERIC_WORDS:  # не сливаме по общо име „Архитектурно студио“
            keys.append("n:" + nm)
        for k in keys:
            if k in seen:
                parent[find(i)] = find(seen[k])
            else:
                seen[k] = i
    merged: dict[int, dict] = {}
    for i, r in enumerate(rows):
        root = find(i)
        if root not in merged:
            merged[root] = {**r, "names": [r.get("name", "")]}
            continue
        m = merged[root]
        if r.get("name") and normalize_name(r["name"]) not in {normalize_name(x) for x in m["names"]}:
            m["names"].append(r["name"])
        for f in ("phones", "emails", "owners", "staff"):
            m[f] = _uniq((m.get(f) or []) + (r.get(f) or []))
        for f in ("website", "kab_url", "maps_url", "rating", "category", "reg_no", "college",
                  "address", "contact_person"):
            m[f] = m.get(f) or r.get(f)
    out = []
    for m in merged.values():
        m["name"] = " / ".join(m.pop("names"))
        out.append(m)
    return out
