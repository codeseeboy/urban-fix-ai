"""
Image validation — Stage 0 of the pipeline.
Rejects selfies, screenshots, indoor photos, memes, blurry images, etc.
Uses SigLIP zero-shot matching against valid vs invalid prompts.
"""

import torch
import torch.nn.functional as F
from PIL import Image

from .config import settings
from .models import model_manager
from .schemas import ValidationResult

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

_REJECTION_REASONS = {
    0: "Selfie / person portrait detected",
    1: "Screenshot detected",
    2: "Indoor photo detected",
    3: "Meme / joke image detected",
    4: "Blurry / unrecognizable image",
    5: "Food photo detected",
    6: "Document / text page detected",
}


def validate_image(pil_img: Image.Image) -> ValidationResult:
    if model_manager.siglip_model is None:
        return ValidationResult(is_valid=True, confidence=0)

    w, h = pil_img.size
    if w < settings.min_image_dimension or h < settings.min_image_dimension:
        return ValidationResult(
            is_valid=False,
            confidence=1.0,
            rejection_reason=f"Image too small ({w}x{h}). Minimum {settings.min_image_dimension}x{settings.min_image_dimension} px.",
        )

    all_prompts = VALID_PROMPTS + INVALID_PROMPTS
    n_valid = len(VALID_PROMPTS)

    inputs = model_manager.siglip_processor(
        text=all_prompts,
        images=pil_img,
        return_tensors="pt",
        padding="max_length",
        truncation=True,
    ).to(model_manager.device)

    with torch.no_grad():
        outputs = model_manager.siglip_model(**inputs)
        logits = outputs.logits_per_image
        scores = F.softmax(logits, dim=-1)[0].cpu().tolist()

    valid_score = sum(scores[:n_valid])
    invalid_score = sum(scores[n_valid:])

    if invalid_score > settings.validation_threshold:
        best_idx = max(range(n_valid, len(scores)), key=lambda i: scores[i])
        reason = _REJECTION_REASONS.get(
            best_idx - n_valid, "Not a civic issue photo"
        )
        return ValidationResult(
            is_valid=False,
            confidence=round(invalid_score, 4),
            rejection_reason=reason,
        )

    return ValidationResult(is_valid=True, confidence=round(valid_score, 4))
