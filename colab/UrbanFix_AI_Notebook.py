# ============================================================
#  UrbanFix AI — Full Detection Pipeline
#  Save this file to: MyDrive/UrbanFix_AI/colab/
#  Place test images in: MyDrive/UrbanFix_AI/data/
# ============================================================
# To use as a Colab notebook:
#   Each section marked  # ── CELL N ──  is one notebook cell.
#   Copy each block into its own Colab cell in order.
# ============================================================


# ── CELL 1 ── Mount Drive + Verify Folder Structure
# ============================================================
from google.colab import drive
import os
from pathlib import Path

drive.mount("/content/drive")

# ── Paths (change ONLY if your folder name differs) ──────────
BASE_DIR  = Path("/content/drive/MyDrive/UrbanFix_AI")
DATA_DIR  = BASE_DIR / "data"
COLAB_DIR = BASE_DIR / "colab"
OUT_DIR   = BASE_DIR / "outputs"       # results will be saved here

# Create outputs folder if it doesn't exist yet
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Verify ───────────────────────────────────────────────────
for d, label in [(BASE_DIR, "UrbanFix_AI"), (DATA_DIR, "data"),
                 (COLAB_DIR, "colab"), (OUT_DIR, "outputs")]:
    status = "✅" if d.exists() else "❌ NOT FOUND"
    print(f"  {status}  {label}  →  {d}")

print("\nDrive mounted and paths verified.")


# ── CELL 2 ── Check Available Images
# ============================================================
SUPPORTED = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}

images = sorted([
    f for f in DATA_DIR.glob("*")
    if f.suffix.lower() in SUPPORTED
])

if not images:
    print("⚠️  No images found in data/ folder.")
    print(f"   Place your civic issue photos in:  {DATA_DIR}")
else:
    print(f"✅  Found {len(images)} image(s):\n")
    for i, f in enumerate(images, 1):
        size_kb = f.stat().st_size // 1024
        print(f"  [{i:02d}]  {f.name:<40}  {size_kb} KB")


# ── CELL 3 ── Install All Required Packages
# ============================================================
# Run once per Colab session — takes ~90 seconds
print("Installing packages …")

import subprocess, sys

pkgs = [
    "open_clip_torch",
    "ultralytics",
    "huggingface_hub",
    "torch",
    "torchvision",
    "pillow",
    "matplotlib",
    "transformers",
    "accelerate",
    "scipy",
]

subprocess.check_call(
    [sys.executable, "-m", "pip", "install", "-q"] + pkgs,
    stdout=subprocess.DEVNULL
)

print("✅  All packages installed.")


# ── CELL 4 ── Load + Display One Image (sanity check)
# ============================================================
from PIL import Image, ImageDraw, ImageFont
import matplotlib.pyplot as plt

# ── Change index to preview a different image ──────────────
PREVIEW_INDEX = 0

if images:
    img_path = images[PREVIEW_INDEX]
    img = Image.open(str(img_path)).convert("RGB")

    plt.figure(figsize=(9, 6))
    plt.imshow(img)
    plt.title(f"{img_path.name}   |   {img.size[0]}×{img.size[1]} px",
              fontsize=12, pad=10)
    plt.axis("off")
    plt.tight_layout()
    plt.show()

    print(f"Image : {img_path.name}")
    print(f"Size  : {img.size[0]} × {img.size[1]} px")
    print(f"Mode  : {img.mode}")
else:
    print("No images to display.")


# ── CELL 5 ── Load ALL Models  (run once per session)
# ============================================================
# Expected time: ~3–5 min on first run (downloads ~1.2 GB total)
# Subsequent runs are instant (cached in /root/.cache/)
# ============================================================
import torch
from transformers import AutoProcessor, AutoModel, \
                         AutoImageProcessor, SiglipForImageClassification
from huggingface_hub import hf_hub_download
from ultralytics import YOLO, YOLOWorld
import torch.nn.functional as F

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Device: {DEVICE}\n")

# ─────────────────────────────────────────────────────────────
# HELPER — safe model download with fallback message
# ─────────────────────────────────────────────────────────────
def safe_hf_download(repo_id: str, filename: str):
    try:
        path = hf_hub_download(repo_id, filename)
        print(f"    ✅  {repo_id}")
        return path
    except Exception as e:
        print(f"    ❌  {repo_id}  —  {e}")
        return None


# ─────────────────────────────────────────────────────────────
# 1. ROUTER — SigLIP zero-shot classifier
#    Upgraded from OpenCLIP: SigLIP is more accurate for
#    fine-grained zero-shot scene classification.
# ─────────────────────────────────────────────────────────────
print("① Loading SigLIP router …")
try:
    SIGLIP_ID = "google/siglip-base-patch16-384"
    siglip_processor = AutoProcessor.from_pretrained(SIGLIP_ID)
    siglip_model     = AutoModel.from_pretrained(SIGLIP_ID).to(DEVICE).eval()
    print("   ✅  SigLIP router ready")
except Exception as e:
    print(f"   ❌  SigLIP failed: {e}")
    siglip_model = None

# Category names  +  text prompts used for zero-shot matching
CATEGORIES = ["roads", "trash", "water", "lighting", "parks", "other"]

CATEGORY_PROMPTS = [
    "a damaged road with potholes cracks or broken asphalt surface",
    "garbage litter trash or illegally dumped waste on the ground",
    "flooded street waterlogged road or stagnant water on the road",
    "a broken dark or missing street light lamp pole at night",
    "a damaged park with broken bench cracked path or fallen tree",
    "a normal everyday photo that is not a civic infrastructure issue",
]


# ─────────────────────────────────────────────────────────────
# 2. ROADS — YOLOv8 road damage
#    HF: ozair23/yolov8-road-damage-detector (public, works in Colab)
#    (keremberke repo was removed from HF — do not re-add)
#    Later: set road_model_primary = YOLO("/path/to/road_damage_best.pt")
#           from UrbanFix_RoadDamage_Train.py when training finishes.
# ─────────────────────────────────────────────────────────────
print("\n② Loading Road Damage models …")
road_model_primary  = None
road_model_backup   = None

path_road = safe_hf_download("ozair23/yolov8-road-damage-detector", "best.pt")
if path_road:
    road_model_primary = YOLO(path_road)

if not road_model_primary:
    print("   ⚠️  No road model loaded — road detection will be skipped")


# ─────────────────────────────────────────────────────────────
# 3. TRASH — YOLOv8  (8 waste classes)
# ─────────────────────────────────────────────────────────────
print("\n③ Loading Trash / Waste model …")
trash_model = None

