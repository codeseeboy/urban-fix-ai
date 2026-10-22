"""
Spark job 01 — Ingest image + annotation metadata into bronze lake (Parquet).

Scans data/sample (default) or data/raw RDD2022 folders.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import BRONZE_IMAGES, CLASS_MAP, RAW_DIR, SAMPLE_DIR, ensure_dirs  # noqa: E402
from spark.spark_session import get_spark  # noqa: E402


IMG_EXTS = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}


def find_image_roots(source: str) -> list[Path]:
    if source == "sample":
        return [SAMPLE_DIR / "images"]
    roots = []
    # RDD country packs often: raw/India/.../train/images or images/
    for p in RAW_DIR.rglob("*"):
        if p.is_dir() and p.name.lower() in {"images", "jpeg", "jpg"}:
            roots.append(p)
    if not roots and (SAMPLE_DIR / "images").exists():
        print("No raw images found — falling back to sample/")
        return [SAMPLE_DIR / "images"]
    return roots


def find_annotation_for(image_path: Path) -> Path | None:
    stem = image_path.stem
    # common layouts: annotations/, labels/, xmls/ next to images or under parent
    candidates = [
        image_path.parent.parent / "annotations" / f"{stem}.xml",
        image_path.parent.parent / "Annotations" / f"{stem}.xml",
        image_path.parent.parent / "labels" / f"{stem}.xml",
        image_path.parent / "annotations" / f"{stem}.xml",
        SAMPLE_DIR / "annotations" / f"{stem}.xml",
    ]
    # also search nearby
    for parent in list(image_path.parents)[:4]:
        for folder in ("annotations", "Annotations", "xmls", "labels"):
            cand = parent / folder / f"{stem}.xml"
            candidates.append(cand)
    for c in candidates:
        if c.exists():
            return c
    # YOLO txt
    for parent in list(image_path.parents)[:4]:
        for folder in ("labels", "Labels"):
            cand = parent / folder / f"{stem}.txt"
            if cand.exists():
                return cand
    return None


def parse_annotation(ann_path: Path | None) -> dict:
    if ann_path is None:
        return {
            "has_label": False,
            "label_path": None,
            "label_format": None,
            "num_objects": 0,
            "classes": "",
            "has_pothole": False,
            "label_valid": False,
        }
    if ann_path.suffix.lower() == ".txt":
        lines = [ln.strip() for ln in ann_path.read_text(encoding="utf-8", errors="ignore").splitlines() if ln.strip()]
        classes = []
        for ln in lines:
            parts = ln.split()
            if parts:
                classes.append(parts[0])
        return {
            "has_label": True,
            "label_path": str(ann_path),
            "label_format": "yolo",
            "num_objects": len(lines),
            "classes": ",".join(classes),
            "has_pothole": "3" in classes or "pothole" in ",".join(classes).lower(),
            "label_valid": True,
        }
    try:
        root = ET.parse(ann_path).getroot()
        names = [o.findtext("name") for o in root.findall("object")]
        names = [n for n in names if n]
        return {
            "has_label": True,
            "label_path": str(ann_path),
            "label_format": "voc_xml",
            "num_objects": len(names),
            "classes": ",".join(names),
            "has_pothole": any(n == "D40" or n.lower() == "pothole" for n in names),
            "label_valid": True,
        }
    except Exception:
        return {
            "has_label": True,
            "label_path": str(ann_path),
            "label_format": "voc_xml",
            "num_objects": 0,
            "classes": "",
            "has_pothole": False,
            "label_valid": False,
        }


def image_row(path: Path) -> dict:
    ann = find_annotation_for(path)
    ann_info = parse_annotation(ann)
    row = {
        "image_path": str(path.resolve()),
        "filename": path.name,
        "stem": path.stem,
        "ext": path.suffix.lower(),
        "size_bytes": path.stat().st_size if path.exists() else 0,
        "country": path.stem.split("_")[0] if "_" in path.stem else "unknown",
        "width": None,
        "height": None,
        "format": None,
        "is_corrupt": True,
        "md5": None,
        **ann_info,
    }
    try:
        data = path.read_bytes()
        row["md5"] = hashlib.md5(data).hexdigest()
        with Image.open(path) as im:
            im.verify()
        with Image.open(path) as im:
            row["width"], row["height"] = im.size
            row["format"] = im.format
            row["is_corrupt"] = False
    except Exception:
        row["is_corrupt"] = True
    return row


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=["sample", "raw"], default="sample")
    args = parser.parse_args()
    ensure_dirs()

    roots = find_image_roots(args.source)
    images: list[Path] = []
    for root in roots:
        if not root.exists():
            continue
        for p in root.rglob("*"):
            if p.is_file() and p.suffix in IMG_EXTS:
                images.append(p)
    print(f"Found {len(images)} images under {[str(r) for r in roots]}")
    if not images:
        print("No images. Run: python scripts/generate_sample_dataset.py")
        sys.exit(1)

    rows = [image_row(p) for p in images]
    spark = get_spark("UrbanFix-Ingest")
    df = spark.createDataFrame(rows)
    out = BRONZE_IMAGES / "metadata_raw"
    df.write.mode("overwrite").parquet(str(out))
    # also CSV for easy report paste
    df.coalesce(1).write.mode("overwrite").option("header", True).csv(str(BRONZE_IMAGES / "metadata_raw_csv"))
    print(f"Wrote bronze image metadata → {out}")
    print(f"Rows: {df.count()}")
    df.groupBy("is_corrupt", "has_label").count().show()
    spark.stop()


if __name__ == "__main__":
    main()
