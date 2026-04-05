"""
UrbanFix AI Service — FastAPI Application
Serves the CV detection pipeline over HTTP.
Node.js backend calls POST /analyze with an image file.
"""

import io
import logging
import time
from contextlib import asynccontextmanager

import torch
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from PIL import Image

from .config import settings
from .models import model_manager
from .pipeline import analyze_image
from .validation import validate_image as validate_image_fn
from .schemas import AnalysisResult, ValidationResult, HealthResponse, ModelsStatusResponse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(name)-22s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("urbanfix.api")

# Local dev: `ai-service/static/test_upload.html`
_STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting UrbanFix AI Service ...")
    model_manager.load_all()
    logger.info("AI Service ready.")
    yield
    logger.info("Shutting down AI Service.")


app = FastAPI(
    title="UrbanFix AI Service",
    description="Computer vision pipeline for civic issue detection",
    version="1.0.0",
    lifespan=lifespan,
)

origins = settings.cors_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _check_api_key(authorization: str | None):
    if settings.api_key and settings.api_key != "":
        if not authorization or authorization != f"Bearer {settings.api_key}":
            raise HTTPException(status_code=401, detail="Invalid API key")


async def _read_image(file: UploadFile) -> Image.Image:
    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=400,
            detail=f"File must be an image, got {file.content_type}",
        )

    contents = await file.read()
    if len(contents) > settings.max_image_size:
        raise HTTPException(
            status_code=400,
            detail=f"Image too large ({len(contents) // 1024} KB). Max {settings.max_image_size // 1024 // 1024} MB.",
        )

    try:
        img = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image file.")

    return img


# ── Endpoints ────────────────────────────────────────────────


@app.get("/test", response_class=HTMLResponse, include_in_schema=False)
async def test_upload_page():
    """
    Simple browser UI to upload an image and call POST /analyze (local testing).
    Open http://127.0.0.1:8000/test after starting uvicorn.
    """
    path = _STATIC_DIR / "test_upload.html"
    if not path.is_file():
        raise HTTPException(status_code=404, detail="test_upload.html missing")
    return HTMLResponse(path.read_text(encoding="utf-8"))


@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(
        status="ok" if model_manager.is_loaded else "loading",
        device=settings.device,
        models_loaded=model_manager.loaded_summary(),
    )


@app.get("/models", response_model=ModelsStatusResponse)
async def models_status():
    gpu_name = None
    if settings.device == "cuda":
        gpu_name = torch.cuda.get_device_name(0)
    return ModelsStatusResponse(
        device=settings.device,
        gpu_name=gpu_name,
        models=model_manager.status(),
    )


@app.post("/analyze", response_model=AnalysisResult)
async def analyze(
    file: UploadFile = File(..., description="Civic issue photo"),
    skip_validation: bool = Query(False, description="Skip image validation gate"),
    authorization: str | None = Header(None),
):
    """
    Full detection pipeline: validation → routing → detection → severity.
    Returns a structured JSON with category, severity, priority, department, tags.
    """
    _check_api_key(authorization)

    if not model_manager.is_loaded:
        raise HTTPException(status_code=503, detail="Models still loading, try again in a minute.")

    pil_img = await _read_image(file)

    start = time.perf_counter()
    result = analyze_image(pil_img, skip_validation=skip_validation)
    elapsed = round((time.perf_counter() - start) * 1000)

    logger.info(
        "Analyzed image: category=%s  severity=%s  priority=%d  issues=%d  time=%dms",
        result.category,
        result.ai_severity,
        result.priority_score,
        result.issue_count,
        elapsed,
    )

    return result


@app.post("/validate", response_model=ValidationResult)
async def validate(
    file: UploadFile = File(..., description="Image to validate"),
    authorization: str | None = Header(None),
):
    """
    Only run image validation (Stage 0).
    Quick check: is this a valid outdoor civic issue photo?
    """
    _check_api_key(authorization)

    if not model_manager.is_loaded:
        raise HTTPException(status_code=503, detail="Models still loading.")

    pil_img = await _read_image(file)
    return validate_image_fn(pil_img)
