from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any


DEFAULT_EVENT_LIMIT = 3
MAX_EVENT_LIMIT = 5
RECENT_DAYS = 30
MAX_LOOKBACK_DAYS = 90


@dataclass(frozen=True)
class EventRule:
    event_type: str
    affected_areas: tuple[str, ...]
    terms: tuple[str, ...]
    reason: str


EVENT_RULES = (
    EventRule("performance", ("financials",), ("业绩", "预告", "快报", "年报", "中报", "半年报", "季报", "财报", "营收", "利润"), "matched performance disclosure terms"),
    EventRule("shareholder_change", ("shareholding",), ("股东", "增持", "减持", "质押", "解押", "持股变动"), "matched shareholder or pledge terms"),
    EventRule("buyback_dividend", ("capital_return",), ("回购", "分红", "派息", "权益分派"), "matched buyback or dividend terms"),
    EventRule("management_change", ("governance",), ("高管", "董事", "监事", "总经理", "董事长", "辞职", "任命", "聘任"), "matched management change terms"),
    EventRule("contract_order", ("operations",), ("订单", "合同", "中标", "项目", "采购协议", "销售协议"), "matched contract or order terms"),
    EventRule("merger_restructure", ("capital_operation",), ("并购", "重组", "收购", "资产注入", "重大资产", "股权转让"), "matched merger or restructuring terms"),
    EventRule("litigation_penalty", ("legal",), ("诉讼", "仲裁", "处罚", "罚款", "立案", "冻结", "违规"), "matched litigation or penalty terms"),
    EventRule("regulatory_inquiry", ("regulatory",), ("监管", "问询", "关注函", "问询函", "交易所", "证监"), "matched regulatory inquiry terms"),
    EventRule("production_operation", ("operations",), ("停产", "复产", "召回", "产能", "事故", "整改"), "matched production or recall terms"),
)

UNFINISHED_TERMS = ("调查", "执行", "整改", "诉讼", "仲裁", "问询", "关注函", "回复", "进展", "尚未", "待", "后续公告")
OFFICIAL_SOURCE_TERMS = ("公司公告", "上市公司公告", "交易所", "上交所", "深交所", "北交所", "巨潮资讯", "证监会", "监管机构")
UNRELIABLE_SOURCE_TERMS = ("模拟", "mock", "fallback", "兜底")
REPOST_TERMS = ("转载", "转自", "来源：")
COMPANY_ANNOUNCEMENT_SOURCES = ("\u516c\u53f8\u516c\u544a", "\u4e0a\u5e02\u516c\u53f8\u516c\u544a", "\u5de8\u6f6e\u8d44\u8baf")
EXCHANGE_REGULATOR_SOURCES = ("\u4ea4\u6613\u6240", "\u4e0a\u4ea4\u6240", "\u6df1\u4ea4\u6240", "\u5317\u4ea4\u6240", "\u8bc1\u76d1\u4f1a", "\u76d1\u7ba1\u673a\u6784")
TRUSTED_MEDIA_SOURCES = ("\u4e1c\u65b9\u8d22\u5bcc", "\u8bc1\u5238\u65f6\u62a5", "\u4e2d\u56fd\u8bc1\u5238\u62a5", "\u4e0a\u6d77\u8bc1\u5238\u62a5", "\u8bc1\u5238\u65e5\u62a5", "\u8d22\u8054\u793e", "\u7b2c\u4e00\u8d22\u7ecf")
MEDIA_PREFIX_PATTERN = re.compile(r"^(\u3010[^\u3011]{1,20}\u3011|\[[^\]]{1,20}\]|\uff08[^\uff09]{1,20}\uff09|\([^)]{1,20}\)|[^\uff1a:\-\u2014]{1,20}[\uff1a:\-\u2014])")
COMPANY_MARKER_PATTERN = re.compile(r"([\u4e00-\u9fa5A-Za-z0-9]{2,12})(\u80a1\u4efd|\u96c6\u56e2|\u516c\u53f8|\u8bc1\u5238|\u94f6\u884c|\u63a7\u80a1)")
LOW_VALUE_TITLE_TERMS = ("\u516c\u544a", "\u62ab\u9732", "\u53d1\u5e03", "\u5173\u4e8e", "\u516c\u53f8", "\u80a1\u4efd", "\u6709\u9650", "\u8d23\u4efb")
PROGRESS_TERMS = ("\u8fdb\u5c55", "\u56de\u590d", "\u540e\u7eed", "\u518d\u6b21")


