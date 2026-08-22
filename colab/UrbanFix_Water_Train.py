# ============================================================
# UrbanFix - Water/Flood Classifier Training Notebook
# Category: water
# Output: HF-style classifier folder for ai-service
# ============================================================
# Why classification:
# Your app currently uses flood score (not boxes) for water path.
# Put images in:
# /content/drive/MyDrive/UrbanFix_AI/datasets/water_cls/
#   train/flooded, train/non_flooded, val/flooded, val/non_flooded
# ============================================================

# --- CELL 1: Setup ---
from google.colab import drive
from pathlib import Path
import subprocess
import sys

drive.mount("/content/drive")

pkgs = [
    "torch>=2.2.0",
    "torchvision>=0.17.0",
    "transformers>=4.44.0",
    "datasets>=2.19.0",
    "evaluate>=0.4.2",
    "accelerate>=0.34.0",
    "scikit-learn>=1.4.0",
]
subprocess.check_call([sys.executable, "-m", "pip", "install", "-q"] + pkgs)

BASE = Path("/content/drive/MyDrive/UrbanFix_AI")
DATA = BASE / "datasets" / "water_cls"
OUT = BASE / "models" / "water_flood_siglip"
OUT.mkdir(parents=True, exist_ok=True)

print("DATA:", DATA)
print("OUT :", OUT)


# --- CELL 2: Dataset format ---
"""
Folder layout expected:
water_cls/
  train/
    flooded/
    non_flooded/
  val/
    flooded/
    non_flooded/

Recommended open datasets:
- Roadway Flooding Image Dataset (Kaggle)
- Flood/non-flood image sets with clear labels
- Your city waterlogging photos (must-have)
"""


# --- CELL 3: Load data ---
from datasets import load_dataset

if not DATA.exists():
    raise FileNotFoundError(f"Dataset path missing: {DATA}")

dataset = load_dataset("imagefolder", data_dir=str(DATA))
print(dataset)
print("Labels:", dataset["train"].features["label"].names)
print("Expected labels: flooded, non_flooded")


# --- CELL 4: Build trainer ---
import numpy as np
import torch
import evaluate
from transformers import (
    AutoImageProcessor,
    AutoModelForImageClassification,
    TrainingArguments,
    Trainer,
)

MODEL_ID = "google/siglip-base-patch16-384"
processor = AutoImageProcessor.from_pretrained(MODEL_ID)

labels = dataset["train"].features["label"].names
id2label = {i: n for i, n in enumerate(labels)}
label2id = {n: i for i, n in id2label.items()}

def preprocess(examples):
    images = [img.convert("RGB") for img in examples["image"]]
    enc = processor(images=images, return_tensors="pt")
    enc["labels"] = examples["label"]
    return enc

prepared = dataset.with_transform(preprocess)

model = AutoModelForImageClassification.from_pretrained(
    MODEL_ID,
    num_labels=len(labels),
    id2label=id2label,
    label2id=label2id,
)

acc_metric = evaluate.load("accuracy")
f1_metric = evaluate.load("f1")

def compute_metrics(eval_pred):
    logits, y_true = eval_pred
    y_pred = np.argmax(logits, axis=-1)
    acc = acc_metric.compute(predictions=y_pred, references=y_true)["accuracy"]
    f1 = f1_metric.compute(predictions=y_pred, references=y_true, average="weighted")["f1"]
    return {"accuracy": acc, "f1_weighted": f1}

args = TrainingArguments(
    output_dir=str(OUT / "checkpoints"),
    remove_unused_columns=False,
    evaluation_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,
    metric_for_best_model="f1_weighted",
    greater_is_better=True,
    num_train_epochs=12,
    learning_rate=3e-5,
    weight_decay=0.01,
    per_device_train_batch_size=16,
    per_device_eval_batch_size=16,
    gradient_accumulation_steps=1,
    warmup_ratio=0.1,
    logging_steps=50,
    fp16=torch.cuda.is_available(),
    report_to="none",
)

trainer = Trainer(
    model=model,
    args=args,
    train_dataset=prepared["train"],
    eval_dataset=prepared["val"],
    tokenizer=processor,
    compute_metrics=compute_metrics,
)


# --- CELL 5: Train + evaluate ---
trainer.train()
metrics = trainer.evaluate()
print(metrics)


# --- CELL 6: Save for ai-service ---
trainer.save_model(str(OUT))
processor.save_pretrained(str(OUT))
print("Saved model folder:", OUT)
print("Use this folder for AI_FLOOD_MODEL_ID if hosted, or load local path in app code.")
