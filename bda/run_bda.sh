#!/usr/bin/env bash
# Run the UrbanFix BDA pipeline under WSL.
#
# Spark cannot start on the Windows host: the JVM cannot create an NIO
# Selector there ("Unable to establish loopback connection"), which is a
# Windows socket-subsystem fault, not a Spark problem. See README.md.
# WSL gives a Linux JVM where this works.
#
# Usage (from Windows):
#   MSYS_NO_PATHCONV=1 wsl -d Ubuntu -- bash /mnt/c/Work/.../bda/run_bda.sh all
#   ... run_bda.sh fusion     # just 05 + 06
set -euo pipefail

export JAVA_HOME="${JAVA_HOME:-$HOME/jdk17}"
export PATH="$JAVA_HOME/bin:$PATH"
PY="${PY:-$HOME/bdavenv/bin/python}"
BDA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$BDA_DIR"

[ -x "$JAVA_HOME/bin/java" ] || { echo "No JDK at $JAVA_HOME"; exit 1; }
[ -x "$PY" ]                 || { echo "No python at $PY"; exit 1; }

stage() { echo; echo "======== $* ========"; }
run()   { echo "--> $*"; "$PY" "$@"; }

TARGET="${1:-all}"

case "$TARGET" in
  reference)
    stage "Reference data"
    run scripts/build_ward_master.py
    run scripts/fetch_rainfall.py
    ;;
  generate)
    stage "Simulated civic history"
    run scripts/generate_civic_history.py --target-reports 20000
    ;;
  images)
    stage "Image spine"
    run scripts/generate_sample_dataset.py
    run spark/01_ingest_metadata.py
    run spark/03_clean.py
    ;;
  fusion)
    stage "Civic spine - silver + fusion"
    run spark/05_events_silver.py
    run spark/06_fusion.py
    run scripts/verify_dedup.py
    ;;
  kafka)
    stage "Kafka - stream civic reports through the broker"
    bash "$BDA_DIR/kafka/start_kafka_wsl.sh" start
    echo "--> consumer (background, lands into bronze)"
    "$PY" kafka/consumer_to_lake.py --max-messages 5000 --timeout-ms 30000 &
    CONSUMER_PID=$!
    sleep 3
    echo "--> producer"
    "$PY" kafka/producer_simulate_events.py --source civic --rate 0 --limit 5000
    wait $CONSUMER_PID || true
    ;;
  stream)
    stage "Structured Streaming - live city pulse"
    bash "$BDA_DIR/kafka/start_kafka_wsl.sh" start
    "$PY" spark/07_stream_pulse.py --threshold 20 --window 30 --timeout 90 &
    STREAM_PID=$!
    sleep 45
    "$PY" kafka/producer_simulate_events.py --source civic --rate 0 --limit 3000 || true
    wait $STREAM_PID || true
    ;;
  hdfs)
    stage "HDFS - real Hadoop lake"
    bash "$BDA_DIR/hdfs/start_hdfs_wsl.sh" start
    bash "$BDA_DIR/hdfs/start_hdfs_wsl.sh" put
    bash "$BDA_DIR/hdfs/start_hdfs_wsl.sh" ls
    ;;
  reports)
    stage "EDA + analytics"
    run spark/02_eda.py
    run spark/04_analytics.py
    ;;
  all)
    "$0" reference
    "$0" generate
    "$0" images
    "$0" fusion
    "$0" reports
    stage "DONE"
    echo "figures: $BDA_DIR/reports/figures"
    echo "gold:    $BDA_DIR/data/lake/gold"
    ;;
  *)
    echo "usage: $0 {reference|generate|images|fusion|reports|kafka|stream|hdfs|all}"; exit 2 ;;
esac
