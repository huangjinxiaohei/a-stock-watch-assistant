from __future__ import annotations

import re
from dataclasses import dataclass

from app.research.schemas import DISCLAIMER, ResearchReportResponse


@dataclass(frozen=True)
class ComplianceRule:
    rule_id: str
    category: str
    terms: tuple[str, ...]


@dataclass(frozen=True)
class ComplianceFinding:
    rule_id: str
    category: str
    path: str
    severity: str


HARD_BLOCK_RULES = (
    ComplianceRule("TRADE_ACTION", "交易动作", ("买入", "卖出", "加仓", "减仓", "满仓", "清仓", "建仓", "持有")),
    ComplianceRule("POSITION_ADVICE", "仓位/比例/策略", ("仓位", "半仓", "重仓", "轻仓", "配置比例", "操作策略")),
    ComplianceRule("PRICE_TARGET", "价格点位", ("目标价", "止盈", "止损", "买点", "卖点")),
    ComplianceRule("PROFIT_PROMISE", "收益承诺", ("保证收益", "收益承诺", "稳赚")),
    ComplianceRule("DETERMINISTIC_FORECAST", "确定性预测", ("必涨", "必跌", "确定上涨", "确定下跌", "明天涨停")),
    ComplianceRule("STOCK_PRICE_PREDICTION", "股价预测", ("预测股价", "股价预测")),
    ComplianceRule("INVESTMENT_RECOMMENDATION", "直接推荐", ("荐股", "推荐该股", "建议配置")),
)
CONTEXT_RESTRICTED_RULE = ComplianceRule(
    "CONTEXT_RESTRICTED_TECHNICAL_STATE",
    "历史/当前技术状态语境",
    ("反弹", "承压", "修复", "支撑", "压力", "突破", "跌破", "企稳", "回调", "上行", "下行", "反转"),
)
NEWS_CLUES_TECHNICAL_BOUNDARY_RULE = ComplianceRule(
    "NEWS_CLUES_TECHNICAL_BOUNDARY",
    "新闻章节技术解读边界",
    CONTEXT_RESTRICTED_RULE.terms,
)
SOFT_WARNING_RULE = ComplianceRule(
    "SOFT_TENDENCY_LANGUAGE",
    "软倾向表达",
    ("值得关注", "机会", "看好", "看淡", "看多", "看空", "配置价值", "上涨空间", "下跌空间", "建议重点观察", "适合关注", "持续跟踪"),
)
HARD_BLOCK_TERMS = tuple(term for rule in HARD_BLOCK_RULES for term in rule.terms)
FUTURE_CONTEXT_TERMS = ("后续", "未来", "预计", "将会", "有望", "看涨", "看跌", "预测", "预期", "明天")
ACTION_CONTEXT_TERMS = ("建议", "适合", "参与", "配置", "布局", "操作", "买卖", "交易", "策略")
PERIOD_PATTERN = re.compile(r"((近|过去)\s*\d+\s*(日|天|周|月|个交易日))|截至[^，。；,;]*|当前|日内|周内|月内")
DATA_EVIDENCE_PATTERN = re.compile(
    r"\d+(\.\d+)?\s*(%|元|倍|手|万|亿|点)?|MA\s*\d+|均线|成交量|均量比|涨跌幅|最高|最低|波动率|收盘价|成交额|换手率",
    re.IGNORECASE,
)
NEWS_CLUES_TECHNICAL_CUE_PATTERN = re.compile(r"股价|价格|收盘价|MA\s*\d+|均线|成交量|均量比|涨跌幅|技术|趋势|行情|量能|K线", re.IGNORECASE)

SECTION_PATHS = {
    "公司概况": "company_overview",
    "最新行情": "market_snapshot",
    "技术分析": "technical_analysis",
    "新闻/公告线索": "news_clues",
    "优势观察": "data_observations",
    "风险因素": "risk_factors",
    "总结": "summary",
    "免责声明": "disclaimer",
}


class ComplianceError(ValueError):
    def __init__(self, rule_id: str, category: str, path: str) -> None:
        self.rule_id = rule_id
        self.category = category
        self.path = path
        super().__init__(f"blocked compliance rule: {rule_id} ({category}) at {path}")


def assert_report_compliant(report: ResearchReportResponse) -> None:
    if report.disclaimer != DISCLAIMER:
        raise ValueError("disclaimer mismatch")

    for section in report.sections:
        section_key = SECTION_PATHS.get(section.title, "unknown_section")
        _scan_or_raise(section.points, f"sections.{section_key}.points", strict=False)
    _scan_or_raise(report.dataSources, "dataSources", strict=False)
    _scan_or_raise(report.missingFields, "missingFields", strict=False)
    for index, item in enumerate(report.dataStatus):
        _scan_or_raise([item.label, item.detail, item.warning or ""], f"dataStatus[{index}]", strict=False)
    if report.financialExplanation is not None:
        _scan_financial_explanation(report.financialExplanation)
    _scan_or_raise(report.warnings, "warnings", strict=False)


def assert_llm_text_compliant(sections: list[dict] | list[object], warnings: list[str]) -> None:
    for section_index, section in enumerate(sections):
        if isinstance(section, dict):
            title = str(section.get("title", ""))
            points = section.get("points", [])
        else:
            title = str(getattr(section, "title", ""))
            points = getattr(section, "points", [])
        section_key = SECTION_PATHS.get(title, f"section_{section_index}")
        _scan_or_raise([str(point) for point in points], f"sections.{section_key}.points")
    _scan_or_raise([str(warning) for warning in warnings], "warnings")


