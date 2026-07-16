import type { FinancialExplanation, FinancialMetric } from "../analysis/researchReport";

interface FinancialChangeOverviewProps {
  financialExplanation?: FinancialExplanation | null;
}

interface FinancialStatusView {
  label: string;
  detail: string;
  tone: "neutral" | "warn";
}

export function FinancialChangeOverview({ financialExplanation }: FinancialChangeOverviewProps) {
  const explanation = financialExplanation || null;
  const availableMetrics = explanation ? financialMetrics.filter((item) => hasAvailableMetric(explanation[item.key])) : [];
  const shouldShowCompact = !explanation || explanation.status === "missing" || explanation.status === "unavailable" || availableMetrics.length === 0;

  if (shouldShowCompact) {
    return (
      <section className="financial-change-overview financial-change-compact status-warn" aria-label="业绩变化概览">
        <div className="financial-compact-copy">
          <h3>财务数据待补充</h3>
          <p>当前财务数据源未返回可用指标，本报告未进行业绩变化归因。请结合公司最新定期报告继续复核。</p>
        </div>
        {explanation?.limitations.length ? <CompactDetails title="查看数据限制" items={explanation.limitations} className="financial-compact-details" /> : null}
      </section>
    );
  }

  const statusView = getStatusView(explanation, availableMetrics.length);
  const isPartial = explanation.status === "partial" || availableMetrics.length < financialMetrics.length;

  return (
    <section className={`financial-change-overview status-${statusView.tone}`} aria-label="业绩变化概览">
      <div className="financial-change-header">
        <div>
          <h3>业绩变化概览</h3>
          <p>基于后端结构化财务字段整理，仅用于辅助复核。</p>
        </div>
        <span>{statusView.label}</span>
      </div>

      <div className="financial-change-meta">
        <span>数据日期：{formatAsOfDate(explanation.asOfDate)}</span>
        <span>来源：{explanation.sourceName || "来源待复核"}</span>
      </div>

      <div className="financial-change-status-note">
        <strong>{statusView.detail}</strong>
        {needsDataReview(explanation) ? <span>当前数据需结合公司定期报告进一步核对。</span> : null}
      </div>

      <div className="financial-metric-grid">
        {availableMetrics.map((item) => (
          <div className="financial-metric-card" key={item.key}>
            <span>{item.label}</span>
            <strong>{formatMetric(explanation[item.key])}</strong>
            <em>{isPartial ? "部分可用" : "已返回"}</em>
          </div>
        ))}
      </div>

      <div className="financial-pattern-summary">
        <div>
          <span>营收与净利润关系</span>
          <strong>{explanation.changePattern || "待复核"}</strong>
        </div>
        <p>{explanation.summary || "业绩变化概览摘要暂不可用，需结合公司定期报告继续复核。"}</p>
      </div>

      {explanation.confirmedFacts.length > 0 ? <FinancialList title="已确认事实" items={explanation.confirmedFacts} /> : null}
      {explanation.limitations.length > 0 ? <FinancialList title="数据限制" items={explanation.limitations} /> : null}
      {explanation.needsFollowUp.length > 0 ? <FinancialList title="待复核事项" items={explanation.needsFollowUp} /> : null}
    </section>
  );
}

function CompactDetails({ title, items, className }: { title: string; items: string[]; className?: string }) {
  return (
    <details className={className}>
      <summary>{title}</summary>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </details>
  );
}

function FinancialList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="financial-change-list">
      <strong>{title}</strong>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function getStatusView(explanation: FinancialExplanation, availableMetricCount: number): FinancialStatusView {
  if (explanation.status === "partial" || availableMetricCount < financialMetrics.length || needsDataReview(explanation)) {
    return { label: "部分财务数据可用", detail: "已展示已返回的财务指标，缺失项需结合定期报告复核。", tone: "warn" };
  }
  return { label: "财务数据可用", detail: "财务指标已按后端结构化字段返回。", tone: "neutral" };
}

function hasAvailableMetric(metric: FinancialMetric): boolean {
  return metric.available && typeof metric.value === "number" && Number.isFinite(metric.value);
}

function needsDataReview(explanation: FinancialExplanation): boolean {
  const dataStatus = explanation.dataStatus || {};
  const provider = String(dataStatus.provider || "").toLowerCase();
  const mode = String(dataStatus.mode || "").toLowerCase();
  const state = String(dataStatus.state || "").toLowerCase();
  const warning = String(dataStatus.warning || "").trim();
  return explanation.status === "partial" || provider === "mock" || provider === "fallback" || mode === "fallback" || mode === "stale" || mode === "stale_refreshing" || state === "stale" || Boolean(warning);
}

function formatAsOfDate(value: string | null | undefined): string {
  const text = String(value || "").trim();
  if (!text || !/^\d{4}(-\d{2}){0,2}$/.test(text)) return "日期待复核";
  return text;
}

function formatMetric(metric: FinancialMetric): string {
  if (!metric.available || typeof metric.value !== "number" || !Number.isFinite(metric.value)) return "暂不可用";
  return `${metric.value}${metric.unit || ""}`;
}

const financialMetrics: Array<{ key: keyof Pick<FinancialExplanation, "revenueGrowth" | "netProfitGrowth" | "grossMargin" | "roe" | "debtRatio" | "eps">; label: string }> = [
  { key: "revenueGrowth", label: "营收增速" },
  { key: "netProfitGrowth", label: "净利润增速" },
  { key: "grossMargin", label: "毛利率" },
  { key: "roe", label: "ROE" },
  { key: "debtRatio", label: "资产负债率" },
  { key: "eps", label: "EPS" }
];
