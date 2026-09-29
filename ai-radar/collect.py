"""AI Радар — събирач на данни.

Тегли всичко ново за AI от източниците в sources.json (+ тези, които
потребителят е добавил от таблото) и записва два файла:

  <out>/raw.json      — всички събрани елементи с пълните им данни
  <out>/compact.json  — съкратен вид за анализа (заглавие, източник,
                        кратко описание, гледания), за да е евтин за четене
  <out>/resolved_sources.json — статус на потребителските източници
                        (намерен ли е каналът / RSS-ът), за запис обратно

Само стандартната библиотека на Python — няма какво да се инсталира.

    python3 collect.py --out work/ [--user-sources work/user_sources.json]
"""
from __future__ import annotations

import argparse
import concurrent.futures as cf
import gzip
import hashlib
import html
import json
import re
import statistics
import sys
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
UA = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip",
}
NOW = datetime.now(timezone.utc)
VIDEO_DAYS = 7  # прозорец за видеата — нужен за 7-дневната тенденция
ARTICLE_DAYS = 3
MAX_ARTICLES = 220
MIN_SEARCH_VIEWS = 2000  # видео от търсене под толкова гледания не влиза в анализа  # колко статии влизат в анализа (най-добрите по източник/покритие/свежест)
NS = {
    "a": "http://www.w3.org/2005/Atom",
    "m": "http://search.yahoo.com/mrss/",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "dc": "http://purl.org/dc/elements/1.1/",
}
# YouTube търсене с филтър "тази седмица"
YT_WEEK = "EgIIAw%3D%3D"
AI_WORDS = re.compile(
    r"\b(ai|a\.i\.|llm|gpt|chatgpt|openai|anthropic|claude|gemini|deepmind|grok|xai|llama|mistral|deepseek|qwen|"
    r"copilot|agent|agents|agentic|machine learning|neural|diffusion|sora|veo|midjourney|runway|elevenlabs|"
    r"nvidia|transformer|model|models|artificial intelligence|cursor|perplexity|hugging ?face|robot|robotics|agi)\b",
    re.I,
)

log_lines: list[str] = []


def log(msg: str) -> None:
    log_lines.append(msg)
    print(msg, file=sys.stderr)


def fetch(url: str, timeout: int = 25, retries: int = 1) -> bytes:
    last = None
    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    data = gzip.decompress(data)
                return data
        except Exception as e:  # noqa: BLE001 — всеки източник може да падне, не спираме заради него
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last  # type: ignore[misc]


def sid(prefix: str, key: str) -> str:
    return f"{prefix}:{hashlib.sha1(key.encode()).hexdigest()[:12]}"


def clean(text: str | None, limit: int = 0) -> str:
    if not text:
        return ""
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit].rstrip() + "…" if limit and len(text) > limit else text


def parse_date(s: str | None) -> datetime | None:
    if not s:
        return None
    s = s.strip()
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S.%f%z"):
        try:
            d = datetime.strptime(s.replace("Z", "+00:00") if "T" in s else s, fmt)
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def age_hours(d: datetime | None) -> float | None:
    return round((NOW - d).total_seconds() / 3600, 1) if d else None


def iso(d: datetime | None) -> str | None:
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if d else None


# ---------------------------------------------------------------- YouTube

