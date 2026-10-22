"""
Shared paths and constants for the UrbanFix BDA mini-project.
"""
import os
from pathlib import Path

BDA_ROOT = Path(__file__).resolve().parent
DATA_ROOT = BDA_ROOT / "data"
RAW_DIR = DATA_ROOT / "raw"
SAMPLE_DIR = DATA_ROOT / "sample"
REFERENCE_DIR = DATA_ROOT / "reference"
LAKE_ROOT = DATA_ROOT / "lake"

BRONZE_EVENTS = LAKE_ROOT / "bronze" / "events"
BRONZE_IMAGES = LAKE_ROOT / "bronze" / "image_metadata"
BRONZE_WEATHER = LAKE_ROOT / "bronze" / "weather"
SILVER_CLEAN = LAKE_ROOT / "silver" / "cleaned_images"
SILVER_EVENTS = LAKE_ROOT / "silver" / "events_clean"
GOLD_ANALYTICS = LAKE_ROOT / "gold" / "analytics"
GOLD_FUSION = LAKE_ROOT / "gold" / "fusion"
REPORTS_DIR = BDA_ROOT / "reports"
FIGURES_DIR = REPORTS_DIR / "figures"

# Reference (dimension) tables — committed so the demo runs offline.
WARD_MASTER_CSV = REFERENCE_DIR / "ward_master.csv"
RAINFALL_CSV = REFERENCE_DIR / "rainfall_daily.csv"

KAFKA_BOOTSTRAP = "localhost:9092"
KAFKA_TOPICS = [
    "urbanfix.issue.created",
    "urbanfix.issue.ai_verdict",
    "urbanfix.issue.status_changed",
    "urbanfix.weather.daily",
]

# ──────────────────────────────────────────────────────────────────────────
# Lake location. Default is the local filesystem so the pipeline always runs
# on a laptop; set URBANFIX_LAKE=hdfs to point Spark at the docker-compose
# Hadoop cluster instead. Only Spark reads/writes go through lake_uri() —
# matplotlib figures and markdown reports always stay local.
# ──────────────────────────────────────────────────────────────────────────
LAKE_MODE = os.environ.get("URBANFIX_LAKE", "local").strip().lower()
HDFS_NAMENODE = os.environ.get("HDFS_NAMENODE", "hdfs://localhost:9000")
HDFS_LAKE_ROOT = "/urbanfix/lake"


def lake_uri(path: Path) -> str:
    """
    Resolve a lake Path to a URI Spark can write to.

    In 'local' mode this is just the absolute path. In 'hdfs' mode the part of
    the path below data/lake is re-rooted onto the Hadoop cluster, so the same
    bronze/silver/gold layout appears in both places.
    """
    path = Path(path)
    if LAKE_MODE != "hdfs":
        return str(path)
    try:
        relative = path.resolve().relative_to(LAKE_ROOT.resolve())
    except ValueError:
        # Outside the lake (e.g. a reference CSV) — keep it local.
        return str(path)
    return f"{HDFS_NAMENODE}{HDFS_LAKE_ROOT}/{relative.as_posix()}"


def local_uri(path: Path) -> str:
    """
    Force a path to be read from the LOCAL filesystem, whatever the lake mode.

    Once spark.hadoop.fs.defaultFS points at HDFS, Spark resolves every bare
    path against HDFS - so a reference CSV sitting on local disk is looked up as
    hdfs://localhost:9000/mnt/c/... and fails. The reference tables are inputs
    to the lake, not part of it, so they always need an explicit file:// scheme.
    """
    return "file://" + Path(path).resolve().as_posix()


# ──────────────────────────────────────────────────────────────────────────
# Rainfall stations. Real Mumbai locations; daily precipitation is pulled
# from the Open-Meteo historical archive by scripts/fetch_rainfall.py.
# Each ward is attributed to its nearest station, so rainfall varies across
# the city instead of being a single city-wide number per day.
#
# Station count is bounded by the source grid, not by how many points we ask
# for. Open-Meteo serves ERA5/ERA5-Land at roughly 0.1 degree (~11 km), so two
# stations closer than that return an IDENTICAL series. An earlier ANDHERI
# station (19.1136, 72.8697) was dropped for exactly this reason — it sat in
# the same cell as SANTACRUZ, 2.7 km away, and added no spatial variation.
# fetch_rainfall.py re-checks this on every download.
# ──────────────────────────────────────────────────────────────────────────
RAINFALL_STATIONS = [
    {"station_id": "COLABA", "name": "Colaba", "lat": 18.9067, "lon": 72.8147},
    {"station_id": "SANTACRUZ", "name": "Santacruz", "lat": 19.0896, "lon": 72.8656},
    {"station_id": "BORIVALI", "name": "Borivali", "lat": 19.2307, "lon": 72.8567},
    {"station_id": "CHEMBUR", "name": "Chembur", "lat": 19.0522, "lon": 72.9005},
    {"station_id": "MULUND", "name": "Mulund", "lat": 19.1726, "lon": 72.9425},
]

# One full annual cycle: pre-monsoon, monsoon, post-monsoon and dry season.
RAINFALL_START = "2024-01-01"
RAINFALL_END = "2024-12-31"

