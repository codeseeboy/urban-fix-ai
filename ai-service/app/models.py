"""
Model loading and management.
Downloads pretrained models from HuggingFace on first startup,
caches them for subsequent runs.
"""

import logging
from pathlib import Path

import torch
from transformers import (
    AutoProcessor,
    AutoModel,
    AutoImageProcessor,
    SiglipForImageClassification,
)
from huggingface_hub import hf_hub_download
from ultralytics import YOLO, YOLOWorld

from .config import settings

logger = logging.getLogger("urbanfix.models")

CATEGORIES = ["roads", "trash", "water", "lighting", "parks", "other"]

# SigLIP text prompts — distinct, concrete cues so "other" does not dominate
CATEGORY_PROMPTS = [
    "potholes cracks broken asphalt road damage street surface",
    "garbage bags litter trash waste dumped on street or sidewalk",
    "flooded road deep waterlogging stagnant flood water on street",
    "street light pole broken lamp dark unlit tilted electric pole wires",
    "park bench broken playground path tree damage public garden issue",
    "indoor portrait food meme screenshot unrelated not outdoor civic issue",
]

# Specialized classes for YOLO-World (open-vocabulary detection)
LIGHTING_CLASSES = [
    "broken street light",
    "damaged light pole",
    "missing street lamp",
    "fallen electric pole",
    "tilted streetlight pole",
    "dark unlit street lamp",
    "exposed electrical wires on pole",
]

PARKS_CLASSES = [
    "broken park bench",
    "damaged playground equipment",
    "cracked footpath pavement",
    "fallen tree blocking path",
    "large fallen branch",
    "broken fence",
    "garbage dumped in park",
    "vandalized wall graffiti",
]


class ModelManager:
    """Loads, stores, and provides access to all AI models."""

    def __init__(self):
        self.device = settings.device
        self.siglip_processor = None
        self.siglip_model = None
        self.road_model_primary = None
        self.road_model_backup = None
        self.trash_model = None
        self.flood_processor = None
        self.flood_model = None
        self.flood_id2label: dict[int, str] = {}
        self.yolo_world = None
        self._loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    def status(self) -> dict[str, dict]:
        return {
            "siglip_router": {
                "loaded": self.siglip_model is not None,
                "model_id": settings.siglip_model_id,
            },
            "road_primary": {
                "loaded": self.road_model_primary is not None,
                "source": settings.road_weights_path or settings.road_hf_repo,
            },
            "road_backup": {
                "loaded": self.road_model_backup is not None,
                "source": settings.road_hf_repo,
            },
            "trash": {
                "loaded": self.trash_model is not None,
                "model_id": settings.trash_model_id,
            },
            "flood": {
                "loaded": self.flood_model is not None,
                "model_id": settings.flood_model_id,
                "labels": self.flood_id2label,
            },
            "yolo_world": {
                "loaded": self.yolo_world is not None,
                "model_id": settings.yolo_world_id,
            },
        }

    def loaded_summary(self) -> dict[str, bool]:
        return {
            "siglip_router": self.siglip_model is not None,
            "road_yolo": self.road_model_primary is not None
            or self.road_model_backup is not None,
            "trash_yolo": self.trash_model is not None,
            "flood_siglip": self.flood_model is not None,
            "yolo_world": self.yolo_world is not None,
        }

    def load_all(self):
        logger.info("Loading all models (device: %s) ...", self.device)
        self._load_siglip()
        self._load_road_models()
        self._load_trash_model()
        self._load_flood_model()
        self._load_yolo_world()
        self._loaded = True
        logger.info("All models loaded. Summary: %s", self.loaded_summary())

    # ── SigLIP Router ────────────────────────────────────────────

    def _load_siglip(self):
        logger.info("[1/5] Loading SigLIP router ...")
        try:
            self.siglip_processor = AutoProcessor.from_pretrained(
                settings.siglip_model_id
            )
            self.siglip_model = (
                AutoModel.from_pretrained(settings.siglip_model_id)
                .to(self.device)
                .eval()
            )
            logger.info("  SigLIP router ready")
        except Exception as e:
            logger.error("  SigLIP failed: %s", e)

    # ── Road Damage YOLO ─────────────────────────────────────────

    def _safe_hf_download(self, repo_id: str, filename: str) -> str | None:
        try:
            path = hf_hub_download(repo_id, filename)
            logger.info("    Downloaded %s", repo_id)
            return path
        except Exception as e:
            logger.warning("    Failed %s: %s", repo_id, e)
            return None

    def _load_road_models(self):
        logger.info("[2/5] Loading Road Damage models ...")
        local = (settings.road_weights_path or "").strip()
        if local:
            p = Path(local)
            if p.is_file():
                self.road_model_primary = YOLO(str(p))
                logger.info("  Road primary: local file %s", p)
            else:
                logger.warning("  AI_ROAD_WEIGHTS_PATH not found: %s", p)

        if not self.road_model_primary:
            path_hf = self._safe_hf_download(settings.road_hf_repo, "best.pt")
            if path_hf:
                self.road_model_primary = YOLO(path_hf)
                logger.info("  Road primary: HuggingFace %s", settings.road_hf_repo)

        # When primary is a custom local file, keep HF weights as backup (same as Colab notebook).
        if self.road_model_primary and local and Path(local).is_file():
            path_b = self._safe_hf_download(settings.road_hf_repo, "best.pt")
            if path_b:
                self.road_model_backup = YOLO(path_b)
                logger.info("  Road backup: HuggingFace %s", settings.road_hf_repo)

        if not self.road_model_primary and not self.road_model_backup:
            logger.warning("  No road model loaded")

    # ── Trash YOLO ───────────────────────────────────────────────

    def _load_trash_model(self):
        logger.info("[3/5] Loading Trash model ...")
        path = self._safe_hf_download(settings.trash_model_id, "best.pt")
        if path:
            self.trash_model = YOLO(path)

    # ── Flood SigLIP ─────────────────────────────────────────────

    def _load_flood_model(self):
        logger.info("[4/5] Loading Flood Detection model ...")
        try:
            self.flood_processor = AutoImageProcessor.from_pretrained(
                settings.flood_model_id
            )
            self.flood_model = (
                SiglipForImageClassification.from_pretrained(settings.flood_model_id)
                .to(self.device)
                .eval()
            )
            raw = self.flood_model.config.id2label
            self.flood_id2label = {int(k): v for k, v in raw.items()}
            logger.info("  Flood model ready | labels: %s", self.flood_id2label)
        except Exception as e:
            logger.error("  Flood model failed: %s", e)

    # ── YOLO-World ───────────────────────────────────────────────

    def _load_yolo_world(self):
        logger.info("[5/5] Loading YOLO-World ...")
        try:
            self.yolo_world = YOLOWorld(settings.yolo_world_id)
            logger.info("  YOLO-World ready")
        except Exception as e:
            logger.error("  YOLO-World failed: %s", e)


model_manager = ModelManager()
