import httpx

from app.config import settings
from app.core import llm

SUGGEST_URL = "https://suggestqueries.google.com/complete/search"

META_PROMPT = """You are a YouTube SEO expert. Optimise metadata for a {kind} video.

Video topic: {topic}
Script narration: {narration}
Real YouTube autocomplete keywords for this topic: {keywords}
Channel niche: {niche}
Language for title/description: {language}

Rules:
- title AND description MUST be written in {language}; only brand names, product names and
  widely-used English tech terms may stay in English. A fully English title is invalid.
- title <= 70 chars, front-loads the strongest keyword, curiosity driven, no clickbait lies
- description: 2-3 sentence hook using keywords, then a bullet summary, then 3-5 hashtags
- tags: 15-20 lowercase tags mixing broad and long-tail keywords, each <= 30 chars
- hashtags: 5 items starting with #{shorts_hint}

JSON shape:
{{"title": "", "description": "", "tags": [], "hashtags": [], "keywords_used": []}}"""


def autocomplete_keywords(seed: str, limit: int = 12) -> list[str]:
    """Free YouTube autocomplete keyword research (no API key needed)."""
    params = {"client": "firefox", "ds": "yt", "q": seed}
    try:
        with httpx.Client(timeout=20) as client:
            resp = client.get(SUGGEST_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError):
        return []
    return [str(item) for item in data[1][:limit]]


def build_metadata(kind: str, script: dict) -> dict:
    topic = script.get("topic", settings.channel_topic)
    narration = " ".join(scene["narration"] for scene in script["scenes"])[:2500]
    keywords = autocomplete_keywords(topic)
    meta = llm.generate_json(
        META_PROMPT.format(
            kind=kind,
            topic=topic,
            narration=narration,
            keywords=", ".join(keywords) or "none",
            niche=settings.channel_topic,
            language=settings.channel_language,
            shorts_hint="Shorts" if kind == "short" else "",
        ),
        temperature=0.7,
    )
    meta["title"] = meta["title"][:95]
    meta["tags"] = [t[:30] for t in meta.get("tags", [])][:20]
    meta["hashtags"] = [h if h.startswith("#") else f"#{h}" for h in meta.get("hashtags", [])][:5]
    if kind == "short" and "#shorts" not in [h.lower() for h in meta["hashtags"]]:
        meta["hashtags"].insert(0, "#Shorts")
    tail = " ".join(meta["hashtags"])
    if tail not in meta["description"]:
        meta["description"] = f"{meta['description']}\n\n{tail}"
    meta["keywords"] = keywords
    return meta
