"""
Timeline endpoint — returns time-ordered scan records for a sector's map slider.
Owner: Feven | Data Pipeline & API Engineer

This file powers the time-scrubber feature on Reyta's 3D map. The frontend
shows a slider that lets users drag between dates to see how the watershed
changed over time after the wildfire. When the user drags the slider to a date
that falls between two real scans, the frontend uses linear interpolation to
smoothly blend the values from the nearest scan before and after that date.

To make that interpolation work, every scan returned by this endpoint is
normalised to the same three numeric fields:
  - vegetation_pct      : what percentage of the sector has plant cover (0–100)
  - erosion_risk_score  : how likely erosion is (0.0=none, 1.0=critical)
  - water_turbidity     : how cloudy the water is in NTU (higher = more contaminated)

Records come from three Supabase tables and are merged and sorted oldest-first
so the frontend can binary-search for the two nearest scan dates in O(log n).
"""

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Security
from fastapi.security.api_key import APIKeyHeader

from database import get_supabase
from config import API_KEY

# No prefix — the full path is declared on the route decorator
router = APIRouter()

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    """Dependency: reject requests that don't provide the correct API key.

    Args:
        api_key: Value from the X-API-Key request header

    Raises:
        HTTPException 401: If the key is missing or wrong
    """
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def _normalize_scan(row: Dict[str, Any], source: str, layer_type: str) -> Dict[str, Any]:
    """Normalise a raw Supabase row into the standard scan format for the timeline slider.

    Different database tables store their data in different shapes. This function
    extracts the three numeric fields the frontend needs for interpolation from
    whichever column they happen to live in for this particular row. When a field
    is missing entirely, we fall back to a neutral mid-range default so the
    frontend always receives a complete record and doesn't need null-handling code.

    Args:
        row:        The raw dictionary from a Supabase query result
        source:     Which table this row came from (for debugging)
        layer_type: What kind of data this scan represents

    Returns:
        dict: Normalised scan with timestamp, layer_type, source, vegetation_pct,
              erosion_risk_score, water_turbidity, and the raw payload
    """
    payload = row.get("payload") or {}

    # Try several possible column names in priority order.
    # "or" short-circuits: the first truthy value wins.
    # Default of 50.0 = mid-range vegetation (not fully burned, not fully recovered)
    vegetation_pct = float(
        payload.get("vegetation_pct")
        or payload.get("vegetation_cover")
        or payload.get("area_km2")   # some legacy records stored area instead of pct
        or 50.0
    )

    # Erosion risk is stored as a text label in some tables ("low", "medium", etc.)
    # We map it to a 0–1 numeric scale so the frontend can interpolate smoothly
    erosion_raw = str(
        payload.get("severity")      # name used in burn_scar records
        or payload.get("erosion_risk")  # name used in ML output records
        or "medium"
    ).lower()
    erosion_map = {"low": 0.1, "medium": 0.5, "high": 0.9, "critical": 1.0}
    # .get() with a default of 0.5 handles any unexpected text values gracefully
    erosion_risk_score = erosion_map.get(erosion_raw, 0.5)

    # Turbidity can be a top-level column (water_quality_readings table) or nested
    # in the payload (ingest_records). Check both.
    # Default 4.2 NTU = typical clear mountain river baseline before the wildfire
    water_turbidity = float(
        row.get("turbidity")               # top-level column in water_quality_readings
        or payload.get("turbidity")        # nested in payload for other tables
        or payload.get("water_turbidity")  # alternate key name in some legacy records
        or 4.2
    )

    # Each table uses a different column name for the timestamp — try both
    timestamp = (
        row.get("timestamp")             # ingest_records + environmental_layers
        or row.get("recorded_at")        # water_quality_readings
        or datetime.now(timezone.utc).isoformat()  # last resort fallback
    )

    return {
        "timestamp":          timestamp,
        "layer_type":         layer_type or row.get("layer_type", "unknown"),
        "source":             source,
        "vegetation_pct":     vegetation_pct,
        "erosion_risk_score": erosion_risk_score,
        "water_turbidity":    water_turbidity,
        "data":               payload,
    }


@router.get("/api/v1/sectors/{sector_id}/timeline", dependencies=[Depends(require_api_key)])
async def get_sector_timeline(
    sector_id: str,
    date_from: Optional[str] = Query(None),
    date_to:   Optional[str] = Query(None),
):
    """Return all timestamped scan records for a sector, sorted oldest-first.

    Reyta's map slider calls this on load to get the full scan history. The
    frontend then uses the `vegetation_pct`, `erosion_risk_score`, and
    `water_turbidity` fields on adjacent scans to linearly interpolate values
    as the user drags the slider between real scan dates.

    Records come from three tables and are merged before sorting so the slider
    shows a unified timeline regardless of which pipeline ingested the data.

    Args:
        sector_id: The monitoring sector to query (e.g. "ATH-001-A")
        date_from: Only include scans on or after this ISO 8601 date (optional)
        date_to:   Only include scans on or before this ISO 8601 date (optional)

    Returns:
        dict: sector_id, total scan_count, and the sorted list of normalised scans

    Raises:
        HTTPException 422: If date strings are not valid ISO 8601
        HTTPException 503: If Supabase is unavailable
    """
    # Validate date strings upfront so the caller gets a clear message
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

        # ----------------------------------------------------------------
        # Source 1 — ingest_records (primary table, migration 008)
        # ----------------------------------------------------------------
        q = supabase.table("ingest_records").select("*").eq("sector_id", sector_id)
        if date_from:
            q = q.gte("timestamp", date_from)
        if date_to:
            q = q.lte("timestamp", date_to)
        for row in q.execute().data:
            scans.append(_normalize_scan(row, "ingest_records", row.get("layer_type", "burn_scar")))

        # ----------------------------------------------------------------
        # Source 2 — water_quality_readings (Environment Canada telemetry)
        # Note: uses "recorded_at" column, not "timestamp"
        # ----------------------------------------------------------------
        q2 = supabase.table("water_quality_readings").select("*").eq("sector_id", sector_id)
        if date_from:
            q2 = q2.gte("recorded_at", date_from)
        if date_to:
            q2 = q2.lte("recorded_at", date_to)
        for row in q2.execute().data:
            scans.append(_normalize_scan(row, "water_quality_readings", "telemetry"))

        # ----------------------------------------------------------------
        # Source 3 — environmental_layers (legacy Sprint 2 records)
        # ----------------------------------------------------------------
        q3 = supabase.table("environmental_layers").select("*").eq("sector_id", sector_id)
        if date_from:
            q3 = q3.gte("timestamp", date_from)
        if date_to:
            q3 = q3.lte("timestamp", date_to)
        for row in q3.execute().data:
            scans.append(_normalize_scan(row, "environmental_layers", row.get("layer_type", "unknown")))

    except Exception as e:
        # Surface the DB error to the caller — a 503 is more honest than an empty list
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}") from e

    # Sort ascending by timestamp string — ISO 8601 strings sort lexicographically
    # in the same order as dates, so string sort = date sort here.
    # Oldest-first means the frontend can binary-search for the two nearest scan dates.
    scans.sort(key=lambda s: s["timestamp"])

    return {
        "sector_id":  sector_id,
        "scan_count": len(scans),
        "scans":      scans,
    }
