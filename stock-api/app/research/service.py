from __future__ import annotations

import logging
import time
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor, TimeoutError
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.cache import CacheEntry, PersistentCache
from app.config import settings
from app.providers.akshare_provider import AkShareProvider
from app.providers.mock_provider import MockProvider
from app.research.compliance import ComplianceError, assert_llm_text_compliant, assert_report_compliant, sanitize_rule_text
from app.research.llm_client import LlmClient, LlmClientError
from app.research.rule_report import build_rule_report
from app.research.schemas import DISCLAIMER, LlmReportDraft, ReportStatus, ResearchReportRequest, ResearchReportResponse
from app.symbols import normalize_symbol


LOGGER = logging.getLogger(__name__)
REPORT_FETCH_WORKERS = 4
CORE_PRICE_MISMATCH_THRESHOLD = 0.03
CORE_STALE_MAX_SECONDS = 24 * 60 * 60
MARKET_CLOSE_HOUR = 15
MARKET_CLOSE_MINUTE = 0


class CoreDataQualityError(ValueError):
    pass


class ResearchReportService:
    def __init__(self) -> None:
        self.mock_provider = MockProvider()
        self.provider = self.mock_provider if settings.provider == "mock" else AkShareProvider()
        self.cache = PersistentCache(Path(__file__).resolve().parents[2] / "data" / "stock_cache.sqlite3")
        self.llm_client = LlmClient()

    def generate(self, request: ResearchReportRequest) -> ResearchReportResponse:
        started_at = time.perf_counter()
        generated_at = _now_shanghai()
        llm_ready = bool(settings.ai_report_enable_llm and self.llm_client.is_configured)
        facts = self._build_fact_package(request, include_optional=llm_ready)

        if not settings.ai_report_enable_llm:
            rule_started = time.perf_counter()
            response = build_rule_report(
                facts,
                ReportStatus(
                    source="rule",
                    status="success",
                    provider="disabled",
                    model=None,
                    fallbackReason="AI_REPORT_ENABLE_LLM=false",
                ),
                generated_at,
            )
            _log_stage("rule_report", facts.get("symbol"), rule_started, "success")
            return self._finalize(response, started_at)

        if not self.llm_client.is_configured:
            rule_started = time.perf_counter()
            response = build_rule_report(
                facts,
                ReportStatus(
                    source="rule_fallback",
                    status="fallback",
                    provider="unavailable",
                    model=settings.llm_model or None,
                    fallbackReason="LLM configuration incomplete",
                ),
                generated_at,
            )
            _log_stage("rule_report", facts.get("symbol"), rule_started, "success")
            return self._finalize(response, started_at)

        core_issue = _core_data_quality_issue(facts)
        if core_issue is not None:
            rule_started = time.perf_counter()
            response = build_rule_report(
                facts,
                ReportStatus(
                    source="rule_fallback",
                    status="fallback",
                    provider=settings.llm_provider or "openai_compatible",
                    model=settings.llm_model or None,
                    fallbackReason=core_issue,
                ),
                generated_at,
            )
            _log_stage("rule_report", facts.get("symbol"), rule_started, "success")
            return self._finalize(response, started_at)

        llm_started = time.perf_counter()
        try:
            llm_payload = self.llm_client.generate_report(facts)
            draft = LlmReportDraft.model_validate(llm_payload)
            assert_llm_text_compliant(draft.sections, draft.warnings)
            _log_stage("llm", facts.get("symbol"), llm_started, "success")
            response = ResearchReportResponse(
                symbol=facts["symbol"],
                name=facts["name"],
                generatedAt=generated_at,
                reportStatus=ReportStatus(
                    source="llm",
                    status="success",
                    provider=settings.llm_provider or "openai_compatible",
                    model=settings.llm_model or None,
                ),
                dataSources=facts["dataSources"],
                dataStatus=facts["dataStatus"],
                missingFields=facts["missingFields"],
                sections=draft.sections,
                disclaimer=DISCLAIMER,
                warnings=[sanitize_rule_text(item) for item in draft.warnings],
            )
            return self._finalize(response, started_at)
        except (LlmClientError, ValueError, ComplianceError) as error:
            _log_stage("llm", facts.get("symbol"), llm_started, "error")
            rule_started = time.perf_counter()
            response = build_rule_report(
                facts,
                ReportStatus(
                    source="rule_fallback",
                    status="fallback",
                    provider=settings.llm_provider or "openai_compatible",
                    model=settings.llm_model or None,
                    fallbackReason=sanitize_rule_text(str(error)[:240]),
                ),
                generated_at,
                warnings=["LLM 增强报告暂不可用，已返回规则版研究报告。"],
            )
            _log_stage("rule_report", facts.get("symbol"), rule_started, "success")
            return self._finalize(response, started_at)

    def _build_fact_package(self, request: ResearchReportRequest, include_optional: bool = True) -> dict[str, Any]:
        aggregate_started = time.perf_counter()
        symbol_started = time.perf_counter()
        symbol = self._resolve_symbol(request)
        _log_stage("symbol_parse", symbol, symbol_started, "success")
        warnings: list[str] = []
        deadline = aggregate_started + settings.ai_report_aggregation_timeout_seconds
        fetch_specs: dict[str, dict[str, Any]] = {
            "quote": {
                "cache_key": f"stock:{symbol}:quote",
                "ttl_seconds": 60,
                "primary": lambda active: active.quote(symbol),
                "fallback": lambda fallback: fallback.stock_detail(symbol)["quote"],
                "collection_key": None,
            },
            "kline": {
                "cache_key": f"stock:{symbol}:kline",
                "ttl_seconds": 24 * 60 * 60,
                "primary": lambda active: active.kline(symbol),
                "fallback": lambda fallback: fallback.kline(symbol),
                "collection_key": "items",
            },
        }
        if include_optional:
            fetch_specs["detail"] = {
                "cache_key": f"stock:{symbol}:detail",
                "ttl_seconds": 120,
                "primary": lambda active: active.stock_detail(symbol),
                "fallback": lambda fallback: fallback.stock_detail(symbol),
                "collection_key": None,
                "allow_live": False,
            }
            fetch_specs["overview"] = {
                "cache_key": "market:overview",
                "ttl_seconds": 600,
                "primary": lambda active: active.market_overview(),
                "fallback": lambda fallback: fallback.market_overview(),
                "collection_key": None,
                "allow_live": False,
            }
        else:
            _log_stage("detail", symbol, aggregate_started, "skipped", cache_state="not_requested")
            _log_stage("overview", symbol, aggregate_started, "skipped", cache_state="not_requested")

        results = self._fetch_fact_sources(symbol, fetch_specs, warnings, deadline)
        quote = results.get("quote")
        detail = results.get("detail")
        kline = results.get("kline")
        overview = results.get("overview")

        quote_data = _strip_status(quote) if quote else {}
        detail_data = _strip_status(detail) if detail else {}
        kline_items = list((kline or {}).get("items") or [])[-settings.ai_report_max_kline_items :]
        news_items = [
            _neutralize_news_item(item)
            for item in list((detail_data.get("news") or []))[: settings.ai_report_max_news_items]
            if isinstance(item, dict)
        ]
        detail_facts = {
            "quote": detail_data.get("quote") or {},
            "finance": _neutralize_warning_field(detail_data.get("finance")),
            "moneyFlow": _neutralize_warning_field(detail_data.get("moneyFlow")),
            "news": news_items,
        }
        missing_fields = _missing_fields(quote_data, detail_data, kline_items, overview)
        data_status = _build_data_status(quote, detail, kline, overview, missing_fields)

        name = str(quote_data.get("name") or detail_data.get("quote", {}).get("name") or symbol)
        fact_package = {
            "symbol": str(quote_data.get("symbol") or symbol),
            "name": name,
            "quote": quote_data,
            "detail": detail_facts,
            "finance": detail_facts["finance"],
            "moneyFlow": detail_facts["moneyFlow"],
            "news": news_items,
            "klineSummary": _summarize_kline(kline_items),
            "marketOverview": _compact_overview(overview),
            "dataStatus": data_status,
            "dataSources": [f"{item['label']}：{_state_label(item['state'])}" for item in data_status],
            "missingFields": missing_fields,
            "warnings": [_neutralize_fact_text(item) for item in warnings],
            "coreStatus": {
                "quote": (quote or {}).get("_dataStatus") if isinstance(quote, dict) else None,
                "kline": (kline or {}).get("_dataStatus") if isinstance(kline, dict) else None,
            },
        }
        _log_stage("aggregate_total", symbol, aggregate_started, "success")
        return _neutralize_fact_value(fact_package)

    def _resolve_symbol(self, request: ResearchReportRequest) -> str:
        if request.symbol:
            try:
                return normalize_symbol(request.symbol).symbol
            except ValueError as error:
                raise HTTPException(status_code=400, detail=str(error)) from error

        keyword = request.keyword or ""
        try:
            return normalize_symbol(keyword.split()[0]).symbol
        except ValueError:
            pass

        try:
            matches = self._safe_fetch(
                f"search:{keyword.strip().lower()}",
                1800,
                lambda active: active.search_stocks(keyword),
                lambda fallback: fallback.search_stocks(keyword),
                [],
                collection_key="items",
            )
            items = (matches or {}).get("items") or []
        except Exception:
            items = []
        if items:
            return normalize_symbol(str(items[0].get("symbol") or items[0].get("code"))).symbol
        raise HTTPException(status_code=400, detail="Use A-share code such as 600519, SH600519, 000001, or SZ000001.")

    def _safe_fetch(
        self,
        cache_key: str,
        ttl_seconds: int,
        primary: Callable[[Any], Any],
        fallback: Callable[[MockProvider], Any],
        warnings: list[str],
        collection_key: str | None = None,
    ) -> dict[str, Any] | None:
        try:
            return self._cached_fetch(cache_key, ttl_seconds, primary, fallback, collection_key)
        except Exception as error:
            warnings.append(f"{cache_key} 数据暂不可用：{sanitize_rule_text(error)}")
            return None

    def _cached_fetch(
        self,
        cache_key: str,
        ttl_seconds: int,
        primary: Callable[[Any], Any],
        fallback: Callable[[MockProvider], Any],
        collection_key: str | None = None,
    ) -> dict[str, Any]:
        fresh = self.cache.get(cache_key, ttl_seconds)
        if fresh is not None:
            return _with_status(fresh.value, "cache", "fresh", fresh, None, collection_key)

        try:
            data = primary(self.provider)
            self.cache.set(cache_key, data)
            return _with_status(data, settings.provider, "live", None, None, collection_key)
        except Exception as error:
            stale = self.cache.get_stale(cache_key)
            if stale is not None:
                return _with_status(stale.value, "cache", "stale", stale, f"实时数据暂不可用，已使用旧缓存：{sanitize_rule_text(error)}", collection_key)
            if settings.allow_mock_fallback and self.provider is not self.mock_provider:
                data = fallback(self.mock_provider)
                return _with_status(data, "mock", "fallback", None, f"实时数据暂不可用，已使用兜底数据：{sanitize_rule_text(error)}", collection_key)
            raise

    def _fetch_fact_sources(
        self,
        symbol: str,
        specs: dict[str, dict[str, Any]],
        warnings: list[str],
        deadline: float,
    ) -> dict[str, Any | None]:
        order = ("quote", "detail", "kline", "overview")
        max_workers = min(REPORT_FETCH_WORKERS, max(1, len(specs)))
        executor = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="research-report-fetch")
        futures = {}
        stage_starts: dict[str, float] = {}
        try:
            for name in order:
                spec = specs.get(name)
                if spec is None:
                    continue
                stage_starts[name] = time.perf_counter()
                if spec.get("allow_live") is False:
                    result = self._cached_or_fallback_fetch(
                        spec["cache_key"],
                        spec["ttl_seconds"],
                        spec["fallback"],
                        spec["collection_key"],
                    )
                    results_status = "success" if result is not None else "skipped"
                    _log_stage(name, symbol, stage_starts[name], results_status, cache_state=_cache_state(result))
                    futures[name] = result
                    continue
                futures[name] = executor.submit(
                    self._cached_fetch,
                    spec["cache_key"],
                    spec["ttl_seconds"],
                    spec["primary"],
                    spec["fallback"],
                    spec["collection_key"],
                )

            results: dict[str, Any | None] = {name: None for name in order}
            for name in order:
                spec = specs.get(name)
                future = futures.get(name)
                if spec is None or future is None:
                    continue
                if spec.get("allow_live") is False:
                    results[name] = future
                    continue

                remaining = deadline - time.perf_counter()
                timeout_seconds = min(settings.ai_report_optional_source_timeout_seconds, max(0.0, remaining))
                if timeout_seconds <= 0:
                    future.cancel()
                    result = self._fallback_fetch_result(spec["cache_key"], spec["fallback"], spec["collection_key"], "aggregation deadline reached")
                    warnings.append(f"{spec['cache_key']} unavailable: aggregation deadline reached")
                    results[name] = result
                    _log_stage(name, symbol, stage_starts[name], "timeout", cache_state=_cache_state(result))
                    continue

                try:
                    result = future.result(timeout=timeout_seconds)
                    status = "success" if result is not None else "error"
                except TimeoutError:
                    future.cancel()
                    result = self._fallback_fetch_result(spec["cache_key"], spec["fallback"], spec["collection_key"], "source timeout")
                    warnings.append(f"{spec['cache_key']} unavailable: source timeout")
                    status = "timeout"
                except Exception as error:
                    safe_error = _safe_message(error)
                    result = self._fallback_fetch_result(spec["cache_key"], spec["fallback"], spec["collection_key"], safe_error)
                    warnings.append(f"{spec['cache_key']} unavailable: {safe_error}")
                    status = "error"

                results[name] = result
                _log_stage(name, symbol, stage_starts[name], status, cache_state=_cache_state(result))
            return results
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

    def _cached_or_fallback_fetch(
        self,
        cache_key: str,
        ttl_seconds: int,
        fallback: Callable[[MockProvider], Any],
        collection_key: str | None,
    ) -> dict[str, Any] | None:
        fresh = self.cache.get(cache_key, ttl_seconds)
        if fresh is not None:
            return _with_status(fresh.value, "cache", "fresh", fresh, None, collection_key)
        return self._fallback_fetch_result(cache_key, fallback, collection_key, "optional live fetch skipped")

    def _fallback_fetch_result(
        self,
        cache_key: str,
        fallback: Callable[[MockProvider], Any],
        collection_key: str | None,
        reason: object,
    ) -> dict[str, Any] | None:
        stale = self.cache.get_stale(cache_key)
        if stale is not None:
            return _with_status(stale.value, "cache", "stale", stale, f"source unavailable; using stale cache: {_safe_message(reason)}", collection_key)
        if settings.allow_mock_fallback:
            try:
                data = fallback(self.mock_provider)
                return _with_status(data, "mock", "fallback", None, f"source unavailable; using fallback data: {_safe_message(reason)}", collection_key)
            except Exception:
                return None
        return None

    def _finalize(self, response: ResearchReportResponse, started_at: float) -> ResearchReportResponse:
        response.reportStatus.latencyMs = int((time.perf_counter() - started_at) * 1000)
        assert_report_compliant(response)
        _log_stage("total", response.symbol, started_at, "success")
        return response


