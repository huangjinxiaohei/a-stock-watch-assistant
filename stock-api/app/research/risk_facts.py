from __future__ import annotations

from typing import Any


SEVERITIES = ("high_attention", "medium_attention", "general_attention")
DEGRADED_MODES = {"fallback", "stale", "stale_refreshing"}
DEGRADED_PROVIDERS = {"mock", "fallback"}


def build_risk_overview(facts: dict[str, Any]) -> dict[str, Any]:
    risk_items: list[dict[str, Any]] = []
    watch_items: list[dict[str, Any]] = []
    limitations: list[str] = []

    core_status = facts.get("coreStatus") if isinstance(facts.get("coreStatus"), dict) else {}
    core_issue = _core_data_item(core_status)
    if core_issue is not None:
        risk_items.append(core_issue)
        watch_items.append(_watch_item("watch_core_data", "核心行情与K线数据状态", "核心数据状态存在缺失、兜底或时效性限制，后续需核对最新行情与日K数据。", "quote、kline 与报告数据状态", "最新行情和K线数据"))
        limitations.append("核心行情或K线数据当前存在待复核状态，清单不对其作确定性判断。")

    financial = facts.get("financialExplanation")
    financial_item, financial_watch, financial_limitations = _financial_items(financial)
    if financial_item is not None:
        risk_items.append(financial_item)
    if financial_watch is not None:
        watch_items.append(financial_watch)
    limitations.extend(financial_limitations)

    for event in facts.get("majorEvents") or []:
        if not isinstance(event, dict):
            continue
        event_item = _event_risk_item(event)
        if event_item is not None:
            risk_items.append(event_item)
            watch_items.append(_watch_item(f"watch_event_{event.get('eventId') or len(watch_items)}", "重大事件或治理信息", "该事件线索仍需结合原始公告、交易所或监管披露确认进展。", "majorEvents", "公司公告、交易所或监管机构公开披露"))

    technical_item, technical_watch = _technical_items(facts.get("klineSummary"), core_status.get("kline"))
    if technical_item is not None:
        risk_items.append(technical_item)
    if technical_watch is not None:
        watch_items.append(technical_watch)

    missing_fields = [str(item) for item in facts.get("missingFields") or [] if str(item).strip()]
    if missing_fields:
        limitations.append(f"当前事实包存在数据缺失：{'、'.join(missing_fields[:6])}。")
        watch_items.append(_watch_item("watch_missing_fields", "缺失字段与数据时效", "缺失字段和数据状态会影响当前清单的完整性，需在数据补齐后复核。", "missingFields、dataStatus、warnings", "后续公开行情、财报和公告资料"))

    warnings = [str(item) for item in facts.get("warnings") or [] if str(item).strip()]
    if warnings and not missing_fields:
        limitations.append("当前事实包包含数据状态提示，相关内容需结合来源状态继续复核。")

    risk_items = _dedupe_items(risk_items, "id")[:5]
    watch_items = _dedupe_items(watch_items, "id")[:5]
    limitations = _dedupe_texts(limitations)[:5]
    degraded = _has_degraded_data(facts)
    status = "missing" if not risk_items and not watch_items and not limitations else "partial" if degraded else "available"
    if not risk_items and not watch_items:
        summary = "当前可用事实未形成可靠的风险与观察线索，需结合公司公告、定期报告及最新市场数据继续复核。"
    elif degraded:
        summary = "当前清单包含数据限制或待复核事项，仅用于整理已返回事实，不构成风险评级或投资建议。"
    else:
        summary = "当前清单基于已返回事实整理风险线索和后续复核范围，不构成风险评级或投资建议。"

    return {"status": status, "summary": summary, "riskItems": risk_items, "watchItems": watch_items, "limitations": limitations, "dataStatus": {"state": status, "hasDegradedData": degraded, "missingFields": missing_fields[:6]}}


def _core_data_item(core_status: dict[str, Any]) -> dict[str, Any] | None:
    issues: list[str] = []
    for label in ("quote", "kline"):
        status = core_status.get(label)
        if not isinstance(status, dict):
            issues.append(f"{label} 状态未返回")
            continue
        mode = str(status.get("mode") or "")
        provider = str(status.get("provider") or "")
        if provider in DEGRADED_PROVIDERS or mode in DEGRADED_MODES or status.get("warning"):
            issues.append(f"{label} 状态为 {mode or provider or '待复核'}")
    if not issues:
        return None
    return _risk_item("core_data_quality", "核心数据质量风险", "核心行情或K线数据状态待复核", f"quote/K线状态：{'；'.join(issues)}。", "coreStatus", "medium_attention", "needs_follow_up", ["核对最新行情、交易日和日K收盘数据。"], {"state": "partial", "source": "coreStatus"})


