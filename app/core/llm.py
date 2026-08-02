import json
import re

import httpx

from app.config import settings

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# Tried in order when the configured model is out of free-tier quota or unavailable.
FALLBACK_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-2.5-flash"]


class LLMError(RuntimeError):
    pass


def _models() -> list[str]:
    ordered = [settings.gemini_model] + FALLBACK_MODELS
    return list(dict.fromkeys(m for m in ordered if m))


def generate(prompt: str, temperature: float = 0.9) -> str:
    if not settings.gemini_api_key:
        raise LLMError("GEMINI_API_KEY is not configured")
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature},
    }
    headers = {"x-goog-api-key": settings.gemini_api_key}
    errors = []
    resp = None
    with httpx.Client(timeout=180) as client:
        for model in _models():
            resp = client.post(API_URL.format(model=model), json=payload, headers=headers)
            if resp.status_code < 400:
                break
            errors.append(f"{model}: {resp.status_code} {resp.text[:200]}")
            if resp.status_code not in (404, 429, 500, 503):
                break
    if resp is None or resp.status_code >= 400:
        raise LLMError("Gemini request failed - " + " | ".join(errors))
    data = resp.json()
    try:
        return data["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError) as exc:
        raise LLMError(f"Unexpected Gemini response: {json.dumps(data)[:400]}") from exc


def generate_json(prompt: str, temperature: float = 0.8) -> dict:
    raw = generate(prompt + "\n\nRespond with valid JSON only, no markdown fences.", temperature)
    match = re.search(r"\{.*\}", raw, re.S)
    if not match:
        raise LLMError(f"No JSON found in response: {raw[:400]}")
    return json.loads(match.group(0))
