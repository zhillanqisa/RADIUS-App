"""
RADIUS - Core Logic
====================
Menghitung "15-Minute City Score" untuk satu titik lokasi:
seberapa lengkap fasilitas dasar yang bisa dijangkau jalan kaki
dalam radius waktu tertentu (default 15 menit).

Alur:
1. Ambil graph jaringan jalan pejalan kaki (OSMnx) di sekitar titik.
2. Bangun isochrone (area terjangkau) berdasarkan jarak tempuh jalan kaki,
   BUKAN garis lurus (euclidean) -- ini yang bikin hasilnya realistis,
   karena gang buntu / sungai / rel otomatis dihitung sebagai penghalang.
3. Ambil POI (fasilitas) dari OpenStreetMap di sekitar titik.
4. Cek POI mana saja yang jatuh di dalam polygon isochrone.
5. Hitung skor komposit per kategori.

Catatan implementasi (perubahan dari versi awal):
- Waktu tempuh edge dihitung langsung dari panjang edge / kecepatan jalan
  kaki. Versi awal memakai ``ox.add_edge_speeds`` yang mengimputasi
  kecepatan KENDARAAN dari tag maxspeed/highway -- itu melebih-lebihkan
  jangkauan jalan kaki secara drastis.
- Isochrone dibangun dari buffer geometri edge yang terjangkau (network
  buffer), bukan convex hull titik node. Convex hull "menyeberangi"
  sungai/rel dan menutup area yang seharusnya tidak terjangkau.
- Semua panggilan Overpass dibungkus retry + exponential backoff.
- Pengambilan POI digabung jadi SATU query Overpass (bukan satu query per
  kategori) lalu diklasifikasikan lokal -- lebih cepat dan lebih ramah
  ke server OSM.
"""
from __future__ import annotations

import hashlib
import logging
import math
import random
import time
from dataclasses import dataclass, field
from typing import Any, Callable, TypeVar

import geopandas as gpd
import networkx as nx
import osmnx as ox
import pandas as pd
import requests
from shapely.geometry import LineString, Point
from shapely.geometry.base import BaseGeometry
from shapely.ops import unary_union

from app.config import settings

logger = logging.getLogger("radius.core")

try:  # OSMnx raises this when a query legitimately returns no elements.
    from osmnx._errors import InsufficientResponseError
except ImportError:  # pragma: no cover - API-location fallback
    class InsufficientResponseError(Exception):
        ...

try:  # Raised by OSMnx on HTTP-level failures (rate limits, 5xx).
    from osmnx._errors import ResponseStatusCodeError
except ImportError:  # pragma: no cover - API-location fallback
    class ResponseStatusCodeError(Exception):
        ...

# Only genuinely transient failures are worth retrying; programming
# errors must propagate immediately instead of burning the backoff budget.
_RETRYABLE_ERRORS = (requests.RequestException, ResponseStatusCodeError, OSError)

# OSMnx's own HTTP cache: repeated Overpass queries are served from disk.
ox.settings.use_cache = True
ox.settings.cache_folder = str(settings.osmnx_cache_dir)
ox.settings.requests_timeout = settings.overpass_timeout_s
ox.settings.log_console = False

# ---------------------------------------------------------------------------
# KONFIGURASI KATEGORI & BOBOT SKOR
# ---------------------------------------------------------------------------
# Justifikasi bobot (ringkas; versi panjang + sitasi ada di README):
# - warung_minimarket (20): kebutuhan harian paling sering diakses.
# - faskes (20): akses layanan primer/darurat; dimensi "healthcare" di
#   literatur 15-minute city (Moreno et al., 2021).
# - transit (20): penentu apakah warga bisa hidup tanpa kendaraan pribadi.
# - sekolah (15): perjalanan rutin harian keluarga; jarak aman anak.
# - kuliner (10): penting tapi substitusinya tinggi dengan warung.
# - taman_ruang_terbuka (10): kesehatan publik, pemakaian tidak tiap hari.
# - peribadatan (5): frekuensi akses tinggi di Indonesia tapi kepadatan
#   tempat ibadah sudah sangat tinggi sehingga jarang jadi pembeda antar
#   lokasi -- bobot kecil supaya tidak menggelembungkan semua skor.

CATEGORY_TAGS: dict[str, dict[str, list[str]]] = {
    "warung_minimarket": {"shop": ["convenience", "supermarket", "grocery"]},
    "kuliner": {"amenity": ["restaurant", "cafe", "fast_food", "food_court"]},
    "sekolah": {"amenity": ["school", "kindergarten"]},
    "faskes": {"amenity": ["clinic", "hospital", "pharmacy", "doctors"]},
    "transit": {"highway": ["bus_stop"], "railway": ["station", "halt"]},
    "taman_ruang_terbuka": {"leisure": ["park", "playground"]},
    "peribadatan": {"amenity": ["place_of_worship"]},
}

