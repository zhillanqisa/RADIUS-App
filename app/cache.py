"""Disk-backed result cache, keyed by rounded (lat, lon, minutes).

Each entry is one JSON file under ``settings.cache_dir``:

    {
      "stored_at": "2026-07-03T10:00:00+00:00",   # ISO-8601 UTC
      "pinned": false,                             # pinned entries never expire
      "payload": { ...serialized analysis result... }
    }

Pinned entries are written by ``scripts/precompute_demo.py`` so the live
demo works with zero network access.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

from app.config import settings

logger = logging.getLogger("radius.cache")


def _cache_key(lat: float, lon: float, minutes: int) -> str:
    p = settings.coord_precision
    return f"{round(lat, p)}_{round(lon, p)}_{minutes}"


def _cache_path(lat: float, lon: float, minutes: int) -> Path:
    return settings.cache_dir / f"{_cache_key(lat, lon, minutes)}.json"


def get(lat: float, lon: float, minutes: int) -> dict[str, Any] | None:
    """Return the cached payload, or None on miss/expiry/corruption."""
    path = _cache_path(lat, lon, minutes)
    if not path.exists():
        return None
    try:
        entry = json.loads(path.read_text(encoding="utf-8"))
        stored_at = datetime.fromisoformat(entry["stored_at"])
        payload = entry["payload"]
    except (json.JSONDecodeError, KeyError, ValueError, OSError) as exc:
        logger.warning("Cache entry %s unreadable (%s); ignoring.", path.name, exc)
        return None

    if not entry.get("pinned", False):
        age = datetime.now(timezone.utc) - stored_at
        if age > timedelta(hours=settings.cache_ttl_hours):
            logger.info("Cache entry %s expired (age %s).", path.name, age)
            return None
    return payload


def put(
    lat: float, lon: float, minutes: int, payload: dict[str, Any], *,
    pinned: bool = False,
) -> None:
    """Store a payload. Failures are logged, never raised (cache is best-effort)."""
    path = _cache_path(lat, lon, minutes)
    entry = {
        "stored_at": datetime.now(timezone.utc).isoformat(),
        "pinned": pinned,
        "payload": payload,
    }
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(entry, ensure_ascii=False), encoding="utf-8")
    except OSError as exc:
        logger.error("Failed to write cache entry %s: %s", path.name, exc)