def _log_stage(stage: str, symbol: object, started_at: float, status: str, cache_state: str | None = None) -> None:
    duration_ms = int((time.perf_counter() - started_at) * 1000)
    LOGGER.info(
        "research_report_stage stage=%s symbol=%s duration_ms=%d status=%s cache=%s",
        stage,
        str(symbol or ""),
        duration_ms,
        status,
        cache_state or "",
    )


def _cache_state(value: object) -> str | None:
    if isinstance(value, dict):
        status = value.get("_dataStatus")
        if isinstance(status, dict):
            return str(status.get("mode") or status.get("provider") or "")
    return None


def _core_data_quality_issue(facts: dict[str, Any]) -> str | None:
    quote = facts.get("quote") if isinstance(facts.get("quote"), dict) else {}
    kline_summary = facts.get("klineSummary") if isinstance(facts.get("klineSummary"), dict) else {}
    core_status = facts.get("coreStatus") if isinstance(facts.get("coreStatus"), dict) else {}
    quote_status = core_status.get("quote") if isinstance(core_status.get("quote"), dict) else {}
    kline_status = core_status.get("kline") if isinstance(core_status.get("kline"), dict) else {}

    if not quote or _num(quote.get("latestPrice")) <= 0:
        return "CORE_QUOTE_UNAVAILABLE at core.quote"
    if not kline_summary.get("available") or _num(kline_summary.get("latestClose")) <= 0:
        return "CORE_KLINE_UNAVAILABLE at core.kline"

    quote_mode = str(quote_status.get("mode") or "")
    quote_provider = str(quote_status.get("provider") or "")
    kline_mode = str(kline_status.get("mode") or "")
    kline_provider = str(kline_status.get("provider") or "")
    if quote_provider == "mock" or quote_mode == "fallback":
        return "CORE_QUOTE_MOCK at core.quote"
    if kline_provider == "mock" or kline_mode == "fallback":
        return "CORE_KLINE_FALLBACK at core.kline"

    stale_reason = _core_stale_issue("quote", quote_status) or _core_stale_issue("kline", kline_status)
    if stale_reason is not None:
        return stale_reason

    return _core_price_consistency_issue(quote, kline_summary)


