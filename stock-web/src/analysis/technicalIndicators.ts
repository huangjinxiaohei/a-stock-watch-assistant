import type { KlinePoint } from "../services/stockData";

export interface MacdPoint {
  dif: number;
  dea: number;
  macd: number;
}

export interface KdjPoint {
  k: number;
  d: number;
  j: number;
}

export interface RsiPoint {
  rsi6: number | null;
  rsi12: number | null;
  rsi24: number | null;
}

export interface BollPoint {
  upper: number | null;
  mid: number | null;
  lower: number | null;
}

export interface TechnicalPoint {
  date: string;
  macd: MacdPoint;
  kdj: KdjPoint;
  rsi: RsiPoint;
  boll: BollPoint;
}

export interface TechnicalSeries {
  macd: MacdPoint[];
  kdj: KdjPoint[];
  rsi: Record<"rsi6" | "rsi12" | "rsi24", Array<number | null>>;
  boll: BollPoint[];
  points: TechnicalPoint[];
  latest?: TechnicalPoint;
}

export function calculateTechnicalIndicators(points: KlinePoint[]): TechnicalSeries {
  const macd = calculateMacd(points);
  const kdj = calculateKdj(points);
  const rsi = calculateRsi(points);
  const boll = calculateBoll(points);
  const technicalPoints = points.map((point, index) => ({
    date: point.date,
    macd: macd[index],
    kdj: kdj[index],
    rsi: {
      rsi6: rsi.rsi6[index],
      rsi12: rsi.rsi12[index],
      rsi24: rsi.rsi24[index]
    },
    boll: boll[index]
  }));

  return {
    macd,
    kdj,
    rsi,
    boll,
    points: technicalPoints,
    latest: technicalPoints[technicalPoints.length - 1]
  };
}

function calculateMacd(points: KlinePoint[]): MacdPoint[] {
  const closes = points.map((point) => point.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const dif = closes.map((_, index) => round(ema12[index] - ema26[index]));
  const dea = ema(dif, 9).map((value) => round(value));
  return dif.map((value, index) => ({
    dif: value,
    dea: dea[index],
    macd: round((value - dea[index]) * 2)
  }));
}

function calculateKdj(points: KlinePoint[]): KdjPoint[] {
  let previousK = 50;
  let previousD = 50;
  return points.map((point, index) => {
    const windowPoints = points.slice(Math.max(0, index - 8), index + 1);
    const low = Math.min(...windowPoints.map((item) => item.low));
    const high = Math.max(...windowPoints.map((item) => item.high));
    const rsv = high === low ? 50 : ((point.close - low) / (high - low)) * 100;
    const k = (previousK * 2) / 3 + rsv / 3;
    const d = (previousD * 2) / 3 + k / 3;
    const j = 3 * k - 2 * d;
    previousK = k;
    previousD = d;
    return { k: round(k), d: round(d), j: round(j) };
  });
}

function calculateRsi(points: KlinePoint[]) {
  return {
    rsi6: rsi(points, 6),
    rsi12: rsi(points, 12),
    rsi24: rsi(points, 24)
  };
}

function calculateBoll(points: KlinePoint[]): BollPoint[] {
  return points.map((_, index) => {
    if (index < 19) return { upper: null, mid: null, lower: null };
    const closes = points.slice(index - 19, index + 1).map((point) => point.close);
    const mid = closes.reduce((sum, value) => sum + value, 0) / closes.length;
    const variance = closes.reduce((sum, value) => sum + (value - mid) ** 2, 0) / closes.length;
    const band = Math.sqrt(variance) * 2;
    return { upper: round(mid + band), mid: round(mid), lower: round(mid - band) };
  });
}

function ema(values: number[], period: number): number[] {
  const factor = 2 / (period + 1);
  return values.reduce<number[]>((result, value, index) => {
    result.push(index === 0 ? value : value * factor + result[index - 1] * (1 - factor));
    return result;
  }, []);
}

function rsi(points: KlinePoint[], period: number): Array<number | null> {
  return points.map((_, index) => {
    if (index < period) return null;
    const changes = points.slice(index - period + 1, index + 1).map((point, offset, items) => {
      if (offset === 0) return point.close - points[index - period].close;
      return point.close - items[offset - 1].close;
    });
    const gains = changes.map((value) => Math.max(value, 0));
    const losses = changes.map((value) => Math.abs(Math.min(value, 0)));
    const averageGain = gains.reduce((sum, value) => sum + value, 0) / period;
    const averageLoss = losses.reduce((sum, value) => sum + value, 0) / period;
    if (averageLoss === 0) return 100;
    return round(100 - 100 / (1 + averageGain / averageLoss));
  });
}

function round(value: number): number {
  return Number(value.toFixed(2));
}
