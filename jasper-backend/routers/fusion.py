"""
Multi-source data fusion endpoint — combines all data layers for a sector.
Owner: Feven | Data Pipeline & API Engineer

This file provides a "one-stop" endpoint that Reyta's risk overlay panel uses.
Instead of the frontend making three separate API calls and combining the results
itself, it calls GET /api/v1/fusion/{sector_id} once and receives a single unified
response with environmental layers, water quality readings, and ML model outputs
all merged together — plus a pre-computed summary (highest risk score, latest WQ).

The three source tables are:
  - environmental_layers   : satellite-derived burn scar and vegetation data
  - water_quality_archive  : long-term water chemistry records (pH, turbidity, hydrocarbons)
  - ml_model_outputs       : risk scores and labels from Richard's simulation models

Each query is wrapped in its own try/except so a failure in one source does not
block data from the other two — partial data is better than no data.
"""

from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

from database import get_supabase
from config import API_KEY

# No prefix — the full path /api/v1/fusion/{sector_id} is on the route decorator
router = APIRouter()

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    """Dependency: reject requests that don't provide the correct API key.

    Args:
        api_key: Value from the X-API-Key request header

    Raises:
        HTTPException 401: If the key is missing or doesn't match config.API_KEY
    """
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@router.get("/api/v1/fusion/{sector_id}", dependencies=[Depends(require_api_key)])
async def get_fusion(sector_id: str):
    """Return a unified view of all data sources for a sector.

    Queries environmental_layers, water_quality_archive, and ml_model_outputs in
    parallel (separate try/except blocks) then merges the results into one response.
    Reyta's frontend uses the `summary.highest_risk_score` field to set the colour
    of the risk overlay on the 3D map without having to compute it client-side.

    Args:
        sector_id: The monitoring sector to query (e.g. "ATH-001-A")

    Returns:
        dict: Combined data from all three sources plus a pre-computed summary

    Raises:
        HTTPException 404: If all three tables return no data for this sector
    """
    # Accumulate results from each source separately so partial failures
    # don't wipe out results from the other sources
    env_layers = []
    water_quality = []
    ml_outputs = []

    # ----------------------------------------------------------------
    # Source 1 — environmental_layers (satellite burn scar / vegetation)
    # ----------------------------------------------------------------
    try:
        supabase = get_supabase()
        result = supabase.table("environmental_layers").select("*").eq("sector_id", sector_id).execute()
        for row in result.data:
            # Coordinates and extra metadata are stored inside the JSONB payload column
            payload = row.get("payload") or {}
            env_layers.append({
                "layer_type": row.get("layer_type", "unknown"),
                "coordinates": {"lat": payload.get("lat"), "lon": payload.get("lon")},
                "timestamp": row.get("timestamp"),
                "data": payload,
            })
    except Exception as e:
        print(f"Fusion environmental_layers query error: {e}")

    # ----------------------------------------------------------------
    # Source 2 — water_quality_archive (long-term water chemistry)
    # ----------------------------------------------------------------
    try:
        supabase = get_supabase()
        result = supabase.table("water_quality_archive").select("*").eq("sector_id", sector_id).execute()
        for row in result.data:
            water_quality.append({
                "ph": row.get("ph"),
                "turbidity": row.get("turbidity"),
                "hydrocarbon_level": row.get("hydrocarbon_level"),
                "timestamp": row.get("timestamp"),
            })
    except Exception as e:
        print(f"Fusion water_quality_archive query error: {e}")

    # ----------------------------------------------------------------
    # Source 3 — ml_model_outputs (risk scores from Richard's models)
    # ----------------------------------------------------------------
    try:
        supabase = get_supabase()
        result = supabase.table("ml_model_outputs").select("*").eq("sector_id", sector_id).execute()
        for row in result.data:
            ml_outputs.append({
                "simulation_type": row.get("simulation_type"),
                "risk_score":      row.get("risk_score"),
                "risk_label":      row.get("risk_label"),
                "confidence":      row.get("confidence"),
                "model_version":   row.get("model_version"),
                "timestamp":       row.get("timestamp"),
            })
    except Exception as e:
        print(f"Fusion ml_model_outputs query error: {e}")

    # If every source is empty, the sector doesn't exist or has never been ingested
    if not env_layers and not water_quality and not ml_outputs:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for sector '{sector_id}' across any data source"
        )

    # Pre-compute summary values so the frontend doesn't have to
    # Filter out None before max() to avoid a TypeError on mixed data
    risk_scores = [o["risk_score"] for o in ml_outputs if o.get("risk_score") is not None]

    # Latest water quality = the last item in the list (assumes records come back in
    # chronological order from Supabase, which inserts in creation order by default)
    latest_wq = water_quality[-1] if water_quality else None

    return {
        "sector_id": sector_id,
        "environmental_layers": env_layers,
        "water_quality": water_quality,
        "ml_outputs": ml_outputs,
        "summary": {
            "layer_count":            len(env_layers),
            "water_quality_readings": len(water_quality),
            "ml_output_count":        len(ml_outputs),
            "latest_water_quality":   latest_wq,
            # max() returns the single highest risk score across all model outputs
            # — None if there are no ML outputs at all
            "highest_risk_score":     max(risk_scores) if risk_scores else None,
        },
    }
