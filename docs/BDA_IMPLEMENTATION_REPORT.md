# UrbanFix.AI 2.0 — BDA Data Fusion: Implementation Report

What was built, what it uses, and what it measured.
Companion to `UrbanFix_AI_BDA_Data_Fusion_Presentation_CivicGrid.pdf`.

---

## 1. The question

> Do civic complaints in a ward surge after heavy rain, and at what lag?

**Measured answer:** yes — complaints rise to **4.59x** a ward's dry-day baseline
**48 hours** after rainfall above 45 mm, and 48h is the peak of the lag curve.

---

## 2. The honesty rule (read this first)

| Input | Real or simulated |
|---|---|
| Rainfall | **REAL** — Open-Meteo / ERA5 reanalysis, Mumbai, 2024 |
| Ward master | **REAL** — 24 BMC wards, 2011 Census populations |
| Civic reports | **SIMULATED** — 19,282 rows, every one tagged `is_simulated` |
| Road-damage images | **SIMULATED** — 120 synthetic images (RDD2022-shaped) |

The generator couples complaint volume to the **real** rainfall series with a lag.
The Spark fusion job measures that relationship **independently** and never reads
the generator's parameters. The correlation is *recovered*, not asserted.

Two files are quarantined from the pipeline and used only for scoring:

| File | Read only by |
|---|---|
| `data/reference/_generator_params.json` | humans |
| `data/reference/_ground_truth_clusters.csv` | `scripts/verify_dedup.py` |

---

## 3. Big data concepts, and where each one actually lives

| Concept | Where it is implemented | Status |
|---|---|---|
| **Apache Spark** (batch) | `spark/01`–`06` | Working |
| **Distributed joins** | `06_fusion.py` — ward-day joined to rainfall | Working |
| **Spark windows** | rolling 48h rain, lag columns, label propagation | Working |
| **Broadcast join** | `assign_nearest_ward` — 24 centroids broadcast | Working |
| **Graph processing** | duplicate clustering: 136k-edge graph + label propagation | Working |
| **Data fusion** | `06_fusion.py` — join on (ward, date) | Working |
| **Tiered data lake** | bronze / silver / gold | Working |
| **Columnar storage** | Parquet, partitioned by year/month | Working, 71.6% smaller |
| **Data veracity** | 5 rules + quarantine + vocabulary normalisation | Working |
| **Apache Kafka** | `kafka/` producer + consumer, KRaft mode in WSL | **Working, 1,299 ev/s** |
| **Structured Streaming** | `spark/07_stream_pulse.py` — 30-min sliding window | **Working** |
| **HDFS** | Real Hadoop 3.3.6 cluster; Spark reads and writes it | **Working** |
| **5 V's** | see section 8 | Covered |

---

## 4. Architecture

```
REAL rainfall (Open-Meteo)  --+
REAL ward master (BMC)      --+
SIMULATED civic reports     --+--> Kafka topics --> BRONZE (JSONL)
                                                        |
                                           05_events_silver.py
                                     align . ward . veracity . dedup
                                                        |
                                                SILVER (Parquet)
                                                        |
                                                06_fusion.py
                                     aggregate . COMBINE . analyse
                                                        |
                                          GOLD  ward_date_fused_gold
                                            |                  |
                                    charts / dashboard   07_stream_pulse
```

Two spines meet at `(ward_id, date)`:

- **Image spine** (`01`, `03`) — RDD2022-style metadata, cleaning, before/after.
- **Civic spine** (`05`, `06`) — the fusion core.

---

## 5. What was built

### Reference data

| File | Purpose |
|---|---|
| `scripts/build_ward_master.py` | 24 real BMC wards + centroids + nearest rainfall station |
| `scripts/fetch_rainfall.py` | Real rainfall from Open-Meteo; checks station independence |

### Data generation

| File | Purpose |
|---|---|
| `scripts/generate_civic_history.py` | 19,282 rain-coupled reports at `issue_reports` grain |
| `scripts/generate_sample_dataset.py` | 120 synthetic road-damage images (pre-existing) |

### Spark jobs

