"""
Optional Track 04 — run YOLO over the CLEANED images and score it.

This is the deck's "supporting AI demonstration". The point it proves is a
boundary, not a model: YOLO is a DOWNSTREAM CONSUMER of data the Spark pipeline
already cleaned. Spark prepares data at scale; it does not train detectors.

Reads the silver cleaned-image list (so corrupt, unlabelled and duplicate
images are already gone), runs the detector, and compares its verdict against
the VOC ground-truth labels that came with each image.

WHICH INTERPRETER: run this with the Windows Python that already has
torch + ultralytics installed, NOT the WSL BDA venv — installing torch there
again is a redundant ~2.5 GB download for no benefit.

  python scripts/yolo_on_clean.py --limit 100
"""
from __future__ import annotations

import argparse
import csv
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from config import FIGURES_DIR, GOLD_ANALYTICS, SILVER_CLEAN, ensure_dirs  # noqa: E402

REPO_ROOT = Path(__file__).resolve().parents[2]
WEIGHT_CANDIDATES = [
    REPO_ROOT / "colab2" / "best.pt",
    REPO_ROOT / "ai-service" / "yolov8s-worldv2.pt",
]
OUT_CSV = GOLD_ANALYTICS / "yolo_verification.csv"

WARN_SYNTHETIC = """
  WARNING: the detector found NOTHING in any image.
  scripts/generate_sample_dataset.py draws coloured rectangles with PIL, not
  photographs of roads, so a detector trained on real road damage correctly
  finds nothing in them. The agreement figure above is therefore meaningless -
  it only counts images where both sides said 'no pothole'.

  For a real YOLO number, use real photographs:
    python scripts/download_rdd2022.py --countries Czech --extract
    python spark/01_ingest_metadata.py --source raw
  or score the live app's own uploaded images.
"""


def find_weights(explicit: str | None) -> Path:
    if explicit:
        p = Path(explicit)
        if not p.exists():
            sys.exit(f"weights not found: {p}")
        return p
    for p in WEIGHT_CANDIDATES:
        if p.exists():
            return p
    sys.exit("No YOLO weights found. Pass --weights explicitly.")


def to_native_path(raw: str) -> Path:
    """
    Translate a lake path across the WSL/Windows boundary.

    The Spark jobs run under WSL and record absolute paths like
    /mnt/c/Work/... . This script runs on the Windows interpreter (the one that
    already has torch), where that path does not exist. Map it back to a
    drive-letter path. The reverse case is handled too, so this works from
    either side of the boundary.
    """
    raw = (raw or "").strip()
    if os.name == "nt" and raw.startswith("/mnt/"):
        drive = raw[5]
        return Path(f"{drive.upper()}:/" + raw[7:])
    if os.name != "nt" and len(raw) > 2 and raw[1] == ":":
        return Path(f"/mnt/{raw[0].lower()}/" + raw[3:].replace("\\", "/"))
    return Path(raw)


