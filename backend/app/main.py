from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, SessionLocal, engine
from app.modules import risk
from app.routers import decisions, market, portfolio, settings as settings_router
from app.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        risk.get_or_create_settings(db)
    finally:
        db.close()
    start_scheduler()
    yield


app = FastAPI(
    title="Autonomous Crypto+ETF Trading Agent (Demo)",
    description="Paper-trading demo of an autonomous AI trading agent. No real money is involved.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolio.router)
app.include_router(decisions.router)
app.include_router(settings_router.router)
app.include_router(market.router)


@app.get("/")
def root():
    return {
        "name": "Autonomous Crypto+ETF Trading Agent (Demo)",
        "mode": "paper_trading",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "ok"}
