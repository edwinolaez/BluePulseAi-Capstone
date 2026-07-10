"""Data query router for retrieving environmental layers from Supabase."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Security
from fastapi.security.api_key import APIKeyHeader

from database import get_supabase

router = APIRouter()

# API key security — same pattern as ingest.py
# We define it here too so data.py is self-contained
API_KEY = "jasper-dev-api-key-2026"

# APIKeyHeader tells FastAPI to look for a header called "X-API-Key"
# auto_error=False means FastAPI won't automatically throw an error —
# we handle the error ourselves in require_api_key() below
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    """Validate the X-API-Key header — returns 401 if missing or wrong.

    This function runs before the endpoint code whenever it's listed
    as a dependency. If the key is wrong or missing, FastAPI stops
    here and returns a 401 error without ever reaching the endpoint.
    """
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@router.get("/api/v1/layers/{sector_id}", dependencies=[Depends(require_api_key)])
async def get_layers(
    sector_id: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    layer_type: Optional[str] = Query(None)
):
    """Return all environmental layers for a given sector and optional date range.

    sector_id is part of the URL path — e.g. /api/v1/layers/S1
    date_from, date_to, layer_type are optional query parameters —
    e.g. /api/v1/layers/S1?date_from=2026-01-01&layer_type=water_quality

    Returns 404 if no data exists for the requested sector.
    Returns 422 if date format or layer_type is invalid.
    Returns 401 if no valid API key is provided.
    """
    # Validate layer_type if the caller provided one
    # If they ask for "geotiff" that's fine, but "banana" should be rejected
    valid_layer_types = ["geotiff", "dem", "telemetry", "water_quality"]
    if layer_type and layer_type not in valid_layer_types:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid layer_type. Must be one of: {valid_layer_types}"
        )

    # Validate date format if date_from was provided
    # datetime.fromisoformat() will raise ValueError if the format is wrong
    if date_from:
        try:
            datetime.fromisoformat(date_from)
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail="Invalid date_from format. Use ISO 8601."
            ) from exc

    # Same validation for date_to
    if date_to:
        try:
            datetime.fromisoformat(date_to)
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail="Invalid date_to format. Use ISO 8601."
            ) from exc

    # Start with an empty list — we'll fill it from Supabase below
    layers = []

    try:
        supabase = get_supabase()
        wq_query = supabase.table("water_quality_readings").select("*").eq("sector_id", sector_id)
        if date_from:
            wq_query = wq_query.gte("recorded_at", date_from)
        if date_to:
            wq_query = wq_query.lte("recorded_at", date_to)
        wq_result = wq_query.execute()
        for row in wq_result.data:
            layers.append({
                "layer_type": "water_quality",
                "sector_id": sector_id,
                "coordinates": {},
                "timestamp": row.get("recorded_at"),
                "data": row,
            })
    except Exception as e:
        print(f"Supabase water_quality_readings query error: {e}")

    try:
        supabase = get_supabase()
        ir_query = supabase.table("ingest_records").select("*").eq("sector_id", sector_id)
        if date_from:
            ir_query = ir_query.gte("timestamp", date_from)
        if date_to:
            ir_query = ir_query.lte("timestamp", date_to)
        if layer_type:
            ir_query = ir_query.eq("layer_type", layer_type)
        ir_result = ir_query.execute()
        for row in ir_result.data:
            payload = row.get("payload") or {}
            layers.append({
                "layer_type": row.get("layer_type", "unknown"),
                "sector_id": sector_id,
                "coordinates": {
                    "lat": payload.get("lat"),
                    "lon": payload.get("lon"),
                },
                "timestamp": row.get("timestamp"),
                "data": payload,
            })
    except Exception as e:
        print(f"Supabase ingest_records query error: {e}")

    # If no layers were found after querying, return 404
    # Edwin's tests expect 404 when a sector has no data — not an empty 200
    if not layers:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for sector '{sector_id}'"
        )

    return {
        "sector_id": sector_id,
        "date_from": date_from,
        "date_to": date_to,
        "layer_type": layer_type,
        "layers": layers
    }