def load_clean_rows() -> list[dict]:
    """Read the silver cleaned-image manifest (Spark writes a part-*.csv)."""
    csv_dir = SILVER_CLEAN / "metadata_clean_csv"
    if not csv_dir.exists():
        sys.exit(f"{csv_dir} not found. Run spark/03_clean.py first.")
    parts = sorted(csv_dir.glob("*.csv"))
    if not parts:
        sys.exit(f"No CSV part files in {csv_dir}")
    rows: list[dict] = []
    for part in parts:
        with part.open(encoding="utf-8") as fh:
            rows.extend(csv.DictReader(fh))
    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="0 = all clean images")
    parser.add_argument("--weights", default=None)
    parser.add_argument("--conf", type=float, default=0.25)
    args = parser.parse_args()

    ensure_dirs()
    try:
        from ultralytics import YOLO
    except ImportError:
        sys.exit(
            "ultralytics is not installed in THIS interpreter.\n"
            "Run with the Windows Python that already has torch + ultralytics."
        )

    weights = find_weights(args.weights)
    rows = load_clean_rows()
    if args.limit:
        rows = rows[: args.limit]
    print(f"weights : {weights.name}")
    print(f"images  : {len(rows)} (from the SILVER cleaned set)\n")

    model = YOLO(str(weights))
    results = []
    missing = 0
    started = time.time()

    for i, row in enumerate(rows, 1):
        image_path = to_native_path(row["image_path"])
        if not image_path.exists():
            missing += 1
            continue
        preds = model.predict(str(image_path), conf=args.conf, verbose=False)[0]
        names = preds.names
        labels = [names[int(c)] for c in preds.boxes.cls.tolist()] if preds.boxes else []
        confs = [round(float(c), 3) for c in preds.boxes.conf.tolist()] if preds.boxes else []

        # Ground truth came from the VOC annotation alongside the image.
        truth_classes = [c for c in (row.get("classes") or "").split(",") if c]
        truth_pothole = str(row.get("has_pothole", "")).lower() == "true"
        pred_pothole = any("pothole" in l.lower() or l == "D40" for l in labels)

        results.append({
            "stem": row["stem"],
            "filename": row["filename"],
            "truth_objects": len(truth_classes),
            "truth_classes": "|".join(truth_classes),
            "truth_has_pothole": truth_pothole,
            "pred_objects": len(labels),
            "pred_classes": "|".join(labels),
            "pred_has_pothole": pred_pothole,
            "max_confidence": max(confs) if confs else 0.0,
            "agrees_on_pothole": truth_pothole == pred_pothole,
        })
        if i % 20 == 0:
            print(f"  {i}/{len(rows)} ...")

    elapsed = time.time() - started
    if not results:
        sys.exit(
            f"No images processed ({missing} paths did not resolve).\n"
            f"First path in manifest: {rows[0].get('image_path')!r}"
        )
    if missing:
        print(f"  ({missing} image paths did not resolve and were skipped)")

    GOLD_ANALYTICS.mkdir(parents=True, exist_ok=True)
    with OUT_CSV.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=list(results[0]))
        writer.writeheader()
        writer.writerows(results)

    n = len(results)
    agree = sum(r["agrees_on_pothole"] for r in results)
    tp = sum(r["truth_has_pothole"] and r["pred_has_pothole"] for r in results)
    fp = sum((not r["truth_has_pothole"]) and r["pred_has_pothole"] for r in results)
    fn = sum(r["truth_has_pothole"] and (not r["pred_has_pothole"]) for r in results)
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0

    print(f"\n=== YOLO ON CLEANED IMAGES ===")
    print(f"  images scored      : {n}")
    print(f"  wall time          : {elapsed:.1f}s ({n / elapsed:.1f} img/s)")
    print(f"  pothole agreement  : {agree}/{n} ({agree / n * 100:.1f}%)")
    print(f"  precision / recall : {precision:.3f} / {recall:.3f}")
    print(f"  -> {OUT_CSV}")

    total_detections = sum(r["pred_objects"] for r in results)
    if total_detections == 0:
        print(WARN_SYNTHETIC)

    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(7, 4.5))
        bars = ["agree", "false positive", "false negative"]
        vals = [agree, fp, fn]
        ax.bar(bars, vals, color=["#1F7A4D", "#C4A35A", "#8B2E2E"])
        for b, v in zip(bars, vals):
            ax.text(b, v + 0.5, str(v), ha="center", fontweight="bold")
        ax.set_ylabel("Images")
        ax.set_title(
            f"YOLO vs ground truth on {n} CLEANED images\n"
            f"(downstream consumer of the Spark-cleaned silver set)"
        )
        plt.tight_layout()
        out = FIGURES_DIR / "yolo_verification.png"
        plt.savefig(out, dpi=140)
        plt.close()
        print(f"  -> {out}")
    except Exception as exc:  # charting is optional, scoring is not
        print(f"  (chart skipped: {exc})")


if __name__ == "__main__":
    main()
