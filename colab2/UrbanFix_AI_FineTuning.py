# ================================================================
#  UrbanFix AI — COMPLETE FINE-TUNING NOTEBOOK
#  Save to: MyDrive/UrbanFix_AI/colab/finetune.ipynb
#
#  Covers fine-tuning for ALL 5 models:
#    1. SigLIP Router       (image classifier)
#    2. Road Damage YOLO    (object detector)
#    3. Trash/Waste YOLO    (object detector)
#    4. Flood SigLIP        (binary classifier)
#    5. YOLO-World          (open-vocab detector)
#
#  Each section = one group of Colab cells.
#  READ THE DATA REQUIREMENTS section first — training
#  without enough good data is worse than not training at all.
# ================================================================


# ════════════════════════════════════════════════════════════════
#  SECTION 0 — DATA REQUIREMENTS  (read before running anything)
# ════════════════════════════════════════════════════════════════
"""
BEFORE YOU TRAIN ANYTHING, you need labeled data.
Here is exactly how much data each model needs, and where to get it.

┌─────────────────┬───────────────┬──────────────────────────────────────────┐
│ Model           │ Min images    │ Where to get data                        │
├─────────────────┼───────────────┼──────────────────────────────────────────┤
│ SigLIP Router   │ 300/category  │ You collect + label (6 categories)       │
│                 │ = 1800 total  │ Tools: your phone, Google Images         │
├─────────────────┼───────────────┼──────────────────────────────────────────┤
│ Road YOLO       │ 800 annotated │ RDD2022 dataset (FREE, 21k images)       │
│                 │ images        │ + your own Indian road photos            │
├─────────────────┼───────────────┼──────────────────────────────────────────┤
│ Trash YOLO      │ 600 annotated │ TACO dataset (FREE, 1500 images)         │
│                 │ images        │ + your own Indian street garbage photos  │
├─────────────────┼───────────────┼──────────────────────────────────────────┤
│ Flood SigLIP    │ 400/class     │ Kaggle flood datasets (FREE)             │
│                 │ = 800 total   │ + Indian waterlogging photos             │
├─────────────────┼───────────────┼──────────────────────────────────────────┤
│ YOLO-World      │ 200 annotated │ Your own photos of broken lights/parks   │
│                 │ per class     │ Annotation tool: Roboflow (FREE tier)    │
└─────────────────┴───────────────┴──────────────────────────────────────────┘

ANNOTATION TOOLS (all free):
  • Roboflow  →  roboflow.com         (best for YOLO bbox annotation)
  • Label Studio →  labelstud.io     (best for classification)
  • CVAT      →  cvat.ai             (open source, self-host)

FREE DATASETS TO START WITH:
  • RDD2022 road damage  →  https://github.com/sekilab/RoadDamageDetector
  • TACO trash           →  http://tacodataset.org
  • Flood images         →  kaggle.com/datasets/faizalkarim/flood-area-segmentation
  • Open Images V7       →  storage.googleapis.com/openimages (filter by class)

HARDWARE NEEDED FOR FINE-TUNING:
  ┌──────────────────┬─────────────────────────────────────────┐
  │ Task             │ Minimum hardware                        │
  ├──────────────────┼─────────────────────────────────────────┤
  │ SigLIP Router    │ Colab Free T4 (15 GB) — works fine      │
  │ Road YOLO        │ Colab Free T4 — 800 images takes ~40min │
  │ Trash YOLO       │ Colab Free T4 — works fine              │
  │ Flood SigLIP     │ Colab Free T4 — works fine              │
  │ YOLO-World       │ Colab Pro A100 recommended (8 GB+)      │
  └──────────────────┴─────────────────────────────────────────┘

  Your LOQ 3050 (4GB VRAM) — CAN fine-tune YOLO models
  with batch_size=4 and imgsz=416. Slow but works.
  NOT recommended for SigLIP fine-tuning locally.
"""


# ════════════════════════════════════════════════════════════════
#  SECTION 1 — SETUP (run first, once per session)
# ════════════════════════════════════════════════════════════════

# ── CELL 1-A : Mount Drive + Install packages ─────────────────
from google.colab import drive
drive.mount("/content/drive")

import subprocess, sys

pkgs = [
    "ultralytics",          # YOLO training
    "transformers",         # SigLIP fine-tuning
    "datasets",             # HuggingFace datasets
    "accelerate",           # distributed training helper
    "evaluate",             # metrics (accuracy, mAP)
    "roboflow",             # download Roboflow datasets
    "torch", "torchvision",
    "pillow", "matplotlib",
    "scikit-learn",         # confusion matrix, classification report
    "tqdm", "pyyaml",
]
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q"] + pkgs,
                      stdout=subprocess.DEVNULL)

print("✅  Packages installed")


# ── CELL 1-B : Folder structure ───────────────────────────────
from pathlib import Path
import os, torch

BASE      = Path("/content/drive/MyDrive/UrbanFix_AI")
DATA      = BASE / "data"
MODELS    = BASE / "models"          # fine-tuned weights saved here
FT_DATA   = BASE / "finetune_data"   # organised training datasets
LOGS      = BASE / "logs"

for d in [MODELS, FT_DATA, LOGS]:
    d.mkdir(parents=True, exist_ok=True)

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Device : {DEVICE}")
if DEVICE == "cuda":
    print(f"GPU    : {torch.cuda.get_device_name(0)}")
    print(f"VRAM   : {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")


# ════════════════════════════════════════════════════════════════
#  SECTION 2 — FINE-TUNE: SigLIP ROUTER
#  Task      : 6-class image classification
#  Base model: google/siglip-base-patch16-384
#  Your data : ~300 images per category (1800 total minimum)
# ════════════════════════════════════════════════════════════════

