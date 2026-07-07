import { Activity, Bell, Flame, Moon, RefreshCw, Settings2, Sun } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DataSourceStatus } from "../components/DataSourceStatus";
import { SearchBox } from "../components/SearchBox";
import { ErrorState, LoadingState } from "../components/StateViews";
import { StockTable } from "../components/StockTable";
import { refreshIntervalMs, stockDataProvider, type DataStatus, type MarketIndex, type MarketOverview, type MarketStats, type Quote, type RankingItem, type SectorPerformance } from "../services/stockData";
import { formatMoney, formatNumber, formatPercent, toneClass } from "../utils/format";

interface HomePageProps {
  watchSymbols: string[];
  onAddWatch: (symbol: string) => void;
  onRemoveWatch: (symbol: string) => void;
  onSelectStock: (symbol: string) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}

type RankingTab = "gainers" | "losers" | "amount" | "turnover";

type AlertCredibility = "confirmed" | "needsConfirm" | "unavailable";

type AlertLevel = "high" | "medium" | "low";

type AlertScope = "market" | "ranking" | "watchlist";

type MarketTemperatureLabel = "强势" | "震荡" | "分化" | "弱势";

type DataConfidence = "高" | "中" | "低";

interface MarketMood {
  label: MarketTemperatureLabel;
  tone: "good" | "warn" | "bad";
  summary: string;
  reasons: string[];
  dataConfidence: DataConfidence;
  dataNote: string;
}

interface MarketAlert {
  level: AlertLevel;
  title: string;
  detail: string;
  credibility: AlertCredibility;
  actionTone: "适合关注" | "保持谨慎" | "暂时回避";
  dataSources: string[];
  missingFields?: string[];
  scope: AlertScope;
  isPlaceholder?: boolean;
}

const indexTargets = ["上证指数", "深证成指", "创业板指", "北证50", "科创50"];