def resolve_youtube(ref: str) -> tuple[str | None, str | None]:
    """@handle / линк / UC-id -> (channel_id, име на канала)."""
    ref = ref.strip()
    m = re.search(r"(UC[\w-]{22})", ref)
    if m:
        cid = m.group(1)
        try:
            root = ET.fromstring(fetch(f"https://www.youtube.com/feeds/videos.xml?channel_id={cid}"))
            return cid, root.findtext("a:title", namespaces=NS)
        except Exception:  # noqa: BLE001
            return cid, None
    if re.search(r"youtu\.be/|/watch\?|/shorts/|/live/", ref):
        # линк към клип -> каналът на автора през oEmbed
        vurl = ref if ref.startswith("http") else "https://" + ref
        o = json.loads(fetch(f"https://www.youtube.com/oembed?format=json&url={urllib.parse.quote(vurl, safe='')}"))
        cid, _ = resolve_youtube(o["author_url"])
        return cid, o.get("author_name")
    if ref.startswith("@"):
        url = f"https://www.youtube.com/{ref}"
    elif ref.startswith("http"):
        url = ref
    else:
        url = f"https://www.youtube.com/@{ref.lstrip('@')}"
    page = fetch(url).decode("utf-8", "ignore")
    m = re.search(r'"externalId":"(UC[\w-]{22})"', page) or re.search(r'"channelId":"(UC[\w-]{22})"', page)
    t = re.search(r'<meta property="og:title" content="([^"]*)"', page)
    return (m.group(1) if m else None), (html.unescape(t.group(1)) if t else None)


def youtube_channel(ch: dict) -> list[dict]:
    root = ET.fromstring(fetch(f"https://www.youtube.com/feeds/videos.xml?channel_id={ch['channel_id']}"))
    out = []
    for e in root.findall("a:entry", NS):
        vid = e.findtext("yt:videoId", namespaces=NS)
        pub = parse_date(e.findtext("a:published", namespaces=NS))
        g = e.find("m:group", NS)
        stats = g.find("m:community/m:statistics", NS) if g is not None else None
        link = e.find("a:link", NS)
        href = link.get("href") if link is not None else f"https://www.youtube.com/watch?v={vid}"
        out.append({
            "id": f"yt:{vid}", "kind": "video", "video_id": vid,
            "title": clean(e.findtext("a:title", namespaces=NS)),
            "url": f"https://www.youtube.com/watch?v={vid}",
            "is_short": "/shorts/" in (href or ""),
            "published": iso(pub), "age_h": age_hours(pub),
            "channel": ch.get("name") or root.findtext("a:title", namespaces=NS),
            "channel_id": ch["channel_id"], "list": ch.get("list", "radar"),
            "category_hint": ch.get("category"),
            "views": int(stats.get("views")) if stats is not None and stats.get("views") else None,
            "thumb": f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
            "description": clean(g.findtext("m:description", namespaces=NS) if g is not None else "", 1500),
            "found_via": ["channel"],
        })
    return out


# "3h ago", "2 days ago", "Streamed 5d ago", "1 week ago", "10 minutes ago"...
REL = re.compile(r"(\d+)\s*(seconds?|s|minutes?|mins?|m|hours?|h|days?|d|weeks?|w|months?|mo|years?|y)\b", re.I)
UNIT_H = {"s": 1 / 3600, "m": 1 / 60, "h": 1, "d": 24, "w": 168, "mo": 720, "y": 8760}


def parse_rel(text: str | None) -> float | None:
    m = REL.search(text or "")
    if not m:
        return None
    u = m.group(2).lower()
    key = "mo" if u.startswith("mo") else "m" if u.startswith("mi") or u == "m" else u[0]
    return float(m.group(1)) * UNIT_H[key]


def parse_views(text: str | None) -> int | None:
    if not text:
        return None
    t = text.replace(",", "").lower()
    m = re.search(r"([\d.]+)\s*([km]?)", t)
    if not m:
        return 0 if "no views" in t else None
    n = float(m.group(1)) * {"": 1, "k": 1e3, "m": 1e6}[m.group(2)]
    return int(n)


def parse_len(text: str | None) -> int | None:
    if not text:
        return None
    parts = [int(p) for p in text.split(":") if p.isdigit()]
    sec = 0
    for p in parts:
        sec = sec * 60 + p
    return sec or None


