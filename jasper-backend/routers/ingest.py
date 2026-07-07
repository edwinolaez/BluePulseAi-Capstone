"""Ingest routers for GeoTIFF, DEM, and telemetry data ingestion."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Security, UploadFile
from fastapi.security.api_key import APIKeyHeader

from database import get_supabase

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB in bytes

# This is the expected API key value — stored here for FastAPI-level auth
# Kong also enforces this at the gateway level
API_KEY = "jasper-dev-api-key-2026"

# This tells FastAPI to look for a header called "X-API-Key" on incoming requests
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    """Validate the X-API-Key header — returns 401 if missing or wrong."""
    # If no key provided or wrong key, reject the request immediately
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@router.post("/api/v1/ingest", dependencies=[Depends(require_api_key)])
async def ingest_base(
    sector_id: str = Form(...),
    data_source: str = Form(...),
    user_id: str = Form(...),
):
    """Base ingest endpoint — accepts generic sensor records."""
    timestamp = datetime.now(timezone.utc).isoformat()
    return {
        "status": "accepted",
        "sector_id": sector_id,
        "user_id": user_id,
        "timestamp": timestamp,
        "message": "Use /geotiff, /dem, or /telemetry for specific data types",
    }


@router.post("/api/v1/ingest/geotiff", dependencies=[Depends(require_api_key)])
async def ingest_geotiff(
    file: UploadFile = File(...),
    sector_id: str = Form(...),
    data_source: str = Form(...),  # noqa: ARG001
    user_id: str = Form(...),
):
    """Ingest a GeoTIFF satellite imagery file into the pipeline."""
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
    """Ingest a Digital Elevation Model (DEM) GeoTIFF file."""
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
    """Ingest water quality telemetry data and store in Supabase."""
    timestamp = datetime.now(timezone.utc).isoformat()

    try:
        supabase = get_supabase()
        record = {
            "sector_id": sector_id,
            "turbidity": turbidity,
            "recorded_at": timestamp,
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