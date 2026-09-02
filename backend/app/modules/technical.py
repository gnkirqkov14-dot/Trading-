"""Technical analysis module.

Pulls historical daily closes for an asset and computes the indicator set the
decision engine reasons over: SMA20/SMA50, RSI14, MACD, and a naive
support/resistance band from recent price extremes.

Crypto prices come from CoinGecko's free market_chart endpoint (no key
required for the demo-tier usage this app makes). ETF/equity prices come from
Stooq's free CSV endpoint (also no key required). Both are best-effort: if
the network call fails or is unreachable (e.g. an offline sandbox), we fall
back to a deterministic synthetic random-walk series so the rest of the
pipeline still has something to analyze — this is clearly flagged in the
returned dict via `"source": "synthetic_fallback"` so it's never confused
with real market data downstream or in the UI.
"""

from __future__ import annotations

import hashlib
import io
import random
from csv import DictReader
from datetime import datetime, timedelta, timezone

import httpx

from app.config import settings

COINGECKO_BASE = "https://api.coingecko.com/api/v3"
STOOQ_BASE = "https://stooq.com/q/d/l"


def _synthetic_closes(symbol: str, days: int, start_price: float) -> list[float]:
    seed = hashlib.sha256(f"synthetic:{symbol}".encode()).hexdigest()
    rng = random.Random(seed)
    price = start_price
    closes = []
    for _ in range(days):
        price *= 1 + rng.uniform(-0.035, 0.035)
        closes.append(round(price, 4))
    return closes


def _fetch_crypto_closes(coingecko_id: str, days: int = 90) -> tuple[list[float], str]:
    params = {"vs_currency": "usd", "days": str(days)}
    headers = {}
    if settings.coingecko_api_key:
        headers["x-cg-demo-api-key"] = settings.coingecko_api_key
    try:
        resp = httpx.get(
            f"{COINGECKO_BASE}/coins/{coingecko_id}/market_chart",
            params=params,
            headers=headers,
            timeout=10.0,
        )
        resp.raise_for_status()
        prices = resp.json()["prices"]  # list of [timestamp_ms, price]
        closes = [round(p[1], 4) for p in prices]
        if len(closes) >= 20:
            return closes, "coingecko"
    except Exception:
        pass
    return _synthetic_closes(coingecko_id, days, start_price=100.0), "synthetic_fallback"


def _fetch_etf_closes(stooq_ticker: str, days: int = 90) -> tuple[list[float], str]:
    try:
        resp = httpx.get(STOOQ_BASE, params={"s": stooq_ticker, "i": "d"}, timeout=10.0)
        resp.raise_for_status()
        reader = DictReader(io.StringIO(resp.text))
        rows = [row for row in reader if row.get("Close")]
        closes = [round(float(row["Close"]), 4) for row in rows[-days:]]
        if len(closes) >= 20:
            return closes, "stooq"
    except Exception:
        pass
    return _synthetic_closes(stooq_ticker, days, start_price=450.0), "synthetic_fallback"


def fetch_closes(symbol: str, asset_type: str, source_id: str, days: int = 90) -> tuple[list[float], str]:
    if asset_type == "crypto":
        return _fetch_crypto_closes(source_id, days)
    return _fetch_etf_closes(source_id, days)


def sma(closes: list[float], period: int) -> float | None:
    if len(closes) < period:
        return None
    return round(sum(closes[-period:]) / period, 4)


def rsi(closes: list[float], period: int = 14) -> float | None:
    if len(closes) < period + 1:
        return None
    deltas = [closes[i] - closes[i - 1] for i in range(1, len(closes))]
    recent = deltas[-period:]
    gains = [d for d in recent if d > 0]
    losses = [-d for d in recent if d < 0]
    avg_gain = sum(gains) / period
    avg_loss = sum(losses) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - (100 / (1 + rs)), 2)


def _ema_series(closes: list[float], period: int) -> list[float]:
    k = 2 / (period + 1)
    ema_vals = [closes[0]]
    for price in closes[1:]:
        ema_vals.append(price * k + ema_vals[-1] * (1 - k))
    return ema_vals


def macd(closes: list[float]) -> dict | None:
    if len(closes) < 35:
        return None
    ema12 = _ema_series(closes, 12)
    ema26 = _ema_series(closes, 26)
    macd_line = [a - b for a, b in zip(ema12, ema26)]
    signal_line = _ema_series(macd_line, 9)
    return {
        "macd": round(macd_line[-1], 4),
        "signal": round(signal_line[-1], 4),
        "histogram": round(macd_line[-1] - signal_line[-1], 4),
    }


def support_resistance(closes: list[float], lookback: int = 30) -> dict:
    window = closes[-lookback:] if len(closes) >= lookback else closes
    return {"support": round(min(window), 4), "resistance": round(max(window), 4)}


def analyze(symbol: str, asset_type: str, source_id: str) -> dict:
    closes, source = fetch_closes(symbol, asset_type, source_id)
    last_price = closes[-1]
    sma20 = sma(closes, 20)
    sma50 = sma(closes, 50)
    trend = "unknown"
    if sma20 and sma50:
        trend = "bullish" if sma20 > sma50 else "bearish" if sma20 < sma50 else "flat"

    return {
        "source": source,
        "last_price": last_price,
        "sma20": sma20,
        "sma50": sma50,
        "trend": trend,
        "rsi14": rsi(closes),
        "macd": macd(closes),
        **support_resistance(closes),
        "price_history": closes[-60:],
        "as_of": datetime.now(timezone.utc).isoformat(),
    }
