from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator, model_validator


DISCLAIMER = "以上内容由系统根据公开行情数据和规则生成，仅用于信息整理和研究辅助，不构成投资建议。"

SECTION_TITLES = (
    "公司概况",
    "最新行情",
    "技术分析",
    "新闻/公告线索",
    "优势观察",
    "风险因素",
    "总结",
    "免责声明",
)


class ResearchReportRequest(BaseModel):
    symbol: str | None = None
    keyword: str | None = None
    language: str = "zh-CN"
    depth: str = "standard"
    forceRefresh: bool = False
    generationMode: Literal["rule", "ai"] = "rule"

    @model_validator(mode="after")
    def require_lookup_key(self) -> "ResearchReportRequest":
        if not (self.symbol or self.keyword):
            raise ValueError("symbol and keyword cannot both be empty")
        return self

    @field_validator("symbol", "keyword", mode="before")
    @classmethod
    def clean_optional_text(cls, value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        return text or None

    @field_validator("language", mode="before")
    @classmethod
    def normalize_language(cls, value: object) -> str:
        return "zh-CN" if str(value or "").strip() != "zh-CN" else "zh-CN"

    @field_validator("depth", mode="before")
    @classmethod
    def normalize_depth(cls, value: object) -> str:
        return "standard" if str(value or "").strip() != "standard" else "standard"


class ReportStatus(BaseModel):
    source: Literal["llm", "rule", "rule_fallback"]
    status: Literal["success", "fallback", "error"]
    provider: str
    model: str | None = None
    fallbackReason: str | None = None
    latencyMs: int = 0


class ResearchDataStatusItem(BaseModel):
    label: str
    state: Literal["available", "partial", "missing"]
    detail: str
    warning: str | None = None


class ResearchReportSection(BaseModel):
    title: str
    points: list[str] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def validate_title(cls, value: str) -> str:
        if value not in SECTION_TITLES:
            raise ValueError(f"Unsupported section title: {value}")
        return value

    @field_validator("points")
    @classmethod
    def validate_points(cls, value: list[str]) -> list[str]:
        if not all(isinstance(item, str) for item in value):
            raise ValueError("section points must be strings")
        return value


class MajorEventItem(BaseModel):
    eventId: str
    symbol: str
    title: str
    eventType: str
    publishedAt: str
    sourceName: str
    sourceUrl: str | None = None
    status: str
    summary: str
    affectedAreas: list[str] = Field(default_factory=list)
    needsFollowUp: list[str] = Field(default_factory=list)
    dataStatus: dict[str, Any] = Field(default_factory=dict)
    classificationReason: str


class FinancialMetric(BaseModel):
    value: float | None = None
    unit: str
    available: bool = False


class FinancialExplanation(BaseModel):
    status: str
    asOfDate: str | None = None
    sourceName: str
    revenueGrowth: FinancialMetric
    netProfitGrowth: FinancialMetric
    grossMargin: FinancialMetric
    roe: FinancialMetric
    debtRatio: FinancialMetric
    eps: FinancialMetric
    changePattern: str
    summary: str
    confirmedFacts: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    needsFollowUp: list[str] = Field(default_factory=list)
    dataStatus: dict[str, Any] = Field(default_factory=dict)


class RiskItem(BaseModel):
    id: str
    category: str
    title: str
    evidence: str
    sourceType: str
    severity: Literal["high_attention", "medium_attention", "general_attention"]
    status: str
    dataStatus: dict[str, Any] = Field(default_factory=dict)
    needsFollowUp: list[str] = Field(default_factory=list)


class RiskWatchItem(BaseModel):
    id: str
    title: str
    reason: str
    relatedData: str
    followUpSource: str


class RiskOverview(BaseModel):
    status: str
    summary: str
    riskItems: list[RiskItem] = Field(default_factory=list)
    watchItems: list[RiskWatchItem] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)
    dataStatus: dict[str, Any] = Field(default_factory=dict)


class ResearchReportResponse(BaseModel):
    symbol: str
    name: str
    generatedAt: str
    reportStatus: ReportStatus
    dataSources: list[str] = Field(default_factory=list)
    dataStatus: list[ResearchDataStatusItem] = Field(default_factory=list)
    missingFields: list[str] = Field(default_factory=list)
    sections: list[ResearchReportSection]
    disclaimer: str = DISCLAIMER
    warnings: list[str] = Field(default_factory=list)
    majorEvents: list[MajorEventItem] = Field(default_factory=list)
    financialExplanation: FinancialExplanation | None = None
    riskOverview: RiskOverview | None = None


class LlmReportDraft(BaseModel):
    sections: list[ResearchReportSection]
    disclaimer: str
    warnings: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_required_sections(self) -> "LlmReportDraft":
        titles = [section.title for section in self.sections]
        missing_titles = [title for title in SECTION_TITLES if title not in titles]
        if missing_titles:
            raise ValueError(f"LLM report missing sections: {', '.join(missing_titles)}")
        disclaimer_sections = [section for section in self.sections if section.title == "免责声明"]
        if not disclaimer_sections or DISCLAIMER not in disclaimer_sections[0].points:
            raise ValueError("LLM disclaimer section missing or changed")
        return self

    @field_validator("disclaimer")
    @classmethod
    def validate_disclaimer(cls, value: str) -> str:
        if value != DISCLAIMER:
            raise ValueError("LLM disclaimer missing or changed")
        return value

