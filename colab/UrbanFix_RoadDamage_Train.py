# ================================================================
#  UrbanFix AI — Road Damage Detection
#  Model   : YOLOv8m (fine-tuned on RDD2022 + Indian potholes)
#  Classes : longitudinal_crack | transverse_crack |
#            alligator_crack    | pothole
#  Save to : MyDrive/UrbanFix_AI/colab/road_damage_train.ipynb
# ================================================================
#  HOW TO USE:
#  Each block marked  # ══ CELL N ══  is ONE Colab cell.
#  Run them top to bottom, in order, exactly once per session.
# ================================================================


# ══ CELL 1 ══  Environment Check + Drive Mount
# ----------------------------------------------------------------
from google.colab import drive
import subprocess, sys, os, platform, json, time, shutil
from pathlib import Path
import torch

print("=" * 60)
print("  UrbanFix AI — Road Damage Training Pipeline")
print("=" * 60)

# ── GPU check ──────────────────────────────────────────────────
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
if DEVICE == "cuda":
    gpu_name = torch.cuda.get_device_name(0)
    vram_gb  = torch.cuda.get_device_properties(0).total_memory / 1e9
    print(f"\n  ✅  GPU  : {gpu_name}")
    print(f"  ✅  VRAM : {vram_gb:.1f} GB")
    # Recommend batch size based on VRAM
    if vram_gb >= 14:
        RECOMMENDED_BATCH = 32
    elif vram_gb >= 10:
        RECOMMENDED_BATCH = 16
    else:
        RECOMMENDED_BATCH = 8
    print(f"  ✅  Recommended batch size : {RECOMMENDED_BATCH}")
else:
    print("\n  ⚠️  No GPU found — training on CPU will be very slow.")
    print("  Go to Runtime → Change runtime type → GPU → T4")
    RECOMMENDED_BATCH = 4

print(f"\n  Python  : {sys.version[:6]}")
print(f"  PyTorch : {torch.__version__}")
print(f"  CUDA    : {torch.version.cuda if DEVICE == 'cuda' else 'N/A'}")

# ── Mount Drive ────────────────────────────────────────────────
print("\n  Mounting Google Drive …")
drive.mount("/content/drive", force_remount=False)
print("  ✅  Drive mounted")


# ══ CELL 2 ══  Folder Structure Setup
# ----------------------------------------------------------------
# All work lives inside UrbanFix_AI on your Drive.
# Nothing is stored in /content/ permanently (resets each session).
# ----------------------------------------------------------------

BASE   = Path("/content/drive/MyDrive/UrbanFix_AI")
ROADS  = BASE  / "road_damage"          # everything for this model
RAW    = ROADS / "raw"                  # downloaded RDD2022 zip
CONV   = ROADS / "converted"           # after XML → YOLO conversion
FINAL  = ROADS / "dataset"             # final train/val split
RUNS   = ROADS / "runs"                # YOLOv8 training output
EXPORT = ROADS / "export"              # final exported weights
LOGS   = ROADS / "logs"                # plots, reports

for d in [RAW, CONV, FINAL, RUNS, EXPORT, LOGS]:
    d.mkdir(parents=True, exist_ok=True)

print("  Folder structure:")
for d in [BASE, ROADS, RAW, CONV, FINAL, RUNS, EXPORT, LOGS]:
    print(f"    {'✅' if d.exists() else '❌'}  {d.relative_to(BASE.parent.parent)}")


# ══ CELL 3 ══  Install Packages
# ----------------------------------------------------------------
print("Installing packages (takes ~60 s on first run) …")

PKGS = [
    "ultralytics>=8.2.0",   # YOLOv8 — training + validation
    "roboflow",             # optional: download annotated sets
    "pycocotools",          # COCO mAP metrics
    "seaborn",              # confusion matrix plots
    "tqdm",
    "PyYAML",
    "matplotlib",
    "pillow",
    "scikit-learn",
    "pandas",
    "lxml",                 # XML parsing fallback for RDD2022 annotations
    "gdown",                # Google Drive large file download
]

subprocess.check_call(
    [sys.executable, "-m", "pip", "install", "-q", "--upgrade"] + PKGS,
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL
)

# Verify key installs
import ultralytics, yaml, gdown
from ultralytics import YOLO
print(f"  ✅  Ultralytics : {ultralytics.__version__}")
print(f"  ✅  All packages installed")


# ══ CELL 4 ══  Download Datasets via Roboflow  (RECOMMENDED)
# ----------------------------------------------------------------
# Roboflow gives you RDD2022 ALREADY in YOLO format — no XML
# conversion needed.  Plus you can combine multiple datasets
# (RDD2022 + Indian pothole datasets) in one go.
#
# SETUP (one-time, 5 min):
#   1. Sign up free at roboflow.com
#   2. Get your API key: Profile → Roboflow API → Copy key
#   3. Paste it below
#   4. Run this cell — datasets download directly to Colab
#
# After this cell, skip Cell 5-6 (XML conversion) and go to Cell 7.
# ----------------------------------------------------------------
from roboflow import Roboflow
import shutil

# ╔══════════════════════════════════════════════════════════════╗
# ║  PASTE YOUR ROBOFLOW API KEY BELOW                          ║
# ╚══════════════════════════════════════════════════════════════╝
ROBOFLOW_API_KEY = "PASTE_YOUR_KEY_HERE"

USE_ROBOFLOW = (ROBOFLOW_API_KEY != "PASTE_YOUR_KEY_HERE")
ROBOFLOW_DONE = FINAL / ".roboflow_done"

if not USE_ROBOFLOW:
    print("  ⚠️  Roboflow API key not set.")
    print("  → Paste your key above, OR use Cell 4B (manual zip) instead.")

elif ROBOFLOW_DONE.exists():
    print("  ✅  Roboflow datasets already downloaded and merged.")

