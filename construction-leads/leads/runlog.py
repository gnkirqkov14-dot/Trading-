"""Дневник на изпълненията и неуспешните заявки.

- logs/run-<време>.log      – отделен лог за всяко пускане (не се презаписва);
- logs/failures.jsonl       – история на всички неуспешни заявки (по ред на случване);
- logs/pending_failures.json – текущо нерешените, по уникален ключ (без повторения);
  при успешен повторен опит записът се маха;
- logs/state-<стъпка>.json  – докъде е стигнала стъпката (записва се след всяка порция).
"""
from __future__ import annotations

import json
import sys
from datetime import datetime
from pathlib import Path

LOGS = Path(__file__).resolve().parent.parent / "logs"


def now() -> str:
    return datetime.now().isoformat(timespec="seconds")


class RunLog:
    def __init__(self, name: str = "run", folder: Path = LOGS):
        self.folder = folder
        self.folder.mkdir(parents=True, exist_ok=True)
        self.run_id = datetime.now().strftime("%Y%m%d-%H%M%S")
        self.path = self.folder / f"{name}-{self.run_id}.log"
        self.pending_path = self.folder / "pending_failures.json"
        self.history_path = self.folder / "failures.jsonl"
        self.failures_this_run = 0

    def log(self, msg: str) -> None:
        line = f"{now()} {msg}"
        print(msg, file=sys.stderr, flush=True)
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(line + "\n")

    def _pending(self) -> dict:
        try:
            return json.loads(self.pending_path.read_text(encoding="utf-8"))
        except (FileNotFoundError, ValueError):
            return {}

    def _save_pending(self, data: dict) -> None:
        tmp = self.pending_path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
        tmp.replace(self.pending_path)

    def failure(self, kind: str, key: str, error, url: str = "") -> None:
        rec = {"kind": kind, "key": key, "url": url, "error": str(error)[:300], "at": now(),
               "run": self.run_id}
        with open(self.history_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        pending = self._pending()
        prev = pending.get(f"{kind}:{key}", {})
        rec["attempts"] = prev.get("attempts", 0) + 1
        pending[f"{kind}:{key}"] = rec
        self._save_pending(pending)
        self.failures_this_run += 1
        self.log(f"  НЕУСПЕХ {kind} {key}: {str(error)[:120]}")

    def success(self, kind: str, key: str) -> None:
        pending = self._pending()
        if pending.pop(f"{kind}:{key}", None) is not None:
            self._save_pending(pending)

    def checkpoint(self, step: str, **state) -> None:
        path = self.folder / f"state-{step}.json"
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps({"run": self.run_id, "at": now(), **state}, ensure_ascii=False,
                                  indent=1), encoding="utf-8")
        tmp.replace(path)
