import type { DataSeries, DataStatus, KlinePoint, MarketOverview, Quote, StockDetail } from "../services/stockData";
import { formatMoney, formatNumber, formatPercent } from "../utils/format";

export const RESEARCH_DISCLAIMER = "以上内容由系统根据公开行情数据和规则生成，仅用于信息整理和研究辅助，不构成投资建议。";

export type ResearchDataState = "available" | "partial" | "missing";

export type ReportSource = "llm" | "rule" | "rule_fallback";

export type ReportStatusValue = "success" | "fallback" | "error";

export interface ReportStatus {
  source: ReportSource;
  status: ReportStatusValue;
  provider?: string | null;
  model?: string | null;
  fallbackReason?: string | null;
  latencyMs?: number | null;
}

export interface ResearchDataStatusItem {
  label: string;
  state: ResearchDataState;
  detail: string;
  warning?: string;
}

export interface ResearchReportSection {
  title: string;
  points: string[];
}

export interface MajorEventItem {
  eventId: string;
  symbol: string;
  title: string;
  eventType: string;
  publishedAt: string;
  sourceName: string;
  sourceUrl?: string | null;
  status: string;
  summary: string;
  affectedAreas: string[];
  needsFollowUp: string[];
  dataStatus?: Record<string, unknown>;
}

export interface ResearchReport {
  symbol: string;
  name: string;
  generatedAt: string;
  reportStatus: ReportStatus;
  dataSources: string[];
  dataStatus: ResearchDataStatusItem[];
  missingFields: string[];
  sections: ResearchReportSection[];
  disclaimer: string;
  warnings?: string[];
  majorEvents?: MajorEventItem[];
}

interface GenerateResearchReportInput {
  quote: Quote;
  quoteStatus?: DataStatus;
  detail?: StockDetail | null;
  kline?: DataSeries<KlinePoint> | null;
  overview?: MarketOverview | null;
  reportStatus?: ReportStatus;
  warnings?: string[];
}

export function generateResearchReport({ quote, quoteStatus, detail, kline, overview, reportStatus, warnings }: GenerateResearchReportInput): ResearchReport {
  const technical = summarizeTechnical(kline?.items || []);
  const news = detail?.news || [];
  const missingFields = collectMissingFields(quote, detail, kline, overview);
  const dataStatus = buildDataStatus({ quoteStatus: quoteStatus || detail?._dataStatus, detail, kline, overview, missingFields });
  const dataSources = dataStatus.map((item) => `${item.label}：${stateLabel[item.state]}`);

  return {
    symbol: quote.symbol,
    name: quote.name,
    generatedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    reportStatus: reportStatus || {
      source: "rule",
      status: "success",
      provider: "frontend-rule",
      model: null,
      fallbackReason: null,
      latencyMs: null
    },
    dataSources,
    dataStatus,
    missingFields,
    sections: [
      {
        title: "公司概况",
        points: [
          `${quote.name}（${quote.code}）当前归属 ${quote.market} 市场，行业信息为 ${quote.industry || "待补充"}。`,
          `本报告基于公开行情快照、历史K线和可用新闻线索整理，用于形成结构化研究材料。`
        ]
      },
      {
        title: "最新行情",
        points: [
          `最新价 ${formatNumber(quote.latestPrice)}，涨跌幅 ${formatPercent(quote.changePercent)}，成交额 ${formatMoney(quote.amount)}。`,
          `今开 ${formatNumber(quote.open)}，最高 ${formatNumber(quote.high)}，最低 ${formatNumber(quote.low)}，换手率 ${formatPercent(quote.turnoverRate)}。`,
          quote.pe || quote.pb ? `估值快照：PE ${formatNumber(quote.pe)}，PB ${formatNumber(quote.pb)}，总市值 ${formatMoney(quote.totalMarketCap)}。` : "当前估值字段不完整，估值维度需结合后续数据复核。"
        ]
      },
      {
        title: "技术分析",
        points: technical.points
      },
      {
        title: "新闻/公告线索",
        points: news.length > 0
          ? news.slice(0, 3).map((item) => `${item.publishedAt}｜${item.source}｜${item.title}`)
          : ["该部分数据暂不可用：当前接口未返回可用新闻/公告线索，需结合交易所公告、公司公告等公开信息继续核对。"]
      },
      {
        title: "优势观察",
        points: buildStrengthPoints(quote, technical)
      },
      {
        title: "风险因素",
        points: buildRiskPoints(quote, detail, technical)
      },
      {
        title: "总结",
        points: [
          `当前可先把 ${quote.name} 放入研究清单，重点跟踪行情强弱、成交额变化、技术位置和公告线索是否相互印证。`,
          missingFields.length > 0 ? `本次报告存在 ${missingFields.join("、")} 等缺失项，相关结论需要在数据补齐后复核。` : "本次报告所需核心数据已返回，可继续围绕业务、公告和行业信息补充研究。",
          technical.summary
        ]
      },
      {
        title: "免责声明",
        points: [RESEARCH_DISCLAIMER]
      }
    ],
    disclaimer: RESEARCH_DISCLAIMER,
    warnings: warnings || []
  };
}