path_t = safe_hf_download("HrutikAdsare/waste-detection-yolov8", "best.pt")
if path_t:
    trash_model = YOLO(path_t)


# ─────────────────────────────────────────────────────────────
# 4. WATER — SigLIP classifier  (95.6 % accuracy on flood data)
#    BUG FIX: labels are read from model.config.id2label
#    instead of hardcoding probs[0] which is fragile.
# ─────────────────────────────────────────────────────────────
print("\n④ Loading Flood Detection model …")
flood_processor = None
flood_model     = None
FLOOD_ID2LABEL  = {}

try:
    FLOOD_HF_ID     = "prithivMLmods/Flood-Image-Detection"
    flood_processor = AutoImageProcessor.from_pretrained(FLOOD_HF_ID)
    flood_model     = SiglipForImageClassification \
                        .from_pretrained(FLOOD_HF_ID).to(DEVICE).eval()

    # ── BUG FIX: read label map from model config, not hardcoded ──
    raw = flood_model.config.id2label          # e.g. {0: "Flooded Scene", 1: "Non Flooded"}
    FLOOD_ID2LABEL = {int(k): v for k, v in raw.items()}
    FLOOD_LABEL_IDX = {v: k for k, v in FLOOD_ID2LABEL.items()}
    print(f"   ✅  Flood model ready  |  labels: {FLOOD_ID2LABEL}")
except Exception as e:
    print(f"   ❌  Flood model failed: {e}")


# ─────────────────────────────────────────────────────────────
# 5. LIGHTING + PARKS — YOLO-World  (open-vocabulary detection)
#    YOLO-World accepts text prompts as class definitions.
#    No training needed — describe the damage in plain English.
# ─────────────────────────────────────────────────────────────
print("\n⑤ Loading YOLO-World (lighting + parks) …")
yolo_world = None
try:
    yolo_world = YOLOWorld("yolov8s-worldv2.pt")   # auto-downloads ~50 MB
    print("   ✅  YOLO-World ready")
except Exception as e:
    print(f"   ❌  YOLO-World failed: {e}")

# Text class prompts — describe what you want to detect
LIGHTING_CLASSES = [
    "broken street light",
    "damaged light pole",
    "missing street lamp",
    "fallen electric pole",
    "dark unlit street lamp",
]

PARKS_CLASSES = [
    "broken park bench",
    "damaged playground equipment",
    "cracked footpath pavement",
    "fallen tree blocking path",
    "broken fence",
    "garbage dumped in park",
    "vandalized wall graffiti",
]

print("\n" + "═" * 55)
print("  ALL MODELS LOADED — ready to run pipeline")
print("═" * 55)


# ── CELL 6 ── Core Pipeline Function
# ============================================================
# analyze_image()  — full pipeline:
#   Stage 0: Image validation  (reject selfies, memes, etc.)
#   Stage 1: SigLIP router  →  category
#   Stage 2: specialist model  →  detected issues + bboxes
#   Stage 3–8: severity, priority, department, tags, confirmation
# ============================================================
import json
import numpy as np

# ── Image Validation prompts ─────────────────────────────────
# Used in Stage 0 to reject non-civic images via SigLIP zero-shot.
VALID_PROMPTS = [
    "a photo of a road street sidewalk or outdoor infrastructure",
    "a photo of garbage trash waste or litter on the ground outside",
    "a photo of a street light lamp pole or outdoor electrical fixture",
    "a photo of water flooding or waterlogged road outdoors",
    "a photo of a park playground bench or outdoor public space",
]

INVALID_PROMPTS = [
    "a selfie portrait photo of a person face close up",
    "a screenshot of a phone computer screen or app interface",
    "a photo taken indoors inside a room house or building",
    "a meme funny image text overlay or internet joke picture",
    "a blurry out of focus dark or completely unrecognizable image",
    "a photo of food plate meal or restaurant",
    "a document paper receipt or text page",
]

VALIDATION_THRESHOLD = 0.55


def validate_image(pil_img: Image.Image) -> dict:
    """
    Check if the image is a valid outdoor civic issue photo.
    Uses SigLIP zero-shot matching against valid vs invalid prompts.
    Returns: {is_valid, confidence, rejection_reason}
    """
    if siglip_model is None:
        return {"is_valid": True, "confidence": 0, "rejection_reason": None}

    W, H = pil_img.size
    if W < 200 or H < 200:
        return {"is_valid": False, "confidence": 1.0,
                "rejection_reason": f"Image too small ({W}x{H}). Minimum 200x200 px."}

    all_prompts = VALID_PROMPTS + INVALID_PROMPTS
    n_valid     = len(VALID_PROMPTS)

    inputs = siglip_processor(
        text=all_prompts, images=pil_img,
        return_tensors="pt", padding="max_length", truncation=True,
    ).to(DEVICE)

    with torch.no_grad():
        outputs = siglip_model(**inputs)
        logits  = outputs.logits_per_image
        scores  = F.softmax(logits, dim=-1)[0].cpu().tolist()

    valid_score   = sum(scores[:n_valid])
    invalid_score = sum(scores[n_valid:])

    if invalid_score > VALIDATION_THRESHOLD:
        best_invalid_idx = max(range(n_valid, len(scores)), key=lambda i: scores[i])
        reasons = {
            0: "Selfie / person portrait detected",
            1: "Screenshot detected",
            2: "Indoor photo detected",
            3: "Meme / joke image detected",
            4: "Blurry / unrecognizable image",
            5: "Food photo detected",
            6: "Document / text page detected",
        }
        reason = reasons.get(best_invalid_idx - n_valid, "Not a civic issue photo")
        return {"is_valid": False, "confidence": round(invalid_score, 4),
                "rejection_reason": reason}

    return {"is_valid": True, "confidence": round(valid_score, 4),
            "rejection_reason": None}


