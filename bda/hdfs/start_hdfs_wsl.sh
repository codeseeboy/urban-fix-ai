#!/usr/bin/env bash
# Run a single-node Hadoop HDFS cluster natively in WSL, without Docker.
#
# Docker Desktop is unusable on this machine (see ../README.md), so the
# docker-compose namenode/datanode services cannot start. This runs the real
# Hadoop daemons directly.
#
# Note: the usual start-dfs.sh shells into localhost over SSH, which WSL has no
# sshd for by default. We start each daemon directly with `hdfs --daemon start`
# instead, which needs no SSH at all.
#
#   bash hdfs/start_hdfs_wsl.sh start|stop|status|put|ls
set -euo pipefail

HADOOP_VERSION="${HADOOP_VERSION:-3.3.6}"
HADOOP_HOME="$HOME/hadoop-${HADOOP_VERSION}"
HDFS_BASE="$HOME/.urbanfix-hdfs"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAKE_LOCAL="$SCRIPT_DIR/data/lake"
HDFS_LAKE="/urbanfix/lake"

export JAVA_HOME="${JAVA_HOME:-$HOME/jdk17}"
export HADOOP_HOME PATH="$JAVA_HOME/bin:$HADOOP_HOME/bin:$HADOOP_HOME/sbin:$PATH"
export HADOOP_CONF_DIR="$HADOOP_HOME/etc/hadoop"

install_hadoop() {
  [ -d "$HADOOP_HOME" ] && return 0
  echo "Downloading Hadoop $HADOOP_VERSION (large, ~700MB) ..."
  cd "$HOME"
  curl -fL --retry 3 -o hadoop.tgz \
    "https://archive.apache.org/dist/hadoop/common/hadoop-${HADOOP_VERSION}/hadoop-${HADOOP_VERSION}.tar.gz"
  tar xzf hadoop.tgz && rm hadoop.tgz
  echo "Installed to $HADOOP_HOME"
}

configure() {
  mkdir -p "$HDFS_BASE/name" "$HDFS_BASE/data"
  cat > "$HADOOP_CONF_DIR/core-site.xml" <<XML
<?xml version="1.0"?>
<configuration>
  <property><name>fs.defaultFS</name><value>hdfs://localhost:9000</value></property>
  <property><name>hadoop.tmp.dir</name><value>$HDFS_BASE/tmp</value></property>
</configuration>
XML
  cat > "$HADOOP_CONF_DIR/hdfs-site.xml" <<XML
<?xml version="1.0"?>
<configuration>
  <property><name>dfs.replication</name><value>1</value></property>
  <property><name>dfs.namenode.name.dir</name><value>file://$HDFS_BASE/name</value></property>
  <property><name>dfs.datanode.data.dir</name><value>file://$HDFS_BASE/data</value></property>
  <property><name>dfs.permissions.enabled</name><value>false</value></property>
</configuration>
XML
  grep -q "^export JAVA_HOME=" "$HADOOP_CONF_DIR/hadoop-env.sh" \
    || echo "export JAVA_HOME=$JAVA_HOME" >> "$HADOOP_CONF_DIR/hadoop-env.sh"
}

start_hdfs() {
  install_hadoop
  configure
  if [ ! -d "$HDFS_BASE/name/current" ]; then
    echo "Formatting namenode ..."
    "$HADOOP_HOME/bin/hdfs" namenode -format -force -nonInteractive >/dev/null 2>&1
  fi
  # Start each daemon in its OWN session. `hdfs --daemon start` forks, but the
  # child stays in this shell's session, so when the wsl.exe invocation that
  # launched it exits, the daemon gets SIGHUP and dies:
  #     ERROR NameNode: RECEIVED SIGNAL 1: SIGHUP  ->  SHUTDOWN_MSG
  # setsid detaches it from the controlling terminal so it survives.
  setsid "$HADOOP_HOME/bin/hdfs" --daemon start namenode </dev/null >/dev/null 2>&1 || true
  setsid "$HADOOP_HOME/bin/hdfs" --daemon start datanode </dev/null >/dev/null 2>&1 || true

  for _ in $(seq 1 30); do
    if "$HADOOP_HOME/bin/hdfs" dfsadmin -report >/dev/null 2>&1; then
      echo "HDFS is UP  (namenode hdfs://localhost:9000, web UI http://localhost:9870)"
      "$HADOOP_HOME/bin/hdfs" dfs -mkdir -p "$HDFS_LAKE" 2>/dev/null || true
      "$HADOOP_HOME/bin/hdfs" dfsadmin -report 2>/dev/null | head -12
      return 0
    fi
    sleep 2
  done
  echo "HDFS did not come up. Check $HADOOP_HOME/logs/"; exit 1
}

case "${1:-start}" in
  start) start_hdfs ;;
  stop)  "$HADOOP_HOME/bin/hdfs" --daemon stop datanode || true
         "$HADOOP_HOME/bin/hdfs" --daemon stop namenode || true
         echo "HDFS stopped." ;;
  status) jps 2>/dev/null | grep -E "NameNode|DataNode" || echo "HDFS not running" ;;
  put)   # mirror the local lake into HDFS
         "$HADOOP_HOME/bin/hdfs" dfs -mkdir -p "$HDFS_LAKE"
         for layer in bronze silver gold; do
           echo "uploading $layer ..."
           "$HADOOP_HOME/bin/hdfs" dfs -put -f "$LAKE_LOCAL/$layer" "$HDFS_LAKE/" 2>&1 | tail -2
         done
         "$HADOOP_HOME/bin/hdfs" dfs -du -h "$HDFS_LAKE" ;;
  ls)    "$HADOOP_HOME/bin/hdfs" dfs -ls -R "$HDFS_LAKE" | head -40 ;;
  *) echo "usage: $0 {start|stop|status|put|ls}"; exit 2 ;;
esac
