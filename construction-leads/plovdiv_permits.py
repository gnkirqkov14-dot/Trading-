"""Пловдив: частни обекти от регистъра на разрешенията за строеж на общината (isut.plovdiv.bg).

    python plovdiv_permits.py [--since 2023-01-01]

Вход (изтеглени от компютър в България с tools/plovdiv_register.py / s.py):
    output/plovdiv/raw/plovdiv_razreshenia.csv – разрешения за строеж
    output/plovdiv/raw/plovdiv_vavedeni.csv    – въведени в експлоатация (УВЕ)
Стъпки:
  1. само сгради (без кабели, БКТП, водопроводи …), издадени след --since;
  2. махат се завършените: разрешение, посочено в УВЕ („Разрешения за строеж към това УВЕ“),
     или УВЕ за същия имот (ПИ) със сходно име на обекта след датата на разрешението;
  3. един ред за имот: разрешенията за един и същ ПИ (или квартал+УПИ) на един възложител се обединяват;
  4. приблизителен етап по датата на разрешението (РЗП не е публикувано в регистъра);
  5. фирмите-възложители: ЕИК, телефон, имейл, управители от Търговския регистър и КСБ.
Изход: output/plovdiv/chastni_obekti.csv и лист „Частни обекти“ в Excel файла за Пловдив.
"""
from __future__ import annotations

import argparse
import csv
import re
from datetime import date
from pathlib import Path

from leads.classify import classify
from leads.enrich import company_contact
from leads.http import Http
from leads.ksb import normalize_name
from leads.runlog import RunLog
from leads.stage import FACADE_KINDS, similar, stage
from run import cached

ROOT = Path(__file__).parent
OUT = ROOT / "output" / "plovdiv"
RAW = OUT / "raw"

INFRA = re.compile(r"(?i)бктп|ктп\b|трафопост|кабел|водопровод|канал\b|канализац|ел\.? ?захранван|електрозахранван|"
                   r"оптич|трансформатор|абонатна|газопровод|газоснабд|топлоснабд|топлопровод|пътна връзка|"
                   r"улица|улично|\bфец\b|фотоволт|съхранение на ел|зелена инфраструктура|тротоар|площадк|ограда|"
                   r"стълб|антен|мачт|базова станция|сондаж|кладен|осветление|трасе|разширение на .*инфраструктура")
LEGAL = r"(?:ЕООД|ООД|ЕАД|АДСИЦ|АД|ЕТ|КДА|КД|СД|ДЗЗД)"
COMPANY_RX = re.compile(rf"(.+?(?<![А-Яа-яA-Za-z]){LEGAL})(?![А-Яа-яA-Za-z])")
PUBLIC_RX = re.compile(r"(?i)община\s+пловдив|район\s+„?\"?(?:централен|източен|западен|северен|южен|тракия)")


def iso(d: str) -> str:
    m = re.match(r"(\d{1,2})[-.](\d{1,2})[-.](\d{4})", d or "")
    return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else ""


def read(path: Path) -> list[dict]:
    with open(path, encoding="utf-8-sig") as f:
        return list(csv.DictReader(f, delimiter=";"))


def parcel(row: dict) -> str:
    """„56784.510.232“ / „510.232“ -> „510.232“ (кварталната част на кадастралния номер в Пловдив)."""
    for key in ("Номер на ПИ", "Идентификатор на имот (карта)"):
        m = re.search(r"(?:56784\.)?(\d{3}\.\d{1,5})(?!\d)", row.get(key) or "")
        if m:
            return m.group(1)
    return ""


def split_investor(text: str) -> tuple[list[str], list[str], list[str]]:
    """-> (фирми, публични органи, физически лица). Фирмите често не са разделени със запетая:
    „"КАЛИСТО-МАТИ" ЕООД "МОНРО" ЕООД и други“."""
    text = re.sub(r"\s+", " ", text or "").strip()
    public = [m.group(0) for m in PUBLIC_RX.finditer(text)]
    rest = PUBLIC_RX.sub(" ", text)
    companies, pos = [], 0
    for m in COMPANY_RX.finditer(rest):
        name = re.sub(r"^[\s,;и]+|^и\s+|^и др\.?\s*", "", m.group(1)).strip(" ,;")
        name = re.sub(r"^(?:и|,)\s+", "", name)
        if len(normalize_name(name)) >= 2:
            companies.append(name)
        pos = m.end()
    leftover = rest[pos:] if companies else rest
    people = [p.strip(" .") for p in re.split(r",|\s+и\s+", leftover)
              if p.strip(" .") and not re.fullmatch(r"(?i)др\.?|други|и други|и др", p.strip(" ."))
              and re.search(r"[А-Яа-я]{3}", p)]
    return companies, public, people


# ---------------------------------------------------------------------------
# Въведени в експлоатация
# ---------------------------------------------------------------------------

