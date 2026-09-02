from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Decision
from app.pipeline import run_pipeline

router = APIRouter(tags=["decisions"])


@router.get("/decisions")
def list_decisions(limit: int = 50, symbol: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Decision).order_by(Decision.timestamp.desc())
    if symbol:
        query = query.filter(Decision.symbol == symbol.upper())
    return query.limit(limit).all()


@router.get("/decisions/{decision_id}")
def get_decision(decision_id: int, db: Session = Depends(get_db)):
    decision = db.query(Decision).filter(Decision.id == decision_id).first()
    if decision is None:
        raise HTTPException(status_code=404, detail="Decision not found")
    return decision


@router.post("/analyze/run")
def trigger_analysis(db: Session = Depends(get_db)):
    results = run_pipeline(db)
    return {"ran_at": "now", "results": results}