# ── CELL 2-A : Prepare Router Dataset ────────────────────────
"""
Your folder structure for router fine-tuning should be:

  finetune_data/
  └── router/
      ├── train/
      │   ├── roads/       ← pothole photos, crack photos
      │   ├── trash/       ← garbage dump photos
      │   ├── water/       ← waterlogged road photos
      │   ├── lighting/    ← broken street light photos
      │   ├── parks/       ← damaged park photos
      │   └── other/       ← normal photos (selfies, indoors, etc.)
      └── val/
          ├── roads/
          ├── trash/
          ... (same structure, 20% of your data)

Split: 80% train, 20% val.
"""
from torchvision import datasets, transforms
from torch.utils.data import DataLoader
import torch.nn as nn
from transformers import AutoProcessor, AutoModel
import torch.optim as optim

ROUTER_DATA = FT_DATA / "router"
ROUTER_TRAIN = ROUTER_DATA / "train"
ROUTER_VAL   = ROUTER_DATA / "val"

# Check if data exists
if not ROUTER_TRAIN.exists():
    print("⚠️  No router training data found.")
    print(f"   Create folders at: {ROUTER_DATA}")
    print("   Structure: train/roads/, train/trash/, train/water/, etc.")
else:
    print(f"✅  Router data found at {ROUTER_DATA}")
    for split_dir in [ROUTER_TRAIN, ROUTER_VAL]:
        cats = [d.name for d in split_dir.iterdir() if d.is_dir()]
        total = sum(len(list(d.glob("*"))) for d in split_dir.iterdir() if d.is_dir())
        print(f"   {split_dir.name}: {cats}  |  {total} images")


# ── CELL 2-B : Fine-tune SigLIP Router ───────────────────────
from transformers import AutoProcessor, SiglipModel, AutoTokenizer
import torch.nn.functional as F
from sklearn.metrics import classification_report, confusion_matrix
import matplotlib.pyplot as plt
import numpy as np

CATEGORIES_FT = ["roads", "trash", "water", "lighting", "parks", "other"]
N_CLASSES     = len(CATEGORIES_FT)
SIGLIP_ID     = "google/siglip-base-patch16-384"

# ── Model: SigLIP vision encoder + linear classification head ──
class SigLIPClassifier(nn.Module):
    def __init__(self, base_model, n_classes: int, freeze_base: bool = True):
        super().__init__()
        self.encoder  = base_model.vision_model
        hidden_dim    = self.encoder.config.hidden_size   # 768 for base

        # Freeze the encoder for first few epochs (linear probing)
        if freeze_base:
            for p in self.encoder.parameters():
                p.requires_grad = False

        self.head = nn.Sequential(
            nn.LayerNorm(hidden_dim),
            nn.Linear(hidden_dim, 256),
            nn.GELU(),
            nn.Dropout(0.2),
            nn.Linear(256, n_classes),
        )

    def forward(self, pixel_values):
        out   = self.encoder(pixel_values=pixel_values)
        # Use [CLS] token (first token of last hidden state)
        feats = out.last_hidden_state[:, 0, :]
        return self.head(feats)

    def unfreeze_top_layers(self, n_layers: int = 4):
        """Call after linear probing phase to fine-tune top transformer layers."""
        encoder_layers = self.encoder.encoder.layers
        for layer in encoder_layers[-n_layers:]:
            for p in layer.parameters():
                p.requires_grad = True
        print(f"   Unfroze top {n_layers} encoder layers for full fine-tuning")


