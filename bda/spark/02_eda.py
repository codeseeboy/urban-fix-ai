"""
Spark job 02 — Exploratory Data Analysis on bronze image metadata + events.
Writes gold analytics tables and PNG charts for the college report.
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
    ensure_dirs,
)
from spark.spark_session import get_spark  # noqa: E402


def save_fig(name: str) -> Path:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    path = FIGURES_DIR / name
    plt.tight_layout()
    plt.savefig(path, dpi=140)
    plt.close()
    return path


def main() -> None:
    ensure_dirs()
    spark = get_spark("UrbanFix-EDA")
    meta_path = BRONZE_IMAGES / "metadata_raw"
    if not meta_path.exists():
        print("Missing bronze metadata. Run spark/01_ingest_metadata.py first.")
        sys.exit(1)

    df = spark.read.parquet(str(meta_path))
    total = df.count()
    corrupt = df.filter(F.col("is_corrupt") == True).count()  # noqa: E712
    labeled = df.filter(F.col("has_label") == True).count()  # noqa: E712
    pothole = df.filter(F.col("has_pothole") == True).count()  # noqa: E712
    missing_label = df.filter(F.col("has_label") == False).count()  # noqa: E712

    print("\n=== IMAGE EDA ===")
    print(f"Total images       : {total}")
    print(f"Corrupt            : {corrupt}")
    print(f"With labels        : {labeled}")
    print(f"Missing labels     : {missing_label}")
    print(f"Has pothole (D40)  : {pothole}")

    print("\n-- Class / country distribution --")
    df.groupBy("country").count().orderBy(F.desc("count")).show(20, truncate=False)
    df.groupBy("has_pothole").count().show()
    df.groupBy("is_corrupt").count().show()

    # resolution buckets
    res = (
        df.filter(F.col("is_corrupt") == False)  # noqa: E712
        .withColumn(
            "res_bucket",
            F.when((F.col("width") < 640) | (F.col("height") < 640), "lt_640")
            .when((F.col("width") < 1280) & (F.col("height") < 1280), "640_to_1280")
            .otherwise("ge_1280"),
        )
        .groupBy("res_bucket")
        .count()
    )
    print("-- Resolution buckets --")
    res.show()

    # duplicates by md5
    dups = (
        df.filter(F.col("md5").isNotNull())
        .groupBy("md5")
        .agg(F.count("*").alias("n"), F.collect_list("filename").alias("files"))
        .filter(F.col("n") > 1)
    )
    dup_groups = dups.count()
    dup_extra = dups.agg(F.sum(F.col("n") - 1)).collect()[0][0] or 0
    print(f"Duplicate MD5 groups: {dup_groups} (extra copies ≈ {dup_extra})")

    # size summary
    print("-- Size / resolution summary --")
    df.select("size_bytes", "width", "height", "num_objects").summary().show()

    # Events EDA if present
    events_summary = {"events_total": 0}
    events_file = BRONZE_EVENTS / "sample_events.jsonl"
    kafka_latest = BRONZE_EVENTS / "kafka_events_latest.jsonl"
    event_paths = [p for p in [events_file, kafka_latest] if p.exists()]
    if event_paths:
        # flatten jsonl with Spark
        raw = spark.read.text([str(p) for p in event_paths])
        # sample_events are plain payloads; kafka file wraps payload
        from pyspark.sql.types import StringType

        def extract_json(line: str) -> str:
            try:
                obj = json.loads(line)
                if "payload" in obj:
                    return json.dumps(obj["payload"])
                return line
            except Exception:
                return "{}"

        extract_udf = F.udf(extract_json, StringType())
        ev = (
            raw.withColumn("json", extract_udf("value"))
            .withColumn("data", F.from_json("json", "event_type STRING, ward STRING, status STRING, severity STRING, has_pothole BOOLEAN, predicted_class STRING"))
            .select("data.*")
            .filter(F.col("event_type").isNotNull())
        )
        events_summary["events_total"] = ev.count()
        print("\n=== EVENT EDA ===")
        print("Events:", events_summary["events_total"])
        ev.groupBy("event_type").count().show()
        if ev.filter(F.col("ward").isNotNull()).count():
            ev.groupBy("ward").count().orderBy(F.desc("count")).show(15)
        ward_df = ev.groupBy("ward").count().orderBy(F.desc("count")).toPandas()
        if not ward_df.empty and ward_df["ward"].notna().any():
            plt.figure(figsize=(8, 4))
            plt.bar(ward_df["ward"].astype(str), ward_df["count"])
            plt.xticks(rotation=45, ha="right")
            plt.title("UrbanFix events by ward")
            plt.ylabel("count")
            save_fig("eda_events_by_ward.png")

    # Charts from pandas
    pdf = df.toPandas()
    summary = {
        "total_images": int(total),
        "corrupt_images": int(corrupt),
        "labeled_images": int(labeled),
        "missing_labels": int(missing_label),
        "pothole_images": int(pothole),
        "duplicate_groups": int(dup_groups),
        "duplicate_extra_copies": int(dup_extra),
        "class_imbalance_pothole_ratio": round(pothole / max(total, 1), 4),
        **events_summary,
    }
    GOLD_ANALYTICS.mkdir(parents=True, exist_ok=True)
    (GOLD_ANALYTICS / "eda_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    pd.DataFrame([summary]).to_csv(GOLD_ANALYTICS / "eda_summary.csv", index=False)

    # corrupt vs ok
    plt.figure(figsize=(5, 4))
    pdf["is_corrupt"].value_counts().plot(kind="bar", color=["#2a9d8f", "#e76f51"])
    plt.title("Corrupt vs readable images")
    plt.ylabel("count")
    save_fig("eda_corrupt.png")

    plt.figure(figsize=(5, 4))
    pdf["has_label"].value_counts().plot(kind="bar", color=["#457b9d", "#f4a261"])
    plt.title("Labeled vs missing annotations")
    plt.ylabel("count")
    save_fig("eda_labels.png")

    plt.figure(figsize=(6, 4))
    pdf["country"].value_counts().plot(kind="bar")
    plt.title("Images by country/source")
    plt.ylabel("count")
    plt.xticks(rotation=45, ha="right")
    save_fig("eda_country.png")

    good = pdf[pdf["is_corrupt"] == False]  # noqa: E712
    if not good.empty:
        plt.figure(figsize=(6, 4))
        plt.scatter(good["width"], good["height"], alpha=0.5, s=18)
        plt.xlabel("width")
        plt.ylabel("height")
        plt.title("Image resolution distribution")
        save_fig("eda_resolution_scatter.png")

    # class counts from classes string
    from collections import Counter

    c = Counter()
    for s in pdf["classes"].fillna(""):
        for part in str(s).split(","):
            part = part.strip()
            if part:
                c[part] += 1
    if c:
        plt.figure(figsize=(6, 4))
        labels, vals = zip(*c.most_common())
        plt.bar(labels, vals, color="#264653")
        plt.title("Annotation class frequency")
        plt.ylabel("object count")
        save_fig("eda_class_freq.png")

    report = REPORTS_DIR / "eda_report.md"
    report.write_text(
        f"""# UrbanFix BDA — Spark EDA Report

## Image dataset
| Metric | Value |
|--------|------:|
| Total images | {total} |
| Corrupt / unreadable | {corrupt} |
| With labels | {labeled} |
| Missing labels | {missing_label} |
| Pothole images | {pothole} |
| Duplicate MD5 groups | {dup_groups} |
| Extra duplicate copies | {dup_extra} |
| Pothole ratio | {summary['class_imbalance_pothole_ratio']} |

## Events
Total events analysed: {events_summary.get('events_total', 0)}

## Figures
See `reports/figures/` for charts generated by Spark EDA.

## Spark role
Apache Spark scanned dataset metadata in parallel, computed aggregations
(country, corruption, labels, duplicates, resolution buckets), and wrote
gold-layer summaries used by the dashboard and cleaning job.
""",
        encoding="utf-8",
    )
    print(f"\nWrote {GOLD_ANALYTICS / 'eda_summary.json'}")
    print(f"Wrote {report}")
    print(f"Figures in {FIGURES_DIR}")
    spark.stop()


if __name__ == "__main__":
    main()
