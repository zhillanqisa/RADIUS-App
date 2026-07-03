"""Address search via Nominatim (OpenStreetMap geocoder).

Kept server-side so the browser never talks to Nominatim directly:
one place to set the required User-Agent, timeouts, and country bias.
"""
from __future__ import annotations

import logging
from typing import Any

import requests

from app.config import settings

logger = logging.getLogger("radius.geocode")


class GeocodeError(Exception):
    """Raised when the geocoding service is unreachable or misbehaves."""


def search(query: str, limit: int = 6) -> list[dict[str, Any]]:
    """Search an address/place name. Returns [{name, lat, lon}, ...].

    Raises GeocodeError on network failure so the API layer can map it
    to a friendly HTTP error (the UI shows an inline message).
    """
    params = {
        "q": query,
        "format": "jsonv2",
        "limit": limit,
        "countrycodes": settings.nominatim_country_codes,
        "accept-language": "id",
    }
    headers = {"User-Agent": settings.user_agent}
    try:
        resp = requests.get(
            settings.nominatim_url,
            params=params,
            headers=headers,
            timeout=settings.nominatim_timeout_s,
        )
        resp.raise_for_status()
        raw = resp.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("Nominatim search failed for %r: %s", query, exc)
        raise GeocodeError("Layanan pencarian alamat sedang tidak tersedia.") from exc

    results: list[dict[str, Any]] = []
    for item in raw:
        try:
            results.append(
                {
                    "name": str(item["display_name"]),
                    "lat": float(item["lat"]),
                    "lon": float(item["lon"]),
                }
            )
        except (KeyError, TypeError, ValueError):
            continue  # skip malformed rows rather than failing the search
    return results
