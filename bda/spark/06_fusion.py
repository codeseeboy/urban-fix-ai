"""
Spark job 06 — DATA FUSION. The core deliverable of the BDA mini project.

Covers stages 04 AGGREGATE, 05 COMBINE and 06 ANALYSE:
  AGGREGATE  roll deduplicated incidents up to a ward-day grain
  COMBINE    join ward-day complaints to real rainfall on (station, date)
  ANALYSE    lag surge ratios, recurrence, and a composite vulnerability index

This is the job that has to answer the project's one question:
  "Do complaints in a ward surge after heavy rain, and at what lag?"

The answer is MEASURED here. scripts/generate_civic_history.py injected a
coupling, but this job never reads the generator's parameters — it only sees
the event stream and the real rainfall series, exactly as it would with
production data.

Reads : silver/events_clean/reports, reference/ward_master.csv,
        reference/rainfall_daily.csv
Writes: gold/fusion/ward_date_fused_gold   (Parquet + CSV)
        gold/fusion/ward_vulnerability     (Parquet + CSV)
        gold/fusion/lag_correlation.json
        reports/figures/fusion_*.png
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
from pyspark.sql import Column, Window, functions as F  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import (  # noqa: E402
    CVI_WEIGHTS,
    DRY_DAY_MM,
    FIGURES_DIR,
    GOLD_ANALYTICS,
    GOLD_FUSION,
    HEAVY_RAIN_MM,
    LAG_HOURS,
    SILVER_EVENTS,
    UNKNOWN_WARD,
    ensure_dirs,
    lake_uri,
)
from spark.common import load_rainfall, load_ward_master  # noqa: E402
from spark.spark_session import get_spark  # noqa: E402

TIER_CRITICAL, TIER_MODERATE, TIER_LOW = "CRITICAL", "MODERATE", "LOW"


def save_fig(name: str) -> Path:
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    path = FIGURES_DIR / name
    plt.tight_layout()
    plt.savefig(path, dpi=140)
    plt.close()
    print(f"  figure -> {path.name}")
    return path


def main() -> None:
    ensure_dirs()
    GOLD_FUSION.mkdir(parents=True, exist_ok=True)
    spark = get_spark("UrbanFix-Fusion")

    silver_path = lake_uri(SILVER_EVENTS / "reports")
    try:
        reports = spark.read.parquet(silver_path)
    except Exception:
        print(f"Missing silver reports at {silver_path}.")
        print("Run spark/05_events_silver.py first.")
        sys.exit(1)

    wards = load_ward_master(spark)
    rain = load_rainfall(spark)

    # ── AGGREGATE ────────────────────────────────────────────────────────
    # Count DISTINCT incidents, not raw rows. This is what makes the dedup
    # stage matter: without it, one viral pothole photographed 40 times would
    # look like 40 independent failures and manufacture a rain correlation.
    attributed = reports.filter(F.col("ward_id") != UNKNOWN_WARD)
    print(f"\nSilver reports: {reports.count():,}")
    print(f"  ward-attributed: {attributed.count():,}")

    daily = attributed.groupBy("ward_id", F.col("event_date").alias("calendar_date")).agg(
        F.countDistinct("report_group_id").alias("complaint_count"),
        F.count("*").alias("raw_report_count"),
        F.countDistinct(
            F.when(F.col("category") == "roads", F.col("report_group_id"))
        ).alias("road_incidents"),
        F.countDistinct(
            F.when(
                F.col("ai_severity").isin("High", "Critical"), F.col("report_group_id")
            )
        ).alias("severe_incidents"),
    )

    # A complete ward x date grid. Without this, days with zero complaints
    # vanish and the dry-day baseline is computed only over days that had
    # complaints — which would inflate the baseline and crush the surge ratio.
    calendar = rain.select("date").distinct()
    grid = wards.select("ward_id", "station_id", "drainage_capacity_mm_hr").crossJoin(
        calendar
    )

    fused = (
        grid.join(
            daily,
            (grid.ward_id == daily.ward_id) & (grid.date == daily.calendar_date),
            "left",
        )
        .drop(daily.ward_id)
        .drop("calendar_date")
        .withColumnRenamed("date", "calendar_date")
        .fillna(
            {
                "complaint_count": 0,
                "raw_report_count": 0,
                "road_incidents": 0,
                "severe_incidents": 0,
            }
        )
    )

    # ── COMBINE — the fusion join ────────────────────────────────────────
    # Rain is aliased and its join keys renamed up front. Joining on a
    # .select() subset and then dropping by the parent DataFrame's column
    # reference silently drops the wrong column.
    rain_join = rain.select(
        F.col("station_id").alias("r_station_id"),
        F.col("date").alias("r_date"),
        F.col("precipitation_mm").alias("total_rainfall_mm"),
        F.col("precipitation_hours"),
    )
    fused = fused.join(
        F.broadcast(rain_join),
        (F.col("station_id") == F.col("r_station_id"))
        & (F.col("calendar_date") == F.col("r_date")),
        "left",
    ).drop("r_station_id", "r_date")

    ward_days = Window.partitionBy("ward_id").orderBy("calendar_date")
    fused = fused.withColumn(
        "rolling_48h_rain_mm",
        F.round(
            F.sum("total_rainfall_mm").over(ward_days.rowsBetween(-1, 0)), 2
        ),
    )
    for lag in LAG_HOURS:
        fused = fused.withColumn(
            f"rain_lag_{lag}h",
            F.lag("total_rainfall_mm", lag // 24).over(ward_days),
        )

    fused.cache()
    total_ward_days = fused.count()
    print(f"  fused ward-days: {total_ward_days:,}")

    # ── ANALYSE — lag surge ratios ───────────────────────────────────────
    baseline = (
        fused.filter(F.col("total_rainfall_mm") < DRY_DAY_MM)
        .groupBy("ward_id")
        .agg(F.avg("complaint_count").alias("dry_baseline"))
    )

    lag_results: dict[str, float] = {}
    per_ward_surge = None
    for lag in LAG_HOURS:
        wet = (
            fused.filter(F.col(f"rain_lag_{lag}h") > HEAVY_RAIN_MM)
            .groupBy("ward_id")
            .agg(
                F.avg("complaint_count").alias(f"wet_mean_{lag}"),
                F.count("*").alias(f"wet_days_{lag}"),
            )
        )
        joined = wet.join(baseline, "ward_id").withColumn(
            f"surge_{lag}h",
            F.col(f"wet_mean_{lag}") / F.nullif(F.col("dry_baseline"), F.lit(0.0)),
        )
        city = joined.agg(F.avg(f"surge_{lag}h")).collect()[0][0]
        days = joined.agg(F.sum(f"wet_days_{lag}")).collect()[0][0] or 0
        lag_results[f"{lag}h"] = round(float(city), 3) if city else 0.0
        lag_results[f"{lag}h_ward_days"] = int(days)
        print(f"  surge @ {lag}h lag: {lag_results[f'{lag}h']:.2f}x  ({days} ward-days)")

        if lag == 48:
            per_ward_surge = joined.select(
                "ward_id", F.col("surge_48h").alias("surge_ratio_48h"), "dry_baseline"
            )

    peak_lag = max(LAG_HOURS, key=lambda l: lag_results[f"{l}h"])
    lag_results["peak_lag_hours"] = peak_lag
    lag_results["heavy_rain_threshold_mm"] = HEAVY_RAIN_MM
    lag_results["dry_day_threshold_mm"] = DRY_DAY_MM
    print(f"  => peak surge at {peak_lag}h lag")

    # ── ANALYSE — recurrence and the composite vulnerability index ───────
    # Recurrence: on how many distinct heavy-rain events did this ward spike
    # to more than 1.5x its own dry-day baseline?
    recurrence = (
        fused.join(baseline, "ward_id")
        .filter(
            (F.col("rain_lag_48h") > HEAVY_RAIN_MM)
            & (F.col("complaint_count") > F.col("dry_baseline") * 1.5)
        )
        .groupBy("ward_id")
        .agg(F.count("*").alias("recurrence_events"))
    )

    vuln = (
        wards.select("ward_id", "ward_name", "zone", "drainage_capacity_mm_hr")
        .join(per_ward_surge, "ward_id", "left")
        .join(recurrence, "ward_id", "left")
        .fillna({"recurrence_events": 0, "surge_ratio_48h": 0.0})
        .withColumn(
            "drainage_deficit",
            F.greatest(F.lit(0.0), F.lit(50.0) - F.col("drainage_capacity_mm_hr")) / 25.0,
        )
    )

    # Min-max normalise each term, then apply the deck's CVI weights.
    def norm(col: str) -> Column:
        lo = F.min(col).over(Window.partitionBy())
        hi = F.max(col).over(Window.partitionBy())
        return F.when(hi == lo, F.lit(0.0)).otherwise((F.col(col) - lo) / (hi - lo))

    vuln = (
        vuln.withColumn("n_surge", norm("surge_ratio_48h"))
        .withColumn("n_recurrence", norm("recurrence_events"))
        .withColumn("n_drainage", norm("drainage_deficit"))
        .withColumn(
            "cvi",
            F.round(
                CVI_WEIGHTS["surge"] * F.col("n_surge")
                + CVI_WEIGHTS["recurrence"] * F.col("n_recurrence")
                + CVI_WEIGHTS["drainage"] * F.col("n_drainage"),
                4,
            ),
        )
    )

    cvi_window = Window.partitionBy().orderBy(F.col("cvi").desc())
    vuln = (
        vuln.withColumn("cvi_rank", F.row_number().over(cvi_window))
        .withColumn("cvi_pct", F.percent_rank().over(Window.partitionBy().orderBy("cvi")))
        .withColumn(
            "vulnerability_tier",
            F.when(F.col("cvi_pct") >= 0.75, F.lit(TIER_CRITICAL))
            .when(F.col("cvi_pct") >= 0.25, F.lit(TIER_MODERATE))
            .otherwise(F.lit(TIER_LOW)),
        )
        .drop("n_surge", "n_recurrence", "n_drainage", "cvi_pct")
    )

    # ── Write gold ───────────────────────────────────────────────────────
    # ward_date_fused_gold uses the deck's slide-9 column names verbatim.
    gold = (
        fused.join(
            vuln.select("ward_id", "vulnerability_tier", "cvi"), "ward_id", "left"
        )
        .select(
            "ward_id",
            "calendar_date",
            F.round("total_rainfall_mm", 2).alias("total_rainfall_mm"),
            "complaint_count",
            "rolling_48h_rain_mm",
            "vulnerability_tier",
            "raw_report_count",
            "road_incidents",
            "severe_incidents",
            "precipitation_hours",
            "station_id",
            "cvi",
        )
        .orderBy("ward_id", "calendar_date")
    )

    gold.write.mode("overwrite").parquet(lake_uri(GOLD_FUSION / "ward_date_fused_gold"))
    gold_pd = gold.toPandas()
    gold_pd.to_csv(GOLD_FUSION / "ward_date_fused_gold.csv", index=False)

    vuln.write.mode("overwrite").parquet(lake_uri(GOLD_FUSION / "ward_vulnerability"))
    vuln_pd = vuln.orderBy("cvi_rank").toPandas()
    vuln_pd.to_csv(GOLD_FUSION / "ward_vulnerability.csv", index=False)

    (GOLD_FUSION / "lag_correlation.json").write_text(
        json.dumps(lag_results, indent=2), encoding="utf-8"
    )

    # ── Charts ───────────────────────────────────────────────────────────
    print("\n=== FIGURES ===")
    top_ward = vuln_pd.iloc[0]["ward_id"]
    series = gold_pd[gold_pd.ward_id == top_ward].sort_values("calendar_date")

    fig, ax1 = plt.subplots(figsize=(13, 5))
    ax1.bar(series.calendar_date, series.total_rainfall_mm, color="#2A6F7F",
            alpha=0.55, width=1.0, label="Daily rainfall (mm)")
    ax1.set_ylabel("Rainfall (mm)", color="#1B365D")
    ax1.invert_yaxis()
    ax2 = ax1.twinx()
    # Daily counts for a single ward are small (0-7), so the raw line is mostly
    # noise. Keep it faint for honesty and overlay a 7-day rolling mean, which
    # is what actually makes the monsoon relationship readable.
    ax2.plot(series.calendar_date, series.complaint_count, color="#C0392B",
             linewidth=0.7, alpha=0.35, label="Daily incidents")
    ax2.plot(series.calendar_date,
             series.complaint_count.rolling(7, center=True, min_periods=1).mean(),
             color="#C0392B", linewidth=2.4, label="Incidents (7-day mean)")
    ax2.set_ylabel("Incidents", color="#C0392B")
    ax1.set_title(
        f"Ward {top_ward} — rainfall vs civic incidents (2024)\n"
        f"peak surge {lag_results[f'{peak_lag}h']:.2f}x at {peak_lag}h after rain "
        f">{HEAVY_RAIN_MM:.0f}mm   [simulated reports, real rainfall]"
    )
    fig.legend(loc="upper right", bbox_to_anchor=(0.9, 0.86), framealpha=0.9)
    save_fig("fusion_rain_vs_complaints.png")

    plt.figure(figsize=(7, 4.5))
    lags = [f"{l}h" for l in LAG_HOURS]
    vals = [lag_results[l] for l in lags]
    colors = ["#C4A35A" if l != f"{peak_lag}h" else "#1F7A4D" for l in lags]
    bars = plt.bar(lags, vals, color=colors)
    plt.axhline(1.0, color="#8B2E2E", linestyle="--", linewidth=1, label="no effect (1.0x)")
    for bar, val in zip(bars, vals):
        plt.text(bar.get_x() + bar.get_width() / 2, val + 0.05, f"{val:.2f}x",
                 ha="center", fontweight="bold")
    plt.ylabel("Complaint surge vs dry-day baseline")
    plt.title(f"Lag correlation — rainfall >{HEAVY_RAIN_MM:.0f}mm")
    plt.legend()
    save_fig("fusion_lag_correlation.png")

    tier_color = {TIER_CRITICAL: "#8B2E2E", TIER_MODERATE: "#C4A35A", TIER_LOW: "#1F7A4D"}
    plt.figure(figsize=(10, 6))
    plt.barh(
        vuln_pd.ward_id[::-1],
        vuln_pd.cvi[::-1],
        color=[tier_color[t] for t in vuln_pd.vulnerability_tier[::-1]],
    )
    plt.xlabel("Composite Vulnerability Index")
    plt.title("Ward vulnerability ranking (CVI = 0.50 surge + 0.35 recurrence + 0.15 drainage)")
    handles = [plt.Rectangle((0, 0), 1, 1, color=c) for c in tier_color.values()]
    plt.legend(handles, tier_color.keys(), loc="lower right")
    save_fig("fusion_ward_vulnerability.png")

    dedup_csv = GOLD_ANALYTICS / "dedup_audit.csv"
    if dedup_csv.exists():
        import pandas as pd

        dd = pd.read_csv(dedup_csv).sort_values("raw_reports", ascending=False).head(15)
        x = range(len(dd))
        plt.figure(figsize=(11, 5))
        plt.bar([i - 0.2 for i in x], dd.raw_reports, width=0.4,
                label="Raw citizen reports", color="#8B2E2E")
        plt.bar([i + 0.2 for i in x], dd.incidents, width=0.4,
                label="Deduplicated incidents", color="#1F7A4D")
        plt.xticks(list(x), dd.ward_id, rotation=45, ha="right")
        plt.ylabel("Count")
        plt.title("Deduplication impact — reports of one defect collapsed into one incident")
        plt.legend()
        save_fig("fusion_dedup_impact.png")

    print("\n=== TOP 8 WARDS BY CVI ===")
    print(
        vuln_pd[["cvi_rank", "ward_id", "ward_name", "surge_ratio_48h",
                 "recurrence_events", "cvi", "vulnerability_tier"]]
        .head(8)
        .to_string(index=False)
    )
    print(f"\ngold -> {lake_uri(GOLD_FUSION / 'ward_date_fused_gold')}")

    spark.stop()


if __name__ == "__main__":
    main()
