"""API endpoint tests (FastAPI TestClient; services layer mocked)."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app import server
from app.geocode import GeocodeError

client = TestClient(server.app)

DUMMY_PAYLOAD = {"score": 42.0, "source": "live", "cached": False}


def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_config_shape():
    resp = client.get("/api/config")
    body = resp.json()
    assert resp.status_code == 200
    assert {"default_center", "default_minutes", "allowed_minutes", "demo_locations"} <= set(body)
    assert len(body["demo_locations"]) == 3


def test_analyze_delegates_to_services(monkeypatch):
    captured = {}

    def fake_analyze(lat, lon, minutes):
        captured.update(lat=lat, lon=lon, minutes=minutes)
        return DUMMY_PAYLOAD

    monkeypatch.setattr(server.services, "analyze", fake_analyze)
    resp = client.get("/api/analyze", params={"lat": -6.9147, "lon": 107.6098, "minutes": 15})
    assert resp.status_code == 200
    assert resp.json()["score"] == 42.0
    assert captured == {"lat": -6.9147, "lon": 107.6098, "minutes": 15}


def test_analyze_rejects_invalid_minutes():
    resp = client.get("/api/analyze", params={"lat": -6.9, "lon": 107.6, "minutes": 7})
    assert resp.status_code == 422


def test_analyze_rejects_out_of_range_coordinates():
    resp = client.get("/api/analyze", params={"lat": 99.0, "lon": 107.6, "minutes": 15})
    assert resp.status_code == 422


def test_geocode_success(monkeypatch):
    monkeypatch.setattr(
        server, "search", lambda q: [{"name": "Dago, Bandung", "lat": -6.88, "lon": 107.61}]
    )
    resp = client.get("/api/geocode", params={"q": "Dago"})
    assert resp.status_code == 200
    assert resp.json()["results"][0]["name"] == "Dago, Bandung"


def test_geocode_unavailable_maps_to_503(monkeypatch):
    def down(q):
        raise GeocodeError("Layanan pencarian alamat sedang tidak tersedia.")

    monkeypatch.setattr(server, "search", down)
    resp = client.get("/api/geocode", params={"q": "Dago"})
    assert resp.status_code == 503
    assert "pencarian" in resp.json()["detail"].lower()


def test_frontend_is_served():
    resp = client.get("/")
    assert resp.status_code == 200
    assert "RADIUS" in resp.text
