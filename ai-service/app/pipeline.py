"""
UrbanFix AI Detection Pipeline — same logic as the Colab notebook.
Stages 0-8: validation → routing → detection → severity → priority → tags.

When fusion_mode=full, SigLIP scores are merged with specialist detector
strength so images are not labeled "other" when a YOLO/flood model fires.
"""

import logging
from pathlib import Path

import torch
import torch.nn.functional as F
from PIL import Image

from .config import settings
from .models import model_manager, CATEGORIES, CATEGORY_PROMPTS, LIGHTING_CLASSES, PARKS_CLASSES
from .schemas import AnalysisResult, DetectedIssue
from .validation import validate_image

logger = logging.getLogger("urbanfix.pipeline")

SEVERITY_MAP = {1: "Low", 2: "Low", 3: "Medium", 4: "High", 5: "Critical"}

DEPT_MAP = {
    "roads": "PWD",
    "lighting": "Electrical",
    "trash": "Sanitation",
    "water": "Water Supply",
    "parks": "Horticulture",
    "other": "General",
}

LABEL_TAG_MAP = {
    "pothole": "road-damage", "crack": "road-damage", "damage": "infrastructure",
    "garbage": "sanitation", "waste": "sanitation", "trash": "sanitation",
    "flood": "drainage", "water": "drainage", "waterlog": "drainage",
    "streetlight": "lighting", "light": "lighting", "lamp": "lighting",
    "bench": "horticulture", "tree": "horticulture", "park": "horticulture",
    "fence": "infrastructure", "broken": "infrastructure",
}

CIVIC_CATS = [c for c in CATEGORIES if c != "other"]


def _softmax_dict(raw: dict[str, float]) -> dict[str, float]:
    keys = list(raw.keys())
    if not keys:
        return {}
    vals = torch.tensor([raw[k] for k in keys], dtype=torch.float32)
    p = torch.softmax(vals, dim=0).tolist()
    return {keys[i]: round(float(p[i]), 4) for i in range(len(keys))}


def _siglip_router_distribution(pil_img: Image.Image) -> dict[str, float]:
    inputs = model_manager.siglip_processor(
        text=CATEGORY_PROMPTS,
        images=pil_img,
        return_tensors="pt",
        padding="max_length",
        truncation=True,
    ).to(model_manager.device)
    with torch.no_grad():
        outputs = model_manager.siglip_model(**inputs)
        logits = outputs.logits_per_image
        scores = F.softmax(logits, dim=-1)[0].cpu().tolist()
    return {CATEGORIES[i]: round(scores[i], 4) for i in range(len(CATEGORIES))}


def _apply_other_veto_router(all_scores: dict[str, float]) -> dict[str, float]:
    """If 'other' wins weakly, shift mass to the best civic runner-up."""
    r = dict(all_scores)
    best = max(r, key=r.get)
    if best != "other":
        return r
    cat_conf = r["other"]
    if cat_conf >= 0.65:
        return r
    civic_choices = [(c, s) for c, s in r.items() if c != "other"]
    best_civic, best_civic_s = max(civic_choices, key=lambda x: x[1])
    if best_civic_s > 0.15:
        shift = min(cat_conf * 0.3, 0.25)
        r["other"] = round(cat_conf - shift, 4)
        r[best_civic] = round(best_civic_s + shift, 4)
    return r


def _flood_water_strength_and_probs(pil_img: Image.Image) -> tuple[float, dict[str, float]]:
    if not (model_manager.flood_model and model_manager.flood_processor):
        return 0.0, {}
    inputs = model_manager.flood_processor(images=pil_img, return_tensors="pt").to(
        model_manager.device
    )
    with torch.no_grad():
        logits = model_manager.flood_model(**inputs).logits
        probs = F.softmax(logits, dim=-1).squeeze().tolist()
    label_probs = {
        model_manager.flood_id2label[i]: round(float(probs[i]), 4)
        for i in range(len(probs))
    }
    strength = 0.0
    for lbl, prob in label_probs.items():
        low = str(lbl).lower()
        if any(
            k in low
            for k in (
                "flood",
                "water",
                "inund",
                "submer",
                "deluge",
                "logged",
                "pool",
                "immerse",
            )
        ):
            strength = max(strength, prob)
    return strength, label_probs


