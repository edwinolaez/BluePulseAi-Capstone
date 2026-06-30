from fastapi import APIRouter, Query, HTTPException
from datetime import datetime
from typing import Optional

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

    return {
        "sector_id": sector_id,
        "date_from": date_from,
        "date_to": date_to,
        "layer_type": layer_type,
        "layers": []
    }