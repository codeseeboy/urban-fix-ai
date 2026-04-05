from typing import Optional

from pydantic import BaseModel


class DetectedIssue(BaseModel):
    label: str
    confidence: float
    bbox: list[int] | None = None


class ValidationResult(BaseModel):
    is_valid: bool
    confidence: float
    rejection_reason: str | None = None


class AnalysisResult(BaseModel):
    is_valid: bool = True
    validation_reason: str | None = None
    category: str = "other"
    category_confidence: float = 0.0
    # Fused SigLIP + specialist scores (final routing). Same keys as CATEGORIES.
    all_category_scores: dict[str, float] = {}
    # Raw SigLIP-only scores (when fusion_mode=full)
    router_scores: Optional[dict[str, float]] = None
    # Max detector strength per civic category (0–1)
    specialist_scores: Optional[dict[str, float]] = None
    model_used: str = "none"
    detected_issues: list[DetectedIssue] = []
    issue_count: int = 0
    main_issue: str = "No issue detected"
    size: str = "unknown"
    severity: int = 1
    ai_severity: str = "Low"
    priority_score: int = 0
    department_tag: str = "General"
    ai_tags: list[str] = []
    needs_user_confirmation: bool = True
    flood_score: float | None = None
    note: str = ""


class HealthResponse(BaseModel):
    status: str
    device: str
    models_loaded: dict[str, bool]


class ModelsStatusResponse(BaseModel):
    device: str
    gpu_name: str | None = None
    models: dict[str, dict]
