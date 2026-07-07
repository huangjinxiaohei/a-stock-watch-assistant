from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import akshare as ak
import pandas as pd
import requests

from app.symbols import normalize_symbol
from app.utils import clean_number, df_records, first_value, moving_average, ttl_cache

C_CODE = "\u4ee3\u7801"
C_NAME = "\u540d\u79f0"
C_INDUSTRY = "\u884c\u4e1a"
C_LATEST = "\u6700\u65b0\u4ef7"
C_CHANGE = "\u6da8\u8dcc\u989d"
C_CHANGE_PCT = "\u6da8\u8dcc\u5e45"
C_PREV = "\u6628\u6536"
C_OPEN = "\u4eca\u5f00"
C_HIGH = "\u6700\u9ad8"
C_LOW = "\u6700\u4f4e"
C_VOLUME = "\u6210\u4ea4\u91cf"
C_AMOUNT = "\u6210\u4ea4\u989d"
C_TURNOVER = "\u6362\u624b\u7387"
C_PE_DYN = "\u5e02\u76c8\u7387-\u52a8\u6001"
C_PE = "\u5e02\u76c8\u7387"
C_PB = "\u5e02\u51c0\u7387"
C_TOTAL_CAP = "\u603b\u5e02\u503c"
C_FLOAT_CAP = "\u6d41\u901a\u5e02\u503c"
C_MAIN_FLOW = "\u4e3b\u529b\u51c0\u6d41\u5165"


