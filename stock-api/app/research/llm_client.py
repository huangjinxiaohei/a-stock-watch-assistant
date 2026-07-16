from __future__ import annotations

import json
import logging
import time
from typing import Any

import httpx

from app.config import settings
from app.research.prompts import SYSTEM_PROMPT, build_user_prompt


LOGGER = logging.getLogger(__name__)


class LlmClientError(RuntimeError):
    pass


class LlmClient:
    def __init__(self) -> None:
        self.provider = settings.llm_provider or "openai_compatible"
        self.model = settings.llm_model or None
        self.last_usage: dict[str, int] | None = None
        self.last_diagnostics: dict[str, object] | None = None

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
            "max_tokens": int(getattr(settings, "llm_max_tokens", 700)),
            "response_format": {"type": "json_object"},
            "thinking": {"type": "disabled"},
        }
        headers = {
            "Authorization": f"Bearer {settings.llm_api_key}",
            "Content-Type": "application/json",
        }

        self.last_usage = None
        self.last_diagnostics = None
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
                response_payload = response.json()
                self.last_usage = _extract_usage(response_payload)
                content = _extract_message_content(response_payload, self)
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


def _extract_message_content(payload: dict[str, Any], client: LlmClient) -> str:
    choices = payload.get("choices") or []
    if not choices:
        client.last_diagnostics = _response_diagnostics(payload, None, None, None)
        raise LlmClientError("LLM_EMPTY_CONTENT")

    choice = choices[0] if isinstance(choices[0], dict) else {}
    message = choice.get("message") if isinstance(choice.get("message"), dict) else {}
    content = message.get("content")
    reasoning = message.get("reasoning_content")
    finish_reason = choice.get("finish_reason")
    content_text = content if isinstance(content, str) else ""
    reasoning_text = reasoning if isinstance(reasoning, str) else ""
    client.last_diagnostics = _response_diagnostics(payload, finish_reason, content_text, reasoning_text)
    if content_text.strip():
        return content_text.strip()

    reason = _empty_content_reason(finish_reason)
    LOGGER.warning(
        "llm_empty_content finish_reason=%s content_length=%s reasoning_content_present=%s reasoning_content_length=%s response_model=%s prompt_tokens=%s completion_tokens=%s total_tokens=%s",
        client.last_diagnostics["finish_reason"],
        client.last_diagnostics["content_length"],
        client.last_diagnostics["reasoning_content_present"],
        client.last_diagnostics["reasoning_content_length"],
        client.last_diagnostics["response_model"],
        (client.last_usage or {}).get("prompt_tokens"),
        (client.last_usage or {}).get("completion_tokens"),
        (client.last_usage or {}).get("total_tokens"),
    )
    raise LlmClientError(reason)


def _parse_json_object(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        lines = [line for line in text.splitlines() if not line.strip().startswith("```")]
        text = "\n".join(lines).strip()
    try:
        value = json.loads(text)
    except json.JSONDecodeError as error:
        raise LlmClientError("LLM_INVALID_JSON") from error
    if not isinstance(value, dict):
        raise LlmClientError("LLM_INVALID_JSON")
    return value


def _response_diagnostics(payload: dict[str, Any], finish_reason: object, content: object, reasoning: object) -> dict[str, object]:
    content_text = content if isinstance(content, str) else ""
    reasoning_text = reasoning if isinstance(reasoning, str) else ""
    return {
        "finish_reason": str(finish_reason) if finish_reason is not None else None,
        "content_length": len(content_text.strip()),
        "reasoning_content_present": bool(reasoning_text),
        "reasoning_content_length": len(reasoning_text),
        "response_model": str(payload.get("model")) if payload.get("model") is not None else None,
    }


def _empty_content_reason(finish_reason: object) -> str:
    mapping = {
        "length": "LLM_OUTPUT_TRUNCATED",
        "content_filter": "LLM_CONTENT_FILTERED",
        "insufficient_system_resource": "LLM_RESOURCE_INTERRUPTED",
    }
    return mapping.get(str(finish_reason or ""), "LLM_EMPTY_CONTENT")


def _extract_usage(payload: dict[str, Any]) -> dict[str, int] | None:
    usage = payload.get("usage")
    if not isinstance(usage, dict):
        return None
    result: dict[str, int] = {}
    for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
        value = usage.get(key)
        if isinstance(value, int) and value >= 0:
            result[key] = value
    return result or None


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
