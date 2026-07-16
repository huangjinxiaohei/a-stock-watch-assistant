from __future__ import annotations

import json
from typing import Any


SYSTEM_PROMPT = """
You produce a compact AI supplement for a stock research report. Use only the server facts supplied. Do not browse, infer missing facts, calculate indicators, or modify server data status.
Write neutral research organization and verification limits only. News and events are public clues, never confirmed causes or price conclusions.
Do not provide transactions, positions, targets, returns, deterministic forecasts, investment recommendations, or price direction.
Return strict JSON without Markdown. Do not rewrite the complete eight-section report, event cards, financial overview, risk overview, or disclaimer.
""".strip()


def build_user_prompt(fact_package: dict[str, Any]) -> str:
    payload = json.dumps(fact_package, ensure_ascii=False, separators=(",", ":"))
    return f"""
Create a concise Chinese AI supplement from the server facts below. Every statement must be supported by those facts. Where evidence is missing, state that verification is required.

Return JSON:
{{
  "executiveSummary": "neutral Chinese summary, maximum 120 Chinese characters",
  "keyObservations": ["maximum 3 items, each at most 70 Chinese characters"],
  "riskInterpretation": ["maximum 3 items; explain only existing risk facts or verification items"],
  "dataLimitations": ["maximum 3 items; list only existing missing data or limitations"]
}}

Rules:
- Do not rewrite the full report, event cards, financial overview, risk overview, data status, or disclaimer.
- Do not add events, business causes, financial metrics, technical metrics, or future conclusions.
- Do not change risk levels, event status, financial changePattern, or data status.
- Use neutral wording such as data shows, public clue, verification needed, or currently cannot confirm.

Server facts:
{payload}
""".strip()
