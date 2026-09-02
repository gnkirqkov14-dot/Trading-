"""Statements module.

Tracks public statements from central bankers, regulators, and influential
crypto/market figures, tagging each by tone (hawkish/dovish or
bullish/bearish, expressed on the same -1..1 scale as news sentiment) and
importance.

Same mock-with-real-adapter-seam pattern as news.py — see that file's
docstring. A real integration would poll a speech/transcript feed or a
curated Twitter/X list (see docs/ARCHITECTURE.md for the X API cost
discussion) instead of `_fetch_mock_statements`.
"""

from __future__ import annotations

import hashlib
import random
from datetime import datetime, timezone
from typing import TypedDict

from app.config import settings

MOCK_STATEMENT_BANK: dict[str, list[tuple[str, str, float, float]]] = {
    "BTC": [
        ("SEC Chair", "Reiterated caution on spot crypto products pending further review", -0.3, 0.8),
        ("Fed Chair", "Signaled rates likely to stay higher for longer", -0.2, 0.9),
        ("Major exchange CEO", "Announced expanded institutional custody offering", 0.4, 0.6),
        ("Prominent macro investor", "Called Bitcoin a hedge against currency debasement", 0.5, 0.5),
    ],
    "ETH": [
        ("Foundation researcher", "Confirmed upgrade is on track for testnet this quarter", 0.4, 0.6),
        ("SEC official", "Declined to clarify staking's regulatory status", -0.3, 0.7),
        ("Fed Chair", "Signaled rates likely to stay higher for longer", -0.2, 0.7),
    ],
    "SOL": [
        ("Ecosystem lead", "Highlighted record developer activity at conference keynote", 0.4, 0.5),
        ("Independent auditor", "Flagged validator concentration as a governance risk", -0.3, 0.5),
    ],
    "SPY": [
        ("Fed Chair", "Signaled rates likely to stay higher for longer", -0.3, 0.9),
        ("Treasury Secretary", "Expressed confidence in continued disinflation", 0.3, 0.6),
        ("Prominent fund manager", "Warned valuations look stretched into earnings", -0.2, 0.5),
    ],
    "QQQ": [
        ("Major AI-chip CEO", "Raised forward guidance on data-center demand", 0.6, 0.7),
        ("Fed Chair", "Signaled rates likely to stay higher for longer", -0.2, 0.7),
        ("Antitrust regulator", "Opened inquiry into a large platform's AI practices", -0.3, 0.5),
    ],
}


class StatementItem(TypedDict):
    speaker: str
    statement: str
    tone: float  # -1 (hawkish/bearish) .. 1 (dovish/bullish)
    importance: float  # 0..1
    timestamp: str


def _seeded_rng(symbol: str) -> random.Random:
    bucket = datetime.now(timezone.utc).strftime("%Y%m%d%H")
    seed = hashlib.sha256(f"stmt:{symbol}:{bucket}".encode()).hexdigest()
    return random.Random(seed)


def _fetch_mock_statements(symbol: str, limit: int) -> list[StatementItem]:
    bank = MOCK_STATEMENT_BANK.get(symbol, [])
    if not bank:
        return []
    rng = _seeded_rng(symbol)
    picks = rng.sample(bank, k=min(limit, len(bank)))
    now = datetime.now(timezone.utc)
    return [
        StatementItem(
            speaker=speaker,
            statement=statement,
            tone=tone,
            importance=importance,
            timestamp=now.isoformat(),
        )
        for speaker, statement, tone, importance in picks
    ]


def _fetch_real_statements(symbol: str, limit: int) -> list[StatementItem]:  # pragma: no cover
    raise NotImplementedError("Implement a real speech/X-feed integration here.")


def fetch_statements(symbol: str, limit: int = 2) -> list[StatementItem]:
    if settings.statements_api_key:
        return _fetch_real_statements(symbol, limit)
    return _fetch_mock_statements(symbol, limit)
