"""ЕИК от текста на разрешението за строеж (разчетен с OCR).

Правила:
- ЕИК е 9 или 13 цифри и контролната цифра трябва да е вярна (иначе е грешно разчетен);
- инвеститорът е в частта „Разрешава се на: …“ – ЕИК от други места (надзор, проектант) не
  се приписват на инвеститора;
- при съмнение (невалиден ЕИК, няколко кандидата, различни имена) резултатът е „за проверка“,
  а не избор по предположение.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher

from .ksb import normalize_name


def valid_eik(eik: str) -> bool:
    """Контролна цифра на ЕИК/БУЛСТАТ (9 или 13 цифри)."""
    if not re.fullmatch(r"\d{9}|\d{13}", eik or ""):
        return False
    d = [int(c) for c in eik]
    s = sum(d[i] * (i + 1) for i in range(8)) % 11
    if s == 10:
        s = sum(d[i] * (i + 3) for i in range(8)) % 11 % 10
    if s != d[8]:
        return False
    if len(eik) == 13:
        w = [2, 7, 3, 5]
        s = sum(d[8 + i] * w[i] for i in range(4)) % 11
        if s == 10:
            w = [4, 9, 5, 7]
            s = sum(d[8 + i] * w[i] for i in range(4)) % 11 % 10
        if s != d[12]:
            return False
    return True


# „ИСА 2000“ ЕООД, ЕИК/Булстат: 831040520  |  „ВА БУЛ СЪРВИЗ“ ООД, Булстат 200213515
PAIR = re.compile(
    r"(?P<name>[„\"“”«]?[^\n,„\"“”«»]{2,60}?[“\"”»]?)\s*"
    r"(?P<form>ЕООД|ООД|ЕАД|АД|ЕТ|КД|СД)?\s*,?\s*"
    r"(?:ЕИК\s*/?\s*(?:Булстат|БУЛСТАТ)?|Булстат|БУЛСТАТ|ЕИК)\s*[:№]?\s*"
    r"(?P<eik>[0-9OoОоlI|]{8,14})",
)
# OCR често бърка 0/O/О и 1/l/I
_DIGIT_FIX = str.maketrans({"O": "0", "o": "0", "О": "0", "о": "0", "l": "1", "I": "1", "|": "1"})


def document_type(text: str) -> str:
    """Какъв документ е прикачен към разрешението в регистъра."""
    low = (text or "").lower()
    if re.search(r"откриване\s+на\s+строителна\s+площадка|образец\s*2", low):
        return "протокол обр. 2 (откриване на строителна площадка)"
    if re.search(r"разреша\w*\s+се\s+на", low):
        return "разрешение за строеж"
    if re.search(r"заповед|допълвам|изменям", low):
        return "заповед към разрешението"
    return "неразпознат документ"


def investor_section(text: str) -> str | None:
    """Частта с инвеститора (възложителя):
    - разрешение: между „Разрешава се на“ и описанието на строежа;
    - протокол обр. 2: от „Възложител(и):“ до „Строителен надзор/Консултант/Строител:“;
    - заповед: изречението „Възложител … е „…“ ООД, Булстат …“."""
    text = text or ""
    m = re.search(r"(?i)разреша\w*\s+се\s+на", text)
    if m:
        rest = text[m.end():]
        end = re.search(r"(?i)съгласно\s+одобрен|за\s+строеж\s*[:„\"]|комплексен\s+доклад", rest)
        return rest[:end.start()] if end else rest[:1500]
    m = re.search(r"(?i)възложител[и]?\s*:", text)
    if m:
        rest = text[m.end():]
        end = re.search(r"(?i)строителен\s+надзор|консултант|\bстроител\s*:|проектант|протокол", rest)
        return rest[:end.start()] if end else rest[:800]
    m = re.search(r"(?i)възложител\b[^.]{0,120}?\bе\s", text)
    if m:
        return text[m.end():m.end() + 300]
    return None


def role_section(text: str, role: str) -> str | None:
    """„Строител: …“ / „Строителен надзор: …“ до следващата роля или до „ПРОТОКОЛ“."""
    m = re.search(rf"(?i)(?<![а-я]){role}\s*:", text or "")
    if not m:
        return None
    rest = text[m.end():]
    end = re.search(r"(?i)строителен\s+надзор\s*:|консултант|\bстроител\s*:|проектант|протокол|"
                    r"технически\s+ръководител", rest)
    return rest[:end.start()] if end else rest[:400]


def protocol_date(text: str) -> str:
    """Дата „Днес, 12.03.2025“ от протокола; "" ако не е разчетена ясно."""
    m = re.search(r"(?i)днес\s*,?\s*(\d{1,2})\s*[./]\s*(\d{1,2})\s*[./]\s*(20\d\d)", text or "")
    if not m:
        return ""
    d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if not (1 <= d <= 31 and 1 <= mo <= 12):
        return ""
    return f"{y:04d}-{mo:02d}-{d:02d}"


def extract_pairs(text: str) -> list[dict]:
    out = []
    for m in PAIR.finditer(text or ""):
        raw = m.group("eik")
        eik = raw.translate(_DIGIT_FIX)
        name = re.sub(r"[„\"“”«»]", "", m.group("name")).strip(" .;:-")
        name = re.sub(r"^\d+\s*[.)]\s*", "", name)  # „1. …“
        out.append({"name": name, "form": m.group("form") or "", "eik": eik, "raw": raw,
                    "valid": valid_eik(eik), "ocr_fixed": eik != raw,
                    "snippet": re.sub(r"\s+", " ", m.group(0))[:160]})
    return out


def similarity(a: str, b: str) -> float:
    a, b = normalize_name(a).replace(" ", ""), normalize_name(b).replace(" ", "")
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a, b).ratio()


def match_investors(companies: list[str], text: str) -> dict[str, dict]:
    """{фирма от регистъра: решение}. Решение: status = 'намерен' | 'за проверка' | 'не е разчетен'."""
    section = investor_section(text)
    pairs = extract_pairs(section if section is not None else "")
    result: dict[str, dict] = {}
    if section is None:
        for c in companies:
            result[c] = {"status": "не е разчетен",
                         "reason": f"в документа ({document_type(text)}) не е открита частта с инвеститора"}
        return result
    valid = {}
    for p in pairs:
        if p["valid"]:
            valid.setdefault(p["eik"], p)
    invalid = [p for p in pairs if not p["valid"]]
    for c in companies:
        scored = sorted(((similarity(c, p["name"]), p) for p in valid.values()), key=lambda x: -x[0])
        if len(companies) == 1 and len(valid) == 1:
            best_score, best = scored[0]
            result[c] = {"status": "намерен", "eik": best["eik"], "pdf_name": best["name"],
                         "name_similarity": round(best_score, 2), "snippet": best["snippet"],
                         "ocr_fixed": best["ocr_fixed"]}
        elif scored and scored[0][0] >= 0.75 and (len(scored) == 1 or scored[1][0] < 0.6):
            best_score, best = scored[0]
            result[c] = {"status": "намерен", "eik": best["eik"], "pdf_name": best["name"],
                         "name_similarity": round(best_score, 2), "snippet": best["snippet"],
                         "ocr_fixed": best["ocr_fixed"]}
        elif not valid and invalid:
            result[c] = {"status": "за проверка", "reason": "ЕИК е разчетен с грешна контролна цифра",
                         "candidates": [p["raw"] for p in invalid][:3], "snippet": invalid[0]["snippet"]}
        elif not valid:
            result[c] = {"status": "не е разчетен", "reason": "в документа няма ЕИК на инвеститора"}
        elif scored and scored[0][0] < 0.6 and len(valid) < len(companies):
            # ЕИК-ите в документа са на другите фирми – за тази няма
            result[c] = {"status": "не е разчетен", "reason": "в документа няма ЕИК, който да съвпада по име с тази фирма",
                         "candidate_eiks": [p["eik"] for _, p in scored][:4]}
        else:
            result[c] = {"status": "за проверка", "reason": "няколко ЕИК, не е ясно кой е на тази фирма",
                         "candidates": [f'{p["name"]} {p["eik"]}' for _, p in scored][:4],
                         "candidate_eiks": [p["eik"] for _, p in scored][:4],
                         "snippet": " | ".join(p["snippet"] for _, p in scored[:3])}
    return result


def role_party(text: str, role: str) -> dict | None:
    """Участник с роля (строител/надзор) от протокол: име и ЕИК; None ако няма ЕИК в частта."""
    sec = role_section(text, role)
    if not sec:
        return None
    pairs = extract_pairs(sec)
    if not pairs:
        return None
    p = pairs[0]
    return {"name": p["name"], "form": p["form"], "eik": p["eik"], "valid": p["valid"], "snippet": p["snippet"],
            "section": re.sub(r"\s+", " ", sec)[:400]}