def _specialist_sweep(
    pil_img: Image.Image,
) -> tuple[dict[str, float], dict[str, list[DetectedIssue]], float | None]:
    """
    Run each specialist; return max strength 0–1 per civic category and issues per category.
    """
    scores: dict[str, float] = {c: 0.0 for c in CIVIC_CATS}
    issues_map: dict[str, list[DetectedIssue]] = {c: [] for c in CIVIC_CATS}
    flood_raw: float | None = None

    # Roads
    if model_manager.road_model_primary:
        res = model_manager.road_model_primary.predict(
            pil_img, conf=settings.detection_confidence, verbose=False
        )[0]
        road_iss = _extract_yolo_boxes(res, res.names)
        if road_iss:
            scores["roads"] = max(d.confidence for d in road_iss)
            issues_map["roads"] = road_iss
    if not issues_map["roads"] and model_manager.road_model_backup:
        res = model_manager.road_model_backup.predict(
            pil_img, conf=settings.detection_confidence, verbose=False
        )[0]
        road_iss = _extract_yolo_boxes(res, res.names)
        if road_iss:
            scores["roads"] = max(d.confidence for d in road_iss)
            issues_map["roads"] = road_iss

    # Trash
    if model_manager.trash_model:
        res = model_manager.trash_model.predict(
            pil_img, conf=settings.detection_confidence, verbose=False
        )[0]
        trash_iss = _extract_yolo_boxes(res, res.names)
        if trash_iss:
            scores["trash"] = max(d.confidence for d in trash_iss)
            issues_map["trash"] = trash_iss

    # Water / flood (SigLIP classifier)
    w_strength, label_probs = _flood_water_strength_and_probs(pil_img)
    scores["water"] = w_strength
    flood_raw = w_strength
    if w_strength >= 0.5:
        issues_map["water"] = [
            DetectedIssue(
                label="Flooded / Waterlogged Area",
                confidence=w_strength,
                bbox=None,
            )
        ]

    # Lighting + parks — one YOLO-World pass
    n_light = len(LIGHTING_CLASSES)
    combo = LIGHTING_CLASSES + PARKS_CLASSES
    if model_manager.yolo_world and combo:
        try:
            model_manager.yolo_world.set_classes(combo)
            res = model_manager.yolo_world.predict(
                pil_img, conf=settings.yolo_world_confidence, verbose=False
            )[0]
            if res.boxes is not None and len(res.boxes) > 0:
                light_confs: list[float] = []
                park_confs: list[float] = []
                for b in res.boxes:
                    cls_idx = int(b.cls.item())
                    conf = float(b.conf.item())
                    x1, y1, x2, y2 = [round(v) for v in b.xyxy[0].tolist()]
                    if cls_idx < n_light:
                        label = (
                            LIGHTING_CLASSES[cls_idx]
                            if cls_idx < len(LIGHTING_CLASSES)
                            else f"lighting_{cls_idx}"
                        )
                        light_confs.append(conf)
                        issues_map["lighting"].append(
                            DetectedIssue(
                                label=label,
                                confidence=round(conf, 4),
                                bbox=[x1, y1, x2, y2],
                            )
                        )
                    else:
                        pi = cls_idx - n_light
                        label = (
                            PARKS_CLASSES[pi]
                            if pi < len(PARKS_CLASSES)
                            else f"parks_{pi}"
                        )
                        park_confs.append(conf)
                        issues_map["parks"].append(
                            DetectedIssue(
                                label=label,
                                confidence=round(conf, 4),
                                bbox=[x1, y1, x2, y2],
                            )
                        )
                if light_confs:
                    scores["lighting"] = max(light_confs)
                if park_confs:
                    scores["parks"] = max(park_confs)
        except Exception as e:
            logger.warning("YOLO-World specialist sweep failed: %s", e)

    return scores, issues_map, flood_raw


