"""Total Cost of Location: pure calculation logic.

Turns a per-category score breakdown (from radius_core.compute_score) into
an estimated monthly extra transport cost. No network, no I/O -- fully
testable. Assumption data lives in cost_assumptions.py at the project root.

MODEL:
- count == 0 (kategori tidak terjangkau)  -> 100% of assumed monthly trips
  happen via ojol/GoFood.
- count == 1 (hanya 1 pilihan)            -> 50% of assumed trips
  (SINGLE_OPTION_FACTOR). Rationale: satu pilihan tetap bisa dijalani kaki,
  tapi tanpa variasi sebagian kebutuhan (tutup, stok kosong, kebutuhan
  berbeda) tetap memaksa perjalanan keluar. Membebankan tarif penuh akan
  melebih-lebihkan biaya dan mudah dipatahkan orang lokal.
- Hasil disajikan sebagai RENTANG +/-20% (RANGE_MARGIN), dibulatkan ke
  Rp1.000, karena asumsi frekuensi belum tervalidasi survei -- presisi
  palsu lebih menyesatkan daripada rentang jujur.
"""
from __future__ import annotations

from typing import Any

from cost_assumptions import COST_ASSUMPTIONS, QUALITATIVE_ONLY_CATEGORIES

SINGLE_OPTION_FACTOR = 0.5
RANGE_MARGIN = 0.20
ROUND_TO = 1000

DISCLAIMER = (
    "Estimasi kasar dari asumsi tarif ojol Zona I (Bandung) dan frekuensi "
    "perjalanan yang belum tervalidasi survei -- baca sebagai indikasi, "
    "bukan angka pasti."
)


def _round_rp(value: float) -> int:
    """Round to the nearest ROUND_TO rupiah (avoids fake precision)."""
    return int(round(value / ROUND_TO) * ROUND_TO)


def estimate_extra_costs(breakdown: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """Estimate monthly extra transport cost from a score breakdown.

    Args:
        breakdown: {category: {"count": int, "weight": int, "score": float}}
                   as produced by radius_core.compute_score().

    Returns JSON-safe dict:
        {
          "lines":  [{category, reason, trips_per_month, cost_per_trip,
                      factor, monthly}],
          "notes":  [{category, note}],          # qualitative-only gaps
          "subtotal": int,                        # raw sum of lines
          "range": {"low": int, "high": int},     # +/-20%, rounded Rp1.000
          "disclaimer": str,
        }
    """
    lines: list[dict[str, Any]] = []
    notes: list[dict[str, str]] = []

    for category, assumption in COST_ASSUMPTIONS.items():
        item = breakdown.get(category)
        if item is None:
            continue
        count = int(item.get("count", 0))
        if count >= 2:
            continue  # ada variasi pilihan -> tidak ada biaya ekstra

        factor = 1.0 if count == 0 else SINGLE_OPTION_FACTOR
        trips = float(assumption["trips_per_month"])
        cost = float(assumption["cost_per_trip"])
        monthly = _round_rp(trips * cost * factor)
        if monthly <= 0:
            continue  # kategori tanpa asumsi biaya (mis. taman) dilewati

        lines.append(
            {
                "category": category,
                "reason": "missing" if count == 0 else "single",
                "trips_per_month": trips,
                "cost_per_trip": int(cost),
                "factor": factor,
                "monthly": monthly,
            }
        )

    for category, note in QUALITATIVE_ONLY_CATEGORIES.items():
        item = breakdown.get(category)
        if item is not None and int(item.get("count", 0)) == 0:
            notes.append({"category": category, "note": note})

    subtotal = sum(line["monthly"] for line in lines)
    return {
        "lines": lines,
        "notes": notes,
        "subtotal": subtotal,
        "range": {
            "low": _round_rp(subtotal * (1 - RANGE_MARGIN)),
            "high": _round_rp(subtotal * (1 + RANGE_MARGIN)),
        },
        "disclaimer": DISCLAIMER,
    }
