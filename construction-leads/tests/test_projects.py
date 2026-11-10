"""Проверки срещу смесване на проекти и грешно приписване на контакти (без мрежа)."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from leads import projects  # noqa: E402
from leads.projects import (assess, contacts_from, domain_matches_name, events_in, fake_phone,  # noqa: E402
                            published_date, roles_in)

P = {"hash": "H1", "number": "63/27.03.2025", "region": "Младост", "locality": "ЖГ КАМБАНИТЕ - МЛАДОСТ 4",
     "kkkr": "68134.4090.1616", "upi": "VI-1407-за ЖС", "scope": "Квартал по регулация: 44, УПИ: VI-1407",
     "address": "гр. София", "investor_companies": ['"ВА БУЛ СЪРВИЗ" ООД'],
     "contacts": [{"name": '"ВА БУЛ СЪРВИЗ" ООД', "role": "Инвеститор", "eik": "200213515", "phones": [],
                   "emails": [], "website": "", "sources": [], "links": {}}]}
OTHER = {"68134.1505.2183": {"H2"}, "68134.4090.1616": {"H1"}}


def page(url, text, title="", links=None, published=""):
    return {"url": url, "type": "html", "title": title, "h1": "", "text": text, "links": links or [],
            "published": published, "published_how": "мета-данни" if published else ""}


# ------------------------------------------------------------------ доказателства за обекта

def test_strong_ids_permit_kkkr_and_upi():
    a = assess(page("u", "разрешение за строеж №63/27.3.25 година, имот 68134.4090.1616.6.14"), P, OTHER)
    whats = {s["what"] for s in a["strong"]}
    assert "разрешение № 63/27.03.2025" in whats and "кадастрален имот 68134.4090.1616" in whats
    a = assess(page("u", "УПИ VI-1407, кв. 44, м. Камбаните"), P, OTHER)
    assert a["strong"] and a["strong"][0]["what"].startswith("УПИ")


def test_neighbourhood_name_or_similar_number_is_not_enough():
    a = assess(page("u", "Ва Бул Сървиз строи в Младост 4 сграда с РЗП 19 800 кв.м, имот 68134.4090.16160"), P, OTHER)
    assert not a["strong"]                          # квартал, име, РЗП и друг имот (…16160) не стигат


def test_listing_page_roles_only_next_to_our_id():
    text = ("Класация 2025. Обект 1: имот 68134.1505.2183, Архитект: Студио Алфа ООД. " + "x " * 900 +
            "Обект 2: имот 68134.4090.1616, Архитект: Бюро Бета ООД.")
    a = assess(page("u", text), P, OTHER)
    assert a["other_objects"] == ["H2"]
    near = roles_in(text, near=a["strong"][0]["pos"])
    assert [r["name"] for r in near] == ["Бюро Бета ООД"]


def test_project_name_must_match_exactly():
    pn = [{"name": "Vabul ONE", "url": "x", "basis": "разрешение", "snippet": ""}]
    ev_res = assess(page("u", "Vabul Residence, Ва Бул Сървиз ООД, Дружба 2"), P, OTHER)
    assert projects.chained(page("u", "Vabul Residence, Ва Бул Сървиз ООД"), ev_res, pn) is None
    ev_one = assess(page("u", "Vabul ONE – инвеститор Ва Бул Сървиз ООД"), P, OTHER)
    assert projects.chained(page("u", "Vabul ONE – инвеститор Ва Бул Сървиз ООД"), ev_one, pn)
    ev_noinv = assess(page("u", "Vabul ONE в Младост"), P, OTHER)
    assert projects.chained(page("u", "Vabul ONE в Младост"), ev_noinv, pn) is None   # без инвеститора – не


def test_same_investor_other_district_is_other_object():
    a = assess(page("u", "Ва Бул Сървиз ООД представя комплекс в Дружба 2"), P, OTHER)
    assert a["investor"] and not a["locality"] and "дружба" in a["other_places"]


def test_register_mirror_gives_no_project_name_or_event():
    assert projects.is_mirror("https://akt16.bg/razreshenie/63-27-03-2025")
    assert projects.is_mirror("https://x.bg/a", "Разрешение за строеж №63 от 27.03.2025")


# ------------------------------------------------------------------ роли

def test_roles_from_labels_and_noise():
    t = ("Инвеститор Ва Бул Сървиз ООД Изпълнител Елит Строителна Компания ЕООД За проекта. "
         "Проектът е дело на ИПА Архитекти и е разработен. ИЗПЪЛНИТЕЛ-ПРОДАВАЧ. АРХИТЕКТУРА:\n\n231\n")
    got = {(r["role"], r["name"]) for r in roles_in(t)}
    assert got == {("строител", "Елит Строителна Компания ЕООД"), ("архитект", "ИПА Архитекти")}


# ------------------------------------------------------------------ контакти

def test_foreign_email_and_fake_phones_not_attributed():
    pg = page("https://elitebuild.bg/", "Тел. +359 2 828 4872, sales@roi.bg, office@elitebuild.bg, +359 123 456 789",
              links=[["mailto:info@elitebuild.bg", "", ""], ["tel:0888000000", "", ""]])
    c = contacts_from(pg, "elitebuild.bg")
    assert "sales@roi.bg" not in c["emails"] and "sales@roi.bg" in c["foreign_emails"]
    assert set(c["emails"]) == {"office@elitebuild.bg", "info@elitebuild.bg"}
    assert "+359123456789" not in c["phones"] and "+359888000000" not in c["phones"]
    assert fake_phone("+359888888888") and not fake_phone("+35928284872")
    price = contacts_from(page("https://x.bg/", "Топ оферта 280 000 225 000 € Тел.: 02 868 75 74"), "x.bg")
    assert price["phones"] == ["+35928687574"]          # цената не е телефон


def test_shared_phone_between_participants_is_not_attributed():
    res = {"contacts": [
        {"participant": "А", "eik": "1", "phones": ["+35921111111", "+35922222222"], "url": "a"},
        {"participant": "Б", "eik": "2", "phones": ["+35921111111"], "url": "b"}], "candidates": []}
    projects.flag_shared_phones(res)
    assert res["contacts"][0]["phones"] == ["+35922222222"] and res["contacts"][1]["phones"] == []
    assert res["candidates"]


def test_domain_must_match_company_name():
    assert domain_matches_name("vabul.com", '"ВА БУЛ СЪРВИЗ" ООД')
    assert domain_matches_name("capitol.bg", '"КАПИТОЛ БИЛД" ООД')
    assert not domain_matches_name("bg.parkopedia.com", '"Парк Надежда"АД')
    assert not domain_matches_name("ip-arch.com", '"ВА БУЛ СЪРВИЗ" ООД')


# ------------------------------------------------------------------ дати

def test_dates_are_not_invented():
    from bs4 import BeautifulSoup
    assert published_date(BeautifulSoup("<html><body>Без дата</body></html>", "html.parser"), "Без дата") == ("", "")
    soup = BeautifulSoup('<meta property="article:published_time" content="2025-07-27T10:00">', "html.parser")
    assert published_date(soup, "")[0] == "2025-07-27"
    assert events_in(page("u", "Successfully laid foundation for X")) == []          # без дата – няма събитие
    ev = events_in(page("u", "Successfully laid foundation for X", title="Foundation laid", published="2025-07-27"))
    assert ev and ev[0]["date"] == "2025-07-27"


# ------------------------------------------------------------------ прилагане към обекта

def test_apply_does_not_override_manual_confirmation(tmp_path, monkeypatch):
    monkeypatch.setattr(projects, "CACHE", tmp_path)
    res = {"version": projects.VERSION, "hash": "H1", "checked": "2026-10-06", "project_names": [], "pages": [],
           "sites": {}, "events": [], "rejected": [], "candidates": [], "contacts": [],
           "links": [{"role": "строител", "name": "ДРУГ СТРОИТЕЛ", "eik": "111111111", "status": "потвърдена",
                      "basis": "b", "sources": [{"url": "u", "snippet": "s", "published": ""}], "checked": "2026-10-06"}]}
    projects.save(res)
    p = {"hash": "H1", "contacts": [{"name": "РЪЧЕН", "role": "Строител", "eik": "202642315", "phones": [],
                                     "emails": [], "link_evidence": [{"source": "ръчно"}]}]}
    projects.apply_projects(p)
    assert [c["name"] for c in p["contacts"]] == ["РЪЧЕН"]
    assert any("ръчно е потвърден" in r["reason"] for r in p["review"])


def test_investor_name_made_of_common_words_needs_legal_form():
    p = {**P, "investor_companies": ['"Парк Надежда"АД'], "contacts": []}
    assert not assess(page("u", "Приключва обновяването на столичния парк „Надежда“"), p, OTHER)["investor"]
    assert assess(page("u", "Инвеститор: „Парк Надежда“ АД"), p, OTHER)["investor"]


def test_hints_from_excluded_page_are_removed():
    from leads.evidence import apply_manual
    p = {"hash": "H", "number": "1", "region": "", "architects": [], "contacts": [],
         "stage_hints": [{"text": "издаден АКТ 16", "url": "https://other-project"}]}
    apply_manual(p, {"H": [{"obekt": "H", "pole": "изключен източник", "stoinost": "x", "status": "", "eik": "",
                            "iztochnik": "", "url": "https://other-project", "publikuvano": "", "provereno": "",
                            "belezhka": "друг проект"}]})
    assert p["stage_hints"] == []
