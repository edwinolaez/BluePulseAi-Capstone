"""Timeline endpoint — returns timestamped scan records for a sector — Owner: Feven."""
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Security
from fastapi.security.api_key import APIKeyHeader

from database import get_supabase

router = APIRouter()

# Read API key from environment — must match data.py/ingest.py/fusion.py
API_KEY = os.getenv("NEXT_PUBLIC_API_KEY", "jasper-dev-api-key-2026")
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _normalize_scan(row: Dict[str, Any], source: str, layer_type: str) -> Dict[str, Any]:
    """Extract numeric fields needed for linear interpolation from a raw DB row.

    Every scan needs three blendable numbers: vegetation_pct, erosion_risk_score,
    water_turbidity. We extract from payload where possible; fall back to neutral
    defaults so the frontend always gets a complete record to blend between.
    """
    payload = row.get("payload") or {}

    vegetation_pct = float(
        payload.get("vegetation_pct")
        or payload.get("vegetation_cover")
        or payload.get("area_km2")
        or 50.0
    )

    erosion_raw = str(
        payload.get("severity")
        or payload.get("erosion_risk")
        or "medium"
    ).lower()
    erosion_map = {"low": 0.1, "medium": 0.5, "high": 0.9, "critical": 1.0}
    erosion_risk_score = erosion_map.get(erosion_raw, 0.5)

    water_turbidity = float(
        row.get("turbidity")
        or payload.get("turbidity")
        or payload.get("water_turbidity")
        or 4.2
    )

    timestamp = (
        row.get("timestamp")
        or row.get("recorded_at")
        or datetime.now(timezone.utc).isoformat()
    )

    return {
        "timestamp": timestamp,
        "layer_type": layer_type or row.get("layer_type", "unknown"),
        "source": source,
        "vegetation_pct": vegetation_pct,
        "erosion_risk_score": erosion_risk_score,
        "water_turbidity": water_turbidity,
        "data": payload,
    }


@router.get("/api/v1/sectors/{sector_id}/timeline", dependencies=[Depends(require_api_key)])
async def get_sector_timeline(
    sector_id: str,
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    """Returns all timestamped scan records for a sector, sorted oldest-first.

    Reyta's frontend uses these records to linearly interpolate map layer values
    (vegetation_pct, erosion_risk_score, water_turbidity) as the user drags the
    timeline slider between real scan dates.
    """
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

    scans: List[Dict[str, Any]] = []

    try:
        supabase = get_supabase()

        # ingest_records — primary table (migration 008)
        q = supabase.table("ingest_records").select("*").eq("sector_id", sector_id)
        if date_from:
            q = q.gte("timestamp", date_from)
        if date_to:
            q = q.lte("timestamp", date_to)
        for row in q.execute().data:
            scans.append(_normalize_scan(row, "ingest_records", row.get("layer_type", "burn_scar")))

        # water_quality_readings — telemetry sensor data
        q2 = supabase.table("water_quality_readings").select("*").eq("sector_id", sector_id)
        if date_from:
            q2 = q2.gte("recorded_at", date_from)
        if date_to:
            q2 = q2.lte("recorded_at", date_to)
        for row in q2.execute().data:
            scans.append(_normalize_scan(row, "water_quality_readings", "telemetry"))

        # environmental_layers — legacy Sprint 2 records
        q3 = supabase.table("environmental_layers").select("*").eq("sector_id", sector_id)
        if date_from:
            q3 = q3.gte("timestamp", date_from)
        if date_to:
            q3 = q3.lte("timestamp", date_to)
        for row in q3.execute().data:
            scans.append(_normalize_scan(row, "environmental_layers", row.get("layer_type", "unknown")))

    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}") from e

    # Sort ascending so the frontend can binary-search for the two nearest dates
    scans.sort(key=lambda s: s["timestamp"])

    return {
        "sector_id": sector_id,
        "scan_count": len(scans),
        "scans": scans,
    }
