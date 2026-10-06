"""Проверки за първия етап: ЕИК от PDF, двусмислени съвпадения, показатели по филтри,
продължаване след прекъсване. Без мрежа: PDF-ите и регистрите са подменени."""
from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from leads import eik_link  # noqa: E402
from leads.eik import extract_pairs, match_investors, valid_eik  # noqa: E402
from leads.runlog import RunLog  # noqa: E402

GOOD_A, GOOD_B = "831642968", "207152190"   # верни контролни цифри
BAD = "831642961"                            # същият ЕИК с грешна последна цифра


# ---------------------------------------------------------------- грешно разчетен ЕИК

def test_checksum():
    assert valid_eik(GOOD_A) and valid_eik(GOOD_B)
    assert not valid_eik(BAD)
    assert not valid_eik("12345678")      # 8 цифри
    assert not valid_eik("83164296a")


def test_ocr_letters_fixed_only_when_checksum_holds():
    pairs = extract_pairs("„КЕТ“ АД, ЕИК: 83l64296O")   # l→1, O→0
    assert pairs[0]["eik"] == "831642960" and pairs[0]["ocr_fixed"]
    assert not pairs[0]["valid"]            # поправката не „спасява“ грешна контролна цифра
    pairs = extract_pairs("„КЕТ“ АД, ЕИК: 83l642968")
    assert pairs[0]["eik"] == GOOD_A and pairs[0]["valid"]


def test_invalid_checksum_goes_to_review():
    text = "Разрешава се на: „КЕТ“ АД, ЕИК: 831642961 съгласно одобрен проект"
    d = match_investors(["КЕТ АД"], text)["КЕТ АД"]
    assert d["status"] == "за проверка" and "контролна цифра" in d["reason"]
    assert "eik" not in d


# ---------------------------------------------------------------- двусмислени съвпадения

def test_two_companies_two_eiks_matched_by_name():
    text = ("Разрешава се на: „КЕТ“ АД, ЕИК: 831642968 и „ИНФИНИТИ НОВА“ ЕООД, ЕИК: 207152190 "
            "съгласно одобрен проект")
    r = match_investors(["КЕТ АД", "ИНФИНИТИ НОВА ЕООД"], text)
    assert r["КЕТ АД"]["eik"] == GOOD_A
    assert r["ИНФИНИТИ НОВА ЕООД"]["eik"] == GOOD_B


def test_similar_names_are_not_guessed():
    text = ("Разрешава се на: „АЛФА ИНВЕСТ 1“ ООД, ЕИК: 831642968 и „АЛФА ИНВЕСТ 2“ ООД, ЕИК: 207152190 "
            "съгласно одобрен проект")
    d = match_investors(["АЛФА ИНВЕСТ ООД"], text)["АЛФА ИНВЕСТ ООД"]
    assert d["status"] == "за проверка" and "eik" not in d
    assert set(d["candidate_eiks"]) == {GOOD_A, GOOD_B}


def test_eik_of_other_company_is_not_assigned():
    text = "Разрешава се на: „КЕТ“ АД, ЕИК: 831642968 и ИВАН ПЕТРОВ съгласно одобрен проект"
    r = match_investors(["КЕТ АД", "ДРУГА ФИРМА ООД"], text)
    assert r["КЕТ АД"]["eik"] == GOOD_A
    assert r["ДРУГА ФИРМА ООД"]["status"] == "не е разчетен"


def test_eik_outside_investor_section_ignored():
    text = ("Разрешава се на: „КЕТ“ АД съгласно одобрен проект. "
            "Строителен надзор: „НАДЗОР“ ООД, ЕИК: 831642968")
    d = match_investors(["КЕТ АД"], text)["КЕТ АД"]
    assert d["status"] == "не е разчетен"


# ---------------------------------------------------------------- свързване (без мрежа)