export function HomePage({ watchSymbols, onAddWatch, onRemoveWatch, onSelectStock, theme, onToggleTheme }: HomePageProps) {
  const [overview, setOverview] = useState<MarketOverview | null>(null);
  const [watchQuotes, setWatchQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [rankingTab, setRankingTab] = useState<RankingTab>("gainers");

  const load = useCallback(async () => {
    const startedAt = Date.now();
    setError("");
    setRefreshing(true);
    try {
      const market = await stockDataProvider.getMarketOverview();
      setOverview(market);
      setLoading(false);

      const quoteResults = await Promise.allSettled(watchSymbols.map((symbol) => stockDataProvider.getStockQuote(symbol)));
      const quotes = quoteResults.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
      setWatchQuotes(quotes);
      if (quoteResults.some((result) => result.status === "rejected")) {
        setError("部分自选股报价加载较慢，已先显示市场概览。");
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "行情加载失败");
    } finally {
      const elapsed = Date.now() - startedAt;
      if (elapsed < 450) {
        await new Promise((resolve) => window.setTimeout(resolve, 450 - elapsed));
      }
      setLoading(false);
      setRefreshing(false);
    }
  }, [watchSymbols]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(), refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [load]);

  const marketStats = useMemo(() => buildMarketStats(overview, watchQuotes), [overview, watchQuotes]);
  const rankedQuotes = useMemo(() => getRankingQuotes(overview, rankingTab), [overview, rankingTab]);
  const alerts = useMemo(() => buildMarketAlerts(overview, watchQuotes), [overview, watchQuotes]);
  const marketMood = getMarketMood(marketStats, overview);

  if (loading && !overview) {
    return <LoadingState />;
  }

  if (error && !overview) {
    return <ErrorState message={error} onRetry={load} />;
  }

  return (
    <main className="page terminal-page">
      <section className="terminal-header">
        <div className="brand-block">
          <div className="brand-title-row">
            <h1>A股行情辅助分析</h1>
            <button className="theme-toggle-button" type="button" onClick={onToggleTheme} title={theme === "dark" ? "切换到白天模式" : "切换到夜晚模式"} aria-label="切换昼夜模式">
              {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
              <span>{theme === "dark" ? "夜晚" : "白天"}</span>
            </button>
          </div>
          <div className="header-meta">
            <span>{getMarketSessionLabel()}</span>
            <span>刷新 {new Date().toLocaleTimeString("zh-CN", { hour12: false })}</span>
            <span>辅助参考，不构成投资建议</span>
          </div>
        </div>
        <SearchBox onSelect={onSelectStock} onAddWatch={onAddWatch} />
        <button className={`secondary-button refresh-button ${refreshing ? "is-refreshing" : ""}`} type="button" onClick={load} disabled={refreshing}>
          <RefreshCw className="refresh-icon" size={16} />
          {refreshing ? "刷新中" : "刷新"}
        </button>
      </section>

      {overview ? (
        <>
          <section className="market-hero-grid">
            <div className="panel market-overview-panel">
              <div className="panel-header compact-header">
                <h2>大盘概览</h2>
                <span className={`tone-badge ${marketMood.tone}`}>{marketMood.label}</span>
              </div>
              {refreshing ? <p className="panel-status-note">后台刷新中，当前仍显示上次数据。</p> : null}
              <div className="index-ticker-grid">
                {indexTargets.map((name) => (
                  <IndexTile key={name} index={findIndex(overview.indexes, name)} label={name} stats={marketStats} />
                ))}
              </div>
            </div>

            <MarketTemperature stats={marketStats} mood={marketMood} />

            <section className="panel compact-status-panel">
              <div className="panel-header compact-header">
                <h2>数据源</h2>
                <Settings2 size={17} />
              </div>
              <DataSourceStatus status={overview._dataStatus} />
            </section>
          </section>

          {error ? <ErrorState message={error} onRetry={load} /> : null}

          <div className="workbench-grid">
            <div className="workbench-main">
              <StockTable title="自选股看盘" quotes={watchQuotes} onSelect={onSelectStock} onRemove={onRemoveWatch} onRefresh={load} refreshing={refreshing} sortable dense />

              <section className="panel ranking-panel">
                <div className="panel-header compact-header">
                  <h2>市场排行</h2>
                  <div className="tab-strip">
                    <TabButton label="涨幅榜" active={rankingTab === "gainers"} onClick={() => setRankingTab("gainers")} />
                    <TabButton label="跌幅榜" active={rankingTab === "losers"} onClick={() => setRankingTab("losers")} />
                    <TabButton label="成交额榜" active={rankingTab === "amount"} onClick={() => setRankingTab("amount")} />
                    <TabButton label="换手率榜" active={rankingTab === "turnover"} onClick={() => setRankingTab("turnover")} />
                  </div>
                </div>
                <StockTable
                  title={rankingTitle[rankingTab]}
                  quotes={rankedQuotes}
                  onSelect={onSelectStock}
                  sortable
                  dense
                  defaultSortKey={rankingDefaultSort[rankingTab].key}
                  defaultSortDirection={rankingDefaultSort[rankingTab].direction}
                  emptyLabel={rankingTab === "turnover" ? "当前数据源未提供全市场换手率；后端会优先使用免费东方财富快照，详情页可用历史行情补齐。" : "暂无排行数据"}
                  bare
                />
              </section>
            </div>

            <aside className="workbench-side">
              <SectorHeatmap sectors={overview.sectors} />
              <MarketAlerts alerts={alerts} />
              <section className="panel config-panel">
                <div className="panel-header compact-header">
                  <h2>数据源配置说明</h2>
                </div>
                <p>实时行情和基础估值优先走免费 AkShare/东方财富链路；北向实时净买额披露口径已调整，首页改用全市场成交额和成交活跃度观察资金热度。</p>
              </section>
            </aside>
          </div>
        </>
      ) : null}
    </main>
  );
}

function IndexTile({ index, label, stats }: { index?: MarketIndex; label: string; stats: MarketStats }) {
  return (
    <div className="index-tile">
      <span>{label}</span>
      {index && index.latestPrice > 0 ? (
        <>
          <strong>{formatNumber(index.latestPrice)}</strong>
          <em className={toneClass(index.changePercent)}>{formatPercent(index.changePercent)}</em>
          <small>成交额 {index.amount > 0 ? formatMoney(index.amount) : "暂无"}</small>
        </>
      ) : (
        <>
          <strong className="muted-value">未覆盖</strong>
          <em className="flat">等待数据源</em>
          <small>等待指数数据源</small>
        </>
      )}
    </div>
  );
}

function MarketTemperature({ stats, mood }: { stats: MarketStats; mood: MarketMood }) {
  const total = Math.max(1, stats.risingCount + stats.fallingCount + stats.flatCount);
  const riseRatio = Math.round((stats.risingCount / total) * 100);
  const risk = getRiskLevel(stats, riseRatio);
  const amountHot = stats.activeAmount > 0 && stats.totalAmount > 0 ? stats.activeAmount / stats.totalAmount : 0;

  return (
    <section className="panel temperature-panel">
      <div className="panel-header compact-header">
        <h2>今日市场温度</h2>
        <Activity size={17} />
      </div>
      <div className={`temperature-summary ${mood.tone}`}>
        <strong>{mood.label}</strong>
        <span>{mood.summary}</span>
      </div>
      <div className="temperature-core">
        <div>
          <span>上涨占比</span>
          <strong className={riseRatio >= 50 ? "rise" : "fall"}>{riseRatio}%</strong>
        </div>
        <div className="temperature-bar">
          <i style={{ width: `${riseRatio}%` }} />
        </div>
      </div>
      <div className="temperature-grid">
        <MiniStat label="上涨/下跌" value={`${stats.risingCount} / ${stats.fallingCount}`} tone={stats.risingCount - stats.fallingCount} />
        <MiniStat label="涨停/跌停" value={`${stats.limitUpCount} / ${stats.limitDownCount}`} tone={stats.limitUpCount - stats.limitDownCount} />
        <MiniStat label="主力资金" value={stats.mainFundAvailable ? formatFlowMoney(stats.mainNetInflow) : "暂无"} tone={stats.mainFundAvailable ? stats.mainNetInflow : undefined} title={stats.mainFundSource || "东方财富 stock_market_fund_flow / stock_main_fund_flow"} />
        <MiniStat label="全市场成交额" value={formatMoney(stats.totalAmount)} tone={stats.totalAmount > 0 ? 1 : undefined} title="全市场 A 股成交额，比北向实时净买额更稳定可用" />
        <MiniStat label="成交活跃度" value={amountHot > 0.32 ? "放大" : amountHot > 0.18 ? "正常" : "偏弱"} tone={amountHot > 0.32 ? 1 : amountHot > 0.18 ? 0 : -1} />
        <MiniStat label="风险等级" value={risk.label} tone={risk.toneValue} />
        <MiniStat label="数据可信度" value={mood.dataConfidence} tone={confidenceTone[mood.dataConfidence]} title={mood.dataNote} />
      </div>
      <div className="temperature-reasons">
        {mood.reasons.map((reason) => (
          <span key={reason}>{reason}</span>
        ))}
        <span>{mood.dataNote}</span>
      </div>
    </section>
  );
}

function SectorHeatmap({ sectors }: { sectors: SectorPerformance[] }) {
  const strong = [...sectors].filter((sector) => sector.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, 4);
  const weak = [...sectors].filter((sector) => sector.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, 4);
  const neutralCount = sectors.filter((sector) => sector.changePercent === 0).length;
  const hasSplit = strong.length > 0 && weak.length > 0;
  const hasSectorData = sectors.length > 0;
  const sectorTone = !hasSectorData ? "neutral" : hasSplit ? "warn" : strong.length > 0 ? "good" : "bad";
  const sectorLabel = !hasSectorData ? "暂无" : hasSplit ? "分化" : strong.length > 0 ? "偏强" : "偏弱";
  const summary = sectors.length === 0
    ? "当前板块数据暂无，板块维度未纳入温度辅助观察。"
    : hasSplit
      ? `强弱板块并存：${strong.length} 个偏强、${weak.length} 个偏弱，市场结构偏分化。`
      : strong.length > 0
        ? `板块表现偏强：${strong.length} 个板块上涨，暂未发现同步走弱板块。`
        : `板块表现偏弱：${weak.length} 个板块下跌，强势方向暂不明显。`;

  return (
    <section className="panel sector-panel">
      <div className="panel-header compact-header">
        <h2>板块强弱观察</h2>
        <Flame size={18} />
      </div>
      <div className={`sector-summary ${sectorTone}`}>
        <strong>{sectorLabel}</strong>
        <span>{summary}</span>
      </div>
      <div className="sector-columns">
        <SectorGroup title="强势板块" sectors={strong} emptyLabel="暂无明显强势板块" />
        <SectorGroup title="弱势板块" sectors={weak} emptyLabel="暂无明显弱势板块" />
      </div>
      {neutralCount > 0 ? <p className="sector-footnote">另有 {neutralCount} 个板块涨跌幅持平；板块提示只作为市场温度辅助观察。</p> : <p className="sector-footnote">板块提示只作为市场温度辅助观察，不覆盖市场温度主标签。</p>}
    </section>
  );
}

function SectorGroup({ title, sectors, emptyLabel }: { title: string; sectors: SectorPerformance[]; emptyLabel: string }) {
  return (
    <div className="sector-group">
      <div className="sector-group-header">
        <strong>{title}</strong>
        <span>{sectors.length}</span>
      </div>
      <div className="sector-list heat-list">
        {sectors.length > 0 ? sectors.map((sector) => (
          <div className="sector-row heat-row" key={`${title}-${sector.name}`}>
            <div>
              <strong>{sector.name}</strong>
              <span>{sector.type || "行业"} · 龙头 {sector.leader || "待确认"}</span>
            </div>
            <div>
              <em className={toneClass(sector.changePercent)}>{formatPercent(sector.changePercent)}</em>
              <span>资金 {sector.netInflow === undefined ? "待接" : formatMoney(sector.netInflow)}</span>
            </div>
          </div>
        )) : <div className="sector-empty">{emptyLabel}</div>}
      </div>
    </div>
  );
}

function MarketAlerts({ alerts }: { alerts: MarketAlert[] }) {
  const summary = getAlertSummary(alerts);

  return (
    <section className="panel alert-panel">
      <div className="panel-header compact-header">
        <h2>异动提醒</h2>
        <Bell size={17} />
      </div>
      <div className="alert-summary-grid">
        <MiniStat label="已确认" value={`${summary.confirmed}`} tone={summary.confirmed > 0 ? 1 : 0} />
        <MiniStat label="待复核" value={`${summary.needsConfirm}`} tone={summary.needsConfirm > 0 ? 0 : 1} />
        <MiniStat label="不可判定" value={`${summary.unavailable}`} tone={summary.unavailable > 0 ? -1 : 0} />
        <MiniStat label="高风险" value={`${summary.high}`} tone={summary.high > 0 ? -1 : 0} />
      </div>
      <p className="alert-boundary-note">异动数量只用于辅助解释；个股级或待复核信号不覆盖市场温度主标签。</p>
      <div className="alert-list">
        {alerts.map((alert) => (
          <div className={`alert-row alert-${alert.level} ${alert.credibility}`} key={`${alert.title}-${alert.detail}`}>
            <div className="alert-row-header">
              <strong>{alert.title}</strong>
              <div className="alert-badges" aria-label="\u98ce\u9669\u7b49\u7ea7\u548c\u53ef\u4fe1\u5ea6">
                <span className={`level-badge ${alert.level}`}>{alertLevelLabel[alert.level]}</span>
                <span className={`credibility-badge ${alert.credibility}`}>{credibilityLabel[alert.credibility]}</span>
              </div>
            </div>
            <p>{alert.detail}</p>
            <div className="alert-meta">
              <span>倾向：{alert.actionTone}</span>
              <span>范围：{alertScopeLabel[alert.scope]}</span>
              <span>来源：{alert.dataSources.join(" / ")}</span>
              {alert.missingFields && alert.missingFields.length > 0 ? <span>待确认：{alert.missingFields.join("、")}</span> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getAlertSummary(alerts: MarketAlert[]) {
  const activeAlerts = alerts.filter((alert) => !alert.isPlaceholder);
  return {
    confirmed: activeAlerts.filter((alert) => alert.credibility === "confirmed").length,
    needsConfirm: activeAlerts.filter((alert) => alert.credibility === "needsConfirm").length,
    unavailable: activeAlerts.filter((alert) => alert.credibility === "unavailable").length,
    high: activeAlerts.filter((alert) => alert.level === "high").length
  };
}

function MiniStat({ label, value, tone, title }: { label: string; value: string; tone?: number; title?: string }) {
  return (
    <div className="mini-stat" title={title}>
      <span>{label}</span>
      <strong className={tone === undefined ? undefined : toneClass(tone)}>{value}</strong>
    </div>
  );
}

function formatFlowMoney(value: number): string {
  if (value === 0) return "0.00亿";
  return formatMoney(value);
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`tab-button ${active ? "active" : ""}`} type="button" onClick={onClick}>
      {label}
    </button>
  );
}

function findIndex(indexes: MarketIndex[], name: string): MarketIndex | undefined {
  return indexes.find((index) => index.name.includes(name) || name.includes(index.name));
}

function buildMarketStats(overview: MarketOverview | null, watchQuotes: Quote[]): MarketStats {
  if (overview?.marketStats) return overview.marketStats;
  const quotes = [...(overview?.gainers || []), ...(overview?.losers || []), ...watchQuotes];
  const unique = Array.from(new Map(quotes.map((quote) => [quote.symbol, quote])).values());
  return {
    risingCount: unique.filter((quote) => quote.changePercent > 0).length,
    fallingCount: unique.filter((quote) => quote.changePercent < 0).length,
    flatCount: unique.filter((quote) => quote.changePercent === 0).length,
    limitUpCount: unique.filter((quote) => quote.changePercent >= 9.8).length,
    limitDownCount: unique.filter((quote) => quote.changePercent <= -9.8).length,
    totalAmount: unique.reduce((sum, quote) => sum + quote.amount, 0),
    activeAmount: unique.filter((quote) => Math.abs(quote.changePercent) >= 3).reduce((sum, quote) => sum + quote.amount, 0),
    mainNetInflow: 0,
    mainFundAvailable: false,
    mainFundSource: "东方财富全市场快照 f62 主力净流入汇总",
    northboundNetInflow: 0,
    northboundAvailable: false,
    northboundSource: "北向实时净买额不再作为首页指标展示"
  };
}

function getRankingQuotes(overview: MarketOverview | null, tab: RankingTab): RankingItem[] {
  if (!overview) return [];
  if (tab === "gainers") return overview.gainers;
  if (tab === "losers") return overview.losers;
  if (tab === "amount") return overview.amountRanking || [...overview.gainers, ...overview.losers].sort((a, b) => b.amount - a.amount).slice(0, 10);
  return overview.turnoverRanking || [];
}

function buildMarketAlerts(overview: MarketOverview | null, watchQuotes: Quote[]): MarketAlert[] {
  const quotes = Array.from(new Map([...(overview?.gainers || []), ...(overview?.losers || []), ...(overview?.amountRanking || []), ...watchQuotes].map((quote) => [quote.symbol, quote])).values());
  const alerts: MarketAlert[] = [];
  const overviewCredibility = getOverviewCredibility(overview?._dataStatus);
  const overviewSource = getStatusSourceLabel(overview?._dataStatus);
  const strong = quotes.find((quote) => quote.changePercent >= 7 && quote.amount > 100_000_000);
  const weak = quotes.find((quote) => quote.changePercent <= -5 && quote.amount > 100_000_000);
  const active = quotes.find((quote) => quote.amount > 5_000_000_000);
  const watchRisk = watchQuotes.find((quote) => quote.changePercent <= -3);

  if (strong) {
    alerts.push({
      level: "medium",
      title: `${strong.name} 涨幅靠前且成交活跃`,
      detail: `涨幅 ${formatPercent(strong.changePercent)}，成交额 ${formatMoney(strong.amount)}。这是行情快照初筛；是否放量需结合K线量比确认。`,
      credibility: overviewCredibility === "confirmed" ? "needsConfirm" : overviewCredibility,
      actionTone: "保持谨慎",
      dataSources: [overviewSource],
      missingFields: ["K线量比", "个股资金流"],
      scope: "ranking"
    });
  }

  if (weak) {
    alerts.push({
      level: "high",
      title: `${weak.name} 跌幅靠前且成交活跃`,
      detail: `跌幅 ${formatPercent(weak.changePercent)}，成交额 ${formatMoney(weak.amount)}。这是行情快照初筛；是否放量下跌需结合K线量比、均线和资金流确认。`,
      credibility: overviewCredibility === "confirmed" ? "needsConfirm" : overviewCredibility,
      actionTone: "保持谨慎",
      dataSources: [overviewSource],
      missingFields: ["K线量比", "均线位置", "个股资金流"],
      scope: "ranking"
    });
  }

  if (active) {
    alerts.push({
      level: "low",
      title: `${active.name} 成交额靠前`,
      detail: `成交额 ${formatMoney(active.amount)}，说明当前交易活跃；这不等同于相对历史放量。`,
      credibility: overviewCredibility,
      actionTone: "适合关注",
      dataSources: [overviewSource],
      missingFields: overviewCredibility === "confirmed" ? [] : ["实时源状态"],
      scope: "ranking"
    });
  }

  if (watchRisk) {
    alerts.push({
      level: "medium",
      title: `自选股 ${watchRisk.name} 跌幅扩大`,
      detail: `跌幅 ${formatPercent(watchRisk.changePercent)}。当前只基于自选股报价初筛，均线支撑、量能和资金流仍需进入详情页复核。`,
      credibility: "needsConfirm",
      actionTone: "保持谨慎",
      dataSources: ["自选股 quote"],
      missingFields: ["K线均线", "分时走势", "个股资金流"],
      scope: "watchlist"
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      level: "low",
      title: "暂无明显快照异动",
      detail: "当前首页快照未触发涨跌幅、成交额或自选股初筛阈值，继续观察指数方向和板块轮动。",
      credibility: overviewCredibility,
      actionTone: "保持谨慎",
      dataSources: [overviewSource],
      scope: "market",
      isPlaceholder: true
    });
  }

  return alerts;
}

function getOverviewCredibility(status?: DataStatus): AlertCredibility {
  if (!status) return "needsConfirm";
  if (status.provider === "mock" || status.mode === "fallback") return "unavailable";
  if (status.mode === "stale" || status.warning) return "needsConfirm";
  if (status.mode === "live" || status.mode === "fresh") return "confirmed";
  return "needsConfirm";
}

function getStatusSourceLabel(status?: DataStatus): string {
  if (!status) return "overview: 状态未知";
  return `overview: ${status.mode}${status.provider === "cache" ? "/cache" : `/${status.provider}`}`;
}

function getMarketMood(stats: MarketStats, overview: MarketOverview | null): MarketMood {
  const net = stats.risingCount - stats.fallingCount;
  const total = Math.max(1, stats.risingCount + stats.fallingCount + stats.flatCount);
  const riseRatio = stats.risingCount / total;
  const activeRatio = stats.activeAmount > 0 && stats.totalAmount > 0 ? stats.activeAmount / stats.totalAmount : 0;
  const indexes = (overview?.indexes || []).filter((index) => index.latestPrice > 0);
  const risingIndexes = indexes.filter((index) => index.changePercent > 0).length;
  const fallingIndexes = indexes.filter((index) => index.changePercent < 0).length;
  const sectors = overview?.sectors || [];
  const risingSectors = sectors.filter((sector) => sector.changePercent > 0).length;
  const fallingSectors = sectors.filter((sector) => sector.changePercent < 0).length;
  const confidence = getDataConfidence(overview?._dataStatus);
  const reasons: string[] = [];

  const addReason = (reason: string) => {
    if (reasons.length < 4) reasons.push(reason);
  };

  addReason(`涨跌家数 ${stats.risingCount} / ${stats.fallingCount}`);
  addReason(`涨停/跌停 ${stats.limitUpCount} / ${stats.limitDownCount}`);
  if (indexes.length > 0) addReason(`指数 ${risingIndexes} 涨 ${fallingIndexes} 跌`);
  if (sectors.length > 0) addReason(`板块 ${risingSectors} 涨 ${fallingSectors} 跌`);

  if (confidence.confidence === "低") {
    return {
      label: "震荡",
      tone: "warn",
      summary: "数据源处于兜底或不可确认状态，市场温度只做流程观察。",
      reasons,
      dataConfidence: confidence.confidence,
      dataNote: confidence.note
    };
  }

  const indexMostlyUp = indexes.length === 0 || risingIndexes >= fallingIndexes;
  const indexMostlyDown = indexes.length > 0 && fallingIndexes > risingIndexes;
  const breadthStrong = riseRatio >= 0.58 || net > 300;
  const breadthWeak = riseRatio <= 0.42 || net < -300;
  const limitStrong = stats.limitUpCount >= stats.limitDownCount;
  const limitWeak = stats.limitDownCount > stats.limitUpCount;
  const activeOk = activeRatio >= 0.18 || stats.totalAmount > 0;
  const sectorMixed = risingSectors > 0 && fallingSectors > 0 && Math.min(risingSectors, fallingSectors) >= Math.max(2, Math.floor(sectors.length * 0.25));
  const indexMixed = risingIndexes > 0 && fallingIndexes > 0;
  const breadthIndexDivergence = (breadthStrong && indexMostlyDown) || (breadthWeak && indexMostlyUp);
  const limitMixed = stats.limitUpCount > 0 && stats.limitDownCount > 0 && Math.abs(stats.limitUpCount - stats.limitDownCount) <= Math.max(stats.limitUpCount, stats.limitDownCount) * 0.6;

  if (breadthStrong && limitStrong && indexMostlyUp && activeOk) {
    return {
      label: "强势",
      tone: "good",
      summary: "上涨家数和指数方向占优，成交活跃度未拖累。",
      reasons,
      dataConfidence: confidence.confidence,
      dataNote: confidence.note
    };
  }

  if (breadthWeak && limitWeak && indexMostlyDown) {
    return {
      label: "弱势",
      tone: "bad",
      summary: "下跌家数、跌停压力或指数方向同步偏弱。",
      reasons,
      dataConfidence: confidence.confidence,
      dataNote: confidence.note
    };
  }

  if (sectorMixed || indexMixed || breadthIndexDivergence || limitMixed) {
    return {
      label: "分化",
      tone: "warn",
      summary: "指数、涨跌家数或板块表现不一致，适合先做结构观察。",
      reasons,
      dataConfidence: confidence.confidence,
      dataNote: confidence.note
    };
  }

  return {
    label: "震荡",
    tone: "warn",
    summary: "涨跌力量接近均衡，暂未形成明确单边温度。",
    reasons,
    dataConfidence: confidence.confidence,
    dataNote: confidence.note
  };
}

function getDataConfidence(status?: DataStatus): { confidence: DataConfidence; note: string } {
  if (!status) return { confidence: "中", note: "数据状态未知，需结合刷新结果复核。" };
  const provider = status.sourceProvider || status.provider;
  const ageText = status.cacheAgeSeconds > 0 ? `，缓存约 ${formatAge(status.cacheAgeSeconds)}` : "";
  if (status.provider === "mock" || status.mode === "fallback") {
    return { confidence: "低", note: `源站不可确认，当前使用 ${provider} 兜底${ageText}。` };
  }
  if (status.mode === "stale" || status.warning) {
    return { confidence: "中", note: `原始来源 ${provider}，当前有降级提示${ageText}${status.warning ? `：${status.warning}` : "。"}` };
  }
  if (status.mode === "live") {
    return { confidence: "高", note: `原始来源 ${provider}，读取实时源。` };
  }
  if (status.mode === "fresh") {
    return { confidence: "高", note: `原始来源 ${provider}，读取新鲜缓存${ageText}。` };
  }
  return { confidence: "中", note: `原始来源 ${provider}，状态 ${status.mode}${ageText}。` };
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  return `${Math.round(seconds / 3600)} 小时`;
}

function getRiskLevel(stats: MarketStats, riseRatio: number): { label: string; toneValue: number } {
  if (riseRatio < 35 || stats.limitDownCount > stats.limitUpCount) return { label: "偏高", toneValue: -1 };
  if (riseRatio > 58 && stats.limitUpCount >= stats.limitDownCount) return { label: "较低", toneValue: 1 };
  return { label: "中性", toneValue: 0 };
}

function getMarketSessionLabel(): string {
  const hour = new Date().getHours();
  if (hour < 9) return "盘前观察";
  if (hour < 15) return "盘中跟踪";
  return "盘后复盘";
}

const alertScopeLabel: Record<AlertScope, string> = {
  market: "市场级",
  ranking: "排行初筛",
  watchlist: "自选股"
};

const credibilityLabel: Record<AlertCredibility, string> = {
  confirmed: "已确认",
  needsConfirm: "待复核",
  unavailable: "不可判定"
};

const alertLevelLabel: Record<AlertLevel, string> = {
  high: "\u9ad8\u98ce\u9669",
  medium: "\u4e2d\u98ce\u9669",
  low: "\u4f4e\u98ce\u9669"
};

const confidenceTone: Record<DataConfidence, number> = {
  高: 1,
  中: 0,
  低: -1
};

const rankingTitle: Record<RankingTab, string> = {
  gainers: "涨幅榜",
  losers: "跌幅榜",
  amount: "成交额榜",
  turnover: "换手率榜"
};

const rankingDefaultSort: Record<RankingTab, { key: "changePercent" | "amount" | "turnoverRate"; direction: "asc" | "desc" }> = {
  gainers: { key: "changePercent", direction: "desc" },
  losers: { key: "changePercent", direction: "asc" },
  amount: { key: "amount", direction: "desc" },
  turnover: { key: "turnoverRate", direction: "desc" }
};























