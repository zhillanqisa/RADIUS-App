"""Tests for the JSON result cache: roundtrip, TTL expiry, corruption."""
from __future__ import annotations

import dataclasses
import json
from datetime import datetime, timedelta, timezone

import pytest

from app import cache
from app.config import settings


@pytest.fixture
def tmp_cache(tmp_path, monkeypatch):
    """Point the cache module at an isolated temp directory."""
    patched = dataclasses.replace(settings, cache_dir=tmp_path)
    monkeypatch.setattr(cache, "settings", patched)
    return tmp_path


PAYLOAD = {"score": 77.5, "minutes": 15, "source": "live"}


def test_roundtrip(tmp_cache):
    cache.put(-6.9147, 107.6098, 15, PAYLOAD)
    assert cache.get(-6.9147, 107.6098, 15) == PAYLOAD


def test_miss_returns_none(tmp_cache):
    assert cache.get(-6.0, 107.0, 15) is None


def test_key_rounding_treats_nearby_points_as_same(tmp_cache):
    cache.put(-6.91471, 107.60981, 15, PAYLOAD)
    # ~1 m away -> same rounded key
    assert cache.get(-6.914712, 107.609808, 15) == PAYLOAD


def test_different_minutes_are_different_entries(tmp_cache):
    cache.put(-6.9147, 107.6098, 15, PAYLOAD)
    assert cache.get(-6.9147, 107.6098, 10) is None


def test_expired_entry_is_ignored(tmp_cache):
    cache.put(-6.9147, 107.6098, 15, PAYLOAD)
    path = next(tmp_cache.glob("*.json"))
    entry = json.loads(path.read_text(encoding="utf-8"))
    old = datetime.now(timezone.utc) - timedelta(hours=settings.cache_ttl_hours + 1)
    entry["stored_at"] = old.isoformat()
    path.write_text(json.dumps(entry), encoding="utf-8")
    assert cache.get(-6.9147, 107.6098, 15) is None


def test_pinned_entry_never_expires(tmp_cache):
    cache.put(-6.9147, 107.6098, 15, PAYLOAD, pinned=True)
    path = next(tmp_cache.glob("*.json"))
    entry = json.loads(path.read_text(encoding="utf-8"))
    entry["stored_at"] = datetime(2020, 1, 1, tzinfo=timezone.utc).isoformat()
    path.write_text(json.dumps(entry), encoding="utf-8")
    assert cache.get(-6.9147, 107.6098, 15) == PAYLOAD


def test_corrupt_entry_returns_none(tmp_cache):
    cache.put(-6.9147, 107.6098, 15, PAYLOAD)
    path = next(tmp_cache.glob("*.json"))
    path.write_text("{not valid json", encoding="utf-8")
    assert cache.get(-6.9147, 107.6098, 15) is None