CATEGORY_WEIGHTS: dict[str, int] = {
    "warung_minimarket": 20,
    "kuliner": 10,
    "sekolah": 15,
    "faskes": 20,
    "transit": 20,
    "taman_ruang_terbuka": 10,
    "peribadatan": 5,
}
# total = 100

WALK_SPEED_KMH: float = settings.walk_speed_kmh


@dataclass
class RadiusResult:
    """Hasil analisis satu titik lokasi."""

    center: tuple[float, float]  # (lat, lon)
    minutes: int
    isochrone_polygon: BaseGeometry  # shapely geometry (lon/lat)
    pois_by_category: dict[str, gpd.GeoDataFrame] = field(default_factory=dict)
    category_hits: dict[str, int] = field(default_factory=dict)
    score: float = 0.0
    score_breakdown: dict[str, dict[str, Any]] = field(default_factory=dict)


T = TypeVar("T")


def _with_retries(fn: Callable[..., T], *args: Any, **kwargs: Any) -> T:
    """Call ``fn`` with retry + exponential backoff on network failures.

    ``InsufficientResponseError`` (a valid empty result) is re-raised
    immediately -- retrying it would only hammer Overpass for nothing.
    """
    last_exc: Exception | None = None
    for attempt in range(1, settings.overpass_retries + 1):
        try:
            return fn(*args, **kwargs)
        except InsufficientResponseError:
            raise
        except _RETRYABLE_ERRORS as exc:  # network/HTTP/rate-limit errors
            last_exc = exc
            wait = settings.overpass_backoff_s * (2 ** (attempt - 1))
            logger.warning(
                "%s failed (attempt %d/%d): %s -- retrying in %.1fs",
                getattr(fn, "__name__", str(fn)),
                attempt,
                settings.overpass_retries,
                exc,
                wait,
            )
            if attempt < settings.overpass_retries:
                time.sleep(wait)
    assert last_exc is not None
    raise last_exc


def _walk_speed_m_per_s(speed_kmh: float) -> float:
    return speed_kmh * 1000.0 / 3600.0


def build_isochrone(
    lat: float,
    lon: float,
    minutes: int = 15,
    network_type: str = "walk",
) -> tuple[nx.MultiDiGraph, BaseGeometry]:
    """Bangun graph jalan pejalan kaki + polygon isochrone di sekitar titik.

    Menggunakan ego_graph berbasis BOBOT WAKTU TEMPUH (bukan jarak lurus),
    jadi jalan buntu/rel/sungai otomatis membatasi jangkauan secara
    realistis.

    Polygon dibentuk dari union buffer geometri edge yang terjangkau
    ("network buffer"). Ini mengikuti bentuk jaringan jalan sungguhan;
    convex hull hanya dipakai sebagai fallback kalau graph terlalu kecil.

    Returns:
        (graph, isochrone_polygon) -- polygon dalam lon/lat (WGS84).
    """
    # radius pencarian graph dilebihkan supaya isochrone tidak terpotong
    dist_m = int(minutes * (WALK_SPEED_KMH * 1000 / 60) * settings.graph_dist_factor)

    G = _with_retries(
        ox.graph_from_point, (lat, lon), dist=dist_m, network_type=network_type
    )

    # Waktu tempuh per edge = panjang / kecepatan jalan kaki (uniform).
    # JANGAN pakai ox.add_edge_speeds di network "walk": itu mengimputasi
    # kecepatan mobil dari tag jalan dan menggelembungkan jangkauan.
    speed_ms = _walk_speed_m_per_s(WALK_SPEED_KMH)
    for _, _, data in G.edges(data=True):
        data["travel_time"] = float(data.get("length", 0.0)) / speed_ms

    center_node = ox.distance.nearest_nodes(G, lon, lat)

    subgraph = nx.ego_graph(
        G, center_node, radius=minutes * 60, distance="travel_time"
    )

    isochrone_poly = _isochrone_polygon_from_subgraph(subgraph, lat, lon, minutes)
    return G, isochrone_poly


