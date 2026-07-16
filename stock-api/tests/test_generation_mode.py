from __future__ import annotations

import json
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from app.research.llm_facts import build_llm_fact_package
from app.research.schemas import ResearchReportRequest
from app.research.service import ResearchReportService


def _facts(*, quote_mode: str = "fresh") -> dict[str, object]:
    return {
        "symbol": "SH600519",
        "name": "Test",
        "quote": {"symbol": "SH600519", "code": "600519", "name": "Test", "latestPrice": 100.0},
        "detail": {},
        "klineSummary": {"available": True, "latestClose": 100.0, "latestDate": "2026-07-16"},
        "dataSources": [],
        "dataStatus": [],
        "missingFields": [],
        "warnings": [],
        "majorEvents": [],
        "financialExplanation": None,
        "riskOverview": None,
        "coreStatus": {
            "quote": {"provider": "akshare" if quote_mode == "fresh" else "mock", "mode": quote_mode},
            "kline": {"provider": "akshare", "mode": "fresh"},
        },
    }


def _settings(*, enabled: bool = True) -> SimpleNamespace:
    return SimpleNamespace(
        ai_report_enable_llm=enabled,
        llm_model="deepseek-v4-pro",
        llm_provider="openai_compatible",
        ai_report_ai_timeout_seconds=110.0,
    )


def _llm_payload() -> dict[str, object]:
    return {
        "executiveSummary": "Public facts were organized without a forecast.",
        "keyObservations": ["Use only the supplied public facts."],
        "riskInterpretation": ["Review the available risk evidence."],
        "dataLimitations": ["Some optional data may be unavailable."],
    }


class GenerationModeTests(unittest.TestCase):
    def test_missing_generation_mode_defaults_to_rule_without_creating_llm_client(self) -> None:
        service = ResearchReportService()
        service._build_fact_package = MagicMock(return_value=_facts())

        with patch("app.research.service.settings", _settings(enabled=True)), patch(
            "app.research.service.LlmClient"
        ) as llm_client_type:
            response = service.generate(ResearchReportRequest(symbol="SH600519"))

        llm_client_type.assert_not_called()
        self.assertEqual(response.reportStatus.source, "rule")
        self.assertEqual(response.reportStatus.status, "success")
        self.assertEqual(response.reportStatus.provider, "not_requested")
        self.assertIsNone(response.reportStatus.model)
        self.assertEqual(response.reportStatus.fallbackReason, "GENERATION_MODE_RULE")
        self.assertEqual(len(response.sections), 8)

    def test_ai_mode_disabled_returns_rule_fallback_without_creating_llm_client(self) -> None:
        service = ResearchReportService()
        service._build_fact_package = MagicMock(return_value=_facts())

        with patch("app.research.service.settings", _settings(enabled=False)), patch(
            "app.research.service.LlmClient"
        ) as llm_client_type:
            response = service.generate(ResearchReportRequest(symbol="SH600519", generationMode="ai"))

        llm_client_type.assert_not_called()
        self.assertEqual(response.reportStatus.source, "rule_fallback")
        self.assertEqual(response.reportStatus.provider, "disabled")
        self.assertIsNone(response.reportStatus.model)
        self.assertEqual(response.reportStatus.fallbackReason, "AI_REPORT_ENABLE_LLM=false")

    def test_ai_mode_core_gate_returns_rule_fallback_without_llm_call(self) -> None:
        service = ResearchReportService()
        llm_client = MagicMock(is_configured=True)
        service.llm_client = llm_client
        service._build_fact_package = MagicMock(return_value=_facts(quote_mode="fallback"))

        with patch("app.research.service.settings", _settings(enabled=True)):
            response = service.generate(ResearchReportRequest(symbol="SH600519", generationMode="ai"))

        llm_client.generate_report.assert_not_called()
        self.assertEqual(response.reportStatus.source, "rule_fallback")
        self.assertEqual(response.reportStatus.provider, "not_requested")
        self.assertIsNone(response.reportStatus.model)
        self.assertIn("CORE_QUOTE", response.reportStatus.fallbackReason or "")

    def test_ai_mode_success_uses_single_budgeted_llm_call(self) -> None:
        service = ResearchReportService()
        llm_client = MagicMock(is_configured=True)
        llm_client.generate_report.return_value = _llm_payload()
        service.llm_client = llm_client
        service._build_fact_package = MagicMock(return_value=_facts())

        with patch("app.research.service.settings", _settings(enabled=True)):
            response = service.generate(ResearchReportRequest(symbol="SH600519", generationMode="ai"))

        self.assertEqual(response.reportStatus.source, "llm")
        self.assertEqual(response.reportStatus.status, "success")
        self.assertEqual(response.reportStatus.provider, "openai_compatible")
        self.assertEqual(response.reportStatus.model, "deepseek-v4-pro")
        self.assertEqual(len(response.sections), 8)
        self.assertTrue(any("AI" in point for section in response.sections for point in section.points))
        llm_client.generate_report.assert_called_once()
        args, kwargs = llm_client.generate_report.call_args
        compact_facts = args[0]
        self.assertNotIn("detail", compact_facts)
        self.assertNotIn("financialExplanation", compact_facts)
        self.assertLessEqual(kwargs["timeout_seconds"], 110.0)
        self.assertFalse(kwargs["allow_retries"])

    def test_unsafe_ai_increment_returns_complete_rule_fallback(self) -> None:
        service = ResearchReportService()
        llm_client = MagicMock(is_configured=True)
        llm_client.generate_report.return_value = {
            "executiveSummary": "\u4e70\u5165\u8be5\u80a1\u7968",
            "keyObservations": [],
            "riskInterpretation": [],
            "dataLimitations": [],
        }
        service.llm_client = llm_client
        service._build_fact_package = MagicMock(return_value=_facts())

        with patch("app.research.service.settings", _settings(enabled=True)):
            response = service.generate(ResearchReportRequest(symbol="SH600519", generationMode="ai"))

        self.assertEqual(response.reportStatus.source, "rule_fallback")
        self.assertEqual(response.reportStatus.status, "fallback")
        self.assertEqual(len(response.sections), 8)
        self.assertTrue(response.disclaimer)

    def test_compact_ai_facts_remove_duplicate_and_bounded_data(self) -> None:
        facts = _facts()
        facts["news"] = [
            {"publishedAt": f"2026-07-{day:02d}", "source": "Public", "title": f"News {day}", "summary": "x" * 240}
            for day in range(1, 8)
        ]
        facts["detail"] = {"quote": facts["quote"], "news": facts["news"], "finance": {"extra": "x" * 240}}
        facts["majorEvents"] = [
            {"eventType": "performance", "publishedAt": f"2026-07-{day:02d}", "sourceName": "Official", "title": f"Event {day}", "summary": "x" * 240}
            for day in range(1, 6)
        ]
        raw_size = len(json.dumps(facts, ensure_ascii=False))
        compact = build_llm_fact_package(facts)
        compact_size = len(json.dumps(compact, ensure_ascii=False))

        self.assertLess(compact_size, raw_size)
        self.assertEqual(len(compact["newsClues"]), 3)
        self.assertEqual(len(compact["majorEventClues"]), 3)
        self.assertNotIn("detail", compact)


if __name__ == "__main__":
    unittest.main()
