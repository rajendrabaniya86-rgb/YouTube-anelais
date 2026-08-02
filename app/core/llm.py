import json
import re

import httpx

from app.config import settings

API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class LLMError(RuntimeError):
    pass


def generate(prompt: str, temperature: float = 0.9) -> str:
    if not settings.gemini_api_key:
        raise LLMError("GEMINI_API_KEY is not configured")
    url = API_URL.format(model=settings.gemini_model)
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": temperature},
    }
    with httpx.Client(timeout=120) as client:
        resp = client.post(url, json=payload, headers={"x-goog-api-key": settings.gemini_api_key})
    if resp.status_code >= 400:
        raise LLMError(f"Gemini error {resp.status_code}: {resp.text[:400]}")
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