else:
    rf = Roboflow(api_key=ROBOFLOW_API_KEY)
    DL_DIR = Path("/content/roboflow_downloads")

    # ── Datasets to download ──────────────────────────────────
    # Go to universe.roboflow.com → search each name → click
    # "Download Dataset" → YOLOv8 → "Show Download Code" →
    # copy the workspace/project/version values here.
    #
    # These are common working slugs — if one gives 404,
    # just search for it on Roboflow Universe and update the
    # workspace + project_slug below.
    DATASETS = [
        # (workspace,       project_slug,              version, description)
        ("mkimhi",          "rdd2022",                  1, "RDD2022 global road damage"),
        ("roboflow-100",    "pothole-detection-de9et",  2, "Indian potholes"),
        ("andrea-pinto",    "pothole-image-detection",  3, "Extra pothole variety"),
    ]

    downloaded = []
    for workspace, slug, version, desc in DATASETS:
        print(f"\n  Downloading: {desc} ({slug}) …")
        try:
            project = rf.workspace(workspace).project(slug)
            dataset = project.version(version).download(
                "yolov8", location=str(DL_DIR / slug)
            )
            downloaded.append(Path(dataset.location))
            print(f"  ✅  {slug} — done")
        except Exception as e:
            print(f"  ⚠️  {slug} failed: {e}")
            print(f"      → Search '{slug}' on universe.roboflow.com")
            print(f"      → Update workspace/project/version above")

    # ── Merge all into FINAL ──────────────────────────────────
    print("\n  Merging all datasets …")
    for split in ["train", "val"]:
        (FINAL / "images" / split).mkdir(parents=True, exist_ok=True)
        (FINAL / "labels" / split).mkdir(parents=True, exist_ok=True)

    for dl_path in downloaded:
        for split in ["train", "valid", "val", "test"]:
            target_split = "val" if split in ("valid", "test") else "train"
            for folder in ["images", "labels"]:
                src = dl_path / split / folder
                if not src.exists():
                    continue
                dst = FINAL / folder / target_split
                count = 0
                for f in src.glob("*"):
                    if f.suffix.lower() in {".jpg", ".jpeg", ".png", ".txt"}:
                        shutil.copy2(str(f), str(dst / f.name))
                        count += 1
                if count > 0:
                    print(f"    Copied {count:>5,} files  {target_split}/{folder}  ← {dl_path.name}")

    ROBOFLOW_DONE.touch()

    for split in ["train", "val"]:
        n_imgs = len(list((FINAL / "images" / split).glob("*")))
        n_lbls = len(list((FINAL / "labels" / split).glob("*")))
        print(f"\n  {split.upper()}: {n_imgs:,} images  |  {n_lbls:,} labels")

    print("\n  ✅  All datasets merged. Skip Cell 4B/5/6 → go to Cell 7.")


# ══ CELL 4B ══  (ALTERNATIVE) Manual RDD2022 Zip Download
# ----------------------------------------------------------------
# Only run this if you did NOT use Roboflow in Cell 4 above.
# Upload RDD2022.zip to Drive/UrbanFix_AI/road_damage/raw/
# OR use gdown to download from a Google Drive share link.
# ----------------------------------------------------------------
import zipfile
from tqdm import tqdm

EXTRACTED_MARKER = RAW / ".extracted"
RDD_ROOT = None

if USE_ROBOFLOW and ROBOFLOW_DONE.exists():
    print("  Skipping — Roboflow was used in Cell 4.")
    RDD_ROOT = None
else:
    for candidate in [RAW / "RDD2022", RAW / "rdd2022", RAW / "train"]:
        if candidate.exists():
            RDD_ROOT = candidate
            break

    if EXTRACTED_MARKER.exists() and RDD_ROOT:
        print(f"  ✅  Dataset already extracted at: {RDD_ROOT}")
    else:
        zips = list(RAW.glob("*.zip"))
        if zips:
            zip_path = zips[0]
            print(f"  Found zip: {zip_path.name}  ({zip_path.stat().st_size / 1e9:.2f} GB)")
            print("  Extracting …")
            with zipfile.ZipFile(str(zip_path), "r") as zf:
                zf.extractall(str(RAW))
            EXTRACTED_MARKER.touch()
            print("  ✅  Extracted")
            for candidate in RAW.iterdir():
                if candidate.is_dir() and candidate.name != "__MACOSX":
                    RDD_ROOT = candidate
                    break
        else:
            print("  ⚠️  No RDD2022 zip found in:")
            print(f"       {RAW}")
            print("  Upload RDD2022.zip to that folder, or use Roboflow (Cell 4).")
            RDD_ROOT = None

    if RDD_ROOT:
        print(f"\n  Dataset root : {RDD_ROOT}")
        img_count = len(list(RDD_ROOT.rglob("*.jpg"))) + len(list(RDD_ROOT.rglob("*.png")))
        xml_count = len(list(RDD_ROOT.rglob("*.xml")))
        print(f"  Images found : {img_count:,}")
        print(f"  XML files    : {xml_count:,}")


# ══ CELL 5 ══  XML → YOLO Converter (Core Logic)
# ----------------------------------------------------------------
# Skip this cell if you used Roboflow in Cell 4 (already YOLO format).
# Only needed for manual RDD2022 zip with Pascal VOC XML annotations.
# ----------------------------------------------------------------
import xml.etree.ElementTree as ET
from PIL import Image
import pandas as pd
from collections import defaultdict

# ── Class map — RDD2022 code → our class ID ───────────────────
#   Only these 4 are kept. Any other code → skipped.
RDD_CLASS_MAP = {
    "D00": 0,   # longitudinal_crack
    "D10": 1,   # transverse_crack
    "D20": 2,   # alligator_crack
    "D40": 3,   # pothole
}

CLASS_NAMES = [
    "longitudinal_crack",
    "transverse_crack",
    "alligator_crack",
    "pothole",
]

