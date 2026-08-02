import json
import re
import subprocess
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

from app.config import OUTPUT_DIR
from app.core import media, tts

SIZES = {"short": (1080, 1920), "long": (1920, 1080)}
FPS = 30

FONT_CANDIDATES = [
    "C:/Windows/Fonts/NirmalaB.ttf",
    "C:/Windows/Fonts/arialbd.ttf",
    "/usr/share/fonts/truetype/lohit-devanagari/Lohit-Devanagari.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


class RenderError(RuntimeError):
    pass


# The caption fonts carry no emoji glyphs, so emoji would render as tofu boxes.
EMOJI_RE = re.compile(
    "[\U0001f000-\U0001faff\U00002600-\U000027bf\U0000fe0f\U00002190-\U000021ff]+"
)


def _clean(text: str) -> str:
    return re.sub(r"\s{2,}", " ", EMOJI_RE.sub("", text)).strip()


def _font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default(size)


def _run(args: list[str]) -> None:
    proc = subprocess.run(args, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RenderError(f"{args[0]} failed: {proc.stderr[-600:]}")


def _duration(path: Path) -> float:
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(path)],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        raise RenderError(f"ffprobe failed: {proc.stderr[-400:]}")
    return float(json.loads(proc.stdout)["format"]["duration"])


def _draw_caption(image_path: Path, caption: str, size: tuple[int, int]) -> None:
    width, height = size
    with Image.open(image_path) as img:
        frame = img.convert("RGB")
    draw = ImageDraw.Draw(frame, "RGBA")
    draw.rectangle((0, 0, width, height), fill=(0, 0, 0, 90))
    caption = _clean(caption)
    font = _font(int(width * 0.075))
    lines = textwrap.wrap(caption, width=18) or [caption]
    line_height = int(font.size * 1.25)
    total = line_height * len(lines)
    y = (height - total) // 2
    for line in lines:
        text_width = draw.textlength(line, font=font)
        x = (width - text_width) / 2
        draw.text((x, y), line, font=font, fill="white",
                  stroke_width=max(2, int(font.size * 0.06)), stroke_fill="black")
        y += line_height
    frame.save(image_path, quality=92)


def _scene_clip(index: int, scene: dict, kind: str, workdir: Path, language: str) -> Path:
    size = SIZES[kind]
    audio_path = workdir / f"scene_{index}.mp3"
    tts.synthesize(scene["narration"], audio_path, language)
    duration = max(_duration(audio_path) + 0.35, 1.5)

    image_path = workdir / f"scene_{index}.jpg"
    media.fetch_background(scene.get("image_query") or scene["caption"], size, image_path)
    _draw_caption(image_path, scene.get("caption", ""), size)

    clip_path = workdir / f"scene_{index}.mp4"
    frames = int(duration * FPS)
    zoom = f"zoompan=z='min(zoom+0.0006,1.10)':d={frames}:s={size[0]}x{size[1]}:fps={FPS}"
    _run([
        "ffmpeg", "-y", "-loop", "1", "-i", str(image_path), "-i", str(audio_path),
        "-filter_complex", f"[0:v]{zoom},format=yuv420p[v]",
        "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast",
        "-c:a", "aac", "-b:a", "128k", "-t", f"{duration:.2f}", "-r", str(FPS), str(clip_path),
    ])
    return clip_path


def render(script: dict, kind: str, language: str, slug: str) -> Path:
    if kind not in SIZES:
        raise ValueError(f"unknown video kind: {kind}")
    workdir = OUTPUT_DIR / slug
    workdir.mkdir(parents=True, exist_ok=True)

    clips = [
        _scene_clip(i, scene, kind, workdir, language)
        for i, scene in enumerate(script["scenes"])
    ]
    listing = workdir / "clips.txt"
    listing.write_text("\n".join(f"file '{c.as_posix()}'" for c in clips), encoding="utf-8")

    final_path = OUTPUT_DIR / f"{slug}.mp4"
    _run([
        "ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listing),
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac",
        "-movflags", "+faststart", str(final_path),
    ])
    return final_path


def make_thumbnail(title: str, kind: str, slug: str) -> Path:
    size = SIZES["long"] if kind == "long" else SIZES["short"]
    path = OUTPUT_DIR / f"{slug}_thumb.jpg"
    media.fetch_background(title, size, path)
    _draw_caption(path, title, size)
    return path
