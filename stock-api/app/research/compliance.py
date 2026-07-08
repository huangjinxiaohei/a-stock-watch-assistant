from __future__ import annotations

from app.research.schemas import DISCLAIMER, ResearchReportResponse


HARD_BLOCK_TERMS = (
    "买入",
    "卖出",
    "加仓",
    "减仓",
    "满仓",
    "清仓",
    "仓位",
    "目标价",
    "止盈",
    "止损",
    "保证收益",
    "收益承诺",
    "必涨",
    "必跌",
    "确定上涨",
    "确定下跌",
    "预测股价",
    "明天涨停",
)


class ComplianceError(ValueError):
    pass


def assert_report_compliant(report: ResearchReportResponse) -> None:
    texts: list[str] = []
    for section in report.sections:
        texts.extend(section.points)
    texts.extend(report.dataSources)
    texts.extend(report.missingFields)
    for item in report.dataStatus:
        texts.extend([item.label, item.detail, item.warning or ""])
    texts.extend(report.warnings)
    if report.disclaimer != DISCLAIMER:
        raise ComplianceError("disclaimer mismatch")
    _raise_if_blocked(texts)


def assert_llm_text_compliant(sections: list[dict] | list[object], warnings: list[str]) -> None:
    texts: list[str] = []
    for section in sections:
        if isinstance(section, dict):
            points = section.get("points", [])
        else:
            points = getattr(section, "points", [])
        texts.extend(str(point) for point in points)
    texts.extend(str(warning) for warning in warnings)
    _raise_if_blocked(texts)


def sanitize_rule_text(text: object) -> str:
    clean = str(text or "")
    for term in HARD_BLOCK_TERMS:
        clean = clean.replace(term, "相关表述")
    return clean


def sanitize_rule_texts(items: list[object]) -> list[str]:
    return [sanitize_rule_text(item) for item in items if str(item or "").strip()]


def _raise_if_blocked(texts: list[str]) -> None:
    joined = "\n".join(texts)
    for term in HARD_BLOCK_TERMS:
        if term in joined:
            raise ComplianceError(f"blocked compliance term: {term}")

