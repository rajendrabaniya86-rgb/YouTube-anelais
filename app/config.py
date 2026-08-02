from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = ROOT / "output"
DATA_DIR = ROOT / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(ROOT / ".env"), extra="ignore")

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    pexels_api_key: str = ""

    youtube_client_id: str = ""
    youtube_client_secret: str = ""
    youtube_refresh_token: str = ""
    youtube_channel_id: str = ""

    channel_topic: str = "technology and productivity tips"
    channel_language: str = "hi"
    upload_privacy: str = "public"
    daily_shorts: int = 1
    daily_longs: int = 0
    post_hour_utc: int = 6
    enable_scheduler: bool = True


settings = Settings()
OUTPUT_DIR.mkdir(exist_ok=True)
DATA_DIR.mkdir(exist_ok=True)
