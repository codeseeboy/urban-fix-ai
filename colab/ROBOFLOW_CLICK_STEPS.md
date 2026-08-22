## Roboflow Click-by-Click (Download -> Put in Drive)

Use this if you want the easiest YOLO dataset export flow.

## 1) Create project and import dataset

1. Open [https://app.roboflow.com](https://app.roboflow.com)
2. Sign in.
3. Click `Create New Project`.
4. Choose `Object Detection`.
5. Upload or import images/labels (or duplicate an existing Universe dataset to your workspace).

## 2) Generate version

1. Open your project.
2. Click `Generate`.
3. Keep split around `Train 70 / Valid 20 / Test 10`.
4. Click `Generate New Version`.

## 3) Export in YOLOv8 format

1. Open generated version.
2. Click `Download Dataset`.
3. Select `YOLOv8`.
4. Either:
   - Download ZIP manually, or
   - Copy Colab code block if preferred.

## 4) Place extracted files into your Drive target

For trash:
- target: `/content/drive/MyDrive/UrbanFix_AI/datasets/trash_yolo/`

For lighting:
- target: `/content/drive/MyDrive/UrbanFix_AI/datasets/lighting_yolo/`

For parks:
- target: `/content/drive/MyDrive/UrbanFix_AI/datasets/parks_yolo/`

After extract, each target must contain:
```
images/train
images/val
labels/train
labels/val
```

Then copy the matching `dataset_*.yaml` template from `colab/` into each folder as `dataset.yaml`.

## 5) Water dataset (not YOLO export flow)

Water uses classifier training:
- collect `flooded` and `non_flooded` image folders
- create:
```
/content/drive/MyDrive/UrbanFix_AI/datasets/water_cls/
  train/flooded
  train/non_flooded
  val/flooded
  val/non_flooded
```

## 6) Final run order

1. `UrbanFix_Trash_Train.py`
2. `UrbanFix_Water_Train.py`
3. `UrbanFix_Lighting_Train.py`
4. `UrbanFix_Parks_Train.py`