function summarizeTechnical(items: KlinePoint[]): { points: string[]; summary: string; aboveMa20: boolean | null; volumeState: "active" | "normal" | "thin" | "unknown" } {
  if (items.length === 0) {
    return {
      points: ["该部分数据暂不可用：当前K线数据未完整返回，技术维度暂按待复核处理。"],
      summary: "技术指标数据不完整，后续需要在K线和成交量补齐后再更新判断。",
      aboveMa20: null,
      volumeState: "unknown"
    };
  }

  const latest = items[items.length - 1];
  const previous = items.length > 1 ? items[items.length - 2] : latest;
  const recent = items.slice(-20);
  const avgVolume = recent.reduce((sum, item) => sum + item.volume, 0) / Math.max(1, recent.length);
  const volumeRatio = avgVolume > 0 ? latest.volume / avgVolume : 0;
  const aboveMa20 = latest.ma20 > 0 ? latest.close >= latest.ma20 : null;
  const volumeState = volumeRatio >= 1.4 ? "active" : volumeRatio <= 0.65 ? "thin" : "normal";
  const direction = latest.close >= previous.close ? "短线价格较上一交易日偏强" : "短线价格较上一交易日偏弱";
  const maText = aboveMa20 === null ? "MA20 数据不足，均线位置需补充确认" : aboveMa20 ? "价格位于MA20上方，趋势韧性相对更好" : "价格位于MA20下方，趋势修复仍需观察";
  const volumeText = volumeState === "active"
    ? `最近成交量高于20日均量，量能活跃度提升。`
    : volumeState === "thin"
      ? `最近成交量低于20日均量，资金参与度偏弱。`
      : `最近成交量接近20日均量，量能暂未显著偏离。`;

  return {
    points: [
      `${direction}，最新收盘 ${formatNumber(latest.close)}。`,
      maText,
      `${volumeText}量能比约 ${formatNumber(volumeRatio)}。`
    ],
    summary: `${direction}；${maText}；${volumeText}`,
    aboveMa20,
    volumeState
  };
}

function buildStrengthPoints(quote: Quote, technical: ReturnType<typeof summarizeTechnical>): string[] {
  const points: string[] = [];
  if (quote.changePercent > 0) points.push("价格快照显示当日表现为正，说明短线关注度有所提升。");
  if (quote.amount > 1_000_000_000) points.push(`成交额达到 ${formatMoney(quote.amount)}，具备一定市场关注度。`);
  if (technical.aboveMa20) points.push("价格位于MA20上方，技术结构仍有可跟踪价值。");
  if (technical.volumeState === "active") points.push("量能较近期均值更活跃，适合进一步结合分时和公告线索复核。");
  return points.length > 0 ? points : ["当前优势信号不突出，更适合先做基础资料整理和后续观察。"];
}

function buildRiskPoints(quote: Quote, detail: StockDetail | null | undefined, technical: ReturnType<typeof summarizeTechnical>): string[] {
  const points: string[] = [];
  if (quote.changePercent < 0) points.push("价格快照显示当日表现为负，需关注短线承压原因。");
  if (technical.aboveMa20 === false) points.push("价格位于MA20下方，技术修复仍需更多数据确认。");
  if (technical.volumeState === "thin") points.push("量能偏弱时，价格信号的可靠性需要谨慎看待。");
  if (detail?.moneyFlow?.available === false) points.push("个股资金流接口未返回有效数据，资金维度未纳入本次确认。");
  if (!detail || detail.news.length === 0) points.push("新闻/公告线索不足，事件驱动因素仍需人工补充核对。");
  return points.length > 0 ? points : ["当前未触发明显风险条目，但仍需持续关注数据更新、公告变化和市场环境。"];
}