def _box_iou(a: list[int], b: list[int]) -> float:
    """IoU for axis-aligned boxes [x1,y1,x2,y2]."""
    x1 = max(a[0], b[0])
    y1 = max(a[1], b[1])
    x2 = min(a[2], b[2])
    y2 = min(a[3], b[3])
    inter_w = max(0, x2 - x1)
    inter_h = max(0, y2 - y1)
    inter = inter_w * inter_h
    area_a = max(0, a[2] - a[0]) * max(0, a[3] - a[1])
    area_b = max(0, b[2] - b[0]) * max(0, b[3] - b[1])
    union = area_a + area_b - inter
    return inter / union if union > 0 else 0.0


def _nms_detected_issues(
    issues: list[DetectedIssue],
    iou_threshold: float,
) -> list[DetectedIssue]:
    """Greedy NMS per label; issues without bbox pass through unchanged."""
    if iou_threshold <= 0 or len(issues) <= 1:
        return issues

    no_box = [x for x in issues if not x.bbox]
    with_box = [x for x in issues if x.bbox]
    by_label: dict[str, list[DetectedIssue]] = {}
    for x in with_box:
        key = x.label.strip().lower()
        by_label.setdefault(key, []).append(x)

    kept_all: list[DetectedIssue] = []
    for _label, arr in by_label.items():
        arr = sorted(arr, key=lambda d: d.confidence, reverse=True)
        while arr:
            best = arr.pop(0)
            kept_all.append(best)
            arr = [x for x in arr if _box_iou(best.bbox, x.bbox) <= iou_threshold]

    kept_all.sort(key=lambda d: d.confidence, reverse=True)
    return no_box + kept_all


def _needs_user_confirmation(
    category: str,
    cat_conf: float,
    detected_issues: list[DetectedIssue],
    result: AnalysisResult,
    fusion_full: bool,
    router_scores: dict[str, float],
    specialist_scores: dict[str, float] | None,
) -> bool:
    """False = confident enough to skip manual confirm; uses fusion + router when available."""
    if category == "other":
        return True

    top_det = max((d.confidence for d in detected_issues), default=0.0)

    # Original strict rules (softmax cat_conf can still hit these)
    if cat_conf >= 0.75 and detected_issues and top_det >= 0.75:
        return False
    if cat_conf >= 0.75 and category == "water" and (result.flood_score or 0) >= 0.75:
        return False

    rc = router_scores.get(category, 0.0)
    sc = specialist_scores.get(category, 0.0) if specialist_scores else 0.0

    if fusion_full and specialist_scores is not None:
        # Fused softmax is often low when classes compete — trust router + specialist + boxes
        if rc >= 0.70 and sc >= 0.40 and top_det >= 0.35:
            return False
        if rc >= 0.78 and top_det >= 0.30:
            return False
        if rc >= 0.62 and sc >= 0.50 and top_det >= 0.28:
            return False
        if rc >= 0.85 and sc >= 0.35 and top_det >= 0.25:
            return False
    else:
        # router_only: cat_conf is raw router mass on category
        if rc >= 0.72 and top_det >= 0.38:
            return False
        if cat_conf >= 0.68 and top_det >= 0.42:
            return False
        if cat_conf >= 0.75 and detected_issues and top_det >= 0.55:
            return False

    # Water: bbox-less flood signal
    if category == "water" and detected_issues and (result.flood_score or 0) >= 0.72:
        return False

    return True