def completed_index(vavedeni: list[dict]) -> tuple[dict, dict]:
    """(по разрешение: {(номер, дата): УВЕ}, по имот: {ПИ: [УВЕ]})."""
    by_permit, by_parcel = {}, {}
    for v in vavedeni:
        rec = {"number": v["Номер"], "date": iso(v["Дата"]), "object": v["Име на обект"],
               "supervision": v.get("Строителен надзор", ""), "category": v.get("Категория на обекта", ""),
               "url": v.get("Линк към записа", "")}
        for n, d, mo, y in re.findall(r"(\d+)\s*/\s*(\d{1,2})\.(\d{1,2})\.(\d{4})",
                                      v.get("Разрешения за строеж към това УВЕ") or ""):
            by_permit[(str(int(n)), f"{y}-{int(mo):02d}-{int(d):02d}")] = rec
        pi = parcel(v)
        if pi:
            by_parcel.setdefault(pi, []).append(rec)
    return by_permit, by_parcel


# ---------------------------------------------------------------------------
# Обекти
# ---------------------------------------------------------------------------

def objects(permits: list[dict], vavedeni: list[dict], since: str) -> list[dict]:
    by_permit, by_parcel = completed_index(vavedeni)
    rows = []
    for r in permits:
        d = iso(r["Дата"])
        name = re.sub(r"\s+", " ", r.get("Име на обект") or "").strip()
        if not d or d < since or not name or INFRA.search(name):
            continue
        kind, btype = classify(name)
        if kind in ("Инфраструктура", "Фотоволтаици", "Друго"):
            continue
        number = str(int(r["Номер"])) if (r.get("Номер") or "").strip().isdigit() else (r.get("Номер") or "").strip()
        companies, public, people = split_investor(r.get("Възложител", ""))
        uve = by_permit.get((number, d))
        how = "разрешението е посочено в удостоверението за въвеждане в експлоатация" if uve else ""
        pi = parcel(r)
        if not uve and pi:
            later = [u for u in by_parcel.get(pi, []) if u["date"] >= d and similar(name, u["object"])]
            if later:
                uve, how = later[0], "УВЕ за същия имот (ПИ) със сходно име на обекта"
        rows.append({
            "date": d, "number": number, "permit": f"{number}/{d[8:10]}.{d[5:7]}.{d[:4]}",
            "district": (r.get("Район") or "").strip(), "part": (r.get("Градска част") or "").strip(),
            "object": name, "kind": kind, "building_type": btype,
            "investor": re.sub(r"\s+", " ", r.get("Възложител") or "").strip(),
            "companies": companies, "public": public, "people": people,
            "kvartal": (r.get("Квартал") or "").strip(), "upi": (r.get("УПИ") or "").strip(), "pi": pi,
            "url": r.get("Линк към записа", ""), "uve": uve, "uve_how": how,
        })
    return group(rows)


def group(rows: list[dict]) -> list[dict]:
    """Един ред за имот и възложител; по-старите разрешения за същия имот отиват в „още разрешения“."""
    out: dict[str, dict] = {}
    for r in sorted(rows, key=lambda r: r["date"], reverse=True):
        site = r["pi"] or (f'{normalize_name(r["part"])}|{re.sub(r"[^0-9]", "", r["kvartal"])}|'
                           f'{re.split(r"[-–,]", r["upi"])[0].strip().upper()}' if r["upi"] else "")
        who = normalize_name(r["companies"][0]) if r["companies"] else normalize_name(r["investor"])[:40]
        key = f"{site}|{who}" if site else f'{r["permit"]}|{who}'
        if key in out:
            out[key]["other_permits"].append(r)
        else:
            out[key] = {**r, "other_permits": []}
    result = []
    for o in out.values():
        everything = [o] + o["other_permits"]
        active = [x for x in everything if not x["uve"]]
        o["completed"] = not active
        if o["completed"]:
            o["uve_text"] = "; ".join(f'УВЕ {x["uve"]["number"]}/{x["uve"]["date"]}' for x in everything if x["uve"])
        else:
            o["uve_text"] = "; ".join(f'част: УВЕ {x["uve"]["number"]}/{x["uve"]["date"]} ({x["permit"]})'
                                      for x in everything if x["uve"])
        newest = active[0] if active else o
        # РЗП не е в регистъра: размерът се преценява по описанието (за срока до Акт 14)
        big = re.search(r"(?i)комплекс|подземн|високо|многоетаж|секци|блок|корпус|етап", o["object"])
        mid = o["building_type"] in ("Жилищна – многофамилна", "Смесено предназначение", "Офис / административна",
                                     "Хотел", "Обществена", "Търговска")
        p = {"in_force": newest["date"], "kind": o["kind"], "rzp": 6000 if big else 2000 if mid else 500}
        o["stage"], o["stage_code"] = ("Въведена в експлоатация", "done") if o["completed"] else stage(p)
        o["facade"] = (not o["completed"] and o["kind"] in FACADE_KINDS and o["stage_code"] in ("hole", "rough", "late")
                       and o["building_type"] not in ("Гаражи / паркинг",))
        o["score"] = score(o)
        result.append(o)
    result.sort(key=lambda o: (-o["facade"], -o["score"], o["date"]), reverse=False)
    return sorted(result, key=lambda o: (not o["facade"], -o["score"], [-int(x) for x in o["date"].split("-")]))