@pytest.fixture
def offline(tmp_path, monkeypatch):
    """Кеш във временна папка; PDF-ът и регистрите са подменени и броят обажданията."""
    monkeypatch.setattr(eik_link, "CACHE", tmp_path / "cache")
    calls = {"pdf": [], "tr": []}
    texts, registry = {}, {}

    def fake_text(http, p, log):
        calls["pdf"].append(p["hash"])
        t = texts.get(p["hash"])
        return {"text": t, "at": "2026-10-06T10:00:00"} if t is not None else None

    def fake_tr(http_tr, eik):
        calls["tr"].append(eik)
        return {"tr_name": registry[eik], "tr_url": f"tr/{eik}"} if eik in registry else None

    monkeypatch.setattr(eik_link, "permit_text", fake_text)
    monkeypatch.setattr(eik_link, "tr_by_eik", fake_tr)
    monkeypatch.setattr(eik_link, "ksb_by_eik", lambda http, eik: None)
    monkeypatch.setattr(eik_link, "Http", lambda **kw: object())
    log = RunLog("test", folder=tmp_path / "logs")
    return {"texts": texts, "registry": registry, "calls": calls, "log": log, "tmp": tmp_path}


def permit(h, companies):
    return {"hash": h, "investor_companies": companies, "pdf_url": f"pdf/{h}"}


def test_confirmed_needs_registry_name(offline):
    offline["texts"]["h1"] = "Разрешава се на: „КЕТ“ АД, ЕИК: 831642968 съгласно одобрен проект"
    offline["registry"][GOOD_A] = "КЕТ"
    r = eik_link.link_permit(permit("h1", ["КЕТ АД"]), {}, None, None, offline["log"])
    d = r["companies"]["КЕТ АД"]
    assert d["status"] == "потвърден" and d["eik"] == GOOD_A
    assert d["evidence"]["pdf_url"] == "pdf/h1" and d["evidence"]["at"]


def test_registry_name_mismatch_goes_to_review(offline):
    offline["texts"]["h2"] = "Разрешава се на: „КЕТ“ АД, ЕИК: 831642968 съгласно одобрен проект"
    offline["registry"][GOOD_A] = "СЪВСЕМ ДРУГА КОМПАНИЯ"
    d = eik_link.link_permit(permit("h2", ["КЕТ АД"]), {}, None, None, offline["log"])["companies"]["КЕТ АД"]
    assert d["status"] == "за проверка" and "не съвпада" in d["reason"]


def test_contradiction_with_name_based_eik(offline):
    offline["texts"]["h3"] = "Разрешава се на: „КЕТ“ АД, ЕИК: 831642968 съгласно одобрен проект"
    offline["registry"][GOOD_A] = "КЕТ"
    d = eik_link.link_permit(permit("h3", ["КЕТ АД"]), {"КЕТ АД": GOOD_B}, None, None,
                             offline["log"])["companies"]["КЕТ АД"]
    assert d["status"] == "за проверка" and "противоречие" in d["reason"]


def test_missing_from_registry_goes_to_review(offline):
    offline["texts"]["h4"] = "Разрешава се на: „КЕТ“ АД, ЕИК: 831642968 съгласно одобрен проект"
    d = eik_link.link_permit(permit("h4", ["КЕТ АД"]), {}, None, None, offline["log"])["companies"]["КЕТ АД"]
    assert d["status"] == "за проверка"


# ---------------------------------------------------------------- продължаване след прекъсване

