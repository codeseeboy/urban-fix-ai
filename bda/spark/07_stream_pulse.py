"""
Spark job 07 — LIVE CITY PULSE (Structured Streaming).

The streaming half of the architecture. Batch jobs 05/06 answer "what happened
last monsoon"; this answers "what is happening right now".

Consumes the Kafka civic-report topics with Spark Structured Streaming, keeps a
30-minute sliding window per ward, and raises an alert when a ward exceeds the
burst threshold — the storm-response view from the presentation.

Kafka must be running first:
    bash kafka/start_kafka_wsl.sh start
    python kafka/producer_simulate_events.py --rate 0.01

Then:
    python spark/07_stream_pulse.py --threshold 20 --window 30

The first run downloads the spark-sql-kafka connector from Maven into ~/.ivy2.
After that it works offline.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pyspark
from pyspark.sql import functions as F

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import (  # noqa: E402
    GOLD_ANALYTICS,
    KAFKA_BOOTSTRAP,
    ensure_dirs,
)
from spark.common import CIVIC_REPORT_SCHEMA  # noqa: E402
from spark.spark_session import get_spark  # noqa: E402

CIVIC_TOPICS = "urbanfix.issue.created,urbanfix.issue.status_changed"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--threshold", type=int, default=20,
                        help="events in the window before a ward alerts")
    parser.add_argument("--window", type=int, default=30, help="window minutes")
    parser.add_argument("--slide", type=int, default=5, help="slide minutes")
    parser.add_argument("--timeout", type=int, default=120,
                        help="seconds to run before stopping (0 = forever)")
    args = parser.parse_args()

    ensure_dirs()
    connector = f"org.apache.spark:spark-sql-kafka-0-10_2.12:{pyspark.__version__}"
    spark = get_spark("UrbanFix-StreamPulse", packages=[connector])

    raw = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", KAFKA_BOOTSTRAP)
        .option("subscribe", CIVIC_TOPICS)
        .option("startingOffsets", "latest")
        .option("failOnDataLoss", "false")
        .load()
    )

    # Kafka gives us bytes; the producer sends the bare event dict as JSON.
    events = (
        raw.select(
            F.col("topic"),
            F.col("timestamp").alias("kafka_ts"),
            F.from_json(F.col("value").cast("string"), CIVIC_REPORT_SCHEMA).alias("e"),
        )
        .filter(F.col("e.report_id").isNotNull())
        .select("topic", "kafka_ts", "e.*")
        # Match the batch path (05_events_silver.py): a report whose category
        # never got classified becomes "unclassified", not NULL. Batch and
        # stream must label the same event the same way or the two views of the
        # city disagree.
        .withColumn("category", F.coalesce(F.col("category"), F.lit("unclassified")))
    )

    # Window on Kafka arrival time, not created_at: this is an operational
    # "what is arriving now" view. The batch jobs use created_at for history.
    windowed = (
        events.withWatermark("kafka_ts", "10 minutes")
        .groupBy(
            F.window("kafka_ts", f"{args.window} minutes", f"{args.slide} minutes"),
            F.col("category"),
        )
        .agg(
            F.count("*").alias("events"),
            # Exact countDistinct is not supported on streaming DataFrames —
            # Spark cannot keep unbounded distinct state per window. HyperLogLog
            # is the streaming-safe equivalent.
            F.approx_count_distinct("report_id").alias("approx_distinct"),
            F.sum(F.when(F.col("ai_severity").isin("High", "Critical"), 1).otherwise(0))
            .alias("severe"),
        )
    )

    alerts = windowed.filter(F.col("events") >= args.threshold).select(
        F.col("window.start").alias("window_start"),
        F.col("window.end").alias("window_end"),
        "category",
        "events",
        "approx_distinct",
        "severe",
        F.lit(args.threshold).alias("threshold"),
    )

    checkpoint = GOLD_ANALYTICS / "_stream_checkpoint"
    console = (
        alerts.writeStream.outputMode("update")
        .format("console")
        .option("truncate", False)
        .option("numRows", 20)
        .queryName("urbanfix-live-pulse")
        .option("checkpointLocation", str(checkpoint))
        .start()
    )

    print(f"\nLive pulse running. Alerting when a category exceeds "
          f"{args.threshold} events per {args.window}m window.")
    print(f"  bootstrap : {KAFKA_BOOTSTRAP}")
    print(f"  topics    : {CIVIC_TOPICS}")
    print("  Ctrl-C to stop.\n")

    if args.timeout:
        console.awaitTermination(args.timeout)
        console.stop()
        print(f"\nStopped after {args.timeout}s.")
    else:
        console.awaitTermination()

    spark.stop()


if __name__ == "__main__":
    main()
