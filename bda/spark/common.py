"""
Shared helpers for the UrbanFix BDA Spark jobs.

Exists because the same three problems were being re-solved (or silently
skipped) in every job:

  1. Events land in the lake in TWO shapes. scripts/ writes the bare event
     dict; kafka/consumer_to_lake.py wraps it as {topic, partition, offset,
     payload}. 02_eda.py handled both with a Python UDF; 04_analytics.py
     handled only the bare shape, so it silently ignored every Kafka-landed
     event. unwrap_payload() fixes that for all callers.
  2. Every job invented its own event schema by inference or by an ad-hoc
     from_json string, so columns quietly differed between jobs. The explicit
     StructTypes here are the single source of truth.
  3. Ward attribution needs haversine in a few places.
"""
from __future__ import annotations

import sys
from pathlib import Path

from pyspark.sql import Column, DataFrame, SparkSession, functions as F
from pyspark.sql.types import (
    ArrayType,
    BooleanType,
    DoubleType,
    IntegerType,
    StringType,
    StructField,
    StructType,
)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import (  # noqa: E402
    MAX_WARD_DISTANCE_KM,
    RAINFALL_CSV,
    UNKNOWN_WARD,
    WARD_MASTER_CSV,
    lake_uri,
    local_uri,
)

EARTH_RADIUS_KM = 6371.0088

# ──────────────────────────────────────────────────────────────────────────
# Schemas — explicit, never inferred.
# ──────────────────────────────────────────────────────────────────────────

# scripts/generate_civic_history.py, mirroring the issue_reports table in
# backend/supabase_migration.sql. One row per citizen observation.
CIVIC_REPORT_SCHEMA = StructType([
    StructField("event_type", StringType()),
    StructField("report_id", StringType()),
    StructField("user_id", StringType()),
    StructField("category", StringType()),
    StructField("status", StringType()),
    StructField("ai_severity", StringType()),
    StructField("department_tag", StringType()),
    StructField("priority_score", IntegerType()),
    StructField("ai_tags", ArrayType(StringType())),
    StructField("emergency", BooleanType()),
    StructField("anonymous", BooleanType()),
    StructField("location_latitude", DoubleType()),
    StructField("location_longitude", DoubleType()),
    StructField("location_accuracy_meters", DoubleType()),
    StructField("location_source", StringType()),
    StructField("location_address", StringType()),
    StructField("created_at", StringType()),
    StructField("is_simulated", BooleanType()),
])

# scripts/generate_sample_dataset.py — the older image-linked event stream.
# Kept so 02/04 can read it through the same path. Note it uses `lon`, not
# `lng`, and lat/lon appear only on issue.created rows.
IMAGE_EVENT_SCHEMA = StructType([
    StructField("event_type", StringType()),
    StructField("issue_id", StringType()),
    StructField("timestamp", StringType()),
    StructField("ward", StringType()),
    StructField("country", StringType()),
    StructField("category", StringType()),
    StructField("image_stem", StringType()),
    StructField("has_pothole", BooleanType()),
    StructField("lat", DoubleType()),
    StructField("lon", DoubleType()),
    StructField("predicted_class", StringType()),
    StructField("confidence", DoubleType()),
    StructField("severity", StringType()),
    StructField("status", StringType()),
])


def unwrap_payload(value_col: str = "value") -> Column:
    """
    Normalise the two on-disk event shapes to a single JSON string.

    Kafka-landed lines look like {"topic":..., "payload":{...}}; generator
    lines are the bare event. Implemented with get_json_object rather than a
    Python UDF so it stays inside the JVM — at 19k+ rows per run the round
    trip through the Python worker is pure overhead.
    """
    payload = F.get_json_object(F.col(value_col), "$.payload")
    return F.when(payload.isNotNull(), payload).otherwise(F.col(value_col))


