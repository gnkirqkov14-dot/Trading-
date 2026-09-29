"""AI Радар — сглобява дневния брой от събраното (raw.json) и анализа (analysis.json).

Смята процентите ("колко се говори"), тенденцията за 7 дни, подредбата
на препоръките и подготвя документите за базата на таблото + имейла.

    python3 build_digest.py --work work/ [--history work/history.json] [--prefs work/prefs.json]
                            [--user-sources work/user_sources.json] [--dashboard-url URL]
    python3 build_digest.py --check work/analysis.json [--work work/]   # само проверка на схемата

Резултат в <work>/db/: по един JSON файл на документ + writes.json
(списък {collection, doc_id, file} за запис с ArtifactData batch),
и <work>/email_subject.txt, email.txt, email.html.
"""
from __future__ import annotations

import argparse
import html
import json
import math
import re
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

try:
    from zoneinfo import ZoneInfo

    SOFIA = ZoneInfo("Europe/Sofia")
except Exception:  # noqa: BLE001
    SOFIA = timezone(timedelta(hours=3))

HERE = Path(__file__).resolve().parent
CATEGORIES = {"models", "tools", "trading", "media", "research", "policy", "other"}
VERDICTS = {"must", "worth", "summary", "skip"}
CHUNK_BYTES = 180_000  # под лимита от 256 KiB на документ в базата
MONTHS = ["яну", "фев", "мар", "апр", "май", "юни", "юли", "авг", "сеп", "окт", "ное", "дек"]


def load(p: Path | str | None, default=None):
    if not p:
        return default
    p = Path(p)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def check(analysis: dict, raw_ids: set[str] | None) -> list[str]:
    errs = []
    topics = analysis.get("topics") or []
    tids = {t.get("id") for t in topics}
    if not 3 <= len(topics) <= 30:
        errs.append(f"topics: очаквах 10–18 теми, има {len(topics)}")
    for t in topics:
        for f in ("id", "name", "category", "summary", "why", "importance"):
            if not t.get(f) and t.get(f) != 0:
                errs.append(f"тема {t.get('id')}: липсва {f}")
        if t.get("category") not in CATEGORIES:
            errs.append(f"тема {t.get('id')}: непозната категория {t.get('category')}")
        if not isinstance(t.get("importance"), (int, float)) or not 1 <= t["importance"] <= 10:
            errs.append(f"тема {t.get('id')}: importance трябва да е 1–10")
        for ref in (t.get("watch") or []) + (t.get("read") or []):
            if raw_ids is not None and ref not in raw_ids and not ref.startswith("w:"):
                errs.append(f"тема {t.get('id')}: непознат id в watch/read: {ref}")
    items = analysis.get("items") or {}
    for iid, a in items.items():
        if a.get("t") not in tids | {"misc", "off"}:
            errs.append(f"{iid}: непозната тема {a.get('t')}")
        if a.get("v") and a["v"] not in VERDICTS:
            errs.append(f"{iid}: v трябва да е едно от {sorted(VERDICTS)}")
        if iid.startswith("w:"):
            for f in ("title", "url"):
                if not a.get(f):
                    errs.append(f"{iid}: допълнителна новина без {f}")
        elif raw_ids is not None and iid not in raw_ids:
            errs.append(f"{iid}: няма такъв елемент в събраните данни")
    if raw_ids is not None:
        missing = [i for i in raw_ids if i not in items]
        if len(missing) > 0.1 * max(len(raw_ids), 1):
            errs.append(f"items: без тема са {len(missing)} от {len(raw_ids)} елемента (пример: {missing[:5]})")
    if not analysis.get("brief"):
        errs.append("brief: празен")
    return errs


def sofia_date(iso: str | None) -> str | None:
    if not iso:
        return None
    d = datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(SOFIA)
    return d.strftime("%Y-%m-%d")


