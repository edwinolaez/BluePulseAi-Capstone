"""
Admin router — system configuration and operational management.
Owner: Edwin | PM & QA/Security Engineer

This file provides a small set of administrative endpoints that are locked down
to superadmin callers only. "Superadmin" currently means sending both a valid
API key (X-API-Key header) AND the custom X-Role: superadmin header. This is a
stopgap — the roadmap is to replace the role header with a JWT role claim once
the full auth service (auth.py) is wired into Kong.

The user registry and audit log are stored in memory for now (Sprint 2).
They reset every time the Railway container restarts. Persisting them to
Supabase is a Phase 2 task tracked in the project backlog.

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

# All routes in this file share the /api/v1/admin prefix and appear under
# the "admin" tag in the /docs interactive documentation.
router = APIRouter(prefix="/api/v1/admin", tags=["admin"])

# Tells FastAPI to look for the API key in the X-API-Key request header.
# auto_error=False means we handle the missing-key case ourselves (below).
api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)

# ---------------------------------------------------------------------------
# In-memory data stores (Phase 2: replace with Supabase tables)
# ---------------------------------------------------------------------------

# Seed data for the user registry — represents the three services that currently
# call our API. Phase 2 task: move to a Supabase `api_consumers` table.
_users: list[dict] = [
    {"client_id": "jasper-frontend",  "role": "reader",     "created_at": "2026-05-01T00:00:00Z"},
    {"client_id": "ml-service",       "role": "writer",     "created_at": "2026-05-01T00:00:00Z"},
    {"client_id": "cirus-uploader",   "role": "writer",     "created_at": "2026-07-01T00:00:00Z"},
]

# Every admin action (user created, etc.) is appended here so operators can
# see who did what without digging through server logs. Resets on restart.
_audit_log: list[dict] = []


# ---------------------------------------------------------------------------
# Dependency: two-factor admin guard
# ---------------------------------------------------------------------------

async def require_admin(
    api_key:    str = Security(api_key_header),
    x_role:     str = Header(default=""),
):
    """Two-factor admin guard: valid API key AND X-Role: superadmin header.

    FastAPI calls this function automatically before any endpoint that lists
    `dependencies=[Depends(require_admin)]`. If either check fails, the
    request is rejected before the endpoint body runs.

    Args:
        api_key: The value of the X-API-Key request header
        x_role:  The value of the X-Role request header

    Raises:
        HTTPException 401: If the API key is wrong or missing
        HTTPException 403: If the caller is not a superadmin
    """
    if api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")
    # 403 Forbidden (not 401) because the key was valid — the caller just lacks
    # the superadmin role needed for this set of endpoints.
    if x_role != "superadmin":
        raise HTTPException(status_code=403, detail="Superadmin role required")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/system-info", dependencies=[Depends(require_admin)])
async def system_info():
    """Return non-sensitive runtime information for operational oversight.

    Exposes Python version, OS platform, and the number of registered API
    consumers. Never returns secrets, keys, or credentials — those stay in
    Railway environment variables.

    Returns:
        dict: Service name, Python version, platform, current UTC timestamp,
              and count of registered API consumers
    """
    # sys and platform are imported inside the function to keep them local —
    # they're only needed here and importing at the top would clutter the file.
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
    """Return all registered API consumers (services that call our backend).

    Phase 2 roadmap: replace the in-memory list with a Supabase users table
    so registrations survive server restarts.

    Returns:
        dict: Total count and list of all registered consumer records
    """
    return {"count": len(_users), "users": _users}


class UserCreate(BaseModel):
    """Request body for registering a new API consumer.

    client_id: A unique identifier for the service (e.g. "jasper-frontend")
    role:      Access level — "reader" (GET only) or "writer" (GET + POST)
    """
    client_id: str
    role: str = "reader"


@router.post("/users", status_code=201, dependencies=[Depends(require_admin)])
async def create_user(body: UserCreate, x_requested_by: str = Header(default="unknown")):
    """Register a new API consumer and record the action in the audit log.

    Rejects duplicate client_ids to prevent accidental double-registration.
    The x_requested_by header lets operators see who triggered the registration.

    Args:
        body:           Validated UserCreate payload (client_id + role)
        x_requested_by: The operator's identity from the X-Requested-By header

    Returns:
        dict: The newly created consumer record including its creation timestamp

    Raises:
        HTTPException 409: If a consumer with the same client_id already exists
    """
    # Check for duplicates before inserting — any() short-circuits on first match
    if any(u["client_id"] == body.client_id for u in _users):
        raise HTTPException(status_code=409, detail=f"Client '{body.client_id}' already exists")

    # Build the user record: spread the body fields and add a server-side timestamp
    user = {**body.model_dump(), "created_at": datetime.now(timezone.utc).isoformat()}
    _users.append(user)

    # Record who created this consumer so there is an accountability trail
    _audit_log.append({
        "action":     "user_created",
        "target":     body.client_id,
        "performed_by": x_requested_by,
        "timestamp":  datetime.now(timezone.utc).isoformat(),
    })
    return user


@router.get("/audit-log", dependencies=[Depends(require_admin)])
async def get_audit_log():
    """Return recent admin actions in reverse-chronological order (newest first).

    MVP implementation: stored in memory only — entries are lost on server restart.
    Phase 2 roadmap: persist every entry to a Supabase audit_log table.

    Returns:
        dict: A note about the in-memory limitation, total count, and the list
              of audit entries sorted newest-first
    """
    return {
        "note":    "Session-only — entries reset on server restart. Supabase persistence is Phase 2.",
        "count":   len(_audit_log),
        # reversed() yields newest-first without modifying the original list
        "entries": list(reversed(_audit_log)),
    }
