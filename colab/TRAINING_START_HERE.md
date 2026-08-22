## UrbanFix Training Start Guide (Final, Download-Only Flow)

This is the exact sequence to follow if you do not want to build your own dataset now.

---

## A) Create Drive folders first

Create these folders in Google Drive:

```
MyDrive/UrbanFix_AI/
MyDrive/UrbanFix_AI/datasets/
MyDrive/UrbanFix_AI/datasets/trash_yolo/
MyDrive/UrbanFix_AI/datasets/lighting_yolo/
MyDrive/UrbanFix_AI/datasets/parks_yolo/
MyDrive/UrbanFix_AI/datasets/water_cls/
MyDrive/UrbanFix_AI/models/
MyDrive/UrbanFix_AI/runs/trash/
MyDrive/UrbanFix_AI/runs/lighting/
MyDrive/UrbanFix_AI/runs/parks/
```

---

## B) Download datasets (no custom labeling required to start)

### 1) Trash
- Source: TACO / Roboflow garbage dataset exported in YOLOv8 format.
- Required final location:
  - `/content/drive/MyDrive/UrbanFix_AI/datasets/trash_yolo/images/train`
  - `/content/drive/MyDrive/UrbanFix_AI/datasets/trash_yolo/images/val`
  - `/content/drive/MyDrive/UrbanFix_AI/datasets/trash_yolo/labels/train`
  - `/content/drive/MyDrive/UrbanFix_AI/datasets/trash_yolo/labels/val`

### 2) Lighting
- Source: street-light/pole dataset exported in YOLOv8 format.
- Required final location:
  - `/content/drive/MyDrive/UrbanFix_AI/datasets/lighting_yolo/images/train`
  - `/content/drive/MyDrive/UrbanFix_AI/datasets/lighting_yolo/images/val`
  - `/content/drive/MyDrive/UrbanFix_AI/datasets/lighting_yolo/labels/train`
  - `/content/drive/MyDrive/UrbanFix_AI/datasets/lighting_yolo/labels/val`

### 3) Parks
- Source: park/public asset dataset exported in YOLOv8 format.
- Required final location:
  - `/content/drive/MyDrive/UrbanFix_AI/datasets/parks_yolo/images/train`
  - `/content/drive/MyDrive/UrbanFix_AI/datasets/parks_yolo/images/val`
  - `/content/drive/MyDrive/UrbanFix_AI/datasets/parks_yolo/labels/train`
  - `/content/drive/MyDrive/UrbanFix_AI/datasets/parks_yolo/labels/val`

### 4) Water (classification)
- Source: Roadway Flooding image dataset (Kaggle) + any flood/non-flood open images.
- Required final location:
```
/content/drive/MyDrive/UrbanFix_AI/datasets/water_cls/
  train/flooded/*
  train/non_flooded/*
  val/flooded/*
  val/non_flooded/*
```

---

## C) Put dataset.yaml templates

Copy these files and rename/place as below:
- `colab/dataset_trash.yaml` -> `.../datasets/trash_yolo/dataset.yaml`
- `colab/dataset_lighting.yaml` -> `.../datasets/lighting_yolo/dataset.yaml`
- `colab/dataset_parks.yaml` -> `.../datasets/parks_yolo/dataset.yaml`

Important: if your class names differ, edit `dataset.yaml` names to match your downloaded labels.

---

## D) Run notebooks/scripts in this exact order

1. `UrbanFix_Trash_Train.py`
2. `UrbanFix_Water_Train.py`
3. `UrbanFix_Lighting_Train.py`
4. `UrbanFix_Parks_Train.py`

---

## E) Expected outputs

- Trash: `MyDrive/UrbanFix_AI/models/trash_best.pt`
- Water: `MyDrive/UrbanFix_AI/models/water_flood_siglip/` (folder)
- Lighting: `MyDrive/UrbanFix_AI/models/lighting_best.pt`
- Parks: `MyDrive/UrbanFix_AI/models/parks_best.pt`

---

## F) Minimum acceptance metrics

- Trash mAP50 >= 0.72
- Water weighted F1 >= 0.90
- Lighting mAP50 >= 0.65
- Parks mAP50 >= 0.60
