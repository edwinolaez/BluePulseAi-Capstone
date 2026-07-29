"""
Auth router — token-based authentication for Jasper API consumers.
Owner: Edwin | PM & QA/Security Engineer

This file implements a lightweight two-step authentication flow:
  1. A client sends its API key to POST /token and receives a short-lived
     bearer token (valid for 1 hour).
  2. The client attaches that token as "Authorization: Bearer <token>" on
     subsequent requests. Kong's pre-auth plugin calls GET /verify to confirm
     the token is still valid before forwarding the request to our endpoints.

The token format is NOT a standard JWT — it is a simple HMAC-signed string:
  "<client_id>:<unix_expiry>.<sha256_signature>"

This was chosen because it requires no extra dependencies (python-jose) and is
sufficient for our capstone scope. The roadmap is to swap it for a real JWT
library once the full auth service is wired into Kong.

Endpoints:
  POST /api/v1/auth/token   — exchange API key for a short-lived bearer token
  GET  /api/v1/auth/verify  — verify a bearer token is still valid
"""

import time
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Security
from fastapi.security.api_key import APIKeyHeader
from pydantic import BaseModel

from config import API_KEY, JWT_SECRET

# All routes share the /api/v1/auth prefix and appear under "auth" in /docs
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class TokenRequest(BaseModel):
    """Request body for the token issuance endpoint.

    api_key:   The caller's long-lived API key (same one used in X-API-Key header)
    client_id: An identifier for the calling service — stored in the token payload
               so logs can show which service issued which token
    """
    api_key: str
    client_id: str = "jasper-frontend"


class TokenResponse(BaseModel):
    """Response schema for a successfully issued token.

    access_token: The signed bearer token string to use in future Authorization headers
    token_type:   Always "bearer" — tells the client how to use the token
    expires_in:   How many seconds the token is valid for (3600 = 1 hour)
    """
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/token", response_model=TokenResponse)
async def issue_token(body: TokenRequest):
    """Exchange a valid API key for a short-lived bearer token.

    The issued token encodes the client ID and expiry time, then signs the
    whole thing with HMAC-SHA256 so any tampering is detectable. The token
    is valid for 1 hour. After expiry, the client must request a new one.

    Args:
        body: Validated TokenRequest with the caller's api_key and client_id

    Returns:
        TokenResponse: The signed token, type, and seconds until expiry

    Raises:
        HTTPException 401: If the provided API key doesn't match config.API_KEY
    """
    if body.api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")

    # hashlib and hmac are part of Python's standard library — no pip install needed.
    # They're imported here (inside the function) to keep the top-level imports clean
    # since they're only used in this one place.
    import hashlib, hmac

    # Unix timestamp: number of seconds since 1 Jan 1970. Adding 3600 gives a
    # timestamp exactly one hour in the future — this becomes the expiry marker.
    expires_at = int(time.time()) + 3600  # 1 hour from now

    # The payload is plain text: "client_id:expiry_timestamp"
    # Example: "jasper-frontend:1753920000"
    payload   = f"{body.client_id}:{expires_at}"

    # HMAC signs the payload with our JWT_SECRET. Anyone who changes the payload
    # would need the secret to produce a valid signature — without it, the
    # signature won't match and verify_token() will reject the token.
    signature = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()

    # Final token: "payload.signature" — dot-separated so verify_token() can split it
    token     = f"{payload}.{signature}"

    return TokenResponse(access_token=token, expires_in=3600)


@router.get("/verify")
async def verify_token(authorization: str | None = None):
    """Verify that a bearer token is still valid and has not been tampered with.

    Kong's pre-auth plugin calls this endpoint before forwarding any request to
    protected downstream services. If this returns 200, Kong forwards the request.
    If it returns 401, Kong blocks the request and returns 401 to the caller.

    The verification steps are:
      1. Check the Authorization header is present and starts with "Bearer "
      2. Split the token into payload and signature parts
      3. Check the expiry timestamp embedded in the payload has not passed
      4. Re-compute the expected HMAC signature and compare it with the actual one
         using hmac.compare_digest() — this prevents timing attacks

    Args:
        authorization: The full "Authorization: Bearer <token>" header value

    Returns:
        dict: {"status": "valid", "verified_at": "<iso_timestamp>"} on success

    Raises:
        HTTPException 401: If the token is missing, expired, tampered, or malformed
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    # Strip the "Bearer " prefix to get just the raw token string
    token = authorization.removeprefix("Bearer ")

    try:
        # rsplit(".", 1) splits on the LAST dot only — the signature itself may
        # contain dots, so splitting from the right ensures we get the right pieces
        payload_part, sig = token.rsplit(".", 1)

        # The payload is "client_id:expiry" — we only need the expiry here
        _, expires_str    = payload_part.rsplit(":", 1)

        # Compare expiry against current Unix time — if the token was issued over
        # an hour ago, int(expires_str) will be less than int(time.time())
        if int(expires_str) < int(time.time()):
            raise HTTPException(status_code=401, detail="Token expired")

        import hashlib, hmac

        # Re-compute what the signature SHOULD be for this payload
        expected = hmac.new(JWT_SECRET.encode(), payload_part.encode(), hashlib.sha256).hexdigest()

        # compare_digest() does a constant-time comparison — unlike "sig == expected",
        # it takes the same amount of time whether the strings match or not. This
        # prevents attackers from guessing the signature character-by-character by
        # measuring response time differences (a timing attack).
        if not hmac.compare_digest(sig, expected):
            raise HTTPException(status_code=401, detail="Token signature invalid")

    except (ValueError, AttributeError):
        # ValueError fires if rsplit doesn't find the expected delimiters,
        # AttributeError fires if token is None — both mean a malformed token
        raise HTTPException(status_code=401, detail="Malformed token")

    return {"status": "valid", "verified_at": datetime.now(timezone.utc).isoformat()}
