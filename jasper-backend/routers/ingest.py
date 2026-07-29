"""
Ingest endpoints — accept environmental data from external sources and store it in Supabase.
Owner: Feven | Data Pipeline & API Engineer

This file is the "write" side of the Jasper data pipeline. External services send
raw sensor and satellite data here, and we validate and store it so the read
endpoints (data.py, fusion.py, timeline.py) can serve it to the frontend map.

There are four ingest endpoints:
  1. POST /api/v1/ingest          — generic JSON record (any layer type)
  2. POST /api/v1/ingest/geotiff  — Sentinel-2 satellite imagery (.tif file upload)
  3. POST /api/v1/ingest/dem      — Altalis terrain elevation files (.tif file upload)
  4. POST /api/v1/ingest/telemetry — river sensor readings (turbidity + flow rate)

File upload endpoints (geotiff + dem) currently accept and validate the file but
do not store the binary content in Supabase — they return an acknowledgement so
the upload pipeline can record that a file arrived. Storage to Supabase Storage
buckets is a Phase 2 task.
"""

import uuid
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Security, UploadFile
from fastapi.responses import JSONResponse
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel, Field

from database import get_supabase
from config import API_KEY

# No prefix — full paths are declared on each route decorator below
router = APIRouter()

# Maximum file size for satellite and elevation uploads: 50 megabytes
# Expressed in bytes: 50 * 1024 * 1024 = 52,428,800 bytes
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB in bytes

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    """Dependency: reject requests that don't provide the correct API key.

    FastAPI calls this before the endpoint body runs on every protected endpoint.

    Args:
        api_key: Value from the X-API-Key request header

    Raises:
        HTTPException 401: If the key is missing or wrong
    """
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


class Coordinates(BaseModel):
    """Validates that geographic coordinates are within physically possible ranges.

    Using Field(..., ge=..., le=...) means FastAPI will automatically reject
    invalid values (e.g. lat=999) with a 422 before the endpoint runs.

    lat: Latitude — valid range is -90 (South Pole) to +90 (North Pole)
    lon: Longitude — valid range is -180 (West) to +180 (East)
    """
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)


class IngestRecord(BaseModel):
    """JSON body schema for the base ingest endpoint (POST /api/v1/ingest).

    FastAPI automatically validates every incoming request against this schema
    and returns 422 Unprocessable Entity if any required field is missing or
    the wrong type. This means the endpoint only runs if the data is clean.

    sector_id:  Which monitoring sector this record belongs to (e.g. "ATH-001-A")
    layer_type: What kind of data this is (e.g. "burn_scar", "geotiff", "telemetry")
    coordinates: The geographic location of this reading
    timestamp:  When the reading was taken (ISO 8601 string)
    payload:    Any extra fields specific to this data type (stored as JSON)
    """
    sector_id: str
    layer_type: str
    coordinates: Coordinates
    timestamp: str
    payload: Optional[Dict[str, Any]] = {}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/api/v1/ingest", status_code=201, dependencies=[Depends(require_api_key)])
