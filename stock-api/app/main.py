from __future__ import annotations

from collections.abc import Callable
from concurrent.futures import Future, ThreadPoolExecutor, TimeoutError
from pathlib import Path
from threading import RLock
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.cache import CacheEntry, PersistentCache
from app.config import settings
from app.providers.akshare_provider import AkShareProvider
from app.providers.mock_provider import MockProvider


app = FastAPI(title="A-share Stock API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

mock_provider = MockProvider()
provider = mock_provider if settings.provider == "mock" else AkShareProvider()
cache = PersistentCache(Path(__file__).resolve().parents[1] / "data" / "stock_cache.sqlite3")
refresh_executor = ThreadPoolExecutor(max_workers=2)
refresh_lock = RLock()
refresh_tasks: dict[str, Future[Any]] = {}


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "provider": settings.provider,
        "mockFallback": settings.allow_mock_fallback,
        "basicDataProvider": "free: 东方财富 push2delay/push2 快照 + AkShare/Sina 兜底 + 百度估值 + 历史行情",
        "cache": "sqlite",
    }


@app.get("/api/healthz")
def healthz() -> dict[str, Any]:
    return {"ok": True}


@app.get("/api/stocks/search")
def search_stocks(keyword: str = "") -> dict[str, Any]:
    key = f"search:{keyword.strip().lower()}"
    return _cached_run(
        key,
        1800,
        lambda active: active.search_stocks(keyword),
        lambda fallback: fallback.search_stocks(keyword),
        collection_key="items",
    )


@app.get("/api/market/overview")
def market_overview() -> dict[str, Any]:
    return _cached_run(
        "market:overview",
        600,
        lambda active: active.market_overview(),
        lambda fallback: fallback.market_overview(),
    )


@app.get("/api/stocks/{symbol}/quote")
def stock_quote(symbol: str) -> dict[str, Any]:
    normalized = symbol.strip().upper()
    return _cached_run(
        f"stock:{normalized}:quote",
        60,
        lambda active: active.quote(symbol),
        lambda fallback: fallback.stock_detail(symbol)["quote"],
    )


@app.get("/api/stocks/{symbol}")
def stock_detail(symbol: str) -> dict[str, Any]:
    normalized = symbol.strip().upper()
    return _cached_run(
        f"stock:{normalized}:detail",
        120,
        lambda active: active.stock_detail(symbol),
        lambda fallback: fallback.stock_detail(symbol),
    )


@app.get("/api/stocks/{symbol}/intraday")
def stock_intraday(symbol: str) -> dict[str, Any]:
    normalized = symbol.strip().upper()
    return _cached_run(
        f"stock:{normalized}:intraday",
        60,
        lambda active: active.intraday(symbol),
        lambda fallback: fallback.intraday(symbol),
        collection_key="items",
    )


@app.get("/api/stocks/{symbol}/kline")
def stock_kline(symbol: str) -> dict[str, Any]:
    normalized = symbol.strip().upper()
    return _cached_run(
        f"stock:{normalized}:kline",
        24 * 60 * 60,
        lambda active: active.kline(symbol),
        lambda fallback: fallback.kline(symbol),
        collection_key="items",
    )

def _cached_run(
    cache_key: str,
    ttl_seconds: int,
    primary: Callable[[Any], Any],
    fallback: Callable[[MockProvider], Any],
    attach_status: bool = True,
    collection_key: str | None = None,
    initial_wait_seconds: float = 3,
) -> Any:
    fresh = cache.get(cache_key, ttl_seconds)
    if fresh is not None:
        return _with_status(fresh.value, "cache", "fresh", fresh, None, attach_status, collection_key)

    stale = cache.get_stale(cache_key)
    if stale is not None:
        _ensure_refresh(cache_key, primary)
        return _with_status(
            stale.value,
            "cache",
            "stale_refreshing",
            stale,
            "实时刷新较慢，已先返回旧缓存并在后台刷新。",
            attach_status,
            collection_key,
        )

    future = _ensure_refresh(cache_key, primary)
    try:
        data = future.result(timeout=initial_wait_seconds)
        return _with_status(data, settings.provider, "live", None, None, attach_status, collection_key)
    except TimeoutError:
        warning = "实时源响应超时，后台刷新中；当前返回兜底数据。"
        if settings.allow_mock_fallback and provider is not mock_provider:
            data = fallback(mock_provider)
            return _with_status(data, "mock", "fallback", None, warning, attach_status, collection_key)
        raise HTTPException(status_code=504, detail=warning)
    except Exception as error:
        if settings.allow_mock_fallback and provider is not mock_provider:
            data = fallback(mock_provider)
            return _with_status(data, "mock", "fallback", None, str(error), attach_status, collection_key)

        raise HTTPException(status_code=502, detail=str(error)) from error


def _ensure_refresh(cache_key: str, primary: Callable[[Any], Any]) -> Future[Any]:
    with refresh_lock:
        active = refresh_tasks.get(cache_key)
        if active is not None and not active.done():
            return active

        future = refresh_executor.submit(_refresh_cache, cache_key, primary)
        refresh_tasks[cache_key] = future
        future.add_done_callback(lambda _: _clear_refresh(cache_key, future))
        return future


def _refresh_cache(cache_key: str, primary: Callable[[Any], Any]) -> Any:
    data = primary(provider)
    cache.set(cache_key, data)
    return data


def _clear_refresh(cache_key: str, future: Future[Any]) -> None:
    with refresh_lock:
        if refresh_tasks.get(cache_key) is future:
            refresh_tasks.pop(cache_key, None)


def _with_status(
    data: Any,
    provider_name: str,
    mode: str,
    entry: CacheEntry | None,
    warning: str | None,
    attach_status: bool,
    collection_key: str | None = None,
) -> Any:
    if not attach_status:
        return data

    if isinstance(data, dict):
        result = dict(data)
    elif collection_key:
        result = {collection_key: data}
    else:
        return data
    source_provider = settings.provider if provider_name == "cache" else provider_name
    status: dict[str, Any] = {
        "provider": provider_name,
        "sourceProvider": source_provider,
        "mode": mode,
        "cacheAgeSeconds": entry.age_seconds if entry else 0,
        "updatedAt": entry.updated_at if entry else None,
    }
    if warning:
        status["warning"] = warning
    coverage_note = _coverage_note(result)
    if coverage_note:
        status["coverageNote"] = coverage_note
    result["_dataStatus"] = status
    return result

def _coverage_note(data: dict[str, Any]) -> str | None:
    quotes = []
    if "quote" in data and isinstance(data["quote"], dict):
        quotes.append(data["quote"])
    for key in ("gainers", "losers"):
        if isinstance(data.get(key), list):
            quotes.extend(item for item in data[key] if isinstance(item, dict))

    if not quotes:
        return None

    missing = set()
    if any(float(item.get("turnoverRate") or 0) <= 0 for item in quotes):
        missing.add("换手率")
    if any(float(item.get("pe") or 0) == 0 or float(item.get("pb") or 0) == 0 for item in quotes):
        missing.add("PE/PB")
    if any(float(item.get("totalMarketCap") or 0) <= 0 for item in quotes):
        missing.add("市值")

    if not missing:
        return None
    return "、".join(sorted(missing)) + "字段在当前备用数据源中不可得，已显示为暂无；可通过免费东方财富快照、百度估值或历史行情源补齐；若对应免费接口被网络代理拦截则显示为暂无。"
