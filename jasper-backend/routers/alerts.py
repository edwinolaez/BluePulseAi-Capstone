"""
Alerts router — environmental risk alerts derived from sensor readings and model outputs.
Owner: Edwin | PM & QA/Security Engineer

Endpoints:
  GET  /api/v1/alerts              — list active alerts (optionally filtered by sector/severity)
  POST /api/v1/alerts              — create a new alert (triggered by ML model outputs)
  POST /api/v1/alerts/{id}/acknowledge — mark an alert as seen by an operator
"""

from datetime import datetime, timezone
from typing import List, Literal, Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Security
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel

from config import API_KEY

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def require_api_key(api_key: str = Security(api_key_header)):
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


Severity = Literal["critical", "high", "medium", "low"]

# In-memory store — replace with Supabase table (alerts) in Sprint 3
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


class AlertCreate(BaseModel):
    sector_id: str
    severity: Severity
    title: str
    description: str
    source: str


class AlertAcknowledge(BaseModel):
    acknowledged_by: str


@router.get("", dependencies=[Depends(require_api_key)])
async def list_alerts(
    sector_id: Optional[str] = Query(None),
    severity: Optional[Severity] = Query(None),
    unacknowledged_only: bool = Query(False),
):
    """Return all active environmental alerts, optionally filtered."""
    results = _alerts
    if sector_id:
        results = [a for a in results if a["sector_id"] == sector_id]
    if severity:
        results = [a for a in results if a["severity"] == severity]
    if unacknowledged_only:
        results = [a for a in results if not a["acknowledged"]]
    return {"count": len(results), "alerts": results}


@router.post("", status_code=201, dependencies=[Depends(require_api_key)])
async def create_alert(body: AlertCreate):
    """Create a new alert — called automatically by ML model output handlers."""
    alert = {
        "id": f"ALT-{str(uuid4())[:8].upper()}",
        **body.model_dump(),
        "acknowledged": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    _alerts.append(alert)
    return alert


@router.post("/{alert_id}/acknowledge", dependencies=[Depends(require_api_key)])
async def acknowledge_alert(alert_id: str, body: AlertAcknowledge):
    """Mark an alert as acknowledged by an operator. Roadmap: persist to Supabase."""
    alert = next((a for a in _alerts if a["id"] == alert_id), None)
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")
    alert["acknowledged"]    = True
    alert["acknowledged_by"] = body.acknowledged_by
    alert["acknowledged_at"] = datetime.now(timezone.utc).isoformat()
    return alert