def youtube_search(query: str, tag: dict) -> list[dict]:
    url = f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(query)}&sp={YT_WEEK}"
    page = fetch(url).decode("utf-8", "ignore")
    m = re.search(r"var ytInitialData = (\{.*?\});</script>", page)
    if not m:
        raise RuntimeError("няма ytInitialData")
    data = json.loads(m.group(1))

    def walk(o):
        if isinstance(o, dict):
            if "videoRenderer" in o:
                yield o["videoRenderer"]
            for v in o.values():
                yield from walk(v)
        elif isinstance(o, list):
            for v in o:
                yield from walk(v)

    out = []
    for rank, v in enumerate(walk(data)):
        vid = v.get("videoId")
        if not vid:
            continue
        ah = parse_rel((v.get("publishedTimeText") or {}).get("simpleText"))
        owner = ((v.get("ownerText") or {}).get("runs") or [{}])[0]
        cid = (((owner.get("navigationEndpoint") or {}).get("browseEndpoint")) or {}).get("browseId")
        desc_runs = (v.get("detailedMetadataSnippets") or [{}])[0].get("snippetText", {}).get("runs", [])
        out.append({
            "id": f"yt:{vid}", "kind": "video", "video_id": vid,
            "title": clean("".join(r.get("text", "") for r in (v.get("title") or {}).get("runs", []))),
            "url": f"https://www.youtube.com/watch?v={vid}", "is_short": False,
            "published": iso(NOW - timedelta(hours=ah)) if ah is not None else None, "age_h": ah,
            "published_approx": True,
            "channel": owner.get("text"), "channel_id": cid, "list": "search",
            "category_hint": tag.get("category"),
            "views": parse_views((v.get("viewCountText") or {}).get("simpleText")),
            "duration_s": parse_len((v.get("lengthText") or {}).get("simpleText")),
            "thumb": f"https://i.ytimg.com/vi/{vid}/mqdefault.jpg",
            "description": clean("".join(r.get("text", "") for r in desc_runs), 400),
            "found_via": [f"search:{query}"], "search_rank": rank,
            **({"person": tag["person"]} if tag.get("person") else {}),
        })
    return out[:20]


# ---------------------------------------------------------------- Статии

def parse_feed(data: bytes, source: str, category: str | None, extra: dict | None = None) -> list[dict]:
    root = ET.fromstring(data)
    items = root.findall(".//item") or root.findall("a:entry", NS)
    out = []
    for it in items:
        if it.tag == "item":
            title = it.findtext("title")
            link = it.findtext("link")
            pub = parse_date(it.findtext("pubDate") or it.findtext("dc:date", namespaces=NS))
            desc = it.findtext("description") or ""
            src = it.find("source")
            publisher = src.text if src is not None else None
        else:
            title = it.findtext("a:title", namespaces=NS)
            ln = it.find("a:link[@rel='alternate']", NS) or it.find("a:link", NS)
            link = ln.get("href") if ln is not None else None
            pub = parse_date(it.findtext("a:published", namespaces=NS) or it.findtext("a:updated", namespaces=NS))
            desc = it.findtext("a:summary", namespaces=NS) or it.findtext("a:content", namespaces=NS) or ""
            publisher = None
        if not title or not link:
            continue
        title = clean(title)
        if publisher and title.endswith(" - " + publisher):
            title = title[: -len(publisher) - 3]
        out.append({
            "id": sid("a", link), "kind": "article", "title": title, "url": link.strip(),
            "published": iso(pub), "age_h": age_hours(pub),
            "source": publisher or source, "feed": source, "category_hint": category,
            "description": clean(desc, 500), **(extra or {}),
        })
    return out


def google_news(q: str, lang: str = "en", days: int = 2, extra: dict | None = None, category: str | None = None) -> list[dict]:
    loc = {"en": "hl=en-US&gl=US&ceid=US:en", "bg": "hl=bg&gl=BG&ceid=BG:bg"}[lang]
    url = f"https://news.google.com/rss/search?q={urllib.parse.quote_plus(q + f' when:{days}d')}&{loc}"
    items = parse_feed(fetch(url), "Google News", category, extra)
    for it in items:
        it["description"] = ""  # в Google News описанието е само повторение на заглавието
        it["lang"] = lang
    return items[:25]


