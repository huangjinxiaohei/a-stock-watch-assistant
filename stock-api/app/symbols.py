from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class NormalizedSymbol:
    symbol: str
    code: str
    market: str

    @property
    def ak_market(self) -> str:
        return self.market.lower()

    @property
    def ts_code(self) -> str:
        return f"{self.code}.{self.market}"


def normalize_symbol(raw: str) -> NormalizedSymbol:
    value = raw.strip().upper().replace(".", "").replace("-", "")

    if value.startswith(("SH", "SZ", "BJ")):
        market = value[:2]
        code = value[2:]
    elif value.endswith(("SH", "SZ", "BJ")):
        market = value[-2:]
        code = value[:-2]
    else:
        code = value
        market = infer_market(code)

    if not code.isdigit() or len(code) != 6:
        raise ValueError("Use A-share code such as 600519, SH600519, 000001, or SZ000001.")

    return NormalizedSymbol(symbol=f"{market}{code}", code=code, market=market)


def infer_market(code: str) -> str:
    if code.startswith(("6", "9")):
        return "SH"
    if code.startswith(("8", "4", "92")):
        return "BJ"
    return "SZ"
