"""News module.

Fetches financial/crypto news relevant to a given asset, filters by relevance,
and tags each item with a sentiment score in [-1, 1].

If NEWS_API_KEY is set, this would call a real provider (GNews/Mediastack/
NewsAPI.ai — see docs/ARCHITECTURE.md for the trade-offs). Without a key
(the default for this demo) it serves a rotating set of realistic mock
headlines per asset, so the rest of the pipeline (sentiment -> decision) has
real signal to react to. The public function signature is the integration
seam: swapping in a real provider later means rewriting only
`_fetch_real_news`, nothing downstream.
"""

from __future__ import annotations

import hashlib
import random
from datetime import datetime, timezone
from typing import TypedDict

from app.config import settings

MOCK_HEADLINE_BANK: dict[str, list[tuple[str, float]]] = {
    "BTC": [
        ("Bitcoin ETF inflows hit multi-week high as institutions rotate back into crypto", 0.6),
        ("Miners' reserves fall to yearly low, raising supply-squeeze speculation", 0.3),
        ("Regulatory uncertainty in Asia weighs on Bitcoin sentiment", -0.4),
        ("On-chain data shows long-term holders accumulating despite price chop", 0.4),
        ("Exchange outflows spike after custody-risk rumors resurface", -0.5),
        ("Bitcoin holds key support as macro traders eye Fed decision", 0.1),
    ],
    "ETH": [
        ("Ethereum staking yields compress as validator queue grows", -0.1),
        ("Layer-2 activity hits record throughput, easing mainnet fee pressure", 0.5),
        ("Developers finalize next network upgrade timeline", 0.3),
        ("ETH underperforms BTC amid rotation into other L1 narratives", -0.3),
        ("Large treasury allocates fresh capital to staked ETH", 0.4),
    ],
    "SOL": [
        ("Solana network uptime streak extends, restoring institutional confidence", 0.5),
        ("Memecoin trading volume on Solana DEXs cools sharply from highs", -0.3),
        ("Major payments firm pilots settlement on Solana", 0.5),
        ("Validator concentration concerns resurface in governance debate", -0.2),
    ],
    "SPY": [
        ("S&P 500 earnings season beats expectations broadly, led by tech", 0.5),
        ("Inflation print comes in hotter than forecast, rate-cut odds slip", -0.4),
        ("Labor market data shows resilient but cooling job growth", 0.1),
        ("Credit spreads widen slightly on growth-slowdown worries", -0.2),
    ],
    "QQQ": [
        ("AI-linked megacaps rally on strong capex guidance", 0.6),
        ("Semiconductor export curbs add uncertainty to tech supply chains", -0.3),
        ("Nasdaq breadth narrows as gains concentrate in top names", -0.1),
        ("Cloud spending re-acceleration lifts software names", 0.4),
    ],
}


class NewsItem(TypedDict):
    headline: str
    source: str
    published_at: str
    sentiment: float  # -1..1
    relevance: float  # 0..1


def _seeded_rng(symbol: str) -> random.Random:
    # Deterministic-but-time-varying selection: same asset+hour -> same "news",
    # so repeated demo runs within an hour are reproducible instead of noisy.
    bucket = datetime.now(timezone.utc).strftime("%Y%m%d%H")
    seed = hashlib.sha256(f"{symbol}:{bucket}".encode()).hexdigest()
    return random.Random(seed)


def _fetch_mock_news(symbol: str, limit: int) -> list[NewsItem]:
    bank = MOCK_HEADLINE_BANK.get(symbol, [])
    if not bank:
        return []
    rng = _seeded_rng(symbol)
    picks = rng.sample(bank, k=min(limit, len(bank)))
    now = datetime.now(timezone.utc)
    items: list[NewsItem] = []
    for headline, base_sentiment in picks:
        jitter = rng.uniform(-0.1, 0.1)
        items.append(
            NewsItem(
                headline=headline,
                source="mock-financial-wire",
                published_at=now.isoformat(),
                sentiment=round(max(-1.0, min(1.0, base_sentiment + jitter)), 2),
                relevance=round(rng.uniform(0.7, 1.0), 2),
            )
        )
    return items


def _fetch_real_news(symbol: str, limit: int) -> list[NewsItem]:  # pragma: no cover
    """Placeholder for a real provider integration (GNews/Mediastack/NewsAPI.ai)."""
    raise NotImplementedError("Set NEWS_API_KEY and implement a real provider call here.")


def fetch_news(symbol: str, limit: int = 3) -> list[NewsItem]:
    if settings.news_api_key:
        return _fetch_real_news(symbol, limit)
    return _fetch_mock_news(symbol, limit)