def bg_date(d: str) -> str:
    y, m, dd = d.split("-")
    return f"{int(dd)} {MONTHS[int(m) - 1]}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", default=str(HERE / "work"))
    ap.add_argument("--check")
    ap.add_argument("--history")
    ap.add_argument("--prefs")
    ap.add_argument("--user-sources")
    ap.add_argument("--dashboard-url", default="")
    args = ap.parse_args()
    work = Path(args.work)
    raw = load(work / "raw.json")
    compact_ids = {i["id"] for i in load(work / "compact.json", {"items": []})["items"]}

    if args.check:
        errs = check(load(args.check), compact_ids or None)
        print("\n".join(errs) if errs else "OK — схемата е наред")
        sys.exit(1 if errs else 0)

    an = load(work / "analysis.json")
    errs = check(an, compact_ids)
    if errs:
        print("Внимание, analysis.json има проблеми:\n" + "\n".join(errs[:30]), file=sys.stderr)
    prefs = load(args.prefs, {}) or {}
    history = sorted(load(args.history, []) or [], key=lambda h: h["date"])
    now = datetime.fromisoformat(raw["generated_at"].replace("Z", "+00:00"))
    date = an.get("date") or now.astimezone(SOFIA).strftime("%Y-%m-%d")

    topics = {t["id"]: dict(t) for t in an["topics"]}
    ann = an.get("items", {})
    items = []
    for it in raw["items"]:
        a = ann.get(it["id"], {})
        t = a.get("t", "misc")
        if t == "off":
            continue
        items.append({**it, "t": t if t in topics else "misc", "s": a.get("s"), "imp": a.get("imp"), "v": a.get("v")})
    for iid, a in ann.items():  # допълнителни новини от WebSearch
        if iid.startswith("w:") and a.get("t") != "off":
            items.append({"id": iid, "kind": a.get("k", "article"), "title": a["title"], "url": a["url"],
                          "source": a.get("src") or "Web", "age_h": a.get("age_h", 12), "t": a.get("t") if a.get("t") in topics else "misc",
                          "s": a.get("s"), "imp": a.get("imp"), "from_search": True})

    # --------------------------------------------------- проценти по прозорци
    liked = set(prefs.get("liked_topics", []))
    muted = set(prefs.get("muted_topics", []))
    liked_cats = set(prefs.get("liked_categories", ["models", "tools", "trading", "media"]))

    def window_metrics(hours: int) -> dict:
        vids = [i for i in items if i["kind"] == "video" and (i.get("age_h") or 1e9) <= hours]
        news = [i for i in items if i["kind"] != "video" and (i.get("age_h") or 0) <= hours]
        vw = lambda i: 0.3 if i.get("is_short") else 1.0  # noqa: E731
        tot_v = sum(vw(i) for i in vids) or 1
        tot_views = sum(i.get("views") or 0 for i in vids) or 1
        tot_n = len(news) or 1
        per = defaultdict(lambda: {"videos": 0, "shorts": 0, "views": 0, "channels": set(), "news": 0, "vw": 0.0})
        for i in vids:
            m = per[i["t"]]
            m["shorts" if i.get("is_short") else "videos"] += 1
            m["vw"] += vw(i)
            m["views"] += i.get("views") or 0
            if i.get("channel"):
                m["channels"].add(i["channel"])
        for i in news:
            per[i["t"]]["news"] += 1
        out = {}
        for tid, m in per.items():
            vs, ws, ns = m["vw"] / tot_v, m["views"] / tot_views, m["news"] / tot_n
            out[tid] = {"videos": m["videos"], "shorts": m["shorts"], "views": m["views"], "channels": len(m["channels"]),
                        "news": m["news"], "video_share": round(100 * vs, 1), "views_share": round(100 * ws, 1),
                        "news_share": round(100 * ns, 1), "attention": 0.45 * vs + 0.35 * ws + 0.20 * ns}
        s = sum(v["attention"] for v in out.values()) or 1
        for v in out.values():
            v["attention"] = round(100 * v["attention"] / s, 1)
        return out

    windows = {"24": window_metrics(24), "72": window_metrics(72), "168": window_metrics(168)}

    # 7-дневна серия: дял на темата от AI разговора за всеки ден
    days = [(now.astimezone(SOFIA) - timedelta(days=k)).strftime("%Y-%m-%d") for k in range(6, -1, -1)]
    per_day = defaultdict(Counter)
    for i in items:
        d = sofia_date(i.get("published"))
        if d in days:
            per_day[d][i["t"]] += 0.3 if i.get("is_short") else 1
    series = {}
    for tid in topics:
        series[tid] = [round(100 * per_day[d][tid] / (sum(per_day[d].values()) or 1), 1) for d in days]

    prev = {}
    for h in history:
        if h["date"] < date:
            for tid, v in (h.get("topics") or {}).items():
                prev.setdefault(tid, []).append(v)

    topic_list = []
    for tid, t in topics.items():
        m72 = windows["72"].get(tid, {})
        m24 = windows["24"].get(tid, {})
        m168 = windows["168"].get(tid, {})
        a24, a168 = m24.get("attention", 0), m168.get("attention", 0)
        seen_before = tid in prev
        if not seen_before and (m168.get("videos", 0) + m168.get("news", 0)) <= (m72.get("videos", 0) + m72.get("news", 0)) + 1:
            trend = "new"
        elif a24 - a168 >= 4:
            trend = "up"
        elif a168 - a24 >= 4:
            trend = "down"
        else:
            trend = "flat"
        topic_list.append({
            **{k: t.get(k) for k in ("id", "name", "category", "summary", "why", "importance", "hype", "people", "watch", "read")},
            "hype": t.get("hype", 0),
            "metrics": {"24": m24, "72": m72, "168": m168},
            "series": series.get(tid), "trend": trend, "days_tracked": len(prev.get(tid, [])) + 1,
            "liked": tid in liked, "muted": tid in muted,
        })
    topic_list.sort(key=lambda t: -(t["metrics"]["72"].get("attention") or 0))
    misc = {w: windows[w].get("misc", {}) for w in windows}

    # --------------------------------------------------- подредба на елементите
    tcat = {t["id"]: t["category"] for t in topic_list}
    timp = {t["id"]: t["importance"] for t in topic_list}

    def score(i: dict) -> float:
        imp = i.get("imp") or (timp.get(i["t"], 4) - 1)
        s = imp * 10 + {"must": 25, "worth": 10, "summary": -5, "skip": -30}.get(i.get("v"), 0)
        s += 15 if i.get("list") == "mine" or i.get("mine") else 0
        s += 3 * math.log10((i.get("views") or 0) + 1) + (8 if (i.get("vs_channel") or 0) >= 2 else 0)
        s += 2 * math.log10((i.get("points") or i.get("upvotes") or 0) + 1) + 3 * len(i.get("also_in") or [])
        s -= min((i.get("age_h") or 0) / 24, 7) * 3
        s += 8 if tcat.get(i["t"]) in liked_cats else 0
        s += 10 if i["t"] in liked else 0
        s -= 60 if i["t"] in muted else 0
        return round(s, 1)

    for i in items:
        i["score"] = score(i)
    items.sort(key=lambda i: -i["score"])

    keep_fields = ("id", "kind", "title", "url", "channel", "channel_id", "source", "list", "views", "duration_s", "is_short",
                   "age_h", "published", "t", "s", "imp", "v", "person", "vs_channel", "points", "comments", "upvotes",
                   "likes", "also_in", "hn_url", "lang", "mine", "score", "from_search", "is_mirror", "thumb")
    slim = []
    for i in items:
        if i["kind"] == "video" and (i.get("age_h") or 0) > 168:
            continue
        if i["kind"] != "video" and not i.get("s") and i["score"] < 20:
            continue
        r = {k: i[k] for k in keep_fields if i.get(k) not in (None, "", [], False)}
        if "also_in" in r:
            r["also_in"] = len(r["also_in"])
        if r.get("thumb", "").startswith("https://i.ytimg.com/vi/"):
            r.pop("thumb")  # страницата го построява от id — пести място
        slim.append(r)

    chunks, cur, size = [], [], 0
    for r in slim:
        b = len(json.dumps(r, ensure_ascii=False).encode())
        if cur and size + b > CHUNK_BYTES:
            chunks.append(cur)
            cur, size = [], 0
        cur.append(r)
        size += b
    if cur:
        chunks.append(cur)
    chunk_ids = [f"{date}-{n + 1}" for n in range(len(chunks))]

    must = [i for i in items if i["kind"] == "video" and not i.get("is_short") and i.get("v") in ("must", "worth") and (i.get("age_h") or 99) <= 96][:12]
    counts = raw["counts"]
    stats = {
        "videos": sum(1 for i in items if i["kind"] == "video"), "news": sum(1 for i in items if i["kind"] != "video"),
        "channels": counts["channels"], "feeds": counts["feeds"], "people": counts["people"],
        "off_filtered": sum(1 for a in ann.values() if a.get("t") == "off"),
        "sources_failed": [h["job"] for h in raw.get("health", []) if not h["ok"]],
        "collected": counts,
    }

    # --------------------------------------------------- автоматично разширяване на радара
    user = load(args.user_sources, []) or []
    known_names = {p["name"].lower() for p in raw["people"]} | {(s.get("name") or "").lower() for s in user}
    known_ch = {c["channel_id"] for c in raw["channels"]} | {s.get("channel_id") for s in user}
    by_name = {}
    for i in raw["items"]:
        if i["kind"] == "video" and i.get("channel_id"):
            by_name.setdefault((i.get("channel") or "").lower(), i["channel_id"])
    new_sources = []
    disc = an.get("discovered") or {}
    for p in (disc.get("people") or [])[:5]:
        if p.get("name") and p["name"].lower() not in known_names:
            new_sources.append({"type": "person", "name": p["name"], "role": p.get("role", ""), "org": p.get("org", ""),
                                "category": p.get("category", "other"), "why": p.get("why", ""), "added_by": "claude", "added_at": raw["generated_at"],
                                "status": "ok"})
    for c in (disc.get("channels") or [])[:5]:
        ref = c.get("ref") or ""
        cid = ref if re.fullmatch(r"UC[\w-]{22}", ref) else by_name.get((c.get("name") or "").lower())
        if cid and cid not in known_ch:
            new_sources.append({"type": "youtube", "url": f"https://www.youtube.com/channel/{cid}", "channel_id": cid,
                                "name": c.get("name"), "resolved_name": c.get("name"), "category": c.get("category", "other"),
                                "why": c.get("why", ""), "added_by": "claude", "added_at": raw["generated_at"], "status": "ok"})

    digest = {
        "date": date, "generated_at": raw["generated_at"], "days": days,
        "brief": an.get("brief", []), "topics": topic_list, "misc": misc, "people": an.get("people", []),
        "must_watch": [i["id"] for i in must], "stats": stats, "chunks": chunk_ids,
        "discovered": [{"type": s["type"], "name": s["name"], "why": s.get("why", "")} for s in new_sources],
    }
    hist_doc = {"date": date, "topics": {t["id"]: {"name": t["name"], "category": t["category"], "importance": t["importance"],
                                                   "share72": t["metrics"]["72"].get("attention", 0),
                                                   "share24": t["metrics"]["24"].get("attention", 0)} for t in topic_list}}
    radar = {"updated_at": raw["generated_at"],
             "channels": [c for c in raw["channels"] if c.get("list") != "mine"],
             "people": [{k: p.get(k) for k in ("name", "role", "org", "category", "x", "bluesky")} for p in raw["people"] if not p.get("mine")],
             "health": raw.get("health", [])}

    out = work / "db"
    out.mkdir(parents=True, exist_ok=True)
    for f in out.glob("*.json"):
        f.unlink()
    writes = []

    def put(collection: str, doc_id: str, data: dict) -> None:
        f = out / f"{collection.replace('/', '_')}__{doc_id}.json"
        f.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
        kb = f.stat().st_size / 1024
        if kb > 250:
            raise SystemExit(f"{f.name} е {kb:.0f} KiB — над лимита на базата")
        writes.append({"collection": collection, "doc_id": doc_id, "file": str(f), "kb": round(kb, 1)})

    put("digests", date, digest)
    for cid, ch in zip(chunk_ids, chunks):
        put("digest_items", cid, {"date": date, "items": ch})
    put("history", date, hist_doc)
    put("meta", "radar", radar)
    for n, s in enumerate(new_sources):
        slug = re.sub(r"[^a-z0-9]+", "-", (s.get("channel_id") or s["name"]).lower()).strip("-")[:60]
        put("sources", f"auto-{slug}", s)
    put("meta", "latest", {"date": date, "generated_at": raw["generated_at"], "chunks": chunk_ids,
                           "headline": topic_list[0]["name"] if topic_list else ""})
    (out / "writes.json").write_text(json.dumps(writes, ensure_ascii=False, indent=1), encoding="utf-8")

    write_email(work, date, an, topic_list, must, args.dashboard_url)
    print(json.dumps({"date": date, "topics": len(topic_list), "items": len(slim), "chunks": len(chunks),
                      "new_sources": len(new_sources), "docs": [(w["collection"], w["doc_id"], w["kb"]) for w in writes]},
                     ensure_ascii=False, indent=1))


