import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import type { ResearchDataState, ResearchReport } from "../analysis/researchReport";

interface ResearchReportPanelProps {
  report: ResearchReport | null;
  loading: boolean;
  error: string;
  steps: string[];
  currentStep: number;
}

export function ResearchReportPanel({ report, loading, error, steps, currentStep }: ResearchReportPanelProps) {
  return (
    <section className="panel research-report-panel" aria-label="研究报告展示">
      <div className="panel-header compact-header">
        <div>
          <h2>结构化研究报告</h2>
          <p className="section-subtitle">规则生成版本，适合作为求职作品集中的AI投研入口演示。</p>
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
          <div className="research-report-meta">
            <div>
              <strong>{report.name}</strong>
              <span>{report.symbol}</span>
            </div>
            <div>
              <span>生成时间</span>
              <strong>{report.generatedAt}</strong>
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
          </div>

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

const dataStateLabel: Record<ResearchDataState, string> = {
  available: "可用",
  partial: "部分可用",
  missing: "暂不可用"
};