| File | Stage |
|---|---|
| `spark/common.py` | shared schemas, haversine, ward assignment, duplicate clustering |
| `spark/01_ingest_metadata.py` | images to bronze |
| `spark/02_eda.py` | EDA + charts |
| `spark/03_clean.py` | images to silver |
| `spark/04_analytics.py` | gold analytics |
| **`spark/05_events_silver.py`** | **align, ward, veracity, dedup** |
| **`spark/06_fusion.py`** | **THE fusion join, lag analysis, CVI** |
| `spark/07_stream_pulse.py` | Structured Streaming live surge alert |

### Infrastructure

| File | Purpose |
|---|---|
| `kafka/start_kafka_wsl.sh` | Apache Kafka in KRaft mode, no Docker, no Zookeeper |
| `hdfs/start_hdfs_wsl.sh` | Single-node HDFS, direct daemons, no SSH |
| `run_bda.sh` | One-command pipeline runner |
| `dashboards/app.py` | Streamlit viewer over the gold tables |
| `scripts/verify_dedup.py` | Scores dedup against ground truth |

---

## 6. Measured results

### Rainfall (real)

5 independent stations x 366 days = 1,830 station-days.

| Station | Annual mm | Monsoon share (Jun-Sep) |
|---|---|---|
| COLABA | 2876.1 | 94.7% |
| SANTACRUZ | 2523.7 | 94.2% |
| CHEMBUR | 2540.3 | 94.1% |
| BORIVALI | 2480.5 | 93.9% |
| MULUND | 2409.9 | 92.5% |

An ANDHERI station was **dropped**: it sat 2.7 km from SANTACRUZ, inside the same
ERA5 grid cell (~11 km), and returned a byte-identical series. `fetch_rainfall.py`
now checks station independence on every download.

### Veracity (bronze to silver)

| Rule | Rows |
|---|---|
| bronze reports | 19,282 |
| rejected: GPS accuracy > 100 m | 583 |
| rejected: outside Mumbai bbox | 191 |
| rejected: outside analysis window | 62 |
| **silver reports** | **18,455** |
| quarantined as `UNKNOWN_WARD` | 976 |
| department vocabularies | **11 to 7** |

### Deduplication

136,257 graph edges produced 5,163 incidents from 18,455 reports
(**3.574** reports per incident).

Scored against ground truth:

| Metric | Value |
|---|---|
| Pairwise **precision** | **1.0000** |
| Pairwise recall | 0.9467 |
| F1 | 0.9726 |
| Incidents exactly recovered | 91.3% |
| Incidents wrongly merged | **0.0%** |

Precision 1.0 means it never merged two genuinely different incidents — the right
bias for a municipal work queue.

### Fusion — the headline

8,784 ward-days (24 wards x 366 days, complete grid).

| Lag after rain >45 mm | Complaint surge vs dry-day baseline |
|---|---|
| 24h | 3.89x |
| **48h** | **4.59x  <-- peak** |
| 72h | 4.09x |

The 48h peak is **emergent**, not hardcoded: rainfall autocorrelation across
consecutive days means the measured ratios do not mirror the generator's lag
weights. An independent pandas implementation produced 3.95 / 4.65 / 4.10 and
attributed exactly the same 17,479 reports — a clean cross-validation.

### Most vulnerable wards (CVI)

`CVI = 0.50*surge + 0.35*recurrence + 0.15*drainage deficit`

| Rank | Ward | Name | 48h surge | Recurrence | CVI | Tier |
|---|---|---|---|---|---|---|
| 1 | M/W | Chembur | 6.27x | 15 | 0.835 | CRITICAL |
| 2 | D | Grant Road / Malabar Hill | 5.85x | 15 | 0.831 | CRITICAL |
| 3 | L | Kurla | 5.18x | 18 | 0.803 | CRITICAL |
| 4 | B | Sandhurst Road / Dongri | 6.23x | 12 | 0.784 | CRITICAL |

### Storage

| Layer | Size | |
|---|---|---|
| bronze JSONL | 9.81 MB | |
| silver Parquet | 2.79 MB | **71.6% smaller (3.52x)** |

Conservative: silver carries *more* columns than bronze.

### Kafka (measured)

Real Apache Kafka 3.7.2 broker in KRaft mode (no Zookeeper, no Docker), 4 topics
x 3 partitions.

| Metric | Value |
|---|---|
| Events produced | 4,000 |
| Wall time | 3.08 s |
| **Throughput** | **1,299 events/sec** |
| Events landed in bronze by the consumer | 4,000 (no loss) |