def _isochrone_polygon_from_subgraph(
    subgraph: nx.MultiDiGraph, lat: float, lon: float, minutes: int
) -> BaseGeometry:
    """Union buffer edge-edge terjangkau -> polygon isochrone (WGS84)."""
    node_xy = {n: (d["x"], d["y"]) for n, d in subgraph.nodes(data=True)}

    edge_geoms: list[LineString] = []
    for u, v, data in subgraph.edges(data=True):
        geom = data.get("geometry")
        if geom is None and u in node_xy and v in node_xy:
            geom = LineString([node_xy[u], node_xy[v]])
        if geom is not None:
            edge_geoms.append(geom)

    if not edge_geoms:
        # fallback: buffer lingkaran kasar kalau graph terlalu kecil
        logger.warning("Subgraph isochrone kosong; fallback ke buffer lingkaran.")
        buffer_deg = (minutes * WALK_SPEED_KMH * 1000 / 60) / 111_000
        return Point(lon, lat).buffer(buffer_deg)

    # Buffer harus dihitung dalam CRS meter (UTM), bukan derajat.
    series = gpd.GeoSeries(edge_geoms, crs="EPSG:4326")
    utm = series.estimate_utm_crs()
    buffered = series.to_crs(utm).buffer(settings.isochrone_buffer_m)
    merged = unary_union(list(buffered))
    merged = merged.simplify(5.0)  # meter; haluskan tepi tanpa ubah bentuk

    poly = gpd.GeoSeries([merged], crs=utm).to_crs("EPSG:4326").iloc[0]

    # Ambil bagian yang memuat titik pusat kalau hasilnya MultiPolygon
    # (pecahan kecil bisa muncul dari edge yang terputus).
    if poly.geom_type == "MultiPolygon":
        center = Point(lon, lat)
        parts = sorted(poly.geoms, key=lambda p: p.area, reverse=True)
        for part in parts:
            if part.contains(center):
                return part
        return parts[0]
    return poly


def _merged_overpass_tags() -> dict[str, list[str]]:
    """Gabungkan semua tag kategori jadi satu query Overpass."""
    merged: dict[str, set[str]] = {}
    for tags in CATEGORY_TAGS.values():
        for key, values in tags.items():
            merged.setdefault(key, set()).update(values)
    return {key: sorted(values) for key, values in merged.items()}


def fetch_pois(
    lat: float,
    lon: float,
    isochrone_poly: BaseGeometry,
    radius_m: int | None = None,
    minutes: int | None = None,
) -> dict[str, gpd.GeoDataFrame]:
    """Ambil POI dari OpenStreetMap lalu saring yang di dalam isochrone.

    Satu query Overpass untuk semua kategori sekaligus, lalu
    diklasifikasikan per kategori secara lokal. Radius pengambilan
    diturunkan dari durasi jalan kaki (bukan angka tetap 1500 m).
    """
    if radius_m is None:
        mins = minutes if minutes is not None else settings.default_minutes
        # jarak tempuh maksimum + margin kecil untuk buffer isochrone
        radius_m = max(int(mins * (WALK_SPEED_KMH * 1000 / 60) * 1.1), 800)

    empty = gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")
    try:
        gdf = _with_retries(
            ox.features_from_point,
            (lat, lon),
            tags=_merged_overpass_tags(),
            dist=radius_m,
        )
    except InsufficientResponseError:
        logger.info("Tidak ada POI sama sekali di radius %d m.", radius_m)
        return {cat: empty.copy() for cat in CATEGORY_TAGS}

    if gdf.empty:
        return {cat: empty.copy() for cat in CATEGORY_TAGS}

    gdf = gdf.to_crs(epsg=4326)
    # representative_point selalu berada di dalam geometri dan tidak
    # memicu peringatan centroid-in-geographic-CRS. covered_by (bukan
    # contains) supaya titik tepat di tepi isochrone tetap terhitung,
    # dan tervektorisasi (bukan loop Python per baris).
    points = gdf.geometry.representative_point()
    gdf = gdf[points.covered_by(isochrone_poly)]

    results: dict[str, gpd.GeoDataFrame] = {}
    for category, tags in CATEGORY_TAGS.items():
        mask = pd.Series(False, index=gdf.index)
        for key, values in tags.items():
            if key in gdf.columns:
                mask |= gdf[key].isin(values)
        results[category] = gdf[mask].copy() if mask.any() else empty.copy()
    return results


def compute_score(
    pois_by_category: dict[str, gpd.GeoDataFrame],
) -> tuple[float, dict[str, dict[str, Any]]]:
    """Skor komposit 0-100.

    Tiap kategori memberi poin PENUH kalau ada >= 2 POI (ada variasi
    pilihan), 75% bobot kalau cuma 1, dan 0 kalau tidak ada. Skor akhir
    dinormalisasi ke 0-100 berdasarkan total bobot, jadi mengubah bobot
    kategori tidak merusak skala.
    """
    breakdown: dict[str, dict[str, Any]] = {}
    total_score = 0.0
    total_weight = sum(CATEGORY_WEIGHTS.values())

    for category, weight in CATEGORY_WEIGHTS.items():
        gdf = pois_by_category.get(category)
        count = 0 if gdf is None else len(gdf)

        if count == 0:
            cat_score = 0.0
        elif count == 1:
            cat_score = weight * 0.75  # ada tapi cuma 1 pilihan -> belum ideal
        else:
            cat_score = float(weight)  # ada variasi pilihan -> skor penuh

        breakdown[category] = {
            "count": count,
            "weight": weight,
            "score": round(cat_score, 1),
        }
        total_score += cat_score

    normalized = total_score * 100.0 / total_weight if total_weight else 0.0
    return round(normalized, 1), breakdown