def finetune_router(
    train_dir     = ROUTER_TRAIN,
    val_dir       = ROUTER_VAL,
    save_path     = MODELS / "router_finetuned",
    epochs_frozen = 5,      # linear probing (encoder frozen)
    epochs_unfrozen = 10,   # full fine-tuning (top 4 layers)
    batch_size    = 16,
    lr_frozen     = 3e-4,
    lr_unfrozen   = 5e-5,
):
    if not train_dir.exists():
        print("❌  Training data not found. See CELL 2-A for folder structure.")
        return None

    # ── Transforms ───────────────────────────────────────────
    IMG_SIZE = 384   # SigLIP patch16-384 expects 384×384

    train_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2),
        transforms.RandomGrayscale(p=0.05),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
    ])
    val_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(mean=[0.5, 0.5, 0.5], std=[0.5, 0.5, 0.5]),
    ])

    train_ds = datasets.ImageFolder(str(train_dir), transform=train_tf)
    val_ds   = datasets.ImageFolder(str(val_dir),   transform=val_tf)

    train_dl = DataLoader(train_ds, batch_size=batch_size, shuffle=True,
                          num_workers=2, pin_memory=True)
    val_dl   = DataLoader(val_ds,   batch_size=batch_size, shuffle=False,
                          num_workers=2, pin_memory=True)

    print(f"Train: {len(train_ds)} images  |  Val: {len(val_ds)} images")
    print(f"Classes: {train_ds.classes}")

    # ── Load base model ───────────────────────────────────────
    print("Loading SigLIP base model …")
    base = SiglipModel.from_pretrained(SIGLIP_ID)
    model = SigLIPClassifier(base, n_classes=N_CLASSES, freeze_base=True).to(DEVICE)

    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)
    history   = {"train_loss": [], "val_loss": [], "val_acc": []}

    def run_epoch(loader, training: bool, optimizer=None):
        model.train(training)
        total_loss, correct, total = 0.0, 0, 0
        with torch.set_grad_enabled(training):
            for imgs, labels in loader:
                imgs, labels = imgs.to(DEVICE), labels.to(DEVICE)
                logits = model(imgs)
                loss   = criterion(logits, labels)
                if training:
                    optimizer.zero_grad()
                    loss.backward()
                    nn.utils.clip_grad_norm_(model.parameters(), 1.0)
                    optimizer.step()
                total_loss += loss.item() * imgs.size(0)
                correct    += (logits.argmax(1) == labels).sum().item()
                total      += imgs.size(0)
        return total_loss / total, correct / total

    # ── Phase 1: Linear Probing (encoder frozen) ─────────────
    print(f"\n── Phase 1: Linear probing ({epochs_frozen} epochs) ──")
    opt1 = optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()),
                       lr=lr_frozen, weight_decay=0.01)
    sched1 = optim.lr_scheduler.CosineAnnealingLR(opt1, T_max=epochs_frozen)

    for epoch in range(epochs_frozen):
        tl, _  = run_epoch(train_dl, training=True,  optimizer=opt1)
        vl, va = run_epoch(val_dl,   training=False)
        sched1.step()
        history["train_loss"].append(tl)
        history["val_loss"].append(vl)
        history["val_acc"].append(va)
        print(f"  Epoch {epoch+1:02d}/{epochs_frozen}  "
              f"train_loss={tl:.4f}  val_loss={vl:.4f}  val_acc={va:.3f}")

    # ── Phase 2: Full fine-tuning (top 4 layers unfrozen) ────
    print(f"\n── Phase 2: Full fine-tuning ({epochs_unfrozen} epochs) ──")
    model.unfreeze_top_layers(n_layers=4)
    opt2 = optim.AdamW([
        {"params": model.encoder.parameters(),  "lr": lr_unfrozen},
        {"params": model.head.parameters(),     "lr": lr_frozen},
    ], weight_decay=0.01)
    sched2 = optim.lr_scheduler.CosineAnnealingLR(opt2, T_max=epochs_unfrozen)
    best_acc, best_state = 0.0, None

    for epoch in range(epochs_unfrozen):
        tl, _  = run_epoch(train_dl, training=True,  optimizer=opt2)
        vl, va = run_epoch(val_dl,   training=False)
        sched2.step()
        history["train_loss"].append(tl)
        history["val_loss"].append(vl)
        history["val_acc"].append(va)
        print(f"  Epoch {epoch+1:02d}/{epochs_unfrozen}  "
              f"train_loss={tl:.4f}  val_loss={vl:.4f}  val_acc={va:.3f}"
              + ("  ← best" if va > best_acc else ""))
        if va > best_acc:
            best_acc   = va
            best_state = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    # ── Save best model ───────────────────────────────────────
    save_path.mkdir(parents=True, exist_ok=True)
    torch.save(best_state, save_path / "router_best.pt")
    import json
    with open(save_path / "class_map.json", "w") as f:
        json.dump({"id2label": {i: c for i, c in enumerate(train_ds.classes)},
                   "label2id": {c: i for i, c in enumerate(train_ds.classes)}}, f, indent=2)

    print(f"\n✅  Best val accuracy: {best_acc:.3f}")
    print(f"   Weights saved → {save_path}/router_best.pt")

    # ── Training curves ───────────────────────────────────────
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 4))
    ax1.plot(history["train_loss"], label="Train Loss")
    ax1.plot(history["val_loss"],   label="Val Loss")
    ax1.set_title("Loss"); ax1.legend(); ax1.grid(True, alpha=0.3)
    ax2.plot(history["val_acc"], color="green")
    ax2.axhline(best_acc, linestyle="--", color="red", label=f"Best: {best_acc:.3f}")
    ax2.set_title("Val Accuracy"); ax2.legend(); ax2.grid(True, alpha=0.3)
    plt.suptitle("SigLIP Router Fine-tuning", fontsize=13)
    plt.tight_layout()
    plt.savefig(str(LOGS / "router_training_curves.png"), dpi=130)
    plt.show()

    # ── Confusion matrix ─────────────────────────────────────
    model.load_state_dict(best_state)
    model.eval()
    all_preds, all_labels = [], []
    with torch.no_grad():
        for imgs, labels in val_dl:
            preds = model(imgs.to(DEVICE)).argmax(1).cpu()
            all_preds.extend(preds.tolist())
            all_labels.extend(labels.tolist())

    print("\nClassification Report:")
    print(classification_report(all_labels, all_preds,
                                 target_names=train_ds.classes))

    cm = confusion_matrix(all_labels, all_preds)
    fig, ax = plt.subplots(figsize=(8, 6))
    im = ax.imshow(cm, cmap="Blues")
    ax.set_xticks(range(N_CLASSES)); ax.set_xticklabels(train_ds.classes, rotation=45)
    ax.set_yticks(range(N_CLASSES)); ax.set_yticklabels(train_ds.classes)
    for i in range(N_CLASSES):
        for j in range(N_CLASSES):
            ax.text(j, i, str(cm[i, j]), ha="center", va="center",
                    color="white" if cm[i, j] > cm.max() / 2 else "black")
    ax.set_xlabel("Predicted"); ax.set_ylabel("True")
    ax.set_title("Confusion Matrix — Router")
    plt.colorbar(im)
    plt.tight_layout()
    plt.savefig(str(LOGS / "router_confusion_matrix.png"), dpi=130)
    plt.show()

    return model

# ── Run it ────────────────────────────────────────────────────
router_model = finetune_router()


# ════════════════════════════════════════════════════════════════
#  SECTION 3 — FINE-TUNE: ROAD DAMAGE YOLO
#  Base model: keremberke/yolov8s-road-damage-detection
#  Classes: Pothole, Longitudinal Crack, Transverse Crack,
#           Alligator Crack, Rutting, Patching
# ════════════════════════════════════════════════════════════════

