from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from app.config import settings

SCOPES = [
    "https://www.googleapis.com/auth/youtube.upload",
    "https://www.googleapis.com/auth/youtube.readonly",
    "https://www.googleapis.com/auth/yt-analytics.readonly",
]
TOKEN_URI = "https://oauth2.googleapis.com/token"


class YouTubeAuthError(RuntimeError):
    pass


def credentials() -> Credentials:
    missing = [
        name
        for name, value in (
            ("YOUTUBE_CLIENT_ID", settings.youtube_client_id),
            ("YOUTUBE_CLIENT_SECRET", settings.youtube_client_secret),
            ("YOUTUBE_REFRESH_TOKEN", settings.youtube_refresh_token),
        )
        if not value
    ]
    if missing:
        raise YouTubeAuthError(f"missing config: {', '.join(missing)}")
    creds = Credentials(
        token=None,
        refresh_token=settings.youtube_refresh_token,
        client_id=settings.youtube_client_id,
        client_secret=settings.youtube_client_secret,
        token_uri=TOKEN_URI,
        scopes=SCOPES,
    )
    creds.refresh(Request())
    return creds


def data_client():
    return build("youtube", "v3", credentials=credentials(), cache_discovery=False)


def analytics_client():
    return build("youtubeAnalytics", "v2", credentials=credentials(), cache_discovery=False)


def upload(video_path: Path, meta: dict, kind: str, thumbnail: Path | None = None) -> str:
    youtube = data_client()
    title = meta["title"]
    if kind == "short" and "#shorts" not in title.lower():
        title = f"{title} #Shorts"[:100]
    body = {
        "snippet": {
            "title": title,
            "description": meta["description"][:4900],
            "tags": meta["tags"],
            "categoryId": "27",
            "defaultLanguage": settings.channel_language,
        },
        "status": {
            "privacyStatus": settings.upload_privacy,
            "selfDeclaredMadeForKids": False,
        },
    }
    request = youtube.videos().insert(
        part="snippet,status",
        body=body,
        media_body=MediaFileUpload(str(video_path), chunksize=-1, resumable=True),
    )
    response = request.execute()
    video_id = response["id"]
    if thumbnail and thumbnail.exists():
        try:
            youtube.thumbnails().set(
                videoId=video_id, media_body=MediaFileUpload(str(thumbnail))
            ).execute()
        except Exception:  # thumbnails need a verified channel; not fatal
            pass
    return video_id


def channel_id() -> str:
    if settings.youtube_channel_id:
        return settings.youtube_channel_id
    response = data_client().channels().list(part="id", mine=True).execute()
    return response["items"][0]["id"]