def test_resume_after_interruption_without_duplicates(offline):
    permits = [permit(f"p{i}", ["КЕТ АД"]) for i in range(12)]
    for p in permits:
        offline["texts"][p["hash"]] = "Разрешава се на: „КЕТ“ АД, ЕИК: 831642968 съгласно одобрен проект"
    offline["registry"][GOOD_A] = "КЕТ"
    real = eik_link.link_permit
    count = {"n": 0}

    def interrupted(*a, **kw):
        count["n"] += 1
        if count["n"] == 8:
            raise KeyboardInterrupt
        return real(*a, **kw)

    eik_link.link_permit = interrupted
    try:
        with pytest.raises(KeyboardInterrupt):
            eik_link.link_many(permits, {}, offline["log"], step="t", batch=5)
    finally:
        eik_link.link_permit = real
    state = json.loads((offline["tmp"] / "logs" / "state-t.json").read_text(encoding="utf-8"))
    assert state["done"] == 5                       # записано след първата порция
    assert len(offline["calls"]["pdf"]) == 7        # 7 обработени преди прекъсването
    offline["calls"]["pdf"].clear()
    out = eik_link.link_many(permits, {}, offline["log"], step="t", batch=5)
    assert sorted(offline["calls"]["pdf"]) == sorted(f"p{i}" for i in range(7, 12))  # само останалите
    assert len(out) == 12 and all(r["companies"]["КЕТ АД"]["status"] == "потвърден" for r in out.values())
    state = json.loads((offline["tmp"] / "logs" / "state-t.json").read_text(encoding="utf-8"))
    assert state["done"] == 12
    files = list((offline["tmp"] / "cache" / "eiklink").glob("*.json"))
    assert len(files) == 12 and not list((offline["tmp"] / "cache" / "eiklink").glob("*.part"))


def test_failed_pdf_not_cached_and_retried(offline):
    p = permit("f1", ["КЕТ АД"])
    r = eik_link.link_permit(p, {}, None, None, offline["log"])
    assert r["companies"]["КЕТ АД"]["status"] == "не е разчетен"
    assert eik_link.load_link("f1") is None          # неуспехът не се записва като решение
    offline["texts"]["f1"] = "Разрешава се на: „КЕТ“ АД, ЕИК: 831642968 съгласно одобрен проект"
    offline["registry"][GOOD_A] = "КЕТ"
    assert eik_link.link_permit(p, {}, None, None, offline["log"])["companies"]["КЕТ АД"]["status"] == "потвърден"


def test_registry_outage_not_cached(offline, monkeypatch):
    offline["texts"]["o1"] = "Разрешава се на: „КЕТ“ АД, ЕИК: 831642968 съгласно одобрен проект"

    def down(http_tr, eik):
        raise ConnectionError("timeout")
    monkeypatch.setattr(eik_link, "tr_by_eik", down)
    r = eik_link.link_permit(permit("o1", ["КЕТ АД"]), {}, None, None, offline["log"])
    assert "опитай пак" in r["companies"]["КЕТ АД"]["reason"]
    assert eik_link.load_link("o1") is None
    pending = json.loads((offline["tmp"] / "logs" / "pending_failures.json").read_text(encoding="utf-8"))
    assert f"tr_eik:{GOOD_A}" in pending


def test_pending_failures_dedup_and_clear(tmp_path):
    log = RunLog("t", folder=tmp_path)
    log.failure("pdf", "x", "boom")
    log.failure("pdf", "x", "boom again")
    log.failure("pdf", "y", "boom")
    pending = json.loads((tmp_path / "pending_failures.json").read_text(encoding="utf-8"))
    assert set(pending) == {"pdf:x", "pdf:y"} and pending["pdf:x"]["attempts"] == 2
    history = (tmp_path / "failures.jsonl").read_text(encoding="utf-8").splitlines()
    assert len(history) == 3                          # историята пази всички опити
    log.success("pdf", "x")
    pending = json.loads((tmp_path / "pending_failures.json").read_text(encoding="utf-8"))
    assert set(pending) == {"pdf:y"}


# ---------------------------------------------------------------- показатели по филтри

