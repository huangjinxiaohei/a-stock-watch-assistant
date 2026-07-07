from __future__ import annotations

from datetime import datetime, timedelta
from math import cos, sin


STOCKS = [
    {"symbol": "SH600519", "code": "600519", "name": "贵州茅台", "market": "SH", "industry": "白酒"},
    {"symbol": "SZ000001", "code": "000001", "name": "平安银行", "market": "SZ", "industry": "银行"},
    {"symbol": "SZ300750", "code": "300750", "name": "宁德时代", "market": "SZ", "industry": "电池"},
    {"symbol": "SH600036", "code": "600036", "name": "招商银行", "market": "SH", "industry": "银行"},
    {"symbol": "SH601318", "code": "601318", "name": "中国平安", "market": "SH", "industry": "保险"},
]

QUOTE_SEED = {
    "SH600519": [1488.60, 18.40, 1.25, 1462.10, 1496.80, 1458.20, 1470.20, 3276000, 4863000000, 0.26, 24.8, 8.1, 1869700000000, 1869700000000],
    "SZ000001": [11.28, -0.18, -1.57, 11.44, 11.52, 11.18, 11.46, 88240000, 998000000, 0.45, 4.7, 0.52, 218900000000, 218600000000],
    "SZ300750": [196.72, 7.96, 4.22, 188.10, 199.48, 187.62, 188.76, 51620000, 10085000000, 1.32, 20.6, 4.28, 865500000000, 768200000000],
    "SH600036": [35.42, 0.36, 1.03, 35.02, 35.68, 34.92, 35.06, 54280000, 1918000000, 0.26, 6.2, 0.91, 893300000000, 730800000000],
    "SH601318": [46.18, -1.44, -3.02, 47.48, 47.80, 45.86, 47.62, 114620000, 5330000000, 1.06, 8.3, 0.82, 842900000000, 499800000000],
}


def quote(symbol: str) -> dict:
    summary = next((item for item in STOCKS if item["symbol"] == symbol), STOCKS[0])
    seed = QUOTE_SEED.get(symbol, QUOTE_SEED[summary["symbol"]])
    keys = [
        "latestPrice",
        "change",
        "changePercent",
        "open",
        "high",
        "low",
        "previousClose",
        "volume",
        "amount",
        "turnoverRate",
        "pe",
        "pb",
        "totalMarketCap",
        "floatMarketCap",
    ]
    return {**summary, **dict(zip(keys, seed, strict=True)), "updateTime": datetime.now().strftime("%Y-%m-%d %H:%M:%S")}


def detail(symbol: str) -> dict:
    return {
        "quote": quote(symbol),
        "finance": {"revenueGrowth": 8.5, "netProfitGrowth": 6.2, "grossMargin": 24.3, "roe": 12.6, "debtRatio": 58.2, "eps": 1.18},
        "moneyFlow": {"mainNetInflow": 128000000, "retailNetInflow": -46000000, "largeOrderRatio": 11.7, "fiveDayMainNetInflow": 316000000},
        "news": [
            {"id": f"{symbol}-1", "title": "模拟新闻：板块成交活跃，市场关注业绩兑现", "source": "本地模拟", "publishedAt": datetime.now().strftime("%Y-%m-%d %H:%M"), "sentiment": "neutral"}
        ],
    }


def intraday(symbol: str) -> list[dict]:
    q = quote(symbol)
    times = ["09:30", "09:45", "10:00", "10:15", "10:30", "10:45", "11:00", "11:15", "11:30", "13:00", "13:15", "13:30", "13:45", "14:00", "14:15", "14:30", "14:45", "15:00"]
    out = []
    for index, label in enumerate(times):
        progress = index / (len(times) - 1)
        price = q["open"] + (q["latestPrice"] - q["open"]) * progress + sin(index * 1.3) * q["latestPrice"] * 0.006
        out.append({"time": label, "price": round(price, 2), "averagePrice": round((q["open"] + price + q["latestPrice"]) / 3, 2), "volume": round(q["volume"] / len(times) * (0.8 + abs(cos(index))))})
    out[-1]["price"] = q["latestPrice"]
    return out


def kline(symbol: str) -> list[dict]:
    q = quote(symbol)
    rows = []
    closes = []
    for offset in range(39, -1, -1):
        date = datetime.now() - timedelta(days=offset)
        close = q["latestPrice"] * (1 + sin(offset * 0.55) * 0.04 - offset * q["changePercent"] / 100 / 180)
        open_price = close * (1 + sin(offset) * 0.01)
        closes.append(round(close, 2))
        rows.append({"date": date.strftime("%Y-%m-%d"), "open": round(open_price, 2), "close": round(close, 2), "low": round(min(open_price, close) * 0.985, 2), "high": round(max(open_price, close) * 1.015, 2), "volume": round(q["volume"] * (0.7 + abs(sin(offset))))})
    for index, row in enumerate(rows):
        row["ma5"] = _ma(closes, index, 5)
        row["ma10"] = _ma(closes, index, 10)
        row["ma20"] = _ma(closes, index, 20)
    return rows


def _ma(values: list[float], index: int, period: int) -> float:
    start = max(0, index - period + 1)
    return round(sum(values[start : index + 1]) / len(values[start : index + 1]), 2)
