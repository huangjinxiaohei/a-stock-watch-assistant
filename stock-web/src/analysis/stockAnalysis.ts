import { calculateTechnicalIndicators, type TechnicalPoint } from "./technicalIndicators";
import type { KlinePoint, MoneyFlow, Quote } from "../services/stockData";

export type AlertCredibility = "confirmed" | "needsConfirm" | "unavailable";

export interface RiskAlert {
  level: "high" | "medium" | "low";
  title: string;
  detail: string;
  credibility: AlertCredibility;
  dataSources: string[];
  missingFields?: string[];
}

export interface TechnicalSnapshot {
  date: string;
  macd: string;
  kdj: string;
  rsi: string;
  boll: string;
  dataSource: string;
}

export interface StockAnalysis {
  currentTrend: string;
  supportLevel: string;
  pressureLevel: string;
  volumePrice: string;
  shortTermRisk: string;
  midTermWatch: string;
  focusConditions: string;
  avoidSignals: string;
  actionTone: "适合关注" | "保持谨慎" | "暂时回避";
  technicalSnapshot: TechnicalSnapshot;
  risks: RiskAlert[];
  disclaimer: string;
}

export function generateStockAnalysis(quote: Quote, kline: KlinePoint[], moneyFlow: MoneyFlow): StockAnalysis {
  const latestKline = kline[kline.length - 1];
  const previousKline = kline[kline.length - 2];
  const support = Math.min(latestKline.low, latestKline.ma20 || latestKline.low, quote.low || latestKline.low);
  const pressure = Math.max(latestKline.high, quote.high || latestKline.high, latestKline.ma10 || latestKline.high);
  const isAboveMa5 = quote.latestPrice >= latestKline.ma5;
  const isAboveMa20 = quote.latestPrice >= latestKline.ma20;
  const volumeRatio = previousKline && previousKline.volume > 0 ? latestKline.volume / previousKline.volume : 1;
  const technical = calculateTechnicalIndicators(kline);
  const latestTechnical = technical.latest;
  const risks = buildRiskAlerts(quote, latestKline, volumeRatio, moneyFlow, latestTechnical);
  const actionTone = getActionTone(quote, isAboveMa20, moneyFlow, risks);

  return {
    currentTrend: buildTrendJudgement(quote, latestKline, isAboveMa5, isAboveMa20),
    supportLevel: `${formatPrice(support)} 附近是短线支撑观察区；若跌破且不能快速收回，说明承接转弱。`,
    pressureLevel: `${formatPrice(pressure)} 附近是短线压力观察区；若放量站上，趋势确认度会提高。`,
    volumePrice: buildVolumePrice(quote, volumeRatio, moneyFlow),
    shortTermRisk: risks.length > 0 ? risks.map((risk) => risk.title).join("；") : "暂未触发明显短线风险，但仍需关注指数和板块情绪变化。",
    midTermWatch: isAboveMa20
      ? `价格仍在20日均线 ${formatPrice(latestKline.ma20)} 上方，中线重点看回踩均线时是否缩量、是否有资金承接。`
      : `价格低于20日均线 ${formatPrice(latestKline.ma20)}，中线需要等待重新站回均线并出现成交确认。`,
    focusConditions: buildFocusConditions(quote, latestKline, moneyFlow),
    avoidSignals: buildAvoidSignals(latestKline, moneyFlow, risks),
    actionTone,
    technicalSnapshot: buildTechnicalSnapshot(latestTechnical),
    risks,
    disclaimer: "以上内容由行情、均线、量价和资金规则生成，仅供辅助参考，不构成投资建议，也不保证任何收益。"
  };
}