function collectMissingFields(quote: Quote, detail: StockDetail | null | undefined, kline: DataSeries<KlinePoint> | null | undefined, overview: MarketOverview | null | undefined): string[] {
  const missing = new Set<string>();
  if (!quote.industry) missing.add("行业信息");
  if (!quote.pe && !quote.pb) missing.add("估值字段");
  if (!detail) {
    missing.add("个股详情");
    missing.add("财务指标");
    missing.add("资金流");
    missing.add("新闻/公告线索");
  } else {
    if (detail.finance?.available === false) missing.add("财务指标");
    if (detail.moneyFlow?.available === false) missing.add("资金流");
    if (!detail.news || detail.news.length === 0) missing.add("新闻/公告线索");
  }
  if (!kline || kline.items.length === 0) missing.add("K线/技术指标");
  if (!overview) missing.add("市场概览");
  return Array.from(missing);
}

function buildDataStatus({ quoteStatus, detail, kline, overview, missingFields }: { quoteStatus?: DataStatus; detail?: StockDetail | null; kline?: DataSeries<KlinePoint> | null; overview?: MarketOverview | null; missingFields: string[] }): ResearchDataStatusItem[] {
  const detailMissing = missingFields.filter((field) => ["个股详情", "财务指标", "资金流", "新闻/公告线索"].includes(field));
  return [
    {
      label: "行情数据",
      state: getStatusState(quoteStatus),
      detail: quoteStatus ? describeSourceStatus(quoteStatus) : "已返回基础报价；接口未提供独立数据状态。",
      warning: quoteStatus?.warning
    },
    {
      label: "个股详情",
      state: !detail ? "missing" : detailMissing.length > 0 ? "partial" : getStatusState(detail._dataStatus),
      detail: !detail ? "该部分数据暂不可用；报告已使用基础报价继续生成。" : detailMissing.length > 0 ? `部分字段暂不可用：${detailMissing.join("、")}。` : describeSourceStatus(detail._dataStatus),
      warning: detail?._dataStatus?.warning
    },
    {
      label: "K线/技术指标",
      state: kline && kline.items.length > 0 ? getStatusState(kline._dataStatus) : "missing",
      detail: kline && kline.items.length > 0 ? `${describeSourceStatus(kline._dataStatus)}，已返回 ${kline.items.length} 条K线。` : "该部分数据暂不可用；技术分析按待复核处理。",
      warning: kline?._dataStatus?.warning
    },
    {
      label: "字段完整性",
      state: missingFields.length > 0 ? "partial" : "available",
      detail: missingFields.length > 0 ? `存在缺失项：${missingFields.join("、")}。` : "核心字段已返回。"
    },
    {
      label: "市场概览",
      state: overview ? getStatusState(overview._dataStatus) : "missing",
      detail: overview ? describeSourceStatus(overview._dataStatus) : "未纳入当前报告上下文。",
      warning: overview?._dataStatus?.warning
    }
  ];
}

function getStatusState(status?: DataStatus): ResearchDataState {
  if (!status) return "available";
  if (status.provider === "mock" || status.mode === "fallback" || status.mode === "stale" || status.mode === "stale_refreshing" || status.warning) return "partial";
  return "available";
}

function describeSourceStatus(status?: DataStatus): string {
  if (!status) return "接口未提供独立数据状态。";
  const provider = status.sourceProvider || status.provider;
  const mode = statusModeLabel[status.mode] || status.mode;
  const age = status.cacheAgeSeconds > 0 ? `，缓存约 ${formatAge(status.cacheAgeSeconds)}` : "";
  return `来源 ${provider}，状态 ${mode}${age}。`;
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))} 秒`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} 分钟`;
  return `${Math.round(seconds / 3600)} 小时`;
}

const stateLabel: Record<ResearchDataState, string> = {
  available: "可用",
  partial: "部分可用",
  missing: "暂不可用"
};

const statusModeLabel: Record<string, string> = {
  live: "实时",
  fresh: "新鲜缓存",
  stale: "旧缓存",
  stale_refreshing: "旧缓存刷新中",
  fallback: "降级兜底"
};
