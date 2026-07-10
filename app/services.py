"""Orchestration layer: cache -> live analysis -> demo fallback.

This is the only module the API server calls for analysis. It guarantees
a JSON-safe payload comes back no matter what happens underneath:

1. Fresh cache hit  -> cached payload (instant, no network).
2. Live pipeline    -> OSMnx/Overpass analysis, stored in cache.
3. Anything fails   -> synthetic demo data with a visible notice.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from shapely.geometry import mapping

from app import cache
from app.config import settings
from app.costs import estimate_extra_costs
from radius_core import RadiusResult, analyze_location, generate_demo_data

try:
    from app import supabase_store
except Exception:  # pragma: no cover - modul opsional
    supabase_store = None

logger = logging.getLogger("radius.services")

# Notice shown to users when live data could not be fetched. Calm, not
# alarming, and honest that the numbers are simulated.
DEMO_NOTICE = (
    "Server data OpenStreetMap sedang tidak dapat dijangkau. "
    "Menampilkan data simulasi sebagai pratinjau -- skor ini bukan hasil "
    "analisis sebenarnya."
)

# Three precomputed demo locations in Bandung (see scripts/precompute_demo.py).
DEMO_LOCATIONS: list[dict[str, Any]] = [
    {"name": "Kampus (ITB Ganesha)", "lat": -6.8915, "lon": 107.6107},
    {"name": "Pasar Baru", "lat": -6.9160, "lon": 107.6020},
    {"name": "Perumahan Antapani", "lat": -6.9150, "lon": 107.6590},
]


def serialize_result(
    result: RadiusResult, source: str, notice: str | None = None
) -> dict[str, Any]:
    """Convert a RadiusResult (shapely/GeoDataFrame) into a JSON-safe dict."""
    pois: list[dict[str, Any]] = []
    for category, gdf in result.pois_by_category.items():
        if gdf is None or gdf.empty:
            continue
        points = gdf.geometry.representative_point()
        names = gdf["name"] if "name" in gdf.columns else None
        for idx, point in points.items():
            raw_name = None if names is None else names.get(idx)
            name = (
                str(raw_name)
                if raw_name is not None and str(raw_name) != "nan"
                else "Tanpa nama"
            )
            pois.append(
                {
                    "category": category,
                    "name": name,
                    "lat": round(float(point.y), 6),
                    "lon": round(float(point.x), 6),
                }
            )

    return {
        "center": {"lat": result.center[0], "lon": result.center[1]},
        "minutes": result.minutes,
        "score": result.score,
        "breakdown": result.score_breakdown,
        "category_hits": result.category_hits,
        "isochrone": mapping(result.isochrone_polygon),
        "pois": pois,
        "source": source,
        "notice": notice,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _with_cost(payload: dict[str, Any]) -> dict[str, Any]:
    """Attach the cost estimate at serve time.

    Computed on every request (cheap, pure) instead of being stored, so
    cached payloads written before this feature existed -- and future
    assumption revisions -- never require cache invalidation.
    """
    payload["cost_estimate"] = estimate_extra_costs(payload.get("breakdown") or {})
    return payload


def analyze(lat: float, lon: float, minutes: int) -> dict[str, Any]:
    """Analyze a location. Never raises; always returns a payload.

    Order: result cache -> live OSMnx/Overpass -> demo fallback.
    """
    # Urutan cache: Supabase (dibagi antar perangkat) -> file lokal.
    if settings.use_supabase and supabase_store is not None:
        remote = supabase_store.get(lat, lon, minutes)
        if remote is not None:
            logger.info("Supabase hit for (%.4f, %.4f, %d min).", lat, lon, minutes)
            return _with_cost({**remote, "cached": True})

    cached = cache.get(lat, lon, minutes)
    if cached is not None:
        logger.info("File cache hit for (%.4f, %.4f, %d min).", lat, lon, minutes)
        # naikkan ke Supabase supaya perangkat lain ikut instan
        if settings.use_supabase and supabase_store is not None:
            supabase_store.put(lat, lon, minutes, cached)
        return _with_cost({**cached, "cached": True})

    try:
        result = analyze_location(lat, lon, minutes=minutes)
        payload = serialize_result(result, source="live")
        cache.put(lat, lon, minutes, payload)
        if settings.use_supabase and supabase_store is not None:
            supabase_store.put(lat, lon, minutes, payload)
        return _with_cost({**payload, "cached": False})
    except Exception:
        logger.exception(
            "Live analysis failed for (%.4f, %.4f, %d min); using demo data.",
            lat, lon, minutes,
        )
        result = generate_demo_data(lat, lon, minutes=minutes)
        payload = serialize_result(result, source="demo", notice=DEMO_NOTICE)
        # Demo results are intentionally NOT cached to disk: the next
        # attempt should try the live pipeline again.
        return _with_cost({**payload, "cached": False})