def parse_rdd_xml(xml_path: Path) -> dict:
    """
    Parse one RDD2022 Pascal-VOC XML file.
    Returns dict with image filename, size, and list of objects.
    """
    try:
        tree = ET.parse(str(xml_path))
        root = tree.getroot()
    except ET.ParseError:
        return None

    filename = root.findtext("filename", default="")
    size_node = root.find("size")
    if size_node is None:
        return None

    width  = int(size_node.findtext("width",  default="0"))
    height = int(size_node.findtext("height", default="0"))

    if width <= 0 or height <= 0:
        return None

    objects = []
    for obj in root.findall("object"):
        name = obj.findtext("name", default="").strip().upper()
        if name not in RDD_CLASS_MAP:
            continue

        bndbox = obj.find("bndbox")
        if bndbox is None:
            continue

        xmin = float(bndbox.findtext("xmin", default="0"))
        ymin = float(bndbox.findtext("ymin", default="0"))
        xmax = float(bndbox.findtext("xmax", default="0"))
        ymax = float(bndbox.findtext("ymax", default="0"))

        # Clamp to image boundaries
        xmin = max(0.0, min(xmin, width))
        ymin = max(0.0, min(ymin, height))
        xmax = max(0.0, min(xmax, width))
        ymax = max(0.0, min(ymax, height))

        if xmax <= xmin or ymax <= ymin:
            continue   # degenerate box — skip

        # Convert to YOLO normalized format
        x_center = ((xmin + xmax) / 2.0) / width
        y_center = ((ymin + ymax) / 2.0) / height
        w        = (xmax - xmin) / width
        h        = (ymax - ymin) / height

        # Final sanity check — all values must be in [0, 1]
        if not all(0.0 <= v <= 1.0 for v in [x_center, y_center, w, h]):
            continue

        objects.append({
            "class_id": RDD_CLASS_MAP[name],
            "class_name": CLASS_NAMES[RDD_CLASS_MAP[name]],
            "x_center": round(x_center, 6),
            "y_center": round(y_center, 6),
            "width":    round(w, 6),
            "height":   round(h, 6),
        })

    return {
        "filename": filename,
        "width"   : width,
        "height"  : height,
        "objects" : objects,
    }


def write_yolo_label(label_path: Path, objects: list):
    """Write YOLO .txt label file for one image."""
    lines = []
    for obj in objects:
        lines.append(
            f"{obj['class_id']} "
            f"{obj['x_center']} "
            f"{obj['y_center']} "
            f"{obj['width']} "
            f"{obj['height']}"
        )
    label_path.write_text("\n".join(lines))


print("✅  Converter functions defined")
print(f"  Class map: {RDD_CLASS_MAP}")
print(f"  Classes  : {CLASS_NAMES}")


# ══ CELL 6 ══  Run Conversion: XML → YOLO Labels
# ----------------------------------------------------------------
# Skip this cell if you used Roboflow (Cell 4).
# Only needed for manual RDD2022 zip with XML annotations.
# ----------------------------------------------------------------

CONV_IMAGES = CONV / "images"
CONV_LABELS = CONV / "labels"
CONV_IMAGES.mkdir(parents=True, exist_ok=True)
CONV_LABELS.mkdir(parents=True, exist_ok=True)

DONE_MARKER = CONV / ".conversion_done"

if ROBOFLOW_DONE.exists():
    print("  ✅  Roboflow was used — skipping XML conversion.")
elif DONE_MARKER.exists():
    print("✅  Conversion already done. Loading stats …")