def _core_stale_issue(label: str, status: dict[str, Any]) -> str | None:
    mode = str(status.get("mode") or "")
    if mode not in {"stale", "stale_refreshing"}:
        return None
    age = _num(status.get("cacheAgeSeconds"))
    if age > CORE_STALE_MAX_SECONDS:
        return f"CORE_DATA_STALE at core.{label}"
    return None


def _core_price_consistency_issue(quote: dict[str, Any], kline_summary: dict[str, Any]) -> str | None:
    quote_time = _parse_datetime(quote.get("updateTime"))
    kline_date = _parse_date(kline_summary.get("latestDate"))
    if quote_time is None or kline_date is None:
        return None
    if not _is_after_market_close(quote_time):
        return None
    if quote_time.date() != kline_date:
        return "CORE_TRADE_DATE_MISMATCH at core.quote_kline"
    quote_price = _num(quote.get("latestPrice"))
    kline_close = _num(kline_summary.get("latestClose"))
    if quote_price <= 0 or kline_close <= 0:
        return None
    if abs(quote_price - kline_close) / kline_close > CORE_PRICE_MISMATCH_THRESHOLD:
        return "CORE_PRICE_MISMATCH at core.quote_kline"
    return None


def _parse_datetime(value: object) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d %H:%M"):
        try:
            return datetime.strptime(text[:19], fmt)
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(text)
    except ValueError:
        return None


