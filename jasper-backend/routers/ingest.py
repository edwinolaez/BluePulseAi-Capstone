"""Ingest endpoints for GeoTIFF, DEM, and telemetry data — Owner: Feven."""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Security, UploadFile
from fastapi.responses import JSONResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field

from database import get_supabase
from config import API_KEY

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB in bytes

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    """Runs before every protected endpoint — returns 401 if key is missing or wrong."""
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


class Coordinates(BaseModel):
    """Validates lat/lon ranges — automatically rejects values like lat=999."""
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
    """Accept a generic JSON ingest record and save it to Supabase ingest_records table.
    Returns 201 Created with the Supabase-generated UUID that Edwin's E2E tests check for."""
    timestamp = record.timestamp

    try:
        supabase = get_supabase()
        db_record = {
            "sector_id": record.sector_id,
            "layer_type": record.layer_type,
            "coordinates": {
                "type": "Point",
                "coordinates": [record.coordinates.lon, record.coordinates.lat],
            },
            "payload": record.payload or {},
            "timestamp": timestamp,
        }
        result = supabase.table("ingest_records").insert(db_record).execute()
        record_id = result.data[0]["id"] if result.data else str(uuid.uuid4())
    except Exception as e:
        raise HTTPException(
            status_code=503, detail=f"Database unavailable: {e}"
        ) from e

    return JSONResponse(status_code=201, content={
        "id": record_id,
        "sector_id": record.sector_id,
        "timestamp": timestamp,
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
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 50MB.")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 50MB.")

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
        supabase.table("water_quality_readings").insert(record).execute()
    except Exception as e:
        raise HTTPException(
            status_code=503, detail=f"Database unavailable: {e}"
        ) from e

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
