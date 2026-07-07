from __future__ import annotations

import json
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class CacheEntry:
    value: Any
    updated_at: float

    @property
    def age_seconds(self) -> int:
        return max(0, int(time.time() - self.updated_at))


class PersistentCache:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def get(self, key: str, max_age_seconds: int | None = None) -> CacheEntry | None:
        with sqlite3.connect(self.path) as connection:
            row = connection.execute(
                "select value, updated_at from api_cache where cache_key = ?",
                (key,),
            ).fetchone()

        if row is None:
            return None

        entry = CacheEntry(value=json.loads(row[0]), updated_at=float(row[1]))
        if max_age_seconds is not None and entry.age_seconds > max_age_seconds:
            return None
        return entry

    def get_stale(self, key: str) -> CacheEntry | None:
        return self.get(key, None)

    def set(self, key: str, value: Any) -> None:
        payload = json.dumps(value, ensure_ascii=False, separators=(",", ":"))
        with sqlite3.connect(self.path) as connection:
            connection.execute(
                """
                insert into api_cache(cache_key, value, updated_at)
                values (?, ?, ?)
                on conflict(cache_key) do update set
                    value = excluded.value,
                    updated_at = excluded.updated_at
                """,
                (key, payload, time.time()),
            )
            connection.commit()

    def _init_db(self) -> None:
        with sqlite3.connect(self.path) as connection:
            connection.execute(
                """
                create table if not exists api_cache(
                    cache_key text primary key,
                    value text not null,
                    updated_at real not null
                )
                """
            )
            connection.commit()