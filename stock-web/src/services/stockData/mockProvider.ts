import { buildIntraday, buildKline, financeSeed, getQuote, moneyFlowSeed, newsSeed, stockUniverse } from "./mockData";
import type { DataStatus, MarketOverview, StockDataProvider, StockSummary } from "./types";

const latency = 220;

export const mockStockDataProvider: StockDataProvider = {
  async searchStocks(keyword: string): Promise<StockSummary[]> {
    await wait(latency);
    const normalized = keyword.trim().toLowerCase();

    if (!normalized) {
      return stockUniverse.slice(0, 5);
    }

    return stockUniverse.filter((stock) => {
      return (
        stock.code.includes(normalized) ||
        stock.symbol.toLowerCase().includes(normalized) ||
        stock.name.toLowerCase().includes(normalized) ||
        stock.industry.toLowerCase().includes(normalized)
      );
    });
  },

  async getMarketOverview(): Promise<MarketOverview> {
    await wait(latency);
    const quotes = stockUniverse.map((stock) => getQuote(stock.symbol));
    const sorted = [...quotes].sort((a, b) => b.changePercent - a.changePercent);

    return {
      indexes: [
        { code: "000001.SH", name: "上证指数", latestPrice: 3238.42, changePercent: 0.42, amount: 431200000000 },
        { code: "399001.SZ", name: "深证成指", latestPrice: 10486.31, changePercent: 0.86, amount: 562800000000 },
        { code: "399006.SZ", name: "创业板指", latestPrice: 2118.6, changePercent: 1.38, amount: 241500000000 }
      ],
      sectors: [
        { name: "电池", changePercent: 3.28, leader: "宁德时代", turnover: 12860000000 },
        { name: "汽车整车", changePercent: 1.62, leader: "比亚迪", turnover: 9860000000 },
        { name: "白酒", changePercent: 1.18, leader: "贵州茅台", turnover: 6340000000 },
        { name: "半导体", changePercent: -2.14, leader: "中芯国际", turnover: 11280000000 },
        { name: "保险", changePercent: -1.55, leader: "中国平安", turnover: 6720000000 }
      ],
      gainers: sorted.slice(0, 4).map((quote) => ({
        ...quote,
        rankReason: quote.changePercent > 3 ? "放量反弹" : "稳步走强"
      })),
      losers: sorted.slice(-4).reverse().map((quote) => ({
        ...quote,
        rankReason: quote.changePercent < -3 ? "资金流出" : "短线回调"
      }))
    };
  },

  async getStockQuote(symbol: string) {
    await wait(latency);
    return { ...getQuote(symbol), _dataStatus: mockStatus };
  },

  async getStockDetail(symbol: string) {
    await wait(latency);
    const quote = getQuote(symbol);

    return {
      quote,
      finance: financeSeed[symbol],
      moneyFlow: moneyFlowSeed[symbol],
      news: newsSeed[symbol] ?? []
    };
  },

  async getIntraday(symbol: string) {
    await wait(latency);
    return { items: buildIntraday(symbol), _dataStatus: mockStatus };
  },

  async getKline(symbol: string) {
    await wait(latency);
    return { items: buildKline(symbol), _dataStatus: mockStatus };
  }
};

const mockStatus: DataStatus = {
  provider: "mock",
  sourceProvider: "mock",
  mode: "fallback",
  cacheAgeSeconds: 0,
  updatedAt: null,
  warning: "本地模拟数据，仅用于流程演示"
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