def analyze_location(lat: float, lon: float, minutes: int = 15) -> RadiusResult:
    """Fungsi utama: analisis penuh satu titik (perlu koneksi internet)."""
    _, isochrone_poly = build_isochrone(lat, lon, minutes=minutes)
    pois = fetch_pois(lat, lon, isochrone_poly, minutes=minutes)
    score, breakdown = compute_score(pois)

    category_hits = {
        cat: (0 if gdf is None else len(gdf)) for cat, gdf in pois.items()
    }

    return RadiusResult(
        center=(lat, lon),
        minutes=minutes,
        isochrone_polygon=isochrone_poly,
        pois_by_category=pois,
        category_hits=category_hits,
        score=score,
        score_breakdown=breakdown,
    )


# ---------------------------------------------------------------------------
# FALLBACK DEMO (tanpa internet) -- dipakai otomatis kalau Overpass gagal
# ---------------------------------------------------------------------------

_DEMO_NAMES: dict[str, list[str]] = {
    "warung_minimarket": [
        "Warung Bu Eni", "Indomaret", "Alfamart", "Toko Berkah",
        "Warung Pak Dadang",
    ],
    "kuliner": [
        "Warung Nasi Ibu Imas", "Mie Kocok Mang Asep", "Kedai Kopi Selasar",
        "Ayam Geprek Juara", "Baso Akang", "Nasi Goreng Pak Ujang",
    ],
    "sekolah": ["SDN 03 Dago", "TK Tunas Harapan", "SMPN 12"],
    "faskes": ["Klinik Sehat Keluarga", "Apotek Kimia Farma", "Puskesmas"],
    "transit": ["Halte TMB", "Halte Simpang", "Stasiun Kereta"],
    "taman_ruang_terbuka": ["Taman Cempaka", "Lapangan RW 05"],
    "peribadatan": ["Masjid Al-Ikhlas", "Masjid Jami", "Gereja Pniel"],
}


def generate_demo_data(lat: float, lon: float, minutes: int = 15) -> RadiusResult:
    """Data sintetis untuk fallback offline.

    Deterministik per lokasi (seed diturunkan dari koordinat), jadi
    lokasi berbeda menghasilkan profil berbeda tapi hasil yang sama
    setiap kali dipanggil.
    """
    # Seed dari sha256, bukan hash() builtin: stabil lintas versi Python
    # dan lintas proses. Bukan untuk keperluan kriptografis.
    key = f"{round(lat, 4)}_{round(lon, 4)}_{minutes}".encode()
    seed = int.from_bytes(hashlib.sha256(key).digest()[:4], "big")
    rng = random.Random(seed)

    buffer_deg = (minutes * WALK_SPEED_KMH * 1000 / 60) / 111_000
    isochrone_poly = Point(lon, lat).buffer(buffer_deg)

    max_counts = {
        "warung_minimarket": 5, "kuliner": 6, "sekolah": 3, "faskes": 3,
        "transit": 3, "taman_ruang_terbuka": 2, "peribadatan": 3,
    }

    pois: dict[str, gpd.GeoDataFrame] = {}
    for cat, max_n in max_counts.items():
        n = rng.randint(0, max_n)
        rows = []
        names = _DEMO_NAMES[cat]
        for i in range(n):
            # sebaran polar di dalam lingkaran isochrone
            angle = rng.uniform(0, 2 * math.pi)
            r = buffer_deg * rng.uniform(0.15, 0.85)
            rows.append(
                {
                    "geometry": Point(lon + r * math.cos(angle),
                                      lat + r * math.sin(angle)),
                    "name": names[i % len(names)],
                }
            )
        pois[cat] = (
            gpd.GeoDataFrame(rows, crs="EPSG:4326")
            if rows
            else gpd.GeoDataFrame(geometry=[], crs="EPSG:4326")
        )

    score, breakdown = compute_score(pois)
    category_hits = {cat: len(gdf) for cat, gdf in pois.items()}

    return RadiusResult(
        center=(lat, lon),
        minutes=minutes,
        isochrone_polygon=isochrone_poly,
        pois_by_category=pois,
        category_hits=category_hits,
        score=score,
        score_breakdown=breakdown,
    )
