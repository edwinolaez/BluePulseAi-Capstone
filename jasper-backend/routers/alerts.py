"""
Alerts router — environmental risk alerts derived from sensor readings and model outputs.
Owner: Edwin | PM & QA/Security Engineer

This file manages the lifecycle of environmental risk alerts for the Jasper
post-wildfire monitoring platform. Alerts are created automatically when ML
model outputs exceed risk thresholds (e.g. the RUSLE erosion model detects
a critical score, or a telemetry ingest sees turbidity spike). Operators in
the field can then acknowledge alerts through this same API once they have
been reviewed.

Currently all alerts are stored in memory — they reset on server restart.
Sprint 3 task: persist the _alerts list to a Supabase "alerts" table so
records survive deployments and can be queried historically.

Endpoints:
  GET  /api/v1/alerts                       — list active alerts (filter by sector/severity)
  POST /api/v1/alerts                       — create a new alert (triggered by ML outputs)
  POST /api/v1/alerts/{id}/acknowledge      — mark an alert as seen by an operator
"""

from datetime import datetime, timezone
from typing import List, Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Security
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel

from config import API_KEY

# All routes share the /api/v1/alerts prefix and appear under "alerts" in /docs
router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])

# Reads the API key from the X-API-Key header; auto_error=False lets us return
# a custom 401 message rather than FastAPI's default error format.
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    """Dependency: reject requests that don't provide the correct API key.

    FastAPI runs this before any endpoint that declares Depends(require_api_key).

    Args:
        api_key: Value from the X-API-Key request header

    Raises:
        HTTPException 401: If the key is missing or doesn't match config.API_KEY
    """
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# Severity is a restricted set — FastAPI validates that any incoming severity
# value is one of these four strings and rejects anything else with a 422.
Severity = Literal["critical", "high", "medium", "low"]

# ---------------------------------------------------------------------------
# In-memory alert store
# Sprint 3 task: replace with Supabase `alerts` table queries
# ---------------------------------------------------------------------------

# Seeded with three real-scenario alerts based on the Jasper Valley watershed
# so the frontend dashboard shows meaningful data before any ML models fire.
_alerts: List[dict] = [
    {
        "id": "ALT-001",
        "sector_id": "ATH-001-A",
        "severity": "high",
        "title": "Soil Runoff Risk Detected",
        "description": "Burn scar soil in sector A is dry and at high risk of washing away after rainfall.",
        "source": "burn_scar_model_v1.3.0",
        "acknowledged": False,
        "created_at": "2026-07-18T10:22:00Z",
    },
    {
        "id": "ALT-002",
        "sector_id": "ATH-001-W",
        "severity": "medium",
        "title": "River Turbidity Rising",
        "description": "WSC station 07AA001 shows water cloudiness up 8.5% across the last 3 sensor readings.",
        "source": "telemetry_ingest",
        "acknowledged": False,
        "created_at": "2026-07-19T14:05:00Z",
    },
    {
        "id": "ALT-003",
        "sector_id": "ATH-001-H",
        "severity": "medium",
        "title": "Erosion Risk Elevated After Rainfall",
        "description": "RUSLE simulation indicates elevated erosion risk following 95mm/day rainfall event.",
        "source": "erosion_model_v1.1.2",
        "acknowledged": False,
        "created_at": "2026-07-20T08:30:00Z",
    },
]


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class AlertCreate(BaseModel):
    """Request body for creating a new alert.

    sector_id:   Which monitoring sector the alert applies to (e.g. "ATH-001-A")
    severity:    Risk level — one of "critical", "high", "medium", "low"
    title:       Short headline (shown in the dashboard alert panel)
    description: Full explanation of what triggered this alert and why it matters
    source:      Which model or service generated this alert (e.g. "erosion_model_v1.1.2")
    """
    sector_id: str
    severity: Severity
    title: str
    description: str
    source: str


class AlertAcknowledge(BaseModel):
    """Request body for acknowledging an alert.

    acknowledged_by: The operator's name or ID — used for accountability tracking
    """
    acknowledged_by: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("", dependencies=[Depends(require_api_key)])
async def list_alerts(
    sector_id: Optional[str] = Query(None),
    severity: Optional[Severity] = Query(None),
    unacknowledged_only: bool = Query(False),
):
    """Return all active environmental alerts, with optional filtering.

    The frontend alert panel uses this to show operators what needs attention.
    All three filters can be combined — e.g. unacknowledged high-severity alerts
    for a specific sector.

    Args:
        sector_id:           If provided, only return alerts for this sector
        severity:            If provided, only return alerts at this severity level
        unacknowledged_only: If True, hide alerts that operators have already seen

    Returns:
        dict: Total count of matching alerts and the alert list
    """
    results = _alerts

    # Apply each filter in sequence — each step narrows the list further
    if sector_id:
        results = [a for a in results if a["sector_id"] == sector_id]
    if severity:
        results = [a for a in results if a["severity"] == severity]
    if unacknowledged_only:
        results = [a for a in results if not a["acknowledged"]]

    return {"count": len(results), "alerts": results}


@router.post("", status_code=201, dependencies=[Depends(require_api_key)])
async def create_alert(body: AlertCreate):
    """Create a new alert — typically called by ML model output handlers.

    Generates a unique ID using the first 8 characters of a UUID, uppercased
    for readability (e.g. "ALT-3F7A2B1C"). Sets acknowledged=False because
    new alerts always start unread.

    Args:
        body: Validated AlertCreate payload

    Returns:
        dict: The full alert record including the generated ID and creation timestamp
    """
    alert = {
        # Short UUID prefix keeps IDs human-readable while still being unique enough
        # for our expected alert volume (hundreds, not millions)
        "id": f"ALT-{str(uuid4())[:8].upper()}",
        **body.model_dump(),       # Spread all fields from the request body
        "acknowledged": False,     # All new alerts start unacknowledged
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _alerts.append(alert)
    return alert


@router.post("/{alert_id}/acknowledge", dependencies=[Depends(require_api_key)])
async def acknowledge_alert(alert_id: str, body: AlertAcknowledge):
    """Mark an alert as acknowledged by a named operator.

    Once acknowledged, the alert still appears in the list but is marked as
    seen — operators can filter it out using unacknowledged_only=true.
    Roadmap: write acknowledged_by and acknowledged_at to Supabase.

    Args:
        alert_id: The alert ID from the URL path (e.g. "ALT-001")
        body:     Validated AlertAcknowledge payload with the operator's name

    Returns:
        dict: The updated alert record

    Raises:
        HTTPException 404: If no alert with the given ID exists
    """
    # next() with a default of None avoids raising StopIteration on a miss
    alert = next((a for a in _alerts if a["id"] == alert_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    # Mutate the dict in-place — the same object is in _alerts, so the change
    # is immediately visible to subsequent GET /alerts calls
    alert["acknowledged"]    = True
    alert["acknowledged_by"] = body.acknowledged_by
    alert["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
    return alert
