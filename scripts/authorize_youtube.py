"""One-time OAuth flow that prints the YOUTUBE_REFRESH_TOKEN for .env.

Usage:
    python scripts/authorize_youtube.py
Requires YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET (desktop app credentials) in .env.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from google_auth_oauthlib.flow import InstalledAppFlow  # noqa: E402

from app.config import settings  # noqa: E402
from app.core.youtube import SCOPES  # noqa: E402


def main() -> int:
    if not settings.youtube_client_id or not settings.youtube_client_secret:
        print("Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in .env first.")
        return 1
    client_config = {
        "installed": {
            "client_id": settings.youtube_client_id,
            "client_secret": settings.youtube_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }
    flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
    creds = flow.run_local_server(port=8765, prompt="consent", access_type="offline")
    print("\nAdd this line to your .env:\n")
    print(f"YOUTUBE_REFRESH_TOKEN={creds.refresh_token}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
