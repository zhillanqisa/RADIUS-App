"""Tests for the service layer: serialization, fallback, cache path.

All OSMnx/Overpass calls are mocked -- nothing here touches the network.
"""
from __future__ import annotations

import json

import pytest

from app import services
from radius_core import generate_demo_data


def test_serialize_result_is_json_safe():
    result = generate_demo_data(-6.9147, 107.6098, 15)
    payload = services.serialize_result(result, source="demo", notice="uji")
    text = json.dumps(payload)  # raises if anything non-serializable leaks
    assert "uji" in text
    assert payload["source"] == "demo"
    assert payload["isochrone"]["type"] in ("Polygon", "MultiPolygon")
    for poi in payload["pois"]:
        assert set(poi) == {"category", "name", "lat", "lon"}
        assert isinstance(poi["lat"], float) and isinstance(poi["lon"], float)


def test_demo_data_is_deterministic_per_location():
    a = generate_demo_data(-6.9147, 107.6098, 15)
    b = generate_demo_data(-6.9147, 107.6098, 15)
    c = generate_demo_data(-6.8915, 107.6107, 15)
    assert a.score == b.score
    assert a.category_hits == b.category_hits
    # different location -> (almost certainly) different profile
    assert (a.category_hits != c.category_hits) or (a.score != c.score)


def test_analyze_returns_cached_payload_without_live_call(monkeypatch):
    sentinel = {"score": 55.0, "source": "live"}
    monkeypatch.setattr(services.cache, "get", lambda *a: dict(sentinel))

    def boom(*a, **kw):  # live pipeline must not run on cache hit
        raise AssertionError("analyze_location called despite cache hit")

    monkeypatch.setattr(services, "analyze_location", boom)
    out = services.analyze(-6.9, 107.6, 15)
    assert out["cached"] is True
    assert out["score"] == 55.0


def test_analyze_falls_back_to_demo_when_live_fails(monkeypatch):
    monkeypatch.setattr(services.cache, "get", lambda *a: None)
    stored = {}
    monkeypatch.setattr(
        services.cache, "put", lambda *a, **kw: stored.setdefault("called", True)
    )

    def network_down(*a, **kw):
        raise ConnectionError("Overpass timeout (simulated)")

    monkeypatch.setattr(services, "analyze_location", network_down)
    out = services.analyze(-6.9147, 107.6098, 15)
    assert out["source"] == "demo"
    assert out["notice"]  # user-visible explanation present
    assert "called" not in stored  # demo results are never written to cache
    assert 0.0 <= out["score"] <= 100.0


def test_analyze_caches_live_results(monkeypatch):
    monkeypatch.setattr(services.cache, "get", lambda *a: None)
    stored = {}

    def fake_put(lat, lon, minutes, payload, **kw):
        stored["payload"] = payload

    monkeypatch.setattr(services.cache, "put", fake_put)
    demo = generate_demo_data(-6.9147, 107.6098, 15)
    monkeypatch.setattr(services, "analyze_location", lambda *a, **kw: demo)

    out = services.analyze(-6.9147, 107.6098, 15)
    assert out["source"] == "live"
    assert out["cached"] is False
    assert stored["payload"]["score"] == out["score"]
