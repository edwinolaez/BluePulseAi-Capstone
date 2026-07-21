"""
Auth router — token-based authentication for Jasper API consumers.
Owner: Edwin | PM & QA/Security Engineer

Endpoints:
  POST /api/v1/auth/token   — exchange API key for a short-lived JWT
  GET  /api/v1/auth/verify  — verify a JWT is still valid (used by Kong pre-auth plugin)
"""

import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel

from config import API_KEY, JWT_SECRET

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


class TokenRequest(BaseModel):
    api_key: str
    client_id: str = "jasper-frontend"


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


@router.post("/token", response_model=TokenResponse)
async def issue_token(body: TokenRequest):
    """Exchange a valid API key for a short-lived access token.

    The token is a signed string the client can pass as Authorization: Bearer <token>
    on subsequent requests. Currently uses a simple HMAC-style token; swap for
    python-jose JWT when the full auth service is in place.
    """
    if body.api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    import hashlib, hmac
    expires_at = int(time.time()) + 3600  # 1 hour
    payload    = f"{body.client_id}:{expires_at}"
    signature  = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    token      = f"{payload}.{signature}"

    return TokenResponse(access_token=token, expires_in=3600)


@router.get("/verify")
async def verify_token(authorization: str | None = None):
    """Verify that a bearer token is still valid and unmodified.

    Kong's pre-auth plugin calls this before forwarding requests to protected
    downstream services. Returns 200 OK when valid, 401 when expired or tampered.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.removeprefix("Bearer ")
    try:
        payload_part, sig = token.rsplit(".", 1)
        _, expires_str    = payload_part.rsplit(":", 1)
        if int(expires_str) < int(time.time()):
            raise HTTPException(status_code=401, detail="Token expired")

        import hashlib, hmac
        expected = hmac.new(JWT_SECRET.encode(), payload_part.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            raise HTTPException(status_code=401, detail="Token signature invalid")
    except (ValueError, AttributeError):
        raise HTTPException(status_code=401, detail="Malformed token")

    return {"status": "valid", "verified_at": datetime.now(timezone.utc).isoformat()}
