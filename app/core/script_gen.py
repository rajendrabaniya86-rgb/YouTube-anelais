from app.config import settings
from app.core import llm, store

SHORTS_PROMPT = """You are a viral YouTube Shorts scriptwriter for a channel about: {topic}.
Language: {language}. Avoid repeating these recent titles: {recent}.

Write one 45-second Shorts script with a strong 2-second hook, 4-6 punchy beats and a
call-to-action to subscribe. Each beat becomes one on-screen scene.

JSON shape:
{{
  "topic": "short english phrase describing the subject",
  "scenes": [{{"narration": "spoken line", "caption": "3-6 word on-screen text",
               "image_query": "english stock footage search phrase"}}]
}}"""

LONG_PROMPT = """You are a YouTube scriptwriter for a channel about: {topic}.
Language: {language}. Avoid repeating these recent titles: {recent}.

Write a ~6 minute narrated video script broken into 12-18 scenes, with an opening hook,
clear value-packed sections and a closing call-to-action.

JSON shape:
{{
  "topic": "short english phrase describing the subject",
  "scenes": [{{"narration": "2-3 spoken sentences", "caption": "3-6 word on-screen text",
               "image_query": "english stock footage search phrase"}}]
}}"""


def build_script(kind: str) -> dict:
    template = SHORTS_PROMPT if kind == "short" else LONG_PROMPT
    prompt = template.format(
        topic=settings.channel_topic,
        language=settings.channel_language,
        recent="; ".join(store.recent_titles()) or "none",
    )
    script = llm.generate_json(prompt)
    if not script.get("scenes"):
        raise llm.LLMError("script has no scenes")
    return script
