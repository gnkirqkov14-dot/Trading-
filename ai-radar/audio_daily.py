"""AI Радар — безплатният глас за таблото (Microsoft Kalina, edge-tts).

    python3 audio_daily.py --work work [--items 60]

Записва „Най-важното“ и най-важните новини/видеа от днешния брой с
bg-BG-KalinaNeural и ги слепва в ЕДИН файл work/audio_day.mp4 (едно качване
в хранилището на таблото), с паузи между тях. Пише work/audio_day.json —
{date, clips: {id: [start, end]}} в секунди; след качването в базата отива
audio/day-<дата> = {date, asset, clips}. Таблото пуска парчето на избраната
новина. Нищо не струва пари.

id-тата са като в таблото: brief-<дата>-<n> за изреченията от брифинга и
id-то на новината с [^A-Za-z0-9_-] → "_" (напр. a:9eb9… → a_9eb9…).
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
import subprocess
import sys
from pathlib import Path

VOICE = "bg-BG-KalinaNeural"
RATE = 24000  # Hz, моно
GAP = 0.5     # секунди тишина между новините


def deps():
    import importlib.util
    import os
    if not (importlib.util.find_spec("edge_tts") and importlib.util.find_spec("imageio_ffmpeg")):
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "edge-tts", "imageio-ffmpeg"], check=True)
    import certifi
    ca = os.environ.get("SSL_CERT_FILE") or "/root/.ccr/ca-bundle.crt"
    if Path(ca).exists():  # облачната среда минава през прокси със собствен сертификат; edge_tts го чете при import
        certifi.where = lambda: ca
    import edge_tts, imageio_ffmpeg
    return edge_tts, imageio_ffmpeg.get_ffmpeg_exe()


def audio_id(key: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]", "_", key)


def item_speech(i: dict) -> str:
    """Същото като itemSpeech в таблото: източник + резюме на български."""
    by = f"Видео от {i.get('channel') or ''}" if i["kind"] == "video" else (i.get("source") or "")
    return ". ".join(x for x in (by, i.get("s") or i["title"]) if x)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--work", default="work")
    ap.add_argument("--items", type=int, default=60)
    args = ap.parse_args()
    work = Path(args.work)
    db = work / "db"
    date = json.loads(next(db.glob("digests__*.json")).read_text(encoding="utf-8"))["date"]
    digest = json.loads((db / f"digests__{date}.json").read_text(encoding="utf-8"))
    items = []
    for f in sorted(db.glob(f"digest_items__{date}-*.json")):
        items += json.loads(f.read_text(encoding="utf-8"))["items"]

    todo = [(f"brief-{date}-{n}", b["text"]) for n, b in enumerate(digest.get("brief", []))]
    good = [i for i in items if i.get("s") and i.get("t") not in ("off",)]
    good.sort(key=lambda i: -(i.get("score") or 0))
    todo += [(audio_id(i["id"]), item_speech(i)) for i in good[: args.items]]

    edge_tts, ff = deps()
    tmp = work / "audio_tmp"
    tmp.mkdir(parents=True, exist_ok=True)

    err: list[str] = []

    async def one(sem, n, text):
        async with sem:
            for attempt in range(3):
                try:
                    await edge_tts.Communicate(text, VOICE).save(str(tmp / f"{n}.mp3"))
                    return True
                except Exception as e:  # noqa: BLE001
                    err.append(f"{n}: {e!r}"[:200])
                    await asyncio.sleep(2 + attempt * 3)
            return False

    async def run():
        sem = asyncio.Semaphore(6)
        return await asyncio.gather(*(one(sem, n, t) for n, (_, t) in enumerate(todo)))

    ok = asyncio.run(run())
    pcm = bytearray()
    clips = {}
    gap = b"\0\0" * int(RATE * GAP)
    for n, ((cid, _), good_one) in enumerate(zip(todo, ok)):
        if not good_one:
            continue
        raw = subprocess.run([ff, "-v", "error", "-i", str(tmp / f"{n}.mp3"), "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-"],
                             check=True, capture_output=True).stdout
        start = len(pcm) / 2 / RATE
        pcm += raw
        clips[cid] = [round(start, 2), round(len(pcm) / 2 / RATE, 2)]
        pcm += gap
    out = work / "audio_day.mp4"
    subprocess.run([ff, "-v", "error", "-y", "-f", "s16le", "-ac", "1", "-ar", str(RATE), "-i", "-",
                    "-c:a", "aac", "-b:a", "40k", "-movflags", "+faststart", str(out)], input=bytes(pcm), check=True)
    (work / "audio_day.json").write_text(json.dumps({"date": date, "clips": clips}, ensure_ascii=False), encoding="utf-8")
    for f in tmp.glob("*.mp3"):
        f.unlink()
    print(json.dumps({"date": date, "clips": len(clips), "failed": ok.count(False), "minutes": round(len(pcm) / 2 / RATE / 60, 1),
                      "mb": round(out.stat().st_size / 1e6, 2), "file": str(out.resolve()), "errors": err[:3]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
