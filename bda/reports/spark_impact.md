# How Spark improved UrbanFix data processing

## Before (raw)
- Images: 120
- Corrupt: 6
- Missing/invalid labels: 14

## After (Spark cleaning)
- Images kept: 100
- Corrupt remaining: 0
- Missing/invalid labels remaining: 0

## Why Spark (BDA relevance)
1. **Scalable metadata scan** — paths, sizes, labels joined without loading all pixels into one machine process.
2. **Distributed aggregations** — country, class, corruption, duplicate MD5, resolution buckets.
3. **Reproducible lake layers** — bronze (raw) → silver (clean) → gold (analytics) as Parquet/CSV.
4. **Fits Kafka + HDFS architecture** — Spark consumes lake files landed from the Kafka consumer.

Kafka handles the live UrbanFix event stream; HDFS/local lake stores history;
Spark turns that history into cleaning decisions and city dashboards.
