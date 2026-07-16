from __future__ import annotations

import os
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import httpx

from app.config import _env_float, _env_int
from app.research.llm_client import LlmClient, LlmClientError
from app.research.schemas import DISCLAIMER, ResearchReportRequest
from app.research.service import ResearchReportService


class _TimeoutClient:
    attempts = 0
    timeouts: list[httpx.Timeout] = []

    def __init__(self, *, timeout: httpx.Timeout) -> None:
        type(self).timeouts.append(timeout)

    def __enter__(self) -> "_TimeoutClient":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def post(self, *args: object, **kwargs: object) -> object:
        type(self).attempts += 1
        raise httpx.ReadTimeout("simulated slow model")


class _SuccessResponse:
    status_code = 200

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return {"choices": [{"message": {"content": "{\"ok\": true}"}}], "usage": {"prompt_tokens": 12, "completion_tokens": 8, "total_tokens": 20}}


class _SuccessClient:
    timeouts: list[httpx.Timeout] = []
    payloads: list[dict[str, object]] = []

    def __init__(self, *, timeout: httpx.Timeout) -> None:
        type(self).timeouts.append(timeout)

    def __enter__(self) -> "_SuccessClient":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def post(self, *args: object, **kwargs: object) -> _SuccessResponse:
        payload = kwargs.get("json")
        if isinstance(payload, dict):
            type(self).payloads.append(payload)
        return _SuccessResponse()


class _TimedOutLlm:
    is_configured = True

    def generate_report(self, facts: dict[str, object], **kwargs: object) -> dict[str, object]:
        raise LlmClientError("LLM timeout after 48 seconds")


class _SuccessfulLlm:
    is_configured = True

    def generate_report(self, facts: dict[str, object], **kwargs: object) -> dict[str, object]:
        return {
            "executiveSummary": "Public facts were organized without a forecast.",
            "keyObservations": ["Use only the supplied public facts."],
            "riskInterpretation": [],
            "dataLimitations": [],
        }


def _llm_settings() -> SimpleNamespace:
    return SimpleNamespace(
        ai_report_enable_llm=True,
        llm_api_key="test-key",
        llm_base_url="https://llm.example/v1",
        llm_model="test-model",
        llm_provider="openai_compatible",
        llm_timeout_seconds=48.0,
        llm_connect_timeout_seconds=5.0,
        llm_max_retries=1,
        llm_max_tokens=700,
        llm_temperature=0.2,
    )


def _facts() -> dict[str, object]:
    return {
        "symbol": "SH600519",
        "name": "Test",
        "quote": {"symbol": "SH600519", "code": "600519", "name": "Test", "latestPrice": 100.0},
        "detail": {},
        "klineSummary": {"available": True, "latestClose": 100.0},
        "news": [],
        "dataSources": [],
        "dataStatus": [],
        "missingFields": [],
        "warnings": [],
        "majorEvents": [
            {
                "eventId": "evt-1",
                "symbol": "SH600519",
                "title": "Public disclosure",
                "eventType": "performance",
                "publishedAt": "2026-07-15",
                "sourceName": "Official source",
                "sourceUrl": "https://example.com/disclosure",
                "status": "confirmed",
                "summary": "Public fact.",
                "affectedAreas": ["financials"],
                "needsFollowUp": [],
                "dataStatus": {"state": "available"},
                "classificationReason": "rule",
            }
        ],
        "financialExplanation": {
            "status": "missing",
            "asOfDate": None,
            "sourceName": "Unavailable",
            "revenueGrowth": {"value": None, "unit": "%", "available": False},
            "netProfitGrowth": {"value": None, "unit": "%", "available": False},
            "grossMargin": {"value": None, "unit": "%", "available": False},
            "roe": {"value": None, "unit": "%", "available": False},
            "debtRatio": {"value": None, "unit": "%", "available": False},
            "eps": {"value": None, "unit": "", "available": False},
            "changePattern": "Insufficient data",
            "summary": "No financial conclusion.",
            "confirmedFacts": [],
            "limitations": ["Data unavailable."],
            "needsFollowUp": ["Review filing."],
            "dataStatus": {"state": "missing"},
        },
        "riskOverview": {
            "status": "partial",
            "summary": "Review available facts.",
            "riskItems": [],
            "watchItems": [{"id": "watch-1", "title": "Review data", "reason": "Data is incomplete.", "relatedData": "finance", "followUpSource": "filing"}],
            "limitations": ["Data unavailable."],
            "dataStatus": {"state": "partial"},
        },
        "coreStatus": {
            "quote": {"provider": "akshare", "mode": "fresh"},
            "kline": {"provider": "akshare", "mode": "fresh"},
        },
    }


