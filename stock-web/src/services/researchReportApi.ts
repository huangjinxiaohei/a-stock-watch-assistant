import { RESEARCH_DISCLAIMER, type FinancialExplanation, type FinancialMetric, type MajorEventItem, type ReportSource, type ReportStatusValue, type ResearchDataState, type ResearchReport, type RiskItem, type RiskOverview, type RiskWatchItem } from "../analysis/researchReport";

const apiBaseUrl = import.meta.env.VITE_STOCK_API_BASE_URL ?? "";
const requestTimeoutMs = Number(import.meta.env.VITE_STOCK_REQUEST_TIMEOUT_MS ?? 60000);

interface ResearchReportApiRequest {
  symbol?: string;
  keyword?: string;
  language: "zh-CN";
  depth: "standard";
}

export async function requestBackendResearchReport(requestBody: ResearchReportApiRequest): Promise<ResearchReport> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(buildResearchReportUrl(apiBaseUrl), {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`研究报告接口请求失败：${response.status} ${response.statusText}`);
    }

    return parseBackendResearchReport(await response.json());
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("研究报告接口响应超时");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function buildResearchReportUrl(baseUrl: string): string {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  if (!normalizedBaseUrl) return "/api/research/reports";
  if (normalizedBaseUrl.endsWith("/api")) return `${normalizedBaseUrl}/research/reports`;
  return `${normalizedBaseUrl}/api/research/reports`;
}

function parseBackendResearchReport(value: unknown): ResearchReport {
  if (!isRecord(value)) throw new Error("研究报告接口返回格式异常");

  const reportStatus = isRecord(value.reportStatus) ? value.reportStatus : null;
  const source = reportStatus && isReportSource(reportStatus.source) ? reportStatus.source : null;
  const status = reportStatus && isReportStatusValue(reportStatus.status) ? reportStatus.status : null;
  const sections = Array.isArray(value.sections) ? value.sections.map(parseSection) : [];
  const dataStatus = Array.isArray(value.dataStatus) ? value.dataStatus.map(parseDataStatusItem) : [];
  const disclaimer = typeof value.disclaimer === "string" ? value.disclaimer : "";

  if (!source || !status || !value.symbol || !value.name || !value.generatedAt || sections.length === 0 || disclaimer !== RESEARCH_DISCLAIMER) {
    throw new Error("研究报告接口返回缺少核心字段或免责声明");
  }

  return {
    symbol: String(value.symbol),
    name: String(value.name),
    generatedAt: String(value.generatedAt),
    reportStatus: {
      source,
      status,
      provider: reportStatus && typeof reportStatus.provider === "string" ? reportStatus.provider : null,
      model: reportStatus && typeof reportStatus.model === "string" ? reportStatus.model : null,
      fallbackReason: reportStatus && typeof reportStatus.fallbackReason === "string" ? reportStatus.fallbackReason : null,
      latencyMs: reportStatus && typeof reportStatus.latencyMs === "number" ? reportStatus.latencyMs : null
    },
    dataSources: toStringArray(value.dataSources),
    dataStatus,
    missingFields: toStringArray(value.missingFields),
    sections,
    disclaimer,
    warnings: toStringArray(value.warnings),
    majorEvents: parseMajorEvents(value.majorEvents),
    financialExplanation: parseFinancialExplanation(value.financialExplanation),
    riskOverview: parseRiskOverview(value.riskOverview)
  };
}

function parseFinancialExplanation(value: unknown): FinancialExplanation | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return missingFinancialExplanation();

  return {
    status: typeof value.status === "string" && value.status ? value.status : "missing",
    asOfDate: typeof value.asOfDate === "string" ? value.asOfDate : null,
    sourceName: toSafeString(value.sourceName),
    revenueGrowth: parseFinancialMetric(value.revenueGrowth),
    netProfitGrowth: parseFinancialMetric(value.netProfitGrowth),
    grossMargin: parseFinancialMetric(value.grossMargin),
    roe: parseFinancialMetric(value.roe),
    debtRatio: parseFinancialMetric(value.debtRatio),
    eps: parseFinancialMetric(value.eps),
    changePattern: toSafeString(value.changePattern),
    summary: toSafeString(value.summary),
    confirmedFacts: toStringArray(value.confirmedFacts),
    limitations: toStringArray(value.limitations),
    needsFollowUp: toStringArray(value.needsFollowUp),
    dataStatus: isRecord(value.dataStatus) ? value.dataStatus : undefined
  };
}