def _arbitrate_roads_vs_water(
    category: str,
    cat_conf: float,
    spec_scores: dict[str, float],
    all_fused_soft: dict[str, float],
) -> tuple[str, float, str | None]:
    """
    Wet pothole / paani bhara gaddha: flood classifier + SigLIP often say 'water', but road YOLO
    should win when it is at least as strong as the flood model (damage is the civic issue).
    """
    if category != "water":
        return category, cat_conf, None
    sr = spec_scores.get("roads", 0.0)
    sw = spec_scores.get("water", 0.0)
    if sr < 0.28:
        return category, cat_conf, None
    # Road detector matches or beats flood strength → treat as road/pothole, not flood routing
    if sr >= sw - 0.05:
        note = (
            "Visible water is likely inside road damage (pothole or wet surface). "
            "Category set to roads because the road-damage detector matched at least as "
            "strongly as the flood model. Change manually if this is deep area flooding."
        )
        new_conf = all_fused_soft.get("roads", cat_conf)
        return "roads", new_conf, note
    return category, cat_conf, None


def _fuse_router_specialist(
    router: dict[str, float],
    specialist: dict[str, float],
) -> dict[str, float]:
    wr = settings.fusion_router_weight
    ws = settings.fusion_specialist_weight
    out: dict[str, float] = {}
    for c in CIVIC_CATS:
        out[c] = wr * router[c] + ws * specialist[c]
    spec_max = max(specialist[c] for c in CIVIC_CATS)
    if settings.fusion_penalize_other:
        no_issue_signal = max(0.0, 1.0 - min(1.0, spec_max * 1.12))
        out["other"] = wr * router["other"] + ws * no_issue_signal
    else:
        out["other"] = router["other"]
    return out


