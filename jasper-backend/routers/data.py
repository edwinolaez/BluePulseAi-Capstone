"""Data query router — returns environmental layers from Supabase — Owner: Feven."""
from datetime import datetime
from typing import Optional

# Depends and Security are needed for the API key authentication dependency
from fastapi import APIRouter, Depends, HTTPException, Query, Security
from fastapi.security.api_key import APIKeyHeader

from database import get_supabase

router = APIRouter()

# Same API key setup as ingest.py — every protected endpoint checks this header
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
    Accepts optional filters: date_from, date_to, layer_type.
    Returns 404 if no data exists for the requested sector."""
    # Only these four layer types are valid — reject anything else with 422
    valid_layer_types = ["geotiff", "dem", "telemetry", "water_quality"]
    if layer_type and layer_type not in valid_layer_types:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid layer_type. Must be one of: {valid_layer_types}"
        )

    # Validate date format if provided — fromisoformat() raises ValueError if wrong
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

    # Start with empty list — filled by Supabase query below
    layers = []

    try:
        supabase = get_supabase()

        # Query water_quality_readings filtered by sector_id
        # .select("*") fetches all columns, .eq() filters by sector
        query = supabase.table("water_quality_readings").select("*").eq("sector_id", sector_id)

        # Apply optional date range filters if the caller provided them
        # gte = greater than or equal, lte = less than or equal
        if date_from:
            query = query.gte("recorded_at", date_from)
        if date_to:
            query = query.lte("recorded_at", date_to)

        # .execute() runs the query and returns result.data as a list of rows
        result = query.execute()

        # Format each database row into a standardized layer object
        for row in result.data:
            layers.append({
                "layer_type": "water_quality",
                "sector_id": sector_id,
                "data": row
            })

    except (ValueError, RuntimeError) as e:
        # Log the error but don't crash — layers stays empty and 404 triggers below
        print(f"Supabase query error: {e}")

    # Return 404 if no layers found — Edwin's tests expect this for unknown sectors
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
