import os
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from datetime import datetime, timezone
from schemas.ingest_schema import GeoTiffIngest, DEMIngest, TelemetryIngest
from database import get_supabase

router = APIRouter()

MAX_FILE_SIZE = 50 * 1024 * 1024

@router.post("/api/v1/ingest/geotiff")
async def ingest_geotiff(
    file: UploadFile = File(...),
    sector_id: str = Form(...),
    data_source: str = Form(...),
    user_id: str = Form(...),
):
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 50MB.")

    if not file.filename.endswith(".tif") and not file.filename.endswith(".tiff"):
        raise HTTPException(status_code=422, detail="Invalid file format. Only GeoTIFF files accepted.")

    timestamp = datetime.now(timezone.utc).isoformat()
    return {
        "status": "accepted",
        "layer_type": "geotiff",
        "layer_id": f"geotiff-{sector_id}-{timestamp}",
        "sector_id": sector_id,
        "user_id": user_id,
        "timestamp": timestamp,
        "filename": file.filename,
        "size_bytes": len(contents)
    }


@router.post("/api/v1/ingest/dem")
async def ingest_dem(
    file: UploadFile = File(...),
    sector_id: str = Form(...),
    data_source: str = Form(...),
    user_id: str = Form(...),
):
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Max size is 50MB.")

    if not file.filename.endswith(".tif") and not file.filename.endswith(".tiff"):
        raise HTTPException(status_code=422, detail="Invalid file format. Only DEM GeoTIFF files accepted.")

    timestamp = datetime.now(timezone.utc).isoformat()
    return {
        "status": "accepted",
        "layer_type": "dem",
        "layer_id": f"dem-{sector_id}-{timestamp}",
        "sector_id": sector_id,
        "user_id": user_id,
        "timestamp": timestamp,
        "filename": file.filename,
        "size_bytes": len(contents)
    }


@router.post("/api/v1/ingest/telemetry")
async def ingest_telemetry(
    sector_id: str = Form(...),
    data_source: str = Form(...),
    user_id: str = Form(...),
    turbidity: float = Form(...),
    flow_rate: float = Form(...),
):
    timestamp = datetime.now(timezone.utc).isoformat()

    try:
        supabase = get_supabase()
        record = {
            "sector_id": sector_id,
            "turbidity": turbidity,
            "recorded_at": timestamp,
            "payload": {"flow_rate": flow_rate, "data_source": data_source}
        }
        supabase.table("water_quality_readings").insert(record).execute()
    except Exception:
        pass

    return {
        "status": "accepted",
        "layer_type": "telemetry",
        "record_id": f"telemetry-{sector_id}-{timestamp}",
        "sector_id": sector_id,
        "user_id": user_id,
        "timestamp": timestamp,
        "turbidity": turbidity,
        "flow_rate": flow_rate
    }