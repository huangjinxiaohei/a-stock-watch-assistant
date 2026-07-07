import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import type { StockAnalysis } from "../analysis/stockAnalysis";

export function AnalysisPanel({ analysis }: { analysis: StockAnalysis }) {
  return (
    <section className="panel analysis-panel">
      <div className="panel-header compact-header">
        <h2>AI行情总结</h2>
        <span className={`tone-badge ${analysis.actionTone === "适合关注" ? "good" : analysis.actionTone === "保持谨慎" ? "warn" : "bad"}`}>
          {analysis.actionTone}
        </span>
      </div>
      <div className="analysis-grid">
        <AnalysisItem label="当前趋势" text={analysis.currentTrend} />
        <AnalysisItem label="关键支撑位" text={analysis.supportLevel} />
        <AnalysisItem label="关键压力位" text={analysis.pressureLevel} />
        <AnalysisItem label="量价关系" text={analysis.volumePrice} />
        <AnalysisItem label="短线风险" text={analysis.shortTermRisk} />
        <AnalysisItem label="中线观察点" text={analysis.midTermWatch} />
        <AnalysisItem label="适合关注的条件" text={analysis.focusConditions} />
        <AnalysisItem label="需要回避的信号" text={analysis.avoidSignals} />
      </div>
      <div className="disclaimer">
        <Info size={16} />
        <span>{analysis.disclaimer}</span>
      </div>
    </section>
  );
}

export function RiskPanel({ risks }: { risks: StockAnalysis["risks"] }) {
  return (
    <section className="panel risk-panel">
      <div className="panel-header compact-header">
        <h2>风险提示</h2>
        <ShieldAlert size={18} />
      </div>
      {risks.length === 0 ? (
        <div className="risk-empty">暂未触发明显风险信号，仍需关注大盘、板块和个股消息变化。</div>
      ) : (
        <div className="risk-list">
          {risks.map((risk) => (
            <div className={`risk-item ${risk.level} ${risk.credibility}`} key={risk.title}>
              <AlertTriangle size={18} />
              <div>
                <div className="risk-item-header">
                  <strong>{risk.title}</strong>
                  <span className={`credibility-badge ${risk.credibility}`}>{credibilityLabel[risk.credibility]}</span>
                </div>
                <p>{risk.detail}</p>
                <div className="alert-meta">
                  <span>来源：{risk.dataSources.join(" / ")}</span>
                  {risk.missingFields && risk.missingFields.length > 0 ? <span>待确认：{risk.missingFields.join("、")}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

const credibilityLabel = {
  confirmed: "已确认",
  needsConfirm: "待复核",
  unavailable: "不可判定"
};

function TechnicalSnapshotView({ snapshot }: { snapshot: StockAnalysis["technicalSnapshot"] }) {
  const items = [
    { label: "MACD", value: snapshot.macd },
    { label: "KDJ", value: snapshot.kdj },
    { label: "RSI", value: snapshot.rsi },
    { label: "BOLL", value: snapshot.boll }
  ];

  return (
    <div className="analysis-item technical-snapshot">
      <span>技术指标快照 · {snapshot.date}</span>
      <div className="technical-snapshot-grid">
        {items.map((item) => (
          <div key={item.label}>
            <strong>{item.label}</strong>
            <p>{item.value}</p>
          </div>
        ))}
      </div>
      <p>{snapshot.dataSource}</p>
    </div>
  );
}

function AnalysisItem({ label, text }: { label: string; text: string }) {
  return (
    <div className="analysis-item">
      <span>{label}</span>
      <p>{text}</p>
    </div>
  );
}