def assert_llm_enhancement_compliant(draft: object) -> None:
    _scan_or_raise([str(getattr(draft, "executiveSummary", ""))], "aiEnhancement.executiveSummary")
    _scan_or_raise([str(item) for item in getattr(draft, "keyObservations", [])], "aiEnhancement.keyObservations")
    _scan_or_raise([str(item) for item in getattr(draft, "riskInterpretation", [])], "aiEnhancement.riskInterpretation")
    _scan_or_raise([str(item) for item in getattr(draft, "dataLimitations", [])], "aiEnhancement.dataLimitations")


def collect_compliance_findings(sections: list[dict] | list[object], warnings: list[str]) -> list[ComplianceFinding]:
    findings: list[ComplianceFinding] = []
    for section_index, section in enumerate(sections):
        if isinstance(section, dict):
            title = str(section.get("title", ""))
            points = section.get("points", [])
        else:
            title = str(getattr(section, "title", ""))
            points = getattr(section, "points", [])
        section_key = SECTION_PATHS.get(title, f"section_{section_index}")
        findings.extend(_collect_findings([str(point) for point in points], f"sections.{section_key}.points"))
    findings.extend(_collect_findings([str(warning) for warning in warnings], "warnings"))
    return findings


def sanitize_rule_text(text: object) -> str:
    clean = str(text or "")
    for term in HARD_BLOCK_TERMS:
        clean = clean.replace(term, "相关表述")
    return clean


def sanitize_rule_texts(items: list[object]) -> list[str]:
    return [sanitize_rule_text(item) for item in items if str(item or "").strip()]


def _scan_or_raise(texts: list[str], path: str, *, strict: bool = True) -> None:
    for finding in _collect_findings(texts, path, strict=strict):
        if finding.severity == "block":
            raise ComplianceError(finding.rule_id, finding.category, finding.path)


def _scan_financial_explanation(value: object) -> None:
    if not isinstance(value, dict):
        if hasattr(value, "model_dump"):
            value = value.model_dump()
        else:
            return
    _scan_display_value(value.get("summary"), "financialExplanation.summary")
    _scan_display_value(value.get("confirmedFacts"), "financialExplanation.confirmedFacts")
    _scan_display_value(value.get("limitations"), "financialExplanation.limitations")
    _scan_display_value(value.get("needsFollowUp"), "financialExplanation.needsFollowUp")
    data_status = value.get("dataStatus")
    if isinstance(data_status, dict):
        _scan_display_value(data_status.get("warning"), "financialExplanation.dataStatus.warning")


def _scan_display_value(value: object, path: str, depth: int = 0) -> None:
    if value is None or isinstance(value, (bool, int, float)) or depth > 4:
        return
    if isinstance(value, str):
        if value.strip():
            _scan_single_or_raise(value, path, strict=False)
        return
    if isinstance(value, (list, tuple)):
        for index, item in enumerate(value):
            _scan_display_value(item, f"{path}[{index}]", depth + 1)
        return
    if isinstance(value, dict):
        for key, item in value.items():
            _scan_display_value(item, f"{path}.{key}", depth + 1)


def _scan_single_or_raise(text: str, path: str, *, strict: bool = True) -> None:
    finding = _scan_text(str(text), path, strict=strict)
    if finding is not None and finding.severity == "block":
        raise ComplianceError(finding.rule_id, finding.category, finding.path)

def _collect_findings(texts: list[str], path: str, *, strict: bool = True) -> list[ComplianceFinding]:
    findings: list[ComplianceFinding] = []
    for index, text in enumerate(texts):
        finding = _scan_text(str(text), _path_with_index(path, index), strict=strict)
        if finding is not None:
            findings.append(finding)
    return findings


def _scan_text(text: str, path: str, *, strict: bool = True) -> ComplianceFinding | None:
    for rule in HARD_BLOCK_RULES:
        if any(term in text for term in rule.terms):
            return ComplianceFinding(rule.rule_id, rule.category, path, "block")

    if not strict:
        return None

    has_context_term = any(term in text for term in CONTEXT_RESTRICTED_RULE.terms)
    if _is_news_clues_path(path):
        if has_context_term and _has_news_clues_technical_context(text):
            return ComplianceFinding(NEWS_CLUES_TECHNICAL_BOUNDARY_RULE.rule_id, NEWS_CLUES_TECHNICAL_BOUNDARY_RULE.category, path, "block")
    elif has_context_term:
        if not _context_restricted_is_allowed(text):
            return ComplianceFinding(CONTEXT_RESTRICTED_RULE.rule_id, CONTEXT_RESTRICTED_RULE.category, path, "block")
        return ComplianceFinding(CONTEXT_RESTRICTED_RULE.rule_id, CONTEXT_RESTRICTED_RULE.category, path, "allow")

    if any(term in text for term in SOFT_WARNING_RULE.terms):
        severity = "block" if _has_future_or_action_context(text) else "warning"
        return ComplianceFinding(SOFT_WARNING_RULE.rule_id, SOFT_WARNING_RULE.category, path, severity)

    return None


def _context_restricted_is_allowed(text: str) -> bool:
    return bool(PERIOD_PATTERN.search(text) and DATA_EVIDENCE_PATTERN.search(text) and not _has_future_or_action_context(text))


def _has_news_clues_technical_context(text: str) -> bool:
    return bool(NEWS_CLUES_TECHNICAL_CUE_PATTERN.search(text) or (PERIOD_PATTERN.search(text) and DATA_EVIDENCE_PATTERN.search(text)))


def _is_news_clues_path(path: str) -> bool:
    return path.startswith("sections.news_clues.")


def _has_future_or_action_context(text: str) -> bool:
    return any(term in text for term in FUTURE_CONTEXT_TERMS) or any(term in text for term in ACTION_CONTEXT_TERMS)


def _path_with_index(path: str, index: int) -> str:
    if path.endswith(".points"):
        return f"{path}[{index}]"
    return f"{path}[{index}]"
