import type { FinanceMetrics, MoneyFlow, NewsItem } from "../services/stockData";
import { formatMoney, formatNumber, formatOptionalPercent, formatPercent, toneClass } from "../utils/format";
import { EmptyState } from "./StateViews";

export function FinancePanel({ finance, coverageNote }: { finance: FinanceMetrics; coverageNote?: string }) {
  const metrics = [
    { label: "营收增速", value: finance.revenueGrowth, display: formatPercent(finance.revenueGrowth), tone: finance.revenueGrowth },
    { label: "净利增速", value: finance.netProfitGrowth, display: formatPercent(finance.netProfitGrowth), tone: finance.netProfitGrowth },
    { label: "毛利率", value: finance.grossMargin, display: formatOptionalPercent(finance.grossMargin) },
    { label: "ROE", value: finance.roe, display: formatOptionalPercent(finance.roe) },
    { label: "资产负债率", value: finance.debtRatio, display: formatOptionalPercent(finance.debtRatio) },
    { label: "EPS", value: finance.eps, display: finance.eps > 0 ? formatNumber(finance.eps) : "数据不足" }
  ].filter((item) => Math.abs(item.value) > 0);
  const available = finance.available ?? metrics.length > 0;

  return (
    <section className="panel">
      <div className="panel-header compact-header">
        <h2>财务指标</h2>
      </div>
      {!available ? (
        <div className="source-note">
          当前数据源未返回可用财务指标，已按不可用处理，避免把缺失值误读为真实中性。
          <SourceMeta source={finance.source} asOfDate={finance.asOfDate} warning={finance.warning || coverageNote} />
        </div>
      ) : (
        <>
          <div className="metric-grid">
            {metrics.map((item) => (
              <Metric key={item.label} label={item.label} value={item.display} tone={item.tone} />
            ))}
          </div>
          <SourceMeta source={finance.source} asOfDate={finance.asOfDate} warning={finance.warning || coverageNote} />
        </>
      )}
    </section>
  );
}

export function MoneyFlowPanel({ moneyFlow }: { moneyFlow: MoneyFlow }) {
  const hasFlowValue = [moneyFlow.mainNetInflow, moneyFlow.retailNetInflow, moneyFlow.largeOrderRatio, moneyFlow.fiveDayMainNetInflow].some((value) => Math.abs(value) > 0);
  const available = moneyFlow.available ?? hasFlowValue;

  return (
    <section className="panel">
      <div className="panel-header compact-header">
        <h2>资金流</h2>
      </div>
      {available ? (
        <>
          <div className="metric-grid">
            <Metric label="主力净流入" value={formatMoney(moneyFlow.mainNetInflow)} tone={moneyFlow.mainNetInflow} />
            <Metric label="散户净流入" value={formatMoney(moneyFlow.retailNetInflow)} tone={moneyFlow.retailNetInflow} />
            <Metric label="大单占比" value={formatPercent(moneyFlow.largeOrderRatio)} tone={moneyFlow.largeOrderRatio} />
            <Metric label="5日主力净流入" value={formatMoney(moneyFlow.fiveDayMainNetInflow)} tone={moneyFlow.fiveDayMainNetInflow} />
          </div>
          <SourceMeta source={moneyFlow.source} asOfDate={moneyFlow.asOfDate} warning={moneyFlow.warning} />
        </>
      ) : (
        <div className="source-note">
          当前资金流接口未返回有效数据，已按不可用处理，避免把全 0 误读为真实中性。
          <SourceMeta source={moneyFlow.source} asOfDate={moneyFlow.asOfDate} warning={moneyFlow.warning} />
        </div>
      )}
    </section>
  );
}

export function NewsPanel({ news }: { news: NewsItem[] }) {
  const sortedNews = [...news].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  const announcements = sortedNews.filter(isAnnouncement);
  const ordinaryNews = sortedNews.filter((item) => !isAnnouncement(item));

  return (
    <section className="panel">
      <div className="panel-header compact-header">
        <h2>新闻与公告</h2>
      </div>
      {sortedNews.length === 0 ? (
        <EmptyState label="暂无相关新闻或公告线索" />
      ) : (
        <div className="news-split-grid">
          <NewsGroup title="公告线索" items={announcements} emptyLabel="当前新闻源未识别到公告线索" />
          <NewsGroup title="相关新闻" items={ordinaryNews} emptyLabel="暂无相关新闻" />
        </div>
      )}
      <p className="source-note inline-note">公告线索来自免费新闻源标题/来源识别，完整公告仍需后续接入专门公告源复核。</p>
    </section>
  );
}

function NewsGroup({ title, items, emptyLabel }: { title: string; items: NewsItem[]; emptyLabel: string }) {
  return (
    <div className="news-group">
      <div className="news-group-header">
        <strong>{title}</strong>
        <span>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <EmptyState label={emptyLabel} />
      ) : (
        <div className="news-list">
          {items.slice(0, 6).map((item) => (
            <article className="news-item" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.source} · {item.publishedAt}</p>
              </div>
              <span className={`sentiment ${item.sentiment}`}>{sentimentLabel[item.sentiment]}</span>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function isAnnouncement(item: NewsItem): boolean {
  const text = `${item.title} ${item.source}`;
  return /公告|披露|停牌|复牌|年报|季报|中报|业绩|股东大会|分红|减持|增持|回购|重组|监管|问询|交易所/.test(text);
}

function SourceMeta({ source, asOfDate, warning }: { source?: string; asOfDate?: string; warning?: string }) {
  if (!source && !asOfDate && !warning) return null;
  return (
    <p className="source-note inline-note">
      {source ? `来源：${source}` : null}
      {asOfDate ? ` · 日期：${asOfDate}` : null}
      {warning ? ` · 限制：${warning}` : null}
    </p>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone === undefined ? undefined : toneClass(tone)}>{value}</strong>
    </div>
  );
}

const sentimentLabel: Record<NewsItem["sentiment"], string> = {
  positive: "利好",
  neutral: "中性",
  negative: "利空"
};




