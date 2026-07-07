from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


@dataclass(frozen=True)
class Settings:
    provider: str = os.getenv("STOCK_API_PROVIDER", "akshare").strip().lower()
    host: str = os.getenv("STOCK_API_HOST", "127.0.0.1").strip()
    port: int = int(os.getenv("STOCK_API_PORT", "8787"))
    allow_mock_fallback: bool = os.getenv("STOCK_API_ALLOW_MOCK_FALLBACK", "true").strip().lower() in {"1", "true", "yes"}
    tushare_token: str = os.getenv("TUSHARE_TOKEN", "").strip()
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("STOCK_API_CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",")
        if origin.strip()
    )


settings = Settings()