# ── CELL 3-A : Download RDD2022 dataset + add your own data ──
"""
DATASET OPTIONS (pick one or combine):

Option A — Roboflow Universe (easiest, pre-formatted for YOLO):
  1. Go to roboflow.com/universe
  2. Search "road damage"
  3. Export as "YOLOv8" format
  4. Copy the download snippet below

Option B — RDD2022 official dataset (largest, 21k images):
  Download from: https://github.com/sekilab/RoadDamageDetector
  Covers Japan, India, Czech Republic, Norway — India subset is very useful

Option C — Mix both (recommended):
  Use RDD2022 as base + add your own Indian road photos via Roboflow

FOLDER STRUCTURE for YOLO training:
  finetune_data/
  └── roads/
      ├── images/
      │   ├── train/   ← your road damage photos (.jpg)
      │   └── val/     ← validation photos
      └── labels/
          ├── train/   ← YOLO format .txt files (one per image)
          └── val/

YOLO label format (one line per object):
  class_id  x_center  y_center  width  height
  (all values normalized 0-1)
  Example: 0 0.512 0.341 0.234 0.189

CLASS IDs for road damage:
  0 = Pothole
  1 = Longitudinal Crack
  2 = Transverse Crack
  3 = Alligator Crack
  4 = Rutting
  5 = Patching
"""

import yaml

ROADS_DATA = FT_DATA / "roads"

# ── Create data.yaml for YOLO training ───────────────────────
roads_yaml = {
    "path"  : str(ROADS_DATA),
    "train" : "images/train",
    "val"   : "images/val",
    "nc"    : 6,
    "names" : ["Pothole", "Longitudinal_Crack", "Transverse_Crack",
               "Alligator_Crack", "Rutting", "Patching"],
}

roads_yaml_path = ROADS_DATA / "data.yaml"
if ROADS_DATA.exists():
    with open(str(roads_yaml_path), "w") as f:
        yaml.dump(roads_yaml, f, default_flow_style=False)
    print(f"✅  data.yaml created at {roads_yaml_path}")
else:
    print(f"⚠️  {ROADS_DATA} does not exist yet.")
    print("   Create it and add images/labels before running training.")


# ── CELL 3-B : Fine-tune Road YOLO ───────────────────────────
from ultralytics import YOLO
from huggingface_hub import hf_hub_download

def finetune_road_yolo(
    data_yaml   = roads_yaml_path,
    save_dir    = MODELS / "road_yolo",
    epochs      = 50,
    imgsz       = 640,
    batch       = 16,      # reduce to 8 if Colab runs out of GPU RAM
    patience    = 10,      # early stopping — stops if no improvement for 10 epochs
):
    if not data_yaml.exists():
        print(f"❌  data.yaml not found at {data_yaml}")
        return None

    print("Loading road damage base model from HuggingFace …")
    base_weights = hf_hub_download(
        "keremberke/yolov8s-road-damage-detection", "best.pt"
    )

    model = YOLO(base_weights)

    print(f"\nStarting fine-tuning:")
    print(f"  Epochs    : {epochs} (early stop at patience={patience})")
    print(f"  Image size: {imgsz}×{imgsz}")
    print(f"  Batch     : {batch}")
    print(f"  Save to   : {save_dir}\n")

    results = model.train(
        data        = str(data_yaml),
        epochs      = epochs,
        imgsz       = imgsz,
        batch       = batch,
        patience    = patience,          # early stopping
        save        = True,
        project     = str(save_dir),
        name        = "road_ft",
        device      = 0 if DEVICE == "cuda" else "cpu",

        # ── Augmentation (critical for Indian roads generalization) ──
        augment     = True,
        hsv_h       = 0.015,   # hue shift
        hsv_s       = 0.5,     # saturation
        hsv_v       = 0.4,     # brightness — important for day/night
        degrees     = 10.0,    # rotation
        translate   = 0.15,
        scale       = 0.5,     # zoom in/out
        flipud      = 0.1,     # vertical flip (rare but helps)
        fliplr      = 0.5,     # horizontal flip
        mosaic      = 1.0,     # mosaic augmentation — improves small object detection
        mixup       = 0.15,

        # ── Optimizer ────────────────────────────────────────────
        optimizer   = "AdamW",
        lr0         = 0.001,    # initial LR
        lrf         = 0.01,     # final LR = lr0 * lrf
        warmup_epochs = 3,
        weight_decay= 0.0005,

        # ── Loss weights ─────────────────────────────────────────
        box         = 7.5,      # box regression loss weight
        cls         = 0.5,      # classification loss weight
        dfl         = 1.5,

        # ── Output ───────────────────────────────────────────────
        plots       = True,     # save training plots
        verbose     = True,
    )

    best_weights = save_dir / "road_ft" / "weights" / "best.pt"
    print(f"\n✅  Fine-tuning complete.")
    print(f"   Best weights → {best_weights}")
    print(f"   mAP50       : {results.results_dict.get('metrics/mAP50(B)', 'N/A'):.4f}")
    print(f"   mAP50-95    : {results.results_dict.get('metrics/mAP50-95(B)', 'N/A'):.4f}")

    # ── Validate fine-tuned model ─────────────────────────────
    ft_model    = YOLO(str(best_weights))
    val_results = ft_model.val(data=str(data_yaml), verbose=False)
    print(f"\nValidation mAP50    : {val_results.box.map50:.4f}")
    print(f"Validation mAP50-95 : {val_results.box.map:.4f}")

    return ft_model

road_yolo = finetune_road_yolo()


# ════════════════════════════════════════════════════════════════
#  SECTION 4 — FINE-TUNE: TRASH / WASTE YOLO
#  Base model: HrutikAdsare/waste-detection-yolov8
#  Classes: Plastic, Paper, Glass, Metal, Organic,
#           E-waste, Cardboard, Medical
# ════════════════════════════════════════════════════════════════

