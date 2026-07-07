from __future__ import annotations

import json
import urllib.request
from typing import Any


class TushareClient:
    def __init__(self, token: str) -> None:
        self.token = token

    @property
    def enabled(self) -> bool:
        return bool(self.token)

    def query(self, api_name: str, params: dict[str, Any] | None = None, fields: str = "") -> list[dict[str, Any]]:
        if not self.enabled:
            return []

        payload = json.dumps(
            {
                "api_name": api_name,
                "token": self.token,
                "params": params or {},
                "fields": fields,
            }
        ).encode("utf-8")
        request = urllib.request.Request(
            "http://api.tushare.pro",
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=15) as response:
            result = json.loads(response.read().decode("utf-8"))

        if result.get("code") != 0:
            raise RuntimeError(result.get("msg") or f"Tushare request failed: {api_name}")

        data = result.get("data") or {}
        fields_list = data.get("fields") or []
        items = data.get("items") or []
        return [dict(zip(fields_list, item, strict=False)) for item in items]