def analyze_image(pil_img: Image.Image, img_name: str = "unknown",
                  skip_validation: bool = False) -> dict:
    """
    Run the full UrbanFix detection pipeline on one PIL image.
    Returns a structured dict ready for the app backend.
    """
    result = {
        "image"              : img_name,
        "is_valid"           : True,
        "validation_reason"  : None,
        "category"           : "other",
        "category_confidence": 0.0,
        "all_category_scores": {},
        "model_used"         : "none",
        "detected_issues"    : [],
        "issue_count"        : 0,
        "main_issue"         : "No issue detected",
        "size"               : "unknown",
        "severity"           : 1,
        "ai_severity"        : "Low",
        "priority_score"     : 0,
        "department_tag"     : "General",
        "ai_tags"            : [],
        "needs_user_confirmation": True,
        "note"               : "",
    }

    W, H      = pil_img.size
    img_area  = W * H

    # ─────────────────────────────────────────────────────────
    # STAGE 0 — Image Validation (reject selfies, memes, etc.)
    # ─────────────────────────────────────────────────────────
    if not skip_validation:
        validation = validate_image(pil_img)
        result["is_valid"]          = validation["is_valid"]
        result["validation_reason"] = validation["rejection_reason"]

        if not validation["is_valid"]:
            result["note"] = (
                f"Image rejected: {validation['rejection_reason']} "
                f"(confidence: {validation['confidence']:.1%}). "
                "Please upload a clear outdoor photo of a civic issue."
            )
            return result

    # ─────────────────────────────────────────────────────────
    # STAGE 1 — Category Detection via SigLIP zero-shot
    # ─────────────────────────────────────────────────────────
    if siglip_model is None:
        result["note"] = "SigLIP router not loaded."
        return result

    inputs = siglip_processor(
        text   = CATEGORY_PROMPTS,
        images = pil_img,
        return_tensors = "pt",
        padding = "max_length",
        truncation = True,
    ).to(DEVICE)

    with torch.no_grad():
        outputs = siglip_model(**inputs)
        logits  = outputs.logits_per_image          # shape: [1, N_categories]
        scores  = F.softmax(logits, dim=-1)[0].cpu().tolist()

    best_idx  = scores.index(max(scores))
    category  = CATEGORIES[best_idx]
    cat_conf  = round(scores[best_idx], 4)

    result["category"]            = category
    result["category_confidence"] = cat_conf
    result["all_category_scores"] = {
        CATEGORIES[i]: round(scores[i], 4) for i in range(len(CATEGORIES))
    }

    detected_issues = []

    # ─────────────────────────────────────────────────────────
    # STAGE 2a — Roads  (primary YOLO, optional backup if both loaded)
    # ─────────────────────────────────────────────────────────
    if category == "roads":
        boxes      = None
        names      = {}
        model_used = "none"

        if road_model_primary:
            res = road_model_primary.predict(pil_img, conf=0.15, verbose=False)[0]
            if res.boxes is not None and len(res.boxes) > 0:
                boxes      = res.boxes
                names      = res.names
                model_used = "ozair23/yolov8-road-damage-detector"

        if (boxes is None or len(boxes) == 0) and road_model_backup:
            res = road_model_backup.predict(pil_img, conf=0.15, verbose=False)[0]
            if res.boxes is not None and len(res.boxes) > 0:
                boxes      = res.boxes
                names      = res.names
                model_used = "ozair23/yolov8-road-damage-detector (backup)"

        result["model_used"] = model_used

        if boxes is not None and len(boxes) > 0:
            for b in boxes:
                x1, y1, x2, y2 = [round(v) for v in b.xyxy[0].tolist()]
                label = names.get(int(b.cls.item()), f"damage_class_{int(b.cls.item())}")
                detected_issues.append({
                    "label"     : label,
                    "confidence": round(float(b.conf.item()), 4),
                    "bbox"      : [x1, y1, x2, y2],
                })
        else:
            result["note"] = "Road detected by router but no damage boxes found. " \
                             "May need lower confidence threshold or more data."

    # ─────────────────────────────────────────────────────────
    # STAGE 2b — Trash / Waste
    # ─────────────────────────────────────────────────────────
    elif category == "trash":
        result["model_used"] = "HrutikAdsare/waste-detection-yolov8"

        if trash_model:
            res = trash_model.predict(pil_img, conf=0.15, verbose=False)[0]
            if res.boxes is not None and len(res.boxes) > 0:
                for b in res.boxes:
                    x1, y1, x2, y2 = [round(v) for v in b.xyxy[0].tolist()]
                    label = res.names.get(int(b.cls.item()),
                                          f"waste_class_{int(b.cls.item())}")
                    detected_issues.append({
                        "label"     : label,
                        "confidence": round(float(b.conf.item()), 4),
                        "bbox"      : [x1, y1, x2, y2],
                    })
            else:
                result["note"] = "Trash area detected by router but no waste boxes found."
        else:
            result["note"] = "Trash model not loaded."

    # ─────────────────────────────────────────────────────────
    # STAGE 2c — Water / Flood
    # BUG FIX 1: labels read from model.config.id2label
    # BUG FIX 2: explicit "no flood" case handled
    # ─────────────────────────────────────────────────────────
    elif category == "water":
        result["model_used"] = "prithivMLmods/Flood-Image-Detection"

        if flood_model and flood_processor:
            inputs = flood_processor(images=pil_img, return_tensors="pt").to(DEVICE)

            with torch.no_grad():
                logits = flood_model(**inputs).logits
                probs  = F.softmax(logits, dim=-1).squeeze().tolist()

            # Map every prob to its human label (safe, uses config)
            label_probs = {FLOOD_ID2LABEL[i]: round(float(probs[i]), 4)
                           for i in range(len(probs))}
            result["flood_label_scores"] = label_probs

            # Find the "flooded" label probability (robust to label order changes)
            flood_score = 0.0
            for lbl, prob in label_probs.items():
                if "flood" in lbl.lower():
                    flood_score = prob
                    break

            result["flood_score"] = flood_score

            if flood_score >= 0.5:
                detected_issues.append({
                    "label"     : "Flooded / Waterlogged Area",
                    "confidence": flood_score,
                    "bbox"      : None,   # classifier — no bounding box
                })
            else:
                # BUG FIX: explicit note when router says water but model disagrees
                result["note"] = (
                    f"Router classified as 'water' (conf {cat_conf}) "
                    f"but flood model score is only {flood_score:.2f}. "
                    "Likely a wet road or puddle — not severe flooding."
                )
        else:
            result["note"] = "Flood model not loaded."

    # ─────────────────────────────────────────────────────────
    # STAGE 2d — Lighting  (YOLO-World open-vocabulary)
    # ─────────────────────────────────────────────────────────
    elif category == "lighting":
        result["model_used"] = "YOLO-World (open-vocabulary)"

        if yolo_world:
            yolo_world.set_classes(LIGHTING_CLASSES)
            res = yolo_world.predict(pil_img, conf=0.10, verbose=False)[0]
            if res.boxes is not None and len(res.boxes) > 0:
                for b in res.boxes:
                    x1, y1, x2, y2 = [round(v) for v in b.xyxy[0].tolist()]
                    cls_idx = int(b.cls.item())
                    label   = LIGHTING_CLASSES[cls_idx] \
                              if cls_idx < len(LIGHTING_CLASSES) \
                              else f"lighting_issue_{cls_idx}"
                    detected_issues.append({
                        "label"     : label,
                        "confidence": round(float(b.conf.item()), 4),
                        "bbox"      : [x1, y1, x2, y2],
                    })
            else:
                result["note"] = (
                    "Lighting issue detected by router but YOLO-World "
                    "found no specific boxes. Try lower conf or more descriptive prompts."
                )
        else:
            result["note"] = "YOLO-World not loaded. Lighting detected by router only."

    # ─────────────────────────────────────────────────────────
    # STAGE 2e — Parks  (YOLO-World open-vocabulary)
    # ─────────────────────────────────────────────────────────
    elif category == "parks":
        result["model_used"] = "YOLO-World (open-vocabulary)"

        if yolo_world:
            yolo_world.set_classes(PARKS_CLASSES)
            res = yolo_world.predict(pil_img, conf=0.10, verbose=False)[0]
            if res.boxes is not None and len(res.boxes) > 0:
                for b in res.boxes:
                    x1, y1, x2, y2 = [round(v) for v in b.xyxy[0].tolist()]
                    cls_idx = int(b.cls.item())
                    label   = PARKS_CLASSES[cls_idx] \
                              if cls_idx < len(PARKS_CLASSES) \
                              else f"park_issue_{cls_idx}"
                    detected_issues.append({
                        "label"     : label,
                        "confidence": round(float(b.conf.item()), 4),
                        "bbox"      : [x1, y1, x2, y2],
                    })
            else:
                result["note"] = (
                    "Park issue detected by router but YOLO-World "
                    "found no specific boxes. Add more park photos to improve routing."
                )
        else:
            result["note"] = "YOLO-World not loaded. Park detected by router only."

    # ─────────────────────────────────────────────────────────
    # STAGE 2f — Other / Not a civic issue
    # ─────────────────────────────────────────────────────────
    else:
        result["model_used"] = "none"
        result["note"]       = (
            "Image does not appear to be a civic issue. "
            "Top category was 'other' — this photo may not show infrastructure damage."
        )

    # ─────────────────────────────────────────────────────────
    # STAGE 3 — Identify main issue + score
    # ─────────────────────────────────────────────────────────
    result["detected_issues"] = detected_issues
    result["issue_count"]     = len(detected_issues)

    if detected_issues:
        # Pick largest bbox as main issue; fall back to highest confidence
        with_box    = [d for d in detected_issues if d.get("bbox")]
        without_box = [d for d in detected_issues if not d.get("bbox")]

        if with_box:
            main_issue = max(
                with_box,
                key=lambda d: (d["bbox"][2] - d["bbox"][0]) * (d["bbox"][3] - d["bbox"][1])
            )
        else:
            main_issue = max(without_box, key=lambda d: d["confidence"])

        result["main_issue"] = main_issue["label"]
    else:
        main_issue = None
        if category != "other":
            result["main_issue"] = f"{category.title()} issue (detected by router)"
        else:
            result["main_issue"] = "No civic issue detected"

    # ─────────────────────────────────────────────────────────
    # STAGE 4 — Severity (1–5) + Priority (0–100)
    # ─────────────────────────────────────────────────────────
    size, severity, priority = "unknown", 1, 20

    if main_issue and main_issue.get("bbox"):
        bw    = main_issue["bbox"][2] - main_issue["bbox"][0]
        bh    = main_issue["bbox"][3] - main_issue["bbox"][1]
        ratio = (bw * bh) / max(img_area, 1)
        conf  = main_issue["confidence"]

        if   ratio < 0.02:  size, severity, priority = "small",     2, 35
        elif ratio < 0.08:  size, severity, priority = "medium",    3, 55
        elif ratio < 0.20:  size, severity, priority = "large",     4, 75
        else:               size, severity, priority = "very large", 5, 92

        # Confidence bonus/penalty  (±10 pts around 0.5 baseline)
        priority = int(min(100, max(0, priority + round(15 * (conf - 0.5)))))

        # Multiple issues → escalate severity
        if len(detected_issues) >= 3:
            severity = min(5, severity + 1)
            priority = min(100, priority + 8)
        if len(detected_issues) >= 6:
            priority = min(100, priority + 5)

    elif main_issue and category == "water":
        # Flood classifier — no bbox, use flood_score directly
        fs = result.get("flood_score", 0.5)
        if   fs > 0.92: size, severity, priority = "severe",   5, 95
        elif fs > 0.75: size, severity, priority = "high",     4, 78
        elif fs > 0.55: size, severity, priority = "moderate", 3, 55
        else:           size, severity, priority = "mild",     2, 35

    elif category in ("lighting", "parks") and detected_issues:
        conf = detected_issues[0]["confidence"]
        size, severity, priority = "detected", 3, int(45 + 30 * conf)

    elif category != "other":
        # Router detected category but no specific boxes
        size, severity, priority = "unconfirmed", 2, 30

    result["size"]          = size
    result["severity"]      = severity
    result["priority_score"]= priority

    # ─────────────────────────────────────────────────────────
    # STAGE 5 — Map severity int (1-5) → app-compatible string
    #   DB column ai_severity accepts: Low | Medium | High | Critical
    # ─────────────────────────────────────────────────────────
    SEVERITY_MAP = {1: "Low", 2: "Low", 3: "Medium", 4: "High", 5: "Critical"}
    result["ai_severity"] = SEVERITY_MAP.get(severity, "Low")

    # ─────────────────────────────────────────────────────────
    # STAGE 6 — Department routing (mirrors backend DEPT_MAP)
    # ─────────────────────────────────────────────────────────
    DEPT_MAP = {
        "roads": "PWD", "lighting": "Electrical", "trash": "Sanitation",
        "water": "Water Supply", "parks": "Horticulture", "other": "General",
    }
    result["department_tag"] = DEPT_MAP.get(category, "General")

    # ─────────────────────────────────────────────────────────
    # STAGE 7 — Generate ai_tags from category + detected labels
    # ─────────────────────────────────────────────────────────
    tags = [category]
    LABEL_TAG_MAP = {
        "pothole": "road-damage", "crack": "road-damage", "damage": "infrastructure",
        "garbage": "sanitation", "waste": "sanitation", "trash": "sanitation",
        "flood": "drainage", "water": "drainage", "waterlog": "drainage",
        "streetlight": "lighting", "light": "lighting", "lamp": "lighting",
        "bench": "horticulture", "tree": "horticulture", "park": "horticulture",
        "fence": "infrastructure", "broken": "infrastructure",
    }
    for issue in detected_issues:
        label_lower = issue["label"].lower()
        for keyword, tag in LABEL_TAG_MAP.items():
            if keyword in label_lower and tag not in tags:
                tags.append(tag)
    if (severity >= 4 or priority >= 80) and "urgent" not in tags:
        tags.append("urgent")
    result["ai_tags"] = tags[:5]

    # ─────────────────────────────────────────────────────────
    # STAGE 8 — Confirmation flag (high confidence = auto-classify)
    # ─────────────────────────────────────────────────────────
    if cat_conf >= 0.75 and detected_issues and detected_issues[0]["confidence"] >= 0.75:
        result["needs_user_confirmation"] = False
    elif cat_conf >= 0.75 and category == "water" and result.get("flood_score", 0) >= 0.75:
        result["needs_user_confirmation"] = False
    else:
        result["needs_user_confirmation"] = True

    return result