def analyze_image(
    pil_img: Image.Image,
    skip_validation: bool = False,
) -> AnalysisResult:
    """Run the full UrbanFix detection pipeline on one PIL image."""

    result = AnalysisResult()
    w, h = pil_img.size
    img_area = w * h

    # ── STAGE 0: Image Validation ────────────────────────────
    if not skip_validation:
        validation = validate_image(pil_img)
        result.is_valid = validation.is_valid
        result.validation_reason = validation.rejection_reason
        if not validation.is_valid:
            result.note = (
                f"Image rejected: {validation.rejection_reason} "
                f"(confidence: {validation.confidence:.1%}). "
                "Please upload a clear outdoor photo of a civic issue."
            )
            return result

    # ── STAGE 1–2: Router (+ optional specialist fusion) ───────
    if model_manager.siglip_model is None:
        result.note = "SigLIP router not loaded."
        return result

    router_raw = _siglip_router_distribution(pil_img)
    router_scores = _apply_other_veto_router(router_raw)

    detected_issues: list[DetectedIssue] = []
    model_used = "none"

    if settings.fusion_mode == "full":
        spec_scores, issues_by_cat, flood_raw = _specialist_sweep(pil_img)
        fused_raw = _fuse_router_specialist(router_scores, spec_scores)
        all_fused_soft = _softmax_dict(fused_raw)
        category = max(all_fused_soft, key=all_fused_soft.get)
        cat_conf = all_fused_soft[category]

        arb_note: str | None = None
        category, cat_conf, arb_note = _arbitrate_roads_vs_water(
            category, cat_conf, spec_scores, all_fused_soft
        )
        if arb_note:
            logger.info("Road vs water arbitration: switched category to roads (wet pothole heuristic)")

        result.router_scores = router_scores
        result.specialist_scores = spec_scores
        result.all_category_scores = all_fused_soft
        result.category = category
        result.category_confidence = cat_conf

        if flood_raw is not None:
            result.flood_score = flood_raw

        if arb_note:
            result.note = arb_note

        if category == "other":
            model_used = "fusion(siglip+specialists)"
            result.note = (
                "No strong match: SigLIP and specialist models did not agree on a civic issue type."
            )
        else:
            detected_issues = list(issues_by_cat.get(category, []))
            if category == "roads" and not detected_issues:
                result.note = (
                    "Fusion picked roads but no road-damage boxes were found — "
                    "try a clearer view of the road surface."
                )
            elif category == "trash" and not detected_issues:
                result.note = (
                    "Fusion picked sanitation/trash but no waste objects were detected in frame."
                )
            elif category == "water":
                if not detected_issues and (flood_raw or 0) < 0.5:
                    result.note = (
                        f"Water/flood context (score {flood_raw or 0:.2f}) below confirmation threshold — "
                        "may be a wet road or small puddle."
                    )
            elif category == "lighting" and not detected_issues:
                result.note = (
                    "Lighting context but no street-light / pole boxes found — scene may be ambiguous."
                )
            elif category == "parks" and not detected_issues:
                result.note = (
                    "Park/outdoor context but no park-equipment boxes found — scene may be ambiguous."
                )

            det_hint = {
                "roads": "road YOLO",
                "trash": settings.trash_model_id,
                "water": settings.flood_model_id,
                "lighting": "YOLO-World",
                "parks": "YOLO-World",
            }.get(category, "specialist")
            model_used = f"fusion(siglip+specialists); {det_hint}"

    else:
        # SigLIP only (faster; less accurate when router misfires)
        all_scores = router_scores
        category = max(all_scores, key=all_scores.get)
        cat_conf = all_scores[category]

        if category == "other" and cat_conf < 0.65:
            civic_choices = [(c, s) for c, s in all_scores.items() if c != "other"]
            best_civic, best_civic_s = max(civic_choices, key=lambda x: x[1])
            if best_civic_s > 0.15:
                logger.info(
                    "Vetoing 'other' (%.2f) for '%s' (%.2f)",
                    cat_conf,
                    best_civic,
                    best_civic_s,
                )
                category = best_civic
                cat_conf = best_civic_s

        result.category = category
        result.category_confidence = cat_conf
        result.all_category_scores = all_scores

        if category == "roads":
            detected_issues, model_used = _detect_roads(pil_img, result)
        elif category == "trash":
            detected_issues, model_used = _detect_trash(pil_img, result)
        elif category == "water":
            detected_issues, model_used = _detect_water(pil_img, result, cat_conf)
        elif category == "lighting":
            detected_issues, model_used = _detect_yolo_world(
                pil_img, result, LIGHTING_CLASSES, "lighting"
            )
        elif category == "parks":
            detected_issues, model_used = _detect_yolo_world(
                pil_img, result, PARKS_CLASSES, "parks"
            )
        else:
            model_used = "none"
            result.note = (
                "Image does not appear to be a civic issue. "
                "Top category was 'other' — this photo may not show infrastructure damage."
            )

        result.router_scores = router_scores
        result.specialist_scores = None

    if settings.detection_nms_iou > 0 and detected_issues:
        detected_issues = _nms_detected_issues(
            detected_issues, settings.detection_nms_iou
        )

    result.model_used = model_used
    result.detected_issues = detected_issues
    result.issue_count = len(detected_issues)

    # ── STAGE 3: Main issue identification ───────────────────
    main_issue_dict = _identify_main_issue(detected_issues, category, result)

    # ── STAGE 4: Severity + Priority ─────────────────────────
    _score_severity_priority(result, main_issue_dict, detected_issues, category, img_area)

    # ── STAGE 5: ai_severity string ──────────────────────────
    result.ai_severity = SEVERITY_MAP.get(result.severity, "Low")

    # ── STAGE 6: Department routing ──────────────────────────
    result.department_tag = DEPT_MAP.get(category, "General")

    # ── STAGE 7: AI Tags ────────────────────────────────────
    result.ai_tags = _generate_tags(category, detected_issues, result.severity, result.priority_score)

    # ── STAGE 8: Confirmation flag ───────────────────────────
    result.needs_user_confirmation = _needs_user_confirmation(
        category,
        cat_conf,
        detected_issues,
        result,
        fusion_full=(settings.fusion_mode == "full"),
        router_scores=router_scores,
        specialist_scores=result.specialist_scores,
    )

    return result


# ── Specialist detectors ─────────────────────────────────────