Single broker, single unbatched producer, `acks=1`, reading JSONL off the slow
`/mnt/c` mount. A tuned multi-producer setup would be higher — but 1,299/sec is
what this configuration actually did.

Re-running the silver job with BOTH on-disk shapes present (the generator's bare
JSON and the consumer's `{topic, partition, offset, payload}` envelope) still
produced exactly 19,282 bronze reports, confirming the unwrap-and-dedupe path.

### HDFS (measured)

A real single-node Hadoop 3.3.6 cluster, run natively in WSL - no Docker, and no
SSH either (the usual `start-dfs.sh` shells into localhost; these daemons are
started directly instead).

| Property | Value |
|---|---|
| NameNode | `hdfs://localhost:9000`, web UI `:9870` |
| Configured capacity | 1006.85 GB |
| Filesystem objects | 258 files and directories, 200 blocks |
| Lake on HDFS | bronze 18.3 MB, silver 2.6 MB, gold 677 KB |
| fsck status | **HEALTHY, 0% under-replicated** |

With `URBANFIX_LAKE=hdfs`, Spark reads silver from HDFS and writes
`ward_date_fused_gold` back as snappy Parquet with a `_SUCCESS` marker. The
results are **identical to local mode** (17,479 reports, 8,784 ward-days, 4.59x
at 48h), which is the point: the storage layer is swappable without touching the
analysis.

Three real bugs had to be fixed to get there, all worth knowing:

1. **Daemons died on SIGHUP.** `hdfs --daemon start` forks but stays in the
   caller's session, so the daemons were killed the moment the launching shell
   exited (`RECEIVED SIGNAL 1: SIGHUP`). Fixed with `setsid`.
2. **Reference CSVs resolved against HDFS.** Once `fs.defaultFS` is HDFS, every
   bare path is an HDFS path, so the local ward/rainfall CSVs were looked up at
   `hdfs://localhost:9000/mnt/c/...` and failed. They now use an explicit
   `file://` scheme via `config.local_uri()`.
3. **Blocks were under-replicated.** Spark does not read the cluster's
   `hdfs-site.xml`; it asked for replication 3 against one DataNode, leaving 40%
   of blocks under-replicated. Fixed with `spark.hadoop.dfs.replication=1`.

### Idempotency (regression check)

The pipeline was re-run after pushing a further 5,000 civic reports through
Kafka and landing them in bronze as a second, differently-shaped copy of records
already present. Every downstream figure was byte-identical:

| Metric | Before | After |
|---|---|---|
| bronze reports | 19,282 | 19,282 |
| silver reports | 18,455 | 18,455 |
| distinct incidents | 5,163 | 5,163 |
| surge @ 48h | 4.59x | 4.59x |
| dedup precision / recall | 1.0000 / 0.9467 | 1.0000 / 0.9467 |

Re-ingesting the same logical events does not inflate any count. That is the
property a replayable lake needs, and it is worth stating: a pipeline that
double-counts on replay would quietly manufacture a rain correlation.

### Structured Streaming (measured)

30-minute window, 5-minute slide, 10-minute watermark, alert threshold 20.

| Category | Events in window | Severe |
|---|---|---|
| roads | 888 | 217 |
| trash | 871 | 247 |
| lighting | 515 | 150 |
| water | 300 | 92 |
| parks | 215 | 60 |
| other | 153 | 35 |
| unclassified | 58 | 17 |

Note: `countDistinct` is illegal on a streaming DataFrame (Spark cannot hold
unbounded distinct state per window), so the streaming job uses
`approx_count_distinct` (HyperLogLog). That is why the streaming column is named
`approx_distinct` and the batch one is exact.

### Image spine

120 images to 100 clean (6 corrupt, 8 missing labels, 6 exact duplicates).

---

## 7. Deck corrections

| Slide claim | Verdict |
|---|---|
| "3.8x surge at 48h" | **4.59x** measured. Direction and lag correct. |
| "75% Parquet savings" | **71.6%** measured. Close. |
| "45 photos to 3 craters" | Real ratio is **3.57 reports per incident**. Relabel as illustrative. |
| "10K events/sec" | **1,299 events/sec** measured on one broker. Roughly 8x optimistic. |
| "Saves up to 35%" / "40% of road budgets" | **Unsupported. Cite a source or cut.** |
| "Millions of reports" (slide 8) | Contradicts slide 12. Actual: **19,282**. |
| Partition by year/month/**ward** | Ward dropped: 288 partitions x ~60 rows is a small-files anti-pattern. |
| Point-in-polygon ward mapping | Nearest-centroid + 5 km cutoff. |

Add a visible "simulated civic data" marker — slide 8's own Simulation
Transparency rule requires it.

---

## 8. The 5 V's

| V | Where |
|---|---|
| **Volume** | 19,282 reports x 1,830 station-days, joined to 8,784 ward-days |
| **Velocity** | Kafka topics + Structured Streaming 30-min sliding window |
| **Variety** | JSONL events, CSV rainfall, Parquet tables, JPEG + VOC XML |
| **Veracity** | 5 rules, `UNKNOWN_WARD` quarantine, 11 to 7 vocabularies, scored dedup |
| **Value** | Ranked pre-monsoon repair priorities (CVI) |

---

## 9. Known limitations — state these in the viva

1. **Ward attribution is nearest-centroid**, not point-in-polygon. 5 km cutoff;
   976 reports quarantined as `UNKNOWN_WARD` rather than dropped.
2. **Dedup recall is 0.947, not 1.0.** The generator scatters duplicates up to
   ~13 m from the parent, so two can sit ~26 m apart — beyond the 15 m edge
   threshold. Widening the radius would raise recall and cost precision.
3. **Civic reports are simulated.** Rainfall is not.
4. **Rainfall resolution is capped by the ERA5 grid** (~11 km), so Mumbai
   supports 5 independent series, not 24.
5. **Drainage capacity and road length are estimates**, which is why the drainage
   term carries the smallest CVI weight (0.15).
6. **Spark runs under WSL, not Windows** — the Windows JVM on this machine cannot
   create an NIO Selector. See `bda/README.md`.

---

## 10. Running it

```bash
MSYS_NO_PATHCONV=1 wsl -d Ubuntu -- bash /mnt/c/Work/Projects/FullStackAI/UrbanFix/bda/run_bda.sh all
```

Stages: `reference | generate | images | fusion | reports`.

| Component | Command |
|---|---|
| Dashboard (Windows) | `.venv/Scripts/streamlit.exe run dashboards/app.py` |
| Kafka | `bash kafka/start_kafka_wsl.sh start` |
| Streaming | `python spark/07_stream_pulse.py` |
| HDFS | `bash hdfs/start_hdfs_wsl.sh start`, then `put`, then `URBANFIX_LAKE=hdfs` |

---

## 11. The application stack

The BDA layer is independent of the app, but both now run.

| Service | Port | State |
|---|---|---|
| Backend API (Express + Supabase) | 5000 | Running |
| Municipal admin (Next.js 16) | 3000 | Running |
| Citizen app (Expo web) | 8081 | Running |
| AI service (FastAPI + CUDA) | 8000 | Running |
| BDA dashboard (Streamlit) | 8502 | Running |

`tools/verify_stack.py` checks every service and then re-scores real citizen
photos from the live database through the AI service, comparing today's verdict
against the one stored when the report was filed.

### What the live database confirmed

41 real issues, 15 with photos, 41 with coordinates. And, importantly, the
department-vocabulary problem is real, not a simulation artefact:

```
Electrical, Electricity, General, Horticulture, PWD, Parks,
Public Works, Roads, Sanitation, Water, Water Supply
```

**11 distinct values in one free-text column.** `DEPT_NORMALIZATION` in
`bda/config.py` collapses all 11 onto 6 canonical departments. `Public Works`
was only discovered by running against production data — it was missing from the
map built off the source code alone.

### The optional YOLO track, honestly

`scripts/yolo_on_clean.py` scores YOLO over the cleaned silver images. On the
**synthetic** sample set it detects nothing at all, and says so loudly: those
images are coloured rectangles drawn with PIL, so a detector trained on real
road damage correctly finds no potholes. The 69% "agreement" only counts images
where both sides said "no pothole" and must not be quoted as accuracy.

For a real number, run it against RDD2022 photographs or the live app's own
uploads.
