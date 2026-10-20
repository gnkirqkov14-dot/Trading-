"""Проектантите от протоколите на ОЕСУТ София: кой е докладвал проекта, за кой имот и възложител.

В протокола всяка точка от дневния ред описва проекта (обект, УПИ/ПИ, квартал, местност) и кой
го докладва – напр. „арх. Иван Иванов (проектант – „Студио“ ЕООД) докладва …“. Протоколите са
сканирани PDF, затова се разчитат с tesseract (bul). Нищо не се записва в обектите – това е
списък с кандидати „проектант ↔ имот“ за свързване с разрешенията по УПИ/ПИ.

    python oesut_designers.py  ->  output/oesut_proektanti.csv
"""
from __future__ import annotations

import csv
import hashlib
import json
import re
import subprocess
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import requests

ROOT = Path(__file__).parent
LIST = ROOT / "output" / "oesut.json"
CACHE = ROOT / "cache" / "oesut"
OUT = ROOT / "output" / "oesut_proektanti.csv"

ITEM = re.compile(r"(?im)^\s*(?:по\s+)?т(?:очка|\.)\s*(\d+)\b.*$")
DESIGNER = re.compile(r"(?i)((?:проф\.\s*|доц\.\s*|д-р\s*)*(?:арх|инж|урб|ланд\.\s*арх)\.\s*[А-ЯA-Z][\w\-]+(?:\s+[А-ЯA-Z][\w\-]+){0,2})"
                      r"\s*[\(\-–—,]\s*(?:проектант|автор|представител на проектанта)[^\)\n]{0,80}\)?")
DESIGNER2 = re.compile(r"(?i)проектант(?:и|ът)?\s*[:\-–—]?\s*((?:арх|инж)\.\s*[А-Я][\w\-]+(?:\s+[А-Я][\w\-]+){0,2}"
                       r"(?:\s*[\(,–-]\s*[„\"]?[^\n\)]{2,60}(?:ООД|ЕООД|АД|ЕТ)[\"“]?)?)")
PLACE = re.compile(r"(?i)(УПИ\s+[IVXLCDM\d\-–,\s]+(?:-|–)?\s*[\d\.,\s]*|ПИ\s+(?:с\s+)?(?:идентификатор\s+)?\d{5}\.\d+\.\d+|"
                   r"кв\.\s*\d+[а-я]?|м\.\s*[„\"]?[А-Я][^,\n]{2,40}|ж\.к\.\s*[„\"]?[А-Я][^,\n]{2,30}|р-н\s*[„\"]?[А-Я][^,\n]{2,25})")
INVESTOR = re.compile(r"(?i)(?:възложител(?:и|ят)?|заявител(?:и|ят)?|по искане на)\s*[:\-–]?\s*([^\n]{3,90})")


def pdf(url: str) -> Path | None:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (hashlib.sha1(url.encode()).hexdigest()[:16] + ".pdf")
    if not path.exists():
        try:
            r = requests.get(url, timeout=60)
            r.raise_for_status()
        except Exception as exc:
            print(f"  не се свали {url}: {exc}")
            return None
        path.write_bytes(r.content)
    return path


def ocr(path: Path) -> str:
    txt = path.with_suffix(".txt")
    if txt.exists():
        return txt.read_text(encoding="utf-8")
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdftoppm", "-r", "220", "-png", str(path), f"{tmp}/p"], check=True, capture_output=True)
        parts = []
        for img in sorted(Path(tmp).glob("p-*.png")):
            out = subprocess.run(["tesseract", str(img), "-", "-l", "bul"], capture_output=True, text=True)
            parts.append(out.stdout)
    text = "\n".join(parts)
    txt.write_text(text, encoding="utf-8")
    return text


def items(text: str) -> list[tuple[str, str]]:
    """(номер на точката, текст) – протоколът се разделя на точки от дневния ред."""
    marks = [(m.start(), m.group(1)) for m in ITEM.finditer(text)]
    if not marks:
        return [("", text)]
    out = []
    for i, (pos, num) in enumerate(marks):
        end = marks[i + 1][0] if i + 1 < len(marks) else len(text)
        out.append((num, text[pos:end]))
    return out


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip(" ;,.")


def one(p: dict) -> list[dict]:
    rows = []
    for url in p["files"]:
        path = pdf(url)
        if not path:
            continue
        try:
            text = ocr(path)
        except Exception as exc:
            print(f"  OCR не успя {url}: {exc}")
            continue
        for num, body in items(text):
            found = [clean(m.group(0)) for m in DESIGNER.finditer(body)] + \
                    [clean("проектант " + m.group(1)) for m in DESIGNER2.finditer(body)]
            if not found:
                continue
            places = list(dict.fromkeys(clean(m.group(0)) for m in PLACE.finditer(body[:1500])))[:4]
            inv = INVESTOR.search(body)
            rows.append({"Протокол": p["number"], "Дата": p["date"], "Вид": p["type"], "Точка": num,
                         "Проектант (както е в протокола)": " | ".join(dict.fromkeys(found))[:300],
                         "Имот / място": "; ".join(places), "Възложител": clean(inv.group(1)) if inv else "",
                         "Откъс": clean(body[:400]), "PDF": url})
    return rows


def main() -> None:
    protocols = json.loads(LIST.read_text(encoding="utf-8"))
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = [r for rs in pool.map(one, protocols) for r in rs]
    with OUT.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["Протокол", "Дата", "Вид", "Точка", "Проектант (както е в протокола)",
                                          "Имот / място", "Възложител", "Откъс", "PDF"], delimiter=";")
        w.writeheader()
        w.writerows(rows)
    print(f"{len(protocols)} протокола, {len(rows)} точки с проектант -> {OUT}")


if __name__ == "__main__":
    main()