def _extract_yolo_boxes(res, names: dict) -> list[DetectedIssue]:
    issues = []
    if res.boxes is not None and len(res.boxes) > 0:
        for b in res.boxes:
            x1, y1, x2, y2 = [round(v) for v in b.xyxy[0].tolist()]
            cls_id = int(b.cls.item())
            label = names.get(cls_id, f"class_{cls_id}")
            issues.append(DetectedIssue(
                label=label,
                confidence=round(float(b.conf.item()), 4),
                bbox=[x1, y1, x2, y2],
            ))
    return issues


def _road_model_label(for_backup: bool) -> str:
    if for_backup:
        return f"{settings.road_hf_repo} (backup)"
    if settings.road_weights_path and Path(settings.road_weights_path).is_file():
        return f"local:{Path(settings.road_weights_path).name}"
    return settings.road_hf_repo


def _detect_roads(pil_img: Image.Image, result: AnalysisResult):
    model_used = "none"
    issues: list[DetectedIssue] = []

    if model_manager.road_model_primary:
        res = model_manager.road_model_primary.predict(
            pil_img, conf=settings.detection_confidence, verbose=False
        )[0]
        issues = _extract_yolo_boxes(res, res.names)
        if issues:
            model_used = _road_model_label(for_backup=False)

    if not issues and model_manager.road_model_backup:
        res = model_manager.road_model_backup.predict(
            pil_img, conf=settings.detection_confidence, verbose=False
        )[0]
        issues = _extract_yolo_boxes(res, res.names)
        if issues:
            model_used = _road_model_label(for_backup=True)

    if not issues:
        result.note = (
            "Road detected by router but no damage boxes found. "
            "May need lower confidence threshold or more data."
        )

    return issues, model_used


def _detect_trash(pil_img: Image.Image, result: AnalysisResult):
    model_used = settings.trash_model_id
    issues: list[DetectedIssue] = []

    if model_manager.trash_model:
        res = model_manager.trash_model.predict(
            pil_img, conf=settings.detection_confidence, verbose=False
        )[0]
        issues = _extract_yolo_boxes(res, res.names)
        if not issues:
            result.note = "Trash area detected by router but no waste boxes found."
    else:
        result.note = "Trash model not loaded."

    return issues, model_used


def _detect_water(pil_img: Image.Image, result: AnalysisResult, cat_conf: float):
    model_used = settings.flood_model_id
    issues: list[DetectedIssue] = []

    if model_manager.flood_model and model_manager.flood_processor:
        inputs = model_manager.flood_processor(
            images=pil_img, return_tensors="pt"
        ).to(model_manager.device)

        with torch.no_grad():
            logits = model_manager.flood_model(**inputs).logits
            probs = F.softmax(logits, dim=-1).squeeze().tolist()

        label_probs = {
            model_manager.flood_id2label[i]: round(float(probs[i]), 4)
            for i in range(len(probs))
        }

        flood_score = 0.0
        for lbl, prob in label_probs.items():
            if "flood" in lbl.lower():
                flood_score = prob
                break

        result.flood_score = flood_score

        if flood_score >= 0.5:
            issues.append(DetectedIssue(
                label="Flooded / Waterlogged Area",
                confidence=flood_score,
                bbox=None,
            ))
        else:
            result.note = (
                f"Router classified as 'water' (conf {cat_conf}) "
                f"but flood model score is only {flood_score:.2f}. "
                "Likely a wet road or puddle — not severe flooding."
            )
    else:
        result.note = "Flood model not loaded."

    return issues, model_used


