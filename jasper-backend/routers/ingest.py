"""Ingest endpoints for GeoTIFF, DEM, and telemetry data — Owner: Feven."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Security, UploadFile
from fastapi.responses import JSONResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field

from database import get_supabase

router = APIRouter()

# Maximum allowed file size for uploads — prevents large files from crashing the server
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB in bytes

# The API key all protected endpoints require in the X-API-Key header
API_KEY = "jasper-dev-api-key-2026"

# Tells FastAPI to look for "X-API-Key" in the request headers
# auto_error=False lets us handle the error ourselves with a custom message
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    """Runs before every protected endpoint — returns 401 if key is missing or wrong."""
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


class Coordinates(BaseModel):
    """Validates lat/lon ranges — automatically rejects values like lat=999."""
    # ge = greater than or equal, le = less than or equal
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class IngestRecord(BaseModel):
    """JSON body schema for the base ingest endpoint.
    FastAPI automatically returns 422 if any required field is missing."""
    sector_id: str
    layer_type: str
    coordinates: Coordinates
    timestamp: str
    payload: Optional[Dict[str, Any]] = {}


@router.post("/api/v1/ingest", status_code=201, dependencies=[Depends(require_api_key)])
async def ingest_base(record: IngestRecord):
    """Accepts a generic JSON ingest record — used by Edwin's integration tests.
    Returns 201 Created with a generated UUID that Edwin's tests check for."""
    # uuid.uuid4() generates a unique ID — in production Supabase would return this
    return JSONResponse(status_code=201, content={
        "id": str(uuid.uuid4()),
        "sector_id": record.sector_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })


@router.post("/api/v1/ingest/geotiff", dependencies=[Depends(require_api_key)])
async def ingest_geotiff(
    file: UploadFile = File(...),
    sector_id: str = Form(...),
    data_source: str = Form(...),  # noqa: ARG001
    user_id: str = Form(...),
):
    """Accepts Sentinel-2 satellite imagery files from Copernicus.
    Only .tif/.tiff files under 50MB are accepted."""
    # Check size before reading to avoid loading huge files into memory
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 50MB.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 50MB.")

    # Reject non-GeoTIFF files — rasterio can only parse .tif/.tiff format
    if not file.filename.endswith(".tif") and not file.filename.endswith(".tiff"):
        raise HTTPException(
            status_code=422, detail="Invalid file format. Only GeoTIFF files accepted."
        )

    timestamp = datetime.now(timezone.utc).isoformat()
    return {
        "status": "accepted",
        "layer_type": "geotiff",
        "layer_id": f"geotiff-{sector_id}-{timestamp}",
        "sector_id": sector_id,
        "user_id": user_id,
        "timestamp": timestamp,
        "filename": file.filename,
        "size_bytes": len(contents),
    }


@router.post("/api/v1/ingest/dem", dependencies=[Depends(require_api_key)])
async def ingest_dem(
    file: UploadFile = File(...),
    sector_id: str = Form(...),
    data_source: str = Form(...),  # noqa: ARG001
    user_id: str = Form(...),
):
    """Accepts terrain elevation files from Altalis provincial open data.
    Richard's ML models use DEM data to calculate erosion and landslide risk."""
    # Same size and format checks as GeoTIFF above
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 50MB.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 50MB.")

    if not file.filename.endswith(".tif") and not file.filename.endswith(".tiff"):
        raise HTTPException(
            status_code=422, detail="Invalid file format. Only DEM GeoTIFF files accepted."
        )

    timestamp = datetime.now(timezone.utc).isoformat()
    return {
        "status": "accepted",
        "layer_type": "dem",
        "layer_id": f"dem-{sector_id}-{timestamp}",
        "sector_id": sector_id,
        "user_id": user_id,
        "timestamp": timestamp,
        "filename": file.filename,
        "size_bytes": len(contents),
    }


@router.post("/api/v1/ingest/telemetry", dependencies=[Depends(require_api_key)])
async def ingest_telemetry(
    sector_id: str = Form(...),
    data_source: str = Form(...),
    user_id: str = Form(...),
    turbidity: float = Form(...),
    flow_rate: float = Form(...),
):
    """Accepts water quality sensor readings from Environment Canada Water Office.
    Stores the record in Rahil's water_quality_readings table in Supabase."""
    timestamp = datetime.now(timezone.utc).isoformat()

    try:
        supabase = get_supabase()
        record = {
            "sector_id": sector_id,
            "turbidity": turbidity,
            "recorded_at": timestamp,
            # flow_rate stored in payload JSONB — no dedicated column yet (agreed with Rahil)
            "payload": {"flow_rate": flow_rate, "data_source": data_source},
        }
        # Insert the record — .execute() runs the actual database query
        supabase.table("water_quality_readings").insert(record).execute()
    except Exception as e:
        # Return 503 if database is down so the caller knows to retry
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}") from e

    return {
        "status": "accepted",
        "layer_type": "telemetry",
        "record_id": f"telemetry-{sector_id}-{timestamp}",
        "sector_id": sector_id,
        "user_id": user_id,
        "timestamp": timestamp,
        "turbidity": turbidity,
        "flow_rate": flow_rate,
    }
