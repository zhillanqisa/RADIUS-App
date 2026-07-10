"""Unggah cache hasil lokal (data/cache/*.json) ke Supabase.

Setelah membuat project Supabase + menjalankan migrasi, jalankan ini sekali
supaya lokasi demo yang sudah dipra-hitung (pinned) langsung tersedia di
Postgres -- deploy publik jadi punya data instan tanpa Overpass live.

Butuh env: SUPABASE_URL, SUPABASE_SERVICE_KEY (lihat .env / .env.example).

Usage (dari root, venv aktif):
    python scripts/seed_supabase.py
"""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import supabase_store
from app.config import settings

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("radius.seed")


def main() -> int:
    if not settings.use_supabase:
        logger.error("SUPABASE_URL / SUPABASE_SERVICE_KEY belum diset. Isi .env dulu.")
        return 1

    files = sorted(settings.cache_dir.glob("*.json"))
    if not files:
        logger.error("Tidak ada file cache di %s", settings.cache_dir)
        return 1

    ok = 0
    for path in files:
        try:
            entry = json.loads(path.read_text(encoding="utf-8"))
            payload = entry["payload"]
            pinned = bool(entry.get("pinned", False))
            center = payload["center"]
            minutes = payload["minutes"]
        except (json.JSONDecodeError, KeyError, OSError) as exc:
            logger.warning("Lewati %s (%s)", path.name, exc)
            continue

        supabase_store.put(
            center["lat"], center["lon"], minutes, payload, pinned=pinned
        )
        ok += 1
        logger.info("Unggah %s (pinned=%s)", path.name, pinned)

    logger.info("Selesai: %d/%d entri diunggah ke Supabase.", ok, len(files))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
