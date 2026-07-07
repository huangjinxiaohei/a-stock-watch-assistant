from __future__ import annotations

import math
import time
from collections.abc import Callable
from functools import wraps
from typing import Any, TypeVar

import pandas as pd


T = TypeVar("T")


def ttl_cache(seconds: int) -> Callable[[Callable[..., T]], Callable[..., T]]:
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        state: dict[str, Any] = {"expires_at": 0.0, "value": None}

        @wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> T:
            now = time.time()
            if now >= state["expires_at"]:
                state["value"] = func(*args, **kwargs)
                state["expires_at"] = now + seconds
            return state["value"]

        return wrapper

    return decorator


def clean_number(value: Any, default: float = 0.0) -> float:
    if value is None:
        return default
    if isinstance(value, str):
        value = value.replace(",", "").replace("%", "").replace("--", "").strip()
        if not value:
            return default
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    if math.isnan(number) or math.isinf(number):
        return default
    return number


def first_value(row: pd.Series, names: list[str], default: Any = None) -> Any:
    for name in names:
        if name in row and pd.notna(row[name]):
            return row[name]
    return default


def df_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    if df is None or df.empty:
        return []
    return df.where(pd.notnull(df), None).to_dict(orient="records")


def moving_average(values: list[float], index: int, period: int) -> float:
    start = max(0, index - period + 1)
    chunk = values[start : index + 1]
    return round(sum(chunk) / len(chunk), 2) if chunk else 0.0
