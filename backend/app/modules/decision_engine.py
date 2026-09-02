"""Decision module — the agent's "reasoning brain".

Combines news sentiment, statement tone, and technical indicators into one
trading decision per asset, matching the JSON shape documented in
docs/DECISION_SCHEMA.md.

Two reasoning backends:
- If ANTHROPIC_API_KEY is set, the raw signals are handed to Claude, which
  weighs the (often conflicting) inputs and returns both the decision and a
  natural-language justification — this is what gives the agent the
  "creative, not just rule-following" behavior described in the brief.
- Otherwise, `_rule_based_decision` computes the same decision structure
  from a transparent weighted-score formula, with a templated explanation.
  This keeps the whole app runnable with zero paid API keys.

Either path produces the same dict shape, so the rest of the app (portfolio
engine, API, frontend) never needs to know which backend ran.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone

from app.config import settings
from app.modules import news as news_module
from app.modules import statements as statements_module
from app.modules import technical as technical_module

SENTIMENT_WEIGHT = 0.35
STATEMENT_WEIGHT = 0.25
TECHNICAL_WEIGHT = 0.40

ACTION_THRESHOLD = 0.18  # |combined_score| below this -> hold


def _weighted_avg(pairs: list[tuple[float, float]]) -> float:
    total_weight = sum(w for _, w in pairs)
    if total_weight == 0:
        return 0.0
    return sum(v * w for v, w in pairs) / total_weight


def _technical_score(tech: dict) -> float:
    score = 0.0
    rsi14 = tech.get("rsi14")
    if rsi14 is not None:
        if rsi14 < 30:
            score += 0.5  # oversold -> bullish tilt
        elif rsi14 > 70:
            score -= 0.5  # overbought -> bearish tilt
        else:
            score += (50 - rsi14) / 100  # mild mean-reversion tilt

    if tech.get("trend") == "bullish":
        score += 0.35
    elif tech.get("trend") == "bearish":
        score -= 0.35

    macd = tech.get("macd")
    if macd:
        score += 0.3 if macd["histogram"] > 0 else -0.3

    last_price = tech.get("last_price")
    resistance = tech.get("resistance")
    support = tech.get("support")
    if last_price and resistance and last_price >= resistance * 0.99:
        score -= 0.15  # near resistance -> caution
    if last_price and support and last_price <= support * 1.01:
        score += 0.15  # near support -> opportunity

    return max(-1.0, min(1.0, score))


def _combine_signals(news_items: list, statement_items: list, tech: dict) -> dict:
    news_sent = _weighted_avg([(n["sentiment"], n["relevance"]) for n in news_items]) if news_items else 0.0
    stmt_tone = _weighted_avg([(s["tone"], s["importance"]) for s in statement_items]) if statement_items else 0.0
    tech_score = _technical_score(tech)

    combined = (
        news_sent * SENTIMENT_WEIGHT + stmt_tone * STATEMENT_WEIGHT + tech_score * TECHNICAL_WEIGHT
    )
    return {"news_sentiment": round(news_sent, 3), "statement_tone": round(stmt_tone, 3),
            "technical_score": round(tech_score, 3), "combined_score": round(combined, 3)}


def _rule_based_reasoning(symbol: str, action: str, scores: dict, tech: dict,
                           news_items: list, statement_items: list) -> str:
    parts = [
        f"Комбиниран сигнал за {symbol}: {scores['combined_score']:+.2f} "
        f"(новини {scores['news_sentiment']:+.2f}, изказвания {scores['statement_tone']:+.2f}, "
        f"технически {scores['technical_score']:+.2f})."
    ]
    if tech.get("rsi14") is not None:
        parts.append(f"RSI14 е {tech['rsi14']}, тренд по SMA20/50: {tech['trend']}.")
    if news_items:
        top_news = max(news_items, key=lambda n: n["relevance"])
        parts.append(f"Водеща новина: \"{top_news['headline']}\" (сентимент {top_news['sentiment']:+.2f}).")
    if statement_items:
        top_stmt = max(statement_items, key=lambda s: s["importance"])
        parts.append(f"Ключово изказване от {top_stmt['speaker']}: \"{top_stmt['statement']}\".")

    if action == "buy":
        parts.append("Положителните сигнали надделяват над рисковете — агентът отваря/увеличава позиция.")
    elif action == "sell":
        parts.append("Отрицателните сигнали и/или технически риск преобладават — агентът намалява/затваря позиция.")
    else:
        parts.append("Сигналите са противоречиви или твърде слаби, за да оправдаят действие — агентът изчаква.")
    return " ".join(parts)


def _claude_reasoning(symbol: str, asset_type: str, action: str, scores: dict, tech: dict,
                       news_items: list, statement_items: list) -> str | None:
    if not settings.anthropic_api_key:
        return None
    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        payload = {
            "asset": symbol,
            "asset_type": asset_type,
            "proposed_action": action,
            "scores": scores,
            "technical": tech,
            "news": news_items,
            "statements": statement_items,
        }
        prompt = (
            "Ти си автономен AI трейдър анализатор, работещ с виртуален (paper trading) портфейл. "
            "По-долу е даден суров пакет от сигнали за един актив: новини, изказвания на ключови фигури "
            "и технически индикатори, заедно с предварително изчислен претеглен резултат и предложено "
            f"действие ({action}). Напиши кратка (3-5 изречения), конкретна обосновка на български език "
            "за това решение, като изрично претеглиш противоречивите сигнали (ако има такива) — не просто "
            "изброявай индикаторите. Пиши директно обосновката, без въведения.\n\n"
            f"Данни:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
        )
        response = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()
    except Exception as exc:  # network/quota/etc — fall back gracefully
        return f"[Claude reasoning unavailable, using rule-based fallback: {exc}]"


def synthesize_decision(symbol: str, asset_type: str, source_id: str,
                         current_quantity: float, risk_settings: dict) -> dict:
    news_items = news_module.fetch_news(symbol)
    statement_items = statements_module.fetch_statements(symbol)
    tech = technical_module.analyze(symbol, asset_type, source_id)

    scores = _combine_signals(news_items, statement_items, tech)
    combined = scores["combined_score"]

    if combined >= ACTION_THRESHOLD:
        action = "buy"
    elif combined <= -ACTION_THRESHOLD and current_quantity > 0:
        action = "sell"
    else:
        action = "hold"

    confidence = round(min(1.0, abs(combined) / 1.0), 3)
    size_pct = round(min(risk_settings["max_position_pct"], confidence * risk_settings["max_position_pct"]), 4) \
        if action == "buy" else (1.0 if action == "sell" else 0.0)

    reasoning = _claude_reasoning(symbol, asset_type, action, scores, tech, news_items, statement_items)
    reasoning_source = "claude"
    if not reasoning:
        reasoning = _rule_based_reasoning(symbol, action, scores, tech, news_items, statement_items)
        reasoning_source = "rule_based"

    requires_approval = (not risk_settings["autonomous_mode"]) and (
        size_pct >= risk_settings["approval_threshold_pct"]
    )

    return {
        "timestamp": datetime.now(timezone.utc),
        "symbol": symbol,
        "asset_type": asset_type,
        "action": action,
        "size_pct_of_portfolio": size_pct,
        "confidence": confidence,
        "reasoning": reasoning,
        "reasoning_source": reasoning_source,
        "signals_used": {
            "news": news_items,
            "statements": statement_items,
            "technical": tech,
            "scores": scores,
        },
        "risk": {
            "stop_loss_pct": risk_settings["default_stop_loss_pct"],
            "take_profit_pct": risk_settings["default_take_profit_pct"],
        },
        "requires_approval": requires_approval,
    }
