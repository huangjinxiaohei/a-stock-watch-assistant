import type {
  FinanceMetrics,
  IntradayPoint,
  KlinePoint,
  MoneyFlow,
  NewsItem,
  Quote,
  StockSummary
} from "./types";

export const stockUniverse: StockSummary[] = [
  { symbol: "SH600519", code: "600519", name: "贵州茅台", market: "SH", industry: "白酒" },
  { symbol: "SZ000001", code: "000001", name: "平安银行", market: "SZ", industry: "银行" },
  { symbol: "SZ300750", code: "300750", name: "宁德时代", market: "SZ", industry: "电池" },
  { symbol: "SH600036", code: "600036", name: "招商银行", market: "SH", industry: "银行" },
  { symbol: "SH601318", code: "601318", name: "中国平安", market: "SH", industry: "保险" },
  { symbol: "SZ002594", code: "002594", name: "比亚迪", market: "SZ", industry: "汽车整车" },
  { symbol: "SH688981", code: "688981", name: "中芯国际", market: "SH", industry: "半导体" }
];

const quoteSeed: Record<string, Omit<Quote, keyof StockSummary | "updateTime">> = {
  SH600519: {
    latestPrice: 1488.6,
    change: 18.4,
    changePercent: 1.25,
    open: 1462.1,
    high: 1496.8,
    low: 1458.2,
    previousClose: 1470.2,
    volume: 3276000,
    amount: 4863000000,
    turnoverRate: 0.26,
    pe: 24.8,
    pb: 8.1,
    totalMarketCap: 1869700000000,
    floatMarketCap: 1869700000000
  },
  SZ000001: {
    latestPrice: 11.28,
    change: -0.18,
    changePercent: -1.57,
    open: 11.44,
    high: 11.52,
    low: 11.18,
    previousClose: 11.46,
    volume: 88240000,
    amount: 998000000,
    turnoverRate: 0.45,
    pe: 4.7,
    pb: 0.52,
    totalMarketCap: 218900000000,
    floatMarketCap: 218600000000
  },
  SZ300750: {
    latestPrice: 196.72,
    change: 7.96,
    changePercent: 4.22,
    open: 188.1,
    high: 199.48,
    low: 187.62,
    previousClose: 188.76,
    volume: 51620000,
    amount: 10085000000,
    turnoverRate: 1.32,
    pe: 20.6,
    pb: 4.28,
    totalMarketCap: 865500000000,
    floatMarketCap: 768200000000
  },
  SH600036: {
    latestPrice: 35.42,
    change: 0.36,
    changePercent: 1.03,
    open: 35.02,
    high: 35.68,
    low: 34.92,
    previousClose: 35.06,
    volume: 54280000,
    amount: 1918000000,
    turnoverRate: 0.26,
    pe: 6.2,
    pb: 0.91,
    totalMarketCap: 893300000000,
    floatMarketCap: 730800000000
  },
  SH601318: {
    latestPrice: 46.18,
    change: -1.44,
    changePercent: -3.02,
    open: 47.48,
    high: 47.8,
    low: 45.86,
    previousClose: 47.62,
    volume: 114620000,
    amount: 5330000000,
    turnoverRate: 1.06,
    pe: 8.3,
    pb: 0.82,
    totalMarketCap: 842900000000,
    floatMarketCap: 499800000000
  },
  SZ002594: {
    latestPrice: 247.9,
    change: 2.7,
    changePercent: 1.1,
    open: 244.6,
    high: 251.2,
    low: 243.8,
    previousClose: 245.2,
    volume: 38270000,
    amount: 9495000000,
    turnoverRate: 2.28,
    pe: 22.4,
    pb: 4.95,
    totalMarketCap: 721700000000,
    floatMarketCap: 332800000000
  },
  SH688981: {
    latestPrice: 59.66,
    change: -2.88,
    changePercent: -4.61,
    open: 62.2,
    high: 63.08,
    low: 59.1,
    previousClose: 62.54,
    volume: 93640000,
    amount: 5672000000,
    turnoverRate: 2.92,
    pe: 82.1,
    pb: 3.14,
    totalMarketCap: 474600000000,
    floatMarketCap: 129600000000
  }
};

