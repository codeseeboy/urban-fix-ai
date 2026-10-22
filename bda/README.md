# UrbanFix.AI 2.0 — BDA Data Fusion Mini Project

Fuses civic reports with **real** Mumbai rainfall and ward data over
Kafka → data lake → Spark, to answer one question:

> Do civic complaints in a ward surge after heavy rain, and at what lag?

## The honesty rule

Rainfall is **real** (Open-Meteo / ERA5). Civic reports are **simulated** and every
row carries `is_simulated = true`.

The generator couples complaint volume to the real rainfall series with a lag.
The Spark fusion job then measures that relationship **independently** — it never
reads the generator's parameters. The correlation is *recovered*, not asserted.

Two files are off-limits to the pipeline and exist only for verification:

| File | Read only by |
|---|---|
| `data/reference/_generator_params.json` | humans |
| `data/reference/_ground_truth_clusters.csv` | `scripts/verify_dedup.py` |

If a Spark job ever imports either, the experiment is void.

## Prerequisites

> **Spark cannot run on the Windows host on this machine.** The JVM there cannot
> create an NIO `Selector` (`Unable to establish loopback connection`), which is a
> Windows socket-subsystem fault, not a Spark problem — see *Troubleshooting*.
> The Spark jobs therefore run under **WSL (Ubuntu)**, which has a working Linux
> JVM. Everything else (data generation, the Streamlit dashboard) runs fine on
> Windows.

### WSL side — runs the Spark jobs

```bash
# JDK 17 (no sudo needed)
mkdir -p ~/jdk17 && cd ~/jdk17
curl -L -o jdk.tar.gz "https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse"
tar xzf jdk.tar.gz --strip-components=1 && rm jdk.tar.gz

# Python env. Debian strips ensurepip, so bootstrap pip manually.
python3 -m venv --without-pip ~/bdavenv
curl -sS https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py
~/bdavenv/bin/python /tmp/get-pip.py
~/bdavenv/bin/python -m pip install "pandas>=2.0,<3.0" "numpy>=1.24,<2.3" matplotlib pyarrow
```

PySpark itself is pure Python plus JARs, so it can be copied from the Windows
venv instead of re-downloaded (~317 MB saved):

```bash
SP=/mnt/c/Work/Projects/FullStackAI/UrbanFix/bda/.venv/Lib/site-packages
cp -r "$SP"/pyspark "$SP"/py4j ~/bdavenv/lib/python3.12/site-packages/
chmod +x ~/bdavenv/lib/python3.12/site-packages/pyspark/bin/*
```

### Windows side — data generation and dashboard

```bash
cd bda
py -3.11 -m venv .venv          # PySpark does not support 3.12+; 3.14 will not work
.venv/Scripts/python.exe -m pip install -r requirements.txt
```

## Run order

Everything, end to end, from Windows:

```bash
MSYS_NO_PATHCONV=1 wsl -d Ubuntu -- bash /mnt/c/Work/Projects/FullStackAI/UrbanFix/bda/run_bda.sh all
```

`MSYS_NO_PATHCONV=1` matters: Git Bash otherwise rewrites `/mnt/c/...` into a
Windows path before `wsl.exe` sees it.

Individual stages: `run_bda.sh {reference|generate|images|fusion|reports}`.

The dashboard runs on Windows against the gold tables:

```bash
.venv/Scripts/streamlit.exe run dashboards/app.py
```

Or, step by step (inside WSL, with `~/bdavenv/bin/python`):

```bash
python scripts/build_ward_master.py       # 24 real BMC wards
python scripts/fetch_rainfall.py          # real rainfall, Open-Meteo
python scripts/generate_civic_history.py  # simulated reports, rain-driven
python spark/01_ingest_metadata.py        # image spine
python spark/03_clean.py
python spark/05_events_silver.py          # align, ward, veracity, dedup
python spark/06_fusion.py                 # THE fusion join + charts
python spark/02_eda.py
python spark/04_analytics.py
python scripts/verify_dedup.py            # dedup accuracy vs ground truth
```

## Lake layout

```
data/
  reference/          ward_master.csv, rainfall_daily.csv   (committed)
  lake/
    bronze/  events/ image_metadata/ weather/               raw, as landed
    silver/  events_clean/ cleaned_images/                  cleaned, typed, Parquet
    gold/    fusion/ analytics/                             fused marts + CSV
```

Set `URBANFIX_LAKE=hdfs` to point Spark at the docker-compose Hadoop cluster
instead of the local filesystem. Default is local so the pipeline always runs
on a laptop.

## Known limitations (state these in the viva)

