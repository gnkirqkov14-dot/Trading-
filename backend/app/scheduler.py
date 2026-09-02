import datetime as dt

from apscheduler.schedulers.background import BackgroundScheduler

from app.config import settings
from app.database import SessionLocal
from app.pipeline import run_pipeline

_scheduler: BackgroundScheduler | None = None


def _scheduled_run():
    db = SessionLocal()
    try:
        run_pipeline(db)
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    global _scheduler
    if _scheduler is not None:
        return _scheduler
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _scheduled_run,
        "interval",
        minutes=settings.analysis_interval_minutes,
        id="analysis_pipeline",
        next_run_time=dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=15),
    )
    _scheduler.start()
    return _scheduler


def get_scheduler() -> BackgroundScheduler | None:
    return _scheduler
