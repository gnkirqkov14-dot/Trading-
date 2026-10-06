"""Свързване на фирмите-инвеститори по ЕИК, прочетен от PDF-а на разрешението.

Резултатът за всяко разрешение се пази в cache/eiklink/<hash>.json:
    {"at": дата, "pdf_url": ..., "companies": {име от регистъра: решение}}
Решение:
    status  'потвърден'    – ЕИК от PDF-а, валидна контролна цифра, фирмата е намерена
                              в Търговския регистър и името ѝ съвпада;
            'за проверка'  – неясно разчитане, няколко кандидата, различни имена или
                              противоречие с досегашния ЕИК (намерен по име);
            'не е разчетен' – PDF-ът липсва/не се отвори или в него няма ЕИК на инвеститора.
    eik, tr_name, reason, evidence {source, pdf_url, snippet, at}
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

from . import ksb, tr
from .eik import document_type, match_investors, protocol_date, role_party, similarity, valid_eik
from .http import Http
from .ksb import normalize_name
from .permit_pdf import permit_text
from .runlog import RunLog, now

CACHE = Path(__file__).resolve().parent.parent / "cache"


def link_path(permit_hash: str) -> Path:
    return CACHE / "eiklink" / f"{hashlib.sha1(permit_hash.encode()).hexdigest()[:16]}.json"


VERSION = 4  # при промяна на правилата старите решения се изчисляват наново (от кеша)


def load_link(permit_hash: str) -> dict | None:
    path = link_path(permit_hash or "")
    if not path.exists():
        return None
    data = json.loads(path.read_text(encoding="utf-8"))
    return data if data.get("version") == VERSION else None


def _cached(name: str, key: str, fetch):
    path = CACHE / name / f"{hashlib.sha1(key.encode()).hexdigest()[:16]}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    value = fetch()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False), encoding="utf-8")
    return value


def tr_by_eik(http_tr: Http, eik: str) -> dict | None:
    rec = _cached("tr_eik", eik, lambda: tr.deed(http_tr, eik))
    return rec if rec and rec.get("tr_name") else None


def ksb_by_eik(http: Http, eik: str) -> dict | None:
    def fetch():
        hits = [h for h in ksb.search(http, eik=eik) if h.get("eik") == eik]
        return ksb.profile(http, hits[0]["ksb_id"]) if hits else None
    return _cached("ksb_eik", eik, fetch)


def link_permit(p: dict, name_eiks: dict[str, str], http: Http, http_tr: Http, log: RunLog) -> dict:
    """name_eiks: {фирма: ЕИК, намерен досега по име} – за откриване на противоречия."""
    path = link_path(p["hash"])
    done = load_link(p["hash"])
    if done:  # вече обработено със същите правила – не се прави втори път
        return done
    companies = p.get("investor_companies", [])
    doc = permit_text(http, p, log)
    if doc is None:
        # Не кешираме неуспеха: при следващо пускане се опитва отново
        return {"at": now(), "pdf_url": p.get("pdf_url"), "companies": {
            c: {"status": "не е разчетен", "reason": "PDF-ът липсва или не се отвори"} for c in companies}}
    decisions = match_investors(companies, doc["text"])
    # Няколко ЕИК в частта с инвеститора: всеки се проверява в Търговския регистър и се приема
    # само при еднозначно съвпадение на името (иначе остава „за проверка“)
    amb = {c: d for c, d in decisions.items() if d.get("candidate_eiks")}
    if amb:
        names = {}
        for e in {e for d in amb.values() for e in d["candidate_eiks"]}:
            try:
                rec = tr_by_eik(http_tr, e)
                log.success("tr_eik", e)
            except Exception as exc:
                log.failure("tr_eik", e, exc)
                rec = None
            if rec:
                names[e] = rec["tr_name"]
        for c, d in amb.items():
            good = [e for e, n in names.items() if similarity(n, c) >= 0.85]
            others = [x for x in companies if x != c]
            if len(good) == 1 and not any(similarity(names[good[0]], o) >= 0.85 for o in others):
                d.update(status="намерен", eik=good[0], pdf_name=names[good[0]],
                         resolved="избран сред няколко ЕИК по името в Търговския регистър")
    for c, d in decisions.items():
        d["evidence"] = {"source": "PDF на разрешението за строеж", "pdf_url": p.get("pdf_url"),
                         "snippet": d.get("snippet", ""), "at": doc.get("at")}
        if d["status"] != "намерен":
            continue
        try:
            rec = tr_by_eik(http_tr, d["eik"])
            log.success("tr_eik", d["eik"])
        except Exception as exc:
            log.failure("tr_eik", d["eik"], exc)
            d.update(status="за проверка", reason="Търговският регистър не отговори – опитай пак")
            continue
        if not rec:
            d.update(status="за проверка", reason="ЕИК не е намерен в Търговския регистър (възможна грешка при разчитане)")
            continue
        d["tr_name"] = rec["tr_name"]
        s_reg = similarity(rec["tr_name"], c)
        s_pdf = similarity(rec["tr_name"], d.get("pdf_name", ""))
        prev = name_eiks.get(c)
        if prev and prev != d["eik"]:
            d.update(status="за проверка", reason=f"противоречие: по име е намерен ЕИК {prev}, в PDF-а – {d['eik']}")
        elif s_pdf >= 0.85 or s_reg >= 0.8:
            d["status"] = "потвърден"
            if s_reg < 0.6:
                d["note"] = f"в регистъра на общината името е записано различно („{c}“)"
        else:
            d.update(status="за проверка", reason=f"името в Търговския регистър („{rec['tr_name']}“) не съвпада")
        try:
            prof = ksb_by_eik(http, d["eik"]) if d["status"] == "потвърден" else None
            log.success("ksb_eik", d["eik"])
        except Exception as exc:
            log.failure("ksb_eik", d["eik"], exc)
            prof = None
        d["tr"] = rec
        d["ksb"] = prof
    result = {"version": VERSION, "at": now(), "pdf_url": p.get("pdf_url"), "companies": decisions,
              "document": {"type": document_type(doc["text"]), "ocr_at": doc.get("at")}}
    if result["document"]["type"].startswith("протокол"):
        # Официален документ: строителната площадка е открита => строежът е започнал
        result["document"]["date"] = protocol_date(doc["text"])
        b = role_party(doc["text"], "строител")
        if b:
            bd = {"name": b["name"] + (" " + b["form"] if b["form"] else ""), "eik": b["eik"],
                  "snippet": b["snippet"], "status": "за проверка"}
            if not b["valid"]:
                bd["reason"] = "ЕИК на строителя е разчетен с грешна контролна цифра"
            else:
                try:
                    rec = tr_by_eik(http_tr, b["eik"])
                    log.success("tr_eik", b["eik"])
                except Exception as exc:
                    log.failure("tr_eik", b["eik"], exc)
                    rec, bd["reason"] = None, "Търговският регистър не отговори – опитай пак"
                in_section = rec and normalize_name(rec["tr_name"]) in normalize_name(b.get("section", ""))
                if rec and (similarity(rec["tr_name"], b["name"]) >= 0.85 or in_section):
                    bd.update(status="потвърден", tr_name=rec["tr_name"], tr=rec)
                    try:
                        bd["ksb"] = ksb_by_eik(http, b["eik"])
                    except Exception as exc:
                        log.failure("ksb_eik", b["eik"], exc)
                elif rec:
                    bd["reason"] = f"името в Търговския регистър („{rec['tr_name']}“) не съвпада"
                elif "reason" not in bd:
                    bd["reason"] = "ЕИК на строителя не е намерен в Търговския регистър"
            result["builder"] = bd
    if any("опитай пак" in (d.get("reason") or "") for d in
           list(decisions.values()) + [result.get("builder") or {}]):
        return result  # временен неуспех – не записваме, за да се опита отново
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    tmp.write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)
    return result


def link_many(permits: list[dict], name_eiks: dict, log: RunLog, step: str = "eik",
              batch: int = 5) -> dict[str, dict]:
    http = Http(retries=2, timeout=90)
    http_tr = Http(delay=6.0)
    out = {}
    for i, p in enumerate(permits, 1):
        out[p["hash"]] = link_permit(p, name_eiks, http, http_tr, log)
        if i % batch == 0 or i == len(permits):
            log.checkpoint(step, done=i, total=len(permits), last=p["hash"])
            log.log(f"  ЕИК от PDF: {i}/{len(permits)}")
    return out


def apply_eik(p: dict) -> None:
    """Прилага записаното решение (ако има) към контактите на инвеститорите в разрешението."""
    from .enrich import _merge, _new_contact
    link = load_link(p.get("hash") or "")
    if not link:
        return
    p["eik_checked_at"] = link.get("at")
    doc = link.get("document") or {}
    p["attached_document"] = doc.get("type", "")
    if doc.get("type", "").startswith("протокол"):
        p.setdefault("milestones", []).append({
            "what": "открита строителна площадка – строежът е започнал (протокол обр. 2)",
            "date": doc.get("date", ""), "source": "документ, прикачен към разрешението в регистъра на НАГ",
            "url": link.get("pdf_url", ""), "retrieved": doc.get("ocr_at", "")})
    b = link.get("builder")
    if b:
        p["doc_builder"] = {k: b.get(k) for k in ("name", "eik", "status", "reason", "tr_name", "snippet")}
        p["doc_builder"]["url"] = link.get("pdf_url", "")
        p["doc_builder"]["date"] = doc.get("ocr_at", "")
        if b["status"] == "потвърден":
            rec = b.get("tr") or {}
            bc = {**_new_contact(b.get("tr_name") or b["name"]), "role": "Строител", "eik": b["eik"]}
            bc["managers"] = [m for m in rec.get("managers", []) if "Заличено" not in m]
            bc.setdefault("links", {})["Търговски регистър"] = rec.get("tr_url", "")
            _merge(bc, [rec.get("phone")], [rec.get("email")], rec.get("website", ""), "Търговски регистър (ЕИК от протокол)")
            prof = b.get("ksb")
            if prof:
                bc["links"]["КСБ"] = prof.get("ksb_url", "")
                for block in (prof.get("office") or {}, prof.get("seat") or {}):
                    _merge(bc, [block.get("phone")], [block.get("email")], block.get("website", ""), "КСБ")
            bc["link_basis"] = "посочен като строител в протокол обр. 2 за откриване на строителната площадка"
            p.setdefault("contacts", []).append(bc)
    for company, d in link.get("companies", {}).items():
        contact = next((c for c in p.get("contacts", []) if c.get("role", "").startswith("Инвеститор")
                        and c.get("name") == company), None)
        if contact is None:
            contact = {**_new_contact(company), "role": "Инвеститор"}
            p.setdefault("contacts", []).append(contact)
        contact["eik_status"] = d["status"]
        contact["eik_reason"] = d.get("reason") or d.get("note", "")
        contact["eik_evidence"] = d.get("evidence")
        if d["status"] != "потвърден":
            continue
        rec = d.get("tr") or {}
        if contact.get("eik") and contact["eik"] != d["eik"]:
            continue  # не трябва да се случва: противоречието вече е „за проверка“
        contact["eik"] = d["eik"]
        contact["address"] = contact.get("address") or rec.get("address", "")
        contact["managers"] = contact.get("managers") or [m for m in rec.get("managers", []) if "Заличено" not in m]
        contact.setdefault("links", {})["Търговски регистър"] = rec.get("tr_url", "")
        _merge(contact, [rec.get("phone")], [rec.get("email")], rec.get("website", ""),
               "Търговски регистър (ЕИК от PDF)")
        prof = d.get("ksb")
        if prof:
            contact["is_builder"] = True
            contact["role"] = "Инвеститор и строител (КСБ)"
            contact["links"]["КСБ"] = prof.get("ksb_url", "")
            for block in (prof.get("office") or {}, prof.get("seat") or {}):
                _merge(contact, [block.get("phone")], [block.get("email")], block.get("website", ""), "КСБ")
