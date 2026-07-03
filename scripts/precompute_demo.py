"""Precompute pinned cache entries for the live-demo locations.

Runs the full live pipeline for each demo location and every allowed
duration, then stores results as PINNED cache entries (never expire).
During a presentation these load instantly with zero network access.

Usage (from project root, venv active):

    python scripts/precompute_demo.py
"""
from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import cache
from app.config import settings
from app.services import DEMO_LOCATIONS, serialize_result
from radius_core import analyze_location

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("radius.precompute")


def main() -> int:
    failures: list[str] = []
    total = len(DEMO_LOCATIONS) * len(settings.allowed_minutes)
    done = 0

    for loc in DEMO_LOCATIONS:
        for minutes in settings.allowed_minutes:
            done += 1
            label = f"{loc['name']} @ {minutes} menit"
            logger.info("[%d/%d] %s ...", done, total, label)
            try:
                result = analyze_location(loc["lat"], loc["lon"], minutes=minutes)
                payload = serialize_result(result, source="live")
                cache.put(loc["lat"], loc["lon"], minutes, payload, pinned=True)
                logger.info(
                    "    OK  score=%.1f  pois=%d", payload["score"], len(payload["pois"])
                )
            except Exception as exc:
                logger.error("    GAGAL: %s", exc)
                failures.append(label)
            time.sleep(2)  # jeda sopan antar batch query Overpass

    if failures:
        logger.error("Selesai dengan %d kegagalan: %s", len(failures), failures)
        return 1
    logger.info("Semua %d entri demo tersimpan (pinned) di %s", total, settings.cache_dir)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
