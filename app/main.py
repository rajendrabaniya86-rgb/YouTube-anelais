import json
from pathlib import Path

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import BackgroundTasks, FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from app.config import OUTPUT_DIR, settings
from app.core import analytics, pipeline, seo, store

BASE = Path(__file__).resolve().parent
app = FastAPI(title="YT Autopilot")
app.mount("/static", StaticFiles(directory=BASE / "static"), name="static")
templates = Jinja2Templates(directory=str(BASE / "templates"))
scheduler = BackgroundScheduler(timezone="UTC")


@app.on_event("startup")
def startup() -> None:
    store.init()
    if settings.enable_scheduler and not scheduler.running:
        scheduler.add_job(
            pipeline.daily_run,
            CronTrigger(hour=settings.post_hour_utc, minute=0),
            id="daily",
            replace_existing=True,
        )
        scheduler.start()


@app.on_event("shutdown")
def shutdown() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)


@app.get("/")
def dashboard(request: Request):
    videos = store.recent_videos()
    for item in videos:
        item["tags"] = json.loads(item["tags"])
        item["hashtags"] = json.loads(item["hashtags"])
    next_run = None
    job = scheduler.get_job("daily") if scheduler.running else None
    if job and job.next_run_time:
        next_run = job.next_run_time.isoformat(timespec="minutes")
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "videos": videos,
            "runs": store.recent_runs(),
            "report": store.latest_report(),
            "settings": settings,
            "next_run": next_run,
        },
    )


@app.post("/api/run")
def run_now(background: BackgroundTasks, upload: bool = True):
    background.add_task(pipeline.daily_run, upload)
    return JSONResponse({"status": "started"})


@app.post("/api/report")
def refresh_report():
    try:
        body = analytics.weakness_report(settings.channel_language)
    except Exception as exc:
        return JSONResponse({"error": str(exc)}, status_code=502)
    store.add_report(body)
    return JSONResponse({"status": "ok"})


@app.get("/api/keywords")
def keywords(seed: str):
    return JSONResponse({"seed": seed, "keywords": seo.autocomplete_keywords(seed, 20)})


@app.get("/api/videos")
def list_videos():
    return JSONResponse(store.recent_videos(50))


@app.get("/download/{name}")
def download(name: str):
    path = (OUTPUT_DIR / name).resolve()
    if not path.is_file() or OUTPUT_DIR.resolve() not in path.parents:
        return JSONResponse({"error": "not found"}, status_code=404)
    return FileResponse(path)


@app.get("/health")
def health():
    return {"ok": True}
