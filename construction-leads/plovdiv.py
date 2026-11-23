"""Пловдив и Пловдивска област: архитекти, строители и обекти от достъпните публични източници.

    python plovdiv.py                # всичко (с кеш; при прекъсване продължава)
    python plovdiv.py --months 12    # обществени поръчки за последните 12 месеца

Източници (без платени услуги):
  - КАБ, регионална колегия „Пловдив“ – проектантски бюра с телефон, имейл, сайт;
  - КСБ, област Пловдив – строители и подизпълнители (групи 1.1–1.4 и 5);
  - ЦАИС ЕОП (отворени данни) – договори за строителство и проектиране с възложител от
    областта: обект, възложител, изпълнител (ЕИК), подизпълнители, стойност, дата.
    При договор за проектиране изпълнителят е проектантът на този обект – връзката е документирана.
Регистърът на разрешенията за строеж на Община Пловдив (isut.plovdiv.bg:998) не отговаря на
заявки извън България – виж README.

Изход: output/plovdiv/ – arhitekti.csv, stroiteli.csv, obekti.csv (+ JSON).
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import urllib.parse
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from pathlib import Path

from leads import kab, ksb, web
from leads.http import Http
from leads.runlog import RunLog
from run import cached

ROOT = Path(__file__).parent
OUT = ROOT / "output" / "plovdiv"
EOP = "https://storage.eop.bg"
KSB_PLOVDIV = "16"

# 18-те общини в област Пловдив + районите на града
MUNICIPALITIES = ["Пловдив", "Асеновград", "Брезово", "Калояново", "Карлово", "Кричим", "Куклен", "Лъки",
                  "Марица", "Перущица", "Първомай", "Раковски", "Родопи", "Садово", "Сопот", "Стамболийски",
                  "Съединение", "Хисаря"]
TOWNS = ["Пловдив", "Асеновград", "Карлово", "Първомай", "Раковски", "Стамболийски", "Съединение", "Хисаря",
         "Сопот", "Калофер", "Кричим", "Перущица", "Куклен", "Садово", "Брезово", "Лъки", "Баня", "Клисура"]
REGION_RX = re.compile(r"(?i)(?<![а-я])(?:" + "|".join(sorted(set(MUNICIPALITIES + TOWNS), key=len, reverse=True))
                       + r")(?![а-я])")
# Двусмислени думи („баня“, „ул. Марица“) не стигат: възложител „Община X“ от областта, институция с
# град от областта в името, или изрично „гр./с./общ./община/район X“ в предмета
_MUN = "|".join(sorted(MUNICIPALITIES, key=len, reverse=True))
_TOWN = "|".join(sorted(set(TOWNS) - {"Баня", "Клисура"}, key=len, reverse=True))
BUYER_RX = re.compile(rf"(?i)община\s*[„\"]?(?:{_MUN})(?![а-я])|(?<![а-я])(?:{_TOWN})(?![а-я])")
SUBJECT_RX = re.compile(rf"(?i)(?:гр\.|град|общ\.|община|район)\s*[„\"]?(?:{_MUN}|{_TOWN}|Баня|Клисура)(?![а-я])|"
                        rf"(?:с\.|село)\s*[„\"]?[А-Я][а-я]+[^,.;]{{0,40}}?(?:общ\.|община)\s*[„\"]?(?:{_MUN})(?![а-я])")
OTHER_MUN_RX = re.compile(r"(?i)^\s*община\s+(?!(?:" + _MUN + r")(?![а-я]))")


def in_region(buyer: str, subject: str) -> re.Match | None:
    if OTHER_MUN_RX.search(buyer or ""):
        return None  # друга община възлага – улица „Пловдив“ в Шумен не е Пловдив
    m = BUYER_RX.search(buyer or "")
    if m and not re.search(r"(?i)ул\.|улица|бул\.", (buyer or "")[max(0, m.start() - 8):m.start()]):
        return m
    return SUBJECT_RX.search(subject or "")


FACADE_RX = re.compile(r"(?i)енергийн\w* ефективност|саниран|фасад|топлоизолац|изолац\w* на сград|"
                       r"ново строителство|изграждане на (?:нова )?сград|детска градина|училище|ясла|"
                       r"жилищн\w* сград|многофамилн|реконструкц\w* и модернизац|основен ремонт")
BUILDING_RX = re.compile(r"(?i)сград|училищ|детск\w* градин|ясла|жилищ|читалищ|болниц|поликлиник|зала|музей|храм|"
                         r"кметств|общежити|библиотек|театър|център за|дом за|блок")
NOT_BUILDING_RX = re.compile(r"(?i)път|улиц|ул\.|настилк|ограда|светофар|подстанц|п/ст|тротоар|водопровод|канализац|асфалт|осветление|парк\b|"
                             r"зелени площи|площадка|спортна площадка|кабел|мост|депо|пречиствател")


def iso(d: str) -> str:
    """„31.10.2024“ и „2024-10-31T…“ -> „2024-10-31“."""
    m = re.match(r"(\d{1,2})\.(\d{1,2})\.(\d{4})", d or "")
    return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else (d or "")[:10]


def phone_list(raw: str) -> list[str]:
    out = []
    for m in web.PHONE_RX.findall(raw or ""):
        p = web._clean_phone(m)
        if p and not p.startswith("+3590"):
            out.append(p)
    return list(dict.fromkeys(out))


# ---------------------------------------------------------------------------
# Архитекти – КАБ, колегия Пловдив
# ---------------------------------------------------------------------------

def architects(log: RunLog) -> list[dict]:
    http = Http(delay=0.8, timeout=90)
    listed = cached("kab_list", "kc-plovdiv", lambda: kab.list_bureaus(http, "kc-plovdiv"))
    log.log(f"КАБ Пловдив: {len(listed)} бюра")
    rows = []
    for i, b in enumerate(listed, 1):
        try:
            d = cached("kab_bureau", b["url"], lambda: kab.bureau(http, b["url"]))
            log.success("kab_bureau", b["url"])
        except Exception as exc:
            log.failure("kab_bureau", b["url"], exc, b["url"])
            continue
        phones = phone_list(" ".join(d.get("phones") or []))
        rows.append({"name": b["name"], "reg_no": b["reg_no"], "college": b["college"],
                     "owners": d.get("owners") or [], "contact_person": d.get("contact_person", ""),
                     "address": d.get("address", ""), "phones": phones, "emails": d.get("emails") or [],
                     "website": d.get("website", ""), "kab_url": b["url"], "source": "регистър на КАБ"})
        if i % 25 == 0:
            log.checkpoint("plovdiv_kab", done=i, total=len(listed))
    return rows


# ---------------------------------------------------------------------------
# Строители – КСБ, област Пловдив
# ---------------------------------------------------------------------------

def builders(log: RunLog) -> list[dict]:
    http = Http()
    firms: dict[str, dict] = {}
    for code, label in ksb.GROUPS.items():
        listed = cached("ksb_list_plovdiv", code, lambda: ksb.list_firms(http, code, region=KSB_PLOVDIV))
        log.log(f"КСБ Пловдив, {label}: {len(listed)} фирми")
        for f in listed:
            firms.setdefault(f["ksb_id"], {**f, "groups": []})["groups"].append(label)
    rows = []
    for i, (kid, f) in enumerate(firms.items(), 1):
        try:
            prof = cached("ksb_profile", kid, lambda: ksb.profile(http, kid))
            log.success("ksb_profile", kid)
        except Exception as exc:
            log.failure("ksb_profile", kid, exc)
            continue
        if not prof:
            continue
        phones, emails, sites = [], [], []
        for block in (prof.get("office") or {}, prof.get("seat") or {}):
            phones += phone_list(block.get("phone", ""))
            if block.get("email"):
                emails += [e.strip().lower() for e in re.split(r"[,;\s]+", block["email"]) if "@" in e]
            if block.get("website"):
                sites.append(block["website"])
        rows.append({"name": prof.get("name") or f["name"], "eik": prof.get("eik") or f.get("eik", ""),
                     "groups": f["groups"], "city": (prof.get("seat") or {}).get("city", ""),
                     "address": (prof.get("office") or prof.get("seat") or {}).get("street", ""),
                     "phones": list(dict.fromkeys(phones)), "emails": list(dict.fromkeys(emails)),
                     "website": sites[0] if sites else "", "representatives": prof.get("representatives") or [],
                     "ksb_url": prof.get("ksb_url", ""), "source": "Централен професионален регистър на строителя (КСБ)"})
        if i % 100 == 0:
            log.log(f"  КСБ профили {i}/{len(firms)}")
            log.checkpoint("plovdiv_ksb", done=i, total=len(firms))
    return rows


# ---------------------------------------------------------------------------
# Обекти – договори от ЦАИС ЕОП
# ---------------------------------------------------------------------------

def eop_day(day: str, log: RunLog) -> list[dict]:
    """Договорите за строителство/проектиране с възложител от областта за един ден (кеш по ден)."""
    def fetch():
        http = Http(delay=0.2, retries=2, timeout=90)
        listing = http.get(f"{EOP}/open-data-{day}/").text
        keys = re.findall(r"<Key>([^<]+)</Key>", listing)
        key = next((k for k in keys if "договори" in k), None)
        if not key:
            return []
        rows = http.get(f"{EOP}/open-data-{day}/{urllib.parse.quote(key)}").json() or []
        keep = []
        for r in rows:
            subject = " ".join(filter(None, [r.get("tenderName"), r.get("contractSubject")]))
            cpv = r.get("tenderMainCpv") or ""
            works = r.get("typeOfContract") == "Строителство"
            design = cpv.startswith(("712", "7122", "7124", "7125")) or re.search(r"(?i)проектиране|инвестиционен проект", subject)
            if not (works or design) or not r.get("supplierName"):
                continue
            if not (REGION_RX.search(r.get("buyerName") or "") or REGION_RX.search(subject)):
                continue
            keep.append({k: r.get(k) for k in (
                "publicationDate", "uniqueProcurementNumber", "tenderId", "tenderName", "tenderMainCpv",
                "tenderMainCpvDescription", "typeOfContract", "buyerName", "buyerRegistryNumber", "contractNumber",
                "contractDate", "contractValue", "contractCurrency", "contractSubject", "supplierName",
                "supplierRegisterNumber", "subcontractorName", "subcontractorRegistryNumber", "isEuFunded",
                "europeanProgram", "lotIdentifier")})
        return keep
    try:
        rows = cached("eop_plovdiv_day", day, fetch)
        log.success("eop_day", day)
        return rows
    except Exception as exc:
        log.failure("eop_day", day, exc, f"{EOP}/open-data-{day}/")  # не се кешира – опитва се пак
        return []


def objects(log: RunLog, months: int) -> list[dict]:
    end = date.today() - timedelta(days=1)
    days = [(end - timedelta(days=i)).isoformat() for i in range(int(months * 30.4))]
    log.log(f"ЦАИС ЕОП: договори за {len(days)} дни ...")
    with ThreadPoolExecutor(max_workers=6) as pool:
        all_rows = [r for rows in pool.map(lambda d: eop_day(d, log), days) for r in rows]
    log.log(f"  договори за строителство/проектиране с възложител от областта: {len(all_rows)}")
    # Един ред за поръчка+обособена позиция+изпълнител (анекси и повторни публикации не дублират)
    seen, out = set(), []
    for r in sorted(all_rows, key=lambda r: r.get("publicationDate") or "", reverse=True):
        key = (r["uniqueProcurementNumber"], r.get("lotIdentifier"), r.get("supplierRegisterNumber"))
        if key in seen:
            continue
        seen.add(key)
        subject = re.sub(r"\s+", " ", " ".join(dict.fromkeys(filter(None, [r.get("tenderName"), r.get("contractSubject")]))))
        cpv = r.get("tenderMainCpv") or ""
        supervision = re.search(r"(?i)строителен надзор|консултант|оценка на съответствието", subject) and \
            not re.search(r"(?i)проектиране", subject)
        role = "строителен надзор" if supervision else "проектант" if (r["typeOfContract"] != "Строителство" and (cpv.startswith("712") or
                                                                         re.search(r"(?i)проектиране", subject))) \
            else ("проектиране и строителство (инженеринг)" if re.search(r"(?i)инженеринг|проектиране и изпълнение|"
                                                                        r"проектиране и строителство", subject)
                  else "строител")
        place = in_region(r.get("buyerName") or "", subject)
        if not place:
            continue
        town = re.search(rf"(?i)(?:{_MUN}|{_TOWN}|Баня|Клисура)", place.group(0))
        out.append({
            "date": iso(r.get("contractDate") or r.get("publicationDate") or ""),
            "published": (r.get("publicationDate") or "")[:10],
            "object": subject[:600], "place": town.group(0).capitalize() if town else place.group(0),
            "buyer": r.get("buyerName"), "buyer_eik": r.get("buyerRegistryNumber"),
            "contractor": r.get("supplierName"), "contractor_eik": r.get("supplierRegisterNumber"),
            "contractor_role": role,
            "subcontractors": r.get("subcontractorName") or "", "subcontractor_eiks": r.get("subcontractorRegistryNumber") or "",
            "value": r.get("contractValue"), "currency": r.get("contractCurrency") or "",
            "cpv": f'{cpv} {r.get("tenderMainCpvDescription") or ""}'.strip(),
            "procurement_no": r.get("uniqueProcurementNumber"),
            "url": f'https://app.eop.bg/today/{r["tenderId"]}' if r.get("tenderId") else "",
            "eu_funded": r.get("isEuFunded"), "program": r.get("europeanProgram") or "",
            "facade_relevant": bool(FACADE_RX.search(subject)) and not (
                NOT_BUILDING_RX.search(subject) and not re.search(r"(?i)сград|училищ|детск\w* градин|ясла", subject)),
            "source": "ЦАИС ЕОП – отворени данни (договори)",
        })
    return out


# ---------------------------------------------------------------------------
# Свързване и запис
# ---------------------------------------------------------------------------

def tr_enrich(arch: list[dict], objs: list[dict], log: RunLog) -> list[dict]:
    """Контакти от Търговския регистър: за бюрата без телефон/имейл (точно име и правна форма) и за
    изпълнителите на договорите (по ЕИК). Връща проектантите от договорите, които ги няма в КАБ."""
    from leads import tr
    from leads.ksb import normalize_name
    http = Http(delay=6.0)

    def merge(row: dict, rec: dict | None) -> None:
        if not rec:
            return
        row["eik"] = row.get("eik") or rec.get("eik", "")
        for ph in phone_list(rec.get("phone", "")):
            if ph not in row["phones"]:
                row["phones"].append(ph)
        if rec.get("email") and rec["email"].lower() not in row["emails"]:
            row["emails"].append(rec["email"].lower())
        row["website"] = row.get("website") or rec.get("website", "")
        row["managers"] = [m for m in rec.get("managers", []) if "Заличено" not in m][:3]
        row["tr_url"] = rec.get("tr_url", "")
        if rec.get("phone") or rec.get("email"):
            row["source"] += " + Търговски регистър"

    for i, a in enumerate(arch, 1):
        if a["phones"] and a["emails"]:
            continue
        key = normalize_name(a["name"]) + "|" + tr._legal_form(a["name"])
        try:
            merge(a, cached("tr", key, lambda: tr.find_company(http, a["name"])))
            log.success("tr", key)
        except Exception as exc:
            log.failure("tr", key, exc)
        if i % 20 == 0:
            log.log(f"  ТР за бюрата {i}/{len(arch)}")
    by_eik = {a.get("eik"): a for a in arch if a.get("eik")}
    by_name = {normalize_name(a["name"]): a for a in arch}
    designers = {}
    for o in objs:
        if o["contractor_role"] not in ("проектант", "проектиране и строителство (инженеринг)") or \
                not BUILDING_RX.search(o["object"]):
            continue  # само проектиране на сгради (не трасета, улици, надзор)
        eik, name = o.get("contractor_eik") or "", o.get("contractor") or ""
        if eik in by_eik or normalize_name(name) in by_name or eik in designers or not re.fullmatch(r"\d{9}|\d{13}", eik):
            continue
        row = {"name": name, "reg_no": "", "college": "", "owners": [], "contact_person": "", "address": "",
               "phones": [], "emails": [], "website": "", "kab_url": "", "eik": eik,
               "source": "изпълнител на договор за проектиране (ЦАИС ЕОП)"}
        try:
            rec = cached("tr_eik", eik, lambda: tr.deed(http, eik))
            log.success("tr_eik", eik)
        except Exception as exc:
            log.failure("tr_eik", eik, exc)
            rec = None
        merge(row, rec)
        if rec:
            row["address"] = rec.get("address", "")
        designers[eik] = row
    log.log(f"  проектанти от договорите, които не са в КАБ Пловдив: {len(designers)}")
    return list(designers.values())


def link(arch: list[dict], build: list[dict], objs: list[dict]) -> None:
    """Контакти към изпълнителите на обектите по ЕИК (КСБ) или по точно име (КАБ)."""
    from leads.ksb import normalize_name
    by_eik = {b["eik"]: b for b in build if b.get("eik")}
    arch_eik = {a["eik"]: a for a in arch if a.get("eik")}
    by_name = {normalize_name(a["name"]): a for a in arch}
    for o in objs:
        b = by_eik.get(o.get("contractor_eik") or "")
        a = arch_eik.get(o.get("contractor_eik") or "") or by_name.get(normalize_name(o.get("contractor") or ""))
        src = b or a or {}
        o["contractor_phones"] = src.get("phones", [])
        o["contractor_emails"] = src.get("emails", [])
        o["contractor_website"] = src.get("website", "")
        o["contractor_register"] = "КСБ" if b else ("КАБ" if a and a.get("kab_url") else ("ТР" if a else ""))
        if a and o["contractor_role"] in ("проектант", "проектиране и строителство (инженеринг)") and \
                BUILDING_RX.search(o["object"]):
            a.setdefault("objects", []).append({"object": o["object"][:200], "date": o["date"], "url": o["url"],
                                                "buyer": o["buyer"]})


def write(arch: list[dict], build: list[dict], objs: list[dict]) -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, data in (("arhitekti", arch), ("stroiteli", build), ("obekti", objs)):
        (OUT / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")

    def out(name, header, rows):
        with open(OUT / f"{name}.csv", "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(header)
            w.writerows(rows)
    out("arhitekti", ["Бюро", "ЕИК", "Рег. № КАБ", "Архитекти / управители", "Лице за контакт", "Телефон", "Имейл",
                      "Сайт", "Адрес", "Обекти по договори (ЦАИС ЕОП)", "Източник", "Профил в КАБ"],
        [[a["name"], a.get("eik", ""), a["reg_no"], ", ".join(a["owners"] or a.get("managers", [])), a["contact_person"],
          ", ".join(a["phones"]), ", ".join(a["emails"]), a["website"], a["address"],
          " | ".join(f'{x["date"]} {x["object"][:90]}' for x in a.get("objects", [])[:5]), a["source"], a["kab_url"]]
         for a in sorted(arch, key=lambda a: (not (a["phones"] or a["emails"]), a["name"].lower().strip('"„ ')))])
    out("stroiteli", ["Фирма", "ЕИК", "Групи (КСБ)", "Град", "Телефон", "Имейл", "Сайт", "Представители", "Профил в КСБ"],
        [[b["name"], b["eik"], "; ".join(b["groups"]), b["city"], ", ".join(b["phones"]), ", ".join(b["emails"]),
          b["website"], ", ".join(b["representatives"][:3]), b["ksb_url"]]
         for b in sorted(build, key=lambda b: (not (b["phones"] or b["emails"]), b["name"].lower()))])
    out("obekti", ["Дата на договора", "Обект / предмет", "Място", "За фасада", "Възложител", "ЕИК възложител",
                   "Изпълнител", "ЕИК изпълнител", "Роля", "Телефон изпълнител", "Имейл изпълнител",
                   "Подизпълнители", "Стойност", "Валута", "Поръчка №", "Линк ЦАИС ЕОП"],
        [[o["date"], o["object"], o["place"], "да" if o["facade_relevant"] else "", o["buyer"], o["buyer_eik"],
          o["contractor"], o["contractor_eik"], o["contractor_role"], ", ".join(o["contractor_phones"]),
          ", ".join(o["contractor_emails"]), o["subcontractors"], o["value"], o["currency"], o["procurement_no"],
          o["url"]] for o in sorted(sorted(objs, key=lambda o: o["date"], reverse=True), key=lambda o: not o["facade_relevant"])])


def write_xlsx() -> None:
    """Един файл за Excel с три листа (ако е инсталиран openpyxl)."""
    try:
        from openpyxl import Workbook
        from openpyxl.styles import Alignment, Font, PatternFill
        from openpyxl.utils import get_column_letter
    except ImportError:
        return
    wb = Workbook()
    wb.remove(wb.active)
    sheets = [("obekti", "Обществени поръчки"), ("arhitekti", "Архитекти"), ("stroiteli", "Строители")]
    if (OUT / "chastni_obekti.csv").exists():
        sheets.insert(0, ("chastni_obekti", "Частни обекти (НАГ)"))
    for name, title in sheets:
        ws = wb.create_sheet(title)
        with open(OUT / f"{name}.csv", encoding="utf-8-sig") as f:
            for row in csv.reader(f, delimiter=";"):
                ws.append(row)
        for c in ws[1]:
            c.font, c.fill = Font(bold=True, color="FFFFFF"), PatternFill("solid", fgColor="1F4E78")
            c.alignment = Alignment(wrap_text=True, vertical="top")
        ws.freeze_panes, ws.auto_filter.ref = "A2", ws.dimensions
        for i, col in enumerate(ws.columns, 1):
            width = max(len(str(c.value or "")) for c in list(col)[:200])
            ws.column_dimensions[get_column_letter(i)].width = min(max(10, width * 0.9), 60)
        for row in ws.iter_rows(min_row=2):
            for c in row:
                if isinstance(c.value, str) and c.value.startswith("http"):
                    c.hyperlink, c.font = c.value, Font(color="0563C1", underline="single")
    wb.save(OUT / "plovdiv_obekti_arhitekti_stroiteli.xlsx")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--months", type=int, default=24)
    args = ap.parse_args()
    log = RunLog("plovdiv")
    arch = architects(log)
    build = builders(log)
    objs = objects(log, args.months)
    arch += tr_enrich(arch, objs, log)
    link(arch, build, objs)
    write(arch, build, objs)
    write_xlsx()
    log.log(f"Архитекти: {len(arch)} бюра, с телефон {sum(1 for a in arch if a['phones'])}, "
            f"с имейл {sum(1 for a in arch if a['emails'])}")
    log.log(f"Строители: {len(build)}, с телефон {sum(1 for b in build if b['phones'])}")
    log.log(f"Обекти (договори): {len(objs)}, за фасада {sum(1 for o in objs if o['facade_relevant'])}, "
            f"проектанти {sum(1 for o in objs if o['contractor_role'] == 'проектант')}")
    log.log(f"Готово: {OUT}")


if __name__ == "__main__":
    main()
