"""RADIUS API server.

FastAPI app that exposes the analysis pipeline as JSON endpoints and
serves the static frontend from ``web/``. Run with:

    uvicorn app.server:app --host 127.0.0.1 --port 8000
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles

from app import services
from app.config import PROJECT_ROOT, settings
from app.geocode import GeocodeError, search

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(levelname)s: %(message)s",
)
logger = logging.getLogger("radius.server")

app = FastAPI(
    title="RADIUS",
    description="15-Minute City walkability scorer (Indonesian urban contexts).",
    version="1.0.0",
)


@app.get("/api/health")
def health() -> dict[str, str]:
    """Liveness probe."""
    return {"status": "ok"}


@app.get("/api/config")
def client_config() -> dict[str, object]:
    """Defaults the frontend needs at startup."""
    return {
        "default_center": {"lat": settings.default_lat, "lon": settings.default_lon},
        "default_minutes": settings.default_minutes,
        "allowed_minutes": list(settings.allowed_minutes),
        "demo_locations": services.DEMO_LOCATIONS,
    }


@app.get("/api/analyze")
def analyze(
    lat: float = Query(..., ge=-90.0, le=90.0),
    lon: float = Query(..., ge=-180.0, le=180.0),
    minutes: int | None = Query(default=None),
) -> dict[str, object]:
    """Full walkability analysis for one point.

    Never returns a 5xx for pipeline failures: the service layer falls
    back to synthetic demo data with an explanatory notice instead.
    """
    if minutes is None:
        minutes = settings.default_minutes
    if minutes not in settings.allowed_minutes:
        raise HTTPException(
            status_code=422,
            detail=f"minutes harus salah satu dari {list(settings.allowed_minutes)}",
        )
    return services.analyze(lat, lon, minutes)


@app.get("/api/geocode")
def geocode(q: str = Query(..., min_length=2, max_length=200)) -> dict[str, object]:
    """Address search (Nominatim, biased to Indonesia)."""
    try:
        return {"results": search(q)}
    except GeocodeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/api/{rest:path}", include_in_schema=False)
def api_not_found(rest: str) -> None:
    """Unmatched /api/* paths get a JSON 404 instead of the static mount."""
    raise HTTPException(status_code=404, detail=f"Endpoint /api/{rest} tidak ada.")


# Mounted last so /api/* routes take precedence.
app.mount("/", StaticFiles(directory=PROJECT_ROOT / "web", html=True), name="web")
