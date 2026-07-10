"""Tests for the Supabase result cache -- HTTP fully mocked, no network."""
from __future__ import annotations

import dataclasses
from datetime import datetime, timedelta, timezone

import pytest

from app import supabase_store
from app.config import settings


@pytest.fixture
def sb(monkeypatch):
    """Aktifkan Supabase dengan URL/kunci palsu."""
    patched = dataclasses.replace(
        settings, supabase_url="https://x.supabase.co", supabase_service_key="svc"
    )
    monkeypatch.setattr(supabase_store, "settings", patched)
    return patched


class FakeResp:
    def __init__(self, data, status=200):
        self._data = data
        self.status_code = status

    def json(self):
        return self._data

    def raise_for_status(self):
        if self.status_code >= 400:
            import requests
            raise requests.HTTPError(f"status {self.status_code}")


def test_get_hit_returns_payload(sb, monkeypatch):
    now = datetime.now(timezone.utc).isoformat()
    row = [{"payload": {"score": 88}, "pinned": False, "stored_at": now}]
    monkeypatch.setattr(supabase_store.requests, "get", lambda *a, **k: FakeResp(row))
    assert supabase_store.get(-6.9, 107.6, 15) == {"score": 88}


def test_get_miss_returns_none(sb, monkeypatch):
    monkeypatch.setattr(supabase_store.requests, "get", lambda *a, **k: FakeResp([]))
    assert supabase_store.get(-6.9, 107.6, 15) is None


def test_get_expired_non_pinned_is_none(sb, monkeypatch):
    old = (datetime.now(timezone.utc) - timedelta(hours=settings.cache_ttl_hours + 1)).isoformat()
    row = [{"payload": {"score": 1}, "pinned": False, "stored_at": old}]
    monkeypatch.setattr(supabase_store.requests, "get", lambda *a, **k: FakeResp(row))
    assert supabase_store.get(-6.9, 107.6, 15) is None


def test_get_pinned_never_expires(sb, monkeypatch):
    old = datetime(2020, 1, 1, tzinfo=timezone.utc).isoformat()
    row = [{"payload": {"score": 7}, "pinned": True, "stored_at": old}]
    monkeypatch.setattr(supabase_store.requests, "get", lambda *a, **k: FakeResp(row))
    assert supabase_store.get(-6.9, 107.6, 15) == {"score": 7}


def test_get_network_error_returns_none(sb, monkeypatch):
    import requests

    def boom(*a, **k):
        raise requests.ConnectionError("down")

    monkeypatch.setattr(supabase_store.requests, "get", boom)
    assert supabase_store.get(-6.9, 107.6, 15) is None  # best-effort, tak raise


def test_put_upserts_with_merge_header(sb, monkeypatch):
    seen = {}

    def fake_post(url, headers=None, json=None, timeout=None):
        seen["url"] = url
        seen["prefer"] = headers.get("Prefer")
        seen["body"] = json
        return FakeResp({}, status=201)

    monkeypatch.setattr(supabase_store.requests, "post", fake_post)
    supabase_store.put(-6.9147, 107.6098, 15, {"score": 99}, pinned=True)
    assert seen["prefer"] == "resolution=merge-duplicates"
    assert seen["body"]["cache_key"] == "-6.9147_107.6098_15"
    assert seen["body"]["pinned"] is True
    assert seen["body"]["payload"] == {"score": 99}


def test_put_network_error_swallowed(sb, monkeypatch):
    import requests

    def boom(*a, **k):
        raise requests.ConnectionError("down")

    monkeypatch.setattr(supabase_store.requests, "post", boom)
    supabase_store.put(-6.9, 107.6, 15, {"score": 1})  # tidak raise
