"""Supabase Postgres result cache (opsional, best-effort).

Mirror antarmuka ``app/cache.py`` (get/put) tapi menyimpan payload analisis
di tabel ``analysis_cache`` lewat PostgREST Supabase, memakai service key.
Dipanggil dari ``app/services.py`` HANYA kalau ``settings.use_supabase`` True.

Desain: best-effort seperti cache file -- kegagalan apa pun (jaringan, RLS,
skema) di-log dan mengembalikan None/pass, tidak pernah meng-crash analisis.
Tabel & kebijakan dibuat oleh ``supabase/migrations/0001_init.sql``.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from app.config import settings

logger = logging.getLogger("radius.supabase")

_TABLE = "analysis_cache"


def _headers() -> dict[str, str]:
    key = settings.supabase_service_key
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _rest_url() -> str:
    return f"{settings.supabase_url}/rest/v1/{_TABLE}"


def _cache_key(lat: float, lon: float, minutes: int) -> str:
    p = settings.coord_precision
    return f"{round(lat, p)}_{round(lon, p)}_{minutes}"


def get(lat: float, lon: float, minutes: int) -> dict[str, Any] | None:
    """Ambil payload dari Supabase, atau None saat miss/expired/error."""
    key = _cache_key(lat, lon, minutes)
    try:
        resp = requests.get(
            _rest_url(),
            headers=_headers(),
            params={
                "cache_key": f"eq.{key}",
                "select": "payload,pinned,stored_at",
                "limit": "1",
            },
            timeout=settings.supabase_timeout_s,
        )
        resp.raise_for_status()
        rows = resp.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("Supabase get gagal (%s); fallback.", exc)
        return None

    if not rows:
        return None
    row = rows[0]
    if not row.get("pinned", False):
        try:
            stored_at = datetime.fromisoformat(
                row["stored_at"].replace("Z", "+00:00")
            )
        except (KeyError, ValueError):
            return None
        age = datetime.now(timezone.utc) - stored_at
        if age > timedelta(hours=settings.cache_ttl_hours):
            return None
    return row.get("payload")


def put(
    lat: float, lon: float, minutes: int, payload: dict[str, Any], *,
    pinned: bool = False,
) -> None:
    """Upsert payload ke Supabase (merge-duplicates pada cache_key)."""
    key = _cache_key(lat, lon, minutes)
    p = settings.coord_precision
    body = {
        "cache_key": key,
        "lat": round(lat, p),
        "lon": round(lon, p),
        "minutes": minutes,
        "payload": payload,
        "pinned": pinned,
        "stored_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        resp = requests.post(
            _rest_url(),
            headers={**_headers(), "Prefer": "resolution=merge-duplicates"},
            json=body,
            timeout=settings.supabase_timeout_s,
        )
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("Supabase put gagal (%s); diabaikan.", exc)
