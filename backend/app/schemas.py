"""Pydantic schemas — the API's wire format.

`DecisionOut` mirrors the JSON decision structure described in
docs/DECISION_SCHEMA.md; it's the shape decision_engine.synthesize_decision()
produces and the shape the frontend's decision journal renders.
"""

from __future__ import annotations

import datetime as dt

from pydantic import BaseModel


class NewsItemOut(BaseModel):
    headline: str
    source: str
    published_at: str
    sentiment: float
    relevance: float


class StatementItemOut(BaseModel):
    speaker: str
    statement: str
    tone: float
    importance: float
    timestamp: str


class TechnicalOut(BaseModel):
    source: str
    last_price: float
    sma20: float | None
    sma50: float | None
    trend: str
    rsi14: float | None
    macd: dict | None
    support: float
    resistance: float
    as_of: str


class SignalsUsed(BaseModel):
    news: list[NewsItemOut]
    statements: list[StatementItemOut]
    technical: TechnicalOut


class RiskParams(BaseModel):
    stop_loss_pct: float
    take_profit_pct: float


class DecisionOut(BaseModel):
    id: int | None = None
    timestamp: dt.datetime
    symbol: str
    asset_type: str
    action: str  # buy | sell | hold
    size_pct_of_portfolio: float
    confidence: float
    reasoning: str
    signals_used: SignalsUsed
    risk: RiskParams
    requires_approval: bool
    executed: bool
    execution_note: str = ""

    class Config:
        from_attributes = True


class TradeOut(BaseModel):
    id: int
    decision_id: int | None
    timestamp: dt.datetime
    symbol: str
    asset_type: str
    side: str
    quantity: float
    price: float
    value: float
    realized_pnl: float

    class Config:
        from_attributes = True


class PositionOut(BaseModel):
    symbol: str
    asset_type: str
    quantity: float
    avg_entry_price: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    stop_loss_pct: float
    take_profit_pct: float

    class Config:
        from_attributes = True


class PortfolioOut(BaseModel):
    cash: float
    positions_value: float
    total_value: float
    starting_capital: float
    total_pnl: float
    total_pnl_pct: float
    positions: list[PositionOut]


class PortfolioSnapshotOut(BaseModel):
    timestamp: dt.datetime
    cash: float
    positions_value: float
    total_value: float

    class Config:
        from_attributes = True


class RiskSettingsOut(BaseModel):
    max_position_pct: float
    default_stop_loss_pct: float
    default_take_profit_pct: float
    autonomous_mode: bool
    approval_threshold_pct: float

    class Config:
        from_attributes = True


class RiskSettingsUpdate(BaseModel):
    max_position_pct: float | None = None
    default_stop_loss_pct: float | None = None
    default_take_profit_pct: float | None = None
    autonomous_mode: bool | None = None
    approval_threshold_pct: float | None = None
