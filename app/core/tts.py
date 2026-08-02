import asyncio
import subprocess
from pathlib import Path

import edge_tts
from gtts import gTTS

VOICES = {
    "hi": "hi-IN-MadhurNeural",
    "en": "en-US-AndrewNeural",
    "ne": "ne-NP-SagarNeural",
}


def voice_for(language: str) -> str:
    return VOICES.get(language.split("-")[0].lower(), VOICES["en"])


async def _speak(text: str, out_path: Path, voice: str, rate: str) -> None:
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(str(out_path))


def _silence(out_path: Path, seconds: float = 3.0) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono",
         "-t", f"{seconds}", str(out_path)],
        capture_output=True,
        check=True,
    )


def synthesize(text: str, out_path: Path, language: str, rate: str = "+8%") -> Path:
    """Free TTS: Edge neural voices first, Google Translate TTS as fallback."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        asyncio.run(_speak(text, out_path, voice_for(language), rate))
        return out_path
    except Exception:
        pass
    try:
        gTTS(text=text, lang=language.split("-")[0].lower()).save(str(out_path))
        return out_path
    except Exception:
        _silence(out_path, max(3.0, len(text) / 14))
        return out_path
