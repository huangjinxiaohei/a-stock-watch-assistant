import type { FinancialExplanation, FinancialMetric } from "../analysis/researchReport";

interface FinancialChangeOverviewProps {
  financialExplanation?: FinancialExplanation | null;
}

interface FinancialStatusView {
  label: string;
  detail: string;
  tone: "neutral" | "warn";
}

const EMPTY_TEXT = "当前可用数据不足以生成业绩变化概览，请结合公司最新定期报告继续复核。";

export function FinancialChangeOverview({ financialExplanation }: FinancialChangeOverviewProps) {
  const explanation = financialExplanation || null;
  const statusView = getStatusView(explanation);
  const shouldShowEmpty = !explanation || explanation.status === "missing" || !hasAnyFinancialContent(explanation);

  return (
    <section className={`financial-change-overview status-${statusView.tone}`} aria-label="业绩变化概览">
      <div className="financial-change-header">
        <div>
          <h3>业绩变化概览</h3>
          <p>基于后端结构化财务字段整理，仅用于辅助复核。</p>
        </div>
        <span>{statusView.label}</span>
      </div>

      {shouldShowEmpty ? (
        <div className="financial-change-empty">{EMPTY_TEXT}</div>
      ) : (
        <>
          <div className="financial-change-meta">
            <span>数据日期：{formatAsOfDate(explanation.asOfDate)}</span>
            <span>来源：{explanation.sourceName || "来源待复核"}</span>
          </div>

          <div className="financial-change-status-note">
            <strong>{statusView.detail}</strong>
            {needsDataReview(explanation) ? <span>当前数据需结合公司定期报告进一步核对。</span> : null}
          </div>

          <div className="financial-metric-grid">
            {financialMetrics.map((item) => (
              <div className="financial-metric-card" key={item.key}>
                <span>{item.label}</span>
                <strong>{formatMetric(explanation[item.key])}</strong>
                <em>{explanation[item.key].available ? "已返回" : "待复核"}</em>
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
          {explanation.limitations.length > 0 ? <FinancialList title="限制说明" items={explanation.limitations} /> : null}
          {explanation.needsFollowUp.length > 0 ? <FinancialList title="待复核事项" items={explanation.needsFollowUp} /> : null}
        </>
      )}
    </section>
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

function getStatusView(explanation: FinancialExplanation | null): FinancialStatusView {
  if (!explanation || explanation.status === "missing" || !hasAnyFinancialContent(explanation)) {
    return { label: "数据暂不可用", detail: EMPTY_TEXT, tone: "warn" };
  }
  if (explanation.status === "partial" || needsDataReview(explanation)) {
    return { label: "部分财务数据待复核", detail: "部分财务数据待复核。", tone: "warn" };
  }
  return { label: "财务数据可用", detail: "财务指标已按后端结构化字段返回。", tone: "neutral" };
}

function hasAnyFinancialContent(explanation: FinancialExplanation): boolean {
  return financialMetrics.some((item) => explanation[item.key].available) || Boolean(explanation.summary || explanation.changePattern || explanation.confirmedFacts.length);
}

function needsDataReview(explanation: FinancialExplanation): boolean {
  const dataStatus = explanation.dataStatus || {};
  const provider = String(dataStatus.provider || "").toLowerCase();
  const mode = String(dataStatus.mode || "").toLowerCase();
  const warning = String(dataStatus.warning || "").trim();
  return explanation.status === "partial" || provider === "mock" || provider === "fallback" || mode === "fallback" || mode === "stale" || mode === "stale_refreshing" || Boolean(warning);
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
