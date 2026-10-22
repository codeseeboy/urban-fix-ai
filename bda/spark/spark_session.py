"""Create a local SparkSession for UrbanFix BDA jobs."""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import HDFS_NAMENODE, LAKE_MODE  # noqa: E402


def _on_wsl() -> bool:
    """True when running under WSL, where the repo is on a slow /mnt/c mount."""
    if os.name != "posix":
        return False
    try:
        return "microsoft" in Path("/proc/version").read_text().lower()
    except OSError:
        return False


def get_spark(app_name: str = "UrbanFix-BDA", packages: list[str] | None = None):
    """
    Build the local SparkSession.

    `packages` are Maven coordinates pulled on first run (the Kafka connector
    needs this). They are cached in ~/.ivy2, so the first streaming run needs
    network access but later runs work offline.
    """
    from pyspark.sql import SparkSession

    # Point Spark's Python workers at the interpreter actually running this
    # job. Defaulting to bare "python" breaks inside a venv, where the driver
    # is .venv/bin/python but workers would pick up the system interpreter and
    # fail to import pyspark.
    os.environ.setdefault("PYSPARK_PYTHON", sys.executable)
    os.environ.setdefault("PYSPARK_DRIVER_PYTHON", sys.executable)

    builder = (
        SparkSession.builder.appName(app_name)
        .master("local[*]")
        .config("spark.driver.memory", "3g")
        .config("spark.sql.shuffle.partitions", "8")
        .config("spark.ui.showConsoleProgress", "true")
        # Keep timestamp parsing strict and predictable across Spark versions.
        .config("spark.sql.legacy.timeParserPolicy", "CORRECTED")
    )

    # Shuffle and spill scratch must live on native disk. Under WSL the repo
    # sits on /mnt/c (DrvFs), where Spark's many small temp writes and renames
    # are an order of magnitude slower than ext4.
    if _on_wsl():
        scratch = Path(tempfile.gettempdir()) / "urbanfix-spark"
        scratch.mkdir(parents=True, exist_ok=True)
        builder = builder.config("spark.local.dir", str(scratch))

    if packages:
        builder = builder.config("spark.jars.packages", ",".join(packages))

    if LAKE_MODE == "hdfs":
        builder = builder.config("spark.hadoop.fs.defaultFS", HDFS_NAMENODE)
        # Spark ships its own hadoop defaults and does NOT read the cluster's
        # hdfs-site.xml, so it asks for replication 3. Against a single-DataNode
        # cluster every block it writes is then permanently under-replicated
        # (fsck reported 40% before this was set). The client's request wins, so
        # it has to be set here.
        builder = builder.config("spark.hadoop.dfs.replication", "1")

    spark = builder.getOrCreate()
    spark.sparkContext.setLogLevel("WARN")
    return spark
