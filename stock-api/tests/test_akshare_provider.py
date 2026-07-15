from __future__ import annotations

import unittest
from unittest.mock import patch

from app.providers.akshare_provider import AkShareProvider


class _Response:
    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return {
            "data": {
                "f12": "300750",
                "f14": "宁德时代",
                "f2": 200.0,
                "f3": 1.2,
                "f4": 2.4,
                "f5": 1000,
                "f6": 200000,
                "f7": 2.0,
                "f8": 0.5,
                "f9": 20.0,
                "f15": 202.0,
                "f16": 198.0,
                "f17": 199.0,
                "f18": 197.6,
                "f20": 1000000,
                "f21": 800000,
                "f23": 3.0,
                "f62": 5000,
                "f115": 21.0,
            }
        }


class _Session:
    trust_env = False

    def get(self, *args: object, **kwargs: object) -> _Response:
        return _Response()


class AkShareProviderQuoteTests(unittest.TestCase):
    def test_quote_uses_single_symbol_eastmoney_snapshot_before_market_snapshot(self) -> None:
        provider = AkShareProvider()
        with patch("app.providers.akshare_provider.requests.Session", return_value=_Session()), patch.object(
            provider,
            "_spot_records",
            side_effect=AssertionError("market snapshot should not be fetched"),
        ):
            quote = provider.quote("SZ300750")

        self.assertEqual(quote["symbol"], "SZ300750")
        self.assertEqual(quote["latestPrice"], 200.0)


if __name__ == "__main__":
    unittest.main()