class AkShareProvider:
    def __init__(self, tushare_token: str = "") -> None:
        # Kept for backwards-compatible construction; basic data enrichment now uses free AkShare sources.
        self.tushare_token = tushare_token

    def search_stocks(self, keyword: str) -> list[dict[str, Any]]:
        normalized = keyword.strip().lower()
        matches = []
        for row in self._spot_records():
            normalized_row = normalize_symbol(str(row.get(C_CODE, "")))
            code = normalized_row.code
            name = str(row.get(C_NAME, ""))
            if not normalized or normalized in code.lower() or normalized in name.lower():
                matches.append(self._summary_from_spot(row))
            if len(matches) >= 20:
                break
        return matches

    def market_overview(self) -> dict[str, Any]:
        quotes = [self._quote_from_spot(row) for row in self._spot_records()]
        quotes = [quote for quote in quotes if quote["latestPrice"] > 0]
        sorted_quotes = sorted(quotes, key=lambda item: item["changePercent"], reverse=True)
        amount_quotes = sorted(quotes, key=lambda item: item["amount"], reverse=True)
        turnover_quotes = sorted(
            [quote for quote in quotes if quote["turnoverRate"] > 0],
            key=lambda item: item["turnoverRate"],
            reverse=True,
        )
        return {
            "indexes": self._indexes(),
            "marketStats": self._market_stats(quotes),
            "sectors": self._sectors(quotes),
            "gainers": [{**item, "rankReason": "涨幅靠前"} for item in sorted_quotes[:10]],
            "losers": [{**item, "rankReason": "跌幅靠前"} for item in sorted_quotes[-10:]][::-1],
            "amountRanking": [{**item, "rankReason": "成交额靠前"} for item in amount_quotes[:10]],
            "turnoverRanking": [{**item, "rankReason": "换手率靠前"} for item in turnover_quotes[:10]],
        }

    def stock_detail(self, symbol: str) -> dict[str, Any]:
        normalized = normalize_symbol(symbol)
        quote = self._enrich_quote_with_free_basics(normalized.code, self.quote(normalized.symbol))
        return {
            "quote": quote,
            "finance": self._finance_metrics(normalized.code),
            "moneyFlow": self._money_flow(normalized.code, normalized.ak_market),
            "news": self._news(normalized.code),
        }
    def quote(self, symbol: str) -> dict[str, Any]:
        normalized = normalize_symbol(symbol)
        for row in self._spot_records():
            if normalize_symbol(str(row.get(C_CODE, ""))).code == normalized.code:
                return self._quote_from_spot(row)
        raise LookupError(f"Stock not found: {symbol}")

    def intraday(self, symbol: str) -> list[dict[str, Any]]:
        normalized = normalize_symbol(symbol)
        for loader in (self._intraday_hist_min_em, self._intraday_zh_a_minute, self._intraday_tick_em):
            try:
                points = loader(normalized.code, normalized.ak_market)
            except Exception:
                points = []
            if points:
                return points
        from app.mock_data import intraday
        return intraday(normalized.symbol)

    def kline(self, symbol: str) -> list[dict[str, Any]]:
        normalized = normalize_symbol(symbol)
        end_date = datetime.now().strftime("%Y%m%d")
        start_date = (datetime.now() - timedelta(days=90)).strftime("%Y%m%d")
        try:
            df = ak.stock_zh_a_hist(symbol=normalized.code, period="daily", start_date=start_date, end_date=end_date, adjust="qfq")
            records = df_records(df.tail(60))
            return self._kline_from_records(records, {
                "date": "\u65e5\u671f",
                "open": "\u5f00\u76d8",
                "high": "\u6700\u9ad8",
                "low": "\u6700\u4f4e",
                "close": "\u6536\u76d8",
                "volume": C_VOLUME,
            })
        except Exception:
            sina_symbol = f"{normalized.market.lower()}{normalized.code}"
            df = ak.stock_zh_a_daily(symbol=sina_symbol, start_date=start_date, end_date=end_date, adjust="")
            records = df_records(df.tail(60))
            return self._kline_from_records(records, {
                "date": "date",
                "open": "open",
                "high": "high",
                "low": "low",
                "close": "close",
                "volume": "volume",
            })

    def _kline_from_records(self, records: list[dict[str, Any]], columns: dict[str, str]) -> list[dict[str, Any]]:
        closes: list[float] = []
        rows: list[dict[str, Any]] = []
        for row in records:
            close = clean_number(row.get(columns["close"]))
            closes.append(close)
            rows.append({
                "date": str(row.get(columns["date"], "")),
                "open": clean_number(row.get(columns["open"])),
                "close": close,
                "low": clean_number(row.get(columns["low"])),
                "high": clean_number(row.get(columns["high"])),
                "volume": clean_number(row.get(columns["volume"])),
            })
        for index, row in enumerate(rows):
            row["ma5"] = moving_average(closes, index, 5)
            row["ma10"] = moving_average(closes, index, 10)
            row["ma20"] = moving_average(closes, index, 20)
        return rows

    @ttl_cache(30)
    def _spot_records(self) -> list[dict[str, Any]]:
        records = self._eastmoney_spot_records()
        if records:
            return records
        try:
            records = df_records(ak.stock_zh_a_spot_em())
            if records:
                return records
        except Exception:
            pass
        return df_records(ak.stock_zh_a_spot())

    def _eastmoney_spot_records(self) -> list[dict[str, Any]]:
        urls = (
            "https://push2delay.eastmoney.com/api/qt/clist/get",
            "https://push2.eastmoney.com/api/qt/clist/get",
            "https://28.push2.eastmoney.com/api/qt/clist/get",
            "https://82.push2.eastmoney.com/api/qt/clist/get",
        )
        for url in urls:
            for trust_env in (False, True):
                try:
                    records = self._fetch_eastmoney_spot(url, trust_env)
                except Exception:
                    records = []
                if records:
                    return records
        return []

    def _fetch_eastmoney_spot(self, url: str, trust_env: bool) -> list[dict[str, Any]]:
        page_size = 100
        first_page = self._fetch_eastmoney_spot_page(url, trust_env, 1, page_size)
        diff = first_page.get("diff") or []
        total = int(clean_number(first_page.get("total"), len(diff)))
        records = list(diff)
        for page in range(2, total // page_size + 2):
            if len(records) >= total:
                break
            page_data = self._fetch_eastmoney_spot_page(url, trust_env, page, page_size)
            records.extend(page_data.get("diff") or [])
        return [self._eastmoney_record_from_diff(item) for item in records if isinstance(item, dict)]

    def _fetch_eastmoney_spot_page(self, url: str, trust_env: bool, page: int, page_size: int) -> dict[str, Any]:
        session = requests.Session()
        session.trust_env = trust_env
        response = session.get(
            url,
            params={
                "pn": page,
                "pz": page_size,
                "po": "1",
                "np": "1",
                "ut": "bd1d9ddb04089700cf9c27f6f7426281",
                "fltt": "2",
                "invt": "2",
                "fid": "f12",
                "fs": "m:0 t:6,m:0 t:80,m:1 t:2,m:1 t:23,m:0 t:81 s:2048",
                "fields": "f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f22,f11,f62,f115",
            },
            headers={
                "Accept": "application/json,text/plain,*/*",
                "Referer": "https://quote.eastmoney.com/center/gridlist.html",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
            },
            timeout=10,
        )
        response.raise_for_status()
        payload = response.json()
        data = payload.get("data")
        if not isinstance(data, dict):
            return {}
        return data

    def _eastmoney_record_from_diff(self, item: dict[str, Any]) -> dict[str, Any]:
        return {
            C_CODE: str(item.get("f12", "")),
            C_NAME: str(item.get("f14", "")),
            C_INDUSTRY: "A股",
            C_LATEST: clean_number(item.get("f2")),
            C_CHANGE: clean_number(item.get("f4")),
            C_CHANGE_PCT: clean_number(item.get("f3")),
            C_PREV: clean_number(item.get("f18")),
            C_OPEN: clean_number(item.get("f17")),
            C_HIGH: clean_number(item.get("f15")),
            C_LOW: clean_number(item.get("f16")),
            C_VOLUME: clean_number(item.get("f5")),
            C_AMOUNT: clean_number(item.get("f6")),
            C_TURNOVER: clean_number(item.get("f8")),
            C_PE_DYN: clean_number(item.get("f9")),
            C_PE: clean_number(item.get("f115")),
            C_PB: clean_number(item.get("f23")),
            C_TOTAL_CAP: clean_number(item.get("f20")),
            C_FLOAT_CAP: clean_number(item.get("f21")),
            C_MAIN_FLOW: clean_number(item.get("f62")),
        }

    def _summary_from_spot(self, row: dict[str, Any]) -> dict[str, Any]:
        normalized = normalize_symbol(str(row.get(C_CODE, "")))
        code = normalized.code
        return {
            "symbol": normalized.symbol,
            "code": normalized.code,
            "name": str(row.get(C_NAME, "")),
            "market": normalized.market,
            "industry": str(row.get(C_INDUSTRY, "A股")),
        }

    def _quote_from_spot(self, row: dict[str, Any]) -> dict[str, Any]:
        summary = self._summary_from_spot(row)
        latest = clean_number(row.get(C_LATEST))
        previous_close = clean_number(row.get(C_PREV))
        change = clean_number(row.get(C_CHANGE), latest - previous_close if previous_close else 0)
        return {
            **summary,
            "latestPrice": latest,
            "change": change,
            "changePercent": clean_number(row.get(C_CHANGE_PCT)),
            "open": clean_number(row.get(C_OPEN)),
            "high": clean_number(row.get(C_HIGH)),
            "low": clean_number(row.get(C_LOW)),
            "previousClose": previous_close,
            "volume": clean_number(row.get(C_VOLUME)),
            "amount": clean_number(row.get(C_AMOUNT)),
            "turnoverRate": clean_number(row.get(C_TURNOVER)),
            "pe": clean_number(first_value(pd.Series(row), [C_PE_DYN, C_PE])),
            "pb": clean_number(row.get(C_PB)),
            "totalMarketCap": clean_number(row.get(C_TOTAL_CAP)),
            "floatMarketCap": clean_number(row.get(C_FLOAT_CAP)),
            "mainFundFlow": clean_number(row.get(C_MAIN_FLOW)),
            "updateTime": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        }

    def _enrich_quote_with_free_basics(self, code: str, quote: dict[str, Any]) -> dict[str, Any]:
        enriched = dict(quote)
        if enriched["turnoverRate"] <= 0:
            enriched["turnoverRate"] = self._turnover_rate(enriched["symbol"], {})

        if enriched["pe"] == 0:
            enriched["pe"] = self._baidu_valuation(code, "\u5e02\u76c8\u7387(TTM)")
        if enriched["pb"] <= 0:
            enriched["pb"] = self._baidu_valuation(code, "\u5e02\u51c0\u7387")
        if enriched["totalMarketCap"] <= 0:
            total_market_cap_yi = self._baidu_valuation(code, "\u603b\u5e02\u503c")
            if total_market_cap_yi > 0:
                enriched["totalMarketCap"] = total_market_cap_yi * 100_000_000

        return enriched

    def _baidu_valuation(self, code: str, indicator: str) -> float:
        try:
            df = ak.stock_zh_valuation_baidu(symbol=code, indicator=indicator, period="\u8fd1\u4e00\u5e74")
            records = df_records(df.tail(1))
            if records:
                return clean_number(records[-1].get("value"))
        except Exception:
            return 0
        return 0
    def _turnover_rate(self, symbol: str, row: dict[str, Any]) -> float:
        existing = clean_number(row.get(C_TURNOVER))
        if existing > 0:
            return existing
        try:
            normalized = normalize_symbol(symbol)
            end_date = datetime.now().strftime("%Y%m%d")
            start_date = (datetime.now() - timedelta(days=10)).strftime("%Y%m%d")
            df = ak.stock_zh_a_daily(symbol=f"{normalized.market.lower()}{normalized.code}", start_date=start_date, end_date=end_date, adjust="")
            records = df_records(df.tail(1))
            if records:
                return round(clean_number(records[-1].get("turnover")) * 100, 2)
        except Exception:
            return 0
        return 0
    def _indexes(self) -> list[dict[str, Any]]:
        targets = {
            "000001": "上证指数",
            "399001": "深证成指",
            "399006": "创业板指",
            "899050": "北证50",
            "000688": "科创50",
        }
        out: list[dict[str, Any]] = []

        try:
            records = df_records(ak.stock_zh_index_spot_em())
            out = self._pick_indexes(records, targets)
        except Exception:
            out = []

        if len(out) < 4:
            try:
                records = ak.stock_zh_index_spot_sina().to_dict("records")
                out = self._merge_indexes(out, self._pick_indexes(records, targets))
            except Exception:
                pass

        if not any(item.get("code") == "899050" and item.get("latestPrice", 0) > 0 for item in out):
            bse50 = self._bse50_from_sina_daily()
            if bse50:
                out = self._merge_indexes(out, [bse50])

        return self._merge_indexes(out, self._fallback_indexes())

    def _bse50_from_sina_daily(self) -> dict[str, Any] | None:
        try:
            records = df_records(ak.stock_zh_index_daily(symbol="bj899050").tail(2))
        except Exception:
            return None
        if not records:
            return None
        latest = records[-1]
        previous = records[-2] if len(records) >= 2 else latest
        close = clean_number(latest.get("close"))
        previous_close = clean_number(previous.get("close"))
        if close <= 0:
            return None
        change_percent = round((close - previous_close) / previous_close * 100, 3) if previous_close > 0 else 0
        return {
            "code": "899050",
            "name": "北证50",
            "latestPrice": close,
            "changePercent": change_percent,
            "amount": 0,
        }
    def _pick_indexes(self, records: list[dict[str, Any]], targets: dict[str, str]) -> list[dict[str, Any]]:
        out = []
        for row in records:
            raw_code = str(row.get(C_CODE, "")).lower().replace("sh", "").replace("sz", "").replace("bj", "").zfill(6)
            raw_name = str(row.get(C_NAME, ""))
            matched_code = raw_code if raw_code in targets else next((code for code, name in targets.items() if raw_name == name), "")
            if matched_code:
                out.append({
                    "code": matched_code,
                    "name": targets[matched_code],
                    "latestPrice": clean_number(row.get(C_LATEST)),
                    "changePercent": clean_number(row.get(C_CHANGE_PCT)),
                    "amount": clean_number(row.get(C_AMOUNT)),
                })
        return out

    def _merge_indexes(self, primary: list[dict[str, Any]], fallback: list[dict[str, Any]]) -> list[dict[str, Any]]:
        order = ["上证指数", "深证成指", "创业板指", "北证50", "科创50"]
        merged = {item["name"]: item for item in fallback}
        merged.update({item["name"]: item for item in primary if item.get("latestPrice", 0) > 0})
        return [merged[name] for name in order if name in merged]

    def _fallback_indexes(self) -> list[dict[str, Any]]:
        return [
            {"code": "000001", "name": "上证指数", "latestPrice": 0, "changePercent": 0, "amount": 0},
            {"code": "399001", "name": "深证成指", "latestPrice": 0, "changePercent": 0, "amount": 0},
            {"code": "399006", "name": "创业板指", "latestPrice": 0, "changePercent": 0, "amount": 0},
            {"code": "899050", "name": "北证50", "latestPrice": 0, "changePercent": 0, "amount": 0},
            {"code": "000688", "name": "科创50", "latestPrice": 0, "changePercent": 0, "amount": 0},
        ]
    def _market_stats(self, quotes: list[dict[str, Any]]) -> dict[str, Any]:
        rising = sum(1 for item in quotes if item["changePercent"] > 0)
        falling = sum(1 for item in quotes if item["changePercent"] < 0)
        flat = max(0, len(quotes) - rising - falling)
        limit_up = sum(1 for item in quotes if item["changePercent"] >= 9.8)
        limit_down = sum(1 for item in quotes if item["changePercent"] <= -9.8)
        total_amount = sum(item["amount"] for item in quotes)
        active_amount = sum(item["amount"] for item in quotes if abs(item["changePercent"]) >= 3)
        main_fund = self._main_fund_flow(quotes)
        return {
            "risingCount": rising,
            "fallingCount": falling,
            "flatCount": flat,
            "limitUpCount": limit_up,
            "limitDownCount": limit_down,
            "totalAmount": total_amount,
            "activeAmount": active_amount,
            "mainNetInflow": main_fund["mainNetInflow"],
            "mainFundAvailable": main_fund["mainFundAvailable"],
            "mainFundSource": main_fund["mainFundSource"],
            "northboundNetInflow": 0,
            "northboundAvailable": False,
            "northboundSource": "北向实时成交净买额披露口径已调整，首页不再展示该指标",
        }

    def _main_fund_flow(self, quotes: list[dict[str, Any]]) -> dict[str, Any]:
        values = [clean_number(item.get("mainFundFlow")) for item in quotes]
        available = any(value != 0 for value in values)
        return {
            "mainNetInflow": sum(values) if available else 0,
            "mainFundAvailable": available,
            "mainFundSource": "东方财富全市场快照 f62 主力净流入汇总" if available else "东方财富全市场快照未返回主力资金",
        }

    def _sectors(self, quotes: list[dict[str, Any]]) -> list[dict[str, Any]]:
        try:
            records = df_records(ak.stock_board_industry_name_em())
            sectors = [
                {
                    "name": str(row.get("\u677f\u5757\u540d\u79f0", "")),
                    "changePercent": clean_number(row.get(C_CHANGE_PCT)),
                    "leader": str(row.get("\u9886\u6da8\u80a1\u7968", "")),
                    "turnover": clean_number(row.get(C_AMOUNT)),
                }
                for row in records[:12]
            ]
            if sectors:
                return sectors
        except Exception:
            pass

        groups: dict[str, list[dict[str, Any]]] = {}
        for quote in quotes:
            industry = quote.get("industry") or "A股"
            groups.setdefault(industry, []).append(quote)

        if len(groups) <= 1:
            gainers = sorted(quotes, key=lambda item: item["changePercent"], reverse=True)[:20]
            losers = sorted(quotes, key=lambda item: item["changePercent"])[:20]
            active = sorted(quotes, key=lambda item: item["amount"], reverse=True)[:20]
            return [
                self._sector_from_quotes("强势个股", gainers),
                self._sector_from_quotes("弱势个股", losers),
                self._sector_from_quotes("成交活跃", active),
            ]

        sectors = []
        for industry, items in groups.items():
            if not items:
                continue
            sectors.append(self._sector_from_quotes(industry, items))
        return sorted(sectors, key=lambda item: abs(item["changePercent"]), reverse=True)[:12]

    def _sector_from_quotes(self, name: str, items: list[dict[str, Any]]) -> dict[str, Any]:
        leader = max(items, key=lambda item: item["changePercent"]) if items else {"name": ""}
        amount = sum(item["amount"] for item in items)
        avg_change = sum(item["changePercent"] for item in items) / len(items) if items else 0
        return {
            "name": name,
            "changePercent": round(avg_change, 2),
            "leader": leader["name"] if items else "",
            "turnover": amount,
            "netInflow": sum(item["amount"] * item["changePercent"] / 100 for item in items),
            "type": "行业" if name not in {"强势个股", "弱势个股", "成交活跃"} else "市场",
        }

    def _finance_metrics(self, code: str) -> dict[str, Any]:
        source = "AkShare stock_financial_analysis_indicator"
        empty = {
            "revenueGrowth": 0,
            "netProfitGrowth": 0,
            "grossMargin": 0,
            "roe": 0,
            "debtRatio": 0,
            "eps": 0,
            "available": False,
            "source": source,
            "asOfDate": "",
        }
        try:
            df = ak.stock_financial_analysis_indicator(symbol=code)
            records = df_records(df.tail(1))
            if not records:
                return {**empty, "warning": "财务指标接口未返回记录"}
            row = pd.Series(records[-1])
            metrics = {
                "revenueGrowth": clean_number(first_value(row, ["\u4e3b\u8425\u4e1a\u52a1\u6536\u5165\u589e\u957f\u7387(%)", "\u8425\u4e1a\u6536\u5165\u540c\u6bd4\u589e\u957f\u7387(%)"])),
                "netProfitGrowth": clean_number(first_value(row, ["\u51c0\u5229\u6da6\u589e\u957f\u7387(%)", "\u51c0\u5229\u6da6\u540c\u6bd4\u589e\u957f\u7387(%)"])),
                "grossMargin": clean_number(first_value(row, ["\u9500\u552e\u6bdb\u5229\u7387(%)", "\u6bdb\u5229\u7387(%)"])),
                "roe": clean_number(first_value(row, ["\u51c0\u8d44\u4ea7\u6536\u76ca\u7387(%)", "\u52a0\u6743\u51c0\u8d44\u4ea7\u6536\u76ca\u7387(%)"])),
                "debtRatio": clean_number(first_value(row, ["\u8d44\u4ea7\u8d1f\u503a\u7387(%)"])),
                "eps": clean_number(first_value(row, ["\u644a\u8584\u6bcf\u80a1\u6536\u76ca(\u5143)", "\u57fa\u672c\u6bcf\u80a1\u6536\u76ca"])),
            }
            available = any(abs(value) > 0 for value in metrics.values())
            result: dict[str, Any] = {
                **metrics,
                "available": available,
                "source": source,
                "asOfDate": str(first_value(row, ["\u65e5\u671f", "\u62a5\u544a\u671f", "date"], "")),
            }
            if not available:
                result["warning"] = "财务指标接口返回全 0，按不可用处理"
            return result
        except Exception as error:
            return {**empty, "warning": str(error)}

    def _money_flow(self, code: str, market: str) -> dict[str, Any]:
        source = "AkShare stock_individual_fund_flow"
        empty = {
            "mainNetInflow": 0,
            "retailNetInflow": 0,
            "largeOrderRatio": 0,
            "fiveDayMainNetInflow": 0,
            "available": False,
            "source": source,
            "asOfDate": "",
        }
        try:
            df = ak.stock_individual_fund_flow(stock=code, market=market)
            records = df_records(df.tail(5))
            if not records:
                return {**empty, "warning": "个股资金流接口未返回记录"}
            latest = records[-1]
            latest_series = pd.Series(latest)
            main_values = [clean_number(item.get("\u4e3b\u529b\u51c0\u6d41\u5165-\u51c0\u989d")) for item in records]
            main = clean_number(latest.get("\u4e3b\u529b\u51c0\u6d41\u5165-\u51c0\u989d"))
            retail = clean_number(first_value(latest_series, ["\u5c0f\u5355\u51c0\u6d41\u5165-\u51c0\u989d", "\u6563\u6237\u51c0\u6d41\u5165-\u51c0\u989d"]))
            amount = abs(main) + abs(retail)
            result: dict[str, Any] = {
                "mainNetInflow": main,
                "retailNetInflow": retail,
                "largeOrderRatio": round(main / amount * 100, 2) if amount else 0,
                "fiveDayMainNetInflow": sum(main_values),
                "available": any(abs(value) > 0 for value in [main, retail, *main_values]),
                "source": source,
                "asOfDate": str(first_value(latest_series, ["\u65e5\u671f", "date"], "")),
            }
            if not result["available"]:
                result["warning"] = "个股资金流接口返回全 0，按不可用处理"
            return result
        except Exception as error:
            return {**empty, "warning": str(error)}

    def _news(self, code: str) -> list[dict[str, Any]]:
        try:
            records = df_records(ak.stock_news_em(symbol=code).head(20))
            return [
                {
                    "id": f"{code}-{index}",
                    "title": str(row.get("\u65b0\u95fb\u6807\u9898", "")),
                    "source": str(row.get("\u6587\u7ae0\u6765\u6e90", "东方财富")),
                    "publishedAt": str(row.get("\u53d1\u5e03\u65f6\u95f4", "")),
                    "url": row.get("\u65b0\u95fb\u94fe\u63a5"),
                    "sentiment": "neutral",
                }
                for index, row in enumerate(records)
            ]
        except Exception:
            return []

    def _intraday_hist_min_em(self, code: str, market: str) -> list[dict[str, Any]]:
        df = ak.stock_zh_a_hist_min_em(symbol=code, period="1", adjust="")
        return self._intraday_from_df(df)

    def _intraday_zh_a_minute(self, code: str, market: str) -> list[dict[str, Any]]:
        df = ak.stock_zh_a_minute(symbol=f"{market}{code}", period="1", adjust="")
        return self._intraday_from_df(df)

    def _intraday_tick_em(self, code: str, market: str) -> list[dict[str, Any]]:
        df = ak.stock_intraday_em(symbol=code)
        records = df_records(df.tail(240))
        points = []
        total = 0.0
        total_volume = 0.0
        for row in records:
            series = pd.Series(row)
            price = clean_number(first_value(series, ["\u6210\u4ea4\u4ef7", "\u4ef7\u683c"]))
            volume = clean_number(first_value(series, ["\u624b\u6570", C_VOLUME]))
            total += price * volume
            total_volume += volume
            points.append({"time": str(first_value(series, ["\u65f6\u95f4", "\u6210\u4ea4\u65f6\u95f4"], ""))[:5], "price": price, "averagePrice": round(total / total_volume, 2) if total_volume else price, "volume": volume})
        return points

    def _intraday_from_df(self, df: pd.DataFrame) -> list[dict[str, Any]]:
        records = df_records(df.tail(240))
        points = []
        closes = []
        for row in records:
            series = pd.Series(row)
            price = clean_number(first_value(series, ["\u6536\u76d8", "close", C_LATEST]))
            closes.append(price)
            time_value = str(first_value(series, ["\u65f6\u95f4", "\u65e5\u671f", "day"], ""))
            points.append({"time": time_value[-8:-3] if len(time_value) >= 8 else time_value[:5], "price": price, "averagePrice": round(sum(closes) / len(closes), 2), "volume": clean_number(first_value(series, [C_VOLUME, "volume"]))})
        return [point for point in points if point["price"] > 0]















