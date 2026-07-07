import { ArrowLeft, RefreshCw, Star } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { generateStockAnalysis } from "../analysis/stockAnalysis";
import { AnalysisPanel, RiskPanel } from "../components/AnalysisPanel";
import type { KlineIndicator } from "../components/Charts";
import { DataSourceStatus } from "../components/DataSourceStatus";
import { FinancePanel, MoneyFlowPanel, NewsPanel } from "../components/InfoPanels";
import { QuoteCard } from "../components/QuoteCard";
import { ErrorState, LoadingState } from "../components/StateViews";
import { refreshIntervalMs, stockDataProvider, type DataStatus, type FinanceMetrics, type IntradayPoint, type KlinePoint, type MoneyFlow, type QuoteWithStatus, type StockDetail } from "../services/stockData";

interface StockDetailPageProps {
  symbol: string;
  onBack: () => void;
  onAddWatch: (symbol: string) => void;
}

const IntradayChart = lazy(() => import("../components/Charts").then((module) => ({ default: module.IntradayChart })));
const KlineChart = lazy(() => import("../components/Charts").then((module) => ({ default: module.KlineChart })));
type KlinePeriod = "day" | "week" | "month";

export function StockDetailPage({ symbol, onBack, onAddWatch }: StockDetailPageProps) {
  const [detail, setDetail] = useState<StockDetail | null>(null);
  const [intraday, setIntraday] = useState<IntradayPoint[]>([]);
  const [kline, setKline] = useState<KlinePoint[]>([]);
  const [intradayStatus, setIntradayStatus] = useState<DataStatus | undefined>();
  const [klineStatus, setKlineStatus] = useState<DataStatus | undefined>();
  const [period, setPeriod] = useState<KlinePeriod>("day");
  const [indicator, setIndicator] = useState<KlineIndicator>("volume");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    let quoteReady = false;

    try {
      const nextQuote = await stockDataProvider.getStockQuote(symbol);
      quoteReady = true;
      setDetail((current) => current ? { ...current, quote: nextQuote, _dataStatus: nextQuote._dataStatus ?? current._dataStatus } : buildQuoteOnlyDetail(nextQuote));
      setLoading(false);
    } catch {
      // Full detail still has a chance to provide quote data below.
    }

    const [nextDetail, nextIntraday, nextKline] = await Promise.allSettled([
      stockDataProvider.getStockDetail(symbol),
      stockDataProvider.getIntraday(symbol),
      stockDataProvider.getKline(symbol)
    ]);

    const failedSections: string[] = [];
    if (nextDetail.status === "fulfilled") {
      setDetail(nextDetail.value);
      quoteReady = true;
    } else {
      failedSections.push("\u57fa\u672c\u9762/\u8d44\u91d1/\u65b0\u95fb");
    }

    if (nextIntraday.status === "fulfilled") {
      setIntraday(nextIntraday.value.items);
      setIntradayStatus(nextIntraday.value._dataStatus);
    } else {
      failedSections.push("\u5206\u65f6\u8d70\u52bf");
    }

    if (nextKline.status === "fulfilled") {
      setKline(nextKline.value.items);
      setKlineStatus(nextKline.value._dataStatus);
    } else {
      failedSections.push("K\u7ebf\u6570\u636e");
    }

    if (failedSections.length > 0) {
      setError(quoteReady ? `\u90e8\u5206\u6570\u636e\u52a0\u8f7d\u8f83\u6162\uff1a${failedSections.join("\u3001")}\u3002\u5df2\u5148\u663e\u793a\u53ef\u7528\u884c\u60c5\u3002` : "\u4e2a\u80a1\u884c\u60c5\u52a0\u8f7d\u5931\u8d25");
    }
    setLoading(false);
  }, [symbol]);


  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const timer = window.setInterval(() => void load(), refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [load]);

  const displayedKline = useMemo(() => aggregateKline(kline, period), [kline, period]);
  const analysis = useMemo(() => {
    if (!detail || kline.length === 0) return null;
    return generateStockAnalysis(detail.quote, kline, detail.moneyFlow);
  }, [detail, kline]);

  if (loading && !detail) {
    return <LoadingState label="正在加载个股详情" />;
  }

  if (error && !detail) {
    return <ErrorState message={error} onRetry={load} />;
  }

  if (!detail) {
    return <ErrorState message="未找到该股票" onRetry={onBack} />;
  }

  return (
    <main className="page terminal-page">
      <div className="detail-toolbar terminal-toolbar">
        <button className="secondary-button" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          返回首页
        </button>
        <div>
          <button className="secondary-button" type="button" onClick={() => onAddWatch(symbol)}>
            <Star size={16} />
            加入自选
          </button>
          <button className="secondary-button" type="button" onClick={load}>
            <RefreshCw size={16} />
            刷新
          </button>
        </div>
      </div>

      {error ? <ErrorState message={error} onRetry={load} /> : null}

      <section className="stock-workspace-grid">
        <QuoteCard quote={detail.quote} />

        <section className="panel chart-workbench">
          <div className="panel-header compact-header chart-panel-header">
            <h2>走势与技术指标</h2>
            <div className="chart-controls">
              <div className="tab-strip" aria-label="K线周期">
                <TabButton label="日K" active={period === "day"} onClick={() => setPeriod("day")} />
                <TabButton label="周K" active={period === "week"} onClick={() => setPeriod("week")} />
                <TabButton label="月K" active={period === "month"} onClick={() => setPeriod("month")} />
              </div>
              <div className="tab-strip" aria-label="技术指标">
                <TabButton label="成交量" active={indicator === "volume"} onClick={() => setIndicator("volume")} />
                <TabButton label="MACD" active={indicator === "macd"} onClick={() => setIndicator("macd")} />
                <TabButton label="KDJ" active={indicator === "kdj"} onClick={() => setIndicator("kdj")} />
                <TabButton label="RSI" active={indicator === "rsi"} onClick={() => setIndicator("rsi")} />
                <TabButton label="BOLL" active={indicator === "boll"} onClick={() => setIndicator("boll")} />
              </div>
            </div>
          </div>
          <Suspense fallback={<LoadingState label="正在加载图表" />}>
            <div className="dual-chart-grid">
              <IntradayChart title="分时走势 + 成交量" intraday={intraday} />
              <KlineChart title={`${periodLabel[period]} + ${indicatorLabel[indicator]}`} kline={displayedKline} indicator={indicator} />
            </div>
          </Suspense>
        </section>

        {analysis ? <AnalysisPanel analysis={analysis} /> : null}
      </section>

      <div className="detail-info-grid">
        {analysis ? <RiskPanel risks={analysis.risks} /> : null}
        <MoneyFlowPanel moneyFlow={detail.moneyFlow} />
        <FinancePanel finance={detail.finance} coverageNote={detail._dataStatus?.coverageNote} />
        <section className="panel">
          <div className="panel-header compact-header">
            <h2>数据源状态</h2>
          </div>
          <div className="status-stack">
            <DataSourceStatus label="个股详情" status={detail._dataStatus} />
            <DataSourceStatus label="分时走势" status={intradayStatus} />
            <DataSourceStatus label="K线数据" status={klineStatus} />
          </div>
        </section>
      </div>

      <NewsPanel news={detail.news} />
    </main>
  );
}

