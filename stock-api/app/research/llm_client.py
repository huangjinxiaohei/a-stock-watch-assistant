from __future__ import annotations

import json
import time
from typing import Any

import httpx

from app.config import settings
from app.research.prompts import SYSTEM_PROMPT, build_user_prompt


class LlmClientError(RuntimeError):
    pass


class LlmClient:
    def __init__(self) -> None:
        self.provider = settings.llm_provider or "openai_compatible"
        self.model = settings.llm_model or None

    @property
    def is_configured(self) -> bool:
        return bool(settings.llm_api_key and settings.llm_base_url and settings.llm_model)

    def generate_report(
        self,
        fact_package: dict[str, Any],
        *,
        timeout_seconds: float | None = None,
        allow_retries: bool = True,
    ) -> dict[str, Any]:
        if not settings.ai_report_enable_llm:
            raise LlmClientError("AI_REPORT_ENABLE_LLM=false")
        if not self.is_configured:
            raise LlmClientError("LLM configuration incomplete")
        if self.provider != "openai_compatible":
            raise LlmClientError(f"Unsupported LLM_PROVIDER: {self.provider}")

        url = _chat_completions_url(settings.llm_base_url)
        payload = {
            "model": settings.llm_model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": build_user_prompt(fact_package)},
            ],
            "temperature": settings.llm_temperature,
            "response_format": {"type": "json_object"},
        }
        headers = {
            "Authorization": f"Bearer {settings.llm_api_key}",
            "Content-Type": "application/json",
        }

        budget_seconds = _effective_timeout_seconds(timeout_seconds)
        deadline = time.monotonic() + budget_seconds
        last_error: Exception | None = None
        attempts = max(1, settings.llm_max_retries + 1) if allow_retries else 1
        for _ in range(attempts):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise LlmClientError(_timeout_reason(budget_seconds))
            try:
                with httpx.Client(timeout=_request_timeout(remaining)) as client:
                    response = client.post(url, headers=headers, json=payload)
                if response.status_code in {401, 403, 429} or response.status_code >= 500:
                    raise LlmClientError(f"LLM upstream status {response.status_code}")
                response.raise_for_status()
                content = _extract_message_content(response.json())
                return _parse_json_object(content)
            except httpx.TimeoutException as error:
                last_error = error
                if time.monotonic() >= deadline:
                    raise LlmClientError(_timeout_reason(budget_seconds)) from error
            except httpx.RequestError as error:
                last_error = error
            except (json.JSONDecodeError, KeyError, TypeError, ValueError, httpx.HTTPStatusError, LlmClientError) as error:
                last_error = error
                if isinstance(error, LlmClientError) and "upstream status 429" in str(error):
                    continue
                break

        if time.monotonic() >= deadline:
            raise LlmClientError(_timeout_reason(budget_seconds)) from last_error
        reason = str(last_error) if last_error else "LLM request failed"
        raise LlmClientError(_safe_reason(reason))


def _chat_completions_url(base_url: str) -> str:
    clean = base_url.rstrip("/")
    if clean.endswith("/chat/completions"):
        return clean
    return f"{clean}/chat/completions"


def _extract_message_content(payload: dict[str, Any]) -> str:
    choices = payload.get("choices") or []
    if not choices:
        raise LlmClientError("LLM returned no choices")
    content = (choices[0].get("message") or {}).get("content")
    if not isinstance(content, str) or not content.strip():
        raise LlmClientError("LLM returned empty content")
    return content


def _parse_json_object(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        lines = [line for line in text.splitlines() if not line.strip().startswith("```")]
        text = "\n".join(lines).strip()
    value = json.loads(text)
    if not isinstance(value, dict):
        raise LlmClientError("LLM JSON root is not object")
    return value


def _safe_reason(reason: str) -> str:
    redacted = reason.replace(settings.llm_api_key, "[redacted]") if settings.llm_api_key else reason
    return redacted[:240]


def _request_timeout(remaining_seconds: float) -> httpx.Timeout:
    connect_timeout = min(settings.llm_connect_timeout_seconds, remaining_seconds)
    return httpx.Timeout(
        connect=connect_timeout,
        read=remaining_seconds,
        write=remaining_seconds,
        pool=connect_timeout,
    )


def _effective_timeout_seconds(timeout_seconds: float | None) -> float:
    requested = settings.llm_timeout_seconds if timeout_seconds is None else timeout_seconds
    try:
        parsed = float(requested)
    except (TypeError, ValueError):
        parsed = settings.llm_timeout_seconds
    maximum = float(getattr(settings, "ai_report_ai_timeout_seconds", 110.0))
    return min(max(parsed, 0.1), maximum)


def _timeout_reason(timeout_seconds: float) -> str:
    return f"LLM timeout after {int(timeout_seconds)} seconds"
