"""
Spark job 03 — Clean dataset: drop corrupt, unlabeled, invalid, duplicate images.
Writes silver cleaned metadata + removed_files report.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from pyspark.sql import Window, functions as F

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import BRONZE_IMAGES, GOLD_ANALYTICS, SILVER_CLEAN, ensure_dirs  # noqa: E402
from spark.spark_session import get_spark  # noqa: E402


def main() -> None:
    ensure_dirs()
    spark = get_spark("UrbanFix-Clean")
    src = BRONZE_IMAGES / "metadata_raw"
    if not src.exists():
        print("Missing bronze metadata. Run 01_ingest_metadata.py first.")
        sys.exit(1)

    df = spark.read.parquet(str(src))
    before = df.count()

    # Removal reasons (for report)
    reasons = {
        "corrupt": df.filter(F.col("is_corrupt") == True).count(),  # noqa: E712
        "missing_label": df.filter(
            (F.col("is_corrupt") == False) & (F.col("has_label") == False)  # noqa: E712
        ).count(),
        "invalid_label": df.filter(
            (F.col("is_corrupt") == False)
            & (F.col("has_label") == True)
            & (F.col("label_valid") == False)  # noqa: E712
        ).count(),
    }

    usable = df.filter(
        (F.col("is_corrupt") == False)  # noqa: E712
        & (F.col("has_label") == True)  # noqa: E712
        & (F.col("label_valid") == True)  # noqa: E712
        & F.col("md5").isNotNull()
        & (F.col("num_objects") > 0)
    )

    w = Window.partitionBy("md5").orderBy(F.col("size_bytes").desc(), F.col("filename").asc())
    ranked = usable.withColumn("rn", F.row_number().over(w))
    clean = ranked.filter(F.col("rn") == 1).drop("rn")
    after = clean.count()

    removed = df.join(clean.select("stem"), on="stem", how="left_anti")
    removed_count = removed.count()
    reasons["duplicates_removed"] = max(usable.count() - after, 0)
    reasons["total_removed"] = removed_count

    out = SILVER_CLEAN / "metadata_clean"
    clean.write.mode("overwrite").parquet(str(out))
    removed.write.mode("overwrite").option("header", True).csv(str(SILVER_CLEAN / "removed_files_csv"))
    clean.coalesce(1).write.mode("overwrite").option("header", True).csv(
        str(SILVER_CLEAN / "metadata_clean_csv")
    )

    comparison = {
        "before_count": before,
        "after_count": after,
        "removed_count": removed_count,
        "kept_ratio": round(after / max(before, 1), 4),
        "removal_reasons": reasons,
    }
    GOLD_ANALYTICS.mkdir(parents=True, exist_ok=True)
    (GOLD_ANALYTICS / "clean_comparison.json").write_text(
        json.dumps(comparison, indent=2), encoding="utf-8"
    )

    print("\n=== CLEANING SUMMARY ===")
    print(json.dumps(comparison, indent=2))
    print(f"Silver cleaned metadata → {out}")
    spark.stop()


if __name__ == "__main__":
    main()
