## UrbanFix Non-Road Dataset Plan (Open Source)

This plan is for category-wise training (except roads), aligned with your app categories:
- `trash`
- `water`
- `lighting`
- `parks`

Use this as the source of truth before running notebooks.

---

## 1) Trash (`trash`)

### Best open datasets
- **TACO (Trash Annotations in Context)**  
  - URL: [http://tacodataset.org](http://tacodataset.org)  
  - Why: Real-world litter in context, strong for civic garbage scenes.
- **Open Images V7 (selected waste-like classes)**  
  - URL: [https://storage.googleapis.com/openimages/web/index.html](https://storage.googleapis.com/openimages/web/index.html)  
  - Why: Adds scale and scene diversity (streets, public places).

### Recommended final training mix
- 60% TACO
- 25% Open Images mapped classes
- 15% your city images (must-have for domain accuracy)

### Expected target
- mAP50: 0.70+ with clean labels and balanced classes.

---

## 2) Water (`water`)

### Best open datasets
- **Roadway Flooding Image Dataset (classification)**  
  - URL: [https://www.kaggle.com/datasets/saurabhshahane/roadway-flooding-image-dataset](https://www.kaggle.com/datasets/saurabhshahane/roadway-flooding-image-dataset)
- **Flood image datasets (classification/segmentation variants on Kaggle/HF)**  
  - Use only sets with clear flooded vs non-flooded labels.

### Recommended task for your app
- Keep **classification** as primary (`flooded/waterlogged` vs `not flooded`) because your API currently uses flood score.
- Optional v2: add segmentation model later for flooded area ratio.

### Expected target
- Accuracy/F1: 0.90+ on curated validation split.

---

## 3) Lighting (`lighting`)

### Reality check
There is no single perfect open dataset for **broken/missing/dark streetlights**.
Best performance comes from:
- Open base detector pretraining (street objects)
- Then fine-tuning on your defect labels.

### Best open datasets
- **Mapillary Vistas**  
  - URL: [https://www.mapillary.com/dataset/vistas](https://www.mapillary.com/dataset/vistas)  
  - Why: Street-level dense annotations including poles/lights/street objects.
- **Open Images V7 classes** (`Street light`, `Lamp`, `Pole` where available)
  - URL: [https://storage.googleapis.com/openimages/web/index.html](https://storage.googleapis.com/openimages/web/index.html)

### Recommended final training mix
- 50% open base (Mapillary/Open Images)
- 50% your defect labels (`broken_light`, `tilted_pole`, `dark_lamp`, `wire_exposed`)

### Expected target
- mAP50: 0.60-0.75 for defect classes (depends heavily on custom data quality).

---

## 4) Parks (`parks`)

### Reality check
No high-quality universal open dataset exists for **park damage** as a single benchmark.
Best approach:
- Build park issue ontology and train from mixed open sources.

### Best open datasets (base objects)
- **Open Images V7** classes:
  - `Bench`, `Fence`, `Tree`, `Playground`, `Trash can`, etc.
- **Mapillary Vistas** (street/public-space context)

### Recommended class set for your app
- `broken_bench`
- `damaged_playground`
- `fallen_tree_branch`
- `broken_fence`
- `park_garbage`
- `cracked_path`

### Recommended final training mix
- 40% open base
- 60% your labeled park damage images (must-have for true accuracy)

### Expected target
- mAP50: 0.55-0.70 initially; improve with active learning loops.

---

## Data quality rules (critical for high accuracy)

- Use one class taxonomy and never mix meanings.
- Remove blurry/night-unreadable labels from training.
- Keep class balance (at least 500-800 boxes per class for detectors).
- Split by location/time to avoid leakage.
- Keep a fixed test set untouched for model comparison.

---

## Recommended model family per category

- `trash`: YOLOv8m (detector)
- `water`: SigLIP/ViT classifier (binary)
- `lighting`: YOLOv8m (detector, defect-focused fine-tune)
- `parks`: YOLOv8m (detector, defect-focused fine-tune)

---

## Deployment format expected by your app

- Detectors export: `best.pt` (Ultralytics YOLO)
- Water classifier export: HF-style folder (`config.json`, `pytorch_model.bin`, processor files)

Then wire into `ai-service` exactly like current model loaders.
