"""
Monthly extra transport cost assumptions for categories not reachable within
the walking isochrone.

SOURCE FOR PER-TRIP COST: Public GoRide tariff data, Zone I (Bandung/Java non-
Jabodetabek), ~mid-2026. Base fare Rp1,850-2,300/km, minimum 4km fare Rp8,000-10,000.
SOURCE FOR TRIPS/MONTH: Author's estimate based on typical Indonesian household
patterns, NOT survey-validated. Revisit if real usage data becomes available.

DESIGN DECISION: "sekolah" (school) and "peribadatan" (worship) are deliberately
EXCLUDED from cost calculation. Reasoning: these trips are rarely done via ojol in
Indonesian daily life -- school runs are typically personal vehicle or walked even
when inconvenient, and worship trips follow different cultural travel patterns than
errand trips. Including them would overstate cost and look like a fabricated number
to anyone familiar with the local context. Show a qualitative note in the UI instead
of a cost figure for these two categories.

DESIGN DECISION: "transit" (bus stops/stations) is NOT converted into an ojol cost
either. If transit is unreachable within the walk radius, the real-world implication
is dependency on a personal vehicle for ALL mobility -- not a single measurable ojol
trip. Show this as a qualitative warning, not a cost line item, until a more
sophisticated model (e.g. estimated monthly fuel cost for a personal motorbike) is
justified.
"""

COST_ASSUMPTIONS = {
    "warung_minimarket": {"trips_per_month": 12, "cost_per_trip": 9000},
    "kuliner":            {"trips_per_month": 8,  "cost_per_trip": 9000},
    "faskes":             {"trips_per_month": 1.5, "cost_per_trip": 12000},
    "taman_ruang_terbuka": {"trips_per_month": 0, "cost_per_trip": 0},
}

# Categories intentionally excluded from cost calculation -- show a qualitative
# note in the UI for these instead of a rupiah figure.
QUALITATIVE_ONLY_CATEGORIES = {
    "sekolah": "Perjalanan sekolah biasanya bukan ojol harian -- umumnya antar pribadi atau tetap jalan kaki meski jauh.",
    "peribadatan": "Perjalanan ibadah rutin biasanya tetap dilakukan jalan kaki meski agak jauh, pola berbeda dari kebutuhan darurat.",
    "transit": "Tanpa transit dalam radius jalan kaki, kemungkinan besar kamu bergantung penuh pada kendaraan pribadi untuk mobilitas sehari-hari -- ini bukan biaya per-trip, tapi ketergantungan struktural.",
}
