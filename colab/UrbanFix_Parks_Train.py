# ============================================================
# UrbanFix - Parks Issue Detector Training Notebook
# Category: parks
# Output: best.pt (YOLO detector)
# ============================================================
# There is no single perfect open dataset for "park damage".
# Best results: open base objects + your park defect annotations.
# Put YOLO dataset in:
# /content/drive/MyDrive/UrbanFix_AI/datasets/parks_yolo/
# ============================================================

# --- CELL 1: Setup ---
from google.colab import drive
from pathlib import Path
import subprocess
import sys

drive.mount("/content/drive")
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "ultralytics>=8.3.0"])

BASE = Path("/content/drive/MyDrive/UrbanFix_AI")
DATA = BASE / "datasets" / "parks_yolo"
RUNS = BASE / "runs" / "parks"
WEIGHTS = BASE / "models"
for d in [DATA, RUNS, WEIGHTS]:
    d.mkdir(parents=True, exist_ok=True)


# --- CELL 2: Class schema ---
"""
Recommended park classes for your app:
- broken_bench
- damaged_playground
- fallen_tree_branch
- broken_fence
- park_garbage
- cracked_path

Open base datasets:
- Open Images (bench/fence/tree/playground/trash-can)
- Mapillary Vistas (public-space context)
Then fine-tune with your own defect labels.
"""


# --- CELL 3: Train ---
from ultralytics import YOLO

yaml_path = DATA / "dataset.yaml"
if not yaml_path.exists():
    raise FileNotFoundError(f"dataset.yaml missing: {yaml_path}")
print("Found dataset.yaml:", yaml_path)
print("Ensure class names in dataset.yaml match your labels exactly.")

model = YOLO("yolov8m.pt")

model.train(
    data=str(yaml_path),
    epochs=160,
    imgsz=960,
    batch=10,
    device=0,
    workers=2,
    project=str(RUNS),
    name="yolov8m_parks_v1",
    pretrained=True,
    optimizer="AdamW",
    lr0=0.001,
    lrf=0.01,
    warmup_epochs=4.0,
    weight_decay=0.0006,
    patience=40,
    cos_lr=True,
    hsv_h=0.015,
    hsv_s=0.55,
    hsv_v=0.45,
    degrees=12.0,
    translate=0.1,
    scale=0.45,
    shear=2.0,
    fliplr=0.5,
    mosaic=0.75,
    mixup=0.1,
    close_mosaic=15,
    val=True,
    plots=True,
    cache=True,
)


# --- CELL 4: Evaluate + export ---
best_pt = RUNS / "yolov8m_parks_v1" / "weights" / "best.pt"
if not best_pt.exists():
    raise FileNotFoundError(f"best.pt not found: {best_pt}")

best_model = YOLO(str(best_pt))
metrics = best_model.val(data=str(yaml_path), split="val", imgsz=960)
print(metrics)

dest = WEIGHTS / "parks_best.pt"
dest.write_bytes(best_pt.read_bytes())
print("Saved:", dest)
