"""
Spark job 04 — Gold analytics for UrbanFix BDA dashboards.

Produces ward hotspots, severity trends, department-style scorecards,
and original-vs-cleaned comparison for the mini-project report.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
from pyspark.sql import functions as F

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import (  # noqa: E402
    BRONZE_EVENTS,
    BRONZE_IMAGES,
    FIGURES_DIR,
    GOLD_ANALYTICS,
    REPORTS_DIR,
    SILVER_CLEAN,
    ensure_dirs,
)
from spark.spark_session import get_spark  # noqa: E402


def main() -> None:
    ensure_dirs()
    spark = get_spark("UrbanFix-Analytics")

    raw = spark.read.parquet(str(BRONZE_IMAGES / "metadata_raw"))
    clean_path = SILVER_CLEAN / "metadata_clean"
    if not clean_path.exists():
        print("Run 03_clean.py first")
        sys.exit(1)
    clean = spark.read.parquet(str(clean_path))

    # Comparison table
    cmp = {
        "metric": [
            "total_images",
            "corrupt",
            "missing_or_invalid_labels",
            "pothole_images",
            "unique_md5",
        ],
        "original": [
            raw.count(),
            raw.filter(F.col("is_corrupt") == True).count(),  # noqa: E712
            raw.filter(
                (F.col("has_label") == False) | (F.col("label_valid") == False)  # noqa: E712
            ).count(),
            raw.filter(F.col("has_pothole") == True).count(),  # noqa: E712
            raw.select("md5").where(F.col("md5").isNotNull()).distinct().count(),
        ],
        "cleaned": [
            clean.count(),
            clean.filter(F.col("is_corrupt") == True).count(),  # noqa: E712
            clean.filter(
                (F.col("has_label") == False) | (F.col("label_valid") == False)  # noqa: E712
            ).count(),
            clean.filter(F.col("has_pothole") == True).count(),  # noqa: E712
            clean.select("md5").where(F.col("md5").isNotNull()).distinct().count(),
        ],
    }
    cmp_df = pd.DataFrame(cmp)
    cmp_df.to_csv(GOLD_ANALYTICS / "original_vs_cleaned.csv", index=False)

    plt.figure(figsize=(7, 4))
    x = range(len(cmp_df))
    plt.bar([i - 0.2 for i in x], cmp_df["original"], width=0.4, label="original")
    plt.bar([i + 0.2 for i in x], cmp_df["cleaned"], width=0.4, label="cleaned")
    plt.xticks(list(x), cmp_df["metric"], rotation=25, ha="right")
    plt.legend()
    plt.title("Original vs Spark-cleaned dataset")
    plt.tight_layout()
    plt.savefig(FIGURES_DIR / "analytics_original_vs_cleaned.png", dpi=140)
    plt.close()

    # Country damage mix on cleaned set
    country = clean.groupBy("country", "has_pothole").count().toPandas()
    country.to_csv(GOLD_ANALYTICS / "country_pothole_mix.csv", index=False)

    # Events → hotspot wards + severity scorecard
    events_file = BRONZE_EVENTS / "sample_events.jsonl"
    if events_file.exists():
        lines = [json.loads(l) for l in events_file.read_text(encoding="utf-8").splitlines() if l.strip()]
        ev = spark.createDataFrame(lines)
        hotspots = (
            ev.filter(F.col("event_type") == "issue.created")
            .groupBy("ward")
            .agg(
                F.count("*").alias("reports"),
                F.sum(F.col("has_pothole").cast("int")).alias("pothole_reports"),
            )
            .orderBy(F.desc("reports"))
        )
        hotspots_pdf = hotspots.toPandas()
        hotspots_pdf.to_csv(GOLD_ANALYTICS / "ward_hotspots.csv", index=False)

        plt.figure(figsize=(8, 4))
        plt.bar(hotspots_pdf["ward"], hotspots_pdf["reports"], color="#e63946")
        plt.xticks(rotation=45, ha="right")
        plt.title("Hotspot wards (report volume)")
        plt.ylabel("reports")
        plt.tight_layout()
        plt.savefig(FIGURES_DIR / "analytics_ward_hotspots.png", dpi=140)
        plt.close()

        severity = (
            ev.filter(F.col("event_type") == "issue.ai_verdict")
            .groupBy("severity")
            .count()
            .orderBy(F.desc("count"))
            .toPandas()
        )
        severity.to_csv(GOLD_ANALYTICS / "severity_scorecard.csv", index=False)
        if not severity.empty:
            plt.figure(figsize=(5, 4))
            plt.bar(severity["severity"].astype(str), severity["count"], color="#457b9d")
            plt.title("AI severity distribution")
            plt.tight_layout()
            plt.savefig(FIGURES_DIR / "analytics_severity.png", dpi=140)
            plt.close()

        status = (
            ev.filter(F.col("event_type") == "issue.status_changed")
            .groupBy("status")
            .count()
            .toPandas()
        )
        status.to_csv(GOLD_ANALYTICS / "status_scorecard.csv", index=False)

    # Spark impact blurb for report
    (REPORTS_DIR / "spark_impact.md").write_text(
        f"""# How Spark improved UrbanFix data processing

## Before (raw)
- Images: {cmp['original'][0]}
- Corrupt: {cmp['original'][1]}
- Missing/invalid labels: {cmp['original'][2]}

## After (Spark cleaning)
- Images kept: {cmp['cleaned'][0]}
- Corrupt remaining: {cmp['cleaned'][1]}
- Missing/invalid labels remaining: {cmp['cleaned'][2]}

## Why Spark (BDA relevance)
1. **Scalable metadata scan** — paths, sizes, labels joined without loading all pixels into one machine process.
2. **Distributed aggregations** — country, class, corruption, duplicate MD5, resolution buckets.
3. **Reproducible lake layers** — bronze (raw) → silver (clean) → gold (analytics) as Parquet/CSV.
4. **Fits Kafka + HDFS architecture** — Spark consumes lake files landed from the Kafka consumer.

Kafka handles the live UrbanFix event stream; HDFS/local lake stores history;
Spark turns that history into cleaning decisions and city dashboards.
""",
        encoding="utf-8",
    )

    print("Gold analytics written to", GOLD_ANALYTICS)
    print(cmp_df.to_string(index=False))
    spark.stop()


if __name__ == "__main__":
    main()
