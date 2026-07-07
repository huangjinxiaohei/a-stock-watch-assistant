export type MarketTone = "up" | "down" | "flat";

export interface DataStatus {
  provider: string;
  sourceProvider?: string;
  mode: "live" | "fresh" | "stale" | "fallback" | string;
  cacheAgeSeconds: number;
  updatedAt?: number | null;
  warning?: string;
  coverageNote?: string;
}

export interface StockSummary {
  symbol: string;
  code: string;
  name: string;
  market: "SH" | "SZ" | "BJ";
  industry: string;
}

export interface Quote extends StockSummary {
  latestPrice: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  amount: number;
  turnoverRate: number;
  pe: number;
  pb: number;
  totalMarketCap: number;
  floatMarketCap: number;
  updateTime: string;
}

export interface MarketIndex {
  code: string;
  name: string;
  latestPrice: number;
  changePercent: number;
  amount: number;
}

export interface MarketStats {
  risingCount: number;
  fallingCount: number;
  flatCount: number;
  limitUpCount: number;
  limitDownCount: number;
  totalAmount: number;
  activeAmount: number;
  mainNetInflow: number;
  mainFundAvailable?: boolean;
  mainFundSource?: string;
  northboundNetInflow: number;
  northboundAvailable?: boolean;
  northboundSource?: string;
}

export interface SectorPerformance {
  name: string;
  type?: "行业" | "概念" | "市场" | string;
  changePercent: number;
  leader: string;
  turnover: number;
  netInflow?: number;
}

export interface RankingItem extends Quote {
  rankReason: string;
}

export interface MarketOverview {
  indexes: MarketIndex[];
  marketStats?: MarketStats;
  sectors: SectorPerformance[];
  gainers: RankingItem[];
  losers: RankingItem[];
  amountRanking?: RankingItem[];
  turnoverRanking?: RankingItem[];
  _dataStatus?: DataStatus;
}

export interface DataAvailability {
  available?: boolean;
  source?: string;
  warning?: string;
  asOfDate?: string;
}

export interface FinanceMetrics extends DataAvailability {
  revenueGrowth: number;
  netProfitGrowth: number;
  grossMargin: number;
  roe: number;
  debtRatio: number;
  eps: number;
}

export interface MoneyFlow extends DataAvailability {
  mainNetInflow: number;
  retailNetInflow: number;
  largeOrderRatio: number;
  fiveDayMainNetInflow: number;
}

export interface NewsItem {
  id: string;
  title: string;
  source: string;
  publishedAt: string;
  url?: string;
  sentiment: "positive" | "neutral" | "negative";
}

export interface StockDetail {
  quote: Quote;
  finance: FinanceMetrics;
  moneyFlow: MoneyFlow;
  news: NewsItem[];
  _dataStatus?: DataStatus;
}

export interface IntradayPoint {
  time: string;
  price: number;
  averagePrice: number;
  volume: number;
}

export interface KlinePoint {
  date: string;
  open: number;
  close: number;
  low: number;
  high: number;
  volume: number;
  ma5: number;
  ma10: number;
  ma20: number;
}

export interface DataSeries<T> {
  items: T[];
  _dataStatus?: DataStatus;
}

export interface StockDataProvider {
  searchStocks(keyword: string): Promise<StockSummary[]>;
  getMarketOverview(): Promise<MarketOverview>;
  getStockDetail(symbol: string): Promise<StockDetail>;
  getIntraday(symbol: string): Promise<DataSeries<IntradayPoint>>;
  getKline(symbol: string): Promise<DataSeries<KlinePoint>>;
}

