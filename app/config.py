"""Central configuration for RADIUS.

All tunable values live here and can be overridden via environment
variables or a `.env` file at the project root. Nothing elsewhere in the
codebase should hardcode these numbers.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except ValueError:
        logging.getLogger("radius.config").warning(
            "Env var %s is not a valid float; using default %s", name, default
        )
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except ValueError:
        logging.getLogger("radius.config").warning(
            "Env var %s is not a valid int; using default %s", name, default
        )
        return default


@dataclass(frozen=True)
class Settings:
    """Immutable runtime settings, resolved once at import time."""

    # Default map center: Dago area, Bandung.
    default_lat: float = _env_float("RADIUS_DEFAULT_LAT", -6.9147)
    default_lon: float = _env_float("RADIUS_DEFAULT_LON", 107.6098)
    default_minutes: int = _env_int("RADIUS_DEFAULT_MINUTES", 15)
    allowed_minutes: tuple[int, ...] = (5, 10, 15, 20)

    # Average adult walking speed. 4.5 km/h is the common planning
    # assumption in 15-minute-city literature (4-5 km/h range).
    walk_speed_kmh: float = _env_float("RADIUS_WALK_SPEED_KMH", 4.5)

    # How much larger than the theoretical max walk distance the street
    # graph download radius should be, so the isochrone is never clipped.
    graph_dist_factor: float = _env_float("RADIUS_GRAPH_DIST_FACTOR", 1.3)

    # Half-width (meters) of the buffer drawn around reachable street
    # edges when building the isochrone polygon.
    isochrone_buffer_m: float = _env_float("RADIUS_ISOCHRONE_BUFFER_M", 40.0)

    # Overpass / OSMnx network behaviour.
    overpass_timeout_s: int = _env_int("RADIUS_OVERPASS_TIMEOUT_S", 40)
    overpass_retries: int = _env_int("RADIUS_OVERPASS_RETRIES", 3)
    overpass_backoff_s: float = _env_float("RADIUS_OVERPASS_BACKOFF_S", 2.0)

    # Result cache (JSON files, keyed by rounded lat/lon/minutes).
    cache_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get("RADIUS_CACHE_DIR", str(PROJECT_ROOT / "data" / "cache"))
        )
    )
    cache_ttl_hours: int = _env_int("RADIUS_CACHE_TTL_HOURS", 24 * 7)
    # Coordinates are rounded to this many decimals for cache keys
    # (4 decimals ~ 11 m, close enough that results are identical).
    coord_precision: int = _env_int("RADIUS_COORD_PRECISION", 4)

    # OSMnx's own HTTP-response cache (avoids re-hitting Overpass even
    # when our result cache misses, e.g. after a TTL expiry).
    osmnx_cache_dir: Path = field(
        default_factory=lambda: Path(
            os.environ.get(
                "RADIUS_OSMNX_CACHE_DIR", str(PROJECT_ROOT / "data" / "osmnx_cache")
            )
        )
    )

    # Geocoding (Nominatim usage policy requires a descriptive UA).
    nominatim_url: str = os.environ.get(
        "RADIUS_NOMINATIM_URL", "https://nominatim.openstreetmap.org/search"
    )
    nominatim_timeout_s: int = _env_int("RADIUS_NOMINATIM_TIMEOUT_S", 10)
    nominatim_country_codes: str = os.environ.get("RADIUS_NOMINATIM_COUNTRIES", "id")
    user_agent: str = os.environ.get(
        "RADIUS_USER_AGENT", "RADIUS-15MinuteCity/1.0 (urban planning research)"
    )

    # Server.
    host: str = os.environ.get("RADIUS_HOST", "127.0.0.1")
    port: int = _env_int("RADIUS_PORT", 8000)


settings = Settings()