def _parse_date(value: object):
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            pass
    return None


def _is_after_market_close(value: datetime) -> bool:
    return (value.hour, value.minute) >= (MARKET_CLOSE_HOUR, MARKET_CLOSE_MINUTE)


def _safe_message(value: object) -> str:
    return sanitize_rule_text(str(value or ""))[:160]


def _now_shanghai() -> str:
    return datetime.now(timezone(timedelta(hours=8))).isoformat(timespec="seconds")


def _with_status(
    data: Any,
    provider_name: str,
    mode: str,
    entry: CacheEntry | None,
    warning: str | None,
    collection_key: str | None = None,
) -> dict[str, Any]:
    if isinstance(data, dict):
        result = dict(data)
    elif collection_key:
        result = {collection_key: data}
    else:
        result = {"value": data}
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
    result["_dataStatus"] = status
    return result


def _strip_status(value: dict[str, Any] | None) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    return {key: item for key, item in value.items() if key != "_dataStatus"}


def _missing_fields(quote: dict[str, Any], detail: dict[str, Any], kline_items: list[dict[str, Any]], overview: dict[str, Any] | None) -> list[str]:
    missing = set()
    if not quote.get("industry"):
        missing.add("行业信息")
    if not quote.get("pe") and not quote.get("pb"):
        missing.add("估值字段")
    if not detail:
        missing.update({"个股详情", "财务指标", "资金流", "新闻/公告线索"})
    else:
        if (detail.get("finance") or {}).get("available") is False:
            missing.add("财务指标")
        if (detail.get("moneyFlow") or {}).get("available") is False:
            missing.add("资金流")
        if not detail.get("news"):
            missing.add("新闻/公告线索")
    if not kline_items:
        missing.add("K线/技术指标")
    if not overview:
        missing.add("市场概览")
    return sorted(missing)