def person_news(p: dict) -> list[dict]:
    """Новини, в които човекът е споменат — само AI заглавия (за Мъск без Tesla/политика)."""
    org = [w for w in re.findall(r"\w{3,}", p.get("org") or "")]
    keep = [it for it in google_news(f"\"{p['name']}\"", "en", 3, {"person": p["name"]}, p["category"])
            if AI_WORDS.search(it["title"]) or any(w.lower() in it["title"].lower() for w in org)]
    return keep[:8]


def hacker_news() -> list[dict]:
    since = int((NOW - timedelta(hours=48)).timestamp())
    url = ("https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=100"
           f"&numericFilters=created_at_i>{since},points>40")
    out = []
    for h in json.loads(fetch(url))["hits"]:
        if not AI_WORDS.search(h.get("title") or ""):
            continue
        pub = parse_date(h.get("created_at"))
        link = h.get("url") or f"https://news.ycombinator.com/item?id={h['objectID']}"
        out.append({
            "id": f"hn:{h['objectID']}", "kind": "discussion", "title": clean(h["title"]), "url": link,
            "hn_url": f"https://news.ycombinator.com/item?id={h['objectID']}",
            "published": iso(pub), "age_h": age_hours(pub), "source": "Hacker News",
            "points": h.get("points"), "comments": h.get("num_comments"), "description": "",
        })
    return out


def hf_papers() -> list[dict]:
    out = []
    for p in json.loads(fetch("https://huggingface.co/api/daily_papers?limit=50")):
        pp = p.get("paper", {})
        pub = parse_date(p.get("publishedAt") or pp.get("publishedAt"))
        if age_hours(pub) is not None and age_hours(pub) > 24 * 4:
            continue
        out.append({
            "id": f"p:{pp.get('id')}", "kind": "paper", "title": clean(pp.get("title") or p.get("title")),
            "url": f"https://huggingface.co/papers/{pp.get('id')}", "published": iso(pub), "age_h": age_hours(pub),
            "source": "Hugging Face Papers", "upvotes": pp.get("upvotes"),
            "description": clean(pp.get("summary"), 600),
        })
    out.sort(key=lambda x: -(x.get("upvotes") or 0))
    return out[:15]


def bluesky(person: dict, handle: str) -> list[dict]:
    url = ("https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?"
           f"actor={urllib.parse.quote(handle)}&limit=20&filter=posts_no_replies")
    out = []
    for f in json.loads(fetch(url)).get("feed", []):
        p = f["post"]
        rec = p.get("record", {})
        pub = parse_date(rec.get("createdAt"))
        if age_hours(pub) is None or age_hours(pub) > 24 * ARTICLE_DAYS:
            continue
        rkey = p["uri"].rsplit("/", 1)[-1]
        out.append({
            "id": sid("bs", p["uri"]), "kind": "post", "title": clean(rec.get("text"), 280),
            "url": f"https://bsky.app/profile/{p['author']['handle']}/post/{rkey}",
            "published": iso(pub), "age_h": age_hours(pub), "source": f"Bluesky @{p['author']['handle']}",
            "person": person["name"], "likes": p.get("likeCount"), "reposts": p.get("repostCount"),
            "is_mirror": handle.endswith(("xmirror.bot", "selfhosted.social")), "description": "",
        })
    return out


def discover_feed(url: str) -> str | None:
    """За добавен сайт: намира RSS/Atom линка в страницата (или приема, че вече е feed)."""
    data = fetch(url)
    head = data[:500].decode("utf-8", "ignore").lower()
    if "<rss" in head or "<feed" in head or "<?xml" in head:
        return url
    page = data.decode("utf-8", "ignore")
    for m in re.finditer(r"<link[^>]+>", page, re.I):
        tag = m.group(0)
        if re.search(r'type="application/(rss|atom)\+xml"', tag, re.I):
            h = re.search(r'href="([^"]+)"', tag)
            if h:
                return urllib.parse.urljoin(url, html.unescape(h.group(1)))
    for guess in ("feed", "rss", "feed.xml", "rss.xml", "atom.xml", "index.xml"):
        g = urllib.parse.urljoin(url.rstrip("/") + "/", guess)
        try:
            if b"<rss" in fetch(g, timeout=10)[:800] or b"<feed" in fetch(g, timeout=10)[:800]:
                return g
        except Exception:  # noqa: BLE001
            pass
    return None


