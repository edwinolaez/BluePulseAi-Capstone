"""
Admin router — system configuration and operational management.
Owner: Edwin | PM & QA/Security Engineer

Access is restricted to requests that supply the API key AND a superadmin flag.
Roadmap: replace flag check with JWT role claim once the auth service is complete.

Endpoints:
  GET  /api/v1/admin/system-info    — runtime environment info (no secrets exposed)
  GET  /api/v1/admin/users          — list registered API consumers (stub)
  POST /api/v1/admin/users          — register a new API consumer (stub)
  GET  /api/v1/admin/audit-log      — recent administrative actions (stub, roadmap: Supabase)
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel

from config import API_KEY

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# Stub user registry — Phase 2: move to Supabase users table
_users: list[dict] = [
    {"client_id": "jasper-frontend",  "role": "reader",     "created_at": "2026-05-01T00:00:00Z"},
    {"client_id": "ml-service",       "role": "writer",     "created_at": "2026-05-01T00:00:00Z"},
    {"client_id": "cirus-uploader",   "role": "writer",     "created_at": "2026-07-01T00:00:00Z"},
]

_audit_log: list[dict] = []


async def require_admin(
    api_key:    str = Security(api_key_header),
    x_role:     str = Header(default=""),
):
    """Two-factor admin guard: valid API key + X-Role: superadmin header."""
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    if x_role != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin role required")


@router.get("/system-info", dependencies=[Depends(require_admin)])
async def system_info():
    """Return non-sensitive runtime information for operational oversight."""
    import sys, platform
    return {
        "service":        "jasper-backend",
        "python_version": sys.version,
        "platform":       platform.system(),
        "checked_at":     datetime.now(timezone.utc).isoformat(),
        "registered_consumers": len(_users),
    }


@router.get("/users", dependencies=[Depends(require_admin)])
async def list_users():
    """Return all registered API consumers. Roadmap: pull from Supabase."""
    return {"count": len(_users), "users": _users}


class UserCreate(BaseModel):
    client_id: str
    role: str = "reader"


@router.post("/users", status_code=201, dependencies=[Depends(require_admin)])
async def create_user(body: UserCreate, x_requested_by: str = Header(default="unknown")):
    """Register a new API consumer and log the action."""
    if any(u["client_id"] == body.client_id for u in _users):
        raise HTTPException(status_code=409, detail=f"Client '{body.client_id}' already exists")
    user = {**body.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    _users.append(user)
    _audit_log.append({
        "action":     "user_created",
        "target":     body.client_id,
        "performed_by": x_requested_by,
        "timestamp":  datetime.now(timezone.utc).isoformat(),
    })
    return user


@router.get("/audit-log", dependencies=[Depends(require_admin)])
async def get_audit_log():
    """Return recent admin actions. MVP: in-memory only. Roadmap: persist to Supabase."""
    return {
        "note":    "Session-only — entries reset on server restart. Supabase persistence is Phase 2.",
        "count":   len(_audit_log),
        "entries": list(reversed(_audit_log)),
    }