class LlmTimeoutBudgetTests(unittest.TestCase):
    def setUp(self) -> None:
        _TimeoutClient.attempts = 0
        _TimeoutClient.timeouts = []
        _SuccessClient.payloads = []

    def test_exhausted_total_budget_stops_retries_and_raises_safe_timeout(self) -> None:
        monotonic_values = iter([0.0, 0.0, 48.0])
        test_settings = _llm_settings()

        with patch("app.research.llm_client.settings", test_settings), patch(
            "app.research.llm_client.httpx.Client", _TimeoutClient
        ), patch("app.research.llm_client.time.monotonic", side_effect=monotonic_values):
            client = LlmClient()
            with self.assertRaisesRegex(LlmClientError, "LLM timeout"):
                client.generate_report({"symbol": "SH600519"})

        self.assertEqual(_TimeoutClient.attempts, 1)
        self.assertEqual(_TimeoutClient.timeouts[0].read, 48.0)
        self.assertEqual(_TimeoutClient.timeouts[0].connect, 5.0)


    def test_success_within_budget_returns_llm_payload(self) -> None:
        _SuccessClient.timeouts = []
        with patch("app.research.llm_client.settings", _llm_settings()), patch(
            "app.research.llm_client.httpx.Client", _SuccessClient
        ), patch("app.research.llm_client.time.monotonic", side_effect=[0.0, 0.0]):
            client = LlmClient()
            result = client.generate_report({"symbol": "SH600519"})

        self.assertEqual(result, {"ok": True})
        self.assertEqual(_SuccessClient.timeouts[0].read, 48.0)
        self.assertEqual(_SuccessClient.timeouts[0].connect, 5.0)
        self.assertEqual(_SuccessClient.payloads[0]["max_tokens"], 700)
        self.assertEqual(client.last_usage, {"prompt_tokens": 12, "completion_tokens": 8, "total_tokens": 20})

    def test_timeout_falls_back_to_complete_rule_report(self) -> None:
        service = ResearchReportService()
        service.llm_client = _TimedOutLlm()
        service._build_fact_package = MagicMock(return_value=_facts())
        runtime_settings = SimpleNamespace(ai_report_enable_llm=True, llm_model="deepseek-v4-pro", llm_provider="openai_compatible", ai_report_ai_timeout_seconds=110.0)

        with patch("app.research.service.settings", runtime_settings):
            response = service.generate(ResearchReportRequest(symbol="SH600519", generationMode="ai"))

        self.assertEqual(response.reportStatus.source, "rule_fallback")
        self.assertEqual(response.reportStatus.status, "fallback")
        self.assertEqual(response.reportStatus.provider, "openai_compatible")
        self.assertEqual(response.reportStatus.model, "deepseek-v4-pro")
        self.assertEqual(response.reportStatus.fallbackReason, "LLM timeout after 48 seconds")
        self.assertEqual(len(response.sections), 8)
        self.assertTrue(response.disclaimer)
        self.assertEqual(len(response.majorEvents), 1)
        self.assertIsNotNone(response.financialExplanation)
        self.assertIsNotNone(response.riskOverview)

    def test_output_token_configuration_is_capped(self) -> None:
        with patch.dict(os.environ, {"LLM_MAX_TOKENS": "5000"}, clear=False):
            self.assertEqual(_env_int("LLM_MAX_TOKENS", 700, minimum=100, maximum=900), 900)

    def test_timeout_configuration_is_capped_at_48_seconds(self) -> None:
        with patch.dict(os.environ, {"LLM_TIMEOUT_SECONDS": "120"}, clear=False):
            self.assertEqual(_env_float("LLM_TIMEOUT_SECONDS", 48.0, minimum=1.0, maximum=48.0), 48.0)


    def test_successful_llm_within_budget_returns_llm_report(self) -> None:
        service = ResearchReportService()
        service.llm_client = _SuccessfulLlm()
        service._build_fact_package = MagicMock(return_value=_facts())
        runtime_settings = SimpleNamespace(ai_report_enable_llm=True, llm_model="deepseek-v4-pro", llm_provider="openai_compatible", ai_report_ai_timeout_seconds=110.0)

        with patch("app.research.service.settings", runtime_settings):
            response = service.generate(ResearchReportRequest(symbol="SH600519", generationMode="ai"))

        self.assertEqual(response.reportStatus.source, "llm")
        self.assertEqual(response.reportStatus.status, "success")
        self.assertEqual(response.reportStatus.provider, "openai_compatible")
        self.assertEqual(response.reportStatus.model, "deepseek-v4-pro")
        self.assertEqual(len(response.sections), 8)
        self.assertEqual(response.disclaimer, DISCLAIMER)

    def test_disabled_llm_returns_rule_report_without_model(self) -> None:
        service = ResearchReportService()
        service._build_fact_package = MagicMock(return_value=_facts())

        with patch("app.research.service.settings", SimpleNamespace(ai_report_enable_llm=False, ai_report_ai_timeout_seconds=110.0)):
            response = service.generate(ResearchReportRequest(symbol="SH600519", generationMode="ai"))

        self.assertEqual(response.reportStatus.source, "rule_fallback")
        self.assertEqual(response.reportStatus.status, "fallback")
        self.assertEqual(response.reportStatus.provider, "disabled")
        self.assertIsNone(response.reportStatus.model)
        self.assertEqual(len(response.sections), 8)
        self.assertEqual(response.disclaimer, DISCLAIMER)


if __name__ == "__main__":
    unittest.main()
