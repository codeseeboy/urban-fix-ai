"""
Kafka producer: stream UrbanFix civic events into Kafka topics.

Uses sample_events.jsonl if present, otherwise generates live synthetic events.
"""
from __future__ import annotations

import argparse
import json
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from kafka import KafkaProducer
from kafka.errors import NoBrokersAvailable

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import BRONZE_EVENTS, KAFKA_BOOTSTRAP, KAFKA_TOPICS, ensure_dirs  # noqa: E402

TOPIC_MAP = {
    "issue.created": "urbanfix.issue.created",
    "issue.ai_verdict": "urbanfix.issue.ai_verdict",
    "issue.status_changed": "urbanfix.issue.status_changed",
    "weather.daily": "urbanfix.weather.daily",
}

# Event sources, in priority order. civic_history.jsonl is the 20k-report
# stream at issue_reports grain; sample_events.jsonl is the older 325-event
# image-linked stream. --source picks one.
SOURCES = {
    "civic": "civic_history.jsonl",
    "sample": "sample_events.jsonl",
}


def make_producer() -> KafkaProducer:
    return KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP,
        value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        key_serializer=lambda k: (k or "").encode("utf-8"),
        acks=1,
        retries=3,
    )


def load_events(source: str = "civic") -> list[dict]:
    """
    Load the event stream to replay through Kafka.

    Prefers the civic history (20k reports at issue_reports grain). Falls back
    to the older image-linked sample events, then to a tiny synthetic burst so
    the producer still demonstrates streaming with no data on disk.
    """
    candidates = [SOURCES[source]] if source in SOURCES else []
    candidates += [v for k, v in SOURCES.items() if v not in candidates]
    for name in candidates:
        path = BRONZE_EVENTS / name
        if path.exists():
            rows = []
            with open(path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        rows.append(json.loads(line))
            if rows:
                print(f"Replaying {len(rows):,} events from {name}")
                return rows
    # fallback tiny live generator
    now = datetime.now(timezone.utc).isoformat()
    return [
        {
            "event_type": "issue.created",
            "issue_id": f"UF-LIVE-{i}",
            "timestamp": now,
            "ward": f"Ward-{(i % 10) + 1}",
            "category": "roads",
            "has_pothole": random.random() > 0.5,
        }
        for i in range(50)
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rate", type=float, default=0.05, help="Seconds between events")
    parser.add_argument("--limit", type=int, default=0, help="Max events (0=all)")
    parser.add_argument("--loop", action="store_true", help="Replay forever")
    parser.add_argument(
        "--source", choices=["civic", "sample"], default="civic",
        help="civic = 20k issue_reports stream; sample = image-linked events",
    )
    args = parser.parse_args()
    ensure_dirs()

    try:
        producer = make_producer()
    except NoBrokersAvailable:
        print("ERROR: Kafka not reachable at", KAFKA_BOOTSTRAP)
        print("Start it with:  bash kafka/start_kafka_wsl.sh start")
        print("(Docker Desktop is unusable on this machine - see README)")
        sys.exit(1)

    # ensure topics exist by sending a warmup
    for t in KAFKA_TOPICS:
        producer.send(t, key="warmup", value={"event_type": "warmup", "ts": datetime.now(timezone.utc).isoformat()})
    producer.flush()
    print("Connected to Kafka:", KAFKA_BOOTSTRAP)

    events = load_events(args.source)
    print(f"Loaded {len(events)} events")
    sent = 0
    while True:
        for ev in events:
            et = ev.get("event_type", "issue.created")
            topic = TOPIC_MAP.get(et, "urbanfix.issue.created")
            key = ev.get("report_id") or ev.get("issue_id") or "unknown"
            producer.send(topic, key=key, value=ev)
            sent += 1
            if sent % 25 == 0:
                producer.flush()
                print(f"  sent {sent:,} ... last topic={topic} key={key}")
            if args.limit and sent >= args.limit:
                producer.flush()
                print(f"Done. Sent {sent} events.")
                return
            time.sleep(args.rate)
        if not args.loop:
            break
    producer.flush()
    print(f"Done. Sent {sent} events.")


if __name__ == "__main__":
    main()
