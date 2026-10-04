"""Ежедневно: взима последните постове на партньорите от Instagram през Apify
(токенът се добавя автоматично от средата за api.apify.com), прави малки прегледи
в gallery/thumbs и записва новите постове в new_docs/<id>.json за галерията."""
import json, os, subprocess, sys, urllib.request
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 6
partners = [l.rstrip("\n").split("\t") for l in open(f"{HERE}/partners.txt", encoding="utf-8") if l.strip()]
country = dict(partners)
seen = set(json.load(open(f"{HERE}/seen.json")))
since = (datetime.now(timezone.utc) - timedelta(days=10)).strftime("%Y-%m-%d")

body = {"directUrls": [f"https://www.instagram.com/{u}/" for u, _ in partners],
        "resultsType": "posts", "resultsLimit": LIMIT, "onlyPostsNewerThan": since}
req = urllib.request.Request(
    "https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?timeout=540",
    data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}, method="POST")
items = json.load(urllib.request.urlopen(req, timeout=600))

out = f"{HERE}/new_docs"; os.makedirs(out, exist_ok=True); os.makedirs(f"{HERE}/gallery/thumbs", exist_ok=True)
new = []
for p in items:
    sc = p.get("shortCode")
    if not sc or sc in seen or p.get("error"): continue
    src = f"/tmp/{sc}.src"; thumb = f"thumbs/{sc}.jpg"
    try:
        urllib.request.urlretrieve(p["displayUrl"], src)
        subprocess.run(["convert", src, "-resize", "480x600^", "-gravity", "center", "-extent", "480x600",
                        "-quality", "78", f"{HERE}/gallery/{thumb}"], check=True)
    except Exception as e:
        print("пропуснат", sc, e); continue
    user = p.get("ownerUsername", "")
    t = p.get("type")
    doc = {"partner": user, "country": country.get(user, ""), "date": p.get("timestamp", "")[:10],
           "type": "video" if t == "Video" else ("carousel" if t == "Sidecar" else "image"),
           "count": len(p.get("images") or []) or 1, "url": p.get("url"),
           "caption": (p.get("caption") or "")[:600], "thumb": thumb, "status": "new",
           "addedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
           "media": {"images": p.get("images") or ([p["displayUrl"]] if t != "Video" else []),
                     "video": p.get("videoUrl")}}
    json.dump(doc, open(f"{out}/{sc}.json", "w"), ensure_ascii=False)
    seen.add(sc); new.append(sc)

json.dump(sorted(seen), open(f"{HERE}/seen.json", "w"))
print(json.dumps({"new": new, "total_fetched": len(items)}))
