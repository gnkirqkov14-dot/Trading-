"""Paper trading engine.

Cash is derived from trade history (starting_capital minus net buy spend
plus net sell proceeds) rather than stored as a mutable counter, so the
ledger is always reconstructable and can't drift out of sync with the trades
table. Positions are maintained as running weighted-average-cost rows.

Risk exits (stop-loss / take-profit) always execute regardless of
`autonomous_mode` — once a position exists, closing it to cap a loss or lock
a gain is treated as risk management, not a new discretionary bet, so it
isn't gated behind the future approval-mode threshold the way opening/
enlarging a position is.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Decision, Position, PortfolioSnapshot, Trade


def compute_cash(db: Session) -> float:
    trades = db.query(Trade).all()
    cash = settings.starting_capital
    for t in trades:
        cash += t.value if t.side == "sell" else -t.value
    return round(cash, 2)


def get_position(db: Session, symbol: str) -> Position | None:
    return db.query(Position).filter(Position.symbol == symbol).first()


def get_positions(db: Session) -> list[Position]:
    return db.query(Position).filter(Position.quantity > 0).all()


def portfolio_state(db: Session, current_prices: dict[str, float]) -> dict:
    cash = compute_cash(db)
    positions = get_positions(db)
    position_rows = []
    positions_value = 0.0
    for p in positions:
        price = current_prices.get(p.symbol, p.avg_entry_price)
        market_value = round(p.quantity * price, 2)
        positions_value += market_value
        unrealized = round((price - p.avg_entry_price) * p.quantity, 2)
        unrealized_pct = round((price / p.avg_entry_price - 1) * 100, 2) if p.avg_entry_price else 0.0
        position_rows.append({
            "symbol": p.symbol,
            "asset_type": p.asset_type,
            "quantity": p.quantity,
            "avg_entry_price": p.avg_entry_price,
            "current_price": price,
            "market_value": market_value,
            "unrealized_pnl": unrealized,
            "unrealized_pnl_pct": unrealized_pct,
            "stop_loss_pct": p.stop_loss_pct,
            "take_profit_pct": p.take_profit_pct,
        })
    total_value = round(cash + positions_value, 2)
    total_pnl = round(total_value - settings.starting_capital, 2)
    total_pnl_pct = round((total_value / settings.starting_capital - 1) * 100, 2)
    return {
        "cash": cash,
        "positions_value": round(positions_value, 2),
        "total_value": total_value,
        "starting_capital": settings.starting_capital,
        "total_pnl": total_pnl,
        "total_pnl_pct": total_pnl_pct,
        "positions": position_rows,
    }


def record_snapshot(db: Session, current_prices: dict[str, float]) -> PortfolioSnapshot:
    state = portfolio_state(db, current_prices)
    snap = PortfolioSnapshot(
        cash=state["cash"],
        positions_value=state["positions_value"],
        total_value=state["total_value"],
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return snap


def _max_affordable_quantity(cash: float, price: float, target_value: float) -> float:
    spend = min(cash, target_value)
    if spend <= 0 or price <= 0:
        return 0.0
    return spend / price


def execute_decision(db: Session, decision: Decision, current_price: float) -> str:
    """Executes a persisted Decision against the paper portfolio.

    Returns an execution note. Mutates `decision.executed` accordingly.
    """
    if decision.requires_approval:
        decision.execution_note = "Изчаква одобрение (над прага за автономност)."
        decision.executed = False
        db.commit()
        return decision.execution_note

    if decision.action == "hold":
        decision.executed = True
        decision.execution_note = "Без действие — сигналите не оправдават сделка."
        db.commit()
        return decision.execution_note

    position = get_position(db, decision.symbol)

    if decision.action == "buy":
        cash = compute_cash(db)
        state = portfolio_state(db, {decision.symbol: current_price})
        target_value = state["total_value"] * decision.size_pct_of_portfolio
        quantity = round(_max_affordable_quantity(cash, current_price, target_value), 8)
        if quantity <= 0:
            decision.executed = False
            decision.execution_note = "Недостатъчен свободен паричен ресурс за отваряне на позиция."
            db.commit()
            return decision.execution_note

        value = round(quantity * current_price, 2)
        trade = Trade(
            decision_id=decision.id, symbol=decision.symbol, asset_type=decision.asset_type,
            side="buy", quantity=quantity, price=current_price, value=value,
        )
        db.add(trade)

        if position is None:
            position = Position(
                symbol=decision.symbol, asset_type=decision.asset_type, quantity=quantity,
                avg_entry_price=current_price,
                stop_loss_pct=decision.risk["stop_loss_pct"],
                take_profit_pct=decision.risk["take_profit_pct"],
            )
            db.add(position)
        else:
            new_qty = position.quantity + quantity
            position.avg_entry_price = round(
                (position.avg_entry_price * position.quantity + value) / new_qty, 6
            )
            position.quantity = new_qty
            position.updated_at = datetime.now(timezone.utc)

        decision.executed = True
        decision.execution_note = f"Купени {quantity} {decision.symbol} @ {current_price} (${value})."
        db.commit()
        return decision.execution_note

    if decision.action == "sell":
        if position is None or position.quantity <= 0:
            decision.executed = False
            decision.execution_note = "Няма отворена позиция за продажба."
            db.commit()
            return decision.execution_note

        quantity = position.quantity  # full exit in this demo's decision model
        value = round(quantity * current_price, 2)
        realized_pnl = round((current_price - position.avg_entry_price) * quantity, 2)
        trade = Trade(
            decision_id=decision.id, symbol=decision.symbol, asset_type=decision.asset_type,
            side="sell", quantity=quantity, price=current_price, value=value,
            realized_pnl=realized_pnl,
        )
        db.add(trade)
        db.delete(position)

        decision.executed = True
        decision.execution_note = (
            f"Продадени {quantity} {decision.symbol} @ {current_price} "
            f"(реализиран P&L: ${realized_pnl})."
        )
        db.commit()
        return decision.execution_note

    decision.executed = False
    decision.execution_note = "Неразпознато действие."
    db.commit()
    return decision.execution_note


def check_risk_exit(db: Session, position: Position, current_price: float) -> Trade | None:
    """Force-closes a position if it breached its stop-loss or take-profit band."""
    change_pct = (current_price / position.avg_entry_price) - 1
    trigger = None
    if change_pct <= -position.stop_loss_pct:
        trigger = "stop_loss"
    elif change_pct >= position.take_profit_pct:
        trigger = "take_profit"
    if trigger is None:
        return None

    quantity = position.quantity
    value = round(quantity * current_price, 2)
    realized_pnl = round((current_price - position.avg_entry_price) * quantity, 2)

    decision = Decision(
        symbol=position.symbol, asset_type=position.asset_type, action="sell",
        size_pct_of_portfolio=1.0, confidence=1.0,
        reasoning=(
            f"Автоматично управление на риска: цената достигна "
            f"{'стоп-лос' if trigger == 'stop_loss' else 'тейк-профит'} нивото "
            f"({change_pct:+.2%} спрямо средната входна цена {position.avg_entry_price})."
        ),
        signals_used={"trigger": trigger, "change_pct": round(change_pct, 4)},
        risk={"stop_loss_pct": position.stop_loss_pct, "take_profit_pct": position.take_profit_pct},
        requires_approval=False,
        executed=True,
        execution_note=f"Автоматично затворена позиция ({trigger}).",
    )
    db.add(decision)
    db.flush()

    trade = Trade(
        decision_id=decision.id, symbol=position.symbol, asset_type=position.asset_type,
        side="sell", quantity=quantity, price=current_price, value=value,
        realized_pnl=realized_pnl,
    )
    db.add(trade)
    db.delete(position)
    db.commit()
    db.refresh(trade)
    return trade