async def ingest_base(record: IngestRecord):
    """Accept a generic JSON ingest record and save it to the ingest_records table.

    This is the most flexible ingest endpoint — it can accept any layer_type.
    Coordinates are stored in GeoJSON Point format so Supabase's PostGIS
    extension can do spatial queries on them in the future.

    Args:
        record: Validated IngestRecord payload

    Returns:
        JSONResponse 201: The Supabase-generated row ID, sector_id, and timestamp.
                          Edwin's E2E tests check for the "id" field in this response.

    Raises:
        HTTPException 503: If Supabase is unavailable or the insert fails
    """
    timestamp = record.timestamp

    try:
        supabase = get_supabase()

        # Convert from our {lat, lon} format to GeoJSON Point format.
        # GeoJSON stores coordinates as [longitude, latitude] — note the reversed order.
        # This is the standard but it's a common source of bugs, so it's worth noting.
        db_record = {
            "sector_id":  record.sector_id,
            "layer_type": record.layer_type,
            "coordinates": {
                "type": "Point",
                "coordinates": [record.coordinates.lon, record.coordinates.lat],
            },
            "payload":   record.payload or {},
            "timestamp": timestamp,
        }
        result = supabase.table("ingest_records").insert(db_record).execute()

        # Use the Supabase-generated UUID if available; fall back to a local one
        # if the insert succeeded but didn't return data (shouldn't happen but defensive)
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
    data_source: str = Form(...),  # noqa: ARG001 — required by upload protocol, not used locally
    user_id: str = Form(...),
):
    """Accept a Sentinel-2 satellite imagery file from Copernicus.

    Validates that the file is a .tif/.tiff under 50MB. The binary content
    is read into memory for size validation but not stored — file storage to
    Supabase Storage buckets is a Phase 2 task.

    Args:
        file:        The uploaded .tif or .tiff file
        sector_id:   Which sector this image covers
        data_source: Data provider identifier (required by upload protocol)
        user_id:     Who uploaded this file (for audit purposes)

    Returns:
        dict: Acknowledgement with layer_id, sector, and file metadata

    Raises:
        HTTPException 413: If the file exceeds 50MB
        HTTPException 422: If the file is not a .tif or .tiff
    """
    # Check the Content-Length header first (fast path) before reading the file
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 50MB.")

    # Read the full file to confirm the actual size — Content-Length can be spoofed
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 50MB.")

    # Only accept GeoTIFF format — other formats would fail downstream processing
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
    data_source: str = Form(...),  # noqa: ARG001 — required by upload protocol, not used locally
    user_id: str = Form(...),
):
    """Accept a Digital Elevation Model file from Altalis provincial open data.

    DEM files are GeoTIFFs that contain the terrain height at every point in the
    Jasper watershed. Richard's ML models use these to calculate slope angles,
    which directly feed into RUSLE erosion risk calculations. Accepts .tif/.tiff
    files under 50MB only.

    Args:
        file:        The uploaded DEM .tif or .tiff file
        sector_id:   Which sector this elevation data covers
        data_source: Data provider identifier (required by upload protocol)
        user_id:     Who uploaded this file (for audit purposes)

    Returns:
        dict: Acknowledgement with layer_id, sector, and file metadata

    Raises:
        HTTPException 413: If the file exceeds 50MB
        HTTPException 422: If the file is not a .tif or .tiff
    """
    # Same two-step size check as ingest_geotiff — fast header check, then full read
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
    """Accept a water quality sensor reading and store it in Supabase.

    Telemetry data comes from Environment Canada Water Office stations on the
    Athabasca River. Turbidity (cloudiness) and flow rate are the two primary
    indicators of post-wildfire contamination and erosion runoff.

    Turbidity gets its own column in water_quality_readings because it's
    queried directly by the change-detection model. Flow rate is stored in
    the JSONB payload column since it doesn't have a dedicated column yet
    (this was agreed with Rahil — adding the column is a Sprint 3 task).

    Args:
        sector_id:   Which monitoring sector the sensor is in
        data_source: Which station provided this reading (e.g. "07AA002")
        user_id:     Who submitted this reading
        turbidity:   Water cloudiness in NTU (Nephelometric Turbidity Units)
        flow_rate:   River flow rate in m³/s

    Returns:
        dict: Acknowledgement with record_id and the values that were stored

    Raises:
        HTTPException 503: If Supabase is unavailable or the insert fails
    """
    timestamp = datetime.now(timezone.utc).isoformat()

    try:
        supabase = get_supabase()
        record = {
            "sector_id":   sector_id,
            "turbidity":   turbidity,
            "recorded_at": timestamp,
            # flow_rate has no dedicated column yet — store it in the JSONB payload.
            # data_source is also recorded here so we know which station sent the reading.
            "payload": {"flow_rate": flow_rate, "data_source": data_source},
        }
        supabase.table("water_quality_readings").insert(record).execute()
    except Exception as e:
        raise HTTPException(
            status_code=503, detail=f"Database unavailable: {e}"
        ) from e

    return {
        "status":     "accepted",
        "layer_type": "telemetry",
        "record_id":  f"telemetry-{sector_id}-{timestamp}",
        "sector_id":  sector_id,
        "user_id":    user_id,
        "timestamp":  timestamp,
        "turbidity":  turbidity,
        "flow_rate":  flow_rate,
    }
