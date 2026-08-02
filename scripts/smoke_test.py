"""Offline smoke test: renders a tiny video without any API key."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core import store, video  # noqa: E402

SCRIPT = {
    "topic": "productivity tips",
    "scenes": [
        {"narration": "Do you waste your morning on your phone?",
         "caption": "Stop the morning scroll", "image_query": "sunrise desk"},
        {"narration": "Try this two minute rule and watch your day change.",
         "caption": "The 2 minute rule", "image_query": "clock minimal"},
    ],
}


def main() -> int:
    store.init()
    path = video.render(SCRIPT, "short", "en", "smoketest")
    thumb = video.make_thumbnail("Stop the morning scroll", "short", "smoketest")
    print(f"video: {path} ({path.stat().st_size} bytes)")
    print(f"thumb: {thumb} ({thumb.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