- **Ward attribution is nearest-centroid, not point-in-polygon.** Real BMC
  boundary geometry is out of scope; 24 centroids plus a 5 km cutoff is the
  sanctioned approximation. Reports beyond the cutoff become `UNKNOWN_WARD` and
  are quarantined, not dropped.
- **Deduplication is grid-snap, not true radius clustering.** Reports a few
  metres apart but across a cell boundary, or hours apart but across a 24 h
  bucket edge, stay separate. `scripts/verify_dedup.py` measures the resulting
  precision/recall instead of hand-waving it.
- **Silver is partitioned by year/month, not year/month/ward.** Adding ward
  would create 12 x 24 = 288 partitions averaging ~60 rows — a small-files
  anti-pattern at this volume.
- **Rainfall resolution is capped by the source grid.** Open-Meteo serves
  ERA5/ERA5-Land at ~0.1 degree (~11 km), so stations closer than that return an
  identical series. An ANDHERI station was dropped for exactly this reason;
  `fetch_rainfall.py` now re-checks station independence on every download.
- **`ward_date_fused_gold` column names** deliberately match the presentation's
  slide 9 verbatim.

## Troubleshooting

**`Did not find winutils.exe`** — a warning, not an error. Spark runs without it
for these jobs.

**`failed to create a child event loop` / `Unable to establish loopback
connection`** — the JVM cannot create an NIO `Selector`, so Spark cannot start.
This is a Windows socket-subsystem fault, not a Spark problem.

Measured on this machine:

| Java call | JDK 17 | JDK 19 |
|---|---|---|
| `ServerSocket` bind + connect | OK | OK |
| `SocketChannel` connect to loopback | OK | OK |
| Manual bind / connect / secret handshake | OK | OK |
| `Pipe.open()` | **FAILS** | OK |
| `Selector.open()` | **FAILS** | **FAILS** |

Plain TCP loopback works and the handshake succeeds when performed by hand. Only
the NIO pipe fails, with `SocketException: Invalid argument: connect` raised from
`UnixDomainSockets.connect0`. The fault is in AF_UNIX, not in TCP.

Docker Desktop fails on the same subsystem:
`remove ...dockerInference: The file cannot be accessed by the system`. Three
stale AF_UNIX socket reparse points under `%LOCALAPPDATA%\Docker\run\` can be
neither opened, renamed nor deleted — even `ls` cannot stat them.

**A reboot did not clear them.** Remaining options, in order:

1. `netsh winsock reset` from an **admin** prompt, then reboot.
2. `sfc /scannow`, then `DISM /Online /Cleanup-Image /RestoreHealth`.
3. Docker Desktop -> *Reset to factory defaults*, and turn off
   **Docker AI / Model Runner**, which is what creates `dockerInference`.

Until then, **run the Spark jobs under WSL** (see *Prerequisites*). WSL uses a
Linux JVM and is unaffected, so the pipeline is not blocked on fixing Windows.

## App (backend / admin / mobile)

`backend/.env` and `ai-service/.env` are populated, and `npm install` succeeds in
`backend/` and `municipal-admin/`. The API starts and serves `GET /`.

**The Supabase project no longer exists.** `SUPABASE_URL` points at
`xwuijkusykpszobxnkmh.supabase.co`, which fails DNS resolution with
`Non-existent domain` (while `supabase.co` itself resolves normally). Every
data route therefore returns `500 Database error: TypeError: fetch failed`.
Free-tier Supabase projects are paused after inactivity and eventually deleted,
which releases the subdomain.

**Resolved** - the project was resumed and every data route now returns real
records (41 issues, 15 with photos, 41 with coordinates).

### Running the whole stack

| Service | Command | Port |
|---|---|---|
| Backend API | `cd backend && node server.js` | 5000 |
| Municipal admin | `cd municipal-admin && npm run dev` | 3000 |
| Citizen app (web) | `cd frontend && npx expo start --web` | 8081 |
| AI service | `cd ai-service && python -m uvicorn app.main:app --port 8000` | 8000 |
| BDA dashboard | `cd bda && .venv/Scripts/streamlit.exe run dashboards/app.py` | 8502 |

Verify everything at once, including re-scoring real citizen photos through the
AI service:

```bash
python tools/verify_stack.py --images 8
```

### Signing in

Both web apps gate on authentication. An admin account already exists in the
database (`admin@urbanfix.com`, role `admin`), so nothing needs creating. If the
password is unknown, reset it with the script the project already ships:

```bash
cd backend && node scripts/resetAdminPassword.js admin@urbanfix.com <new-password>
```

Do NOT run `npm run seed` against this database to get an account: it skips
existing users, but it also inserts demo issues, comments and notifications
alongside the 41 real reports.

None of this affects the BDA pipeline, which runs entirely on generated data
plus the real rainfall archive.
