"""
Data query router — returns environmental layers from Supabase for a given sector.
Owner: Feven | Data Pipeline & API Engineer

This file handles the main "read" path of the Jasper data pipeline.
Reyta's 3D map frontend calls this endpoint whenever a user clicks on a sector
or adjusts the date filters — it needs all the available environmental data for
that location to render the map overlays correctly.

The endpoint queries three Supabase tables and combines the results:
  1. ingest_records         — generic ingest data written by POST /api/v1/ingest
  2. water_quality_readings — river sensor readings written by POST /ingest/telemetry
  3. environmental_layers   — legacy Sprint 2 records (kept for backwards compatibility)

All three result sets are normalised into the same "layer" format so the frontend
only has to handle one data shape regardless of which table a record came from.
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Security
from fastapi.security.api_key import APIKeyHeader

from database import get_supabase
from config import API_KEY

# No prefix here — the full path /api/v1/layers/{sector_id} is declared on the route
router = APIRouter()

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    """Dependency: reject requests that don't provide the correct API key.

    FastAPI calls this before the endpoint body runs. Returns 401 if the key
    is missing or doesn't match the value in config.py.

    Args:
        api_key: Value from the X-API-Key request header

    Raises:
        HTTPException 401: If the key is missing or wrong
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
    """Return all environmental data layers for a sector, with optional date and type filters.

    This is the primary data-fetch endpoint for Reyta's 3D map. It combines
    records from three Supabase tables into a single unified list of "layers",
    each with a normalised coordinate and timestamp field for easy rendering.

    Args:
        sector_id:  The monitoring sector to query (e.g. "ATH-001-A"). Required — part of URL.
        date_from:  Only return records on or after this ISO 8601 date (optional)
        date_to:    Only return records on or before this ISO 8601 date (optional)
        layer_type: Only return this type of layer — must be one of the valid types (optional)

    Returns:
        dict: The sector_id, active filters, and a "layers" list with all combined records

    Raises:
        HTTPException 422: If layer_type is not a recognised value, or dates are malformed
        HTTPException 404: If no data exists for the requested sector across all three tables
    """
    # Whitelist of accepted layer types — prevents arbitrary string queries reaching Supabase
    valid_layer_types = ["geotiff", "dem", "telemetry", "water_quality", "burn_scar"]
    if layer_type and layer_type not in valid_layer_types:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid layer_type. Must be one of: {valid_layer_types}"
        )

    # Validate date strings early so the caller gets a clear error message
    # rather than a confusing Supabase query failure later
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

        # ----------------------------------------------------------------
        # Query 1 — ingest_records table
        # Written by POST /api/v1/ingest (migration 008). Each row stores
        # a sector_id, layer_type, coordinates (GeoJSON Point), and payload.
        # ----------------------------------------------------------------
        ingest_query = (
            supabase.table("ingest_records")
            .select("*")
            .eq("sector_id", sector_id)
        )
        # Apply optional filters only when they were provided
        if date_from:
            ingest_query = ingest_query.gte("timestamp", date_from)
        if date_to:
            ingest_query = ingest_query.lte("timestamp", date_to)
        if layer_type:
            ingest_query = ingest_query.eq("layer_type", layer_type)

        ingest_result = ingest_query.execute()
        for row in ingest_result.data:
            # The coordinates column can hold two different formats depending on when
            # the record was written. Normalise both into a simple {lat, lon} dict.
            coords = row.get("coordinates") or {}
            lat = lon = None
            if isinstance(coords, dict):
                if coords.get("type") == "Point" and isinstance(coords.get("coordinates"), list):
                    # GeoJSON Point format: {"type": "Point", "coordinates": [lon, lat]}
                    # Note: GeoJSON stores coordinates as [longitude, latitude] — opposite of most APIs
                    coord_list = coords["coordinates"]
                    lon = coord_list[0] if len(coord_list) >= 1 else None
                    lat = coord_list[1] if len(coord_list) >= 2 else None
                else:
                    # Legacy flat format: {"lat": 52.8, "lon": -118.1}
                    lat = coords.get("lat")
                    lon = coords.get("lon")

            layers.append({
                "layer_type": row.get("layer_type", "unknown"),
                "sector_id": sector_id,
                "source": "ingest_records",
                "coordinates": {"lat": lat, "lon": lon},
                "timestamp": row.get("timestamp"),
                "data": row,
            })

        # ----------------------------------------------------------------
        # Query 2 — water_quality_readings table
        # Written by POST /api/v1/ingest/telemetry. Contains turbidity and
        # flow rate readings from Environment Canada water sensors.
        # Only run this query if the caller hasn't filtered to a non-water type.
        # ----------------------------------------------------------------
        if not layer_type or layer_type in ["water_quality", "telemetry"]:
            wq_query = (
                supabase.table("water_quality_readings")
                .select("*")
                .eq("sector_id", sector_id)
            )
            # This table uses "recorded_at" instead of "timestamp" — different column name
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

        # ----------------------------------------------------------------
        # Query 3 — environmental_layers table
        # Legacy table from Sprint 2 — kept for backwards compatibility.
        # Coordinates and metadata are stored in a JSONB "payload" column.
        # ----------------------------------------------------------------
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
            # Coordinates are nested inside the JSONB payload for this legacy table
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
        # Log the error for Railway logs but don't crash — we check layers below
        # and return 404 if empty, which surfaces a cleaner error to the frontend
        print(f"Supabase query error: {e}")

    # If all three queries returned nothing, tell the caller this sector has no data
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
