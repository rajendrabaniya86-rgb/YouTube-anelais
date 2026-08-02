import re
import traceback
from datetime import datetime, timezone

from app.config import settings
from app.core import analytics, script_gen, seo, store, video, youtube


def _slug(title: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9]+", "-", title).strip("-").lower()[:40] or "video"
    return f"{datetime.now(timezone.utc):%Y%m%d-%H%M%S}-{base}"


def produce(kind: str, upload: bool = True) -> dict:
    script = script_gen.build_script(kind)
    meta = seo.build_metadata(kind, script)
    slug = _slug(meta["title"])
    path = video.render(script, kind, settings.channel_language, slug)
    row_id = store.add_video(kind, meta, str(path), "rendered")
    result = {"row_id": row_id, "kind": kind, "title": meta["title"], "path": str(path)}
    if not upload:
        return result
    try:
        thumb = video.make_thumbnail(meta["title"], kind, slug)
        video_id = youtube.upload(path, meta, kind, thumb)
        store.mark_uploaded(row_id, video_id)
        result["video_id"] = video_id
        result["url"] = f"https://youtu.be/{video_id}"
    except Exception as exc:
        store.mark_failed(row_id, str(exc))
        result["error"] = str(exc)
    return result


def daily_run(upload: bool = True) -> dict:
    store.init()
    run_id = store.start_run()
    log: list[str] = []
    results = []
    status = "success"
    plan = ["short"] * settings.daily_shorts + ["long"] * settings.daily_longs
    for kind in plan:
        try:
            result = produce(kind, upload=upload)
            results.append(result)
            log.append(f"{kind}: {result.get('url') or result.get('path')}")
            if result.get("error"):
                status = "partial"
                log.append(f"{kind} upload error: {result['error']}")
        except Exception:
            status = "partial"
            log.append(f"{kind} failed:\n{traceback.format_exc(limit=3)}")
    try:
        report = analytics.weakness_report(settings.channel_language)
        store.add_report(report)
        log.append("analytics report saved")
    except Exception as exc:
        log.append(f"analytics skipped: {exc}")
    if not results:
        status = "failed"
    store.finish_run(run_id, status, "\n".join(log))
    return {"status": status, "results": results, "log": log}
