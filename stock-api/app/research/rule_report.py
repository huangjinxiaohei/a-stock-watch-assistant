from __future__ import annotations

from typing import Any

from app.research.compliance import sanitize_rule_text, sanitize_rule_texts
from app.research.schemas import DISCLAIMER, ReportStatus, ResearchReportResponse, ResearchReportSection


def build_rule_report(
    facts: dict[str, Any],
    report_status: ReportStatus,
    generated_at: str,
    warnings: list[str] | None = None,
) -> ResearchReportResponse:
    quote = facts.get("quote") or {}
    detail = facts.get("detail") or {}
    kline_summary = facts.get("klineSummary") or {}
    news = facts.get("news") or []
    name = str(quote.get("name") or facts.get("name") or quote.get("code") or facts.get("symbol") or "未知股票")
    symbol = str(quote.get("symbol") or facts.get("symbol") or "")
    missing_fields = sanitize_rule_texts(facts.get("missingFields") or [])
    data_status = facts.get("dataStatus") or []
    data_sources = sanitize_rule_texts(facts.get("dataSources") or [])
    safe_warnings = sanitize_rule_texts([*(warnings or []), *(facts.get("warnings") or [])])

    sections = [
        ResearchReportSection(
            title="公司概况",
            points=sanitize_rule_texts(
                [
                    f"{name}（{quote.get('code') or symbol}）当前归属 {quote.get('market') or '暂不可用'} 市场，行业信息为 {quote.get('industry') or '暂不可用'}。",
                    "本报告基于公开行情快照、历史K线和可用新闻线索整理，用于形成结构化研究材料。",
                ]
            ),
        ),
        ResearchReportSection(
            title="最新行情",
            points=sanitize_rule_texts(
                [
                    f"最新价 {_fmt_number(quote.get('latestPrice'))}，涨跌幅 {_fmt_percent(quote.get('changePercent'))}，成交额 {_fmt_money(quote.get('amount'))}。",
                    f"今开 {_fmt_number(quote.get('open'))}，最高 {_fmt_number(quote.get('high'))}，最低 {_fmt_number(quote.get('low'))}，换手率 {_fmt_percent(quote.get('turnoverRate'))}。",
                    _valuation_text(quote),
                ]
            ),
        ),
        ResearchReportSection(title="技术分析", points=sanitize_rule_texts(_technical_points(kline_summary))),
        ResearchReportSection(title="新闻/公告线索", points=sanitize_rule_texts(_news_points(news))),
        ResearchReportSection(title="优势观察", points=sanitize_rule_texts(_strength_points(quote, kline_summary))),
        ResearchReportSection(title="风险因素", points=sanitize_rule_texts(_risk_points(detail, kline_summary, missing_fields))),
        ResearchReportSection(
            title="总结",
            points=sanitize_rule_texts(
                [
                    f"当前可将 {name} 作为研究对象，重点观察行情强弱、成交额变化、技术位置和公告线索是否相互印证。",
                    f"本次报告存在 {'、'.join(missing_fields)} 等缺失项，相关结论需要在数据补齐后复核。" if missing_fields else "本次报告所需核心数据已返回，可继续围绕业务、公告和行业信息补充研究。",
                    str(kline_summary.get("summary") or "技术指标数据不完整，后续需要在K线和成交量补齐后再更新判断。"),
                ]
            ),
        ),
        ResearchReportSection(title="免责声明", points=[DISCLAIMER]),
    ]

    return ResearchReportResponse(
        symbol=symbol,
        name=name,
        generatedAt=generated_at,
        reportStatus=report_status,
        dataSources=data_sources,
        dataStatus=data_status,
        missingFields=missing_fields,
        sections=sections,
        disclaimer=DISCLAIMER,
        warnings=safe_warnings,
    )


def _valuation_text(quote: dict[str, Any]) -> str:
    pe = _num(quote.get("pe"))
    pb = _num(quote.get("pb"))
    if pe or pb:
        return f"估值快照：PE {_fmt_number(pe)}，PB {_fmt_number(pb)}，总市值 {_fmt_money(quote.get('totalMarketCap'))}。"
    return "当前估值字段不完整，估值维度需结合后续数据复核。"


def _technical_points(summary: dict[str, Any]) -> list[str]:
    if not summary.get("available"):
        return ["该部分数据暂不可用：当前K线数据未完整返回，技术维度暂按待复核处理。"]
    return [
        str(summary.get("priceText") or "短期价格变化需结合后续行情复核。"),
        str(summary.get("maText") or "均线位置暂不可用，需补充确认。"),
        str(summary.get("volumeText") or "量能信息暂不可用，需补充确认。"),
    ]


def _news_points(news: list[dict[str, Any]]) -> list[str]:
    if not news:
        return ["该部分数据暂不可用：当前接口未返回可用新闻/公告线索，需结合交易所公告、公司公告等公开信息继续核对。"]
    return [
        f"{item.get('publishedAt') or '时间暂不可用'}｜{item.get('source') or '来源暂不可用'}｜{sanitize_rule_text(item.get('title'))}"
        for item in news[:3]
    ]


def _strength_points(quote: dict[str, Any], summary: dict[str, Any]) -> list[str]:
    points: list[str] = []
    if _num(quote.get("changePercent")) > 0:
        points.append("价格快照显示当日表现为正，说明短线关注度有所提升。")
    if _num(quote.get("amount")) > 1_000_000_000:
        points.append(f"成交额达到 {_fmt_money(quote.get('amount'))}，具备一定市场关注度。")
    if summary.get("aboveMa20") is True:
        points.append("价格位于MA20上方，技术结构仍有可跟踪价值。")
    if summary.get("volumeState") == "active":
        points.append("量能较近期均值更活跃，适合进一步结合分时和公告线索复核。")
    return points or ["当前优势信号不突出，更适合先做基础资料整理和后续观察。"]


def _risk_points(detail: dict[str, Any], summary: dict[str, Any], missing_fields: list[str]) -> list[str]:
    points: list[str] = []
    if summary.get("aboveMa20") is False:
        points.append("价格位于MA20下方，技术修复仍需更多数据确认。")
    if summary.get("volumeState") == "thin":
        points.append("量能偏弱时，价格信号的可靠性需要谨慎看待。")
    if (detail.get("moneyFlow") or {}).get("available") is False:
        points.append("个股资金流接口未返回有效数据，资金维度未纳入本次确认。")
    if "新闻/公告线索" in missing_fields:
        points.append("新闻/公告线索不足，事件驱动因素仍需人工补充核对。")
    return points or ["当前未触发明显风险条目，但仍需持续关注数据更新、公告变化和市场环境。"]


def _fmt_number(value: object) -> str:
    number = _num(value)
    return f"{number:.2f}" if number else "暂无"


def _fmt_percent(value: object) -> str:
    number = _num(value)
    return f"{number:.2f}%" if value not in (None, "") else "暂无"


def _fmt_money(value: object) -> str:
    number = _num(value)
    if number >= 100_000_000:
        return f"{number / 100_000_000:.2f}亿"
    if number >= 10_000:
        return f"{number / 10_000:.2f}万"
    return f"{number:.2f}" if number else "暂无"


def _num(value: object) -> float:
    try:
        return float(value or 0)
    except (TypeError, ValueError):
        return 0.0