export const financeSeed: Record<string, FinanceMetrics> = {
  SH600519: { revenueGrowth: 15.4, netProfitGrowth: 16.8, grossMargin: 91.7, roe: 31.2, debtRatio: 16.1, eps: 62.4 },
  SZ000001: { revenueGrowth: 3.8, netProfitGrowth: 8.6, grossMargin: 0, roe: 10.8, debtRatio: 91.4, eps: 2.48 },
  SZ300750: { revenueGrowth: 18.1, netProfitGrowth: 24.7, grossMargin: 25.3, roe: 21.6, debtRatio: 67.5, eps: 9.55 },
  SH600036: { revenueGrowth: 2.1, netProfitGrowth: 6.2, grossMargin: 0, roe: 15.4, debtRatio: 90.7, eps: 5.72 },
  SH601318: { revenueGrowth: 5.6, netProfitGrowth: -2.8, grossMargin: 0, roe: 8.6, debtRatio: 88.8, eps: 5.1 },
  SZ002594: { revenueGrowth: 22.6, netProfitGrowth: 18.3, grossMargin: 21.9, roe: 19.8, debtRatio: 74.2, eps: 11.32 },
  SH688981: { revenueGrowth: 12.2, netProfitGrowth: -15.6, grossMargin: 18.2, roe: 4.1, debtRatio: 39.6, eps: 0.72 }
};

export const moneyFlowSeed: Record<string, MoneyFlow> = {
  SH600519: { mainNetInflow: 168000000, retailNetInflow: -95000000, largeOrderRatio: 18.6, fiveDayMainNetInflow: 412000000 },
  SZ000001: { mainNetInflow: -82000000, retailNetInflow: 51000000, largeOrderRatio: -9.4, fiveDayMainNetInflow: -146000000 },
  SZ300750: { mainNetInflow: 928000000, retailNetInflow: -436000000, largeOrderRatio: 24.1, fiveDayMainNetInflow: 1226000000 },
  SH600036: { mainNetInflow: 128000000, retailNetInflow: -46000000, largeOrderRatio: 11.7, fiveDayMainNetInflow: 316000000 },
  SH601318: { mainNetInflow: -522000000, retailNetInflow: 238000000, largeOrderRatio: -22.5, fiveDayMainNetInflow: -708000000 },
  SZ002594: { mainNetInflow: 356000000, retailNetInflow: -171000000, largeOrderRatio: 15.8, fiveDayMainNetInflow: 488000000 },
  SH688981: { mainNetInflow: -446000000, retailNetInflow: 210000000, largeOrderRatio: -18.9, fiveDayMainNetInflow: -352000000 }
};

export const newsSeed: Record<string, NewsItem[]> = {
  SH600519: [
    { id: "m1", title: "白酒板块盘中走强，龙头公司成交保持活跃", source: "模拟财经", publishedAt: "2026-07-05 10:28", sentiment: "positive" },
    { id: "m2", title: "消费旺季预期升温，机构关注高端酒库存变化", source: "模拟证券报", publishedAt: "2026-07-04 21:16", sentiment: "neutral" }
  ],
  SZ000001: [
    { id: "p1", title: "银行板块分化，市场关注息差和资产质量", source: "模拟财经", publishedAt: "2026-07-05 09:52", sentiment: "neutral" },
    { id: "p2", title: "多家银行披露分红进展，低估值品种获关注", source: "模拟证券报", publishedAt: "2026-07-04 18:40", sentiment: "positive" }
  ],
  SZ300750: [
    { id: "n1", title: "新能源产业链反弹，电池方向资金净流入靠前", source: "模拟快讯", publishedAt: "2026-07-05 11:08", sentiment: "positive" },
    { id: "n2", title: "海外储能订单预期改善，行业竞争格局仍需观察", source: "模拟财经", publishedAt: "2026-07-04 20:35", sentiment: "neutral" }
  ],
  SH600036: [
    { id: "c1", title: "股份行估值修复，市场关注中报业绩稳定性", source: "模拟证券报", publishedAt: "2026-07-05 10:03", sentiment: "positive" }
  ],
  SH601318: [
    { id: "i1", title: "保险板块回调，长端利率预期影响短线情绪", source: "模拟快讯", publishedAt: "2026-07-05 10:45", sentiment: "negative" }
  ],
  SZ002594: [
    { id: "b1", title: "汽车整车板块震荡，新能源车型销量成观察重点", source: "模拟财经", publishedAt: "2026-07-05 09:58", sentiment: "neutral" }
  ],
  SH688981: [
    { id: "s1", title: "半导体板块冲高回落，成交放大后分歧增加", source: "模拟快讯", publishedAt: "2026-07-05 11:18", sentiment: "negative" }
  ]
};