# ──────────────────────────────────────────────────────────────────────────
# Vocabularies mirrored from the production app. Do not invent values here —
# these must match what the real system can actually emit.
#   CATEGORIES      ai-service/app/models.py
#   STATUS_VALUES   backend/supabase_migration.sql (issues.status CHECK)
#   SEVERITY_VALUES backend/supabase_migration.sql (issues.ai_severity CHECK)
# ──────────────────────────────────────────────────────────────────────────
CATEGORIES = ["roads", "trash", "water", "lighting", "parks", "other"]
STATUS_VALUES = ["Submitted", "Acknowledged", "InProgress", "Resolved", "Rejected"]
SEVERITY_VALUES = ["Low", "Medium", "High", "Critical"]

# issues.department_tag is free text with no CHECK constraint, and three parts
# of the system write three different vocabularies into it:
#   ai-service/app/pipeline.py          -> PWD, Electrical, Sanitation, ...
#   backend/services/ai/index.js        -> same, plus Drainage/Safety/...
#   municipal-admin/src/lib/utils.ts    -> Roads, Electricity, Water, ...
#   backend/seed_municipal.js           -> 'Drainage Dept'
# The silver layer collapses them onto the AI service's vocabulary, which is
# the one the pipeline actually produces at write time.
DEPT_NORMALIZATION = {
    "pwd": "PWD",
    "public works": "PWD",
    "public works department": "PWD",
    "roads": "PWD",
    "road": "PWD",
    "electrical": "Electrical",
    "electricity": "Electrical",
    "lighting": "Electrical",
    "sanitation": "Sanitation",
    "trash": "Sanitation",
    "garbage": "Sanitation",
    "water supply": "Water Supply",
    "water": "Water Supply",
    "horticulture": "Horticulture",
    "parks": "Horticulture",
    "drainage": "Drainage",
    "drainage dept": "Drainage",
    "safety": "Safety",
    "security": "Safety",
    "traffic": "Traffic",
    "building": "Building",
    "general": "General",
    "other": "General",
}

# ──────────────────────────────────────────────────────────────────────────
# Veracity thresholds (slide 8 of the team deck).
# ──────────────────────────────────────────────────────────────────────────
MUMBAI_BBOX = {"min_lat": 18.85, "max_lat": 19.30, "min_lon": 72.75, "max_lon": 73.05}
MAX_LOCATION_ACCURACY_M = 100.0   # reject GPS fixes worse than this
MAX_WARD_DISTANCE_KM = 5.0        # beyond this -> UNKNOWN_WARD (quarantine, not drop)
UNKNOWN_WARD = "UNKNOWN_WARD"
DEDUP_RADIUS_M = 15.0             # spatial grid cell for duplicate clustering
DEDUP_WINDOW_HOURS = 24

# Analysis thresholds for the fusion job.
HEAVY_RAIN_MM = 45.0              # "heavy rainfall" threshold for surge analysis
DRY_DAY_MM = 5.0                  # baseline days used as the surge denominator
LAG_HOURS = [24, 48, 72]
CVI_WEIGHTS = {"surge": 0.50, "recurrence": 0.35, "drainage": 0.15}

# RDD2022 damage classes (Pascal VOC style in original dataset)
CLASS_MAP = {
    "D00": "longitudinal_crack",
    "D10": "transverse_crack",
    "D20": "alligator_crack",
    "D40": "pothole",
}

COUNTRY_ZIPS = {
    "India": {
        "url": "https://bigdatacup.s3.ap-northeast-1.amazonaws.com/2022/CRDDC2022/RDD2022/Country_Specific_Data_CRDDC2022/RDD2022_India.zip",
        "mb": 502,
    },
    "Japan": {
        "url": "https://bigdatacup.s3.ap-northeast-1.amazonaws.com/2022/CRDDC2022/RDD2022/Country_Specific_Data_CRDDC2022/RDD2022_Japan.zip",
        "mb": 1023,
    },
    "United_States": {
        "url": "https://bigdatacup.s3.ap-northeast-1.amazonaws.com/2022/CRDDC2022/RDD2022/Country_Specific_Data_CRDDC2022/RDD2022_United_States.zip",
        "mb": 424,
    },
    "Czech": {
        "url": "https://bigdatacup.s3.ap-northeast-1.amazonaws.com/2022/CRDDC2022/RDD2022/Country_Specific_Data_CRDDC2022/RDD2022_Czech.zip",
        "mb": 245,
    },
    "China_MotorBike": {
        "url": "https://bigdatacup.s3.ap-northeast-1.amazonaws.com/2022/CRDDC2022/RDD2022/Country_Specific_Data_CRDDC2022/RDD2022_China_MotorBike.zip",
        "mb": 183,
    },
    "China_Drone": {
        "url": "https://bigdatacup.s3.ap-northeast-1.amazonaws.com/2022/CRDDC2022/RDD2022/Country_Specific_Data_CRDDC2022/RDD2022_China_Drone.zip",
        "mb": 153,
    },
}


def ensure_dirs() -> None:
    for p in [
        RAW_DIR,
        SAMPLE_DIR,
        BRONZE_EVENTS,
        BRONZE_IMAGES,
        BRONZE_WEATHER,
        SILVER_CLEAN,
        SILVER_EVENTS,
        GOLD_ANALYTICS,
        GOLD_FUSION,
        REFERENCE_DIR,
        FIGURES_DIR,
    ]:
        p.mkdir(parents=True, exist_ok=True)
