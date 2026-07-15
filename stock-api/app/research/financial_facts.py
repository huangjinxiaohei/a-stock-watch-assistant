from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any


METRIC_FIELDS = (
    ("revenueGrowth", "%"),
    ("netProfitGrowth", "%"),
    ("grossMargin", "%"),
    ("roe", "%"),
    ("debtRatio", "%"),
    ("eps", "元/股"),
)
LIMITATIONS = [
    "仅基于最新一期结构化财务指标快照。",
    "不支持环比或多期趋势判断。",
    "暂无扣非净利润和经营现金流字段。",
    "暂无费用率和一次性因素字段。",
    "不能确认具体经营原因。",
]
NEEDS_FOLLOW_UP = [
    "结合正式财报原文复核数据日期和指标口径。",
    "补充多期财务数据后再观察趋势变化。",
    "补充扣非净利润、经营现金流、费用率和一次性因素后再分析原因。",
]


def build_financial_explanation(finance: dict[str, Any] | None, source_status: dict[str, Any] | None = None) -> dict[str, Any]:
    source = finance if isinstance(finance, dict) else {}
    status = source_status if isinstance(source_status, dict) else {}
    metrics = {field: _metric(source.get(field), unit) for field, unit in METRIC_FIELDS}
    degraded = _is_degraded_status(status)
    source_available = source.get("available") is not False
    any_metric = any(item["available"] for item in metrics.values())
    all_metrics = all(item["available"] for item in metrics.values())

    if not source_available or not any_metric:
        state = "missing"
    elif degraded or not all_metrics:
        state = "partial"
    else:
        state = "available"

    revenue = metrics["revenueGrowth"]["value"] if metrics["revenueGrowth"]["available"] else None
    profit = metrics["netProfitGrowth"]["value"] if metrics["netProfitGrowth"]["available"] else None
    if state == "missing":
        change_pattern = "数据不足以判断"
    else:
        change_pattern = _change_pattern(revenue, profit)

    as_of_date = _clean_date(source.get("asOfDate"))
    source_name = _clean_text(source.get("source")) or "暂不可用"
    confirmed_facts = _confirmed_facts(metrics, as_of_date, source_name)
    data_status = _data_status(state, status, source.get("warning"))

    return {
        "status": state,
        "asOfDate": as_of_date,
        "sourceName": source_name,
        "revenueGrowth": metrics["revenueGrowth"],
        "netProfitGrowth": metrics["netProfitGrowth"],
        "grossMargin": metrics["grossMargin"],
        "roe": metrics["roe"],
        "debtRatio": metrics["debtRatio"],
        "eps": metrics["eps"],
        "changePattern": change_pattern,
        "summary": _summary(change_pattern, state),
        "confirmedFacts": confirmed_facts,
        "limitations": LIMITATIONS,
        "needsFollowUp": NEEDS_FOLLOW_UP,
        "dataStatus": data_status,
    }


def _metric(value: object, unit: str) -> dict[str, Any]:
    number = _to_number(value)
    return {"value": number, "unit": unit, "available": number is not None}


def _to_number(value: object) -> float | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, str):
        clean = value.replace(",", "").replace("%", "").replace("--", "").strip()
        if not clean:
            return None
        value = clean
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number) or math.isinf(number):
        return None
    return round(number, 4)


def _change_pattern(revenue_growth: float | None, net_profit_growth: float | None) -> str:
    if revenue_growth is None or net_profit_growth is None:
        return "数据不足以判断"
    if revenue_growth > 0 and net_profit_growth > 0:
        return "同向增长"
    if revenue_growth < 0 and net_profit_growth < 0:
        return "同向下降"
    if (revenue_growth > 0 and net_profit_growth < 0) or (revenue_growth < 0 and net_profit_growth > 0):
        return "收入与盈利表现分化"
    return "数据不足以判断"


def _clean_date(value: object) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d", "%Y-%m", "%Y/%m"):
        try:
            parsed = datetime.strptime(text[: len(datetime.now().strftime(fmt))], fmt)
        except ValueError:
            continue
        if parsed.date() > datetime.now(timezone.utc).date():
            return None
        return parsed.strftime("%Y-%m-%d") if "%d" in fmt else parsed.strftime("%Y-%m")
    return None


def _clean_text(value: object) -> str:
    return str(value or "").strip()[:120]


def _is_degraded_status(status: dict[str, Any]) -> bool:
    provider = str(status.get("provider") or "").lower()
    mode = str(status.get("mode") or "").lower()
    return provider in {"mock", "fallback"} or mode in {"fallback", "stale", "stale_refreshing"}


def _confirmed_facts(metrics: dict[str, dict[str, Any]], as_of_date: str | None, source_name: str) -> list[str]:
    facts = []
    if as_of_date:
        facts.append(f"数据日期：{as_of_date}。")
    facts.append(f"数据来源：{source_name}。")
    labels = {
        "revenueGrowth": "营业收入增长率",
        "netProfitGrowth": "净利润增长率",
        "grossMargin": "毛利率",
        "roe": "ROE",
        "debtRatio": "资产负债率",
        "eps": "EPS",
    }
    for key, label in labels.items():
        metric = metrics[key]
        if metric["available"]:
            facts.append(f"{label}为 {metric['value']}{metric['unit']}。")
    return facts


def _summary(change_pattern: str, state: str) -> str:
    if state == "missing":
        return "业绩变化概览：当前结构化财务指标不足，需补充正式财报数据后复核。"
    return f"业绩变化概览：收入增长率与净利润增长率呈现{change_pattern}，该判断仅基于最新一期结构化财务字段。"


def _data_status(state: str, status: dict[str, Any], warning: object) -> dict[str, Any]:
    return {
        "state": state,
        "provider": str(status.get("provider") or ""),
        "sourceProvider": str(status.get("sourceProvider") or ""),
        "mode": str(status.get("mode") or ""),
        "warning": _clean_text(warning) or None,
    }