# ── CELL 4-A : Prepare Trash Dataset ─────────────────────────
"""
RECOMMENDED DATA SOURCES:
  1. TACO Dataset    →  http://tacodataset.org
     15 categories of real trash images, ~1500 annotated images.
     Convert to YOLO format using taco2yolo.py (see below).

  2. Open Images V7 with trash classes:
     Classes to download: 'Bottle', 'Paper bag', 'Plastic bag',
     'Tin can', 'Cardboard' via openimages downloader.

  3. Your own photos — walk along an Indian roadside,
     photograph garbage piles. Annotate with Roboflow.

DATA FOLDER STRUCTURE:
  finetune_data/
  └── trash/
      ├── images/
      │   ├── train/
      │   └── val/
      └── labels/
          ├── train/
          └── val/

CLASS IDs:
  0 = Plastic     4 = Organic
  1 = Paper       5 = E-waste
  2 = Glass       6 = Cardboard
  3 = Metal       7 = Medical_waste
"""

TRASH_DATA = FT_DATA / "trash"

trash_yaml_data = {
    "path"  : str(TRASH_DATA),
    "train" : "images/train",
    "val"   : "images/val",
    "nc"    : 8,
    "names" : ["Plastic", "Paper", "Glass", "Metal",
               "Organic", "E-waste", "Cardboard", "Medical_waste"],
}

trash_yaml_path = TRASH_DATA / "data.yaml"
if TRASH_DATA.exists():
    with open(str(trash_yaml_path), "w") as f:
        yaml.dump(trash_yaml_data, f, default_flow_style=False)
    print(f"✅  Trash data.yaml created")
else:
    print(f"⚠️  Create trash data folder at: {TRASH_DATA}")


# ── CELL 4-B : Fine-tune Trash YOLO ──────────────────────────
def finetune_trash_yolo(
    data_yaml   = trash_yaml_path,
    save_dir    = MODELS / "trash_yolo",
    epochs      = 50,
    imgsz       = 640,
    batch       = 16,
    patience    = 10,
):
    if not data_yaml.exists():
        print(f"❌  data.yaml not found at {data_yaml}")
        return None

    base_weights = hf_hub_download(
        "HrutikAdsare/waste-detection-yolov8", "best.pt"
    )
    model = YOLO(base_weights)

    print("Starting Trash YOLO fine-tuning …")
    results = model.train(
        data        = str(data_yaml),
        epochs      = epochs,
        imgsz       = imgsz,
        batch       = batch,
        patience    = patience,
        save        = True,
        project     = str(save_dir),
        name        = "trash_ft",
        device      = 0 if DEVICE == "cuda" else "cpu",
        augment     = True,
        hsv_h       = 0.015,
        hsv_s       = 0.6,
        hsv_v       = 0.4,
        degrees     = 15.0,
        translate   = 0.1,
        scale       = 0.4,
        fliplr      = 0.5,
        mosaic      = 1.0,
        mixup       = 0.1,
        optimizer   = "AdamW",
        lr0         = 0.001,
        lrf         = 0.01,
        warmup_epochs = 3,
        plots       = True,
        verbose     = True,
    )

    best_weights = save_dir / "trash_ft" / "weights" / "best.pt"
    print(f"✅  Best weights → {best_weights}")
    print(f"   mAP50: {results.results_dict.get('metrics/mAP50(B)', 'N/A'):.4f}")
    return YOLO(str(best_weights))

trash_yolo = finetune_trash_yolo()


# ════════════════════════════════════════════════════════════════
#  SECTION 5 — FINE-TUNE: FLOOD / WATER SigLIP
#  Task      : Binary classification (Flooded / Not Flooded)
#  Focus     : Indian waterlogging, not just rivers/storms
# ════════════════════════════════════════════════════════════════

# ── CELL 5-A : Prepare Flood Dataset ─────────────────────────
"""
DATA SOURCES:
  1. Kaggle flood datasets:
     - "Flood Area Detection"  (5252 images)
     - "Natural Disasters Dataset"
  2. NDMA India — disaster images (government open data)
  3. Twitter/X scraped flood images from Indian cities
     (check licensing before using)
  4. Your own: waterlogged streets during monsoon

IMPORTANT — Indian-specific flooding patterns to include:
  ✅  Waterlogged streets (not rivers)
  ✅  Flooded underpass
  ✅  Submerged vehicles on road
  ✅  Water above ankle level on street
  ❌  NOT rivers overflowing (different problem)
  ❌  NOT swimming pools or beaches

FOLDER STRUCTURE:
  finetune_data/
  └── flood/
      ├── train/
      │   ├── flooded/       ← flooded Indian street photos
      │   └── not_flooded/   ← normal dry street photos
      └── val/
          ├── flooded/
          └── not_flooded/
"""

FLOOD_DATA  = FT_DATA / "flood"
FLOOD_TRAIN = FLOOD_DATA / "train"
FLOOD_VAL   = FLOOD_DATA / "val"


# ── CELL 5-B : Fine-tune Flood SigLIP ────────────────────────
from transformers import (SiglipForImageClassification, AutoImageProcessor,
                           TrainingArguments, Trainer)
from datasets import Dataset, DatasetDict, Image as HFImage
import evaluate