def read_events(spark: SparkSession, paths: list[Path], schema: StructType) -> DataFrame:
    """
    Read event JSONL files into a typed DataFrame, handling both shapes.

    Rows that fail to parse are dropped (event_type is null) rather than
    poisoning the run — the caller should report the delta if it matters.
    """
    # Existence is checked locally, but the READ goes through lake_uri: in HDFS
    # mode bronze lives on the cluster, and a bare path would be resolved
    # against fs.defaultFS and silently point at the wrong filesystem.
    existing = [p for p in paths if Path(p).exists()]
    if not existing:
        return spark.createDataFrame([], schema)
    return (
        spark.read.text([lake_uri(p) for p in existing])
        .withColumn("json", unwrap_payload("value"))
        .withColumn("data", F.from_json("json", schema))
        .select("data.*")
        .filter(F.col("event_type").isNotNull())
    )


def haversine_km(lat1: Column, lon1: Column, lat2: Column, lon2: Column) -> Column:
    """Great-circle distance in km as a Spark expression."""
    p1, p2 = F.radians(lat1), F.radians(lat2)
    dphi = F.radians(lat2 - lat1)
    dlam = F.radians(lon2 - lon1)
    a = (
        F.sin(dphi / 2) ** 2
        + F.cos(p1) * F.cos(p2) * F.sin(dlam / 2) ** 2
    )
    return F.lit(2 * EARTH_RADIUS_KM) * F.asin(F.sqrt(a))


def load_ward_master(spark: SparkSession) -> DataFrame:
    if not WARD_MASTER_CSV.exists():
        sys.exit(
            f"{WARD_MASTER_CSV} not found. Run scripts/build_ward_master.py first."
        )
    return (
        spark.read.option("header", True)
        .option("inferSchema", True)
        .csv(local_uri(WARD_MASTER_CSV))
    )


def load_rainfall(spark: SparkSession) -> DataFrame:
    if not RAINFALL_CSV.exists():
        sys.exit(
            f"{RAINFALL_CSV} not found. Run scripts/fetch_rainfall.py first."
        )
    return (
        spark.read.option("header", True)
        .option("inferSchema", True)
        .csv(local_uri(RAINFALL_CSV))
        .withColumn("date", F.to_date("date"))
    )


def assign_nearest_ward(
    events: DataFrame,
    wards: DataFrame,
    lat_col: str = "location_latitude",
    lon_col: str = "location_longitude",
) -> DataFrame:
    """
    Attribute each event to its nearest ward centroid.

    The production `issues` table has no ward column at all, so ward must be
    derived from lon/lat. A true point-in-polygon join needs real BMC boundary
    geometry, which the deck puts out of scope; nearest-centroid over 24 wards
    is the sanctioned approximation.

    Implemented as a broadcast cross join (24 rows on the right) plus a
    per-event argmin. Events farther than MAX_WARD_DISTANCE_KM from every
    centroid become UNKNOWN_WARD and are kept, not dropped — slide 8 promises
    quarantine-for-review rather than silent loss.
    """
    ward_cols = wards.select(
        F.col("ward_id").alias("_ward_id"),
        F.col("centroid_lat").alias("_wlat"),
        F.col("centroid_lon").alias("_wlon"),
        F.col("station_id").alias("_station_id"),
        F.col("drainage_capacity_mm_hr").alias("_drainage"),
    )

    joined = events.crossJoin(F.broadcast(ward_cols)).withColumn(
        "_dist_km",
        haversine_km(F.col(lat_col), F.col(lon_col), F.col("_wlat"), F.col("_wlon")),
    )

    # argmin per event without a window over the full cross product.
    nearest = joined.groupBy("report_id").agg(
        F.min(F.struct("_dist_km", "_ward_id", "_station_id", "_drainage")).alias("_best")
    )

    return (
        events.join(nearest, on="report_id", how="left")
        .withColumn("ward_distance_km", F.round(F.col("_best._dist_km"), 3))
        .withColumn(
            "ward_id",
            F.when(
                F.col("_best._dist_km") <= MAX_WARD_DISTANCE_KM, F.col("_best._ward_id")
            ).otherwise(F.lit(UNKNOWN_WARD)),
        )
        .withColumn(
            "station_id",
            F.when(
                F.col("_best._dist_km") <= MAX_WARD_DISTANCE_KM,
                F.col("_best._station_id"),
            ).otherwise(F.lit(None).cast(StringType())),
        )
        .withColumn("drainage_capacity_mm_hr", F.col("_best._drainage"))
        .drop("_best")
    )


