"""
Fetch real daily rainfall for the UrbanFix BDA fusion layer.

Source: Open-Meteo Historical Weather archive (https://open-meteo.com/).
Free, no API key, CC-BY-4.0 attribution. Underlying data is ERA5 reanalysis.

Pulls one full annual cycle for each station in config.RAINFALL_STATIONS and
writes:
  data/reference/rainfall_daily.csv            committed, so the demo runs offline
  data/lake/bronze/weather/rainfall_raw.jsonl  the lake landing zone

This is the ONLY genuinely external dataset in the project. Civic reports are
simulated; rainfall is real. Keep it that way — the whole fusion argument rests
on the environmental side being real measurements rather than something we
invented to match the complaints.

Usage:
  python scripts/fetch_rainfall.py           # cached; no-op if the CSV exists
  python scripts/fetch_rainfall.py --force   # re-download
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
import time
from pathlib import Path

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import (  # noqa: E402
    BRONZE_WEATHER,
    RAINFALL_CSV,
    RAINFALL_END,
    RAINFALL_START,
    RAINFALL_STATIONS,
    REFERENCE_DIR,
    ensure_dirs,
)

ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
FIELDNAMES = ["station_id", "date", "precipitation_mm", "precipitation_hours"]
TIMEOUT_S = 60


def fetch_station(station: dict) -> list[dict]:
    """Pull the daily precipitation series for one station."""
    params = {
        "latitude": station["lat"],
        "longitude": station["lon"],
        "start_date": RAINFALL_START,
        "end_date": RAINFALL_END,
        "daily": "precipitation_sum,precipitation_hours",
        "timezone": "Asia/Kolkata",
    }
    response = requests.get(ARCHIVE_URL, params=params, timeout=TIMEOUT_S)
    response.raise_for_status()
    daily = response.json()["daily"]

    rows = []
    for date, mm, hours in zip(
        daily["time"], daily["precipitation_sum"], daily["precipitation_hours"]
    ):
        rows.append(
            {
                "station_id": station["station_id"],
                "date": date,
                # Open-Meteo returns null for gaps; treat as a dry day rather
                # than dropping the row, so every station-day exists.
                "precipitation_mm": round(float(mm), 2) if mm is not None else 0.0,
                "precipitation_hours": round(float(hours), 1) if hours is not None else 0.0,
            }
        )
    return rows


def summarise(rows: list[dict]) -> None:
    """Print a monsoon sanity check — if this looks wrong, the join will too."""
    by_station: dict[str, list[dict]] = {}
    for row in rows:
        by_station.setdefault(row["station_id"], []).append(row)

    print("\n  station      days   total mm   wettest day   monsoon share (Jun-Sep)")
    print("  " + "-" * 68)
    for station_id, station_rows in by_station.items():
        total = sum(r["precipitation_mm"] for r in station_rows)
        wettest = max(station_rows, key=lambda r: r["precipitation_mm"])
        monsoon = sum(
            r["precipitation_mm"]
            for r in station_rows
            if r["date"][5:7] in {"06", "07", "08", "09"}
        )
        share = (monsoon / total * 100) if total else 0.0
        print(
            f"  {station_id:<11} {len(station_rows):>4}   {total:>8.1f}   "
            f"{wettest['precipitation_mm']:>6.1f} on {wettest['date']}   {share:>5.1f}%"
        )

    print(
        "\n  Expect a monsoon share around 85-95% for Mumbai. A low share means "
        "the\n  series is wrong and the lag analysis downstream will be meaningless."
    )

    # Open-Meteo serves ERA5/ERA5-Land on roughly a 0.1 degree (~11 km) grid.
    # Two stations inside one cell return a byte-identical series, which looks
    # like spatial variation in the fused table but is not. Catch it here.
    series = {
        sid: tuple(r["precipitation_mm"] for r in sorted(rows, key=lambda x: x["date"]))
        for sid, rows in by_station.items()
    }
    ids = sorted(series)
    collisions = [
        (a, b)
        for i, a in enumerate(ids)
        for b in ids[i + 1:]
        if series[a] == series[b]
    ]
    if collisions:
        print("\n  WARNING — stations sharing one grid cell (identical series):")
        for a, b in collisions:
            print(f"    {a} == {b}   <-- redundant; drop one from RAINFALL_STATIONS")
        print("  Redundant stations add no spatial variation to the fusion join.")
    else:
        print(f"\n  Station independence: OK — {len(ids)} distinct rainfall series.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--force", action="store_true", help="re-download even if the CSV exists"
    )
    args = parser.parse_args()

    ensure_dirs()
    REFERENCE_DIR.mkdir(parents=True, exist_ok=True)

    if RAINFALL_CSV.exists() and not args.force:
        with RAINFALL_CSV.open(encoding="utf-8") as fh:
            existing = sum(1 for _ in fh) - 1
        print(f"{RAINFALL_CSV} already has {existing} rows. Use --force to re-download.")
        return

    all_rows: list[dict] = []
    for index, station in enumerate(RAINFALL_STATIONS, 1):
        label = f"{station['station_id']} ({station['lat']}, {station['lon']})"
        print(f"[{index}/{len(RAINFALL_STATIONS)}] {label} ...", end=" ", flush=True)
        try:
            rows = fetch_station(station)
        except requests.RequestException as exc:
            print("FAILED")
            print(f"\nCould not reach Open-Meteo: {exc}")
            print("Nothing was written. Check connectivity and retry.")
            sys.exit(1)
        print(f"{len(rows)} days")
        all_rows.extend(rows)
        time.sleep(0.5)  # be polite to a free public API

    with RAINFALL_CSV.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=FIELDNAMES)
        writer.writeheader()
        writer.writerows(all_rows)

    landing = BRONZE_WEATHER / "rainfall_raw.jsonl"
    with landing.open("w", encoding="utf-8") as fh:
        for row in all_rows:
            fh.write(json.dumps(row) + "\n")

    print(f"\nWrote {len(all_rows)} station-days")
    print(f"  reference -> {RAINFALL_CSV}")
    print(f"  bronze    -> {landing}")
    summarise(all_rows)


if __name__ == "__main__":
    main()
