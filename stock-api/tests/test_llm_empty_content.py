from __future__ import annotations

import unittest
from types import SimpleNamespace
from unittest.mock import patch

import httpx

from app.research.llm_client import LlmClient, LlmClientError
from app.research.prompts import SYSTEM_PROMPT, build_user_prompt


class _Response:
    status_code = 200

    def __init__(self, payload: dict[str, object]) -> None:
        self.payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict[str, object]:
        return self.payload


class _Client:
    payloads: list[dict[str, object]] = []
    responses: list[dict[str, object]] = []

    def __init__(self, *, timeout: httpx.Timeout) -> None:
        self.timeout = timeout

    def __enter__(self) -> "_Client":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def post(self, *args: object, **kwargs: object) -> _Response:
        payload = kwargs.get("json")
        if isinstance(payload, dict):
            type(self).payloads.append(payload)
        return _Response(type(self).responses.pop(0))


def _settings() -> SimpleNamespace:
    return SimpleNamespace(
        ai_report_enable_llm=True,
        llm_api_key="test-key",
        llm_base_url="https://llm.example/v1",
        llm_model="test-model",
        llm_provider="openai_compatible",
        llm_timeout_seconds=48.0,
        llm_connect_timeout_seconds=5.0,
        llm_max_retries=0,
        llm_max_tokens=700,
        llm_temperature=0.2,
        ai_report_ai_timeout_seconds=110.0,
    )


def _response(content: object, *, finish_reason: str | None = "stop", reasoning: object = None) -> dict[str, object]:
    return {
        "model": "test-model",
        "choices": [{"finish_reason": finish_reason, "message": {"content": content, "reasoning_content": reasoning}}],
        "usage": {"prompt_tokens": 11, "completion_tokens": 7, "total_tokens": 18},
    }


class LlmEmptyContentTests(unittest.TestCase):
    def setUp(self) -> None:
        _Client.payloads = []
        _Client.responses = []

    def _generate(self, response: dict[str, object]) -> tuple[LlmClient, dict[str, object]]:
        _Client.responses = [response]
        with patch("app.research.llm_client.settings", _settings()), patch("app.research.llm_client.httpx.Client", _Client):
            client = LlmClient()
            result = client.generate_report({"symbol": "SH600519"})
        return client, result

    def test_request_disables_thinking_and_keeps_json_contract(self) -> None:
        _, result = self._generate(_response('{"executiveSummary":"ok"}'))

        self.assertEqual(result, {"executiveSummary": "ok"})
        request = _Client.payloads[0]
        self.assertEqual(request["thinking"], {"type": "disabled"})
        self.assertEqual(request["response_format"], {"type": "json_object"})
        self.assertEqual(request["max_tokens"], 700)
        self.assertIn("Return strict JSON", SYSTEM_PROMPT)
        self.assertIn("Return JSON", build_user_prompt({"symbol": "SH600519"}))

    def test_normal_content_collects_non_sensitive_metadata(self) -> None:
        client, result = self._generate(_response('  {"executiveSummary":"ok"}  ', reasoning="ignored"))

        self.assertEqual(result, {"executiveSummary": "ok"})
        self.assertEqual(
            client.last_diagnostics,
            {
                "finish_reason": "stop",
                "content_length": len('{"executiveSummary":"ok"}'),
                "reasoning_content_present": True,
                "reasoning_content_length": len("ignored"),
                "response_model": "test-model",
            },
        )
        self.assertEqual(client.last_usage, {"prompt_tokens": 11, "completion_tokens": 7, "total_tokens": 18})

    def test_empty_and_whitespace_content_map_to_empty_content(self) -> None:
        for content in (None, "   "):
            with self.subTest(content=content):
                _Client.responses = [_response(content)]
                with patch("app.research.llm_client.settings", _settings()), patch("app.research.llm_client.httpx.Client", _Client):
                    client = LlmClient()
                    with self.assertRaisesRegex(LlmClientError, "LLM_EMPTY_CONTENT"):
                        client.generate_report({"symbol": "SH600519"})
                self.assertEqual(client.last_diagnostics["content_length"], 0)

    def test_reasoning_only_response_is_diagnosed_without_logging_reasoning_text(self) -> None:
        secret_reasoning = "private reasoning must not be logged"
        _Client.responses = [_response(None, reasoning=secret_reasoning)]
        with patch("app.research.llm_client.settings", _settings()), patch("app.research.llm_client.httpx.Client", _Client):
            client = LlmClient()
            with self.assertLogs("app.research.llm_client", "WARNING") as logs, self.assertRaisesRegex(LlmClientError, "LLM_EMPTY_CONTENT"):
                client.generate_report({"symbol": "SH600519"})

        self.assertTrue(client.last_diagnostics["reasoning_content_present"])
        self.assertEqual(client.last_diagnostics["reasoning_content_length"], len(secret_reasoning))
        self.assertNotIn(secret_reasoning, "\n".join(logs.output))
        self.assertNotIn(secret_reasoning, str(client.last_diagnostics))

    def test_finish_reason_maps_to_safe_fallback_codes(self) -> None:
        cases = {
            "length": "LLM_OUTPUT_TRUNCATED",
            "content_filter": "LLM_CONTENT_FILTERED",
            "insufficient_system_resource": "LLM_RESOURCE_INTERRUPTED",
        }
        for finish_reason, expected in cases.items():
            with self.subTest(finish_reason=finish_reason):
                _Client.responses = [_response(None, finish_reason=finish_reason)]
                with patch("app.research.llm_client.settings", _settings()), patch("app.research.llm_client.httpx.Client", _Client):
                    with self.assertRaisesRegex(LlmClientError, expected):
                        LlmClient().generate_report({"symbol": "SH600519"})

    def test_invalid_json_maps_to_safe_reason(self) -> None:
        _Client.responses = [_response("not-json")]
        with patch("app.research.llm_client.settings", _settings()), patch("app.research.llm_client.httpx.Client", _Client):
            with self.assertRaisesRegex(LlmClientError, "LLM_INVALID_JSON"):
                LlmClient().generate_report({"symbol": "SH600519"})


if __name__ == "__main__":
    unittest.main()