function missingFinancialExplanation(): FinancialExplanation {
  return {
    status: "missing",
    asOfDate: null,
    sourceName: "",
    revenueGrowth: parseFinancialMetric(null),
    netProfitGrowth: parseFinancialMetric(null),
    grossMargin: parseFinancialMetric(null),
    roe: parseFinancialMetric(null),
    debtRatio: parseFinancialMetric(null),
    eps: parseFinancialMetric(null),
    changePattern: "",
    summary: "",
    confirmedFacts: [],
    limitations: [],
    needsFollowUp: [],
    dataStatus: undefined
  };
}

function parseFinancialMetric(value: unknown): FinancialMetric {
  if (!isRecord(value)) return { value: null, unit: "", available: false };
  return {
    value: typeof value.value === "number" && Number.isFinite(value.value) ? value.value : null,
    unit: toSafeString(value.unit),
    available: value.available === true
  };
}

function parseRiskOverview(value: unknown): RiskOverview | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) return missingRiskOverview();
  return {
    status: typeof value.status === "string" && value.status ? value.status : "missing",
    summary: toSafeString(value.summary),
    riskItems: Array.isArray(value.riskItems) ? value.riskItems.filter(isRecord).map(parseRiskItem) : [],
    watchItems: Array.isArray(value.watchItems) ? value.watchItems.filter(isRecord).map(parseRiskWatchItem) : [],
    limitations: toStringArray(value.limitations),
    dataStatus: isRecord(value.dataStatus) ? value.dataStatus : undefined
  };
}

function parseRiskItem(value: Record<string, unknown>): RiskItem {
  return {
    id: toSafeString(value.id),
    category: toSafeString(value.category),
    title: toSafeString(value.title),
    evidence: toSafeString(value.evidence),
    sourceType: toSafeString(value.sourceType),
    severity: toSafeString(value.severity),
    status: toSafeString(value.status),
    dataStatus: isRecord(value.dataStatus) ? value.dataStatus : undefined,
    needsFollowUp: toStringArray(value.needsFollowUp)
  };
}

function parseRiskWatchItem(value: Record<string, unknown>): RiskWatchItem {
  return {
    id: toSafeString(value.id),
    title: toSafeString(value.title),
    reason: toSafeString(value.reason),
    relatedData: toSafeString(value.relatedData),
    followUpSource: toSafeString(value.followUpSource)
  };
}

function missingRiskOverview(): RiskOverview {
  return {
    status: "missing",
    summary: "",
    riskItems: [],
    watchItems: [],
    limitations: [],
    dataStatus: undefined
  };
}

function parseMajorEvents(value: unknown): MajorEventItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).filter(isRecord).map((item) => ({
    eventId: toSafeString(item.eventId),
    symbol: toSafeString(item.symbol),
    title: toSafeString(item.title),
    eventType: toSafeString(item.eventType),
    publishedAt: toSafeString(item.publishedAt),
    sourceName: toSafeString(item.sourceName),
    sourceUrl: typeof item.sourceUrl === "string" ? item.sourceUrl : null,
    status: toSafeString(item.status),
    summary: toSafeString(item.summary),
    affectedAreas: toStringArray(item.affectedAreas),
    needsFollowUp: toStringArray(item.needsFollowUp),
    dataStatus: isRecord(item.dataStatus) ? item.dataStatus : undefined
  }));
}

function parseSection(value: unknown) {
  if (!isRecord(value) || typeof value.title !== "string" || !Array.isArray(value.points)) {
    throw new Error("研究报告章节格式异常");
  }
  return {
    title: value.title,
    points: value.points.map(String)
  };
}

function parseDataStatusItem(value: unknown) {
  if (!isRecord(value) || typeof value.label !== "string" || !isResearchDataState(value.state) || typeof value.detail !== "string") {
    throw new Error("研究报告数据状态格式异常");
  }
  return {
    label: value.label,
    state: value.state,
    detail: value.detail,
    warning: typeof value.warning === "string" ? value.warning : undefined
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function toSafeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isReportSource(value: unknown): value is ReportSource {
  return value === "llm" || value === "rule" || value === "rule_fallback";
}

function isReportStatusValue(value: unknown): value is ReportStatusValue {
  return value === "success" || value === "fallback" || value === "error";
}

function isResearchDataState(value: unknown): value is ResearchDataState {
  return value === "available" || value === "partial" || value === "missing";
}
