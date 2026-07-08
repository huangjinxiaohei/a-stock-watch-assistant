from __future__ import annotations

import os
from dataclasses import dataclass

from dotenv import load_dotenv


load_dotenv()


def _env_str(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None or not value.strip():
        return default
    return value.strip().lower() in {"1", "true", "yes"}


def _env_int(name: str, default: int, minimum: int | None = None) -> int:
    try:
        value = int(os.getenv(name, str(default)).strip())
    except (TypeError, ValueError):
        return default
    if minimum is not None and value < minimum:
        return default
    return value


def _env_float(name: str, default: float, minimum: float | None = None) -> float:
    try:
        value = float(os.getenv(name, str(default)).strip())
    except (TypeError, ValueError):
        return default
    if minimum is not None and value < minimum:
        return default
    return value


@dataclass(frozen=True)
class Settings:
    provider: str = _env_str("STOCK_API_PROVIDER", "akshare").lower()
    host: str = _env_str("STOCK_API_HOST", "127.0.0.1")
    port: int = _env_int("STOCK_API_PORT", 8787, minimum=1)
    allow_mock_fallback: bool = _env_bool("STOCK_API_ALLOW_MOCK_FALLBACK", True)
    tushare_token: str = _env_str("TUSHARE_TOKEN")
    ai_report_enable_llm: bool = _env_bool("AI_REPORT_ENABLE_LLM", False)
    llm_provider: str = _env_str("LLM_PROVIDER", "openai_compatible").lower()
    llm_api_key: str = _env_str("LLM_API_KEY")
    llm_base_url: str = _env_str("LLM_BASE_URL")
    llm_model: str = _env_str("LLM_MODEL")
    llm_timeout_seconds: float = _env_float("LLM_TIMEOUT_SECONDS", 25.0, minimum=1.0)
    llm_max_retries: int = _env_int("LLM_MAX_RETRIES", 1, minimum=0)
    llm_temperature: float = _env_float("LLM_TEMPERATURE", 0.2, minimum=0.0)
    ai_report_max_news_items: int = _env_int("AI_REPORT_MAX_NEWS_ITEMS", 8, minimum=1)
    ai_report_max_kline_items: int = _env_int("AI_REPORT_MAX_KLINE_ITEMS", 60, minimum=1)
    ai_report_compliance_strict: bool = _env_bool("AI_REPORT_COMPLIANCE_STRICT", True)
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in _env_str("STOCK_API_CORS_ORIGINS", "http://127.0.0.1:5173,http://localhost:5173").split(",")
        if origin.strip()
    )


settings = Settings()
