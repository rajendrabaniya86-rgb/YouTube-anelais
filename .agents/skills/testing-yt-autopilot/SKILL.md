---
name: testing-yt-autopilot
description: How to run and end-to-end test the YT Autopilot FastAPI dashboard (script generation, video render, SEO metadata, YouTube upload, analytics report) on this Windows box.
---

# Testing YT Autopilot

## Running the app

- Python is the system interpreter at `C:\devin\python\python.exe`. There is no `venv` module available, so dependencies from `requirements.txt` are installed globally. Do not attempt to create a virtualenv.
- `ffmpeg`/`ffprobe` must be on PATH (already are). Rendering requires them.
- There is no `.env` file; `app/config.py` reads pydantic settings from env vars. Pass config as environment variables.
- Start the server from the repo root:

```powershell
$env:PYTHONIOENCODING="utf-8"   # Windows console cannot print Hindi otherwise
$env:CHANNEL_LANGUAGE="hi"
$env:ENABLE_SCHEDULER="false"   # avoids the background daily cron job firing mid-test
C:\devin\python\python.exe -m uvicorn app.main:app --port 8000
```

- Health check: `curl.exe -s http://127.0.0.1:8000/health` -> `{"ok":true}`.

## Shell gotchas on this box

- The default shell is PowerShell: use `;` not `&&`, and use `curl.exe` (not `curl`, which aliases to `Invoke-WebRequest`).
- `upload_attachment` rejects Windows-style paths. Copy artifacts to `C:\tmp\...` and reference them as `/tmp/...` when uploading.

## Browser gotchas

- Typing a URL with `type` drops the `:` character. Type the host, then send `key shift+semicolon`, then the port/path - e.g. `127.0.0.1` + `shift+semicolon` + `8000/`.
- The dashboard page barely scrolls and the run-log `<details>` sits behind the taskbar at 100% zoom. Press `ctrl+minus` 3-4 times (to ~67%) to fit the whole page in one screenshot.

## Feature entry points (app/templates/index.html)

| UI control | Endpoint | Notes |
|---|---|---|
| `खोजो` next to the keyword input | `GET /api/keywords?seed=` | Live YouTube autocomplete via `suggestqueries.google.com`; no API key. Use two different seeds to prove results are live, not static. |
| `सिर्फ़ वीडियो बनाओ (upload नहीं)` | `POST /api/run?upload=false` | Background task; takes ~40-60s per short. Refresh the page to see the new row. |
| `अभी बनाओ और पोस्ट करो` | `POST /api/run?upload=true` | Same, then attempts upload. |
| `एनालिटिक्स रिपोर्ट रिफ्रेश` | `POST /api/report` | Returns 502 + JS alert on failure by design. |
| video artifact | `GET /download/<name>.mp4` | Serves files from `output/`; useful for playing the render in-browser as visual proof. |

## Expected behaviour without YouTube OAuth credentials

`YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` / `YOUTUBE_REFRESH_TOKEN` are normally absent. This is the useful negative-test state:

- Upload run -> video row status `failed — missing config: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN`, run log status `partial`. The server must NOT crash.
- Analytics refresh -> HTTP 502 and a browser `alert()` with the same message; no 500 page.

## Verifying a rendered video

Do not trust the table status alone; check the artifact:

```powershell
ffprobe -v error -show_entries format=duration,size -show_entries stream=codec_type,codec_name,width,height,nb_frames -of default=noprint_wrappers=1 "<repo>\output\<slug>.mp4"
```

Expect a Shorts-format `1080x1920` h264 video stream plus an aac audio stream and duration in the tens of seconds. Also open `/download/<slug>.mp4` in the browser and seek - captions should change between scenes, proving multi-scene assembly rather than a single static frame.

## Known quirks

- Title language is a hard requirement in the SEO prompt, but the model is non-deterministic; an occasional English title is possible.
- Captions are emoji-stripped before drawing (`app/core/video._clean`) because the Pillow fonts have no emoji glyphs.
- `gemini-2.0-flash` can be out of free quota; `app/core/llm.py` falls back to `gemini-flash-latest`. If generation fails outright, check the fallback chain first.
- A benign `ConnectionResetError [WinError 10054]` appears in the uvicorn log when the browser aborts an mp4 range request. Not an app bug.

## Devin Secrets Needed

- `GEMINI_API_KEY` - required for script generation, SEO metadata and the analytics report.
- `PEXELS_API_KEY` - optional; without it, backgrounds fall back to generated gradients (rendering still works).
- `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`, optionally `YOUTUBE_CHANNEL_ID` - only needed to test real uploads and the analytics report end-to-end.
