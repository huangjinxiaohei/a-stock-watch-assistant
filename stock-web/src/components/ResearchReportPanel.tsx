import { CheckCircle2, Info, Loader2, Sparkles } from "lucide-react";
import type { ReportStatus, ResearchDataState, ResearchReport } from "../analysis/researchReport";

interface ResearchReportPanelProps {
  report: ResearchReport | null;
  loading: boolean;
  error: string;
  steps: string[];
  currentStep: number;
}

export function ResearchReportPanel({ report, loading, error, steps, currentStep }: ResearchReportPanelProps) {
  const sourceView = report ? getReportSourceView(report.reportStatus) : null;

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

          <section className="research-data-status" aria-label="报告数据状态">
            <div className="research-data-status-header">
              <h3>报告数据状态</h3>
              <span>{report.missingFields.length > 0 ? `缺失项 ${report.missingFields.length}` : "核心数据可用"}</span>
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

function getReportSourceView(status: ReportStatus): { label: string; detail: string; tone: "good" | "warn" | "neutral" } {
  if (status.source === "llm" && status.status === "success") {
    return {
      label: "AI增强报告",
      detail: "由后端报告接口生成，并已保留数据状态和免责声明。",
      tone: "good"
    };
  }

  if (status.source === "rule_fallback" || status.status === "fallback") {
    return {
      label: "降级整理稿",
      detail: status.fallbackReason || "AI生成暂不可用，已使用规则整理稿。",
      tone: "warn"
    };
  }

  return {
    label: "规则整理稿",
    detail: "基于公开行情数据和规则生成，用于信息整理和研究辅助。",
    tone: "neutral"
  };
}

const dataStateLabel: Record<ResearchDataState, string> = {
  available: "可用",
  partial: "部分可用",
  missing: "暂不可用"
};