# ── CELL 7 ── Visualization Function
# ============================================================
# draw_detections()
#   Draws bounding boxes + labels on a copy of the image.
#   Returns annotated PIL image — does NOT modify original.
# ============================================================
# Colour palette for categories
CAT_COLORS = {
    "roads"    : "#FF4444",
    "trash"    : "#FF9900",
    "water"    : "#3399FF",
    "lighting" : "#FFDD00",
    "parks"    : "#44CC44",
    "other"    : "#AAAAAA",
}

def draw_detections(pil_img: Image.Image, result: dict) -> Image.Image:
    """Return an annotated copy of pil_img with bounding boxes."""
    annotated = pil_img.copy().convert("RGBA")
    overlay   = Image.new("RGBA", annotated.size, (0, 0, 0, 0))
    draw      = ImageDraw.Draw(overlay)

    cat   = result.get("category", "other")
    color = CAT_COLORS.get(cat, "#FFFFFF")

    for issue in result.get("detected_issues", []):
        bbox = issue.get("bbox")
        if not bbox:
            continue

        x1, y1, x2, y2 = bbox
        label = f"{issue['label']}  {issue['confidence']:.0%}"

        # Semi-transparent fill
        r, g, b = int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)
        draw.rectangle([x1, y1, x2, y2], fill=(r, g, b, 40),
                       outline=(r, g, b, 220), width=3)

        # Label background
        text_x, text_y = x1 + 4, max(0, y1 - 20)
        draw.rectangle([text_x - 2, text_y - 2,
                        text_x + len(label) * 7, text_y + 16],
                       fill=(r, g, b, 200))
        draw.text((text_x, text_y), label, fill=(255, 255, 255, 255))

    annotated = Image.alpha_composite(annotated, overlay).convert("RGB")
    return annotated


