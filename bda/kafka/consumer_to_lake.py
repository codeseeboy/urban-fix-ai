"""
Kafka consumer: persist UrbanFix events into the bronze data lake (JSONL).

This is the HDFS/lake landing zone for streaming civic events.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from kafka import KafkaConsumer
from kafka.errors import NoBrokersAvailable

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import BRONZE_EVENTS, KAFKA_BOOTSTRAP, KAFKA_TOPICS, ensure_dirs  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--max-messages", type=int, default=500)
    parser.add_argument("--timeout-ms", type=int, default=15000)
    args = parser.parse_args()
    ensure_dirs()

    out = BRONZE_EVENTS / f"kafka_events_{datetime.now().strftime('%Y%m%d_%H%M%S')}.jsonl"
    try:
        consumer = KafkaConsumer(
            *KAFKA_TOPICS,
            bootstrap_servers=KAFKA_BOOTSTRAP,
            auto_offset_reset="earliest",
            enable_auto_commit=True,
            group_id="urbanfix-bda-lake-writer",
            value_deserializer=lambda b: json.loads(b.decode("utf-8")),
            consumer_timeout_ms=args.timeout_ms,
        )
    except NoBrokersAvailable:
        print("ERROR: Kafka not reachable. Run: docker compose up -d")
        sys.exit(1)

    print(f"Consuming from {KAFKA_TOPICS}")
    print(f"Writing bronze lake file: {out}")
    n = 0
    with open(out, "w", encoding="utf-8") as f:
        for msg in consumer:
            if msg.value.get("event_type") == "warmup":
                continue
            row = {
                "topic": msg.topic,
                "partition": msg.partition,
                "offset": msg.offset,
                "payload": msg.value,
            }
            f.write(json.dumps(row) + "\n")
            n += 1
            if n % 50 == 0:
                print(f"  landed {n} events …")
            if n >= args.max_messages:
                break
    consumer.close()
    print(f"Saved {n} events → {out}")
    # also write a stable pointer for Spark
    latest = BRONZE_EVENTS / "kafka_events_latest.jsonl"
    if out.exists():
        latest.write_text(out.read_text(encoding="utf-8"), encoding="utf-8")
        print(f"Updated {latest}")


if __name__ == "__main__":
    main()
