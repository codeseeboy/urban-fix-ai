"""
08 — Spark MLlib: forecast ward complaints from rainfall.

Question: given rain today and over the last few days, how many incidents will a
ward log? This turns the fusion finding (complaints peak ~48h after heavy rain)
into a model the municipality can run against a weather forecast.

  READ     gold/fusion/ward_date_fused_gold   (ward × date, real rain + incidents)
           reference/ward_master              (drainage capacity)
  FEATURES ward, rain on day d, d-1, d-2, d-3, 2-day total, month, monsoon flag,
           ward drainage capacity
  SPLIT    blocked hold-out — every 5th ISO week is test. Whole weeks are held
           out so a test day's lagged rain never sits in the training set as a
           neighbouring row of the same storm.
  MODELS   RandomForestRegressor and LinearRegression, compared against a
           per-ward mean baseline (what a planner would guess without the data).
  WRITE    gold/ml/forecast_metrics.json      RMSE / MAE / R² per model
           gold/ml/feature_importance.csv     RF importances
           gold/ml/test_predictions.csv       citywide actual vs predicted (test days)
           gold/ml/scenario_predictions.csv   ward × rain scenario × horizon
           gold/ml/rf_model/                  the fitted pipeline (MLlib format)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from pyspark.ml import Pipeline
from pyspark.ml.evaluation import RegressionEvaluator
from pyspark.ml.feature import OneHotEncoder, StringIndexer, VectorAssembler
from pyspark.ml.regression import LinearRegression, RandomForestRegressor
from pyspark.sql import Window, functions as F

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import GOLD_FUSION, LAKE_ROOT, WARD_MASTER_CSV, lake_uri  # noqa: E402
from spark.spark_session import get_spark  # noqa: E402

GOLD_ML = LAKE_ROOT / "gold" / "ml"
RAIN_SCENARIOS = [0.0, 10.0, 25.0, 45.0, 65.0, 100.0, 150.0]
HORIZONS = [0, 1, 2, 3]
NUMERIC = ["rain_d0", "rain_d1", "rain_d2", "rain_d3", "rain_2d", "month", "is_monsoon", "drainage_capacity"]
LABEL = "complaint_count"


def build_features(df):
    w = Window.partitionBy("ward_id").orderBy("calendar_date")
    out = df.withColumn("rain_d0", F.col("total_rainfall_mm"))
    for k in (1, 2, 3):
        out = out.withColumn(f"rain_d{k}", F.coalesce(F.lag("total_rainfall_mm", k).over(w), F.lit(0.0)))
    return (
        out.withColumn("rain_2d", F.col("rain_d0") + F.col("rain_d1"))
        .withColumn("month", F.month("calendar_date").cast("double"))
        .withColumn("is_monsoon", F.when(F.col("month").between(6, 9), 1.0).otherwise(0.0))
        .withColumn("week", F.weekofyear("calendar_date"))
    )


def metrics(pred, col="prediction"):
    ev = RegressionEvaluator(labelCol=LABEL, predictionCol=col)
    return {m: round(ev.setMetricName(m).evaluate(pred), 4) for m in ("rmse", "mae", "r2")}


def main():
    spark = get_spark("UrbanFix-MLlib-Forecast")
    GOLD_ML.mkdir(parents=True, exist_ok=True)

    gold = spark.read.parquet(lake_uri(GOLD_FUSION / "ward_date_fused_gold")).fillna(0)
    wards = (
        spark.read.option("header", True).option("inferSchema", True).csv(str(WARD_MASTER_CSV))
        .select("ward_id", F.col("drainage_capacity_mm_hr").cast("double").alias("drainage_capacity"))
    )
    data = build_features(gold.join(wards, "ward_id", "left").fillna({"drainage_capacity": 30.0})).cache()

    train = data.filter(F.col("week") % 5 != 0)
    test = data.filter(F.col("week") % 5 == 0)
    n_train, n_test = train.count(), test.count()
    print(f"train {n_train} ward-days · test {n_test} ward-days (every 5th week held out)")

    indexer = StringIndexer(inputCol="ward_id", outputCol="ward_index", handleInvalid="keep")
    onehot = OneHotEncoder(inputCols=["ward_index"], outputCols=["ward_vec"])

    rf_pipe = Pipeline(stages=[
        indexer,
        VectorAssembler(inputCols=["ward_index", *NUMERIC], outputCol="features"),
        RandomForestRegressor(featuresCol="features", labelCol=LABEL, numTrees=80, maxDepth=8, minInstancesPerNode=5, seed=42),
    ])
    lr_pipe = Pipeline(stages=[
        indexer,
        onehot,
        VectorAssembler(inputCols=["ward_vec", *NUMERIC], outputCol="features"),
        LinearRegression(featuresCol="features", labelCol=LABEL, regParam=0.05, elasticNetParam=0.0),
    ])

    print("Training RandomForestRegressor …")
    rf_model = rf_pipe.fit(train)
    print("Training LinearRegression …")
    lr_model = lr_pipe.fit(train)

    rf_pred = rf_model.transform(test)
    lr_pred = lr_model.transform(test)

    # Baseline: each ward's mean daily incidents in the training data.
    ward_mean = train.groupBy("ward_id").agg(F.avg(LABEL).alias("baseline"))
    base_pred = test.join(ward_mean, "ward_id", "left").fillna({"baseline": 0.0})

    results = {
        "random_forest": metrics(rf_pred),
        "linear_regression": metrics(lr_pred),
        "baseline_ward_mean": metrics(base_pred, "baseline"),
    }
    # Error on the days that matter: heavy rain within the last 3 days.
    wet = F.greatest("rain_d0", "rain_d1", "rain_d2", "rain_d3") >= 45
    results["random_forest_wet_days"] = metrics(rf_pred.filter(wet))
    results["baseline_wet_days"] = metrics(base_pred.filter(wet), "baseline")
    for k, v in results.items():
        print(f"  {k:24s} {v}")

    rf = rf_model.stages[-1]
    feature_names = ["ward", *NUMERIC]
    importances = sorted(
        ({"feature": n, "importance": round(float(i), 4)} for n, i in zip(feature_names, rf.featureImportances.toArray())),
        key=lambda r: -r["importance"],
    )

    best = min(("random_forest", "linear_regression"), key=lambda m: results[m]["rmse"])
    summary = {
        "question": "How many incidents will a ward log, given rain today and the previous 3 days?",
        "split": "blocked hold-out: every 5th ISO week is test",
        "train_rows": n_train,
        "test_rows": n_test,
        "label": LABEL,
        "features": feature_names,
        "models": results,
        "best_model": best,
        "rmse_improvement_vs_baseline": round(1 - results[best]["rmse"] / results["baseline_ward_mean"]["rmse"], 4),
        "wet_day_rmse_improvement_vs_baseline": round(
            1 - results["random_forest_wet_days"]["rmse"] / results["baseline_wet_days"]["rmse"], 4
        ),
        "random_forest_params": {"numTrees": 80, "maxDepth": 8, "minInstancesPerNode": 5},
        "scenario_assumptions": "month = July (monsoon); only the scenario rain is non-zero",
    }
    (GOLD_ML / "forecast_metrics.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    import csv

    with open(GOLD_ML / "feature_importance.csv", "w", newline="", encoding="utf-8") as f:
        wr = csv.DictWriter(f, fieldnames=["feature", "importance"])
        wr.writeheader()
        wr.writerows(importances)

    # Citywide actual vs predicted on test days.
    city = (
        rf_pred.groupBy("calendar_date")
        .agg(F.sum(LABEL).alias("actual"), F.sum("prediction").alias("predicted"), F.avg("rain_d0").alias("rain_mm"))
        .join(base_pred.groupBy("calendar_date").agg(F.sum("baseline").alias("baseline")), "calendar_date")
        .orderBy("calendar_date")
        .toPandas()
    )
    city["calendar_date"] = city["calendar_date"].astype(str)
    city.round(3).to_csv(GOLD_ML / "test_predictions.csv", index=False)

    # Scenario grid: rain R falls on day t; forecast for t + h.
    ward_rows = data.select("ward_id", "drainage_capacity").distinct()
    grid = ward_rows.crossJoin(spark.createDataFrame([(r,) for r in RAIN_SCENARIOS], ["rain_mm"])).crossJoin(
        spark.createDataFrame([(h,) for h in HORIZONS], ["horizon_days"])
    )
    for k in range(4):
        grid = grid.withColumn(f"rain_d{k}", F.when(F.col("horizon_days") == k, F.col("rain_mm")).otherwise(F.lit(0.0)))
    grid = (
        grid.withColumn("rain_2d", F.col("rain_d0") + F.col("rain_d1"))
        .withColumn("month", F.lit(7.0))
        .withColumn("is_monsoon", F.lit(1.0))
    )
    scen = (
        rf_model.transform(grid)
        .select("ward_id", "rain_mm", "horizon_days", F.round("prediction", 3).alias("predicted_incidents"))
        .orderBy("ward_id", "rain_mm", "horizon_days")
        .toPandas()
    )
    scen.to_csv(GOLD_ML / "scenario_predictions.csv", index=False)

    rf_model.write().overwrite().save(lake_uri(GOLD_ML / "rf_model"))
    print(f"best model: {best} · RMSE {results[best]['rmse']} vs baseline {results['baseline_ward_mean']['rmse']}")
    print(f"wrote {GOLD_ML}")
    spark.stop()


if __name__ == "__main__":
    main()
