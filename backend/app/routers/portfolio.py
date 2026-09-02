from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.config import WATCHLIST
from app.database import get_db
from app.models import PortfolioSnapshot
from app.modules import portfolio as portfolio_module
from app.modules import technical

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


def _current_prices() -> dict[str, float]:
    prices = {}
    for asset in WATCHLIST:
        prices[asset.symbol] = technical.analyze(asset.symbol, asset.asset_type, asset.source_id)["last_price"]
    return prices


@router.get("")
def get_portfolio(db: Session = Depends(get_db)):
    return portfolio_module.portfolio_state(db, _current_prices())


@router.get("/history")
def get_history(limit: int = 200, db: Session = Depends(get_db)):
    rows = (
        db.query(PortfolioSnapshot)
        .order_by(PortfolioSnapshot.timestamp.asc())
        .limit(limit)
        .all()
    )
    return rows