function buildRiskAlerts(quote: Quote, latestKline: KlinePoint, volumeRatio: number, moneyFlow: MoneyFlow, technical?: TechnicalPoint): RiskAlert[] {
  const risks: RiskAlert[] = [];

  if (quote.changePercent >= 7) {
    risks.push({
      level: "medium",
      title: "短线涨幅偏大",
      detail: "日内涨幅较高，波动风险上升；需要结合后续换手和量能确认持续性。",
      credibility: "needsConfirm",
      dataSources: ["quote"],
      missingFields: ["后续换手", "K线量比"]
    });
  }

  if (quote.changePercent <= -3 && volumeRatio >= 1.25) {
    risks.push({
      level: "high",
      title: "放量下跌",
      detail: `价格下跌同时成交量较前一交易日放大 ${volumeRatio.toFixed(2)} 倍，说明分歧和抛压增加。`,
      credibility: "confirmed",
      dataSources: ["quote", "kline"]
    });
  }

  if (quote.latestPrice < latestKline.ma20) {
    risks.push({
      level: "medium",
      title: "跌破20日均线",
      detail: "价格处在20日均线下方，中期趋势需要重新修复。",
      credibility: "confirmed",
      dataSources: ["quote", "kline"]
    });
  }

  if (volumeRatio >= 1.8) {
    risks.push({
      level: "low",
      title: "成交异常放大",
      detail: `成交量较前一交易日放大 ${volumeRatio.toFixed(2)} 倍，需要结合板块消息和资金流方向判断。`,
      credibility: moneyFlow.available === false ? "needsConfirm" : "confirmed",
      dataSources: ["kline"],
      missingFields: moneyFlow.available === false ? ["个股资金流"] : undefined
    });
  }


  if (technical?.macd.macd !== undefined && technical.macd.macd < 0 && technical.macd.dif < technical.macd.dea) {
    risks.push({
      level: "low",
      title: "MACD弱势排列",
      detail: `MACD柱值 ${technical.macd.macd.toFixed(2)}，DIF 低于 DEA，动能结构偏弱，需要结合价格和成交量复核。`,
      credibility: "confirmed",
      dataSources: ["kline", "technicalIndicators"]
    });
  }

  if (technical?.rsi.rsi6 !== null && technical?.rsi.rsi6 !== undefined && technical.rsi.rsi6 >= 80) {
    risks.push({
      level: "low",
      title: "RSI短线过热",
      detail: `RSI6 为 ${technical.rsi.rsi6.toFixed(2)}，短线波动可能放大。该信号只作为技术复核，不单独构成结论。`,
      credibility: "confirmed",
      dataSources: ["kline", "technicalIndicators"]
    });
  }

  if (technical?.boll.lower !== null && technical?.boll.lower !== undefined && quote.latestPrice < technical.boll.lower) {
    risks.push({
      level: "medium",
      title: "跌破BOLL下轨",
      detail: `最新价低于BOLL下轨 ${formatPrice(technical.boll.lower)}，短线波动显著，需要结合量能和资金流复核。`,
      credibility: moneyFlow.available === false ? "needsConfirm" : "confirmed",
      dataSources: ["quote", "kline", "technicalIndicators"],
      missingFields: moneyFlow.available === false ? ["个股资金流"] : undefined
    });
  }
  if (moneyFlow.available !== false && moneyFlow.mainNetInflow < -300_000_000) {
    risks.push({
      level: "medium",
      title: "主力资金流出",
      detail: "主力资金净流出较大，短线承接强度需要继续验证。",
      credibility: "confirmed",
      dataSources: ["moneyFlow"]
    });
  }

  if (moneyFlow.available === false) {
    risks.push({
      level: "low",
      title: "资金流待确认",
      detail: "当前个股资金流接口未返回有效数据，资金维度未纳入风险确认。",
      credibility: "needsConfirm",
      dataSources: ["moneyFlow"],
      missingFields: ["个股资金流"]
    });
  }

  return risks;
}

function buildTrendJudgement(quote: Quote, latestKline: KlinePoint, isAboveMa5: boolean, isAboveMa20: boolean): string {
  if (quote.changePercent > 1 && isAboveMa5 && isAboveMa20) {
    return `价格站上5日和20日均线，短线走势偏强，趋势延续性取决于 ${formatPrice(latestKline.ma5)} 附近能否守住。`;
  }

  if (quote.changePercent < -1 && !isAboveMa20) {
    return "价格弱于20日均线，短线处于调整状态，优先观察止跌和放量承接。";
  }

  return "当前走势偏震荡，方向不极端，需要结合板块强弱和成交量变化继续观察。";
}