def _build_data_status(
    quote: dict[str, Any] | None,
    detail: dict[str, Any] | None,
    kline: dict[str, Any] | None,
    overview: dict[str, Any] | None,
    missing_fields: list[str],
) -> list[dict[str, Any]]:
    return [
        _status_item("行情数据", quote, "已返回基础报价；接口未提供独立数据状态。"),
        _status_item("个股详情", detail, "该部分数据暂不可用；报告已使用基础报价继续生成。", partial=any(field in missing_fields for field in ("财务指标", "资金流", "新闻/公告线索"))),
        _status_item("K线/技术指标", kline, "该部分数据暂不可用；技术分析按待复核处理。"),
        {
            "label": "字段完整性",
            "state": "partial" if missing_fields else "available",
            "detail": f"存在缺失项：{'、'.join(missing_fields)}。" if missing_fields else "核心字段已返回。",
            "warning": None,
        },
        _status_item("市场概览", overview, "未纳入当前报告上下文。"),
    ]


def _status_item(label: str, payload: dict[str, Any] | None, missing_detail: str, partial: bool = False) -> dict[str, Any]:
    status = (payload or {}).get("_dataStatus") or {}
    if not payload:
        return {"label": label, "state": "missing", "detail": missing_detail, "warning": None}
    state = "partial" if partial or status.get("provider") == "mock" or status.get("mode") in {"fallback", "stale", "stale_refreshing"} or status.get("warning") else "available"
    return {
        "label": label,
        "state": state,
        "detail": _describe_status(status),
        "warning": _neutralize_fact_text(status.get("warning")) if status.get("warning") else None,
    }


