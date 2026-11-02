"""20 пловдивски архитекти за среща – Excel за сваляне.

Подборът е ръчен (списъкът PICK) от раздела „Архитекти Пловдив“ на страницата за обаждания:
активни бюра с много отзиви в Google, сайт и имейл, регистрирани в КАБ или с договори за проектиране.

    python call_page.py && python meetings_xlsx.py  ->  output/arhitekti_plovdiv_sreshti.xlsx
"""
from __future__ import annotations

import json
import re
from pathlib import Path

from openpyxl import Workbook
from openpyxl.comments import Comment
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.datavalidation import DataValidation

ROOT = Path(__file__).parent
PAGE = ROOT / "output" / "obazhdania.html"
MAPS = ROOT / "output" / "plovdiv" / "maps_arhitekti_vsichki.json"
OUT = ROOT / "output" / "arhitekti_plovdiv_sreshti.xlsx"

PICK = ["DNArchStudio-архитектурно бюро", "Арх Ситистрой", "RT CONSULT ltd. / ЕР ТЕ КОНСУЛТ ООД", "Стършанов Архитекти",
        "Цоневски ПК ООД", "CREATON architectural studio / Архитектурно студио CREATON",
        "Архитектурно студио Интерплан ЕООД", "3Д-Форма ООД", "Arch Consult-ZG", "А и У – ВЕРКЩАТ ЕООД", "Анк Студио ЕООД",
        "АРКО Студио ООД", "Геоарх ЕООД", "ПАЛАС ЕООД", "Тектоника-Б ЕООД", "ТЕХНОАРХ ИНЖЕРИНГ ЕООД",
        "ШЕЙП КОНСЕПТ - АРХИТЕКТУРНА АСОЦИАЦИЯ", "TSVETKOV-STUDIO – Architecture and design", "Точка Студио",
        "STUDIO KOLEKTIV"]
STATUSES = ["Не е звъняно", "Звъннато – няма отговор", "Уговорена среща", "Проведена среща", "Изпратена оферта",
            "Не се интересува"]
FONT = "Arial"


def rows() -> list[dict]:
    html = PAGE.read_text(encoding="utf-8")
    data = json.loads(re.search(r'id="data">(.*?)</script>', html, re.S).group(1).replace("<\\/", "</"))
    arp = {r["names"][0]: r for s in data["sheets"] if s["code"] == "arp" for r in s["rows"]}
    maps = {(x.get("title") or "").strip(): x for x in json.loads(MAPS.read_text(encoding="utf-8"))}
    out = []
    for name in PICK:
        r = arp[name]
        m = maps.get(name) or {}
        why = []
        if m.get("reviewsCount"):
            why.append(f'{m["reviewsCount"]} отзива в Google ({m.get("totalScore")}★) – активно бюро')
        if "КАБ" in r["source"]:
            why.append("в регистъра на Камарата на архитектите")
        if r["objects"]:
            why.append(f'{len(r["objects"])} договора за проектиране на обществени сгради')
        if r["website"] and not why:
            why.append("собствен сайт с проекти")
        site = r["website"] if r["website"].startswith("http") and "@" not in r["website"] \
            and "expobulgaria" not in r["website"] else ""
        address = re.sub(r"([а-я0-9])([А-Я][а-я])", r"\1, \2", r["address"]).strip(" ,")  # „ЦентърРайон“ от Google Maps
        person = r["person"].title() if r["person"].isupper() or r["person"].islower() else r["person"]
        out.append({"name": name, "person": person,
                    "phone": r["phones"][0], "phone2": ", ".join(r["phones"][1:]), "email": ", ".join(r["emails"][:2]),
                    "site": site, "address": address, "rating": float(m["totalScore"]) if m.get("totalScore") else None,
                    "reviews": m.get("reviewsCount") or None, "why": "; ".join(why),
                    "projects": "; ".join(f'{o["date"][:7]} {o["what"][:80]}' for o in r["objects"][:2])})
    return out


