import { AlertTriangle, Eye, Info } from "lucide-react";
import type { RiskItem, RiskOverview, RiskWatchItem } from "../analysis/researchReport";

interface RiskWatchOverviewProps {
  riskOverview?: RiskOverview | null;
}

const EMPTY_TEXT = "当前可用数据不足以形成可靠的风险与观察清单，请结合公司公告、定期报告及最新市场数据继续复核。";

export function RiskWatchOverview({ riskOverview }: RiskWatchOverviewProps) {
  const overview = riskOverview || null;
  const hasContent = Boolean(overview && (overview.riskItems.length > 0 || overview.watchItems.length > 0 || overview.limitations.length > 0));
  const status = overview?.status || "missing";

  return (
    <section className={`risk-watch-overview status-${status === "available" ? "good" : "warn"}`} aria-label="风险与后续观察">
      <div className="risk-watch-header">
        <div>
          <h3>风险与后续观察</h3>
          <p>仅整理服务端已返回的事实、数据限制和待复核事项。</p>
        </div>
        <span>{riskStatusLabel(status)}</span>
      </div>

      {!hasContent ? (
        <div className="risk-watch-empty">{EMPTY_TEXT}</div>
      ) : (
        <>
          {overview?.summary ? <div className="risk-watch-summary"><Info size={15} /> {overview.summary}</div> : null}

          {overview && overview.riskItems.length > 0 ? (
            <>
              <strong className="risk-watch-section-label">风险线索</strong>
              <div className="risk-watch-grid">
                {overview.riskItems.map((item) => <RiskCard item={item} key={item.id} />)}
              </div>
            </>
          ) : null}

          {overview && overview.watchItems.length > 0 ? (
            <>
              <strong className="risk-watch-section-label">后续观察</strong>
              <div className="risk-watch-grid">
                {overview.watchItems.map((item) => <WatchCard item={item} key={item.id} />)}
              </div>
            </>
          ) : null}

          {overview && overview.limitations.length > 0 ? (
            <div className="risk-watch-limitations">
              <strong>数据限制</strong>
              <ul>{overview.limitations.map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
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
  return { high_attention: "高关注", medium_attention: "中关注", general_attention: "一般关注" }[value] || "关注级别待复核";
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
