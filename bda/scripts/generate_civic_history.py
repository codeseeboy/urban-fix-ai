"""
Generate a simulated civic-report history for the UrbanFix BDA fusion layer.

WHY THIS EXISTS
  The real UrbanFix pilot has too few reports to demonstrate distributed
  analytics. The team report and deck both sanction a clearly-labelled
  simulated history replayed through the same pipeline. Every row this script
  writes carries is_simulated = true.

THE ONE RULE THAT MATTERS
  Complaint volume is driven by the REAL rainfall series (data/reference/
  rainfall_daily.csv), with a lag and Poisson noise. The Spark fusion job
  measures the resulting surge ratio independently and has no access to the
  parameters used here. The correlation is therefore RECOVERED, not asserted.

  The true generator parameters are written to _generator_params.json and the
  true duplicate clusters to _ground_truth_clusters.csv. Both are prefixed with
  an underscore and are read ONLY by verification code, never by the pipeline.
  If a Spark job ever imports them, the experiment is invalid.

SCHEMA
  Rows are emitted at issue_reports grain (one row per citizen observation),
  mirroring backend/supabase_migration.sql. Deduplication into parent incidents
  is the SILVER layer's job to discover, so no group id is emitted here.

Usage:
  python scripts/generate_civic_history.py
  python scripts/generate_civic_history.py --target-reports 20000 --seed 42
"""
from __future__ import annotations

import argparse
import csv
import json
import math
import random
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import (  # noqa: E402
    BRONZE_EVENTS,
    CATEGORIES,
    RAINFALL_CSV,
    REFERENCE_DIR,
    SEVERITY_VALUES,
    STATUS_VALUES,
    WARD_MASTER_CSV,
    ensure_dirs,
)

OUT_JSONL = BRONZE_EVENTS / "civic_history.jsonl"
PARAMS_SIDECAR = REFERENCE_DIR / "_generator_params.json"
TRUTH_SIDECAR = REFERENCE_DIR / "_ground_truth_clusters.csv"

# ── Rain coupling ─────────────────────────────────────────────────────────
# Weighted lag window. 48h dominates, matching the mechanism the deck claims:
# water saturates the sub-base, then the surface fails a day or two later.
LAG_WEIGHTS = {1: 0.25, 2: 0.60, 3: 0.15}
SURGE_ALPHA = 2.0          # strength of the rain -> complaint coupling
RAIN_REFERENCE_MM = 45.0   # normaliser; matches config.HEAVY_RAIN_MM

# ── Dirt injection rates (so the cleaning stage has real work) ────────────
P_DUPLICATE_CLUSTER = 0.35   # incidents that attract a cluster of reports
DUP_CLUSTER_RANGE = (2, 12)  # extra reports per cluster (a viral one hits 40)
P_VIRAL = 0.02               # a few incidents go viral
VIRAL_RANGE = (25, 40)
P_GPS_DRIFT = 0.03           # accuracy worse than the 100m threshold
P_OUT_OF_BBOX = 0.01         # coordinates in the sea / outside Mumbai
P_FUTURE_TIMESTAMP = 0.005   # clock-skewed devices
P_NULL_CATEGORY = 0.02       # app crashed before classification

# department_tag deliberately drawn from all three real vocabularies, because
# that is what the production table actually contains today.
DEPT_VOCAB_AI = {
    "roads": "PWD", "lighting": "Electrical", "trash": "Sanitation",
    "water": "Water Supply", "parks": "Horticulture", "other": "General",
}
DEPT_VOCAB_ADMIN = {
    "roads": "Roads", "lighting": "Electricity", "trash": "Sanitation",
    "water": "Water", "parks": "Parks", "other": "General",
}
DEPT_VOCAB_SEED = {
    "roads": "Drainage Dept", "lighting": "Electrical", "trash": "Sanitation",
    "water": "Drainage Dept", "parks": "Horticulture", "other": "General",
}

# Category mix on dry days vs in the days after heavy rain.
CATEGORY_WEIGHTS_DRY = {
    "roads": 0.30, "trash": 0.26, "water": 0.12,
    "lighting": 0.16, "parks": 0.10, "other": 0.06,
}
CATEGORY_WEIGHTS_WET = {
    "roads": 0.52, "trash": 0.12, "water": 0.24,
    "lighting": 0.06, "parks": 0.03, "other": 0.03,
}

