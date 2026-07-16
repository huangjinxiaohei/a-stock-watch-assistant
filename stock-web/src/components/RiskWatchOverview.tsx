import { AlertTriangle, Eye, Info } from "lucide-react";
import type { RiskItem, RiskOverview, RiskWatchItem } from "../analysis/researchReport";

interface RiskWatchOverviewProps {
  riskOverview?: RiskOverview | null;
}

const EMPTY_TEXT = "当前可用数据不足以形成可靠的风险与观察清单，请结合公司公告、定期报告及最新市场数据继续复核。";

export function RiskWatchOverview({ riskOverview }: RiskWatchOverviewProps) {
  const overview = riskOverview || null;
  const riskItems = (overview?.riskItems || []).filter((item) => !hasUntrustedRiskData(item));
  const watchItems = overview?.watchItems || [];
  const limitations = overview?.limitations || [];
  const hasRiskItems = riskItems.length > 0;
  const hasWatchItems = watchItems.length > 0;
  const hasContent = hasRiskItems || hasWatchItems;
  const status = overview?.status || "missing";
  const title = hasRiskItems ? "风险与后续观察" : hasWatchItems ? "后续观察清单" : "风险与后续观察";

  if (!hasContent) {
    return (
      <section className="risk-watch-overview risk-watch-compact status-warn" aria-label="风险与后续观察">
        <div className="risk-compact-copy">
          <h3>风险与后续观察</h3>
          <p>{EMPTY_TEXT}</p>
        </div>
        {limitations.length > 0 ? <CompactLimitations items={limitations} /> : null}
      </section>
    );
  }

  return (
    <section className={`risk-watch-overview status-${status === "available" ? "good" : "warn"}`} aria-label={title}>
      <div className="risk-watch-header">
        <div>
          <h3>{title}</h3>
          <p>{hasRiskItems ? "仅整理服务端已返回的事实、数据限制和待复核事项。" : "当前数据不足以形成明确风险结论，以下事项建议结合后续公开信息持续复核。"}</p>
        </div>
        {hasRiskItems ? <span>{riskStatusLabel(status)}</span> : null}
      </div>

      {hasRiskItems && overview?.summary ? <div className="risk-watch-summary"><Info size={15} /> {overview.summary}</div> : null}

      {hasRiskItems ? (
        <>
          <strong className="risk-watch-section-label">风险线索</strong>
          <div className="risk-watch-grid">
            {riskItems.map((item) => <RiskCard item={item} key={item.id} />)}
          </div>
        </>
      ) : null}

      {hasWatchItems ? (
        <>
          {hasRiskItems ? <strong className="risk-watch-section-label">后续观察</strong> : null}
          <div className="risk-watch-grid">
            {watchItems.map((item) => <WatchCard item={item} key={item.id} />)}
          </div>
        </>
      ) : null}

      {limitations.length > 0 ? <CompactLimitations items={limitations} /> : null}
    </section>
  );
}

function CompactLimitations({ items }: { items: string[] }) {
  return (
    <details className="risk-watch-limitations">
      <summary>查看数据限制</summary>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </details>
  );
}

function hasUntrustedRiskData(item: RiskItem): boolean {
  const dataStatus = item.dataStatus || {};
  const values = [dataStatus.state, dataStatus.mode, dataStatus.provider]
    .map((value) => String(value || "").toLowerCase());
  return values.some((value) => ["missing", "mock", "fallback", "stale", "stale_refreshing"].includes(value));
}

function RiskCard({ item }: { item: RiskItem }) {
  return (
    <article className="risk-watch-card">
      <div className="risk-watch-item-header">
        <div>
          <span>{item.category}</span>
          <h4>{riskTitleLabel(item.title)}</h4>
        </div>
        <div className="risk-watch-item-meta">
          <span className={`risk-watch-chip severity-${item.severity}`}>{severityLabel(item.severity)}</span>
          <span className={`risk-watch-chip status-${item.status}`}>{riskItemStatusLabel(item.status)}</span>
        </div>
      </div>
      <p>{item.evidence}</p>
      <span>来源字段：{sourceTypeLabel(item.sourceType)}</span>
      {item.needsFollowUp.length > 0 ? (
        <div className="risk-watch-item">
          <strong><AlertTriangle size={14} /> 待复核</strong>
          <ul>{item.needsFollowUp.map((followUp) => <li key={followUp}>{followUp}</li>)}</ul>
        </div>
      ) : null}
    </article>
  );
}

function WatchCard({ item }: { item: RiskWatchItem }) {
  return (
    <article className="risk-watch-card">
      <div className="risk-watch-item-header">
        <h4><Eye size={15} /> {item.title}</h4>
      </div>
      <p>{item.reason}</p>
      <div className="risk-watch-item-meta">
        <span>关联数据：{item.relatedData}</span>
        <span>复核来源：{item.followUpSource}</span>
      </div>
    </article>
  );
}

function severityLabel(value: string): string {
  return { high_attention: "重点关注", medium_attention: "持续关注", general_attention: "一般关注" }[value] || "关注级别待复核";
}

function riskItemStatusLabel(value: string): string {
  return value === "confirmed" ? "事实已返回" : value === "needs_follow_up" ? "待复核" : "状态待复核";
}

function riskStatusLabel(value: string): string {
  return value === "available" ? "已有事实" : value === "partial" ? "部分待复核" : "数据暂不可用";
}

function riskTitleLabel(value: string): string {
  return value === "技术状态异常" ? "技术状态需关注" : value;
}

function sourceTypeLabel(value: string): string {
  return {
    coreStatus: "核心行情状态",
    klineSummary: "技术数据摘要",
    financialExplanation: "财务数据完整性",
    missingFields: "缺失字段",
    dataStatus: "数据状态",
    warning: "数据提示",
    warnings: "数据提示"
  }[value] || value;
}
