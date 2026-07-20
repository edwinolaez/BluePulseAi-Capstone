"""
Change detection router — proxies requests to Richard's ML service.
Owner: Richard (ML) / Edwin (integration & QA)

This router gives Feven's FastAPI monolith a stable change-detection boundary.
Richard's ML service URL is configured via ML_API_URL env var.
If the ML service is unavailable, this router returns a structured error
rather than letting the timeout surface as an unhandled 502.

Endpoints:
  POST /api/v1/change-detection/predict  — run burn-scar / vegetation change detection
  GET  /api/v1/change-detection/status   — health-check the ML service connection
"""

import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel

from config import API_KEY

router = APIRouter(prefix="/api/v1/change-detection", tags=["change-detection"])

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
ML_API_URL = os.getenv("ML_API_URL", "")

TIMEOUT_S = 30.0


async def require_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


class ChangeDetectionRequest(BaseModel):
    sector_id: str
    model_version: str = "latest"


@router.post("/predict", dependencies=[Depends(require_api_key)])
async def predict_change(body: ChangeDetectionRequest):
    """Forward a change-detection request to Richard's ML service.

    Returns the model output directly. If the ML service is down, returns a
    structured 503 with a 'ml_service_unavailable' code so the frontend can
    fall back to its estimated values gracefully.
    """
    if not ML_API_URL:
        raise HTTPException(
            status_code=503,
            detail={"code": "ml_service_unavailable", "message": "ML_API_URL not configured"},
        )

    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            response = await client.post(
                f"{ML_API_URL}/api/v1/predict/change-detection",
                json={"sector_id": body.sector_id},
                headers={"X-API-Key": API_KEY},
            )
        if not response.is_success:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json()
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=504,
            detail={"code": "ml_service_timeout", "message": f"ML service did not respond within {TIMEOUT_S}s"},
        )
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "ml_service_unavailable", "message": str(exc)},
        )


@router.get("/status")
async def ml_service_status():
    """Check whether Richard's ML service is reachable. Public — no auth required."""
    if not ML_API_URL:
        return {"status": "not_configured", "ml_api_url": None, "checked_at": datetime.now(timezone.utc).isoformat()}

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{ML_API_URL}/health")
        return {
            "status": "reachable" if resp.is_success else "unhealthy",
            "http_status": resp.status_code,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        return {"status": "unreachable", "error": str(exc), "checked_at": datetime.now(timezone.utc).isoformat()}