def score(o: dict) -> int:
    s = {"Ново строителство": 45, "Фасадна реновация": 40, "Надстрояване / пристрояване": 30,
         "Преустройство / ремонт": 8, "Допълващо застрояване": 5}.get(o["kind"], 0)
    s += {"Жилищна – многофамилна": 25, "Смесено предназначение": 25, "Офис / административна": 22,
          "Хотел": 22, "Обществена": 18, "Търговска": 14, "Логистика / промишленост": 10,
          "Жилищна – еднофамилна": 4}.get(o["building_type"], 6)
    if re.search(r"(?i)комплекс|подземн\w* гараж|високо|многоетаж|блок", o["object"]):
        s += 12
    if o["companies"]:
        s += 10
    s += {"hole": 8, "rough": 8, "late": 4}.get(o["stage_code"], 0)
    return min(s, 100)


# ---------------------------------------------------------------------------
# Контакти на фирмите-възложители
# ---------------------------------------------------------------------------

def contacts(objs: list[dict], log: RunLog) -> dict[str, dict]:
    import json
    builders = {}
    path = OUT / "stroiteli.json"
    if path.exists():
        builders = {b["eik"]: b for b in json.loads(path.read_text(encoding="utf-8")) if b.get("eik")}
    names = []
    for o in objs:
        if o["completed"]:
            continue
        for c in o["companies"]:
            if c not in names:
                names.append(c)
    log.log(f"Фирми-възложители за проверка в Търговския регистър и КСБ: {len(names)}")
    http_tr, http = Http(delay=6.0), Http()
    out = {}
    for i, name in enumerate(names, 1):
        c = company_contact(name, http_tr, http, cached, log)
        b = builders.get(c.get("eik") or "-")
        if b:  # строител от КСБ Пловдив – там често има телефон и имейл
            for ph in b["phones"]:
                if ph not in c["phones"]:
                    c["phones"].append(ph)
            for em in b["emails"]:
                if em not in c["emails"]:
                    c["emails"].append(em)
            c["is_builder"] = True
        out[name] = c
        if i % 20 == 0:
            log.log(f"  {i}/{len(names)}")
            log.checkpoint("plovdiv_permits_contacts", done=i, total=len(names))
    return out


def write(objs: list[dict], comp: dict[str, dict]) -> None:
    header = ["За фасада", "Оценка", "Етап (приблизително)", "Дата на РС", "№ РС", "Район", "Част / местност",
              "Обект", "Вид", "Тип сграда", "Възложител (както е в регистъра)", "Фирма", "ЕИК", "Телефон", "Имейл",
              "Сайт", "Управители", "Строител (КСБ)", "Квартал", "УПИ", "ПИ", "Още разрешения за имота",
              "Въведени части / УВЕ", "Линк към регистъра"]
    rows = []
    for o in objs:
        firms = [comp.get(c, {}) for c in o["companies"]]
        def join(key, n=3):
            return ", ".join(dict.fromkeys(x for f in firms for x in (f.get(key) or [])[:n]))
        rows.append([
            "да" if o["facade"] else "", o["score"], o["stage"], o["date"], o["permit"], o["district"], o["part"],
            o["object"], o["kind"], o["building_type"], o["investor"], " | ".join(o["companies"]),
            ", ".join(f.get("eik", "") for f in firms if f.get("eik")), join("phones"), join("emails"),
            next((f["website"] for f in firms if f.get("website")), ""), join("managers", 2),
            "да" if any(f.get("is_builder") for f in firms) else "",
            o["kvartal"], o["upi"], o["pi"], ", ".join(x["permit"] for x in o["other_permits"][:6]),
            o.get("uve_text", ""), o["url"]])
    with open(OUT / "chastni_obekti.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(header)
        w.writerows(rows)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--since", default="2023-01-01", help="разрешения, издадени след тази дата")
    args = ap.parse_args()
    log = RunLog("plovdiv_permits")
    permits = read(RAW / "plovdiv_razreshenia.csv")
    vavedeni = read(RAW / "plovdiv_vavedeni.csv")
    objs = objects(permits, vavedeni, args.since)
    active = [o for o in objs if not o["completed"]]
    log.log(f"Сгради след {args.since}: {len(objs)} имота, завършени {len(objs) - len(active)}, "
            f"за фасада {sum(1 for o in objs if o['facade'])}")
    comp = contacts(objs, log)
    write(objs, comp)
    from plovdiv import write_xlsx
    write_xlsx()
    with_contact = sum(1 for o in objs if o["facade"] and any(
        comp.get(c, {}).get("phones") or comp.get(c, {}).get("emails") for c in o["companies"]))
    log.log(f"За фасада с телефон/имейл на фирмата-възложител: {with_contact}")
    log.log(f"Готово: {OUT / 'chastni_obekti.csv'}")


if __name__ == "__main__":
    main()
