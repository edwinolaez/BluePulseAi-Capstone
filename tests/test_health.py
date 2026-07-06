# test_health.py — Backend Liveness Tests
#
# The very first thing we check before anything else:
# "Is the backend actually running and reachable?"
#
# Think of this like the pilot's pre-flight checklist.
# If these tests fail, we don't bother running the deeper tests —
# there's no point testing features if the server isn't even on.
#
# Owner: Edwin (QA)
# Runs: Sprint 1 onwards — every single CI push

import pytest


class TestHealthEndpoint:
    """
    Tests for GET /health
    This endpoint is owned by Feven (jasper-backend).
    It should always return 200 OK with {"status": "ok"}.
    """

    def test_health_returns_200(self, http_client):
        """
        Confirm the backend is alive and responding.

        If this test fails it usually means:
        - The backend server isn't running
        - The Railway deploy didn't complete
        - There's a network/firewall issue in CI
        """
        response = http_client.get("/health")

        # 200 means "everything is fine"
        # Any other code (500, 503, etc.) means something is wrong
        assert response.status_code == 200, (
            f"Health check failed. Expected 200, got {response.status_code}. "
            f"Is the backend running at {http_client.base_url}?"
        )

    def test_health_returns_json(self, http_client):
        """
        Confirm the response is valid JSON, not an error page.

        Some failures return HTML error pages (like a 502 from Railway).
        This test catches that — we need a proper JSON response.
        """
        response = http_client.get("/health")

        # This will raise an error if the body is HTML instead of JSON
        body = response.json()

        assert isinstance(body, dict), (
            f"Health response should be a JSON object, got: {type(body)}"
        )

    def test_health_status_field_is_ok(self, http_client):
        """
        Confirm the body contains {"status": "ok"}.

        This is the agreed contract for the health endpoint.
        If the backend is degraded (e.g. DB connection lost), it should
        return {"status": "degraded"} — and this test will catch that.
        """
        response = http_client.get("/health")
        body = response.json()

        assert "status" in body, (
            "Health response is missing the 'status' field entirely."
        )
        assert body["status"] == "ok", (
            f"Backend is not healthy. Status returned: '{body['status']}'. "
            "Check Railway logs for errors."
        )

    def test_health_does_not_require_api_key(self, http_client, no_auth_headers):
        """
        The /health endpoint must be publicly accessible — no API key needed.

        Monitoring services (like UptimeRobot) need to ping /health
        without an API key to check if the system is up.
        If this fails, Kong is incorrectly blocking the health route.
        """
        # Send the request with NO authentication headers
        response = http_client.get("/health", headers=no_auth_headers)

        # 401 here would mean Kong is wrongly blocking public health checks
        assert response.status_code == 200, (
            "/health should not require an API key. "
            f"Got {response.status_code} — check Kong route configuration."
        )


class TestKongGateway:
    """
    Tests that Kong Gateway is correctly protecting all other endpoints.

    Kong sits in front of Feven's FastAPI backend.
    Its job is to reject any request that doesn't have a valid API key.
    These tests confirm the security layer is actually working.
    """

    def test_protected_route_requires_api_key(self, http_client, no_auth_headers):
        """
        Any endpoint other than /health must reject requests with no API key.

        We test against /api/v1/layers/ATH-001 as the representative
        protected endpoint. If Kong is working, we expect a 401 response.
        """
        response = http_client.get(
            "/api/v1/layers/ATH-001",
            headers=no_auth_headers
        )

        # 401 = Unauthorized (correct — Kong is blocking the request)
        # 200 = PROBLEM — the endpoint is wide open with no auth
        assert response.status_code == 401, (
            "Security failure: a protected endpoint responded without an API key. "
            f"Got {response.status_code} instead of 401. "
            "Check Kong auth plugin configuration."
        )

    def test_protected_route_accepts_valid_api_key(self, http_client, auth_headers):
        """
        A request WITH a valid API key should NOT be rejected with 401 or 403.

        Note: we accept 200 OR 404 here. 404 means the sector doesn't exist
        yet (the DB might be empty) — that's fine. We just need to confirm
        Kong is letting the request through to the backend.
        """
        response = http_client.get(
            "/api/v1/layers/ATH-001",
            headers=auth_headers
        )

        # 401 or 403 here means Kong rejected a valid key — that's a bug
        assert response.status_code not in (401, 403), (
            f"Valid API key was rejected. Got {response.status_code}. "
            "The NEXT_PUBLIC_API_KEY may be wrong or Kong auth is misconfigured."
        )
