import type { Quote } from "../services/stockData";
import { formatMoney, formatNumber, formatOptionalPercent, formatPercent, formatVolume, toneClass } from "../utils/format";

export function QuoteCard({ quote }: { quote: Quote }) {
  return (
    <section className="panel quote-card">
      <div>
        <div className="stock-title">
          <h2>{quote.name}</h2>
          <span>{quote.code}</span>
        </div>
        <p className="muted">{quote.industry} · 更新时间 {quote.updateTime}</p>
      </div>
      <div className="quote-main">
        <strong className={toneClass(quote.changePercent)}>{formatNumber(quote.latestPrice)}</strong>
        <span className={toneClass(quote.changePercent)}>
          {quote.change >= 0 ? "+" : ""}
          {formatNumber(quote.change)} / {formatPercent(quote.changePercent)}
        </span>
      </div>
      <div className="metric-grid compact">
        <Metric label="今开" value={formatNumber(quote.open)} />
        <Metric label="最高" value={formatNumber(quote.high)} />
        <Metric label="最低" value={formatNumber(quote.low)} />
        <Metric label="昨收" value={formatNumber(quote.previousClose)} />
        <Metric label="成交量" value={formatVolume(quote.volume)} />
        <Metric label="成交额" value={formatMoney(quote.amount)} />
        <Metric label="换手率" value={formatOptionalPercent(quote.turnoverRate)} />
        <Metric label="总市值" value={formatMoney(quote.totalMarketCap)} />
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}