else:
    if RDD_ROOT is None:
        print("❌  RDD_ROOT is None — run Cell 4 first and extract the dataset.")
    else:
        print(f"  Scanning {RDD_ROOT} for XML files …")

        # Collect all XML files across all subfolders
        all_xmls = sorted(RDD_ROOT.rglob("*.xml"))
        print(f"  Found {len(all_xmls):,} XML files")

        # Stats
        stats = defaultdict(int)
        class_counts  = defaultdict(int)
        skipped_nobox = 0
        skipped_noimg = 0
        converted_ok  = 0
        conversion_log = []

        for xml_path in tqdm(all_xmls, desc="  Converting", unit="file"):
            parsed = parse_rdd_xml(xml_path)
            if parsed is None:
                stats["parse_error"] += 1
                continue

            if not parsed["objects"]:
                # Image has no objects in our 4 classes → skip
                skipped_nobox += 1
                continue

            # ── Find the matching image file ──────────────────
            filename = parsed["filename"]
            if not filename:
                filename = xml_path.stem + ".jpg"

            # Search in same folder and parent folder
            img_path = xml_path.parent / filename
            if not img_path.exists():
                img_path = xml_path.parent.parent / "images" / filename
            if not img_path.exists():
                # Try common extensions
                for ext in [".jpg", ".jpeg", ".png"]:
                    candidate = xml_path.with_suffix(ext)
                    if candidate.exists():
                        img_path = candidate
                        break
            if not img_path.exists():
                skipped_noimg += 1
                continue

            # ── Copy image ────────────────────────────────────
            dest_img = CONV_IMAGES / img_path.name
            if not dest_img.exists():
                shutil.copy2(str(img_path), str(dest_img))

            # ── Write YOLO label ──────────────────────────────
            dest_lbl = CONV_LABELS / (img_path.stem + ".txt")
            write_yolo_label(dest_lbl, parsed["objects"])

            # Update stats
            for obj in parsed["objects"]:
                class_counts[obj["class_name"]] += 1
            converted_ok += 1

        # Save conversion stats
        conv_stats = {
            "total_xml"        : len(all_xmls),
            "converted_ok"     : converted_ok,
            "skipped_no_class" : skipped_nobox,
            "skipped_no_image" : skipped_noimg,
            "class_counts"     : dict(class_counts),
        }
        with open(str(CONV / "conversion_stats.json"), "w") as f:
            json.dump(conv_stats, f, indent=2)

        DONE_MARKER.touch()

        print(f"\n  ── Conversion Summary ──────────────────────────────")
        print(f"  Total XML files     : {len(all_xmls):>6,}")
        print(f"  Converted (ok)      : {converted_ok:>6,}")
        print(f"  Skipped (no class)  : {skipped_nobox:>6,}")
        print(f"  Skipped (no image)  : {skipped_noimg:>6,}")
        print(f"\n  Class distribution:")
        for cls_name in CLASS_NAMES:
            count = class_counts.get(cls_name, 0)
            bar   = "█" * (count // max(max(class_counts.values(), default=1) // 40, 1))
            print(f"    {cls_name:<25} {count:>5,}  {bar}")

# ── Load stats if already converted ───────────────────────────
stats_path = CONV / "conversion_stats.json"
if stats_path.exists():
    with open(str(stats_path)) as f:
        conv_stats = json.load(f)
    n_images = len(list(CONV_IMAGES.glob("*.jpg"))) + \
               len(list(CONV_IMAGES.glob("*.png")))
    n_labels = len(list(CONV_LABELS.glob("*.txt")))
    print(f"\n  Images in converted/ : {n_images:,}")
    print(f"  Labels in converted/ : {n_labels:,}")


# ══ CELL 7 ══  Train / Val Split
# ----------------------------------------------------------------
# If Roboflow was used → data is already split → just show counts.
# If manual zip was used → split converted/ into train/val (80/20).
# ----------------------------------------------------------------
import random
import numpy as np
from sklearn.model_selection import train_test_split

SPLIT_MARKER = FINAL / ".split_done"

for split in ["train", "val"]:
    (FINAL / "images" / split).mkdir(parents=True, exist_ok=True)
    (FINAL / "labels" / split).mkdir(parents=True, exist_ok=True)

if ROBOFLOW_DONE.exists():
    train_imgs = list((FINAL / "images" / "train").glob("*"))
    val_imgs   = list((FINAL / "images" / "val").glob("*"))
    print(f"✅  Roboflow split already in place")
    print(f"  Train : {len(train_imgs):,} images")
    print(f"  Val   : {len(val_imgs):,} images")
elif SPLIT_MARKER.exists():
    train_imgs = list((FINAL / "images" / "train").glob("*"))
    val_imgs   = list((FINAL / "images" / "val").glob("*"))
    print(f"✅  Split already done")
    print(f"  Train : {len(train_imgs):,} images")
    print(f"  Val   : {len(val_imgs):,} images")
else:
    random.seed(42)
    np.random.seed(42)

    # Get all converted image paths that have a matching label
    all_imgs = sorted(CONV_IMAGES.glob("*.jpg")) + \
               sorted(CONV_IMAGES.glob("*.png"))
    paired   = []
    for img in all_imgs:
        lbl = CONV_LABELS / (img.stem + ".txt")
        if lbl.exists() and lbl.stat().st_size > 0:
            paired.append((img, lbl))

    print(f"  Valid image-label pairs : {len(paired):,}")

    if len(paired) == 0:
        print("❌  No valid pairs found. Check conversion output.")
    else:
        # Stratify by majority class in each label file
        def get_majority_class(lbl_path: Path) -> int:
            counts = defaultdict(int)
            for line in lbl_path.read_text().strip().splitlines():
                parts = line.strip().split()
                if parts:
                    counts[int(parts[0])] += 1
            return max(counts, key=counts.get) if counts else 0

        stratify_labels = [get_majority_class(lbl) for _, lbl in paired]

        train_pairs, val_pairs = train_test_split(
            paired,
            test_size    = 0.20,
            random_state = 42,
            stratify     = stratify_labels,
        )

        def copy_pair(pairs, split: str):
            img_dst = FINAL / "images" / split
            lbl_dst = FINAL / "labels" / split
            for img_path, lbl_path in tqdm(pairs, desc=f"  Copying {split}", unit="file"):
                shutil.copy2(str(img_path), str(img_dst / img_path.name))
                shutil.copy2(str(lbl_path), str(lbl_dst / lbl_path.name))

        copy_pair(train_pairs, "train")
        copy_pair(val_pairs,   "val")
        SPLIT_MARKER.touch()

        print(f"\n  Train : {len(train_pairs):,} images  ({len(train_pairs)/len(paired)*100:.0f}%)")
        print(f"  Val   : {len(val_pairs):,} images  ({len(val_pairs)/len(paired)*100:.0f}%)")
        print(f"  Seed  : 42 (reproducible)")


# ══ CELL 8 ══  Dataset Validation + Visual Audit
# ----------------------------------------------------------------
# Before training, verify:
#   1. Every image has a label file  (no orphans)
#   2. Every label has valid YOLO format
#   3. Bounding boxes are sane (not too big, not tiny)
#   4. Class distribution is visible + logged
# ----------------------------------------------------------------
import matplotlib.pyplot as plt
import matplotlib.patches as patches
import seaborn as sns
from PIL import Image, ImageDraw

# Colours for each class
CLASS_COLORS = {
    0: "#FF4444",   # longitudinal_crack  (red)
    1: "#FF9900",   # transverse_crack    (orange)
    2: "#FFDD00",   # alligator_crack     (yellow)
    3: "#3399FF",   # pothole             (blue)
}

def validate_split(split: str) -> dict:
    img_dir = FINAL / "images" / split
    lbl_dir = FINAL / "labels" / split
    imgs    = sorted(list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.png")))

    stats = {
        "total_images"    : len(imgs),
        "missing_labels"  : 0,
        "empty_labels"    : 0,
        "total_objects"   : 0,
        "class_counts"    : defaultdict(int),
        "box_widths"      : [],
        "box_heights"     : [],
        "bad_boxes"       : 0,
    }

    for img_path in imgs:
        lbl_path = lbl_dir / (img_path.stem + ".txt")
        if not lbl_path.exists():
            stats["missing_labels"] += 1
            continue
        content = lbl_path.read_text().strip()
        if not content:
            stats["empty_labels"] += 1
            continue
        for line in content.splitlines():
            parts = line.strip().split()
            if len(parts) != 5:
                stats["bad_boxes"] += 1
                continue
            try:
                cid, xc, yc, w, h = int(parts[0]), *map(float, parts[1:])
            except ValueError:
                stats["bad_boxes"] += 1
                continue
            if not (0 <= xc <= 1 and 0 <= yc <= 1 and 0 < w <= 1 and 0 < h <= 1):
                stats["bad_boxes"] += 1
                continue
            stats["class_counts"][cid] += 1
            stats["box_widths"].append(w)
            stats["box_heights"].append(h)
            stats["total_objects"] += 1

    return stats


print("  Validating dataset …")
train_stats = validate_split("train")
val_stats   = validate_split("val")

for split, s in [("TRAIN", train_stats), ("VAL", val_stats)]:
    print(f"\n  ── {split} ────────────────────────────────────")
    print(f"  Images         : {s['total_images']:>6,}")
    print(f"  Total objects  : {s['total_objects']:>6,}")
    print(f"  Missing labels : {s['missing_labels']:>6,}")
    print(f"  Empty labels   : {s['empty_labels']:>6,}")
    print(f"  Bad boxes      : {s['bad_boxes']:>6,}")
    print(f"  Class breakdown:")
    for cid, name in enumerate(CLASS_NAMES):
        count = s["class_counts"].get(cid, 0)
        pct   = count / max(s["total_objects"], 1) * 100
        bar   = "█" * int(pct / 2)
        print(f"    [{cid}] {name:<25} {count:>5,}  {pct:5.1f}%  {bar}")

# ── Class distribution bar chart ──────────────────────────────
fig, axes = plt.subplots(1, 2, figsize=(14, 5))
for ax, (split, s) in zip(axes, [("Train", train_stats), ("Val", val_stats)]):
    counts = [s["class_counts"].get(i, 0) for i in range(4)]
    bars = ax.bar(CLASS_NAMES, counts,
                  color=[CLASS_COLORS[i] for i in range(4)],
                  edgecolor="white", linewidth=0.8)
    for bar, count in zip(bars, counts):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 10,
                str(count), ha="center", va="bottom", fontsize=9, fontweight="bold")
    ax.set_title(f"{split} — Class Distribution", fontsize=12, fontweight="bold")
    ax.set_ylabel("Object Count")
    ax.set_xticklabels(CLASS_NAMES, rotation=20, ha="right")
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", alpha=0.3)
plt.suptitle("UrbanFix AI — RDD2022 Dataset Validation", fontsize=13, fontweight="bold")
plt.tight_layout()
plt.savefig(str(LOGS / "class_distribution.png"), dpi=150, bbox_inches="tight")
plt.show()
print(f"\n  Chart saved → {LOGS}/class_distribution.png")

# ── Box size distribution ─────────────────────────────────────
if train_stats["box_widths"]:
    fig, axes = plt.subplots(1, 2, figsize=(12, 4))
    axes[0].hist(train_stats["box_widths"],  bins=50, color="#3399FF", alpha=0.8)
    axes[0].set_title("Box Width Distribution (normalized)")
    axes[0].set_xlabel("Width (0–1)"); axes[0].grid(alpha=0.3)
    axes[1].hist(train_stats["box_heights"], bins=50, color="#FF4444", alpha=0.8)
    axes[1].set_title("Box Height Distribution (normalized)")
    axes[1].set_xlabel("Height (0–1)"); axes[1].grid(alpha=0.3)
    plt.suptitle("Bounding Box Size Distribution — Train Set", fontsize=12)
    plt.tight_layout()
    plt.savefig(str(LOGS / "bbox_distribution.png"), dpi=150, bbox_inches="tight")
    plt.show()

# ── Visual sample: show 8 random annotated images ─────────────
def visualize_samples(n: int = 8, split: str = "train"):
    img_dir = FINAL / "images" / split
    lbl_dir = FINAL / "labels" / split
    imgs    = sorted(list(img_dir.glob("*.jpg")) + list(img_dir.glob("*.png")))
    sample  = random.sample(imgs, min(n, len(imgs)))

    cols = 4
    rows = (len(sample) + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(4 * cols, 3.5 * rows))
    axes = axes.flatten()

    for ax, img_path in zip(axes, sample):
        img = Image.open(str(img_path)).convert("RGB")
        W, H = img.size
        draw = ImageDraw.Draw(img)

        lbl_path = lbl_dir / (img_path.stem + ".txt")
        if lbl_path.exists():
            for line in lbl_path.read_text().strip().splitlines():
                parts = line.strip().split()
                if len(parts) != 5:
                    continue
                cid, xc, yc, w, h = int(parts[0]), *map(float, parts[1:])
                x1 = int((xc - w / 2) * W)
                y1 = int((yc - h / 2) * H)
                x2 = int((xc + w / 2) * W)
                y2 = int((yc + h / 2) * H)
                color = CLASS_COLORS.get(cid, "#FFFFFF")
                draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
                draw.rectangle([x1, y1 - 18, x1 + len(CLASS_NAMES[cid]) * 8, y1],
                               fill=color)
                draw.text((x1 + 2, y1 - 16), CLASS_NAMES[cid],
                          fill="white")

        ax.imshow(img)
        ax.set_title(img_path.name[:20], fontsize=8)
        ax.axis("off")

    for ax in axes[len(sample):]:
        ax.axis("off")

    plt.suptitle(f"Sample Annotated Images — {split.upper()}", fontsize=13,
                 fontweight="bold")
    plt.tight_layout()
    plt.savefig(str(LOGS / f"sample_{split}.png"), dpi=130, bbox_inches="tight")
    plt.show()

visualize_samples(n=8, split="train")


# ══ CELL 9 ══  Create data.yaml
# ----------------------------------------------------------------
import yaml as pyyaml

DATA_YAML = FINAL / "data.yaml"

data_cfg = {
    "path"  : str(FINAL),
    "train" : "images/train",
    "val"   : "images/val",
    "nc"    : 4,
    "names" : CLASS_NAMES,
}

with open(str(DATA_YAML), "w") as f:
    pyyaml.dump(data_cfg, f, default_flow_style=False, sort_keys=False)

print("✅  data.yaml created:")
print()
print(DATA_YAML.read_text())


# ══ CELL 10 ══  Hyperparameter Config
# ----------------------------------------------------------------
# All training knobs in one place.
# Adjust based on your GPU VRAM and dataset size.
# ----------------------------------------------------------------

# ── Training hyperparameters ───────────────────────────────────
CFG = {
    # ── Core ─────────────────────────────────────────────────
    "model"        : "yolov8m.pt",      # medium model — 25.9M params, best accuracy/speed
    "data"         : str(DATA_YAML),
    "epochs"       : 100,
    "imgsz"        : 640,
    "batch"        : RECOMMENDED_BATCH,
    "workers"      : 4,
    "device"       : 0 if DEVICE == "cuda" else "cpu",

    # ── Save / output ────────────────────────────────────────
    "project"      : str(RUNS),
    "name"         : "road_damage_v1",
    "save"         : True,
    "save_period"  : 10,               # save checkpoint every 10 epochs
    "exist_ok"     : True,
    "plots"        : True,
    "verbose"      : True,

    # ── Early stopping ───────────────────────────────────────
    "patience"     : 20,               # stop if no mAP50 improvement for 20 epochs

    # ── Optimizer ────────────────────────────────────────────
    "optimizer"    : "AdamW",
    "lr0"          : 0.001,            # initial LR
    "lrf"          : 0.01,             # final LR = lr0 × lrf (cosine decay)
    "momentum"     : 0.937,
    "weight_decay" : 0.0005,
    "warmup_epochs": 3,
    "warmup_bias_lr": 0.1,

    # ── Loss weights ─────────────────────────────────────────
    "box"          : 7.5,              # bounding box regression loss
    "cls"          : 0.5,              # classification loss
    "dfl"          : 1.5,              # distribution focal loss

    # ── Augmentation ─────────────────────────────────────────
    # Aggressive augmentation is critical for Indian road generalization.
    # Roads look very different across states (tar, concrete, mud edges).
    "augment"      : True,
    "hsv_h"        : 0.015,            # hue jitter
    "hsv_s"        : 0.5,              # saturation jitter
    "hsv_v"        : 0.4,              # value (brightness) — day/night variation
    "degrees"      : 5.0,              # rotation (roads are mostly flat)
    "translate"    : 0.1,              # shift
    "scale"        : 0.5,              # zoom
    "shear"        : 2.0,              # perspective shear
    "perspective"  : 0.0001,
    "flipud"       : 0.05,
    "fliplr"       : 0.5,              # horizontal flip — cracks are symmetric
    "mosaic"       : 1.0,              # mosaic — critical for small crack detection
    "mixup"        : 0.1,              # mixup — helps with class boundary confusion
    "copy_paste"   : 0.1,              # copy-paste augmentation

    # ── Evaluation ───────────────────────────────────────────
    "val"          : True,
    "iou"          : 0.7,              # IoU threshold for mAP computation
    "conf"         : 0.001,            # low conf for thorough evaluation
    "max_det"      : 300,
    "half"         : (DEVICE == "cuda"),  # FP16 on GPU for speed

    # ── Regularization ───────────────────────────────────────
    "dropout"      : 0.0,
    "label_smoothing": 0.1,            # prevents overconfidence
}

print("  Training configuration:")
print(f"    Model          : {CFG['model']}")
print(f"    Epochs         : {CFG['epochs']}  (early stop: {CFG['patience']})")
print(f"    Image size     : {CFG['imgsz']}×{CFG['imgsz']}")
print(f"    Batch size     : {CFG['batch']}")
print(f"    Optimizer      : {CFG['optimizer']}")
print(f"    LR             : {CFG['lr0']} → {CFG['lr0'] * CFG['lrf']}")
print(f"    FP16           : {CFG['half']}")
print(f"    Augmentation   : mosaic + mixup + copy_paste")

# ── Estimated training time ────────────────────────────────────
n_train = len(list((FINAL / "images" / "train").glob("*")))
secs_per_epoch_t4 = n_train / 640 * 8   # rough estimate for T4
print(f"\n  Est. time/epoch on T4  : ~{secs_per_epoch_t4:.0f} s")
print(f"  Est. total (100 epochs): ~{secs_per_epoch_t4 * 100 / 3600:.1f} hrs")


# ══ CELL 11 ══  TRAIN
# ----------------------------------------------------------------
# This is the main training cell.
# Do NOT interrupt mid-epoch — let early stopping handle termination.
# Checkpoints are saved every 10 epochs to Drive.
# ----------------------------------------------------------------
from ultralytics import YOLO
import time

print("=" * 60)
print("  Starting Training")
print("=" * 60)
print(f"  Data  : {CFG['data']}")
print(f"  Save  : {CFG['project']}/{CFG['name']}")
print()

start_time = time.time()

# Load base model (COCO pretrained — much better than random init)
model = YOLO(CFG["model"])

# Remove non-training keys from CFG before passing to model.train()
# (some keys like "model" are not valid train() arguments)
train_kwargs = {k: v for k, v in CFG.items() if k != "model"}

# ── RUN TRAINING ──────────────────────────────────────────────
results = model.train(**train_kwargs)

elapsed = time.time() - start_time
print(f"\n  Training complete in {elapsed / 3600:.2f} hours")

# ── Find best weights ─────────────────────────────────────────
best_pt  = Path(CFG["project"]) / CFG["name"] / "weights" / "best.pt"
last_pt  = Path(CFG["project"]) / CFG["name"] / "weights" / "last.pt"

print(f"\n  Best weights : {best_pt}")
print(f"  Last weights : {last_pt}")
print(f"  Exists       : {best_pt.exists()}")

# ── Quick metrics summary ─────────────────────────────────────
metrics = results.results_dict
print(f"\n  ── Final Metrics ───────────────────────────────")
print(f"  Precision  (P) : {metrics.get('metrics/precision(B)', 0):.4f}")
print(f"  Recall     (R) : {metrics.get('metrics/recall(B)', 0):.4f}")
print(f"  mAP50          : {metrics.get('metrics/mAP50(B)', 0):.4f}")
print(f"  mAP50-95       : {metrics.get('metrics/mAP50-95(B)', 0):.4f}")


# ══ CELL 12 ══  Full Evaluation
# ----------------------------------------------------------------
# Runs validation on the val split with the best weights.
# Produces: per-class AP, confusion matrix, PR curve, F1 curve.
# ----------------------------------------------------------------
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

print("  Loading best model for evaluation …")
best_model = YOLO(str(best_pt))

# ── Validation ────────────────────────────────────────────────
val_results = best_model.val(
    data    = str(DATA_YAML),
    imgsz   = CFG["imgsz"],
    batch   = CFG["batch"],
    conf    = 0.25,            # standard inference threshold
    iou     = 0.50,
    device  = CFG["device"],
    verbose = True,
    plots   = True,
    save_json = True,
)

print("\n  ── Per-Class AP ────────────────────────────────────")
print(f"  {'Class':<25} {'AP50':>8} {'AP50-95':>10}")
print("  " + "─" * 46)

for i, cls_name in enumerate(CLASS_NAMES):
    try:
        ap50    = float(val_results.box.ap50[i])
        ap5095  = float(val_results.box.ap[i])
        bar     = "█" * int(ap50 * 30)
        print(f"  {cls_name:<25} {ap50:>8.4f}  {ap5095:>10.4f}  {bar}")
    except (IndexError, AttributeError):
        print(f"  {cls_name:<25} N/A")

# Overall
print("  " + "─" * 46)
print(f"  {'OVERALL mAP50':<25} {val_results.box.map50:>8.4f}")
print(f"  {'OVERALL mAP50-95':<25} {val_results.box.map:>8.4f}")
print(f"  {'Precision':<25} {val_results.box.mp:>8.4f}")
print(f"  {'Recall':<25} {val_results.box.mr:>8.4f}")

# ── Per-class AP bar chart ─────────────────────────────────────
fig, ax = plt.subplots(figsize=(9, 5))
try:
    ap50_vals = [float(val_results.box.ap50[i]) for i in range(len(CLASS_NAMES))]
    bars = ax.bar(CLASS_NAMES, ap50_vals,
                  color=[CLASS_COLORS[i] for i in range(len(CLASS_NAMES))],
                  edgecolor="white", linewidth=0.8, width=0.5)
    for bar, val in zip(bars, ap50_vals):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 0.005,
                f"{val:.3f}", ha="center", va="bottom", fontsize=10, fontweight="bold")
    ax.set_ylim(0, 1.1)
    ax.set_ylabel("AP@0.50", fontsize=11)
    ax.set_title("Per-Class Average Precision (AP@0.50)\nUrbanFix AI — Road Damage",
                 fontsize=12, fontweight="bold")
    ax.axhline(0.5, linestyle="--", color="grey", alpha=0.5, label="0.50 baseline")
    ax.axhline(val_results.box.map50, linestyle="--", color="blue", alpha=0.6,
               label=f"mAP50={val_results.box.map50:.3f}")
    ax.set_xticklabels(CLASS_NAMES, rotation=15, ha="right")
    ax.legend(fontsize=9)
    ax.spines[["top", "right"]].set_visible(False)
    ax.grid(axis="y", alpha=0.3)
    plt.tight_layout()
    plt.savefig(str(LOGS / "per_class_ap.png"), dpi=150, bbox_inches="tight")
    plt.show()