STREET_NAMES = [
    "Link Road", "SV Road", "LBS Marg", "Western Express Highway",
    "Eastern Express Highway", "Hill Road", "Turner Road", "Station Road",
    "Market Lane", "MG Road", "Church Road", "Gandhi Nagar Lane",
]


def load_wards() -> list[dict]:
    with WARD_MASTER_CSV.open(encoding="utf-8") as fh:
        wards = list(csv.DictReader(fh))
    if not wards:
        sys.exit(f"{WARD_MASTER_CSV} is empty. Run scripts/build_ward_master.py first.")
    for ward in wards:
        ward["centroid_lat"] = float(ward["centroid_lat"])
        ward["centroid_lon"] = float(ward["centroid_lon"])
        ward["road_km"] = float(ward["road_km"])
        ward["drainage_capacity_mm_hr"] = float(ward["drainage_capacity_mm_hr"])
        ward["population_2011"] = int(ward["population_2011"])
    return wards


def load_rainfall() -> dict[tuple[str, str], float]:
    if not RAINFALL_CSV.exists():
        sys.exit(
            f"{RAINFALL_CSV} not found.\n"
            "Run scripts/fetch_rainfall.py first — the generator is driven by "
            "the real rainfall series."
        )
    rain: dict[tuple[str, str], float] = {}
    with RAINFALL_CSV.open(encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            rain[(row["station_id"], row["date"])] = float(row["precipitation_mm"])
    return rain


def weighted_choice(rng: random.Random, weights: dict[str, float]) -> str:
    keys = list(weights)
    return rng.choices(keys, weights=[weights[k] for k in keys], k=1)[0]


def lagged_rain(rain: dict, station: str, day: datetime) -> float:
    """Rain in the 1-3 days before `day`, weighted so 48h dominates."""
    total = 0.0
    for lag, weight in LAG_WEIGHTS.items():
        key = (station, (day - timedelta(days=lag)).strftime("%Y-%m-%d"))
        total += weight * rain.get(key, 0.0)
    return total


def drainage_factor(capacity_mm_hr: float) -> float:
    """1.0 for a well-drained ward, up to 2.0 for the worst. Higher = fails sooner."""
    return 1.0 + max(0.0, (50.0 - capacity_mm_hr)) / 25.0


def jitter_point(rng: random.Random, lat: float, lon: float, sigma_km: float) -> tuple[float, float]:
    """A random point near a ward centroid, roughly gaussian."""
    dlat = rng.gauss(0, sigma_km / 111.0)
    dlon = rng.gauss(0, sigma_km / (111.0 * math.cos(math.radians(lat))))
    return lat + dlat, lon + dlon


def make_report(
    rng: random.Random,
    ward: dict,
    when: datetime,
    lat: float,
    lon: float,
    category: str,
    wet: bool,
) -> dict:
    """One citizen observation, at issue_reports grain."""
    if wet and category in ("roads", "water"):
        severity = rng.choices(SEVERITY_VALUES, weights=[0.10, 0.28, 0.40, 0.22])[0]
    else:
        severity = rng.choices(SEVERITY_VALUES, weights=[0.34, 0.38, 0.21, 0.07])[0]

    # Older reports have had time to progress; recent ones are still open.
    age_days = (datetime(2025, 1, 1) - when).days
    if age_days > 180:
        status = rng.choices(STATUS_VALUES, weights=[0.06, 0.09, 0.12, 0.68, 0.05])[0]
    elif age_days > 60:
        status = rng.choices(STATUS_VALUES, weights=[0.14, 0.18, 0.25, 0.38, 0.05])[0]
    else:
        status = rng.choices(STATUS_VALUES, weights=[0.42, 0.24, 0.20, 0.10, 0.04])[0]

    severity_base = {"Low": 12, "Medium": 34, "High": 62, "Critical": 86}[severity]
    priority = max(0, min(100, severity_base + rng.randint(-8, 12)))

    vocab = rng.choices(
        [DEPT_VOCAB_AI, DEPT_VOCAB_ADMIN, DEPT_VOCAB_SEED], weights=[0.62, 0.30, 0.08]
    )[0]
    lookup = category if category in vocab else "other"

    accuracy = round(abs(rng.gauss(8, 4)) + 1.5, 1)
    if rng.random() < P_GPS_DRIFT:
        accuracy = round(rng.uniform(105, 850), 1)

    created = when
    if rng.random() < P_FUTURE_TIMESTAMP:
        created = when + timedelta(days=rng.randint(30, 400))

    emitted_category: str | None = category
    if rng.random() < P_NULL_CATEGORY:
        emitted_category = None

    tags = [category] if emitted_category else []
    if severity in ("High", "Critical") or priority >= 80:
        tags.append("urgent")
    if wet and category in ("roads", "water"):
        tags.append("drainage")

    return {
        "event_type": "issue.created",
        "report_id": str(uuid.UUID(int=rng.getrandbits(128), version=4)),
        "user_id": f"user-{rng.randint(1, 4200):05d}",
        "category": emitted_category,
        "status": status,
        "ai_severity": severity,
        "department_tag": vocab[lookup],
        "priority_score": priority,
        "ai_tags": tags[:5],
        "emergency": severity == "Critical" and rng.random() < 0.35,
        "anonymous": rng.random() < 0.18,
        "location_latitude": round(lat, 6),
        "location_longitude": round(lon, 6),
        "location_accuracy_meters": accuracy,
        "location_source": rng.choices(["gps", "network", "manual"], weights=[0.78, 0.16, 0.06])[0],
        "location_address": f"{rng.randint(1, 240)} {rng.choice(STREET_NAMES)}, {ward['ward_name'].split(' / ')[0]}",
        "created_at": created.strftime("%Y-%m-%dT%H:%M:%S"),
        "is_simulated": True,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-reports", type=int, default=20000)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    ensure_dirs()
    rng = random.Random(args.seed)
    wards = load_wards()
    rain = load_rainfall()

    dates = sorted({date for _, date in rain})
    if not dates:
        sys.exit("Rainfall file has no dates.")
    days = [datetime.strptime(d, "%Y-%m-%d") for d in dates]

    # Calibrate the baseline so --target-reports is honoured.
    #
    # Expected incidents = base * SUM over (ward, day) of pop_share * surge.
    # Both the duplicate clusters and the rain surge inflate the raw count, so
    # precompute the whole surge field first and solve for base, rather than
    # guessing and overshooting.
    total_pop = sum(w["population_2011"] for w in wards)
    surge_field: dict[tuple[str, datetime], float] = {}
    demand_sum = 0.0
    for ward in wards:
        pop_share = ward["population_2011"] / total_pop
        d_factor = drainage_factor(ward["drainage_capacity_mm_hr"])
        for day in days:
            lag_rain = lagged_rain(rain, ward["station_id"], day)
            surge = 1.0 + SURGE_ALPHA * (lag_rain / RAIN_REFERENCE_MM) * d_factor
            surge_field[(ward["ward_id"], day)] = surge
            demand_sum += pop_share * surge

    mean_cluster_extra = (
        P_DUPLICATE_CLUSTER * sum(DUP_CLUSTER_RANGE) / 2
        + P_VIRAL * sum(VIRAL_RANGE) / 2
    )
    target_incidents = args.target_reports / (1 + mean_cluster_extra)
    base_per_ward_day = target_incidents / demand_sum

    reports: list[dict] = []
    truth: list[tuple[str, str]] = []  # (report_id, true_cluster_id)
    surge_samples: list[float] = []

    for ward in wards:
        # pop_share sums to 1 across wards, so bigger wards simply report more.
        pop_share = ward["population_2011"] / total_pop
        ward_base = base_per_ward_day * pop_share
        sigma_km = max(0.8, math.sqrt(ward["road_km"]) / 3.0)

        for day in days:
            lag_rain = lagged_rain(rain, ward["station_id"], day)
            surge = surge_field[(ward["ward_id"], day)]
            surge_samples.append(surge)

            # Poisson draw via Knuth — avoids a numpy dependency here.
            lam = ward_base * surge
            n_incidents = 0
            if lam > 0:
                limit, prob = math.exp(-lam), 1.0
                while True:
                    prob *= rng.random()
                    if prob <= limit:
                        break
                    n_incidents += 1

            wet = lag_rain >= 20.0
            weights = CATEGORY_WEIGHTS_WET if wet else CATEGORY_WEIGHTS_DRY

            for _ in range(n_incidents):
                cluster_id = str(uuid.UUID(int=rng.getrandbits(128), version=4))
                category = weighted_choice(rng, weights)
                lat, lon = jitter_point(
                    rng, ward["centroid_lat"], ward["centroid_lon"], sigma_km
                )
                if rng.random() < P_OUT_OF_BBOX:
                    lat, lon = lat + rng.choice([-0.9, 0.9]), lon + rng.choice([-0.9, 0.9])

                first_seen = day + timedelta(
                    hours=rng.randint(5, 22), minutes=rng.randint(0, 59)
                )
                report = make_report(rng, ward, first_seen, lat, lon, category, wet)
                reports.append(report)
                truth.append((report["report_id"], cluster_id))

                # Duplicate cluster: the same physical defect, photographed by
                # several people within ~15 m and 24 h.
                roll = rng.random()
                if roll < P_VIRAL:
                    extra = rng.randint(*VIRAL_RANGE)
                elif roll < P_DUPLICATE_CLUSTER:
                    extra = rng.randint(*DUP_CLUSTER_RANGE)
                else:
                    extra = 0

                for _ in range(extra):
                    # Within roughly 15 m: 0.000135 deg latitude.
                    dup_lat = lat + rng.uniform(-0.00012, 0.00012)
                    dup_lon = lon + rng.uniform(-0.00012, 0.00012)
                    dup_when = first_seen + timedelta(
                        hours=rng.randint(0, 22), minutes=rng.randint(0, 59)
                    )
                    dup = make_report(rng, ward, dup_when, dup_lat, dup_lon, category, wet)
                    reports.append(dup)
                    truth.append((dup["report_id"], cluster_id))

    reports.sort(key=lambda r: r["created_at"])

    with OUT_JSONL.open("w", encoding="utf-8") as fh:
        for report in reports:
            fh.write(json.dumps(report) + "\n")

    with TRUTH_SIDECAR.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.writer(fh)
        writer.writerow(["report_id", "true_cluster_id"])
        writer.writerows(truth)

    params = {
        "_warning": "Verification only. No Spark job may read this file.",
        "seed": args.seed,
        "target_reports": args.target_reports,
        "lag_weights": LAG_WEIGHTS,
        "surge_alpha": SURGE_ALPHA,
        "rain_reference_mm": RAIN_REFERENCE_MM,
        "p_duplicate_cluster": P_DUPLICATE_CLUSTER,
        "p_viral": P_VIRAL,
        "dirt_rates": {
            "gps_drift": P_GPS_DRIFT,
            "out_of_bbox": P_OUT_OF_BBOX,
            "future_timestamp": P_FUTURE_TIMESTAMP,
            "null_category": P_NULL_CATEGORY,
        },
        "generated_at": datetime.now().isoformat(timespec="seconds"),
    }
    PARAMS_SIDECAR.write_text(json.dumps(params, indent=2), encoding="utf-8")

    unique_clusters = len({c for _, c in truth})
    print(f"Wrote {len(reports):,} reports over {len(days)} days across {len(wards)} wards")
    print(f"  events      -> {OUT_JSONL}")
    print(f"  truth       -> {TRUTH_SIDECAR}  ({unique_clusters:,} true incidents)")
    print(f"  params      -> {PARAMS_SIDECAR}")
    print(f"\n  raw reports per true incident: {len(reports) / unique_clusters:.2f}")
    print(f"  mean surge multiplier applied: {sum(surge_samples) / len(surge_samples):.3f}")
    print(f"  max surge multiplier applied:  {max(surge_samples):.2f}")
    print(
        "\n  These are the GENERATOR's numbers. The Spark fusion job must "
        "rediscover\n  the surge independently — do not quote these in the deck."
    )


if __name__ == "__main__":
    main()
