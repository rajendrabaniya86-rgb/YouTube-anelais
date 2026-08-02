from datetime import date, timedelta

from app.core import llm, youtube

REPORT_PROMPT = """You are a YouTube growth strategist. Analyse this channel data and produce a
blunt weakness report in {language}.

Last 28 days totals: {totals}
Daily trend: {daily}
Top videos (title, views, avg view %, subs gained): {videos}
Traffic sources: {traffic}

Give:
1. Kya theek chal raha hai (2 bullets)
2. Kami / kamzori - concrete weaknesses with the numbers that prove them (4 bullets)
3. Kal ke liye 5 actionable fixes (titles, thumbnails, hook, length, upload time, keywords)
4. Next 7 video ideas with SEO titles

Return markdown."""


def _query(client, channel: str, start: str, end: str, **kwargs) -> dict:
    return client.reports().query(
        ids=f"channel=={channel}", startDate=start, endDate=end, **kwargs
    ).execute()


def fetch_stats(days: int = 28) -> dict:
    client = youtube.analytics_client()
    channel = youtube.channel_id()
    end = date.today() - timedelta(days=1)
    start = end - timedelta(days=days)
    s, e = start.isoformat(), end.isoformat()
    metrics = "views,estimatedMinutesWatched,averageViewPercentage,subscribersGained,likes,comments"
    return {
        "totals": _query(client, channel, s, e, metrics=metrics),
        "daily": _query(client, channel, s, e, metrics="views,subscribersGained",
                        dimensions="day"),
        "videos": _query(client, channel, s, e, metrics=metrics, dimensions="video",
                         sort="-views", maxResults=10),
        "traffic": _query(client, channel, s, e, metrics="views",
                          dimensions="insightTrafficSourceType", sort="-views"),
    }


def _rows(payload: dict) -> list[list]:
    return payload.get("rows", [])


def weakness_report(language: str = "hi") -> str:
    stats = fetch_stats()
    video_rows = _rows(stats["videos"])
    titles = {}
    if video_rows:
        ids = [row[0] for row in video_rows]
        items = youtube.data_client().videos().list(
            part="snippet", id=",".join(ids)
        ).execute().get("items", [])
        titles = {item["id"]: item["snippet"]["title"] for item in items}
    videos = [
        {"title": titles.get(row[0], row[0]), "views": row[1],
         "avg_view_pct": row[3], "subs": row[4]}
        for row in video_rows
    ]
    return llm.generate(
        REPORT_PROMPT.format(
            language=language,
            totals=_rows(stats["totals"]),
            daily=_rows(stats["daily"]),
            videos=videos,
            traffic=_rows(stats["traffic"]),
        ),
        temperature=0.4,
    )