def build_major_events(
    symbol: str,
    news_items: list[dict[str, Any]],
    data_status: dict[str, Any] | None = None,
    *,
    now: datetime | None = None,
    default_limit: int = DEFAULT_EVENT_LIMIT,
    max_limit: int = MAX_EVENT_LIMIT,
) -> list[dict[str, Any]]:
    """Classify major event clues from already fetched stock_detail.news items."""
    if not news_items:
        return []

    reference_time = _normalize_now(now)
    limit = max(0, min(int(default_limit or DEFAULT_EVENT_LIMIT), int(max_limit or MAX_EVENT_LIMIT), MAX_EVENT_LIMIT))
    if limit <= 0:
        return []

    status = data_status or {}
    degraded_source = _is_degraded_status(status)
    candidates: list[dict[str, Any]] = []

    for item in news_items:
        if not isinstance(item, dict):
            continue
        title = _clean_text(item.get("title"))
        source_name = _clean_text(item.get("source") or item.get("sourceName"))
        source_url = _clean_url(item.get("url") or item.get("sourceUrl"))
        published = _parse_published_at(item.get("publishedAt"))
        if not title or not published or published > reference_time:
            continue
        age_days = (reference_time.date() - published.date()).days
        if age_days < 0 or age_days > MAX_LOOKBACK_DAYS:
            continue

        rule = _classify_event(title)
        if rule is None:
            continue
        if age_days > RECENT_DAYS and not _is_unfinished(title):
            continue

        item_status = item.get("_dataStatus") if isinstance(item.get("_dataStatus"), dict) else status
        item_degraded = degraded_source or _is_degraded_status(item_status)
        status_name = _event_status(source_name, source_url, item_degraded)
        event = {
            "eventId": _event_id(symbol, title, published, source_name),
            "symbol": str(symbol or ""),
            "title": title,
            "eventType": rule.event_type,
            "publishedAt": published.isoformat(timespec="seconds"),
            "sourceName": source_name,
            "sourceUrl": source_url,
            "status": status_name,
            "summary": title,
            "affectedAreas": list(rule.affected_areas),
            "needsFollowUp": _follow_up_items(status_name, source_url),
            "dataStatus": _event_data_status(item_status, item_degraded),
            "classificationReason": rule.reason,
        }
        candidates.append(
            {
                "event": event,
                "published": published,
                "groupKey": _group_key(symbol, rule.event_type, title, published),
                "score": _candidate_score(title, source_name, source_url, published, item_degraded),
            }
        )

    events = [_select_representative(group)["event"] for group in _group_candidates(candidates)]
    events.sort(key=_sort_key, reverse=True)
    return events[:limit]


def _normalize_now(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)
    if value.tzinfo is not None:
        return value.astimezone(timezone(timedelta(hours=8))).replace(tzinfo=None)
    return value


def _clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip())[:240]


def _clean_url(value: object) -> str | None:
    text = str(value or "").strip()
    if not text or text.lower() in {"none", "nan", "null"}:
        return None
    if not text.startswith(("http://", "https://")):
        return None
    return text[:500]


def _parse_published_at(value: object) -> datetime | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%Y/%m/%d %H:%M:%S", "%Y/%m/%d %H:%M", "%Y/%m/%d"):
        try:
            return datetime.strptime(text[:19], fmt)
        except ValueError:
            pass
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    return parsed.replace(tzinfo=None) if parsed.tzinfo else parsed


def _classify_event(title: str) -> EventRule | None:
    for rule in EVENT_RULES:
        if any(term in title for term in rule.terms):
            return rule
    return None


def _is_unfinished(title: str) -> bool:
    return any(term in title for term in UNFINISHED_TERMS)


def _looks_like_repost(text: str) -> bool:
    return any(term in text for term in REPOST_TERMS)