def show_result(pil_img: Image.Image, result: dict):
    """Print a formatted summary + show annotated image in Colab."""
    annotated = draw_detections(pil_img, result)

    fig, axes = plt.subplots(1, 2, figsize=(14, 6))
    axes[0].imshow(pil_img);       axes[0].set_title("Original",   fontsize=11); axes[0].axis("off")
    axes[1].imshow(annotated);     axes[1].set_title("Annotated",  fontsize=11); axes[1].axis("off")
    plt.suptitle(f"UrbanFix AI  —  {result['image']}", fontsize=13, y=1.01)
    plt.tight_layout()
    plt.show()

    # ── Text summary ──────────────────────────────────────────
    w = 58
    print("═" * w)
    print("  URBANFIX AI — ANALYSIS RESULT")
    print("═" * w)
    print(f"  Image    : {result['image']}")

    if not result.get("is_valid", True):
        print(f"  Status   : ❌ REJECTED")
        print(f"  Reason   : {result.get('validation_reason', 'Invalid image')}")
        if result.get("note"):
            print(f"  Note     : {result['note']}")
        print("═" * w)
        return annotated

    print(f"  Status   : ✅ Valid civic issue photo")
    print(f"  Category : {result['category'].upper()}   "
          f"(confidence: {result['category_confidence']:.1%})")
    print()
    print("  Category Scores:")
    for cat, sc in result["all_category_scores"].items():
        bar  = "█" * int(sc * 35)
        mark = "◀" if cat == result["category"] else " "
        print(f"    {cat:10s} {sc:.3f}  {bar}{mark}")

    print()
    print(f"  Model    : {result.get('model_used','N/A')}")
    print(f"  Issues   : {result['issue_count']}")
    if result["detected_issues"]:
        for i, iss in enumerate(result["detected_issues"], 1):
            bbox_str = f"  box={iss['bbox']}" if iss.get("bbox") else "  (no box)"
            print(f"    {i}. {iss['label']}  (conf: {iss['confidence']:.1%}){bbox_str}")

    if result.get("note"):
        print(f"\n  ⚠️  Note: {result['note']}")

    print()
    print(f"  Main Issue   : {result['main_issue']}")
    print(f"  Size         : {result['size']}")
    print(f"  Severity     : {'★' * result['severity']}{'☆' * (5 - result['severity'])}  "
          f"({result['severity']}/5)")
    print(f"  AI Severity  : {result.get('ai_severity', 'N/A')}")
    print(f"  Priority     : {result['priority_score']}/100  "
          f"{'🔴 URGENT' if result['priority_score'] >= 80 else '🟡 MODERATE' if result['priority_score'] >= 50 else '🟢 LOW'}")
    print(f"  Department   : {result.get('department_tag', 'General')}")
    print(f"  AI Tags      : {result.get('ai_tags', [])}")
    confirm = "No (auto-classified)" if not result.get("needs_user_confirmation", True) else "Yes"
    print(f"  Needs Review : {confirm}")
    print("═" * w)

    return annotated