def finetune_flood_siglip(
    train_dir   = FLOOD_TRAIN,
    val_dir     = FLOOD_VAL,
    save_path   = MODELS / "flood_siglip",
    epochs      = 15,
    batch_size  = 16,
    lr          = 2e-5,
):
    if not train_dir.exists():
        print(f"❌  Flood training data not found at {train_dir}")
        return None

    FLOOD_MODEL_ID = "prithivMLmods/Flood-Image-Detection"
    processor = AutoImageProcessor.from_pretrained(FLOOD_MODEL_ID)

    # ── Build HuggingFace Dataset from folder ─────────────────
    def load_image_folder(folder: Path):
        paths, labels = [], []
        label2id = {"flooded": 0, "not_flooded": 1}
        for class_dir in sorted(folder.iterdir()):
            if class_dir.is_dir() and class_dir.name in label2id:
                for img_file in class_dir.glob("*"):
                    if img_file.suffix.lower() in {".jpg", ".jpeg", ".png"}:
                        paths.append(str(img_file))
                        labels.append(label2id[class_dir.name])
        return {"image": paths, "label": labels}

    train_dict = load_image_folder(train_dir)
    val_dict   = load_image_folder(val_dir)

    train_ds = Dataset.from_dict(train_dict).cast_column("image", HFImage())
    val_ds   = Dataset.from_dict(val_dict).cast_column("image",   HFImage())

    print(f"Train: {len(train_ds)} images  |  Val: {len(val_ds)} images")

    # ── Preprocessing ─────────────────────────────────────────
    from torchvision.transforms import (Compose, Resize, RandomHorizontalFlip,
                                         RandomRotation, ColorJitter, ToTensor)
    from PIL import Image as PILImage
    import numpy as np

    def preprocess_train(batch):
        imgs = [
            processor(images=img.convert("RGB"), return_tensors="pt")["pixel_values"][0]
            for img in batch["image"]
        ]
        return {"pixel_values": imgs, "labels": batch["label"]}

    def preprocess_val(batch):
        imgs = [
            processor(images=img.convert("RGB"), return_tensors="pt")["pixel_values"][0]
            for img in batch["image"]
        ]
        return {"pixel_values": imgs, "labels": batch["label"]}

    train_ds = train_ds.map(preprocess_train, batched=True,
                             remove_columns=["image"], batch_size=32)
    val_ds   = val_ds.map(preprocess_val,   batched=True,
                           remove_columns=["image"], batch_size=32)
    train_ds.set_format("torch")
    val_ds.set_format("torch")

    # ── Load fine-tune model ──────────────────────────────────
    model = SiglipForImageClassification.from_pretrained(
        FLOOD_MODEL_ID,
        num_labels      = 2,
        id2label        = {0: "Flooded Scene", 1: "Non Flooded"},
        label2id        = {"Flooded Scene": 0, "Non Flooded": 1},
        ignore_mismatched_sizes = True,
    )

    # ── Metrics ───────────────────────────────────────────────
    accuracy = evaluate.load("accuracy")
    def compute_metrics(eval_pred):
        logits, labels = eval_pred
        preds = np.argmax(logits, axis=1)
        return accuracy.compute(predictions=preds, references=labels)

    # ── Training arguments ────────────────────────────────────
    training_args = TrainingArguments(
        output_dir                  = str(save_path),
        num_train_epochs            = epochs,
        per_device_train_batch_size = batch_size,
        per_device_eval_batch_size  = batch_size,
        learning_rate               = lr,
        weight_decay                = 0.01,
        warmup_ratio                = 0.1,
        lr_scheduler_type           = "cosine",
        evaluation_strategy         = "epoch",
        save_strategy               = "epoch",
        load_best_model_at_end      = True,
        metric_for_best_model       = "accuracy",
        logging_steps               = 20,
        fp16                        = (DEVICE == "cuda"),
        push_to_hub                 = False,
        report_to                   = "none",
    )

    trainer = Trainer(
        model           = model,
        args            = training_args,
        train_dataset   = train_ds,
        eval_dataset    = val_ds,
        compute_metrics = compute_metrics,
    )

    print("Starting Flood SigLIP fine-tuning …")
    trainer.train()

    # ── Save + evaluate ───────────────────────────────────────
    trainer.save_model(str(save_path / "best"))
    processor.save_pretrained(str(save_path / "best"))

    eval_result = trainer.evaluate()
    print(f"\n✅  Flood model fine-tuned")
    print(f"   Val accuracy: {eval_result['eval_accuracy']:.4f}")
    print(f"   Saved to    : {save_path}/best")

    return model

flood_model = finetune_flood_siglip()


# ════════════════════════════════════════════════════════════════
#  SECTION 6 — FINE-TUNE: YOLO-World (Lighting + Parks)
#  Task: Few-shot fine-tuning using your own annotated images
#  Note: Requires Colab Pro (A100) for stable training.
#        Can run on T4 with batch=4 and imgsz=416.
# ════════════════════════════════════════════════════════════════

# ── CELL 6-A : Prepare Lighting + Parks Data ─────────────────
"""
HOW TO ANNOTATE YOUR PHOTOS:
  1. Go to roboflow.com  →  Create free account
  2. Create new project → "Object Detection"
  3. Upload your lighting / park damage photos
  4. Draw bounding boxes with Roboflow annotation tool
  5. Export as "YOLOv8" format
  6. Copy download code they give you

MINIMUM DATA FOR YOLO-WORLD FINE-TUNE:
  Per class: 80–150 annotated images is enough
  (YOLO-World needs far LESS data than standard YOLO
   because its vision-language backbone already understands context)

LIGHTING CLASSES TO ANNOTATE:
  0 = broken_street_light
  1 = damaged_pole
  2 = missing_lamp
  3 = fallen_pole

PARKS CLASSES TO ANNOTATE:
  0 = broken_bench
  1 = damaged_playground
  2 = cracked_footpath
  3 = fallen_tree
  4 = broken_fence
"""

LIGHTING_DATA = FT_DATA / "lighting"
PARKS_DATA    = FT_DATA / "parks"

lighting_yaml_data = {
    "path"  : str(LIGHTING_DATA),
    "train" : "images/train",
    "val"   : "images/val",
    "nc"    : 4,
    "names" : ["broken_street_light", "damaged_pole",
               "missing_lamp", "fallen_pole"],
}

parks_yaml_data = {
    "path"  : str(PARKS_DATA),
    "train" : "images/train",
    "val"   : "images/val",
    "nc"    : 5,
    "names" : ["broken_bench", "damaged_playground",
               "cracked_footpath", "fallen_tree", "broken_fence"],
}