export function getQuote(symbol: string): Quote {
  const summary = stockUniverse.find((item) => item.symbol === symbol);
  const seed = quoteSeed[symbol];

  if (!summary || !seed) {
    throw new Error("未找到股票数据");
  }

  return {
    ...summary,
    ...seed,
    updateTime: new Date().toLocaleString("zh-CN", { hour12: false })
  };
}

export function buildIntraday(symbol: string): IntradayPoint[] {
  const quote = getQuote(symbol);
  const points: IntradayPoint[] = [];
  const minutes = ["09:30", "09:45", "10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "13:00", "13:15", "13:30", "13:45", "14:00", "14:15", "14:30", "14:45", "15:00"];
  const amplitude = Math.max(quote.latestPrice * 0.012, 0.05);
  const trend = quote.latestPrice - quote.open;

  minutes.forEach((time, index) => {
    const progress = index / (minutes.length - 1);
    const wave = Math.sin(index * 1.35) * amplitude;
    const price = quote.open + trend * progress + wave;
    points.push({
      time,
      price: round(price),
      averagePrice: round((quote.open + price + quote.latestPrice) / 3),
      volume: Math.round((quote.volume / minutes.length) * (0.65 + Math.abs(Math.cos(index)) * 0.75))
    });
  });

  points[points.length - 1].price = quote.latestPrice;
  return points;
}

export function buildKline(symbol: string): KlinePoint[] {
  const quote = getQuote(symbol);
  const points: Omit<KlinePoint, "ma5" | "ma10" | "ma20">[] = [];
  const base = quote.latestPrice / (1 + quote.changePercent / 100);

  for (let index = 39; index >= 0; index -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - index);
    const drift = (40 - index) * quote.latestPrice * quote.changePercent / 100 / 48;
    const wave = Math.sin(index * 0.7) * quote.latestPrice * 0.025;
    const close = index === 0 ? quote.latestPrice : Math.max(base + drift + wave, 0.1);
    const open = close * (1 + Math.sin(index * 1.1) * 0.012);
    const high = Math.max(open, close) * (1 + 0.006 + Math.abs(Math.cos(index)) * 0.012);
    const low = Math.min(open, close) * (1 - 0.006 - Math.abs(Math.sin(index)) * 0.01);

    points.push({
      date: date.toISOString().slice(0, 10),
      open: round(open),
      close: round(close),
      low: round(low),
      high: round(high),
      volume: Math.round(quote.volume * (0.55 + Math.abs(Math.sin(index * 0.8)) * 0.95))
    });
  }

  return points.map((point, index) => ({
    ...point,
    ma5: movingAverage(points, index, 5),
    ma10: movingAverage(points, index, 10),
    ma20: movingAverage(points, index, 20)
  }));
}

function movingAverage(points: Array<{ close: number }>, index: number, period: number): number {
  const start = Math.max(0, index - period + 1);
  const slice = points.slice(start, index + 1);
  return round(slice.reduce((sum, point) => sum + point.close, 0) / slice.length);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
