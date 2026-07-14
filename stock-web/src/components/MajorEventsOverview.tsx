import { ExternalLink } from "lucide-react";
import type { MajorEventItem } from "../analysis/researchReport";

interface MajorEventsOverviewProps {
  majorEvents?: MajorEventItem[];
}

interface EventStatusView {
  label: string;
  tone: "good" | "warn" | "neutral";
}

const EMPTY_TEXT = "当前可用数据源未识别到可核验的重大事件线索，请结合公司公告和交易所公告继续复核。";
const MAX_VISIBLE_EVENTS = 5;

export function MajorEventsOverview({ majorEvents }: MajorEventsOverviewProps) {
  const events = Array.isArray(majorEvents) ? majorEvents.slice(0, MAX_VISIBLE_EVENTS) : [];

  return (
    <section className="major-events-overview" aria-label="重大事件线索">
      <div className="major-events-header">
        <div>
          <h3>重大事件线索</h3>
          <p>基于当前可用数据源整理的事件线索，不是正式公告中心。</p>
        </div>
        <span>{events.length > 0 ? `展示 ${events.length} 条` : "待复核"}</span>
      </div>

      {events.length === 0 ? (
        <div className="major-events-empty">{EMPTY_TEXT}</div>
      ) : (
        <div className="major-events-list">
          {events.map((event, index) => {
            const sourceUrl = getValidSourceUrl(event.sourceUrl);
            const statusView = getEventStatusView(event, sourceUrl);
            const followUps = getFollowUpLabels(event, sourceUrl);
            const affectedAreas = event.affectedAreas.filter(Boolean);

            return (
              <article className={`major-event-card status-${statusView.tone}`} key={event.eventId || `${event.publishedAt}-${event.title}-${index}`}>
                <div className="major-event-topline">
                  <span>{event.publishedAt || "时间待复核"}</span>
                  <b>{formatEventType(event.eventType)}</b>
                </div>

                <div className="major-event-title-row">
                  <h4>{event.title || "事件标题待复核"}</h4>
                  <span>{statusView.label}</span>
                </div>

                <p>{event.summary || event.title || "该事件摘要暂不可用，需结合来源继续复核。"}</p>

                <div className="major-event-meta">
                  <span>来源：{event.sourceName || "来源待复核"}</span>
                  {sourceUrl ? (
                    <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                      查看来源
                      <ExternalLink size={13} />
                    </a>
                  ) : (
                    <span>来源链接暂不可用</span>
                  )}
                </div>

                {affectedAreas.length > 0 ? (
                  <div className="major-event-tags" aria-label="涉及环节">
                    <span>涉及环节</span>
                    {affectedAreas.slice(0, 4).map((area) => <b key={area}>{formatAffectedArea(area)}</b>)}
                  </div>
                ) : null}

                {followUps.length > 0 ? (
                  <div className="major-event-follow-up">
                    <strong>待确认事项</strong>
                    <ul>
                      {followUps.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function getEventStatusView(event: MajorEventItem, sourceUrl: string): EventStatusView {
  if (isFollowUpEvent(event, sourceUrl)) return { label: "待复核", tone: "warn" };
  if (event.status === "confirmed") return { label: "可核验线索", tone: "good" };
  if (event.status === "news_clue") return { label: "新闻线索", tone: "neutral" };
  return { label: "待复核", tone: "warn" };
}

function isFollowUpEvent(event: MajorEventItem, sourceUrl: string): boolean {
  const status = String(event.status || "").toLowerCase();
  const dataStatus = event.dataStatus || {};
  const dataState = String(dataStatus.state || "").toLowerCase();
  const dataMode = String(dataStatus.mode || "").toLowerCase();
  const provider = String(dataStatus.provider || "").toLowerCase();
  const weakRecognition = !event.title || !event.eventType || !event.sourceName || !event.summary;
  return !sourceUrl || weakRecognition || status === "needs_follow_up" || status === "stale" || dataState === "partial" || dataState === "missing" || dataMode === "fallback" || dataMode === "stale" || dataMode === "stale_refreshing" || provider === "mock" || provider === "fallback";
}

function getFollowUpLabels(event: MajorEventItem, sourceUrl: string): string[] {
  const labels = new Set<string>();
  if (!sourceUrl) labels.add("来源链接暂不可用，需核验原始公告或交易所披露。");
  if (event.status === "needs_follow_up" || event.status === "stale") labels.add("线索状态待复核，需结合原始披露继续确认。");
  if (isDegradedEventData(event)) labels.add("事件数据源处于降级或待复核状态。");
  for (const item of event.needsFollowUp) {
    labels.add(formatFollowUp(item));
  }
  return Array.from(labels);
}

function isDegradedEventData(event: MajorEventItem): boolean {
  const dataStatus = event.dataStatus || {};
  const dataState = String(dataStatus.state || "").toLowerCase();
  const dataMode = String(dataStatus.mode || "").toLowerCase();
  const provider = String(dataStatus.provider || "").toLowerCase();
  return dataState === "partial" || dataState === "missing" || dataMode === "fallback" || dataMode === "stale" || dataMode === "stale_refreshing" || provider === "mock" || provider === "fallback";
}

function formatFollowUp(value: string): string {
  const text = value.toLowerCase();
  if (text.includes("source url")) return "来源链接暂不可用，需补充原始链接。";
  if (text.includes("announcement") || text.includes("exchange")) return "需核验原始公告或交易所披露。";
  return "需进一步人工复核。";
}

function getValidSourceUrl(value: string | null | undefined): string {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function formatEventType(value: string): string {
  return eventTypeLabel[value] || value || "事件类型待复核";
}

function formatAffectedArea(value: string): string {
  return affectedAreaLabel[value] || value;
}

const eventTypeLabel: Record<string, string> = {
  performance: "业绩/财务线索",
  shareholder_change: "股东变动线索",
  buyback_dividend: "回购分红线索",
  management_change: "治理变动线索",
  contract_order: "经营合同线索",
  merger_restructure: "资本运作线索",
  litigation_penalty: "诉讼处罚线索",
  regulatory_inquiry: "监管关注线索",
  production_operation: "生产经营线索"
};

const affectedAreaLabel: Record<string, string> = {
  financials: "财务",
  shareholding: "股权",
  capital_return: "权益分配",
  governance: "治理",
  operations: "经营",
  capital_operation: "资本运作",
  legal: "合规/法律",
  regulatory: "监管"
};
