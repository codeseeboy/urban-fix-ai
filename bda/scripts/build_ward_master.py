"""
Build the ward master reference table for the UrbanFix BDA fusion layer.

Emits data/reference/ward_master.csv — the spatial dimension that civic reports
are attributed to and that rainfall is joined against.

DATA PROVENANCE (state this in the viva — do not claim more than this):
  ward_id / ward_name / zone   REAL. The 24 administrative wards of the
                               Brihanmumbai Municipal Corporation (BMC).
  population                   REAL. Census of India 2011, ward-wise.
  centroid_lat / centroid_lon  APPROXIMATE. Hand-placed centroids near each
                               ward's population centre. Good enough for a
                               nearest-ward join; NOT survey-grade boundaries.
  road_km                      ESTIMATE. Plausible surfaced-road length,
                               scaled by ward area. Illustrative only.
  drainage_capacity_mm_hr      ESTIMATE, but grounded: Mumbai's storm-water
                               network was designed for 25 mm/hr, with partial
                               BRIMSTOWAD upgrades toward 50 mm/hr. Island-city
                               wards keep the older figure; upgraded suburban
                               wards are higher.
  station_id                   DERIVED. Nearest rainfall station by haversine.

The estimated columns feed the drainage-deficit term of the Composite
Vulnerability Index. They are weighted at 0.15, deliberately the smallest term,
because they are the least defensible inputs in this table.
"""
from __future__ import annotations

import csv
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import RAINFALL_STATIONS, REFERENCE_DIR, WARD_MASTER_CSV, ensure_dirs  # noqa: E402

# ward_id, ward_name, zone, lat, lon, road_km, drainage_mm_hr, population_2011
WARDS: list[tuple[str, str, str, float, float, float, int, int]] = [
    # ── Island City ───────────────────────────────────────────────────────
    ("A",   "Colaba / Fort / Churchgate",      "Island City",      18.9220, 72.8320,  48.0, 25, 185014),
    ("B",   "Sandhurst Road / Dongri",         "Island City",      18.9500, 72.8370,  22.0, 25, 127290),
    ("C",   "Marine Lines / Kalbadevi",        "Island City",      18.9500, 72.8250,  26.0, 25, 166161),
    ("D",   "Grant Road / Malabar Hill",       "Island City",      18.9600, 72.8100,  55.0, 25, 346866),
    ("E",   "Byculla / Mazgaon",               "Island City",      18.9750, 72.8350,  61.0, 25, 393286),
    ("F/S", "Parel / Sewri",                   "Island City",      19.0000, 72.8450,  54.0, 30, 360972),
    ("F/N", "Matunga / Sion",                  "Island City",      19.0300, 72.8600,  72.0, 30, 529034),
    ("G/S", "Worli / Prabhadevi",              "Island City",      19.0000, 72.8200,  58.0, 30, 377749),
    ("G/N", "Dadar / Mahim",                   "Island City",      19.0200, 72.8400,  79.0, 30, 682902),
    # ── Western Suburbs ───────────────────────────────────────────────────
    ("H/E", "Bandra East / Santacruz East",    "Western Suburbs",  19.0700, 72.8500,  74.0, 35, 580835),
    ("H/W", "Bandra West / Khar",              "Western Suburbs",  19.0600, 72.8300,  61.0, 35, 307581),
    ("K/E", "Andheri East / Jogeshwari East",  "Western Suburbs",  19.1150, 72.8600, 118.0, 40, 823885),
    ("K/W", "Andheri West / Versova",          "Western Suburbs",  19.1300, 72.8300, 104.0, 40, 748688),
    ("P/S", "Goregaon",                        "Western Suburbs",  19.1650, 72.8500,  71.0, 40, 463507),
    ("P/N", "Malad",                           "Western Suburbs",  19.1850, 72.8480, 132.0, 45, 941366),
    ("R/S", "Kandivali",                       "Western Suburbs",  19.2050, 72.8500,  97.0, 45, 691229),
    ("R/C", "Borivali",                        "Western Suburbs",  19.2300, 72.8550,  83.0, 50, 562162),
    ("R/N", "Dahisar",                         "Western Suburbs",  19.2500, 72.8600,  64.0, 50, 431368),
    # ── Eastern Suburbs ───────────────────────────────────────────────────
    ("L",   "Kurla",                           "Eastern Suburbs",  19.0700, 72.8800, 126.0, 30, 902225),
    ("M/E", "Govandi / Mankhurd",              "Eastern Suburbs",  19.0550, 72.9200, 108.0, 25, 807720),
    ("M/W", "Chembur",                         "Eastern Suburbs",  19.0500, 72.9000,  69.0, 35, 411893),
    ("N",   "Ghatkopar",                       "Eastern Suburbs",  19.0900, 72.9100,  88.0, 35, 622853),
    ("S",   "Bhandup / Vikhroli",              "Eastern Suburbs",  19.1400, 72.9300, 101.0, 40, 743783),
    ("T",   "Mulund",                          "Eastern Suburbs",  19.1750, 72.9500,  62.0, 45, 341463),
]

FIELDNAMES = [
    "ward_id",
    "ward_name",
    "zone",
    "centroid_lat",
    "centroid_lon",
    "station_id",
    "station_distance_km",
    "road_km",
    "drainage_capacity_mm_hr",
    "population_2011",
]


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in kilometres."""
    r = 6371.0088
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def nearest_station(lat: float, lon: float) -> tuple[str, float]:
    """Return (station_id, distance_km) of the closest rainfall station."""
    best_id, best_km = "", float("inf")
    for station in RAINFALL_STATIONS:
        km = haversine_km(lat, lon, station["lat"], station["lon"])
        if km < best_km:
            best_id, best_km = station["station_id"], km
    return best_id, round(best_km, 2)


def main() -> None:
    ensure_dirs()
    REFERENCE_DIR.mkdir(parents=True, exist_ok=True)

    rows = []
    for ward_id, name, zone, lat, lon, road_km, drainage, pop in WARDS:
        station_id, distance_km = nearest_station(lat, lon)
        rows.append(
            {
                "ward_id": ward_id,
                "ward_name": name,
                "zone": zone,
                "centroid_lat": lat,
                "centroid_lon": lon,
                "station_id": station_id,
                "station_distance_km": distance_km,
                "road_km": road_km,
                "drainage_capacity_mm_hr": drainage,
                "population_2011": pop,
            }
        )

    with WARD_MASTER_CSV.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} wards -> {WARD_MASTER_CSV}")

    # Every station must serve at least one ward, or the rainfall fetch is
    # pulling a series that nothing joins against.
    used = {r["station_id"] for r in rows}
    for station in RAINFALL_STATIONS:
        sid = station["station_id"]
        served = sum(1 for r in rows if r["station_id"] == sid)
        flag = "" if sid in used else "   <-- UNUSED, drop it or move a centroid"
        print(f"  {sid:<12} serves {served:>2} ward(s){flag}")

    worst = max(rows, key=lambda r: r["station_distance_km"])
    print(f"  farthest ward from its station: {worst['ward_id']} "
          f"({worst['station_distance_km']} km)")


if __name__ == "__main__":
    main()