except Exception as e:
    print(f"  Could not plot per-class AP: {e}")

# ── Training loss/metric curves ──────────────────────────────
results_csv = Path(CFG["project"]) / CFG["name"] / "results.csv"
if results_csv.exists():
    import pandas as pd
    df = pd.read_csv(str(results_csv))
    df.columns = df.columns.str.strip()

    fig, axes = plt.subplots(2, 3, figsize=(16, 9))

    plots = [
        ("train/box_loss",  "Train Box Loss",       axes[0][0], "#FF4444"),
        ("train/cls_loss",  "Train Class Loss",      axes[0][1], "#FF9900"),
        ("train/dfl_loss",  "Train DFL Loss",        axes[0][2], "#FFDD00"),
        ("metrics/mAP50(B)","Val mAP50",             axes[1][0], "#3399FF"),
        ("metrics/mAP50-95(B)","Val mAP50-95",       axes[1][1], "#44CC44"),
        ("val/box_loss",    "Val Box Loss",           axes[1][2], "#AA44CC"),
    ]

    for col_name, title, ax, color in plots:
        if col_name in df.columns:
            ax.plot(df["epoch"], df[col_name], color=color, linewidth=1.8)
            ax.set_title(title, fontsize=10, fontweight="bold")
            ax.set_xlabel("Epoch"); ax.grid(alpha=0.3)
            ax.spines[["top", "right"]].set_visible(False)
        else:
            ax.text(0.5, 0.5, f"{col_name}\nnot found",
                    ha="center", va="center", transform=ax.transAxes, color="grey")
            ax.axis("off")

    plt.suptitle("Training Curves — UrbanFix AI Road Damage Model",
                 fontsize=13, fontweight="bold")
    plt.tight_layout()
    plt.savefig(str(LOGS / "training_curves.png"), dpi=150, bbox_inches="tight")
    plt.show()
    print(f"  Training curves saved → {LOGS}/training_curves.png")


