"""AI Радар — пълните текстове на най-важните статии (за „▶ цялата статия“ в таблото).

    python3 voice.py --work work [--max-articles 15]

Прави:
  work/voice_day.txt      — днешният брой (заглавия, теми, резюмета,
                            номерирани статии, видеа) — документ в базата знания
  work/voice_kb.txt       — пълните текстове на най-важните статии
                            (за базата знания на агента, търси се по номер/заглавие)
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import html
import json
import re
from pathlib import Path

from collect import fetch

DAYS = ["понеделник", "вторник", "сряда", "четвъртък", "петък", "събота", "неделя"]
MONTHS = ["януари", "февруари", "март", "април", "май", "юни", "юли", "август", "септември", "октомври", "ноември", "декември"]



def bg_date(d: str) -> str:
    from datetime import date
    y, m, dd = map(int, d.split("-"))
    return f"{DAYS[date(y, m, dd).weekday()]}, {dd} {MONTHS[m - 1]}"


def extract_text(raw: bytes) -> str:
    page = raw.decode("utf-8", "ignore")
    page = re.sub(r"(?is)<(script|style|nav|header|footer|aside|form|figure|noscript)[^>]*>.*?</\1>", " ", page)
    body = re.search(r"(?is)<article[^>]*>(.*?)</article>", page)
    scope = body.group(1) if body else page
    paras = []
    for m in re.finditer(r"(?is)<(p|h2|h3|li)[^>]*>(.*?)</\1>", scope):
        t = html.unescape(re.sub(r"<[^>]+>", " ", m.group(2)))
        t = re.sub(r"\s+", " ", t).strip()
        if len(t) >= 60 or (m.group(1).lower() in ("h2", "h3") and len(t) > 8):
            paras.append(t)
    text = "\n\n".join(dict.fromkeys(paras))  # без повторения
    return text[:5000]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", default="work")
    ap.add_argument("--max-articles", type=int, default=10)
    args = ap.parse_args()
    work = Path(args.work)
    db = work / "db"
    date = json.loads((db / next(p.name for p in db.glob("digests__*.json")) ).read_text(encoding="utf-8"))["date"]
    digest = json.loads((db / f"digests__{date}.json").read_text(encoding="utf-8"))
    items = {}
    for f in sorted(db.glob(f"digest_items__{date}-*.json")):
        for i in json.loads(f.read_text(encoding="utf-8"))["items"]:
            items[i["id"]] = i
    topics = digest["topics"]

    # статии за четене: първо "прочети" на темите от брифинга, после останалите теми, после най-важните новини
    order: list[str] = []
    brief_topics = [b.get("topic") for b in digest.get("brief", [])]
    for tid in brief_topics + [t["id"] for t in topics]:
        t = next((x for x in topics if x["id"] == tid), None)
        for rid in (t or {}).get("read") or []:
            if rid not in order:
                order.append(rid)
    news = sorted((i for i in items.values() if i["kind"] in ("article", "discussion", "post") and i.get("s")),
                  key=lambda i: -(i.get("imp") or 0))
    for i in news:
        if i["id"] not in order:
            order.append(i["id"])
    candidates = [items[r] for r in order if r in items and "news.google.com" not in items[r]["url"]]
    picked = candidates[: args.max_articles * 2]

    def grab(i):
        try:
            return i, extract_text(fetch(i["url"], timeout=20))
        except Exception:  # noqa: BLE001
            return i, ""

    with cf.ThreadPoolExecutor(8) as ex:
        fetched = list(ex.map(grab, picked))
    articles = [(i, t) for i, t in fetched if len(t) > 800][: args.max_articles]

    # --- промпт
    lines = [f"AI Радар — днешен брой: {bg_date(date)}", "", "НАЙ-ВАЖНОТО:"]
    lines += [f"{n}. {b['text']}" for n, b in enumerate(digest.get("brief", []), 1)]
    lines += ["", "ТЕМИ (дял от вниманието за 3 дни, важност 1–10):"]
    for t in topics:
        m = t["metrics"]["72"]
        lines.append(f"- {t['name']} — {m.get('attention', 0):.0f}% внимание, важност {t['importance']}. {t['summary']} Защо е важно: {t['why']}")
    lines += ["", "СТАТИИ С ПЪЛЕН ТЕКСТ (в базата знания):"]
    for n, (i, _) in enumerate(articles, 1):
        lines.append(f"Статия {n}: {i['title']} ({i.get('source', '')}). {i.get('s') or ''}")
    vids = [items[v] for v in digest.get("must_watch", []) if v in items][:6]
    lines += ["", "ПРЕПОРЪЧАНИ ВИДЕА:"]
    lines += [f"- {v['title']} — {v.get('channel', '')}. {v.get('s') or ''}" for v in vids]
    if digest.get("people"):
        lines += ["", "КАКВО КАЗАХА ХОРАТА:"]
        lines += [f"- {p['name']}: {p['said']}" for p in digest["people"][:10]]
    (work / "voice_day.txt").write_text("\n".join(lines), encoding="utf-8")

    kb = [f"AI Радар — пълни статии: {bg_date(date)}", ""]
    for n, (i, t) in enumerate(articles, 1):
        kb += [f"=== Статия {n}: {i['title']} ===", f"Източник: {i.get('source', '')} · {i['url']}", "", t, ""]
    (work / "voice_kb.txt").write_text("\n".join(kb), encoding="utf-8")
    # пълните текстове и за таблото (бутон „цялата статия“) — документ fulltext/<дата> в базата
    ft = {"date": date, "items": {i["id"]: {"title": i["title"], "text": t} for i, t in articles}}
    (db / f"fulltext__{date}.json").write_text(json.dumps(ft, ensure_ascii=False), encoding="utf-8")
    print(json.dumps({"date": date, "prompt_chars": len("\n".join(lines)), "articles": len(articles),
                      "kb_chars": len("\n".join(kb)), "titles": [i["title"][:60] for i, _ in articles]}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