def _detect_yolo_world(
    pil_img: Image.Image,
    result: AnalysisResult,
    class_prompts: list[str],
    category_name: str,
):
    model_used = "YOLO-World (open-vocabulary)"
    issues: list[DetectedIssue] = []

    if model_manager.yolo_world:
        model_manager.yolo_world.set_classes(class_prompts)
        res = model_manager.yolo_world.predict(
            pil_img, conf=settings.yolo_world_confidence, verbose=False
        )[0]
        if res.boxes is not None and len(res.boxes) > 0:
            for b in res.boxes:
                x1, y1, x2, y2 = [round(v) for v in b.xyxy[0].tolist()]
                cls_idx = int(b.cls.item())
                label = (
                    class_prompts[cls_idx]
                    if cls_idx < len(class_prompts)
                    else f"{category_name}_issue_{cls_idx}"
                )
                issues.append(DetectedIssue(
                    label=label,
                    confidence=round(float(b.conf.item()), 4),
                    bbox=[x1, y1, x2, y2],
                ))
        else:
            result.note = (
                f"{category_name.title()} issue detected by router but "
                "YOLO-World found no specific boxes."
            )
    else:
        result.note = f"YOLO-World not loaded. {category_name.title()} detected by router only."

    return issues, model_used


# ── Post-processing helpers ──────────────────────────────────


def _identify_main_issue(
    detected_issues: list[DetectedIssue],
    category: str,
    result: AnalysisResult,
) -> DetectedIssue | None:
    if detected_issues:
        with_box = [d for d in detected_issues if d.bbox]
        without_box = [d for d in detected_issues if not d.bbox]

        if with_box:
            main = max(
                with_box,
                key=lambda d: (d.bbox[2] - d.bbox[0]) * (d.bbox[3] - d.bbox[1]),
            )
        else:
            main = max(without_box, key=lambda d: d.confidence)

        result.main_issue = main.label
        return main

    if category != "other":
        result.main_issue = f"{category.title()} issue (detected by router)"
    else:
        result.main_issue = "No civic issue detected"
    return None


def _score_severity_priority(
    result: AnalysisResult,
    main_issue: DetectedIssue | None,
    detected_issues: list[DetectedIssue],
    category: str,
    img_area: int,
):
    size, severity, priority = "unknown", 1, 20

    if main_issue and main_issue.bbox:
        bw = main_issue.bbox[2] - main_issue.bbox[0]
        bh = main_issue.bbox[3] - main_issue.bbox[1]
        ratio = (bw * bh) / max(img_area, 1)
        conf = main_issue.confidence

        if ratio < 0.02:
            size, severity, priority = "small", 2, 35
        elif ratio < 0.08:
            size, severity, priority = "medium", 3, 55
        elif ratio < 0.20:
            size, severity, priority = "large", 4, 75
        else:
            size, severity, priority = "very large", 5, 92

        priority = int(min(100, max(0, priority + round(15 * (conf - 0.5)))))

        if len(detected_issues) >= 3:
            severity = min(5, severity + 1)
            priority = min(100, priority + 8)
        if len(detected_issues) >= 6:
            priority = min(100, priority + 5)

    elif main_issue and category == "water":
        fs = result.flood_score or 0.5
        if fs > 0.92:
            size, severity, priority = "severe", 5, 95
        elif fs > 0.75:
            size, severity, priority = "high", 4, 78
        elif fs > 0.55:
            size, severity, priority = "moderate", 3, 55
        else:
            size, severity, priority = "mild", 2, 35

    elif category in ("lighting", "parks") and detected_issues:
        conf = detected_issues[0].confidence
        size, severity, priority = "detected", 3, int(45 + 30 * conf)

    elif category != "other":
        size, severity, priority = "unconfirmed", 2, 30

    result.size = size
    result.severity = severity
    result.priority_score = priority


def _generate_tags(
    category: str,
    detected_issues: list[DetectedIssue],
    severity: int,
    priority: int,
) -> list[str]:
    tags = [category]
    for issue in detected_issues:
        label_lower = issue.label.lower()
        for keyword, tag in LABEL_TAG_MAP.items():
            if keyword in label_lower and tag not in tags:
                tags.append(tag)
    if (severity >= 4 or priority >= 80) and "urgent" not in tags:
        tags.append("urgent")
    return tags[:5]
