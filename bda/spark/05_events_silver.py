"""
Spark job 05 — civic reports: bronze -> silver.

Covers stages 02 ALIGN and 03 CLEAN of the fusion pipeline:
  ALIGN   derive a calendar date; attribute each report to a ward via its
          nearest centroid (the production issues table has no ward column,
          so ward must be derived from lon/lat).
  CLEAN   apply the veracity rules, normalise the three department
          vocabularies, and cluster duplicate reports of one physical defect
          into a parent incident.

Reads : bronze/events/*.jsonl  (generator + Kafka shapes)
Writes: silver/events_clean    Parquet, partitioned by year/month
        gold/analytics/veracity_report.json
        gold/analytics/dedup_audit.csv

Run after scripts/generate_civic_history.py.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from pyspark.sql import functions as F

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import (  # noqa: E402
    BRONZE_EVENTS,
    DEDUP_RADIUS_M,
    DEDUP_WINDOW_HOURS,
    DEPT_NORMALIZATION,
    GOLD_ANALYTICS,
    MAX_LOCATION_ACCURACY_M,
    MUMBAI_BBOX,
    RAINFALL_END,
    RAINFALL_START,
    SILVER_EVENTS,
    UNKNOWN_WARD,
    ensure_dirs,
    lake_uri,
)
from spark.common import (  # noqa: E402
    CIVIC_REPORT_SCHEMA,
    assign_nearest_ward,
    cluster_duplicates,
    load_ward_master,
    read_events,
)
from spark.spark_session import get_spark  # noqa: E402

def main() -> None:
    ensure_dirs()
    spark = get_spark("UrbanFix-EventsSilver")

    sources = [
        BRONZE_EVENTS / "civic_history.jsonl",
        BRONZE_EVENTS / "kafka_events_latest.jsonl",
    ]
    if not any(p.exists() for p in sources):
        print("No civic events in bronze. Run scripts/generate_civic_history.py first.")
        sys.exit(1)

    # report_id is the marker of the civic (issue_reports) grain. The lake also
    # holds the older image-linked event stream, which shares `event_type` but
    # none of the other fields; parsed against this schema those rows would come
    # back as a single null-filled record and survive into silver. Require
    # report_id so only civic reports get through.
    df = (
        read_events(spark, sources, CIVIC_REPORT_SCHEMA)
        .filter(F.col("report_id").isNotNull())
        .dropDuplicates(["report_id"])
    )
    stats: dict[str, int | float] = {"bronze_reports": df.count()}
    print(f"\nBronze reports: {stats['bronze_reports']:,}")

    # ── ALIGN ────────────────────────────────────────────────────────────
    df = (
        df.withColumn("created_ts", F.to_timestamp("created_at"))
        .withColumn("event_date", F.to_date("created_ts"))
        .withColumn("category", F.coalesce(F.col("category"), F.lit("unclassified")))
    )

    # ── CLEAN: veracity rules ────────────────────────────────────────────
    # Each rule is counted separately so the before/after chart is explainable
    # rather than one opaque "rows dropped" number.
    rule_bad_accuracy = F.col("location_accuracy_meters") > MAX_LOCATION_ACCURACY_M
    rule_out_of_bbox = ~(
        F.col("location_latitude").between(MUMBAI_BBOX["min_lat"], MUMBAI_BBOX["max_lat"])
        & F.col("location_longitude").between(
            MUMBAI_BBOX["min_lon"], MUMBAI_BBOX["max_lon"]
        )
    )
    rule_future = F.col("created_ts") > F.current_timestamp()
    rule_no_date = F.col("event_date").isNull()
    # Clock-skewed devices also produce timestamps that are not in the future
    # relative to *now*, but are outside the period the analysis covers. Those
    # rows can never join to a rainfall day, so they are rejected explicitly
    # rather than vanishing silently in the fusion join.
    rule_outside_window = (F.col("event_date") < F.lit(RAINFALL_START).cast("date")) | (
        F.col("event_date") > F.lit(RAINFALL_END).cast("date")
    )

    stats["rejected_gps_accuracy"] = df.filter(rule_bad_accuracy).count()
    stats["rejected_out_of_bbox"] = df.filter(rule_out_of_bbox).count()
    stats["rejected_future_timestamp"] = df.filter(rule_future).count()
    stats["rejected_unparseable_date"] = df.filter(rule_no_date).count()
    stats["rejected_outside_window"] = df.filter(rule_outside_window).count()

    clean = df.filter(
        ~rule_bad_accuracy
        & ~rule_out_of_bbox
        & ~rule_future
        & ~rule_no_date
        & ~rule_outside_window
    )
    stats["after_veracity"] = clean.count()

    # ── CLEAN: ward attribution ──────────────────────────────────────────
    wards = load_ward_master(spark)
    clean = assign_nearest_ward(clean, wards)
    stats["quarantined_unknown_ward"] = clean.filter(
        F.col("ward_id") == UNKNOWN_WARD
    ).count()

    # ── CLEAN: department normalisation ──────────────────────────────────
    # issues.department_tag has no CHECK constraint and three parts of the
    # system write three different vocabularies into it. Collapse them.
    stats["department_values_before"] = clean.select("department_tag").distinct().count()
    mapping = F.create_map(
        *[F.lit(x) for kv in DEPT_NORMALIZATION.items() for x in kv]
    )
    clean = clean.withColumn(
        "department_normalized",
        F.coalesce(mapping[F.lower(F.trim(F.col("department_tag")))], F.lit("General")),
    )
    stats["department_values_after"] = (
        clean.select("department_normalized").distinct().count()
    )

    # ── CLEAN: spatial-temporal deduplication ────────────────────────────
    # One physical defect photographed by many people becomes one incident.
    # See spark.common.cluster_duplicates: neighbour-cell candidate generation,
    # a real haversine distance test, then label propagation. A plain grid snap
    # was tried first and under-merged badly (it recovered only ~1.5 of the
    # ~4.0 reports per incident that exist) because reports a few metres apart
    # can sit either side of a cell boundary.
    clean, n_edges = cluster_duplicates(
        clean,
        radius_m=DEDUP_RADIUS_M,
        window_hours=DEDUP_WINDOW_HOURS,
    )
    stats["duplicate_graph_edges"] = n_edges

    stats["silver_reports"] = clean.count()
    stats["distinct_incidents"] = clean.select("report_group_id").distinct().count()
    stats["reports_per_incident"] = round(
        stats["silver_reports"] / max(stats["distinct_incidents"], 1), 3
    )

    # ── Write silver ─────────────────────────────────────────────────────
    # Partitioned by year/month only. The deck says "year/month/ward", but at
    # this volume adding ward would create 12 x 24 = 288 partitions averaging
    # ~60 rows each — a textbook small-files problem. Documented rather than
    # silently ignored.
    out = (
        clean.withColumn("event_year", F.year("event_date"))
        .withColumn("event_month", F.month("event_date"))
        .drop("json", "value")
    )
    out.write.mode("overwrite").partitionBy("event_year", "event_month").parquet(
        lake_uri(SILVER_EVENTS / "reports")
    )

    audit = (
        clean.groupBy("ward_id")
        .agg(
            F.count("*").alias("raw_reports"),
            F.countDistinct("report_group_id").alias("incidents"),
        )
        .withColumn(
            "collapse_ratio",
            F.round(F.col("raw_reports") / F.col("incidents"), 3),
        )
        .orderBy(F.desc("raw_reports"))
    )
    audit.toPandas().to_csv(GOLD_ANALYTICS / "dedup_audit.csv", index=False)

    (GOLD_ANALYTICS / "veracity_report.json").write_text(
        json.dumps(stats, indent=2), encoding="utf-8"
    )

    print("\n=== VERACITY ===")
    for key, value in stats.items():
        print(f"  {key:<28} {value:,}" if isinstance(value, int) else f"  {key:<28} {value}")
    print("\n=== DEDUP BY WARD (top 10) ===")
    audit.show(10, truncate=False)
    print(f"silver -> {lake_uri(SILVER_EVENTS / 'reports')}")

    spark.stop()


if __name__ == "__main__":
    main()
