"""
Simulation router — proxies erosion and contaminant simulation to Richard's ML service.
Owner: Richard (ML) / Edwin (integration & QA)

Endpoints:
  GET  /api/v1/simulate/erosion      — RUSLE-based erosion risk for a sector
  GET  /api/v1/simulate/contaminant  — hydrocarbon plume direction + velocity model
"""

import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Security
from fastapi.security.api_key import APIKeyHeader

from config import API_KEY

router = APIRouter(prefix="/api/v1/simulate", tags=["simulation"])

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)
ML_API_URL = os.getenv("ML_API_URL", "")
TIMEOUT_S  = 30.0


async def require_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _ml_unavailable() -> HTTPException:
    return HTTPException(
        status_code=503,
        detail={"code": "ml_service_unavailable", "message": "ML_API_URL not configured"},
    )


@router.get("/erosion", dependencies=[Depends(require_api_key)])
async def simulate_erosion(
    sector_id:   str   = Query(...),
    slope_deg:   float = Query(38.5, description="Terrain slope in degrees"),
    rainfall_mm: float = Query(82.0, description="Daily rainfall in mm"),
):
    """Run the RUSLE erosion model for a sector via Richard's ML service.

    slope_deg and rainfall_mm default to Jasper Valley watershed averages
    but can be overridden with real-time telemetry values.
    """
    if not ML_API_URL:
        raise _ml_unavailable()

    params = {"sector_id": sector_id, "slope_deg": slope_deg, "rainfall_mm": rainfall_mm}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            resp = await client.post(
                f"{ML_API_URL}/simulate/erosion",
                json=params,
                headers={"X-API-Key": API_KEY},
            )
        if not resp.is_success:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail={"code": "ml_service_timeout"})
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail={"code": "ml_service_unavailable", "message": str(exc)})


@router.get("/contaminant", dependencies=[Depends(require_api_key)])
async def simulate_contaminant(
    sector_id:           str   = Query(...),
    flow_direction_deg:  float = Query(180.0, description="Water flow direction in degrees"),
    water_velocity_ms:   float = Query(2.1,   description="Water velocity in m/s"),
    contamination_level: float = Query(0.72,  description="Normalised contamination level 0-1"),
):
    """Run the hydrocarbon plume contaminant simulation via Richard's ML service."""
    if not ML_API_URL:
        raise _ml_unavailable()

    params = {
        "sector_id":           sector_id,
        "flow_direction_deg":  flow_direction_deg,
        "water_velocity_ms":   water_velocity_ms,
        "contamination_level": contamination_level,
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            resp = await client.post(
                f"{ML_API_URL}/simulate/contaminant",
                json=params,
                headers={"X-API-Key": API_KEY},
            )
        if not resp.is_success:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail={"code": "ml_service_timeout"})
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail={"code": "ml_service_unavailable", "message": str(exc)})
