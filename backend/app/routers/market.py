from fastapi import APIRouter, HTTPException

from app.config import WATCHLIST
from app.modules import technical

router = APIRouter(prefix="/market", tags=["market"])


@router.get("/watchlist")
def get_watchlist():
    return [
        {"symbol": a.symbol, "name": a.name, "asset_type": a.asset_type}
        for a in WATCHLIST
    ]


@router.get("/{symbol}")
def get_market_data(symbol: str):
    asset = next((a for a in WATCHLIST if a.symbol == symbol.upper()), None)
    if asset is None:
        raise HTTPException(status_code=404, detail="Unknown symbol")
    return technical.analyze(asset.symbol, asset.asset_type, asset.source_id)
