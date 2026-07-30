"""
Change detection router — proxies requests to Richard's ML service.
Owner: Richard (ML) / Edwin (integration & QA)

This router is a "proxy" layer. It lives in Feven's FastAPI backend and
accepts requests from Reyta's frontend. It then forwards those requests to
Richard's separate ML service, waits for the result, and passes it back.

Why have a proxy instead of calling Richard's service directly from the frontend?
- The frontend doesn't need to know Richard's service URL or API key
- We can add authentication, rate limiting, and fallback logic here in one place
- If Richard's service moves or changes its URL, only this file needs updating

The ML service URL comes from the ML_API_URL environment variable. If that
variable is not set (e.g. in a local dev environment without the ML service
running), we return a structured 503 error so the frontend can display a
graceful fallback message rather than crashing.

Endpoints:
  POST /api/v1/change-detection/predict  — run burn-scar / vegetation change detection
  GET  /api/v1/change-detection/status   — health-check the ML service connection (public)
"""

import os
from datetime import datetime, timezone

# httpx is an async HTTP client — it lets us make outgoing HTTP requests
# without blocking the server while waiting for Richard's ML service to respond.
import httpx
from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel

from config import API_KEY

# All routes share the /api/v1/change-detection prefix
router = APIRouter(prefix="/api/v1/change-detection", tags=["change-detection"])

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Richard's ML service base URL — set this in Railway's environment variables.
# Empty string means the ML service is not configured (local dev without ML).
ML_API_URL = os.getenv("ML_API_URL", "")

# How many seconds to wait for Richard's service before giving up.
# 30 seconds is generous — most predictions complete in under 5s. This handles
# cold-start delays on Railway's free tier.
TIMEOUT_S = 30.0


async def require_api_key(api_key: str = Security(api_key_header)):
    """Dependency: reject requests that don't provide the correct API key.

    Args:
        api_key: Value from the X-API-Key request header

    Raises:
        HTTPException 401: If the key is missing or doesn't match config.API_KEY
    """
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


class ChangeDetectionRequest(BaseModel):
    """Request body for the change-detection predict endpoint.

    sector_id:     The monitoring sector to run detection on (e.g. "ATH-001-A")
    model_version: Which version of Richard's model to use — "latest" means the
                   currently deployed version; specific versions (e.g. "v1.3.0")
                   allow comparing results across model updates
    """
    sector_id: str
    model_version: str = "latest"


@router.post("/predict", dependencies=[Depends(require_api_key)])
async def predict_change(body: ChangeDetectionRequest):
    """Forward a burn-scar / vegetation change-detection request to the ML service.

    Takes the sector ID from the request body, passes it to Richard's ML service,
    and returns the model output (risk scores, change masks, confidence values)
    directly to the caller. The response shape is whatever Richard's service returns.

    If the ML service is down or not configured, returns a structured error with
    a machine-readable "code" field so the frontend can show a fallback gracefully.

    Args:
        body: Validated ChangeDetectionRequest with sector_id and model_version

    Returns:
        dict: The raw JSON response from Richard's ML service

    Raises:
        HTTPException 503: If ML_API_URL is not configured or the service is down
        HTTPException 504: If Richard's service didn't respond within TIMEOUT_S seconds
    """
    # Guard clause — fail fast if no ML service URL has been configured
    if not ML_API_URL:
        raise HTTPException(
            status_code=503,
            detail={"code": "ml_service_unavailable", "message": "ML_API_URL not configured"},
        )

    try:
        # `async with` ensures the HTTP connection is always closed after this block,
        # even if an exception is raised — prevents connection leaks.
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            response = await client.post(
                f"{ML_API_URL}/predict/change-detection",
                json={"sector_id": body.sector_id},
                # Forward our API key so Richard's service knows the request is legitimate
                headers={"X-API-Key": API_KEY},
            )

        # If Richard's service returned a non-2xx status, bubble that status code up
        if not response.is_success:
            raise HTTPException(status_code=response.status_code, detail=response.text)

        return response.json()

    except httpx.TimeoutException:
        # The ML service accepted the connection but took too long to reply
        raise HTTPException(
            status_code=504,
            detail={"code": "ml_service_timeout", "message": f"ML service did not respond within {TIMEOUT_S}s"},
        )
    except httpx.RequestError as exc:
        # Network-level error: DNS failure, connection refused, etc.
        raise HTTPException(
            status_code=503,
            detail={"code": "ml_service_unavailable", "message": str(exc)},
        )


@router.get("/status")
async def ml_service_status():
    """Check whether Richard's ML service is reachable. Public — no API key required.

    This endpoint is used by the monitoring dashboard and Edwin's CI pipeline
    to confirm that the ML service is up before running integration tests.
    It makes a lightweight GET /health call to the ML service — if that returns
    a 2xx status, we report "reachable"; otherwise "unhealthy".

    Returns:
        dict: status ("reachable", "unhealthy", "unreachable", or "not_configured"),
              optional http_status from the ML service, and a checked_at timestamp
    """
    # If ML_API_URL is not set, report it as not configured rather than erroring
    if not ML_API_URL:
        return {"status": "not_configured", "ml_api_url": None, "checked_at": datetime.now(timezone.utc).isoformat()}

    try:
        # Use a 5-second timeout for status checks — we want a quick answer
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{ML_API_URL}/health")
        return {
            "status": "reachable" if resp.is_success else "unhealthy",
            "http_status": resp.status_code,
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as exc:
        # Any exception (timeout, connection refused, DNS failure) means unreachable
        return {"status": "unreachable", "error": str(exc), "checked_at": datetime.now(timezone.utc).isoformat()}