def _synthetic_permits():
    out = []
    for i in range(40):
        company = i % 2 == 0
        out.append({
            "hash": f"s{i}", "number": str(i), "region": "Лозенец" if i % 3 else "Младост",
            "object": "Жилищна сграда", "kind": "Ново строителство" if i % 4 else "Фасадна реновация",
            "building_type": "", "investor": "ФИРМА ООД" if company else "ИВАН ИВАНОВ",
            "investor_is_company": company, "score": 30 + i * 2, "address": "", "locality": "",
            "url": "", "pdf_url": "", "map_url": "", "in_force": "2025-05-01", "stage": "груб строеж",
            "stage_code": "rough" if i % 5 else "done", "facade_window": i % 5 != 0,
            "stage_status": "потвърден" if i % 7 == 0 else "приблизителен", "stage_evidence": {},
            "investor_phone": "+359888000000" if i % 3 == 0 else "", "investor_email": "",
            "contacts": [{"name": "ФИРМА ООД", "role": "Инвеститор", "phones": [], "emails": [],
                          "eik_status": ["потвърден", "за проверка", "не е разчетен"][i % 3]}],
            "links": ([{"role": "архитект", "name": "А", "status": "потвърдена" if i % 8 == 0 else "кандидат"}]
                      if i % 2 else []) + ([{"role": "строител", "name": "С", "status": "потвърдена"}] if i % 6 == 0 else []),
            "milestones": [{"what": "започнал", "date": "", "url": "", "source": ""}] if i % 9 == 0 else [],
        })
    return out


def _expected(rows):
    n = lambda f: sum(1 for p in rows if f(p))
    return {
        "В селекцията": f"{len(rows)} обекта",
        "с контакт на инвеститора": str(n(lambda p: p["investor_phone"] or p["investor_email"])),
        "ЕИК потвърден от PDF": str(n(lambda p: any(c["eik_status"] == "потвърден" for c in p["contacts"]))),
        "ЕИК за проверка": str(n(lambda p: any(c["eik_status"] == "за проверка" for c in p["contacts"]))),
        "архитект потвърден / кандидат":
            f'{n(lambda p: any(l["role"] == "архитект" and l["status"] == "потвърдена" for l in p["links"]))} / '
            f'{n(lambda p: any(l["role"] == "архитект" and l["status"] != "потвърдена" for l in p["links"]))}',
        "етап потвърден / приблизителен":
            f'{n(lambda p: p["stage_status"] == "потвърден")} / {n(lambda p: p["stage_status"] == "приблизителен")}',
        "потвърдено започнал (протокол обр. 2)": str(n(lambda p: p["milestones"])),
    }


def test_selection_metrics_follow_filters(tmp_path):
    sync_api = pytest.importorskip("playwright.sync_api")
    from leads.report import write_html
    permits = _synthetic_permits()
    html = tmp_path / "r.html"
    write_html(html, permits, [], [], date(2024, 10, 1))
    cases = [
        ({"minscore": "40", "stage": "facade", "who": ""},
         lambda p: p["score"] >= 40 and p["facade_window"]),
        ({"minscore": "0", "stage": "", "who": "co"}, lambda p: p["investor_is_company"]),
        ({"minscore": "0", "stage": "confirmed", "who": ""}, lambda p: p["stage_status"] == "потвърден"),
        ({"minscore": "60", "stage": "", "who": "eikrev"},
         lambda p: p["score"] >= 60 and any(c["eik_status"] == "за проверка" for c in p["contacts"])),
        ({"minscore": "0", "stage": "", "who": "", "region": "Младост"}, lambda p: p["region"] == "Младост"),
    ]
    errors = []
    with sync_api.sync_playwright() as pw:
        exe = Path("/opt/pw-browsers/chromium")   # браузърът в средата (без изтегляне)
        browser = pw.chromium.launch(executable_path=str(exe)) if exe.exists() else pw.chromium.launch()
        page = browser.new_page()
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(html.as_uri())
        total_tiles = page.inner_text("body")
        for filters, pred in cases:
            for sel in ("minscore", "stage", "who", "region"):
                page.select_option(f"#{sel}", filters.get(sel, ""))
            page.dispatch_event("#who", "input")
            got = dict(s.split(": ", 1) for s in page.locator("#selstats span").all_inner_texts())
            exp = _expected([p for p in permits if pred(p)])
            for k, v in exp.items():
                assert got[k] == v, (filters, k, got[k], v)
        browser.close()
    assert not errors, errors
    assert "(всички обекти)" in total_tiles   # общите плочки са отделени от селекцията
