import type { DataSeries, IntradayPoint, KlinePoint, StockDataProvider, StockSummary } from "./types";

const requestTimeoutMs = 30000;

function normalizeSeries<T>(value: T[] | DataSeries<T>): DataSeries<T> {
  return Array.isArray(value) ? { items: value } : value;
}

function normalizeItems<T>(value: T[] | DataSeries<T>): T[] {
  return normalizeSeries(value).items;
}

export function createHttpStockDataProvider(baseUrl: string): StockDataProvider {
  const request = async <T>(path: string): Promise<T> => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: { accept: "application/json" },
        signal: controller.signal
      });

      if (!response.ok) {
        throw new Error(`行情接口请求失败：${response.status} ${response.statusText}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("行情接口响应超时，请稍后重试");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  };

  return {
    searchStocks: async (keyword) => normalizeItems<StockSummary>(await request<StockSummary[] | DataSeries<StockSummary>>(`/stocks/search?keyword=${encodeURIComponent(keyword)}`)),
    getMarketOverview: () => request("/market/overview"),
    getStockDetail: (symbol) => request(`/stocks/${encodeURIComponent(symbol)}`),
    getIntraday: async (symbol) => normalizeSeries<IntradayPoint>(await request<IntradayPoint[] | DataSeries<IntradayPoint>>(`/stocks/${encodeURIComponent(symbol)}/intraday`)),
    getKline: async (symbol) => normalizeSeries<KlinePoint>(await request<KlinePoint[] | DataSeries<KlinePoint>>(`/stocks/${encodeURIComponent(symbol)}/kline`))
  };
}



