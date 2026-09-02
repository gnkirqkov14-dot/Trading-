"""Risk settings module.

Single-row settings table holding the knobs the brief asks for: max position
size, default stop-loss/take-profit, and the future "approval mode" switch
(`autonomous_mode` + `approval_threshold_pct`). In this demo
`autonomous_mode` defaults to True, so `decision_engine.synthesize_decision`
never sets `requires_approval`; flipping it to False later needs no code
change — `synthesize_decision` and `portfolio.execute_decision` already
branch on it (see docs/ARCHITECTURE.md, "Approval mode").
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.config import settings
from app.models import RiskSettings


def get_or_create_settings(db: Session) -> RiskSettings:
    row = db.query(RiskSettings).first()
    if row is None:
        row = RiskSettings(
            max_position_pct=settings.max_position_pct,
            default_stop_loss_pct=settings.default_stop_loss_pct,
            default_take_profit_pct=settings.default_take_profit_pct,
            autonomous_mode=settings.autonomous_mode,
            approval_threshold_pct=settings.approval_threshold_pct,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def as_dict(row: RiskSettings) -> dict:
    return {
        "max_position_pct": row.max_position_pct,
        "default_stop_loss_pct": row.default_stop_loss_pct,
        "default_take_profit_pct": row.default_take_profit_pct,
        "autonomous_mode": row.autonomous_mode,
        "approval_threshold_pct": row.approval_threshold_pct,
    }