def fmt_views(n: int | None) -> str:
    if not n:
        return ""
    return f"{n / 1e6:.1f} млн." if n >= 1e6 else f"{n / 1e3:.0f} хил." if n >= 1e3 else str(n)


def write_email(work: Path, date: str, an: dict, topics: list[dict], must: list[dict], url: str) -> None:
    top = topics[:6]
    subj = f"AI Радар · {bg_date(date)}: {top[0]['name']}" if top else f"AI Радар · {bg_date(date)}"
    txt = [f"AI Радар — {bg_date(date)}", "", "НАЙ-ВАЖНОТО"]
    txt += [f"• {b['text']}" for b in an.get("brief", [])[:7]]
    txt += ["", "ЗА КАКВО СЕ ГОВОРИ (дял от вниманието, 3 дни)"]
    txt += [f"{t['metrics']['72'].get('attention', 0):>5.1f}%  {t['name']}  (важност {t['importance']}/10)" for t in top]
    if must:
        txt += ["", "ЗА ГЛЕДАНЕ"]
        txt += [f"▶ {i['title']} — {i.get('channel', '')}\n  {i.get('s') or ''}\n  {i['url']}" for i in must[:4]]
    if url:
        txt += ["", f"Цялото табло: {url}"]
    e = html.escape
    rows = "".join(
        f"<tr><td style='padding:4px 8px 4px 0;white-space:nowrap;color:#555'>{t['metrics']['72'].get('attention', 0):.0f}%</td>"
        f"<td style='padding:4px 0;width:100%'><div style='background:#e3e7f7;border-radius:4px'>"
        f"<div style='background:#1f3fd1;height:8px;border-radius:4px;width:{min(100, 2.2 * t['metrics']['72'].get('attention', 0)):.0f}%'></div></div>"
        f"<div style='font-size:14px;margin-top:3px'>{e(t['name'])} <span style='color:#888'>· важност {t['importance']}/10</span></div></td></tr>"
        for t in top)
    vids = "".join(
        f"<p style='margin:0 0 12px'><a href='{e(i['url'])}' style='color:#1f3fd1;font-weight:600;text-decoration:none'>▶ {e(i['title'])}</a>"
        f"<br><span style='color:#777;font-size:13px'>{e(i.get('channel') or '')} · {fmt_views(i.get('views'))} гледания</span>"
        f"<br><span style='font-size:14px'>{e(i.get('s') or '')}</span></p>" for i in must[:4])
    body = (
        "<div style='font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:auto;color:#1d1b26;line-height:1.45'>"
        f"<h2 style='margin:0 0 4px'>AI Радар</h2><div style='color:#777;margin-bottom:16px'>{bg_date(date)} · сутрешен брой</div>"
        "<h3 style='margin:0 0 8px'>Най-важното</h3><ul style='padding-left:18px;margin:0 0 18px'>"
        + "".join(f"<li style='margin-bottom:6px'>{e(b['text'])}</li>" for b in an.get("brief", [])[:7])
        + "</ul><h3 style='margin:0 0 8px'>За какво се говори <span style='font-weight:400;color:#888;font-size:13px'>дял от вниманието, 3 дни</span></h3>"
        f"<table style='width:100%;border-collapse:collapse;margin-bottom:18px'>{rows}</table>"
        + (f"<h3 style='margin:0 0 8px'>За гледане</h3>{vids}" if vids else "")
        + (f"<p style='margin-top:20px'><a href='{e(url)}' style='background:#1f3fd1;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none'>Отвори таблото</a></p>" if url else "")
        + "</div>")
    (work / "email_subject.txt").write_text(subj, encoding="utf-8")
    (work / "email.txt").write_text("\n".join(txt), encoding="utf-8")
    (work / "email.html").write_text(body, encoding="utf-8")


if __name__ == "__main__":
    main()