def _describe_status(status: dict[str, Any]) -> str:
    if not status:
        return "接口未提供独立数据状态。"
    provider = status.get("sourceProvider") or status.get("provider")
    mode = status.get("mode")
    age = int(status.get("cacheAgeSeconds") or 0)
    age_text = f"，缓存约 {age} 秒" if age > 0 else ""
    return f"来源 {provider}，状态 {mode}{age_text}。"


def _state_label(state: str) -> str:
    return {"available": "可用", "partial": "部分可用", "missing": "暂不可用"}.get(state, state)


def _summarize_kline(items: list[dict[str, Any]]) -> dict[str, Any]:
    if not items:
        return {
            "available": False,
            "summary": "K线和成交量数据暂不可用；该部分仅作数据状态说明。",
        }
    latest = items[-1]
    previous = items[-2] if len(items) > 1 else latest
    recent = items[-20:]
    latest_volume = _num(latest.get("volume"))
    avg_volume = sum(_num(item.get("volume")) for item in recent) / max(1, len(recent))
    volume_ratio = latest_volume / avg_volume if avg_volume else 0
    latest_close = _num(latest.get("close"))
    previous_close = _num(previous.get("close"))
    previous_change_pct = round((latest_close - previous_close) / previous_close * 100, 2) if previous_close else 0.0
    recent_change_pct = _recent_change_pct(recent)
    ma20 = _num(latest.get("ma20"))
    above_ma20 = latest_close >= ma20 if ma20 > 0 else None
    volume_state = "active" if volume_ratio >= 1.4 else "thin" if volume_ratio <= 0.65 else "normal"
    price_text = (
        f"最新收盘价为 {latest_close:.2f}，较上一交易日变化 {previous_change_pct:+.2f}%，"
        f"近 {len(recent)} 个交易日涨跌幅为 {recent_change_pct:+.2f}%。"
    )
    ma_text = (
        "MA20 数据暂不可用，均线位置关系需补充公开行情后核对。"
        if above_ma20 is None
        else f"收盘价与 MA20 的位置关系为：{'高于' if above_ma20 else '低于'} MA20。"
    )
    volume_text = f"最新成交量与近 {len(recent)} 日均量之比为 {volume_ratio:.2f}。"
    history_notice = "上述数据仅反映历史行情，不能用于预测后续价格变化。"
    return {
        "available": True,
        "latestDate": str(latest.get("date") or ""),
        "latestClose": latest_close,
        "previousClose": previous_close,
        "previousChangePct": previous_change_pct,
        "ma5": _num(latest.get("ma5")),
        "ma10": _num(latest.get("ma10")),
        "ma20": ma20,
        "volumeRatio20": round(volume_ratio, 2),
        "recentChangePct20": recent_change_pct,
        "aboveMa20": above_ma20,
        "volumeState": volume_state,
        "priceText": price_text,
        "maText": ma_text,
        "volumeText": volume_text,
        "summary": f"{price_text}{ma_text}{volume_text}{history_notice}",
    }