def _financial_items(value: Any) -> tuple[dict[str, Any] | None, dict[str, Any] | None, list[str]]:
    if not isinstance(value, dict):
        return None, _watch_item("watch_finance", "财务指标完整性", "当前未返回业绩变化概览，无法确认财务维度风险。", "financialExplanation", "公司定期报告"), ["财务变化概览未返回，当前无法判断财务维度风险。"]
    status = str(value.get("status") or "missing")
    pattern = str(value.get("changePattern") or "")
    limitations = [str(item) for item in value.get("limitations") or [] if str(item).strip()]
    if status == "missing":
        return None, _watch_item("watch_finance", "财务指标完整性", "当前财务字段不足，无法确认业绩变化相关风险。", "financialExplanation", "公司定期报告"), limitations or ["财务指标当前不可用，具体经营原因无法确认。"]
    if pattern == "收入与盈利表现分化":
        item = _risk_item("financial_change_divergence", "业绩与财务风险", "营收与净利润变化方向出现分化", str(value.get("summary") or "结构化财务指标显示营收与净利润变化方向分化。"), "financialExplanation", "medium_attention", "confirmed" if status == "available" else "needs_follow_up", ["核对正式财报、扣非净利润和经营现金流数据。"], {"state": "available" if status == "available" else "partial", "source": "financialExplanation"})
        watch = _watch_item("watch_finance", "盈利质量与数据口径", "收入与盈利指标方向分化，需补充财报字段核对变化范围。", "revenueGrowth、netProfitGrowth、financialExplanation", "公司定期报告、业绩预告或说明会")
        return item, watch, limitations
    if status == "partial":
        return None, _watch_item("watch_finance", "财务指标完整性", "部分财务字段待复核，当前不扩展经营原因判断。", "financialExplanation.dataStatus、limitations", "公司定期报告"), limitations or ["部分财务指标不可用，当前不扩展经营原因判断。"]
    return None, None, limitations


def _event_risk_item(event: dict[str, Any]) -> dict[str, Any] | None:
    event_type = str(event.get("eventType") or "")
    if event_type not in {"legal", "regulatory", "governance", "capital_operation", "operations"}:
        return None
    status = str(event.get("status") or "needs_follow_up")
    event_data = event.get("dataStatus") if isinstance(event.get("dataStatus"), dict) else {}
    degraded = _is_degraded_status(event_data) or status == "needs_follow_up"
    follow_up = [str(item) for item in event.get("needsFollowUp") or [] if str(item).strip()]
    follow_up.append("核对原始公告或监管披露的最新进展。")
    return _risk_item(f"event_{event.get('eventId') or event_type}", "重大事件或治理风险", "重大事件线索需要继续核实", str(event.get("summary") or event.get("title") or "已识别事件线索，但事实摘要暂不可用。"), "majorEvents", "medium_attention" if event_type in {"legal", "regulatory"} else "general_attention", "needs_follow_up" if degraded else "confirmed", follow_up, {"state": "partial" if degraded else "available", "eventType": event_type})


def _technical_items(summary: Any, status: Any) -> tuple[dict[str, Any] | None, dict[str, Any] | None]:
    if not isinstance(summary, dict) or not summary.get("available"):
        return None, _watch_item("watch_technical", "技术数据完整性", "K线或成交量数据不足，技术状态暂无法确认。", "klineSummary、coreStatus.kline", "后续公开行情和K线数据")
    degraded = _is_degraded_status(status if isinstance(status, dict) else {})
    evidence: list[str] = []
    if summary.get("aboveMa20") is False:
        evidence.append("收盘价低于 MA20")
    if summary.get("volumeState") == "thin":
        evidence.append("成交量低于近20日均量")
    if not evidence:
        return None, None
    item = _risk_item("technical_state_observation", "技术状态异常", "部分历史技术状态需要继续观察", "；".join(evidence) + "，仅作为历史数据位置记录。", "klineSummary", "general_attention", "needs_follow_up" if degraded else "confirmed", ["结合后续公开K线和成交量数据复核状态变化。"], {"state": "partial" if degraded else "available", "source": "klineSummary"})
    return item, _watch_item("watch_technical", "技术状态变化", "当前技术数据仅反映已返回历史区间，需观察后续公开K线和成交量更新。", "klineSummary", "后续公开行情和K线数据")


def _risk_item(item_id: str, category: str, title: str, evidence: str, source_type: str, severity: str, status: str, follow_up: list[str], data_status: dict[str, Any]) -> dict[str, Any]:
    return {"id": item_id, "category": category, "title": title, "evidence": evidence, "sourceType": source_type, "severity": severity if severity in SEVERITIES else "general_attention", "status": status, "dataStatus": data_status, "needsFollowUp": _dedupe_texts(follow_up)}


def _watch_item(item_id: str, title: str, reason: str, related_data: str, follow_up_source: str) -> dict[str, Any]:
    return {"id": item_id, "title": title, "reason": reason, "relatedData": related_data, "followUpSource": follow_up_source}


def _dedupe_items(items: list[dict[str, Any]], key: str) -> list[dict[str, Any]]:
    seen: set[str] = set()
    result: list[dict[str, Any]] = []
    for item in items:
        item_key = str(item.get(key) or "")
        if not item_key or item_key in seen:
            continue
        seen.add(item_key)
        result.append(item)
    return result


def _dedupe_texts(items: list[str]) -> list[str]:
    result: list[str] = []
    for item in items:
        text = str(item).strip()
        if text and text not in result:
            result.append(text)
    return result


def _has_degraded_data(facts: dict[str, Any]) -> bool:
    statuses = facts.get("coreStatus") if isinstance(facts.get("coreStatus"), dict) else {}
    if any(isinstance(value, dict) and _is_degraded_status(value) for value in statuses.values()):
        return True
    financial = facts.get("financialExplanation")
    if isinstance(financial, dict) and str(financial.get("status") or "") in {"partial", "missing", "unavailable"}:
        return True
    return bool(facts.get("missingFields"))


def _is_degraded_status(status: dict[str, Any]) -> bool:
    return str(status.get("provider") or "").lower() in DEGRADED_PROVIDERS or str(status.get("mode") or "").lower() in DEGRADED_MODES or bool(status.get("warning"))
