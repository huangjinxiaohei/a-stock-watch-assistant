from __future__ import annotations

from app import mock_data


class MockProvider:
    def search_stocks(self, keyword: str) -> list[dict]:
        keyword = keyword.strip().lower()
        return [
            stock
            for stock in mock_data.STOCKS
            if not keyword or keyword in stock["code"].lower() or keyword in stock["name"].lower() or keyword in stock["industry"].lower()
        ]

    def market_overview(self) -> dict:
        quotes = [mock_data.quote(stock["symbol"]) for stock in mock_data.STOCKS]
        sorted_quotes = sorted(quotes, key=lambda item: item["changePercent"], reverse=True)
        return {
            "indexes": [
                {"code": "000001.SH", "name": "上证指数", "latestPrice": 3238.42, "changePercent": 0.42, "amount": 431200000000},
                {"code": "399001.SZ", "name": "深证成指", "latestPrice": 10486.31, "changePercent": 0.86, "amount": 562800000000},
                {"code": "399006.SZ", "name": "创业板指", "latestPrice": 2118.6, "changePercent": 1.38, "amount": 241500000000},
                {"code": "899050.BJ", "name": "北证50", "latestPrice": 1042.16, "changePercent": -0.36, "amount": 31800000000},
                {"code": "000688.SH", "name": "科创50", "latestPrice": 912.88, "changePercent": 1.12, "amount": 89500000000},
            ],
            "marketStats": {
                "risingCount": sum(1 for item in quotes if item["changePercent"] > 0),
                "fallingCount": sum(1 for item in quotes if item["changePercent"] < 0),
                "flatCount": sum(1 for item in quotes if item["changePercent"] == 0),
                "limitUpCount": sum(1 for item in quotes if item["changePercent"] >= 9.8),
                "limitDownCount": sum(1 for item in quotes if item["changePercent"] <= -9.8),
                "totalAmount": sum(item["amount"] for item in quotes),
                "activeAmount": sum(item["amount"] for item in quotes if abs(item["changePercent"]) >= 3),
                "mainNetInflow": 420000000,
                "mainFundAvailable": True,
                "mainFundSource": "mock market fund flow",
                "northboundNetInflow": 0,
                "northboundAvailable": True,
                "northboundSource": "mock hsgt fund flow",
            },
            "sectors": [
                {"name": "电池", "type": "行业", "changePercent": 3.28, "leader": "宁德时代", "turnover": 12860000000, "netInflow": 580000000},
                {"name": "白酒", "type": "行业", "changePercent": 1.18, "leader": "贵州茅台", "turnover": 6340000000, "netInflow": 210000000},
                {"name": "保险", "type": "行业", "changePercent": -1.55, "leader": "中国平安", "turnover": 6720000000, "netInflow": -180000000},
                {"name": "人工智能", "type": "概念", "changePercent": 2.16, "leader": "科大讯飞", "turnover": 15120000000, "netInflow": 360000000},
            ],
            "gainers": [{**item, "rankReason": "涨幅靠前"} for item in sorted_quotes[:5]],
            "losers": [{**item, "rankReason": "跌幅靠前"} for item in sorted_quotes[-5:]][::-1],
            "amountRanking": [{**item, "rankReason": "成交额靠前"} for item in sorted(quotes, key=lambda item: item["amount"], reverse=True)[:5]],
            "turnoverRanking": [{**item, "rankReason": "换手率靠前"} for item in sorted(quotes, key=lambda item: item["turnoverRate"], reverse=True)[:5]],
        }

    def quote(self, symbol: str) -> dict:
        return mock_data.quote(symbol)

    def stock_detail(self, symbol: str) -> dict:
        return mock_data.detail(symbol)

    def intraday(self, symbol: str) -> list[dict]:
        return mock_data.intraday(symbol)

    def kline(self, symbol: str) -> list[dict]:
        return mock_data.kline(symbol)