# ---------------------------------------------------------------- Сглобяване

def norm_title(t: str) -> set[str]:
    return {w for w in re.findall(r"\w+", t.lower()) if len(w) > 2}


def dedupe_articles(items: list[dict]) -> list[dict]:
    kept: list[dict] = []
    sigs: list[set[str]] = []
    for it in sorted(items, key=lambda x: (x.get("feed") == "Google News", x.get("age_h") or 999)):
        s = norm_title(it["title"])
        dup = None
        for k, ks in zip(kept, sigs):
            if s and ks and len(s & ks) / len(s | ks) >= 0.6:
                dup = k
                break
        if dup:
            dup.setdefault("also_in", []).append(it.get("source"))
            if it.get("person") and not dup.get("person"):
                dup["person"] = it["person"]
            continue
        kept.append(it)
        sigs.append(s)
    return kept


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE / "work"))
    ap.add_argument("--sources", default=str(HERE / "sources.json"))
    ap.add_argument("--user-sources", help="JSON списък с източниците, добавени от таблото")
    args = ap.parse_args()
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    src = json.loads(Path(args.sources).read_text(encoding="utf-8"))
    channels = [dict(c) for c in src["youtube"]]
    feeds = list(src["feeds"])
    people = [dict(p) for p in src["people"]]
    resolved = []

    # 1) Потребителските източници от таблото
    user = json.loads(Path(args.user_sources).read_text(encoding="utf-8")) if args.user_sources else []
    muted = {s.get("channel_id") for s in user if s.get("type") == "mute"}
    channels = [c for c in channels if c["channel_id"] not in muted]
    user = [s for s in user if s.get("type") != "mute"]
    known = {c["channel_id"] for c in channels}

    def resolve_user(s: dict) -> dict:
        r = {"doc_id": s.get("doc_id"), "type": s.get("type")}
        try:
            if s.get("type") == "youtube":
                cid, name = (s.get("channel_id"), s.get("resolved_name")) if s.get("channel_id") else resolve_youtube(s["url"])
                r.update(channel_id=cid, resolved_name=name or s.get("name"), status="ok" if cid else "error",
                         error=None if cid else "Не намерих такъв канал")
            elif s.get("type") == "site":
                feed = s.get("feed_url") or discover_feed(s["url"])
                r.update(feed_url=feed, status="ok" if feed else "error",
                         error=None if feed else "Сайтът няма RSS — ще го следя през Google News по име")
            elif s.get("type") == "person":
                r.update(status="ok")
        except Exception as e:  # noqa: BLE001
            r.update(status="error", error=f"{type(e).__name__}: {e}"[:200])
        return r

    with cf.ThreadPoolExecutor(8) as ex:
        resolved = list(ex.map(resolve_user, user))
    for s, r in zip(user, resolved):
        if r.get("status") != "ok" and s.get("type") != "site":
            continue
        cat = s.get("category") or "mine"
        mine = s.get("added_by") != "claude"  # добавените автоматично от Claude са част от радара, не "мои"
        if s["type"] == "youtube":
            if r["channel_id"] in known:
                for c in channels:  # вече е в радара — става "мой"
                    if c["channel_id"] == r["channel_id"] and mine:
                        c["list"] = "mine"
            else:
                channels.append({"channel_id": r["channel_id"], "name": r.get("resolved_name") or s.get("name"),
                                 "category": cat, "list": "mine" if mine else "radar"})
                known.add(r["channel_id"])
        elif s["type"] == "site":
            if r.get("feed_url"):
                feeds.append({"name": s.get("name") or urllib.parse.urlparse(s["url"]).netloc, "url": r["feed_url"],
                              "category": cat, "mine": mine})
        elif s["type"] == "person":
            people.append({"name": s["name"], "role": s.get("role", ""), "org": s.get("org", ""), "category": cat,
                           "x": s.get("x", ""), "bluesky": s.get("bluesky", ""), "yt_search": mine, "mine": mine})

    # 2) Задачи за паралелно теглене
    jobs: list[tuple[str, callable]] = []
    for c in channels:
        jobs.append((f"yt-channel {c['name']}", lambda c=c: youtube_channel(c)))
    for q in src["youtube_search"]:
        jobs.append((f"yt-search {q['q']}", lambda q=q: youtube_search(q["q"], q)))
    for p in people:
        if p.get("yt_search"):
            jobs.append((f"yt-person {p['name']}", lambda p=p: youtube_search(f"\"{p['name']}\"", {"person": p["name"], "category": p["category"]})))
        jobs.append((f"news-person {p['name']}", lambda p=p: person_news(p)))
        if p.get("bluesky"):
            jobs.append((f"bluesky {p['name']}", lambda p=p: bluesky(p, p["bluesky"])))
    for f in feeds:
        jobs.append((f"feed {f['name']}", lambda f=f: parse_feed(fetch(f["url"]), f["name"], f.get("category"), {"mine": True} if f.get("mine") else None)))
    for g in src["google_news"]:
        jobs.append((f"gnews {g['q'][:40]}", lambda g=g: google_news(g["q"], g.get("lang", "en"), 2, None, g.get("category"))))
    jobs.append(("hacker-news", hacker_news))
    jobs.append(("hf-papers", hf_papers))

    results: list[dict] = []
    health = []
    t0 = time.time()
    with cf.ThreadPoolExecutor(10) as ex:
        futs = {ex.submit(fn): name for name, fn in jobs}
        for fut in cf.as_completed(futs):
            name = futs[fut]
            try:
                got = fut.result()
                results.extend(got)
                health.append({"job": name, "ok": True, "n": len(got)})
            except Exception as e:  # noqa: BLE001
                health.append({"job": name, "ok": False, "error": f"{type(e).__name__}: {e}"[:160]})
                log(f"FAIL {name}: {e}")
    log(f"{len(jobs)} заявки за {time.time() - t0:.0f}s, {sum(1 for h in health if not h['ok'])} грешки")

    # 3) Видеа: сливане на канал + търсене, филтър по възраст
    videos: dict[str, dict] = {}
    for it in (r for r in results if r["kind"] == "video"):
        if it.get("age_h") is None or it["age_h"] > 24 * VIDEO_DAYS:
            continue
        cur = videos.get(it["id"])
        if not cur:
            videos[it["id"]] = it
            continue
        cur["found_via"] = sorted(set(cur["found_via"]) | set(it["found_via"]))
        if cur.get("published_approx") and not it.get("published_approx"):
            it["found_via"] = cur["found_via"]
            it.setdefault("duration_s", cur.get("duration_s"))
            it["person"] = it.get("person") or cur.get("person")
            videos[it["id"]] = it
        else:
            cur.setdefault("duration_s", it.get("duration_s"))
            if it.get("person") and not cur.get("person"):
                cur["person"] = it["person"]
            if cur.get("list") == "search" and it.get("list") in ("radar", "mine"):
                cur["list"] = it["list"]

    # средни гледания на канал (от RSS), за да се види кое видео "избухва"
    by_ch: dict[str, list[int]] = {}
    for r in results:
        if r["kind"] == "video" and "channel" in r.get("found_via", []) and r.get("views") is not None and (r.get("age_h") or 0) > 48:
            by_ch.setdefault(r["channel_id"], []).append(r["views"])
    for v in videos.values():
        med = statistics.median(by_ch[v["channel_id"]]) if len(by_ch.get(v["channel_id"], [])) >= 3 else None
        v["channel_median_views"] = int(med) if med else None
        if v.get("views") is not None and v.get("age_h"):
            v["views_per_hour"] = round(v["views"] / max(v["age_h"], 1), 1)
        if med and v.get("views") is not None and (v.get("age_h") or 0) >= 24:
            v["vs_channel"] = round(v["views"] / med, 2)

    for v in videos.values():
        if v.get("duration_s") and v["duration_s"] <= 70 and not v.get("is_short"):
            v["is_short"] = True

    # 4) Статии, дискусии, публикации, papers
    others = [r for r in results if r["kind"] != "video" and (r.get("age_h") is None or r["age_h"] <= 24 * ARTICLE_DAYS)]
    articles = dedupe_articles([r for r in others if r["kind"] == "article"])
    rest = {r["id"]: r for r in others if r["kind"] != "article"}

    items = sorted(videos.values(), key=lambda v: v.get("age_h") or 0) + articles + list(rest.values())
    raw = {
        "generated_at": iso(NOW), "counts": {
            "videos": len(videos), "articles": len(articles), "posts": sum(1 for r in rest.values() if r["kind"] == "post"),
            "discussions": sum(1 for r in rest.values() if r["kind"] == "discussion"),
            "papers": sum(1 for r in rest.values() if r["kind"] == "paper"),
            "channels": len(channels), "feeds": len(feeds), "people": len(people),
        },
        "health": sorted(health, key=lambda h: h["job"]),
        "channels": [{"channel_id": c["channel_id"], "name": c["name"], "category": c.get("category"), "list": c.get("list")} for c in channels],
        "people": people, "items": items,
    }
    (out_dir / "raw.json").write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    (out_dir / "resolved_sources.json").write_text(json.dumps(resolved, ensure_ascii=False, indent=1), encoding="utf-8")
    (out_dir / "compact.json").write_text(json.dumps(compact(raw), ensure_ascii=False, indent=0), encoding="utf-8")
    log(json.dumps(raw["counts"], ensure_ascii=False))


