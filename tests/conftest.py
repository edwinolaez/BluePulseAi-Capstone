# conftest.py — Shared Test Configuration
#
# "conftest" is a special pytest file. Every test file in this folder
# automatically gets access to everything defined here.
#
# Think of this file as the "setup crew" before a show:
# it prepares the stage (database connections, API URLs, test users)
# so that each individual test can focus on what it's actually testing.

import os
import pytest
import httpx
from dotenv import load_dotenv

# Load environment variables from .env.local so tests can connect
# to the real services (Supabase, FastAPI backend, etc.)
# This means testers never hardcode passwords or URLs in test files.
load_dotenv(dotenv_path=".env.local")


# ─── Base URLs ────────────────────────────────────────────────────────────────

# The URL where Feven's FastAPI backend is running.
# During local testing this is localhost:8000.
# In CI it comes from the RAILWAY_API_URL secret.
BASE_API_URL = os.getenv("RAILWAY_API_URL", "http://localhost:8000")

# The URL of the Supabase project (Rahil's database).
SUPABASE_URL = os.getenv("SUPABASE_URL", "")

# The service role key gives admin-level access to Supabase.
# We use it in tests so we can set up and tear down test data freely.
# WARNING: never use the service role key in the frontend — tests only.
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# The anonymous key is what a regular user would have.
# We use it to test that viewers and analysts can only do what they should.
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")

# The Kong API key is required on every request to protected endpoints.
# If this is missing, the API should reject the request with a 401 error.
KONG_API_KEY = os.getenv("NEXT_PUBLIC_API_KEY", "")


# ─── Fixtures ─────────────────────────────────────────────────────────────────
# A "fixture" is a helper that pytest automatically passes into any test
# function that asks for it by name.

@pytest.fixture(scope="session")
def api_url():
    """
    Returns the base URL of the FastAPI backend.

    scope="session" means this fixture is created once for the entire
    test run — not re-created for every single test. This is efficient
    because we don't need a fresh URL each time.
    """
    return BASE_API_URL


@pytest.fixture(scope="session")
def auth_headers():
    """
    Returns the HTTP headers that a legitimate API caller would send.

    Every request to a protected endpoint must include the Kong API key.
    If the key is missing, Kong should block the request and return 401.
    Tests use this fixture to simulate an authenticated caller.
    """
    return {"X-API-Key": KONG_API_KEY}


@pytest.fixture(scope="session")
def no_auth_headers():
    """
    Returns empty headers — simulates a caller with NO API key.

    We use this to confirm that the security layer is actually working:
    any request without a key must be rejected with a 401 Unauthorized.
    """
    return {}


@pytest.fixture(scope="session")
def http_client(api_url):
    """
    Creates a single shared HTTP client for all tests in the session.

    httpx is the library we use to send real HTTP requests to the API.
    Using one shared client is faster than opening a new connection
    for every test.

    The 'with' block ensures the connection is properly closed when
    the test session ends — good practice to avoid resource leaks.
    """
    with httpx.Client(base_url=api_url, timeout=10.0) as client:
        # 'yield' hands the client to the test, then comes back here
        # after the test finishes to run the cleanup (closing the client).
        yield client


@pytest.fixture(scope="session")
def admin_headers():
    """
    Headers for an admin-level Supabase request.

    The service role key bypasses Row-Level Security (RLS).
    We use this in RBAC tests to create test data as admin,
    then verify that lower-privilege roles can only see what they should.
    """
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
    }


@pytest.fixture(scope="session")
def viewer_headers():
    """
    Headers for a read-only viewer (e.g. SAIT Faculty).

    The anon key maps to the 'viewer' role in Supabase RLS.
    Viewers should be able to read data but never write or delete.
    """
    return {
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
    }


# ─── Shared Test Data ─────────────────────────────────────────────────────────

# A valid ingest record that matches the agreed contract (see docs/api-contracts.md).
# Used across multiple test files so we define it once here.
SAMPLE_INGEST_RECORD = {
    "layer_type": "burn_scar",
    "sector_id": "ATH-001",
    "coordinates": {
        "lat": 56.7267,
        "lon": -111.3790
    },
    "timestamp": "2026-06-25T12:00:00Z",
    "payload": {
        "severity": "high",
        "area_km2": 142.5
    }
}

# A sample ML result that matches Richard's output contract.
SAMPLE_ML_RESULT = {
    "simulation_type": "change_detection",
    "sector_id": "ATH-001",
    "risk_score": 0.87,
    "contaminant_vector": None,
    "confidence": 0.92,
    "timestamp": "2026-06-25T12:00:00Z",
    "model_version": "1.0.0"
}