# ── CELL 8 ── Run on Single Image
# ============================================================
# Change the index to test different images.
# ============================================================
if images:
    TEST_INDEX = 0                                  # ← change this

    test_img  = Image.open(str(images[TEST_INDEX])).convert("RGB")
    output    = analyze_image(test_img, images[TEST_INDEX].name)
    annotated = show_result(test_img, output)

    # Save annotated image to Drive/outputs/
    out_path = OUT_DIR / f"annotated_{images[TEST_INDEX].stem}.jpg"
    annotated.save(str(out_path))
    print(f"\n  Annotated image saved → {out_path}")

    # App-compatible JSON payload (maps to issues table columns)
    app_payload = {
        "is_valid"        : output["is_valid"],
        "validation_reason": output.get("validation_reason"),
        "category"        : output["category"],
        "ai_severity"     : output["ai_severity"],
        "ai_tags"         : output["ai_tags"],
        "priority_score"  : output["priority_score"],
        "department_tag"  : output["department_tag"],
        "main_issue"      : output["main_issue"],
        "detected_issues" : output["detected_issues"],
        "issue_count"     : output["issue_count"],
        "severity_numeric": output["severity"],
        "size"            : output["size"],
        "model_used"      : output["model_used"],
        "category_confidence" : output["category_confidence"],
        "needs_user_confirmation": output["needs_user_confirmation"],
        "note"            : output.get("note", ""),
    }
    print("\n  JSON payload (app-backend-compatible):")
    print(json.dumps(app_payload, indent=2))
else:
    print("No images found. Add photos to UrbanFix_AI/data/ and re-run Cell 2.")


# ── CELL 9 ── Batch Run — All Images
# ============================================================
if not images:
    print("No images found.")
else:
    all_results   = []
    failed_images = []

    print("═" * 65)
    print(f"  BATCH PROCESSING — {len(images)} image(s)")
    print("═" * 65)

    for img_file in images:
        print(f"\n  ── {img_file.name} ──")
        try:
            img = Image.open(str(img_file)).convert("RGB")
            res = analyze_image(img, img_file.name)
            all_results.append(res)

            sev_stars = "★" * res["severity"] + "☆" * (5 - res["severity"])
            print(f"  Category : {res['category'].upper()}  ({res['category_confidence']:.1%})")
            print(f"  Issues   : {res['issue_count']}")
            for iss in res["detected_issues"]:
                print(f"    → {iss['label']}  {iss['confidence']:.1%}")
            print(f"  Priority : {res['priority_score']}/100   Severity: {sev_stars}")

            # Save annotated image
            ann   = draw_detections(img, res)
            apath = OUT_DIR / f"annotated_{img_file.stem}.jpg"
            ann.save(str(apath))

        except Exception as e:
            print(f"  ❌  ERROR: {e}")
            failed_images.append(img_file.name)

    # ── Save all results to JSON ──────────────────────────────
    json_path = OUT_DIR / "all_results.json"
    with open(str(json_path), "w") as f:
        json.dump(all_results, f, indent=2)

    # ── Summary table ─────────────────────────────────────────
    print("\n" + "═" * 65)
    print("  BATCH SUMMARY")
    print("═" * 65)
    print(f"  {'Image':<35} {'Cat':<12} {'Issues':<8} {'Priority'}")
    print("  " + "─" * 62)
    for r in all_results:
        urgent = "🔴" if r["priority_score"] >= 80 \
                 else "🟡" if r["priority_score"] >= 50 else "🟢"
        print(f"  {r['image']:<35} {r['category']:<12} "
              f"{r['issue_count']:<8} {urgent} {r['priority_score']}/100")

    if failed_images:
        print(f"\n  ⚠️  Failed: {failed_images}")

    print(f"\n  ✅  Results JSON → {json_path}")
    print(f"  ✅  Annotated images → {OUT_DIR}")
    print("═" * 65)


# ── CELL 10 ── Priority Dashboard (bar chart)
# ============================================================
# Visual summary — shows which images need urgent attention.
# ============================================================
if 'all_results' in dir() and all_results:
    import matplotlib.patches as mpatches

    results_sorted = sorted(all_results, key=lambda r: r["priority_score"], reverse=True)

    names     = [r["image"][:28] for r in results_sorted]
    scores    = [r["priority_score"] for r in results_sorted]
    cats      = [r["category"] for r in results_sorted]
    bar_colors = [CAT_COLORS.get(c, "#AAAAAA") for c in cats]

    fig, ax = plt.subplots(figsize=(11, max(4, len(names) * 0.55)))
    bars = ax.barh(names, scores, color=bar_colors, edgecolor="white",
                   linewidth=0.6, height=0.65)

    # Value labels
    for bar, score in zip(bars, scores):
        ax.text(score + 0.8, bar.get_y() + bar.get_height() / 2,
                f"{score}", va="center", fontsize=9, color="#333")

    # Threshold lines
    ax.axvline(80, color="#FF4444", linestyle="--", linewidth=1, alpha=0.6)
    ax.axvline(50, color="#FF9900", linestyle="--", linewidth=1, alpha=0.6)

    ax.set_xlim(0, 108)
    ax.set_xlabel("Priority Score (0–100)", fontsize=10)
    ax.set_title("UrbanFix AI — Issue Priority Dashboard",
                 fontsize=13, fontweight="bold", pad=12)
    ax.invert_yaxis()
    ax.spines[["top", "right"]].set_visible(False)

    # Legend
    legend_patches = [mpatches.Patch(color=v, label=k) for k, v in CAT_COLORS.items()]
    ax.legend(handles=legend_patches, loc="lower right", fontsize=8, framealpha=0.7)

    plt.tight_layout()

    chart_path = OUT_DIR / "priority_dashboard.png"
    plt.savefig(str(chart_path), dpi=150, bbox_inches="tight")
    plt.show()
    print(f"  Dashboard saved → {chart_path}")


# ── CELL 11 ── Evaluation Setup (optional ground truth)
# ============================================================
# This cell builds an evaluation table from all_results and
# optionally loads labels from data/ground_truth.csv.
#
# Expected CSV columns (minimum):
#   image,true_category
# Optional columns:
#   true_severity,true_priority,true_is_valid
# ============================================================
import csv
from collections import Counter

if 'all_results' not in dir() or not all_results:
    print("Run Cell 9 first to generate all_results.")
