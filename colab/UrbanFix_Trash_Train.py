# ============================================================
# UrbanFix - Trash Model Training Notebook (Colab style)
# Category: trash
# Output: best.pt (YOLO detector)
# ============================================================
# Usage:
# 1) Open in Colab and run cell blocks in order.
# 2) Put downloaded YOLO dataset into:
#    /content/drive/MyDrive/UrbanFix_AI/datasets/trash_yolo/
# 3) Ensure this exists:
#    images/train, images/val, labels/train, labels/val, dataset.yaml
# 4) Train, validate, export best.pt to Drive.
# ============================================================

# --- CELL 1: Setup ---
from google.colab import drive
from pathlib import Path
import os
import subprocess
import sys

drive.mount("/content/drive")

subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "ultralytics>=8.3.0"])

BASE = Path("/content/drive/MyDrive/UrbanFix_AI")
DATA = BASE / "datasets" / "trash_yolo"
RUNS = BASE / "runs" / "trash"
WEIGHTS = BASE / "models"
for d in [DATA, RUNS, WEIGHTS]:
    d.mkdir(parents=True, exist_ok=True)

print("Setup done")
print("DATA:", DATA)
print("RUNS:", RUNS)
print("WEIGHTS:", WEIGHTS)


# --- CELL 2: Dataset notes ---
"""
Recommended open-source mix for trash:
1) TACO (main)
2) Open Images waste-like classes (support)
3) Your city images (must-have for highest app accuracy)

Expected folder layout (YOLO):
trash_yolo/
  images/train/*.jpg
  images/val/*.jpg
  labels/train/*.txt
  labels/val/*.txt
  dataset.yaml
"""


# --- CELL 3: Check dataset ---
yaml_path = DATA / "dataset.yaml"
if not yaml_path.exists():
    raise FileNotFoundError(f"dataset.yaml missing at: {yaml_path}")
print("Found:", yaml_path)
print("If class names differ from template, update dataset.yaml names before training.")


# --- CELL 4: Train YOLO ---
from ultralytics import YOLO

# Start from a strong generic detector
model = YOLO("yolov8m.pt")

results = model.train(
    data=str(yaml_path),
    epochs=120,
    imgsz=960,
    batch=12,              # reduce if OOM
    device=0,
    workers=2,
    project=str(RUNS),
    name="yolov8m_trash_v1",
    pretrained=True,
    optimizer="AdamW",
    lr0=0.0015,
    lrf=0.01,
    weight_decay=0.0005,
    warmup_epochs=3.0,
    patience=30,
    cos_lr=True,
    hsv_h=0.015,
    hsv_s=0.5,
    hsv_v=0.4,
    degrees=8.0,
    translate=0.08,
    scale=0.35,
    shear=2.0,
    fliplr=0.5,
    mosaic=0.7,
    mixup=0.08,
    copy_paste=0.05,
    close_mosaic=10,
    val=True,
    plots=True,
    cache=True,
)


# --- CELL 5: Validate best checkpoint ---
best_pt = RUNS / "yolov8m_trash_v1" / "weights" / "best.pt"
if not best_pt.exists():
    raise FileNotFoundError(f"best.pt not found: {best_pt}")

best_model = YOLO(str(best_pt))
metrics = best_model.val(data=str(yaml_path), split="val", imgsz=960)
print("Validation done")
print(metrics)


# --- CELL 6: Export model for app ---
dest = WEIGHTS / "trash_best.pt"
dest.write_bytes(best_pt.read_bytes())
print("Saved:", dest)

# Optional ONNX export
best_model.export(format="onnx", imgsz=960, opset=12)
print("Done")
