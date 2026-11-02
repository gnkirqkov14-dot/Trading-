"""PDF на разрешението за строеж: сваляне (с кеш) и разчитане на текста с tesseract.

Всяко разрешение се пази отделно (cache/pdf/<hash>.pdf, cache/ocr/<hash>.json), затова
прекъсване не губи нищо, а повторното пускане не сваля и не разчита отново.
"""
from __future__ import annotations

import hashlib
import json
import os
import subprocess
import tempfile
from pathlib import Path

from .http import Http
from .runlog import now

CACHE = Path(__file__).resolve().parent.parent / "cache"


def _key(permit_hash: str) -> str:
    return hashlib.sha1(permit_hash.encode()).hexdigest()[:16]


def pdf_path(permit_hash: str) -> Path:
    return CACHE / "pdf" / f"{_key(permit_hash)}.pdf"


def ocr_path(permit_hash: str) -> Path:
    return CACHE / "ocr" / f"{_key(permit_hash)}.json"


def download(http: Http, permit: dict) -> Path:
    path = pdf_path(permit["hash"])
    if path.exists() and path.stat().st_size > 1000:
        return path
    path.parent.mkdir(parents=True, exist_ok=True)
    resp = http.get(permit["pdf_url"], timeout=90)
    if not resp.content.startswith(b"%PDF"):
        raise ValueError("отговорът не е PDF")
    tmp = path.with_suffix(".part")
    tmp.write_bytes(resp.content)
    tmp.replace(path)  # атомарно: няма полусвалени файлове
    return path


def ocr(pdf: Path, pages: int = 2, dpi: int = 250) -> str:
    env = {**os.environ, "OMP_THREAD_LIMIT": "1"}
    texts = []
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run(["pdftoppm", "-r", str(dpi), "-png", "-f", "1", "-l", str(pages), str(pdf),
                        f"{tmp}/p"], check=True, capture_output=True)
        for img in sorted(Path(tmp).glob("p-*.png")):
            out = subprocess.run(["tesseract", str(img), "-", "-l", "bul"], capture_output=True,
                                 text=True, env=env, check=True)
            texts.append(out.stdout)
    return "\n\f\n".join(texts)


def permit_text(http: Http, permit: dict, runlog=None) -> dict | None:
    """{'text', 'pages', 'pdf_url', 'at'} от кеша или ново разчитане; None при неуспех."""
    path = ocr_path(permit["hash"])
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    if not permit.get("pdf_url"):
        if runlog:
            runlog.failure("pdf", permit["hash"], "няма линк към PDF в регистъра")
        return None
    try:
        text = ocr(download(http, permit))
    except Exception as exc:
        if runlog:
            runlog.failure("pdf", permit["hash"], exc, permit.get("pdf_url", ""))
        return None
    rec = {"text": text, "pdf_url": permit["pdf_url"], "at": now()}
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".part")
    tmp.write_text(json.dumps(rec, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)
    if runlog:
        runlog.success("pdf", permit["hash"])
    return rec
