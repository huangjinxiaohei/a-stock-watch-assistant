from __future__ import annotations

from typing import Any


MAX_NEWS_ITEMS = 3
MAX_MAJOR_EVENTS = 3
MAX_RISK_ITEMS = 3
MAX_WATCH_ITEMS = 3
MAX_TEXT_LENGTH = 180


def build_llm_fact_package(facts: dict[str, Any]) -> dict[str, Any]:
    """Keep only display-relevant, already-normalized facts for manual AI mode."""

    financial = facts.get("financialExplanation") if isinstance(facts.get("financialExplanation"), dict) else {}
    risk = facts.get("riskOverview") if isinstance(facts.get("riskOverview"), dict) else {}
    compact = {
        "symbol": facts.get("symbol"),
        "name": facts.get("name"),
        "quote": _pick(facts.get("quote"), ("latestPrice", "changePercent", "amount", "turnoverRate", "pe", "pb")),
        "klineSummary": _pick(
            facts.get("klineSummary"),
            ("available", "latestDate", "previousChangePct", "recentChangePct20", "aboveMa20", "volumeRatio20", "volumeState", "priceText", "maText", "volumeText"),
        ),
        "newsClues": [_news_item(item) for item in _items(facts.get("news"), MAX_NEWS_ITEMS)],
        "majorEventClues": [_event_item(item) for item in _items(facts.get("majorEvents"), MAX_MAJOR_EVENTS)],
        "financialFacts": _financial_item(financial),
        "riskFacts": _risk_item(risk),
        "dataQuality": {
            "statuses": [_status_item(item) for item in _items(facts.get("dataStatus"), 6)],
            "missingFields": _strings(facts.get("missingFields"), 6),
            "warnings": _strings(facts.get("warnings"), 3),
        },
    }
    return _prune(compact)


def _pick(value: object, keys: tuple[str, ...]) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    return {key: value.get(key) for key in keys if value.get(key) not in (None, "", [], {})}


def _items(value: object, limit: int) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)][:limit]


def _strings(value: object, limit: int) -> list[str]:
    if not isinstance(value, list):
        return []
    return [_text(item) for item in value if _text(item)][:limit]


def _news_item(item: dict[str, Any]) -> dict[str, Any]:
    return _prune({"publishedAt": item.get("publishedAt"), "source": item.get("source"), "title": _text(item.get("title")), "summary": _text(item.get("summary"))})


def _event_item(item: dict[str, Any]) -> dict[str, Any]:
    return _prune(
        {
            "eventType": item.get("eventType"),
            "publishedAt": item.get("publishedAt"),
            "sourceName": item.get("sourceName"),
            "status": item.get("status"),
            "title": _text(item.get("title")),
            "summary": _text(item.get("summary")),
            "needsFollowUp": _strings(item.get("needsFollowUp"), 2),
        }
    )


def _financial_item(item: dict[str, Any]) -> dict[str, Any]:
    return _prune(
        {
            "status": item.get("status"),
            "asOfDate": item.get("asOfDate"),
            "sourceName": item.get("sourceName"),
            "changePattern": item.get("changePattern"),
            "summary": _text(item.get("summary")),
            "confirmedFacts": _strings(item.get("confirmedFacts"), 3),
            "limitations": _strings(item.get("limitations"), 3),
            "needsFollowUp": _strings(item.get("needsFollowUp"), 3),
        }
    )


def _risk_item(item: dict[str, Any]) -> dict[str, Any]:
    return _prune(
        {
            "status": item.get("status"),
            "summary": _text(item.get("summary")),
            "riskItems": [
                _prune({"category": value.get("category"), "title": _text(value.get("title")), "evidence": _text(value.get("evidence")), "severity": value.get("severity"), "status": value.get("status")})
                for value in _items(item.get("riskItems"), MAX_RISK_ITEMS)
            ],
            "watchItems": [
                _prune({"title": _text(value.get("title")), "reason": _text(value.get("reason")), "followUpSource": value.get("followUpSource")})
                for value in _items(item.get("watchItems"), MAX_WATCH_ITEMS)
            ],
            "limitations": _strings(item.get("limitations"), 3),
        }
    )


def _status_item(item: dict[str, Any]) -> dict[str, Any]:
    return _prune({"label": item.get("label"), "state": item.get("state"), "detail": _text(item.get("detail")), "warning": _text(item.get("warning"))})


def _text(value: object) -> str:
    return str(value or "").strip()[:MAX_TEXT_LENGTH]


def _prune(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _prune(item) for key, item in value.items() if item not in (None, "", [], {})}
    if isinstance(value, list):
        return [_prune(item) for item in value if item not in (None, "", [], {})]
    return value