def cluster_duplicates(
    df: DataFrame,
    radius_m: float,
    window_hours: int,
    ts_col: str = "created_ts",
    lat_col: str = "location_latitude",
    lon_col: str = "location_longitude",
    iterations: int = 3,
):
    """
    Cluster reports of one physical defect into a parent incident.

    Naive grid snapping is not good enough here: two reports 5 m apart can fall
    either side of a cell boundary and never meet. That under-merges badly —
    on this dataset it recovered only ~1.5 of the ~4.0 reports per incident
    that actually exist.

    Instead this builds a real neighbourhood graph:

      1. Snap every report to a `radius_m` grid.
      2. Replicate each report across its own cell and its 8 neighbours. Two
         points within radius_m must share at least one of those 9 cells, so no
         true pair can be missed.
      3. Keep candidate pairs whose ACTUAL haversine distance is within
         radius_m and whose timestamps are within window_hours.
      4. Propagate the minimum report_id along those edges. A few iterations
         are enough to make each connected component agree on one parent, which
         is a standard distributed connected-components approximation.

    Returns (df_with_report_group_id, n_edges).
    """
    m_per_deg_lat = 110_900.0
    m_per_deg_lon = 105_200.0
    lat_step = radius_m / m_per_deg_lat
    lon_step = radius_m / m_per_deg_lon
    window_s = window_hours * 3600

    base = (
        df.select(
            F.col("report_id"),
            F.col(lat_col).alias("_lat"),
            F.col(lon_col).alias("_lon"),
            F.unix_timestamp(ts_col).alias("_ts"),
            F.col("category").alias("_cat"),
        )
        .withColumn("_cl", F.floor(F.col("_lat") / F.lit(lat_step)))
        .withColumn("_co", F.floor(F.col("_lon") / F.lit(lon_step)))
    )
    base.cache()

    offsets = F.array(*[F.struct(F.lit(dx).alias("dx"), F.lit(dy).alias("dy"))
                        for dx in (-1, 0, 1) for dy in (-1, 0, 1)])
    probe = (
        base.withColumn("_o", F.explode(offsets))
        .withColumn("_pcl", F.col("_cl") + F.col("_o.dx"))
        .withColumn("_pco", F.col("_co") + F.col("_o.dy"))
        .select(
            F.col("report_id").alias("p_id"),
            F.col("_lat").alias("p_lat"), F.col("_lon").alias("p_lon"),
            F.col("_ts").alias("p_ts"), F.col("_cat").alias("p_cat"),
            "_pcl", "_pco",
        )
    )

    edges = (
        base.join(
            probe,
            (base._cl == probe._pcl) & (base._co == probe._pco) & (base._cat == probe.p_cat),
            "inner",
        )
        .filter(
            (haversine_km(F.col("_lat"), F.col("_lon"), F.col("p_lat"), F.col("p_lon"))
             * 1000.0 <= F.lit(radius_m))
            & (F.abs(F.col("_ts") - F.col("p_ts")) <= F.lit(window_s))
        )
        .select(F.col("report_id").alias("src"), F.col("p_id").alias("dst"))
    )
    edges.cache()
    n_edges = edges.count()

    # Label propagation: every node adopts the smallest id in its neighbourhood.
    labels = base.select(F.col("report_id").alias("id"),
                         F.col("report_id").alias("label"))
    for _ in range(iterations):
        labels = (
            edges.join(labels, edges.dst == labels.id, "inner")
            .groupBy(F.col("src").alias("id"))
            .agg(F.min("label").alias("label"))
        )
        labels.cache()

    out = df.join(
        labels.select(F.col("id").alias("report_id"),
                      F.col("label").alias("report_group_id")),
        on="report_id",
        how="left",
    ).withColumn(
        "report_group_id",
        F.coalesce(F.col("report_group_id"), F.col("report_id")),
    ).withColumn(
        "is_parent_report", F.col("report_group_id") == F.col("report_id")
    )
    return out, n_edges
