"""Data query router for retrieving environmental layers from Supabase."""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from database import get_supabase

router = APIRouter()


@router.get("/api/v1/layers/{sector_id}")
async def get_layers(
    sector_id: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    layer_type: Optional[str] = Query(None)
):
    """Return all environmental layers for a given sector and optional date range."""
    valid_layer_types = ["geotiff", "dem", "telemetry", "water_quality"]
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
                status_code=422,
                detail="Invalid date_from format. Use ISO 8601."
            ) from exc

    if date_to:
        try:
            datetime.fromisoformat(date_to)
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail="Invalid date_to format. Use ISO 8601."
            ) from exc

    layers = []

    try:
        supabase = get_supabase()
        query = supabase.table("water_quality_readings").select("*").eq("sector_id", sector_id)

        if date_from:
            query = query.gte("recorded_at", date_from)
        if date_to:
            query = query.lte("recorded_at", date_to)

        result = query.execute()

        for row in result.data:
            layers.append({
                "layer_type": "water_quality",
                "sector_id": sector_id,
                "data": row
            })

    except (ValueError, RuntimeError) as e:
        print(f"Supabase query error: {e}")

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
