"""Entry point for cron / GitHub Actions: one full daily run."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core import pipeline  # noqa: E402


def main() -> int:
    upload = "--no-upload" not in sys.argv
    result = pipeline.daily_run(upload=upload)
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["status"] != "failed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
