"""
Simulation router — proxies erosion and contaminant simulation requests to Richard's ML service.
Owner: Richard (ML) / Edwin (integration & QA)

This file is a proxy layer — like change_detection.py, it sits between the
frontend and Richard's ML service. The frontend calls these endpoints, and we
forward the request to the appropriate ML model, then return the result.

Two simulation models are exposed:
  1. Erosion (RUSLE model)
     Uses the Revised Universal Soil Loss Equation to estimate how much soil
     the Jasper watershed is likely to lose after wildfire + rainfall. Inputs
     are slope angle (from DEM data) and rainfall intensity (from Environment
     Canada). Output is a risk score and a predicted soil loss in tonnes/ha/year.

  2. Contaminant plume (hydrocarbon dispersion model)
     Models how hydrocarbon contamination released at a known source point
     (an old pipeline site in the Athabasca watershed) spreads downstream
     based on current water flow direction and velocity. Output is a set of
     plume polygon coordinates for the frontend to overlay on the map.

Default parameter values are based on the Jasper Valley watershed averages
measured during the 2021-2023 monitoring baseline period.

Endpoints:
  GET  /api/v1/simulate/erosion      — RUSLE-based erosion risk for a sector
  GET  /api/v1/simulate/contaminant  — hydrocarbon plume direction + velocity model
"""

import os
from datetime import datetime, timezone

# httpx is an async HTTP client — lets us call Richard's ML service without
# blocking the server while waiting for the simulation to complete.
import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Security
from fastapi.security.api_key import APIKeyHeader

from config import API_KEY

# All routes share the /api/v1/simulate prefix
router = APIRouter(prefix="/api/v1/simulate", tags=["simulation"])

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Richard's ML service base URL — set ML_API_URL in Railway environment variables
ML_API_URL = os.getenv("ML_API_URL", "")

# Maximum wait time for a simulation response — 30 seconds covers cold-start
# delays on Railway's free tier while avoiding indefinite hangs
TIMEOUT_S  = 30.0


async def require_api_key(api_key: str = Security(api_key_header)):
    """Dependency: reject requests that don't provide the correct API key.

    Args:
        api_key: Value from the X-API-Key request header

    Raises:
        HTTPException 401: If the key is missing or doesn't match config.API_KEY
    """
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _ml_unavailable() -> HTTPException:
    """Helper: build a standard 503 exception for when the ML service is not configured.

    Extracted into a function so both simulation endpoints raise the same structured
    error, which the frontend can detect by checking error.code == "ml_service_unavailable".

    Returns:
        HTTPException 503: With a machine-readable code field
    """
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

    Passes slope and rainfall values to the ML model, which applies the RUSLE
    (Revised Universal Soil Loss Equation) to estimate erosion risk. The default
    values (slope_deg=38.5, rainfall_mm=82.0) are Jasper Valley watershed averages
    but should be overridden with real-time telemetry values when available.

    Args:
        sector_id:   The sector to run the simulation for (required URL query param)
        slope_deg:   Terrain slope in degrees — sourced from DEM data
        rainfall_mm: Daily rainfall in millimetres — sourced from Environment Canada

    Returns:
        dict: The raw JSON response from Richard's ML service (risk score, loss estimate)

    Raises:
        HTTPException 503: If ML_API_URL is not configured or the service is unreachable
        HTTPException 504: If the ML service didn't respond within TIMEOUT_S seconds
    """
    # Guard clause — fail fast if no ML service URL has been configured
    if not ML_API_URL:
        raise _ml_unavailable()

    # Bundle all three parameters into the request body for the ML service
    params = {"sector_id": sector_id, "slope_deg": slope_deg, "rainfall_mm": rainfall_mm}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            resp = await client.post(
                f"{ML_API_URL}/simulate/erosion",
                json=params,
                # Forward our API key so the ML service knows the request is authorised
                headers={"X-API-Key": API_KEY},
            )
        if not resp.is_success:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail={"code": "ml_service_timeout"})
    except httpx.RequestError as exc:
        # Network-level error (DNS failure, connection refused, etc.)
        raise HTTPException(status_code=503, detail={"code": "ml_service_unavailable", "message": str(exc)})


@router.get("/contaminant", dependencies=[Depends(require_api_key)])
async def simulate_contaminant(
    sector_id:           str   = Query(...),
    flow_direction_deg:  float = Query(180.0, description="Water flow direction in degrees"),
    water_velocity_ms:   float = Query(2.1,   description="Water velocity in m/s"),
    contamination_level: float = Query(0.72,  description="Normalised contamination level 0-1"),
):
    """Run the hydrocarbon plume contaminant dispersion simulation via Richard's ML service.

    Models how a hydrocarbon plume released at a known source point (the old
    Athabasca pipeline site at lat=56.7267, lon=-111.3790) spreads downstream
    based on water flow direction and velocity. The frontend overlays the resulting
    plume polygons on the 3D map to show environmental responders where contamination
    is likely to reach next.

    The query parameters (flow direction, velocity, contamination level) can be
    overridden with real-time values from telemetry_parser.py when available.

    Args:
        sector_id:           The sector to model the plume for
        flow_direction_deg:  Which direction water is flowing (0=North, 180=South)
        water_velocity_ms:   How fast the river is moving in metres per second
        contamination_level: Normalised severity of contamination at source (0.0–1.0)

    Returns:
        dict: The raw JSON from Richard's ML service (plume polygon GeoJSON + risk metadata)

    Raises:
        HTTPException 503: If ML_API_URL is not configured or the service is unreachable
        HTTPException 504: If the ML service didn't respond within TIMEOUT_S seconds
    """
    if not ML_API_URL:
        raise _ml_unavailable()

    # The source point coordinates are the known old pipeline site in the Athabasca
    # watershed — this is hardcoded because the source never changes between runs
    body = {
        "sector_id":    sector_id,
        "source_point": {"lat": 56.7267, "lon": -111.3790},
    }
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_S) as client:
            resp = await client.post(
                f"{ML_API_URL}/simulate/contaminant",
                json=body,
                headers={"X-API-Key": API_KEY},
            )
        if not resp.is_success:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail={"code": "ml_service_timeout"})
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail={"code": "ml_service_unavailable", "message": str(exc)})
