"""Orchestrates one full analysis+trading pass across the watchlist.

Called by the scheduler on a timer and by POST /analyze/run for on-demand
demo runs. For each watchlisted asset: check existing position for a
stop-loss/take-profit exit, then synthesize a fresh decision and execute it
against the paper portfolio. Every decision is persisted regardless of
whether it results in a trade, so the decision journal shows "hold" calls
too, not just executed trades.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import WATCHLIST
from app.models import Decision
from app.modules import decision_engine, portfolio, risk, technical


def run_pipeline(db: Session) -> list[dict]:
    risk_row = risk.get_or_create_settings(db)
    risk_settings = risk.as_dict(risk_row)

    results = []
    current_prices: dict[str, float] = {}

    for asset in WATCHLIST:
        position = portfolio.get_position(db, asset.symbol)

        tech_preview = technical.analyze(asset.symbol, asset.asset_type, asset.source_id)
        current_price = tech_preview["last_price"]
        current_prices[asset.symbol] = current_price

        if position is not None and position.quantity > 0:
            exit_trade = portfolio.check_risk_exit(db, position, current_price)
            if exit_trade is not None:
                results.append({"symbol": asset.symbol, "type": "risk_exit", "trade_id": exit_trade.id})
                continue  # position closed by risk management; skip a fresh discretionary decision this pass

        qty = position.quantity if position else 0.0
        decision_dict = decision_engine.synthesize_decision(
            asset.symbol, asset.asset_type, asset.source_id, qty, risk_settings
        )
        current_prices[asset.symbol] = decision_dict["signals_used"]["technical"]["last_price"]

        decision = Decision(
            timestamp=decision_dict["timestamp"],
            symbol=decision_dict["symbol"],
            asset_type=decision_dict["asset_type"],
            action=decision_dict["action"],
            size_pct_of_portfolio=decision_dict["size_pct_of_portfolio"],
            confidence=decision_dict["confidence"],
            reasoning=decision_dict["reasoning"],
            signals_used=decision_dict["signals_used"],
            risk=decision_dict["risk"],
            requires_approval=decision_dict["requires_approval"],
        )
        db.add(decision)
        db.commit()
        db.refresh(decision)

        note = portfolio.execute_decision(db, decision, current_prices[asset.symbol])
        results.append({
            "symbol": asset.symbol, "type": "decision", "decision_id": decision.id,
            "action": decision.action, "executed": decision.executed, "note": note,
        })

    portfolio.record_snapshot(db, current_prices)
    return results
