"""Data query router — returns environmental layers from Supabase — Owner: Feven."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Security
from fastapi.security.api_key import APIKeyHeader

from database import get_supabase

router = APIRouter()

API_KEY = "jasper-dev-api-key-2026"
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    """Runs before the endpoint — returns 401 if API key is missing or wrong."""
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@router.get("/api/v1/layers/{sector_id}", dependencies=[Depends(require_api_key)])
async def get_layers(
    sector_id: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    layer_type: Optional[str] = Query(None)
):
    """Returns all environmental layers for a sector — used by Reyta's map frontend.
    Queries ingest_records, water_quality_readings, and environmental_layers tables.
    Returns 404 if no data exists for the requested sector."""
    valid_layer_types = ["geotiff", "dem", "telemetry", "water_quality", "burn_scar"]
    if layer_type and layer_type not in valid_layer_types:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid layer_type. Must be one of: {valid_layer_types}"
        )

    if date_from:
        try:
            datetime.fromisoformat(date_from)
        except ValueError as exc:
            raise HTTPException(
                status_code=422, detail="Invalid date_from format. Use ISO 8601."
            ) from exc

    if date_to:
        try:
            datetime.fromisoformat(date_to)
        except ValueError as exc:
            raise HTTPException(
                status_code=422, detail="Invalid date_to format. Use ISO 8601."
            ) from exc

    layers = []

    try:
        supabase = get_supabase()

        # Query 1 — ingest_records table (base ingest endpoint, migration 008)
        ingest_query = (
            supabase.table("ingest_records")
            .select("*")
            .eq("sector_id", sector_id)
        )
        if date_from:
            ingest_query = ingest_query.gte("timestamp", date_from)
        if date_to:
            ingest_query = ingest_query.lte("timestamp", date_to)
        if layer_type:
            ingest_query = ingest_query.eq("layer_type", layer_type)

        ingest_result = ingest_query.execute()
        for row in ingest_result.data:
            layers.append({
                "layer_type": row.get("layer_type", "unknown"),
                "sector_id": sector_id,
                "source": "ingest_records",
                "data": row
            })

        # Query 2 — water_quality_readings table (telemetry sensor data)
        if not layer_type or layer_type in ["water_quality", "telemetry"]:
            wq_query = (
                supabase.table("water_quality_readings")
                .select("*")
                .eq("sector_id", sector_id)
            )
            if date_from:
                wq_query = wq_query.gte("recorded_at", date_from)
            if date_to:
                wq_query = wq_query.lte("recorded_at", date_to)

            wq_result = wq_query.execute()
            for row in wq_result.data:
                layers.append({
                    "layer_type": "water_quality",
                    "sector_id": sector_id,
                    "source": "water_quality_readings",
                    "data": row
                })

        # Query 3 — environmental_layers table (legacy Sprint 2 records)
        el_query = (
            supabase.table("environmental_layers")
            .select("*")
            .eq("sector_id", sector_id)
        )
        if date_from:
            el_query = el_query.gte("timestamp", date_from)
        if date_to:
            el_query = el_query.lte("timestamp", date_to)
        if layer_type:
            el_query = el_query.eq("layer_type", layer_type)

        el_result = el_query.execute()
        for row in el_result.data:
            payload = row.get("payload") or {}
            layers.append({
                "layer_type": row.get("layer_type", "unknown"),
                "sector_id": sector_id,
                "source": "environmental_layers",
                "coordinates": {
                    "lat": payload.get("lat"),
                    "lon": payload.get("lon"),
                },
                "timestamp": row.get("timestamp"),
                "data": payload,
            })

    except Exception as e:
        print(f"Supabase query error: {e}")

    if not layers:
        raise HTTPException(
            status_code=404, detail=f"No data found for sector '{sector_id}'"
        )

    return {
        "sector_id": sector_id,
        "date_from": date_from,
        "date_to": date_to,
        "layer_type": layer_type,
        "layers": layers
    }
