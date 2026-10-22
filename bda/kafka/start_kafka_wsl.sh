#!/usr/bin/env bash
# Run Apache Kafka natively in WSL, without Docker.
#
# Docker Desktop is unusable on this machine (stale AF_UNIX socket reparse
# points - see ../README.md), so the docker-compose Kafka service cannot start.
# This runs the real Apache Kafka broker directly instead, in KRaft mode, so
# there is no Zookeeper to manage either.
#
#   bash kafka/start_kafka_wsl.sh start|stop|status|topics
set -euo pipefail

KAFKA_VERSION="${KAFKA_VERSION:-3.7.2}"
SCALA_VERSION="2.13"
KAFKA_NAME="kafka_${SCALA_VERSION}-${KAFKA_VERSION}"
KAFKA_HOME="$HOME/$KAFKA_NAME"
LOG_DIR="$HOME/.urbanfix-kafka/logs"
DATA_DIR="$HOME/.urbanfix-kafka/data"

export JAVA_HOME="${JAVA_HOME:-$HOME/jdk17}"
export PATH="$JAVA_HOME/bin:$PATH"

TOPICS=(
  urbanfix.issue.created
  urbanfix.issue.ai_verdict
  urbanfix.issue.status_changed
  urbanfix.weather.daily
)

install_kafka() {
  [ -d "$KAFKA_HOME" ] && return 0
  echo "Downloading Apache Kafka $KAFKA_VERSION ..."
  cd "$HOME"
  curl -fL --retry 3 -o kafka.tgz \
    "https://archive.apache.org/dist/kafka/${KAFKA_VERSION}/${KAFKA_NAME}.tgz"
  tar xzf kafka.tgz && rm kafka.tgz
  echo "Installed to $KAFKA_HOME"
}

start_kafka() {
  [ -x "$JAVA_HOME/bin/java" ] || { echo "No JDK at $JAVA_HOME"; exit 1; }
  install_kafka
  mkdir -p "$LOG_DIR" "$DATA_DIR"

  if pgrep -f "kafka.Kafka" >/dev/null 2>&1; then
    echo "Kafka already running."; return 0
  fi

  local cfg="$DATA_DIR/server.properties"
  if [ ! -f "$cfg" ]; then
    cp "$KAFKA_HOME/config/kraft/server.properties" "$cfg"
    sed -i "s#^log.dirs=.*#log.dirs=$DATA_DIR/kraft-logs#" "$cfg"
    # Single-node dev broker: one replica is all we can have.
    {
      echo "offsets.topic.replication.factor=1"
      echo "transaction.state.log.replication.factor=1"
      echo "transaction.state.log.min.isr=1"
      echo "auto.create.topics.enable=true"
    } >> "$cfg"
  fi

  if [ ! -f "$DATA_DIR/kraft-logs/meta.properties" ]; then
    local uuid
    uuid="$("$KAFKA_HOME/bin/kafka-storage.sh" random-uuid)"
    "$KAFKA_HOME/bin/kafka-storage.sh" format -t "$uuid" -c "$cfg" --ignore-formatted
  fi

  echo "Starting Kafka broker (KRaft, no Zookeeper) ..."
  nohup "$KAFKA_HOME/bin/kafka-server-start.sh" "$cfg" \
    > "$LOG_DIR/kafka.log" 2>&1 &

  for _ in $(seq 1 60); do
    if "$KAFKA_HOME/bin/kafka-broker-api-versions.sh" \
         --bootstrap-server localhost:9092 >/dev/null 2>&1; then
      echo "Kafka is UP on localhost:9092"
      create_topics
      return 0
    fi
    sleep 2
  done
  echo "Kafka did not come up. Last log lines:"; tail -25 "$LOG_DIR/kafka.log"; exit 1
}

create_topics() {
  for t in "${TOPICS[@]}"; do
    "$KAFKA_HOME/bin/kafka-topics.sh" --bootstrap-server localhost:9092 \
      --create --if-not-exists --topic "$t" \
      --partitions 3 --replication-factor 1 >/dev/null
  done
  echo "Topics ready (3 partitions each):"
  "$KAFKA_HOME/bin/kafka-topics.sh" --bootstrap-server localhost:9092 --list | sed 's/^/  /'
}

case "${1:-start}" in
  start)  start_kafka ;;
  stop)   "$KAFKA_HOME/bin/kafka-server-stop.sh" 2>/dev/null || pkill -f kafka.Kafka || true
          echo "Kafka stopped." ;;
  status) if pgrep -f "kafka.Kafka" >/dev/null; then echo "Kafka RUNNING"; else echo "Kafka not running"; fi ;;
  topics) create_topics ;;
  *) echo "usage: $0 {start|stop|status|topics}"; exit 2 ;;
esac
