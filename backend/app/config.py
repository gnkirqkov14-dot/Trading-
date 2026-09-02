from pydantic_settings import BaseSettings, SettingsConfigDict


class WatchlistAsset:
    def __init__(self, symbol: str, name: str, asset_type: str, source_id: str):
        self.symbol = symbol
        self.name = name
        self.asset_type = asset_type  # "crypto" | "etf"
        self.source_id = source_id  # CoinGecko id for crypto, Stooq ticker for etf


WATCHLIST: list[WatchlistAsset] = [
    WatchlistAsset("BTC", "Bitcoin", "crypto", "bitcoin"),
    WatchlistAsset("ETH", "Ethereum", "crypto", "ethereum"),
    WatchlistAsset("SOL", "Solana", "crypto", "solana"),
    WatchlistAsset("SPY", "SPDR S&P 500 ETF", "etf", "spy.us"),
    WatchlistAsset("QQQ", "Invesco QQQ (Nasdaq-100)", "etf", "qqq.us"),
]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5"

    coingecko_api_key: str = ""

    news_api_key: str = ""
    news_api_base: str = "https://gnews.io/api/v4"

    statements_api_key: str = ""

    database_url: str = "sqlite:///./trading_demo.db"

    starting_capital: float = 100_000.0
    max_position_pct: float = 0.15
    default_stop_loss_pct: float = 0.08
    default_take_profit_pct: float = 0.20

    autonomous_mode: bool = True
    approval_threshold_pct: float = 0.10

    analysis_interval_minutes: int = 240


settings = Settings()