# ══ CELL 13 ══  Inference Test on Val Images
# ----------------------------------------------------------------
# Visually inspect predictions on random validation images.
# Helps spot false positives / false negatives before deploying.
# ----------------------------------------------------------------
from PIL import Image, ImageDraw, ImageFont
import random

CONF_THRESHOLD = 0.25     # show boxes with confidence > 25%
N_SAMPLES      = 9        # number of val images to show

val_imgs = sorted(list((FINAL / "images" / "val").glob("*.jpg")) +
                  list((FINAL / "images" / "val").glob("*.png")))
samples  = random.sample(val_imgs, min(N_SAMPLES, len(val_imgs)))

cols = 3
rows = (len(samples) + cols - 1) // cols
fig, axes = plt.subplots(rows, cols, figsize=(5 * cols, 4.5 * rows))
axes = axes.flatten()

for ax, img_path in zip(axes, samples):
    pil_img = Image.open(str(img_path)).convert("RGB")
    W, H    = pil_img.size
    draw    = ImageDraw.Draw(pil_img)

    res = best_model.predict(
        source  = str(img_path),
        conf    = CONF_THRESHOLD,
        imgsz   = CFG["imgsz"],
        device  = CFG["device"],
        verbose = False,
    )[0]

    if res.boxes is not None:
        for b in res.boxes:
            x1, y1, x2, y2 = [int(v) for v in b.xyxy[0].tolist()]
            cid   = int(b.cls.item())
            conf  = float(b.conf.item())
            color = CLASS_COLORS.get(cid, "#FFFFFF")
            label = f"{CLASS_NAMES[cid]} {conf:.0%}"

            # Draw box
            draw.rectangle([x1, y1, x2, y2], outline=color, width=3)
            # Draw label background
            lbl_w = len(label) * 7
            draw.rectangle([x1, max(0, y1 - 20), x1 + lbl_w, y1], fill=color)
            draw.text((x1 + 2, max(0, y1 - 18)), label, fill="white")

    n_det = len(res.boxes) if res.boxes is not None else 0
    ax.imshow(pil_img)
    ax.set_title(f"{img_path.name[:22]}\n{n_det} detection(s)", fontsize=8)
    ax.axis("off")

