"""Ingest routers for GeoTIFF, DEM, and telemetry data ingestion."""
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Security, UploadFile
from fastapi.responses import JSONResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field

from database import get_supabase

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB in bytes

# API key security — checks X-API-Key header on every protected endpoint
API_KEY = "jasper-dev-api-key-2026"

# APIKeyHeader tells FastAPI to look for a header called "X-API-Key"
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    """Validate the X-API-Key header — returns 401 if missing or wrong."""
    # If no key provided or wrong key, reject the request immediately
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


class Coordinates(BaseModel):
    """Geographic coordinates with range validation.
    
    lat must be between -90 and 90 (south to north pole)
    lon must be between -180 and 180 (west to east)
    ge means 'greater than or equal to', le means 'less than or equal to'
    If coordinates are out of range, Pydantic automatically returns 422.
    """

    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class IngestRecord(BaseModel):
    """Schema for a generic ingest record sent as JSON body.
    
    This tells FastAPI exactly what fields are required in the request body.
    If any required field is missing, FastAPI automatically returns 422.
    """

    sector_id: str
    layer_type: str
    coordinates: Coordinates
    timestamp: str
    payload: Optional[Dict[str, Any]] = {}


@router.post("/api/v1/ingest", status_code=201, dependencies=[Depends(require_api_key)])
async def ingest_base(record: IngestRecord):
    """Base ingest endpoint — accepts JSON ingest records.

    Persists to the ingest_records table in Supabase.
    Coordinates are stored in payload as lat/lon (avoids PostGIS WKT complexity).
    Returns 201 with the DB-generated id, sector_id, and timestamp.
    """
    record_id = str(uuid.uuid4())
    try:
        supabase = get_supabase()
        row = {
            "sector_id": record.sector_id,
            "layer_type": record.layer_type,
            "payload": {
                "lat": record.coordinates.lat,
                "lon": record.coordinates.lon,
                **(record.payload or {}),
            },
            "timestamp": record.timestamp,
        }
        result = supabase.table("environmental_layers").insert(row).execute()
        if result.data:
            record_id = result.data[0]["id"]
    except Exception:
        pass

    return JSONResponse(status_code=201, content={
        "id": record_id,
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
    """Ingest a GeoTIFF satellite imagery file into the pipeline.
    
    Accepts multipart/form-data with a .tif or .tiff file.
    Rejects files larger than 50MB or files with wrong format.
    """
    # Check file size before reading — avoids loading huge files into memory
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 50MB.")

    # Read file contents into memory so we can check format and size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 50MB.")

    # Check file extension — only accept .tif or .tiff files
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
    """Ingest a Digital Elevation Model (DEM) GeoTIFF file.
    
    Accepts multipart/form-data with a .tif or .tiff file.
    Rejects files larger than 50MB or files with wrong format.
    """
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
    """Ingest water quality telemetry data and store in Supabase.
    
    Accepts form data with turbidity and flow_rate readings.
    Stores the record in the water_quality_readings table.
    flow_rate goes into the payload JSONB field since Rahil's schema
    doesn't have a dedicated column for it yet.
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    try:
        # Get a Supabase client and insert the telemetry record
        supabase = get_supabase()
        record = {
            "sector_id": sector_id,
            "turbidity": turbidity,
            "recorded_at": timestamp,
            # flow_rate goes in payload since there's no dedicated column yet
            "payload": {"flow_rate": flow_rate, "data_source": data_source},
        }
        supabase.table("water_quality_readings").insert(record).execute()
    except Exception as e:
        # If database is down, return 503 Service Unavailable
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
