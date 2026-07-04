from fastapi import APIRouter, Query, HTTPException
from datetime import datetime
from typing import Optional
from database import get_supabase

router = APIRouter()

@router.get("/api/v1/layers/{sector_id}")
async def get_layers(
    sector_id: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    layer_type: Optional[str] = Query(None)
):
    # Validate layer_type if provided
    valid_layer_types = ["geotiff", "dem", "telemetry", "water_quality"]
    if layer_type and layer_type not in valid_layer_types:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid layer_type. Must be one of: {valid_layer_types}"
        )

    # Validate date format if provided
    if date_from:
        try:
            datetime.fromisoformat(date_from)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid date_from format. Use ISO 8601.")

    if date_to:
        try:
            datetime.fromisoformat(date_to)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid date_to format. Use ISO 8601.")

    layers = []

    try:
        supabase = get_supabase()

        # Query water_quality_readings filtered by sector_id
        query = supabase.table("water_quality_readings").select("*").eq("sector_id", sector_id)

        # Apply date filters if provided
        if date_from:
            query = query.gte("recorded_at", date_from)
        if date_to:
            query = query.lte("recorded_at", date_to)

        result = query.execute()

        # Format each row as a layer object
        for row in result.data:
            layers.append({
                "layer_type": "water_quality",
                "sector_id": sector_id,
                "data": row
            })

    except Exception as e:
        print(f"Supabase query error: {e}")

    return {
        "sector_id": sector_id,
        "date_from": date_from,
        "date_to": date_to,
        "layer_type": layer_type,
        "layers": layers
    }