def _neutralize_news_item(item: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(item.get("id") or ""),
        "title": _neutralize_fact_text(item.get("title")),
        "summary": _neutralize_fact_text(item.get("summary") or item.get("description") or ""),
        "source": _neutralize_fact_text(item.get("source")),
        "publishedAt": str(item.get("publishedAt") or ""),
        "url": item.get("url"),
    }


def _neutralize_warning_field(value: object) -> dict[str, Any]:
    if not isinstance(value, dict):
        return {}
    result = dict(value)
    if result.get("warning"):
        result["warning"] = _neutralize_fact_text(result["warning"])
    return result


def _neutralize_fact_value(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _neutralize_fact_value(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_neutralize_fact_value(item) for item in value]
    if isinstance(value, tuple):
        return tuple(_neutralize_fact_value(item) for item in value)
    if isinstance(value, str):
        return _neutralize_fact_text(value)
    return value


def _neutralize_fact_text(value: object) -> str:
    text = sanitize_rule_text(value)
    replacements = (
        ("资金参与度提升", "成交量发生变化"),
        ("趋势韧性", "均线位置关系"),
        ("值得关注", "需结合公开信息复核"),
        ("暂时回避", "需结合公开信息复核"),
        ("偏强", "相对变化为正"),
        ("偏弱", "相对变化为负"),
        ("强势", "相对变化"),
        ("机会", "相关线索"),
        ("看好", "需结合公开信息复核"),
        ("看淡", "需结合公开信息复核"),
        ("看多", "需结合公开信息复核"),
        ("看空", "需结合公开信息复核"),
        ("配置价值", "数据复核项"),
        ("上涨空间", "价格变化范围"),
        ("下跌空间", "价格变化范围"),
        ("建议重点观察", "需结合公开信息复核"),
        ("适合关注", "需结合公开信息复核"),
        ("持续跟踪", "持续复核公开信息"),
    )
    for source, target in replacements:
        text = text.replace(source, target)
    return text


def _compact_overview(overview: dict[str, Any] | None) -> dict[str, Any]:
    if not overview:
        return {}
    return {
        "indexes": (overview.get("indexes") or [])[:5],
        "marketStats": overview.get("marketStats") or {},
        "sectors": (overview.get("sectors") or [])[:5],
    }


def _recent_change_pct(items: list[dict[str, Any]]) -> float:
    if len(items) < 2:
        return 0.0
    first = _num(items[0].get("close"))
    last = _num(items[-1].get("close"))
    return round((last - first) / first * 100, 2) if first else 0.0


def _num(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0
