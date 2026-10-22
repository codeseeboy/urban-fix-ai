"""
Download RDD2022 country packs for the UrbanFix BDA mini-project.

Examples:
  python scripts/download_rdd2022.py --countries India,Czech
  python scripts/download_rdd2022.py --countries India,Japan,United_States --extract
  python scripts/download_rdd2022.py --list
"""
from __future__ import annotations

import argparse
import sys
import zipfile
from pathlib import Path

import requests
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import COUNTRY_ZIPS, RAW_DIR, ensure_dirs  # noqa: E402


def download_file(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 1_000_000:
        print(f"  skip (exists): {dest.name}")
        return
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        total = int(r.headers.get("content-length", 0))
        with open(dest, "wb") as f, tqdm(
            total=total, unit="B", unit_scale=True, desc=dest.name
        ) as bar:
            for chunk in r.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
                    bar.update(len(chunk))


def extract_zip(zip_path: Path, out_dir: Path) -> None:
    print(f"  extracting {zip_path.name} …")
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(out_dir)


def main() -> None:
    parser = argparse.ArgumentParser(description="Download RDD2022 packs")
    parser.add_argument(
        "--countries",
        default="India,Czech",
        help="Comma-separated country keys (default: India,Czech ~750MB)",
    )
    parser.add_argument("--extract", action="store_true", help="Unzip after download")
    parser.add_argument("--list", action="store_true", help="List available packs")
    args = parser.parse_args()

    ensure_dirs()
    if args.list:
        for name, meta in COUNTRY_ZIPS.items():
            print(f"  {name:20s} ~{meta['mb']} MB")
        return

    names = [c.strip() for c in args.countries.split(",") if c.strip()]
    total_mb = 0
    for name in names:
        if name not in COUNTRY_ZIPS:
            print(f"Unknown country '{name}'. Use --list")
            sys.exit(1)
        total_mb += COUNTRY_ZIPS[name]["mb"]

    print(f"Downloading {len(names)} packs (~{total_mb} MB) into {RAW_DIR}")
    for name in names:
        meta = COUNTRY_ZIPS[name]
        dest = RAW_DIR / f"RDD2022_{name}.zip"
        print(f"\n==> {name}")
        download_file(meta["url"], dest)
        if args.extract:
            extract_zip(dest, RAW_DIR / name)

    print("\nDone. Raw data at:", RAW_DIR)
    print("Next: python scripts/generate_sample_dataset.py  (if you want a tiny demo set)")
    print("Then: python spark/01_ingest_metadata.py")


if __name__ == "__main__":
    main()
