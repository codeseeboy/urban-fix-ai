import torch
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    api_key: str = ""
    cors_origins: str = "*"

    device: str = "cuda" if torch.cuda.is_available() else "cpu"

    siglip_model_id: str = "google/siglip-base-patch16-384"
    # HuggingFace repo id for road YOLO weights (best.pt). Used when no local file is set,
    # and as backup when AI_ROAD_WEIGHTS_PATH is set (custom primary → HF backup).
    road_hf_repo: str = "ozair23/yolov8-road-damage-detector"
    # Absolute path inside the container to your trained weights, e.g. /app/models/road_damage_best.pt
    # Leave empty to download only from road_hf_repo.
    road_weights_path: str = ""
    trash_model_id: str = "HrutikAdsare/waste-detection-yolov8"
    flood_model_id: str = "prithivMLmods/Flood-Image-Detection"
    yolo_world_id: str = "yolov8s-worldv2.pt"

    validation_threshold: float = 0.55
    detection_confidence: float = 0.15
    yolo_world_confidence: float = 0.10

    # Router + specialist fusion (reduces false "other" when detectors fire)
    # full = run all specialists and merge with SigLIP; router_only = SigLIP only (faster CPU)
    fusion_mode: str = "full"
    fusion_router_weight: float = 0.32
    fusion_specialist_weight: float = 0.68
    # When True, blend "other" down if any civic specialist is strong
    fusion_penalize_other: bool = True

    # Per-class NMS on YOLO boxes (0 = disabled). Reduces duplicate overlapping detections.
    detection_nms_iou: float = 0.45

    max_image_size: int = 10 * 1024 * 1024  # 10 MB
    min_image_dimension: int = 200

    class Config:
        env_prefix = "AI_"
        env_file = ".env"


settings = Settings()