function buildVolumePrice(quote: Quote, volumeRatio: number, moneyFlow: MoneyFlow): string {
  const flowAvailable = moneyFlow.available !== false;

  if (quote.changePercent > 0 && volumeRatio > 1.1 && flowAvailable && moneyFlow.mainNetInflow > 0) {
    return "价格上涨伴随成交放大，且主力资金净流入，量价配合相对积极。";
  }

  if (quote.changePercent < 0 && volumeRatio > 1.1) {
    return "价格回落时成交放大，说明短线抛压增加，需等待缩量企稳。";
  }

  if (volumeRatio < 0.75) {
    return "成交量较前一交易日收缩，当前多空分歧不大，突破或跌破都需要补量确认。";
  }

  return "成交量变化不算极端，当前量价关系偏观察，暂未形成强确认信号。";
}

function buildFocusConditions(quote: Quote, latestKline: KlinePoint, moneyFlow: MoneyFlow): string {
  const maCondition = quote.latestPrice >= latestKline.ma20
    ? `价格维持在MA20 ${formatPrice(latestKline.ma20)} 上方`
    : `价格重新站回MA20 ${formatPrice(latestKline.ma20)} 上方`;
  const flowCondition = moneyFlow.available === false
    ? "资金流维度恢复可用并完成复核"
    : moneyFlow.mainNetInflow >= 0
      ? "主力资金保持净流入或流出收窄"
      : "主力资金由流出转为流入";
  const conditions = [
    maCondition,
    "回踩时成交量缩小",
    flowCondition
  ];

  if (quote.changePercent < 0) {
    conditions.push("日内跌幅收窄并重新站回分时均价");
  }

  return conditions.join("；") + "。";
}

function buildAvoidSignals(latestKline: KlinePoint, moneyFlow: MoneyFlow, risks: RiskAlert[]): string {
  const signals = [`有效跌破MA20 ${formatPrice(latestKline.ma20)}`];
  if (moneyFlow.available !== false && moneyFlow.mainNetInflow < 0) signals.push("主力资金持续净流出");
  if (risks.some((risk) => risk.title === "放量下跌")) signals.push("放量下跌后无法修复");
  signals.push("大盘或所属板块同步转弱");
  return signals.join("；") + "。";
}

function getActionTone(quote: Quote, isAboveMa20: boolean, moneyFlow: MoneyFlow, risks: RiskAlert[]): StockAnalysis["actionTone"] {
  if (risks.some((risk) => risk.level === "high") || (quote.changePercent < -3 && moneyFlow.available !== false && moneyFlow.mainNetInflow < 0)) {
    return "暂时回避";
  }

  if (!isAboveMa20 || risks.length >= 2) {
    return "保持谨慎";
  }

  return "适合关注";
}

function buildTechnicalSnapshot(technical?: TechnicalPoint): TechnicalSnapshot {
  if (!technical) {
    return {
      date: "--",
      macd: "暂无",
      kdj: "暂无",
      rsi: "暂无",
      boll: "暂无",
      dataSource: "K线技术指标待确认"
    };
  }

  const bollText = technical.boll.mid === null || technical.boll.upper === null || technical.boll.lower === null
    ? "BOLL样本不足"
    : `上 ${formatPrice(technical.boll.upper)} / 中 ${formatPrice(technical.boll.mid)} / 下 ${formatPrice(technical.boll.lower)}`;

  return {
    date: technical.date,
    macd: `DIF ${technical.macd.dif.toFixed(2)} / DEA ${technical.macd.dea.toFixed(2)} / MACD ${technical.macd.macd.toFixed(2)}`,
    kdj: `K ${technical.kdj.k.toFixed(2)} / D ${technical.kdj.d.toFixed(2)} / J ${technical.kdj.j.toFixed(2)}`,
    rsi: `RSI6 ${formatNullable(technical.rsi.rsi6)} / RSI12 ${formatNullable(technical.rsi.rsi12)} / RSI24 ${formatNullable(technical.rsi.rsi24)}`,
    boll: bollText,
    dataSource: "K线共享技术指标计算"
  };
}

function formatNullable(value: number | null): string {
  return value === null ? "样本不足" : value.toFixed(2);
}
function formatPrice(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : "--";
}





