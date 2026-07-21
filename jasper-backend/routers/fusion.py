"""Multi-source data fusion endpoint — combines all data layers for a sector."""
from fastapi import APIRouter, Depends, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader

from database import get_supabase
from config import API_KEY

router = APIRouter()

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


@router.get("/api/v1/fusion/{sector_id}", dependencies=[Depends(require_api_key)])
async def get_fusion(sector_id: str):
    """Return a unified view of all data sources for a sector.

    Combines environmental_layers, water_quality_archive, and ml_model_outputs
    into a single response so Reyta's frontend can render the full risk overlay
    in one API call instead of three.

    Returns 404 if no data exists for the sector across any table.
    """
    env_layers = []
    water_quality = []
    ml_outputs = []

    try:
        supabase = get_supabase()
        result = supabase.table("environmental_layers").select("*").eq("sector_id", sector_id).execute()
        for row in result.data:
            payload = row.get("payload") or {}
            env_layers.append({
                "layer_type": row.get("layer_type", "unknown"),
                "coordinates": {"lat": payload.get("lat"), "lon": payload.get("lon")},
                "timestamp": row.get("timestamp"),
                "data": payload,
            })
    except Exception as e:
        print(f"Fusion environmental_layers query error: {e}")

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

    try:
        supabase = get_supabase()
        result = supabase.table("ml_model_outputs").select("*").eq("sector_id", sector_id).execute()
        for row in result.data:
            ml_outputs.append({
                "simulation_type": row.get("simulation_type"),
                "risk_score": row.get("risk_score"),
                "risk_label": row.get("risk_label"),
                "confidence": row.get("confidence"),
                "model_version": row.get("model_version"),
                "timestamp": row.get("timestamp"),
            })
    except Exception as e:
        print(f"Fusion ml_model_outputs query error: {e}")

    if not env_layers and not water_quality and not ml_outputs:
        raise HTTPException(
            status_code=404,
            detail=f"No data found for sector '{sector_id}' across any data source"
        )

    risk_scores = [o["risk_score"] for o in ml_outputs if o.get("risk_score") is not None]
    latest_wq = water_quality[-1] if water_quality else None

    return {
        "sector_id": sector_id,
        "environmental_layers": env_layers,
        "water_quality": water_quality,
        "ml_outputs": ml_outputs,
        "summary": {
            "layer_count": len(env_layers),
            "water_quality_readings": len(water_quality),
            "ml_output_count": len(ml_outputs),
            "latest_water_quality": latest_wq,
            "highest_risk_score": max(risk_scores) if risk_scores else None,
        },
    }
