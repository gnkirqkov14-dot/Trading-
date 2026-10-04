"""AI Радар — клипове за слушане в таблото (поръчани от бутона „▶ Слушай“).

    python3 audio_put.py work/audio_job.json

audio_job.json е {"job": "...", "clips": [{"id", "key", "title", "url"}]} — текстът,
който таблото праща с fire_trigger. Сваля mp3-тата от ElevenLabs, прави ги
audio-only mp4 (хранилището на таблото не приема mp3) в work/audio/<id>.mp4
и печата списъка — после Artifact asset upload и запис в базата (AUDIO.md).
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from collect import fetch


def ffmpeg() -> str:
    try:
        import imageio_ffmpeg
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", "imageio-ffmpeg"], check=True)
        import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def main() -> None:
    job = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    out = Path(sys.argv[1]).parent / "audio"
    out.mkdir(parents=True, exist_ok=True)
    ff = ffmpeg()
    done, failed = [], []
    for c in job["clips"]:
        mp3, mp4 = out / f"{c['id']}.mp3", out / f"{c['id']}.mp4"
        try:
            mp3.write_bytes(fetch(c["url"], timeout=60))
            subprocess.run([ff, "-v", "error", "-y", "-i", str(mp3), "-vn", "-c:a", "aac", "-b:a", "64k",
                            "-movflags", "+faststart", str(mp4)], check=True)
            done.append({**{k: c[k] for k in ("id", "key", "title")}, "file": str(mp4.resolve())})
        except Exception as e:  # noqa: BLE001
            failed.append({"id": c["id"], "error": str(e)[:200]})
    print(json.dumps({"job": job["job"], "done": done, "failed": failed}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