else:
    GT_PATH = DATA_DIR / "ground_truth.csv"
    ground_truth = {}

    if GT_PATH.exists():
        with open(str(GT_PATH), "r", newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                key = (row.get("image") or "").strip()
                if key:
                    ground_truth[key] = {
                        "true_category": (row.get("true_category") or "").strip().lower(),
                        "true_severity": (row.get("true_severity") or "").strip(),
                        "true_priority": (row.get("true_priority") or "").strip(),
                        "true_is_valid": (row.get("true_is_valid") or "").strip().lower(),
                    }
        print(f"✅ Loaded ground truth rows: {len(ground_truth)} from {GT_PATH}")
    else:
        print("ℹ️ No ground truth CSV found. Running unsupervised metrics only.")
        print(f"   To enable full evaluation, add: {GT_PATH}")

    eval_rows = []
    for r in all_results:
        img_name = r.get("image", "")
        gt = ground_truth.get(img_name, {})

        row = {
            "image": img_name,
            "pred_category": r.get("category", "other"),
            "pred_severity": r.get("severity", 1),
            "pred_priority": r.get("priority_score", 0),
            "pred_valid": r.get("is_valid", True),
            "pred_conf": r.get("category_confidence", 0.0),
            "issue_count": r.get("issue_count", 0),
            "model_used": r.get("model_used", "none"),
            "true_category": gt.get("true_category", ""),
            "true_severity": gt.get("true_severity", ""),
            "true_priority": gt.get("true_priority", ""),
            "true_is_valid": gt.get("true_is_valid", ""),
        }
        eval_rows.append(row)

    matched_gt = sum(1 for x in eval_rows if x["true_category"])
    print(f"✅ Evaluation rows prepared: {len(eval_rows)}")
    print(f"✅ Rows with GT labels: {matched_gt}")


# ── CELL 12 ── Metrics Summary (with/without GT)
# ============================================================
import statistics

def safe_float(x, default=None):
    try:
        return float(x)
    except Exception:
        return default

if 'eval_rows' not in dir() or not eval_rows:
    print("Run Cell 11 first.")
else:
    n = len(eval_rows)
    pred_categories = [r["pred_category"] for r in eval_rows]
    pred_conf = [safe_float(r["pred_conf"], 0.0) for r in eval_rows]
    pred_priority = [safe_float(r["pred_priority"], 0.0) for r in eval_rows]
    pred_valid = [bool(r["pred_valid"]) for r in eval_rows]
    issue_counts = [int(r["issue_count"]) for r in eval_rows]

    print("═" * 68)
    print("  URBANFIX AI — METRICS SUMMARY")
    print("═" * 68)
    print(f"  Total images               : {n}")
    print(f"  Valid image rate           : {100 * sum(pred_valid) / max(n,1):.2f}%")
    print(f"  Avg category confidence    : {statistics.mean(pred_conf):.4f}")
    print(f"  Avg priority score         : {statistics.mean(pred_priority):.2f}")
    print(f"  Urgent rate (>=80)         : {100 * sum(p >= 80 for p in pred_priority) / max(n,1):.2f}%")
    print(f"  Avg detected issues/image  : {statistics.mean(issue_counts):.2f}")

    print("\n  Predicted category distribution:")
    cat_counts = Counter(pred_categories)
    for c in CATEGORIES:
        cnt = cat_counts.get(c, 0)
        print(f"    {c:<10} {cnt:>4} ({100*cnt/max(n,1):5.1f}%)")

    gt_rows = [r for r in eval_rows if r["true_category"]]
    if not gt_rows:
        print("\nℹ️ Ground truth not available -> supervised metrics skipped.")
    else:
        correct = sum(1 for r in gt_rows if r["pred_category"] == r["true_category"])
        acc = correct / len(gt_rows)
        print(f"\n  GT-matched rows            : {len(gt_rows)}")
        print(f"  Category accuracy          : {acc:.4f}")

        # Macro precision/recall/F1 without external libs
        per_class = {}
        labels = sorted(set([r["true_category"] for r in gt_rows] + [r["pred_category"] for r in gt_rows]))
        for label in labels:
            tp = sum(1 for r in gt_rows if r["true_category"] == label and r["pred_category"] == label)
            fp = sum(1 for r in gt_rows if r["true_category"] != label and r["pred_category"] == label)
            fn = sum(1 for r in gt_rows if r["true_category"] == label and r["pred_category"] != label)

            prec = tp / (tp + fp) if (tp + fp) else 0.0
            rec  = tp / (tp + fn) if (tp + fn) else 0.0
            f1   = (2 * prec * rec / (prec + rec)) if (prec + rec) else 0.0
            per_class[label] = {"precision": prec, "recall": rec, "f1": f1, "support": tp + fn}

        macro_f1 = statistics.mean(v["f1"] for v in per_class.values()) if per_class else 0.0
        print(f"  Macro F1                   : {macro_f1:.4f}")

        print("\n  Per-class scores:")
        print("    class        precision  recall     f1      support")
        for label in labels:
            v = per_class[label]
            print(f"    {label:<12} {v['precision']:<10.3f} {v['recall']:<10.3f} {v['f1']:<7.3f} {v['support']}")

        # Optional severity and priority errors if GT has those fields
        sev_pairs = []
        pri_pairs = []
        for r in gt_rows:
            ts = safe_float(r["true_severity"], None)
            tpv = safe_float(r["true_priority"], None)
            if ts is not None:
                sev_pairs.append((float(r["pred_severity"]), ts))
            if tpv is not None:
                pri_pairs.append((float(r["pred_priority"]), tpv))

        if sev_pairs:
            mae_sev = statistics.mean(abs(p - t) for p, t in sev_pairs)
            print(f"  Severity MAE               : {mae_sev:.4f}")
        if pri_pairs:
            mae_pri = statistics.mean(abs(p - t) for p, t in pri_pairs)
            print(f"  Priority MAE               : {mae_pri:.4f}")


# ── CELL 13 ── Evaluation Graphs
# ============================================================
# Produces:
#   1) Category distribution
#   2) Priority histogram
#   3) Confidence vs Priority scatter
#   4) Confusion matrix (if GT exists)
#   5) Confidence calibration plot (if GT exists)
# ============================================================
if 'eval_rows' not in dir() or not eval_rows:
    print("Run Cell 11 first.")
else:
    # 1) Category distribution
    cat_counts = Counter(r["pred_category"] for r in eval_rows)
    cats = list(CATEGORIES)
    vals = [cat_counts.get(c, 0) for c in cats]
    colors = [CAT_COLORS.get(c, "#AAAAAA") for c in cats]

    plt.figure(figsize=(8.5, 4.8))
    bars = plt.bar(cats, vals, color=colors, edgecolor="white")
    for b, v in zip(bars, vals):
        plt.text(b.get_x() + b.get_width() / 2, v + 0.05, str(v), ha="center", va="bottom", fontsize=9)
    plt.title("Predicted Category Distribution", fontsize=12, fontweight="bold")
    plt.ylabel("Image Count")
    plt.grid(axis="y", alpha=0.2)
    plt.tight_layout()
    path1 = OUT_DIR / "eval_category_distribution.png"
    plt.savefig(str(path1), dpi=150)
    plt.show()

    # 2) Priority histogram
    priorities = [safe_float(r["pred_priority"], 0.0) for r in eval_rows]
    plt.figure(figsize=(8.5, 4.8))
    plt.hist(priorities, bins=[0, 20, 40, 60, 80, 100], color="#2A9D8F", edgecolor="white")
    plt.axvline(80, color="#E63946", linestyle="--", linewidth=1.1, label="Urgent threshold (80)")
    plt.axvline(50, color="#F4A261", linestyle="--", linewidth=1.1, label="Moderate threshold (50)")
    plt.title("Priority Score Distribution", fontsize=12, fontweight="bold")
    plt.xlabel("Priority Score")
    plt.ylabel("Image Count")
    plt.legend()
    plt.grid(axis="y", alpha=0.2)
    plt.tight_layout()
    path2 = OUT_DIR / "eval_priority_histogram.png"
    plt.savefig(str(path2), dpi=150)
    plt.show()

    # 3) Confidence vs Priority scatter
    confs = [safe_float(r["pred_conf"], 0.0) for r in eval_rows]
    cats_sc = [r["pred_category"] for r in eval_rows]

    plt.figure(figsize=(8.5, 5.0))
    for c in CATEGORIES:
        xs = [confs[i] for i in range(len(confs)) if cats_sc[i] == c]
        ys = [priorities[i] for i in range(len(priorities)) if cats_sc[i] == c]
        if xs:
            plt.scatter(xs, ys, s=42, alpha=0.75, label=c, color=CAT_COLORS.get(c, "#AAAAAA"), edgecolors="white", linewidth=0.4)

    plt.title("Category Confidence vs Priority", fontsize=12, fontweight="bold")
    plt.xlabel("Category Confidence")
    plt.ylabel("Priority Score")
    plt.xlim(0, 1.02)
    plt.ylim(0, 102)
    plt.grid(alpha=0.2)
    plt.legend(ncol=3, fontsize=8)
    plt.tight_layout()
    path3 = OUT_DIR / "eval_confidence_vs_priority.png"
    plt.savefig(str(path3), dpi=150)
    plt.show()

    gt_rows = [r for r in eval_rows if r["true_category"]]
    if gt_rows:
        # 4) Confusion matrix
        labels = sorted(set([r["true_category"] for r in gt_rows] + [r["pred_category"] for r in gt_rows]))
        idx = {lab: i for i, lab in enumerate(labels)}
        cm = np.zeros((len(labels), len(labels)), dtype=int)

        for r in gt_rows:
            i = idx[r["true_category"]]
            j = idx[r["pred_category"]]
            cm[i, j] += 1

        plt.figure(figsize=(6.4, 5.6))
        im = plt.imshow(cm, cmap="Blues")
        plt.colorbar(im, fraction=0.046, pad=0.04)
        plt.xticks(range(len(labels)), labels, rotation=35, ha="right")
        plt.yticks(range(len(labels)), labels)
        plt.xlabel("Predicted")
        plt.ylabel("True")
        plt.title("Category Confusion Matrix", fontsize=12, fontweight="bold")

        for i in range(cm.shape[0]):
            for j in range(cm.shape[1]):
                val = cm[i, j]
                plt.text(j, i, str(val), ha="center", va="center",
                         color="white" if val > (cm.max() * 0.45) else "black", fontsize=9)

        plt.tight_layout()
        path4 = OUT_DIR / "eval_confusion_matrix.png"
        plt.savefig(str(path4), dpi=150)
        plt.show()

        # 5) Simple calibration curve (confidence vs empirical accuracy)
        bins = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
        centers = []
        accs = []
        counts = []
        for lo, hi in zip(bins[:-1], bins[1:]):
            group = [r for r in gt_rows if lo <= safe_float(r["pred_conf"], 0.0) < hi]
            if not group:
                continue
            corr = sum(1 for r in group if r["pred_category"] == r["true_category"])
            centers.append((lo + hi) / 2)
            accs.append(corr / len(group))
            counts.append(len(group))

        if centers:
            plt.figure(figsize=(6.6, 4.8))
            plt.plot([0, 1], [0, 1], "--", color="#999", label="Perfect calibration")
            plt.plot(centers, accs, marker="o", color="#1D3557", linewidth=2, label="Model")
            for x, y, c in zip(centers, accs, counts):
                plt.text(x, y + 0.03, f"n={c}", ha="center", fontsize=8)
            plt.title("Confidence Calibration (Category)", fontsize=12, fontweight="bold")
            plt.xlabel("Predicted confidence (bin center)")
            plt.ylabel("Empirical accuracy")
            plt.xlim(0, 1)
            plt.ylim(0, 1.05)
            plt.grid(alpha=0.2)
            plt.legend(fontsize=8)
            plt.tight_layout()
            path5 = OUT_DIR / "eval_calibration_curve.png"
            plt.savefig(str(path5), dpi=150)
            plt.show()

    print("\n✅ Saved evaluation plots:")
    print(f"  - {path1}")
    print(f"  - {path2}")
    print(f"  - {path3}")
    if gt_rows:
        print(f"  - {path4}")
        if 'path5' in dir():
            print(f"  - {path5}")


# ── CELL 14 ── Export Compact Evaluation Report
# ============================================================
if 'eval_rows' not in dir() or not eval_rows:
    print("Run Cell 11 first.")
else:
    report = {
        "total_images": len(eval_rows),
        "avg_confidence": round(sum(safe_float(r["pred_conf"], 0.0) for r in eval_rows) / max(len(eval_rows), 1), 4),
        "avg_priority": round(sum(safe_float(r["pred_priority"], 0.0) for r in eval_rows) / max(len(eval_rows), 1), 2),
        "urgent_rate": round(sum(safe_float(r["pred_priority"], 0.0) >= 80 for r in eval_rows) / max(len(eval_rows), 1), 4),
        "category_counts": dict(Counter(r["pred_category"] for r in eval_rows)),
        "model_usage_counts": dict(Counter(r["model_used"] for r in eval_rows)),
    }

    gt_rows = [r for r in eval_rows if r["true_category"]]
    if gt_rows:
        report["gt_matched_rows"] = len(gt_rows)
        report["category_accuracy"] = round(
            sum(r["pred_category"] == r["true_category"] for r in gt_rows) / len(gt_rows), 4
        )

    eval_json_path = OUT_DIR / "evaluation_report.json"
    with open(str(eval_json_path), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"✅ Evaluation report saved → {eval_json_path}")
    print(json.dumps(report, indent=2))