for ax in axes[len(samples):]:
    ax.axis("off")

plt.suptitle(f"Inference on Validation Set  (conf > {CONF_THRESHOLD})",
             fontsize=13, fontweight="bold")
plt.tight_layout()
plt.savefig(str(LOGS / "val_predictions.png"), dpi=150, bbox_inches="tight")
plt.show()
print(f"  Predictions saved → {LOGS}/val_predictions.png")


# ══ CELL 14 ══  Export Weights for App Deployment
# ----------------------------------------------------------------
# Saves in multiple formats:
#   1. PyTorch .pt     — for Colab / Python inference (default)
#   2. ONNX            — for cross-platform deployment
#   3. TorchScript     — for mobile / edge
# ----------------------------------------------------------------

EXPORT.mkdir(parents=True, exist_ok=True)

# ── Copy best.pt to export/ ────────────────────────────────────
export_pt = EXPORT / "road_damage_best.pt"
shutil.copy2(str(best_pt), str(export_pt))
print(f"  ✅  PyTorch weights  → {export_pt}")
print(f"       Size: {export_pt.stat().st_size / 1e6:.1f} MB")

# ── Export to ONNX ────────────────────────────────────────────
print("\n  Exporting to ONNX …")
try:
    onnx_path = best_model.export(
        format  = "onnx",
        imgsz   = CFG["imgsz"],
        dynamic = True,           # dynamic batch size
        simplify= True,           # graph simplification
        opset   = 17,
    )
    dest_onnx = EXPORT / "road_damage_best.onnx"
    shutil.move(str(onnx_path), str(dest_onnx))
    print(f"  ✅  ONNX model       → {dest_onnx}")
    print(f"       Size: {dest_onnx.stat().st_size / 1e6:.1f} MB")
