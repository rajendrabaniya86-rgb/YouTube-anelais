import hashlib
import random
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFilter

from app.config import settings

PEXELS_URL = "https://api.pexels.com/v1/search"

PALETTES = [
    ((14, 22, 48), (92, 36, 120)),
    ((10, 40, 40), (16, 120, 110)),
    ((48, 14, 22), (150, 60, 40)),
    ((20, 20, 24), (70, 70, 90)),
]


def _gradient(size: tuple[int, int], seed: str) -> Image.Image:
    rng = random.Random(hashlib.md5(seed.encode()).hexdigest())
    top, bottom = rng.choice(PALETTES)
    width, height = size
    base = Image.new("RGB", (1, height))
    draw = ImageDraw.Draw(base)
    for y in range(height):
        ratio = y / max(height - 1, 1)
        draw.point(
            (0, y),
            fill=tuple(int(top[i] + (bottom[i] - top[i]) * ratio) for i in range(3)),
        )
    image = base.resize((width, height))
    overlay = Image.new("RGB", (width, height))
    odraw = ImageDraw.Draw(overlay)
    for _ in range(28):
        x, y = rng.randrange(width), rng.randrange(height)
        r = rng.randrange(60, 220)
        odraw.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255))
    overlay = overlay.filter(ImageFilter.GaussianBlur(90))
    return Image.blend(image, overlay, 0.08)


def _fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize((int(image.width * scale) + 1, int(image.height * scale) + 1))
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def _pexels_photo(query: str, orientation: str) -> bytes | None:
    if not settings.pexels_api_key:
        return None
    params = {"query": query, "per_page": 5, "orientation": orientation}
    try:
        with httpx.Client(timeout=30) as client:
            resp = client.get(PEXELS_URL, params=params,
                              headers={"Authorization": settings.pexels_api_key})
            resp.raise_for_status()
            photos = resp.json().get("photos", [])
            if not photos:
                return None
            url = random.choice(photos)["src"]["large2x"]
            return client.get(url, timeout=60).content
    except (httpx.HTTPError, KeyError, ValueError):
        return None


def fetch_background(query: str, size: tuple[int, int], out_path: Path) -> Path:
    """Pexels photo when a free key is configured, otherwise a generated gradient."""
    orientation = "portrait" if size[1] > size[0] else "landscape"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    raw = _pexels_photo(query, orientation)
    if raw:
        tmp = out_path.with_suffix(".src")
        tmp.write_bytes(raw)
        try:
            with Image.open(tmp) as img:
                _fit(img.convert("RGB"), size).save(out_path, quality=90)
            return out_path
        except OSError:
            pass
        finally:
            tmp.unlink(missing_ok=True)
    _gradient(size, query).save(out_path, quality=90)
    return out_path
