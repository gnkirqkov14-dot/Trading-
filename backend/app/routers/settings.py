from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.modules import risk
from app.schemas import RiskSettingsUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/risk")
def get_risk_settings(db: Session = Depends(get_db)):
    return risk.get_or_create_settings(db)


@router.put("/risk")
def update_risk_settings(update: RiskSettingsUpdate, db: Session = Depends(get_db)):
    row = risk.get_or_create_settings(db)
    for field, value in update.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row
