# ============================================================
# UrbanFix - Lighting Defect Detector Training Notebook
# Category: lighting
# Output: best.pt (YOLO detector)
# ============================================================
# Important:
# Open datasets mostly contain normal poles/lights, not "broken" defects.
# For high accuracy, mix open base data + your defect labels.
# Put YOLO dataset in:
# /content/drive/MyDrive/UrbanFix_AI/datasets/lighting_yolo/
# ============================================================

# --- CELL 1: Setup ---
from google.colab import drive
from pathlib import Path
import subprocess
import sys

drive.mount("/content/drive")
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", "ultralytics>=8.3.0"])

BASE = Path("/content/drive/MyDrive/UrbanFix_AI")
DATA = BASE / "datasets" / "lighting_yolo"
RUNS = BASE / "runs" / "lighting"
WEIGHTS = BASE / "models"
for d in [DATA, RUNS, WEIGHTS]:
    d.mkdir(parents=True, exist_ok=True)


# --- CELL 2: Dataset guidance ---
"""
Recommended open-source sources:
1) Mapillary Vistas (street context)
2) Open Images classes: street light / pole / lamp proxies
3) Your custom defect labels (critical):
   - broken_street_light
   - tilted_pole
   - dark_unlit_lamp
   - exposed_wire

YOLO folder:
lighting_yolo/
  images/train, images/val
  labels/train, labels/val
  dataset.yaml
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
    epochs=140,
    imgsz=960,
    batch=10,
    device=0,
    workers=2,
    project=str(RUNS),
    name="yolov8m_lighting_v1",
    pretrained=True,
    optimizer="AdamW",
    lr0=0.0012,
    lrf=0.01,
    warmup_epochs=4.0,
    weight_decay=0.0005,
    patience=35,
    cos_lr=True,
    hsv_h=0.02,
    hsv_s=0.6,
    hsv_v=0.5,
    degrees=10.0,
    translate=0.1,
    scale=0.4,
    shear=2.0,
    perspective=0.0005,
    fliplr=0.5,
    mosaic=0.8,
    mixup=0.1,
    close_mosaic=15,
    val=True,
    plots=True,
    cache=True,
)


# --- CELL 4: Evaluate and export ---
best_pt = RUNS / "yolov8m_lighting_v1" / "weights" / "best.pt"
if not best_pt.exists():
    raise FileNotFoundError(f"best.pt not found: {best_pt}")

best_model = YOLO(str(best_pt))
metrics = best_model.val(data=str(yaml_path), split="val", imgsz=960)
print(metrics)

dest = WEIGHTS / "lighting_best.pt"
dest.write_bytes(best_pt.read_bytes())
print("Saved:", dest)
