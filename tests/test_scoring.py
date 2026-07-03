"""Unit tests for compute_score() -- pure logic, no network."""
from __future__ import annotations

import pytest

from radius_core import CATEGORY_WEIGHTS, compute_score


def make_pois(counts: dict[str, int]) -> dict[str, list]:
    """compute_score only calls len() on category values; lists suffice."""
    return {cat: [object()] * n for cat, n in counts.items()}


def test_no_pois_scores_zero():
    score, breakdown = compute_score({})
    assert score == 0.0
    assert all(item["score"] == 0.0 for item in breakdown.values())
    assert all(item["count"] == 0 for item in breakdown.values())


def test_all_categories_with_variety_scores_100():
    score, _ = compute_score(make_pois({cat: 2 for cat in CATEGORY_WEIGHTS}))
    assert score == 100.0


def test_single_poi_gives_partial_credit():
    counts = {cat: 0 for cat in CATEGORY_WEIGHTS}
    counts["faskes"] = 1
    score, breakdown = compute_score(make_pois(counts))
    weight = CATEGORY_WEIGHTS["faskes"]
    assert breakdown["faskes"]["score"] == pytest.approx(weight * 0.75)
    # normalized against total weight (100)
    assert score == pytest.approx(weight * 0.75, abs=0.1)


def test_more_than_two_pois_caps_at_full_weight():
    counts = {cat: 0 for cat in CATEGORY_WEIGHTS}
    counts["kuliner"] = 50
    _, breakdown = compute_score(make_pois(counts))
    assert breakdown["kuliner"]["score"] == CATEGORY_WEIGHTS["kuliner"]


def test_unknown_categories_are_ignored():
    score_a, _ = compute_score(make_pois({"laundromat_futuristik": 5}))
    score_b, _ = compute_score({})
    assert score_a == score_b == 0.0


def test_none_gdf_treated_as_empty():
    score, breakdown = compute_score({"transit": None})
    assert breakdown["transit"]["count"] == 0
    assert score == 0.0


def test_breakdown_totals_match_score():
    counts = {cat: (i % 3) for i, cat in enumerate(CATEGORY_WEIGHTS)}
    score, breakdown = compute_score(make_pois(counts))
    raw = sum(item["score"] for item in breakdown.values())
    total_weight = sum(CATEGORY_WEIGHTS.values())
    assert score == pytest.approx(raw * 100.0 / total_weight, abs=0.1)
