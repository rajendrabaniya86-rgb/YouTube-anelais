import json
import sqlite3
from datetime import datetime, timezone
from typing import Any

from app.config import DATA_DIR

DB_PATH = DATA_DIR / "autopilot.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    tags TEXT NOT NULL,
    hashtags TEXT NOT NULL,
    file_path TEXT,
    video_id TEXT,
    status TEXT NOT NULL,
    error TEXT
);
CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL,
    body TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    status TEXT NOT NULL,
    log TEXT NOT NULL DEFAULT ''
);
"""


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init() -> None:
    with _conn() as conn:
        conn.executescript(SCHEMA)


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def start_run() -> int:
    with _conn() as conn:
        cur = conn.execute(
            "INSERT INTO runs (started_at, status) VALUES (?, 'running')", (now(),)
        )
        return int(cur.lastrowid)


def finish_run(run_id: int, status: str, log: str) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE runs SET finished_at = ?, status = ?, log = ? WHERE id = ?",
            (now(), status, log, run_id),
        )


def add_video(kind: str, meta: dict[str, Any], file_path: str, status: str) -> int:
    with _conn() as conn:
        cur = conn.execute(
            """INSERT INTO videos (created_at, kind, title, description, tags, hashtags,
               file_path, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                now(),
                kind,
                meta["title"],
                meta["description"],
                json.dumps(meta["tags"], ensure_ascii=False),
                json.dumps(meta["hashtags"], ensure_ascii=False),
                file_path,
                status,
            ),
        )
        return int(cur.lastrowid)


def mark_uploaded(row_id: int, video_id: str) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE videos SET video_id = ?, status = 'uploaded' WHERE id = ?", (video_id, row_id)
        )


def mark_failed(row_id: int, error: str) -> None:
    with _conn() as conn:
        conn.execute(
            "UPDATE videos SET status = 'failed', error = ? WHERE id = ?", (error, row_id)
        )


def recent_videos(limit: int = 20) -> list[dict[str, Any]]:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT * FROM videos ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    return [dict(r) for r in rows]


def recent_titles(limit: int = 30) -> list[str]:
    with _conn() as conn:
        rows = conn.execute("SELECT title FROM videos ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [r["title"] for r in rows]


def add_report(body: str) -> None:
    with _conn() as conn:
        conn.execute("INSERT INTO reports (created_at, body) VALUES (?, ?)", (now(), body))


def latest_report() -> dict[str, Any] | None:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM reports ORDER BY id DESC LIMIT 1").fetchone()
    return dict(row) if row else None


def recent_runs(limit: int = 10) -> list[dict[str, Any]]:
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM runs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
    return [dict(r) for r in rows]
