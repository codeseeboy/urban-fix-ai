import sys
from pathlib import Path
from pyspark.sql import functions as F
from pyspark.ml.feature import VectorAssembler, StringIndexer
from pyspark.ml.regression import RandomForestRegressor
from pyspark.ml import Pipeline

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from spark.spark_session import get_spark
from config import GOLD_FUSION


def main():
    spark = get_spark ('UrbanFix-MLlib-Forecast')
    gold_path = str(GOLD_FUSION / 'ward_date_fused_gold')
    print(f"Reading historical gold data from {gold_path}...")
    try:
        df = spark.read.parquet(gold_path).fillna(0)
    except Exception as e:
        print(f"Error: Could not read gold data. Ensure pipeline has generated it.")
        return
        
    indexer = StringIndexer(inputCol='ward_id', outputCol='ward_index', handleInvalid='keep')
    assembler = VectorAssembler(inputCols=['ward_index', 'rainfall_mm'], outputCol='features')
    rf = RandomForestRegressor(featuresCol='features', labelCol='events', numTrees=20, maxDepth=5)
    pipeline = Pipeline(stages=[indexer, assembler, rf])
    
    print("Training Random Forest Model on historical monsoon data...")
    model = pipeline.fit(df)
    
    print("Simulating tomorrows weather forecast (65mm Heavy Rainfall)...")
    wards = df.select('ward_id').distinct()
    future_df = wards.withColumn('rainfall_mm', F.lit(65.0))
    
    predictions = model.transform(future_df)
    
    print("\n=== AI FORECAST: PREDICTED COMPLAINTS FOR TOMORROW (65mm Rain) ===")
    predictions.select(
        'ward_id', 
        'rainfall_mm', 
        F.round('prediction', 0).cast('int').alias('predicted_complaints')
    ).orderBy(F.desc('prediction')).show(10)
    
    spark.stop()

if __name__ == '__main__':
    main() 