def _event_status(source_name: str, source_url: str | None, degraded_source: bool) -> str:
    if degraded_source or not source_name or not source_url or any(term in source_name for term in UNRELIABLE_SOURCE_TERMS):
        return "needs_follow_up"
    if any(term in source_name for term in OFFICIAL_SOURCE_TERMS):
        return "confirmed"
    return "news_clue"


def _follow_up_items(status_name: str, source_url: str | None) -> list[str]:
    items: list[str] = []
    if status_name != "confirmed":
        items.append("verify original announcement or exchange filing")
    if not source_url:
        items.append("source url unavailable")
    return items


def _event_data_status(status: dict[str, Any], degraded_source: bool) -> dict[str, Any]:
    return {
        "provider": str(status.get("provider") or ""),
        "sourceProvider": str(status.get("sourceProvider") or ""),
        "mode": str(status.get("mode") or ""),
        "state": "partial" if degraded_source else "available",
    }


def _is_degraded_status(status: dict[str, Any]) -> bool:
    provider = str(status.get("provider") or "").lower()
    mode = str(status.get("mode") or "").lower()
    return provider in {"mock", "fallback"} or mode in {"fallback", "stale", "stale_refreshing"}


def _normalize_title(title: str) -> str:
    return re.sub(r"[\W_]+", "", title.lower())


def _group_candidates(candidates: list[dict[str, Any]]) -> list[list[dict[str, Any]]]:
    groups: dict[str, list[dict[str, Any]]] = {}
    for candidate in candidates:
        groups.setdefault(str(candidate["groupKey"]), []).append(candidate)
    return list(groups.values())


def _select_representative(group: list[dict[str, Any]]) -> dict[str, Any]:
    return max(group, key=lambda candidate: candidate["score"])


def _group_key(symbol: str, event_type: str, title: str, published: datetime) -> str:
    iso_year, iso_week, _ = published.isocalendar()
    return f"{symbol}:{event_type}:{iso_year}-W{iso_week}:{_event_topic_key(title)}"


def _event_topic_key(title: str) -> str:
    text = _strip_media_prefix(title)
    text = COMPANY_MARKER_PATTERN.sub("", text)
    for term in LOW_VALUE_TITLE_TERMS:
        text = text.replace(term, "")
    progress = "".join(term for term in PROGRESS_TERMS if term in title)
    normalized = re.sub(r"[\W_]+", "", text.lower())
    return f"{normalized}:{progress}" if progress else normalized


def _strip_media_prefix(title: str) -> str:
    text = title.strip()
    for _ in range(2):
        updated = MEDIA_PREFIX_PATTERN.sub("", text).strip()
        if updated == text:
            break
        text = updated
    return text


def _candidate_score(title: str, source_name: str, source_url: str | None, published: datetime, degraded_source: bool) -> tuple[int, int, int, float, int]:
    return (
        _source_rank(source_name),
        1 if source_url else 0,
        0 if degraded_source else 1,
        published.timestamp(),
        _field_completeness(title, source_name, source_url),
    )


def _source_rank(source_name: str) -> int:
    if any(term in source_name for term in COMPANY_ANNOUNCEMENT_SOURCES):
        return 4
    if any(term in source_name for term in EXCHANGE_REGULATOR_SOURCES):
        return 3
    if "官方" in source_name or "公告" in source_name:
        return 2
    if any(term in source_name for term in TRUSTED_MEDIA_SOURCES):
        return 1
    return 0


def _field_completeness(title: str, source_name: str, source_url: str | None) -> int:
    score = 0
    if title:
        score += 1
    if source_name:
        score += 1
    if source_url:
        score += 1
    if not _looks_like_repost(title) and not _looks_like_repost(source_name):
        score += 1
    return score


def _event_id(symbol: str, title: str, published: datetime, source_name: str) -> str:
    raw = f"{symbol}|{published.date().isoformat()}|{source_name}|{_normalize_title(title)}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def _sort_key(item: dict[str, Any]) -> tuple[str, int, int]:
    status_rank = {"confirmed": 2, "news_clue": 1, "needs_follow_up": 0}.get(str(item.get("status") or ""), 0)
    has_url = 1 if item.get("sourceUrl") else 0
    return (str(item.get("publishedAt") or ""), status_rank, has_url)
