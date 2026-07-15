import { CheckCircle2, Info, Loader2, Sparkles } from "lucide-react";
import type { ReportStatus, ResearchDataState, ResearchDataStatusItem, ResearchReport } from "../analysis/researchReport";
import { FinancialChangeOverview } from "./FinancialChangeOverview";
import { MajorEventsOverview } from "./MajorEventsOverview";

interface ResearchReportPanelProps {
  report: ResearchReport | null;
  loading: boolean;
  error: string;
  steps: string[];
  currentStep: number;
}

type BannerTone = "good" | "warn" | "neutral";
type CoreDataState = "available" | "review" | "unavailable";
type OptionalDataState = "complete" | "missing" | "review";

interface CoreDataView {
  state: CoreDataState;
  label: string;
  detail: string;
  tone: BannerTone;
}

interface ReportSourceView {
  label: string;
  detail: string;
  tone: BannerTone;
}

interface OptionalDataView {
  state: OptionalDataState;
  label: string;
  detail: string;
  affectedLabels: string[];
}

export function ResearchReportPanel({ report, loading, error, steps, currentStep }: ResearchReportPanelProps) {
  const coreDataView = report ? getCoreDataView(report) : null;
  const optionalDataView = report ? getOptionalDataView(report) : null;
  const sourceView = report && coreDataView && optionalDataView ? getReportSourceView(report, coreDataView, optionalDataView) : null;
  const statusSummary = report && coreDataView && optionalDataView ? getDataStatusSummary(coreDataView, optionalDataView) : "核心数据可用";

  return (
    <section className="panel research-report-panel" aria-label="研究报告展示">
      <div className="panel-header compact-header">
        <div>
          <h2>结构化研究报告</h2>
          <p className="section-subtitle">优先使用后端AI增强报告；不可用时自动保留规则整理稿。</p>
        </div>
        <Sparkles size={18} />
      </div>

      <div className="research-stepper" aria-label="研究报告生成状态">
        {steps.map((step, index) => {
          const completed = loading ? index < currentStep : Boolean(report) && index <= currentStep;
          const active = loading && index === currentStep;
          return (
            <div className={`research-step ${completed ? "completed" : ""} ${active ? "active" : ""}`} key={step}>
              {active ? <Loader2 className="spin" size={16} /> : <CheckCircle2 size={16} />}
              <span>{step}</span>
            </div>
          );
        })}
      </div>

      {error ? <div className="research-error">{error}</div> : null}

      {!report && !loading ? (
        <div className="research-empty">
          <strong>等待生成研究报告</strong>
          <span>输入股票代码或名称后，系统会整理行情、技术指标和新闻线索，并输出结构化研究材料。</span>
        </div>
      ) : null}

      {report ? (
        <article className="research-report-content">
          {sourceView ? (
            <div className={`research-status-banner ${sourceView.tone}`}>
              <Info size={16} />
              <div>
                <strong>{sourceView.label}</strong>
                <span>{sourceView.detail}</span>
              </div>
            </div>
          ) : null}

          <div className="research-report-meta">
            <div>
              <strong>{report.name}</strong>
              <span>{report.symbol}</span>
            </div>
            <div>
              <span>生成时间</span>
              <strong>{report.generatedAt}</strong>
            </div>
            <div>
              <span>报告来源</span>
              <strong>{sourceView?.label || "规则整理稿"}</strong>
            </div>
          </div>

          <MajorEventsOverview majorEvents={report.majorEvents} />

          <FinancialChangeOverview financialExplanation={report.financialExplanation} />

          <section className="research-data-status" aria-label="报告数据状态">
            <div className="research-data-status-header">
              <h3>报告数据状态</h3>
              <span>{statusSummary}</span>
            </div>
            <div className="research-data-status-grid">
              {report.dataStatus.map((item) => (
                <div className={`research-data-status-item data-state-${item.state}`} key={item.label}>
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.detail}</span>
                    {item.warning ? <em>{item.warning}</em> : null}
                  </div>
                  <b>{dataStateLabel[item.state]}</b>
                </div>
              ))}
            </div>
          </section>

          <div className="research-source-list">
            {coreDataView ? <span>{coreDataView.label}</span> : null}
            {optionalDataView && optionalDataView.state !== "complete" ? <span>{optionalDataView.label}</span> : null}
            {report.dataSources.map((source) => <span key={source}>{source}</span>)}
            {report.reportStatus.provider ? <span>生成引擎：{report.reportStatus.provider}</span> : null}
            {report.reportStatus.model ? <span>模型：{report.reportStatus.model}</span> : null}
            {typeof report.reportStatus.latencyMs === "number" ? <span>耗时：{report.reportStatus.latencyMs}ms</span> : null}
          </div>

          {report.warnings && report.warnings.length > 0 ? (
            <div className="research-warning-list">
              {report.warnings.map((warning) => <span key={warning}>{warning}</span>)}
            </div>
          ) : null}

          <div className="research-section-grid">
            {report.sections.map((section) => (
              <section className={`research-section ${section.title === "免责声明" ? "disclaimer-section" : ""}`} key={section.title}>
                <h3>{section.title}</h3>
                <ul>
                  {section.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </section>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}

function getReportSourceView(report: ResearchReport, coreDataView: CoreDataView, optionalDataView: OptionalDataView): ReportSourceView {
  const status = report.reportStatus;
  const fallbackReason = getSafeFallbackReason(status);
  const optionalDetail = optionalDataView.state === "complete" ? "" : `；${optionalDataView.label}：${optionalDataView.detail}`;

  if (isFallbackReport(status) || coreDataView.state === "unavailable") {
    return {
      label: "降级整理稿",
      detail: fallbackReason || `${coreDataView.label}：${coreDataView.detail}${optionalDetail}`,
      tone: "warn"
    };
  }

  if (status.source === "llm" && status.status === "success") {
    return {
      label: "AI增强报告",
      detail: optionalDataView.state === "complete" ? `${coreDataView.label}：由后端报告接口生成，并已保留数据状态和免责声明。` : `${coreDataView.label}${optionalDetail}`,
      tone: coreDataView.state === "review" || optionalDataView.state !== "complete" ? "warn" : "good"
    };
  }

  return {
    label: "规则整理稿",
    detail: `${coreDataView.label}：基于公开行情数据和规则生成，用于信息整理和研究辅助${optionalDetail}。`,
    tone: coreDataView.state === "review" || optionalDataView.state !== "complete" ? "warn" : "neutral"
  };
}

function getCoreDataView(report: ResearchReport): CoreDataView {
  const status = report.reportStatus;
  const fallbackReason = getSafeFallbackReason(status);
  const quoteStatus = findDataStatusItem(report.dataStatus, ["行情", "报价", "quote"]);
  const klineStatus = findDataStatusItem(report.dataStatus, ["K线", "技术指标", "kline"]);

  if (isFallbackReport(status)) {
    return {
      state: "unavailable",
      label: "核心数据不可用",
      detail: fallbackReason || "后端核心数据门禁未通过，已降级为规则整理稿。",
      tone: "warn"
    };
  }

  const hardCoreIssue = getHardCoreIssue(quoteStatus) || getHardCoreIssue(klineStatus) || getCoreReasonLabel(fallbackReason);
  if (!quoteStatus || !klineStatus || hardCoreIssue) {
    return {
      state: "unavailable",
      label: "核心数据不可用",
      detail: hardCoreIssue || "行情报价或K线/技术指标状态缺失，核心数据无法确认。",
      tone: "warn"
    };
  }

  if (quoteStatus.state === "partial" || klineStatus.state === "partial" || hasReviewSignal(quoteStatus) || hasReviewSignal(klineStatus)) {
    return {
      state: "review",
      label: "核心数据待复核",
      detail: "行情报价或K线/技术指标处于旧缓存、刷新中或待复核状态，报告结论需结合数据状态查看。",
      tone: "warn"
    };
  }

  return {
    state: "available",
    label: "核心数据可用",
    detail: "行情报价与K线/技术指标均为可用状态。",
    tone: "good"
  };
}

function getOptionalDataView(report: ResearchReport): OptionalDataView {
  const optionalMissing = getOptionalMissingFields(report);
  const optionalStatusItems = report.dataStatus.filter((item) => isOptionalDataStatusItem(item));
  const missingItems = optionalStatusItems.filter((item) => item.state === "missing");
  const reviewItems = optionalStatusItems.filter((item) => item.state === "partial" || hasReviewSignal(item) || hasUntrustedSignal(item));

  if (optionalMissing.length > 0 || missingItems.length > 0) {
    const affectedLabels = uniqueStrings([...optionalMissing, ...missingItems.map((item) => item.label)]);
    return {
      state: "missing",
      label: "部分增强数据缺失",
      detail: affectedLabels.length > 0 ? `${affectedLabels.join("、")} 暂不可用，报告仍以核心行情和K线为基础。` : "部分增强数据暂不可用，报告仍以核心行情和K线为基础。",
      affectedLabels
    };
  }

  if (reviewItems.length > 0) {
    const affectedLabels = uniqueStrings(reviewItems.map((item) => item.label));
    return {
      state: "review",
      label: "增强数据待复核",
      detail: affectedLabels.length > 0 ? `${affectedLabels.join("、")} 处于部分可用、旧缓存或待复核状态。` : "部分增强数据处于待复核状态。",
      affectedLabels
    };
  }

  return {
    state: "complete",
    label: "增强数据可用",
    detail: "可选增强数据未发现缺失或待复核状态。",
    affectedLabels: []
  };
}

function getDataStatusSummary(coreDataView: CoreDataView, optionalDataView: OptionalDataView): string {
  if (optionalDataView.state !== "complete") return `${coreDataView.label} · ${optionalDataView.label}`;
  return coreDataView.label;
}

function findDataStatusItem(items: ResearchDataStatusItem[], keywords: string[]): ResearchDataStatusItem | undefined {
  return items.find((item) => keywords.some((keyword) => item.label.toLowerCase().includes(keyword.toLowerCase())));
}

function isFallbackReport(status: ReportStatus): boolean {
  return status.source === "rule_fallback" || status.status === "fallback";
}

function getSafeFallbackReason(status: ReportStatus): string {
  return typeof status.fallbackReason === "string" ? status.fallbackReason.trim() : "";
}

function getOptionalMissingFields(report: ResearchReport): string[] {
  return report.missingFields.filter((field) => !isCoreMissingField(field));
}

function isCoreMissingField(field: string): boolean {
  return /行情|报价|quote|K线|技术指标|kline/i.test(field);
}

function isOptionalDataStatusItem(item: ResearchDataStatusItem): boolean {
  return !isCoreDataStatusItem(item) && !/字段完整性|完整性|field/i.test(item.label);
}

function isCoreDataStatusItem(item: ResearchDataStatusItem): boolean {
  return /行情|报价|quote|K线|技术指标|kline/i.test(item.label);
}

function getHardCoreIssue(item: ResearchDataStatusItem | undefined): string {
  if (!item) return "";
  const text = `${item.label} ${item.detail} ${item.warning || ""}`.toLowerCase();
  if (item.state === "missing") return `${item.label}暂不可用。`;
  if (text.includes("mock")) return `${item.label}为模拟数据。`;
  if (text.includes("fallback") || text.includes("降级")) return `${item.label}处于降级状态。`;
  return "";
}

function hasReviewSignal(item: ResearchDataStatusItem | undefined): boolean {
  if (!item) return false;
  const text = `${item.detail} ${item.warning || ""}`.toLowerCase();
  return text.includes("stale") || text.includes("待复核") || text.includes("旧缓存") || text.includes("刷新中") || text.includes("warning");
}

function hasUntrustedSignal(item: ResearchDataStatusItem | undefined): boolean {
  if (!item) return false;
  const text = `${item.label} ${item.detail} ${item.warning || ""}`.toLowerCase();
  return text.includes("mock") || text.includes("fallback") || text.includes("降级");
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function getCoreReasonLabel(reason: string): string {
  if (!reason) return "";
  if (reason.includes("CORE_PRICE_MISMATCH")) return "行情报价与K线收盘价存在明显不一致。";
  if (reason.includes("CORE_TRADE_DATE_MISMATCH")) return "行情报价日期与K线日期不一致。";
  if (reason.includes("CORE_QUOTE_UNAVAILABLE")) return "核心行情报价不可用。";
  if (reason.includes("CORE_KLINE_UNAVAILABLE")) return "核心K线数据不可用。";
  if (reason.includes("CORE_QUOTE_MOCK")) return "核心行情报价为模拟或兜底数据。";
  if (reason.includes("CORE_KLINE_FALLBACK")) return "核心K线数据为兜底数据。";
  if (reason.includes("CORE_DATA_STALE")) return "核心行情或K线数据过旧。";
  return "";
}

const dataStateLabel: Record<ResearchDataState, string> = {
  available: "可用",
  partial: "部分可用",
  missing: "暂不可用"
};