const pendingFinance: FinanceMetrics = {
  revenueGrowth: 0,
  netProfitGrowth: 0,
  grossMargin: 0,
  roe: 0,
  debtRatio: 0,
  eps: 0,
  available: false,
  source: "\u540e\u53f0\u52a0\u8f7d\u4e2d",
  asOfDate: "",
  warning: "\u8d22\u52a1\u6307\u6807\u6b63\u5728\u540e\u53f0\u52a0\u8f7d\uff0c\u6682\u672a\u7eb3\u5165\u590d\u6838\u3002"
};

const pendingMoneyFlow: MoneyFlow = {
  mainNetInflow: 0,
  retailNetInflow: 0,
  largeOrderRatio: 0,
  fiveDayMainNetInflow: 0,
  available: false,
  source: "\u540e\u53f0\u52a0\u8f7d\u4e2d",
  asOfDate: "",
  warning: "\u4e2a\u80a1\u8d44\u91d1\u6d41\u6b63\u5728\u540e\u53f0\u52a0\u8f7d\uff0c\u8d44\u91d1\u7ef4\u5ea6\u6682\u672a\u7eb3\u5165\u98ce\u9669\u786e\u8ba4\u3002"
};

function buildQuoteOnlyDetail(quote: QuoteWithStatus): StockDetail {
  return {
    quote,
    finance: pendingFinance,
    moneyFlow: pendingMoneyFlow,
    news: [],
    _dataStatus: quote._dataStatus
  };
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`tab-button ${active ? "active" : ""}`} type="button" onClick={onClick}>
      {label}
    </button>
  );
}

function aggregateKline(points: KlinePoint[], period: KlinePeriod): KlinePoint[] {
  if (period === "day") return points;
  const size = period === "week" ? 5 : 20;
  const groups: KlinePoint[][] = [];
  for (let index = 0; index < points.length; index += size) {
    groups.push(points.slice(index, index + size));
  }
  const aggregated = groups.filter((group) => group.length > 0).map((group) => {
    const closes = group.map((item) => item.close);
    const base = {
      date: group[group.length - 1].date,
      open: group[0].open,
      close: group[group.length - 1].close,
      low: Math.min(...group.map((item) => item.low)),
      high: Math.max(...group.map((item) => item.high)),
      volume: group.reduce((sum, item) => sum + item.volume, 0),
      ma5: 0,
      ma10: 0,
      ma20: 0
    };
    return { ...base, ma5: average(closes), ma10: average(closes), ma20: average(closes) };
  });
  return recalcMa(aggregated);
}

function recalcMa(points: KlinePoint[]): KlinePoint[] {
  return points.map((point, index) => ({
    ...point,
    ma5: ma(points, index, 5),
    ma10: ma(points, index, 10),
    ma20: ma(points, index, 20)
  }));
}

function ma(points: KlinePoint[], index: number, window: number): number {
  const start = Math.max(0, index - window + 1);
  return average(points.slice(start, index + 1).map((point) => point.close));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

const periodLabel: Record<KlinePeriod, string> = {
  day: "日K",
  week: "周K",
  month: "月K"
};

const indicatorLabel: Record<KlineIndicator, string> = {
  volume: "成交量",
  macd: "MACD",
  kdj: "KDJ",
  rsi: "RSI",
  boll: "BOLL"
};