for data_dir, yaml_data, name in [
    (LIGHTING_DATA, lighting_yaml_data, "lighting"),
    (PARKS_DATA,    parks_yaml_data,    "parks"),
]:
    if data_dir.exists():
        with open(str(data_dir / "data.yaml"), "w") as f:
            yaml.dump(yaml_data, f, default_flow_style=False)
        print(f"✅  {name} data.yaml created")
    else:
        print(f"⚠️  Create {name} data at: {data_dir}")


# ── CELL 6-B : Fine-tune YOLO-World ──────────────────────────
def finetune_yolo_world(
    category      = "lighting",    # "lighting" or "parks"
    data_yaml_path = LIGHTING_DATA / "data.yaml",
    save_dir      = MODELS / "lighting_yolo",
    epochs        = 30,
    imgsz         = 640,
    batch         = 8,             # YOLO-World needs more RAM than standard YOLO
    patience      = 8,
):
    if not data_yaml_path.exists():
        print(f"❌  data.yaml not found at {data_yaml_path}")
        return None

    # YOLO-World uses the standard YOLO training API
    # but loads the world model weights
    model = YOLO("yolov8s-worldv2.pt")

    print(f"Fine-tuning YOLO-World for '{category}' …")
    print(f"  Note: lower imgsz={imgsz} + batch={batch} to fit T4 GPU")

    results = model.train(
        data          = str(data_yaml_path),
        epochs        = epochs,
        imgsz         = imgsz,
        batch         = batch,
        patience      = patience,
        save          = True,
        project       = str(save_dir),
        name          = f"{category}_world_ft",
        device        = 0 if DEVICE == "cuda" else "cpu",
        augment       = True,
        hsv_v         = 0.4,      # brightness aug is important for lighting issues
        degrees       = 10.0,
        translate     = 0.1,
        scale         = 0.3,
        fliplr        = 0.5,
        mosaic        = 0.8,
        optimizer     = "AdamW",
        lr0           = 5e-4,
        lrf           = 0.01,
        warmup_epochs = 2,
        plots         = True,
        verbose       = True,
    )

    best_weights = save_dir / f"{category}_world_ft" / "weights" / "best.pt"
    print(f"✅  Best weights → {best_weights}")
    return YOLO(str(best_weights))

# Fine-tune for each category separately
lighting_yolo = finetune_yolo_world(
    category       = "lighting",
    data_yaml_path = LIGHTING_DATA / "data.yaml",
    save_dir       = MODELS / "lighting_yolo",
)

parks_yolo = finetune_yolo_world(
    category       = "parks",
    data_yaml_path = PARKS_DATA / "data.yaml",
    save_dir       = MODELS / "parks_yolo",
)


# ════════════════════════════════════════════════════════════════
#  SECTION 7 — ASSEMBLE FINE-TUNED PIPELINE
#  Drop-in replacement for the original inference notebook.
#  Load fine-tuned weights instead of HuggingFace pretrained.
# ════════════════════════════════════════════════════════════════

# ── CELL 7 : Load Fine-tuned Models for Inference ────────────
import json

def load_finetuned_pipeline():
    models = {}

    # ── Router ────────────────────────────────────────────────
    router_path = MODELS / "router_finetuned" / "router_best.pt"
    class_map_path = MODELS / "router_finetuned" / "class_map.json"
    if router_path.exists():
        base      = SiglipModel.from_pretrained(SIGLIP_ID)
        router_ft = SigLIPClassifier(base, N_CLASSES, freeze_base=False)
        router_ft.load_state_dict(torch.load(str(router_path),
                                              map_location=DEVICE))
        router_ft = router_ft.to(DEVICE).eval()
        with open(str(class_map_path)) as f:
            class_info = json.load(f)
        models["router"]     = router_ft
        models["id2label"]   = class_info["id2label"]
        print("✅  Fine-tuned router loaded")
    else:
        print("⚠️  Fine-tuned router not found — using pretrained SigLIP zero-shot")

    # ── Road YOLO ─────────────────────────────────────────────
    road_ft_path = MODELS / "road_yolo" / "road_ft" / "weights" / "best.pt"
    if road_ft_path.exists():
        models["road"] = YOLO(str(road_ft_path))
        print("✅  Fine-tuned road YOLO loaded")
    else:
        print("⚠️  Fine-tuned road YOLO not found — using pretrained")
        models["road"] = YOLO(hf_hub_download(
            "keremberke/yolov8s-road-damage-detection", "best.pt"))

    # ── Trash YOLO ────────────────────────────────────────────
    trash_ft_path = MODELS / "trash_yolo" / "trash_ft" / "weights" / "best.pt"
    if trash_ft_path.exists():
        models["trash"] = YOLO(str(trash_ft_path))
        print("✅  Fine-tuned trash YOLO loaded")
    else:
        print("⚠️  Fine-tuned trash YOLO not found — using pretrained")
        models["trash"] = YOLO(hf_hub_download(
            "HrutikAdsare/waste-detection-yolov8", "best.pt"))

    # ── Flood SigLIP ──────────────────────────────────────────
    flood_ft_path = MODELS / "flood_siglip" / "best"
    if flood_ft_path.exists():
        models["flood_processor"] = AutoImageProcessor.from_pretrained(
            str(flood_ft_path))
        models["flood"] = SiglipForImageClassification.from_pretrained(
            str(flood_ft_path)).to(DEVICE).eval()
        models["flood_id2label"] = models["flood"].config.id2label
        print("✅  Fine-tuned flood SigLIP loaded")
    else:
        print("⚠️  Fine-tuned flood SigLIP not found — using pretrained")

    # ── Lighting YOLO ─────────────────────────────────────────
    lighting_ft_path = (MODELS / "lighting_yolo" / "lighting_world_ft"
                        / "weights" / "best.pt")
    if lighting_ft_path.exists():
        models["lighting"] = YOLO(str(lighting_ft_path))
        print("✅  Fine-tuned lighting YOLO loaded")
    else:
        print("⚠️  Lighting YOLO not fine-tuned — YOLO-World zero-shot will be used")
        models["lighting"] = None

    # ── Parks YOLO ────────────────────────────────────────────
    parks_ft_path = (MODELS / "parks_yolo" / "parks_world_ft"
                     / "weights" / "best.pt")
    if parks_ft_path.exists():
        models["parks"] = YOLO(str(parks_ft_path))
        print("✅  Fine-tuned parks YOLO loaded")
    else:
        print("⚠️  Parks YOLO not fine-tuned — YOLO-World zero-shot will be used")
        models["parks"] = None

    return models

