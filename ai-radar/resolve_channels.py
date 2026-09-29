"""Resolve YouTube @handles to channel IDs (one-off helper; results go into sources.json)."""
import json, re, sys, urllib.request, concurrent.futures as cf

UA = {"User-Agent": "Mozilla/5.0", "Accept-Language": "en-US"}

def resolve(handle):
    url = handle if handle.startswith("http") else f"https://www.youtube.com/{handle}"
    try:
        html = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25).read().decode("utf-8", "ignore")
    except Exception as e:
        return None, None, str(e)
    m = re.search(r'"externalId":"(UC[\w-]{22})"', html) or re.search(r'channel/(UC[\w-]{22})', html)
    t = re.search(r'<meta property="og:title" content="([^"]*)"', html)
    return (m.group(1) if m else None), (t.group(1) if t else None), None

if __name__ == "__main__":
    rows = [l.split("|") for l in open(sys.argv[1], encoding="utf-8") if l.strip() and not l.startswith("#")]
    with cf.ThreadPoolExecutor(12) as ex:
        res = list(ex.map(lambda r: resolve(r[0].strip()), rows))
    out = []
    for (h, cat, name), (cid, title, err) in zip(rows, res):
        print(h, cid, title, err or "", file=sys.stderr)
        if cid:
            out.append({"type": "youtube", "handle": h.strip(), "channel_id": cid, "name": (title or name).strip(), "category": cat.strip()})
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