except Exception as e:
    print(f"  ⚠️  ONNX export failed: {e}")

# ── Save model metadata ───────────────────────────────────────
metadata = {
    "model_name"   : "UrbanFix AI — Road Damage Detector",
    "version"      : "1.0",
    "base_model"   : CFG["model"],
    "dataset"      : "RDD2022 (filtered: 4 classes)",
    "classes"      : CLASS_NAMES,
    "nc"           : 4,
    "imgsz"        : CFG["imgsz"],
    "conf_threshold": CONF_THRESHOLD,
    "iou_threshold": 0.50,
    "train_images" : train_stats["total_images"],
    "val_images"   : val_stats["total_images"],
    "train_objects": train_stats["total_objects"],
    "val_objects"  : val_stats["total_objects"],
    "metrics": {
        "mAP50"      : round(float(val_results.box.map50),  4),
        "mAP50_95"   : round(float(val_results.box.map),    4),
        "precision"  : round(float(val_results.box.mp),     4),
        "recall"     : round(float(val_results.box.mr),     4),
    },
    "per_class_ap50": {
        CLASS_NAMES[i]: round(float(val_results.box.ap50[i]), 4)
        for i in range(len(CLASS_NAMES))
    },
    "training_config": {
        "epochs"    : CFG["epochs"],
        "imgsz"     : CFG["imgsz"],
        "batch"     : CFG["batch"],
        "optimizer" : CFG["optimizer"],
        "lr0"       : CFG["lr0"],
        "augment"   : CFG["augment"],
    },
}

meta_path = EXPORT / "model_metadata.json"
with open(str(meta_path), "w") as f:
    json.dump(metadata, f, indent=2)

print(f"\n  ✅  Metadata saved   → {meta_path}")


# ══ CELL 15 ══  Final Report Card
# ----------------------------------------------------------------
print("\n" + "═" * 60)
print("  URBANFIX AI — ROAD DAMAGE MODEL REPORT CARD")
print("═" * 60)

map50    = float(val_results.box.map50)
map5095  = float(val_results.box.map)
prec     = float(val_results.box.mp)
recall   = float(val_results.box.mr)
f1       = 2 * prec * recall / max(prec + recall, 1e-6)

def grade(score: float) -> str:
    if score >= 0.80: return "🟢 EXCELLENT"
    if score >= 0.65: return "🟡 GOOD"
    if score >= 0.50: return "🟠 ACCEPTABLE"
    return                   "🔴 NEEDS MORE DATA"

print(f"\n  {'Metric':<20} {'Score':>8}  {'Grade'}")
print("  " + "─" * 50)
print(f"  {'mAP@0.50':<20} {map50:>8.4f}  {grade(map50)}")
print(f"  {'mAP@0.50:0.95':<20} {map5095:>8.4f}  {grade(map5095)}")
print(f"  {'Precision':<20} {prec:>8.4f}  {grade(prec)}")
print(f"  {'Recall':<20} {recall:>8.4f}  {grade(recall)}")
print(f"  {'F1 Score':<20} {f1:>8.4f}  {grade(f1)}")

print(f"\n  Per-Class Performance:")
print(f"  {'Class':<25} {'AP50':>8}  {'Grade'}")
print("  " + "─" * 50)
for i, cls_name in enumerate(CLASS_NAMES):
    try:
        ap = float(val_results.box.ap50[i])
        print(f"  {cls_name:<25} {ap:>8.4f}  {grade(ap)}")
    except:
        print(f"  {cls_name:<25}      N/A")

print(f"\n  Model saved to  : {export_pt}")
print(f"  ONNX saved to   : {EXPORT}/road_damage_best.onnx")
print(f"  Logs + plots    : {LOGS}/")
print("═" * 60)

print("""
  NEXT STEPS:
  ───────────
  1. If mAP50 < 0.65:
     → Add more Indian road photos + re-annotate
     → Increase epochs to 150
     → Check class_distribution.png for imbalance

  2. If mAP50 >= 0.65:
     → Copy road_damage_best.pt to your inference notebook
     → Integrate with the full UrbanFix pipeline (Cell 5 of main notebook)

  3. To improve further:
     → Add Indian-specific road images (tar roads, kutcha roads)
     → Try yolov8m.pt or yolov8l.pt as base model (more params)
     → Use Test-Time Augmentation (TTA) at inference: model.val(augment=True)
""")