ft_models = load_finetuned_pipeline()


# ════════════════════════════════════════════════════════════════
#  SECTION 8 — MODEL VERSIONING + PROGRESS TRACKER
#  Keep track of which version you are using and its metrics.
# ════════════════════════════════════════════════════════════════

# ── CELL 8 : Save Model Registry ─────────────────────────────
import datetime, json

REGISTRY_PATH = MODELS / "model_registry.json"

def update_registry(model_name: str, version: str,
                    metrics: dict, notes: str = ""):
    """
    Call this after every fine-tuning run to keep a history.
    Example:
      update_registry("road_yolo", "v2",
                      {"mAP50": 0.812, "mAP50-95": 0.541},
                      "Trained on RDD2022 + 200 Indian photos")
    """
    registry = {}
    if REGISTRY_PATH.exists():
        with open(str(REGISTRY_PATH)) as f:
            registry = json.load(f)

    registry[model_name] = {
        "version"  : version,
        "date"     : datetime.datetime.now().isoformat()[:10],
        "metrics"  : metrics,
        "notes"    : notes,
        "weights"  : str(MODELS / f"{model_name}"),
    }

    with open(str(REGISTRY_PATH), "w") as f:
        json.dump(registry, f, indent=2)
    print(f"  Registry updated: {model_name} → {version}")


def print_registry():
    if not REGISTRY_PATH.exists():
        print("No registry yet. Train a model first.")
        return
    with open(str(REGISTRY_PATH)) as f:
        reg = json.load(f)
    print("═" * 70)
    print("  URBANFIX AI — MODEL REGISTRY")
    print("═" * 70)
    print(f"  {'Model':<20} {'Version':<8} {'Date':<12} {'Metrics'}")
    print("  " + "─" * 66)
    for name, info in reg.items():
        m = "  ".join(f"{k}={v:.3f}" for k, v in info["metrics"].items())
        print(f"  {name:<20} {info['version']:<8} {info['date']:<12} {m}")
        if info.get("notes"):
            print(f"  {'':20} {info['notes']}")
    print("═" * 70)

print_registry()


# ════════════════════════════════════════════════════════════════
#  QUICK REFERENCE — TIMELINE + EFFORT SUMMARY
# ════════════════════════════════════════════════════════════════
"""
REALISTIC TIMELINE (working on this part-time):

Week 1 — Data collection
  □  Collect 300 images per router category (phone + Google Images)
  □  Download RDD2022 road dataset
  □  Download TACO trash dataset
  □  Download Kaggle flood dataset

Week 2 — Annotation
  □  Set up Roboflow free account
  □  Annotate 200 lighting photos (bbox)
  □  Annotate 150 parks photos (bbox)
  □  Annotate personal road/trash photos to supplement datasets

Week 3 — Training (all on Colab)
  □  Fine-tune SigLIP router       (~1.5 hrs on T4)
  □  Fine-tune Road YOLO           (~45 min on T4)
  □  Fine-tune Trash YOLO          (~40 min on T4)
  □  Fine-tune Flood SigLIP        (~30 min on T4)
  □  Fine-tune YOLO-World lighting (~1 hr on T4)
  □  Fine-tune YOLO-World parks    (~1 hr on T4)

Week 4 — Evaluate + iterate
  □  Run confusion matrix on router
  □  Check mAP scores per YOLO class
  □  Add more data for any underperforming category
  □  Re-train with augmented data

EXPECTED IMPROVEMENT after fine-tuning:
  ┌────────────┬──────────────────┬─────────────────────────────┐
  │ Model      │ Before (pretrained) │ After (fine-tuned)       │
  ├────────────┼──────────────────┼─────────────────────────────┤
  │ Router     │ ~70% on Indian   │ ~90%+ on Indian photos      │
  │            │ street photos    │                             │
  ├────────────┼──────────────────┼─────────────────────────────┤
  │ Road YOLO  │ Good on global   │ Much better on Indian roads │
  │            │ data, misses     │ (patched repairs, different │
  │            │ Indian patterns  │ crack patterns)             │
  ├────────────┼──────────────────┼─────────────────────────────┤
  │ Trash YOLO │ Western garbage  │ Indian street garbage types │
  │            │ types            │ (polythene bags, etc.)      │
  ├────────────┼──────────────────┼─────────────────────────────┤
  │ Flood      │ 95.6% on global  │ Better on Indian monsoon    │
  │            │ floods           │ waterlogging scenarios      │
  ├────────────┼──────────────────┼─────────────────────────────┤
  │ Lighting   │ Zero-shot (60-   │ Proper bbox detection 75%+  │
  │            │ 70% conf only)   │                             │
  ├────────────┼──────────────────┼─────────────────────────────┤
  │ Parks      │ Zero-shot only   │ Proper bbox detection 70%+  │
  └────────────┴──────────────────┴─────────────────────────────┘

COLAB TIPS FOR LONG TRAINING RUNS:
  1. Enable Colab Pro ($10/month) — get A100 or V100 GPUs
  2. Add this to prevent timeout disconnection:
     Javascript trick: F12 → Console → paste:
     setInterval(function() {
       document.querySelector('#ok').click()
     }, 60000)
  3. Save checkpoints every 5 epochs (already configured above)
  4. Use Google Drive for all outputs so nothing is lost on crash
"""
