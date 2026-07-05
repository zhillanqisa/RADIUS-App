"""Tests for the Total Cost of Location calculator -- pure logic, no network."""
from __future__ import annotations

import json

import pytest

from app.costs import (
    RANGE_MARGIN,
    SINGLE_OPTION_FACTOR,
    estimate_extra_costs,
)
from cost_assumptions import COST_ASSUMPTIONS, QUALITATIVE_ONLY_CATEGORIES


def bd(counts: dict[str, int]) -> dict[str, dict]:
    """Minimal breakdown shaped like radius_core.compute_score output."""
    return {cat: {"count": n, "weight": 10, "score": 0.0} for cat, n in counts.items()}


FULL = {cat: 5 for cat in list(COST_ASSUMPTIONS) + list(QUALITATIVE_ONLY_CATEGORIES)}


def test_no_gaps_means_zero_cost():
    est = estimate_extra_costs(bd(FULL))
    assert est["lines"] == []
    assert est["notes"] == []
    assert est["subtotal"] == 0
    assert est["range"] == {"low": 0, "high": 0}


def test_missing_warung_charges_full_trips():
    counts = dict(FULL, warung_minimarket=0)
    est = estimate_extra_costs(bd(counts))
    a = COST_ASSUMPTIONS["warung_minimarket"]
    expected = a["trips_per_month"] * a["cost_per_trip"]  # 12 * 9000 = 108000
    assert [l["category"] for l in est["lines"]] == ["warung_minimarket"]
    assert est["lines"][0]["reason"] == "missing"
    assert est["lines"][0]["factor"] == 1.0
    assert est["subtotal"] == expected


def test_single_option_charges_half_trips():
    counts = dict(FULL, kuliner=1)
    est = estimate_extra_costs(bd(counts))
    a = COST_ASSUMPTIONS["kuliner"]
    expected = a["trips_per_month"] * a["cost_per_trip"] * SINGLE_OPTION_FACTOR
    assert est["lines"][0]["reason"] == "single"
    assert est["lines"][0]["factor"] == SINGLE_OPTION_FACTOR
    assert est["subtotal"] == pytest.approx(expected, abs=1000)


def test_range_applies_margin_and_rounds_to_thousands():
    counts = dict(FULL, warung_minimarket=0, kuliner=0)
    est = estimate_extra_costs(bd(counts))
    sub = est["subtotal"]
    assert est["range"]["low"] == pytest.approx(sub * (1 - RANGE_MARGIN), abs=1000)
    assert est["range"]["high"] == pytest.approx(sub * (1 + RANGE_MARGIN), abs=1000)
    for value in (est["range"]["low"], est["range"]["high"], sub):
        assert value % 1000 == 0


def test_faskes_fractional_trips():
    counts = dict(FULL, faskes=0)
    est = estimate_extra_costs(bd(counts))
    # 1.5 * 12000 = 18000
    assert est["subtotal"] == 18000


def test_taman_has_zero_cost_assumption_and_is_skipped():
    counts = dict(FULL, taman_ruang_terbuka=0)
    est = estimate_extra_costs(bd(counts))
    assert est["lines"] == []
    assert est["subtotal"] == 0


def test_qualitative_categories_get_notes_not_costs():
    counts = dict(FULL, sekolah=0, transit=0, peribadatan=0)
    est = estimate_extra_costs(bd(counts))
    assert est["lines"] == []  # never a rupiah figure for these
    noted = {n["category"] for n in est["notes"]}
    assert noted == {"sekolah", "transit", "peribadatan"}
    for n in est["notes"]:
        assert n["note"] == QUALITATIVE_ONLY_CATEGORIES[n["category"]]


def test_qualitative_note_only_when_missing_not_single():
    counts = dict(FULL, transit=1)
    est = estimate_extra_costs(bd(counts))
    assert est["notes"] == []


def test_missing_categories_in_breakdown_are_ignored():
    # cache entries from older versions might lack categories entirely
    est = estimate_extra_costs({})
    assert est["subtotal"] == 0
    assert est["lines"] == [] and est["notes"] == []


def test_output_is_json_safe():
    counts = dict(FULL, warung_minimarket=0, kuliner=1, transit=0)
    est = estimate_extra_costs(bd(counts))
    json.dumps(est)  # raises on any non-serializable value
    assert est["disclaimer"]