def _safe(fn, *a):
    try:
        return fn(*a)
    except Exception:  # noqa: BLE001
        return None


def compact(raw: dict) -> dict:
    """Съкратен вид за анализа: само нужното за групиране, оценка и резюме."""
    rows = []
    arts = [i for i in raw["items"] if i["kind"] == "article"]

    def art_score(i: dict) -> float:
        direct = 0 if i.get("feed") == "Google News" else 3
        return direct + 2 * len(i.get("also_in", [])) + (1 if i.get("person") else 0) + (2 if i.get("mine") else 0) - (i.get("age_h") or 72) / 36

    keep_arts = {i["id"] for i in sorted(arts, key=art_score, reverse=True)[:MAX_ARTICLES]}
    for it in raw["items"]:
        if it["kind"] == "article" and it["id"] not in keep_arts:
            continue
        if it["kind"] == "video" and it.get("list") == "search" and (it.get("views") or 0) < MIN_SEARCH_VIEWS:
            continue  # шум: непознат канал без гледания
        r = {"id": it["id"], "k": it["kind"], "t": it["title"], "age_h": it.get("age_h")}
        if it["kind"] == "video":
            r.update(ch=it.get("channel"), list=it.get("list"), views=it.get("views"),
                     min=round(it["duration_s"] / 60) if it.get("duration_s") else None,
                     short=it.get("is_short") or None, vs_ch=it.get("vs_channel"),
                     d=clean(it.get("description"), 160 if it.get("is_short") or (it.get("age_h") or 999) > 72 else 450))
        else:
            r.update(src=it.get("source"), d=clean(it.get("description"), 300))
            for k in ("points", "upvotes", "likes", "also_in", "mine", "lang"):
                if it.get(k):
                    r[k] = it[k] if k != "also_in" else len(it[k])
        if it.get("person"):
            r["person"] = it["person"]
        rows.append({k: v for k, v in r.items() if v not in (None, "", [])})
    return {"generated_at": raw["generated_at"], "counts": raw["counts"], "items": rows}


if __name__ == "__main__":
    main()