def main() -> None:
    data = rows()
    wb = Workbook()
    ws = wb.active
    ws.title = "Архитекти Пловдив"
    thin = Side(style="thin", color="C9D1D3")
    head_fill, input_fill = PatternFill("solid", fgColor="0E6A70"), PatternFill("solid", fgColor="FFF6D5")

    ws["A1"] = "20 архитекти в Пловдив за среща – PHOMI"
    ws["A1"].font = Font(name=FONT, size=14, bold=True)
    ws["A2"] = ("Попълвай жълтите колони: Статус (избор от списъка), Дата на среща, Бележки. "
                "Подредени по активност: първо бюрата с най-много отзиви в Google и регистрирани в КАБ.")
    ws["A2"].font = Font(name=FONT, size=10, italic=True, color="5A676B")
    ws.merge_cells("A2:N2")

    headers = ["№", "Бюро", "Лице за контакт", "Телефон", "Друг телефон", "Имейл", "Сайт", "Адрес", "Google ★",
               "Отзиви", "Защо е в списъка", "Статус", "Дата на среща", "Бележки"]
    widths = [5, 34, 26, 17, 17, 30, 30, 40, 9, 8, 46, 22, 14, 40]
    hr = 4
    for i, (h, w) in enumerate(zip(headers, widths), 1):
        c = ws.cell(row=hr, column=i, value=h)
        c.font = Font(name=FONT, bold=True, color="FFFFFF")
        c.fill = head_fill
        c.alignment = Alignment(vertical="center", wrap_text=True)
        ws.column_dimensions[c.column_letter].width = w
    ws.row_dimensions[hr].height = 30

    for n, r in enumerate(data, 1):
        row = hr + n
        vals = [n, r["name"], r["person"], r["phone"], r["phone2"], r["email"], r["site"], r["address"], r["rating"],
                r["reviews"], r["why"] + (f' · {r["projects"]}' if r["projects"] else ""), "Не е звъняно", None, None]
        for col, v in enumerate(vals, 1):
            c = ws.cell(row=row, column=col, value=v)
            c.font = Font(name=FONT, size=10)
            c.alignment = Alignment(vertical="top", wrap_text=col in (2, 3, 6, 8, 11, 14))
            c.border = Border(top=thin, bottom=thin, left=thin, right=thin)
            if col in (12, 13, 14):
                c.fill = input_fill
        ws.cell(row=row, column=4).number_format = "@"
        ws.cell(row=row, column=13).number_format = "DD.MM.YYYY"
        if r["site"]:
            ws.cell(row=row, column=7).hyperlink = r["site"]
            ws.cell(row=row, column=7).font = Font(name=FONT, size=10, color="0E6A70", underline="single")
    last = hr + len(data)

    dv = DataValidation(type="list", formula1='"' + ",".join(STATUSES) + '"', allow_blank=True)
    ws.add_data_validation(dv)
    dv.add(f"L{hr + 1}:L{last}")
    colors = {"Уговорена среща": "BFE5B2", "Проведена среща": "8FD07E", "Изпратена оферта": "D9E8FB",
              "Звъннато – няма отговор": "FDF0D5", "Не се интересува": "E3E3E3"}
    for st, col in colors.items():
        ws.conditional_formatting.add(f"A{hr + 1}:N{last}", FormulaRule(
            formula=[f'$L{hr + 1}="{st}"'], fill=PatternFill("solid", fgColor=col)))
    ws.cell(row=hr, column=9).comment = Comment("Оценка и брой отзиви в Google Maps към 19.10.2026.", "PHOMI")
    ws.cell(row=hr, column=11).comment = Comment(
        "Източници: регистър на КАБ (kab.bg), Google Maps, ЦАИС ЕОП (договори за проектиране).", "PHOMI")

    # Обобщение по статус – с формули, за да се смята само
    sr = last + 2
    ws.cell(row=sr, column=2, value="Обобщение").font = Font(name=FONT, bold=True)
    for i, st in enumerate(STATUSES, 1):
        ws.cell(row=sr + i, column=2, value=st).font = Font(name=FONT, size=10)
        c = ws.cell(row=sr + i, column=3, value=f'=COUNTIF($L${hr + 1}:$L${last},B{sr + i})')
        c.font = Font(name=FONT, size=10)
    ws.cell(row=sr + len(STATUSES) + 1, column=2, value="Общо").font = Font(name=FONT, bold=True)
    ws.cell(row=sr + len(STATUSES) + 1, column=3, value=f"=COUNTA($B${hr + 1}:$B${last})").font = Font(name=FONT, bold=True)

    ws.freeze_panes = ws.cell(row=hr + 1, column=3)
    ws.auto_filter.ref = f"A{hr}:N{last}"
    ws.sheet_view.zoomScale = 110
    OUT.parent.mkdir(parents=True, exist_ok=True)
    wb.save(OUT)
    print(f"{len(data)} архитекта -> {OUT}")


if __name__ == "__main__":
    main()
