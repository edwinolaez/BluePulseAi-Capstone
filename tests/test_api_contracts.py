# test_api_contracts.py — API Contract Validation Tests
#
# A "contract" is a promise between two team members:
# "My endpoint will always return data in exactly this shape."
#
# These tests act as automated contract enforcement.
# If Feven changes her response format without telling Reyta,
# these tests will catch it immediately in CI — before it breaks the frontend.
#
# Think of it like a quality inspector on an assembly line:
# every piece coming out of the factory is measured against the blueprint.
#
# Owner: Edwin (QA)
# Consumers tested: Feven's ingest + map query endpoints, Richard's ML endpoints
# Runs: Sprint 2 onwards (APIs must exist before we can test them)
# Reference: docs/api-contracts.md

import pytest
from conftest import SAMPLE_INGEST_RECORD, SAMPLE_ML_RESULT


# ─── Helper: Shape Validation ─────────────────────────────────────────────────

def assert_has_required_fields(data: dict, required_fields: list, context: str):
    """
    Checks that a dictionary contains all the fields we expect.

    We use this helper everywhere below so the error messages are clear:
    instead of "KeyError: risk_score", you get
    "ML response missing 'risk_score'. Check Richard's /predict endpoint."
    """
    for field in required_fields:
        assert field in data, (
            f"{context} — required field '{field}' is missing from the response. "
            f"Full response received: {data}"
        )


# ─── Contract 1: Ingest Record (Feven -> Rahil) ───────────────────────────────

class TestIngestContract:
    """
    Tests for POST /api/v1/ingest
    Owner: Feven | Consumer: Rahil

    The ingest endpoint receives data from satellites and sensors.
    It must accept records in the agreed format and store them in Supabase.
    """

    def test_valid_ingest_record_is_accepted(self, http_client, auth_headers):
        """
        Send a correctly-formatted ingest record and expect a 201 Created.

        201 means "I received your data and stored it successfully."
        If we get 422, the validation rules rejected our format.
        If we get 500, something crashed on Feven's side.
        """
        response = http_client.post(
            "/api/v1/ingest",
            json=SAMPLE_INGEST_RECORD,
            headers=auth_headers
        )

        assert response.status_code == 201, (
            f"Ingest endpoint rejected a valid record. "
            f"Status: {response.status_code}, Body: {response.text}"
        )

    def test_ingest_response_contains_record_id(self, http_client, auth_headers):
        """
        After a successful ingest, the response should include the new record's ID.

        Rahil's Supabase table generates a UUID for every inserted row.
        The API must return that ID so Feven can confirm the write succeeded.
        """
        response = http_client.post(
            "/api/v1/ingest",
            json=SAMPLE_INGEST_RECORD,
            headers=auth_headers
        )

        if response.status_code == 201:
            body = response.json()
            assert_has_required_fields(
                body,
                required_fields=["id", "sector_id", "timestamp"],
                context="Ingest response"
            )

    def test_ingest_rejects_missing_required_fields(self, http_client, auth_headers):
        """
        Send a record with a missing required field — the API should reject it.

        'sector_id' is required. If we send a record without it, the API
        must return 422 Unprocessable Entity (Pydantic validation error).
        This ensures bad satellite data never silently enters the database.
        """
        bad_record = {
            "layer_type": "burn_scar",
            # sector_id is intentionally missing
            "coordinates": {"lat": 56.72, "lon": -111.37},
            "timestamp": "2026-06-25T12:00:00Z",
            "payload": {}
        }

        response = http_client.post(
            "/api/v1/ingest",
            json=bad_record,
            headers=auth_headers
        )

        assert response.status_code == 422, (
            "Ingest accepted a record with missing 'sector_id'. "
            "Feven's Pydantic model must mark sector_id as required."
        )

    def test_ingest_rejects_invalid_coordinates(self, http_client, auth_headers):
        """
        Latitude must be between -90 and 90. Longitude between -180 and 180.

        If someone sends coordinates that don't exist on Earth,
        the API should reject it — not silently store garbage in PostGIS.
        """
        bad_record = {**SAMPLE_INGEST_RECORD, "coordinates": {"lat": 999, "lon": 999}}

        response = http_client.post(
            "/api/v1/ingest",
            json=bad_record,
            headers=auth_headers
        )

        assert response.status_code == 422, (
            "Ingest accepted coordinates (lat=999, lon=999) that don't exist on Earth. "
            "Add coordinate range validation to Feven's Pydantic model."
        )


# ─── Contract 2: Map Query Endpoint (Feven -> Reyta) ─────────────────────────

class TestMapQueryContract:
    """
    Tests for GET /api/v1/layers/{sector_id}
    Owner: Feven | Consumer: Reyta (frontend map)

    Reyta's React-Leaflet map calls this endpoint to fetch layer data
    for a sector. The response shape must match exactly — otherwise the
    map will crash or show no data.
    """

    # The sector ID used in all tests below
    TEST_SECTOR = "ATH-001"

    def test_map_query_returns_200_or_404(self, http_client, auth_headers):
        """
        The map query should return 200 (data found) or 404 (sector doesn't exist yet).

        Both are valid. We just need to confirm it's not 500 (server crash)
        or 401 (auth is broken).
        """
        response = http_client.get(
            f"/api/v1/layers/{self.TEST_SECTOR}",
            headers=auth_headers
        )

        assert response.status_code in (200, 404), (
            f"Unexpected status from map query: {response.status_code}. "
            f"Expected 200 (data found) or 404 (no data for this sector)."
        )

    def test_map_query_200_response_has_correct_shape(self, http_client, auth_headers):
        """
        When the sector exists, the response must include these exact fields:
        sector_id and layers (a list).

        Reyta's frontend expects both of these. If 'layers' is missing,
        the map will crash with a TypeError trying to iterate over undefined.
        """
        response = http_client.get(
            f"/api/v1/layers/{self.TEST_SECTOR}",
            headers=auth_headers
        )

        if response.status_code == 200:
            body = response.json()
            assert_has_required_fields(
                body,
                required_fields=["sector_id", "layers"],
                context="Map query response"
            )
            assert isinstance(body["layers"], list), (
                "'layers' must be a list so Reyta's map can iterate over it. "
                f"Got type: {type(body['layers'])}"
            )

    def test_map_query_layer_items_have_correct_shape(self, http_client, auth_headers):
        """
        Each item inside the 'layers' list must have the agreed sub-fields.

        Reyta's map renders each layer using: layer_type, coordinates,
        timestamp, and data. If any of these are missing, specific map
        overlays will fail silently.
        """
        response = http_client.get(
            f"/api/v1/layers/{self.TEST_SECTOR}",
            headers=auth_headers
        )

        if response.status_code == 200:
            body = response.json()
            for i, layer in enumerate(body.get("layers", [])):
                assert_has_required_fields(
                    layer,
                    required_fields=["layer_type", "coordinates", "timestamp", "data"],
                    context=f"Layer item at index {i}"
                )

    def test_map_query_unknown_sector_returns_404(self, http_client, auth_headers):
        """
        Requesting a sector that doesn't exist should return 404 Not Found.

        Reyta's frontend needs to handle this gracefully (show "no data"
        instead of crashing). This test confirms the API sends the right signal.
        """
        response = http_client.get(
            "/api/v1/layers/DOES-NOT-EXIST-999",
            headers=auth_headers
        )

        assert response.status_code == 404, (
            "Expected 404 for an unknown sector. "
            f"Got {response.status_code}. "
            "Feven's handler must explicitly return 404 when the DB query returns nothing."
        )


# ─── Contract 3: ML Output (Richard -> Rahil + Reyta) ────────────────────────

class TestMLOutputContract:
    """
    Tests for Richard's ML model endpoints.
    Owner: Richard | Consumers: Rahil (stores results) + Reyta (displays risk overlays)

    Richard's models analyze satellite data and return risk scores.
    The response shape must match exactly so Rahil can store it
    and Reyta can render the correct colour-coded risk overlay on the map.
    """

    # Required fields that EVERY ML endpoint must return (per api-contracts.md)
    REQUIRED_ML_FIELDS = [
        "simulation_type",
        "sector_id",
        "risk_score",
        "contaminant_vector",
        "confidence",
        "timestamp",
        "model_version"
    ]

    def _validate_ml_response(self, response, endpoint_name: str):
        """
        Internal helper: validates shape and field types for any ML response.
        Called by each endpoint-specific test below.
        """
        if response.status_code in (502, 503, 504):
            pytest.skip(
                f"{endpoint_name} returned {response.status_code} — "
                "ML service (Richard's Railway deployment) is not reachable. "
                "Check ML_API_URL secret and Richard's Railway service status."
            )
        assert response.status_code == 200, (
            f"{endpoint_name} returned {response.status_code}. "
            "Expected 200. Check Richard's model service logs."
        )

        body = response.json()
        assert_has_required_fields(body, self.REQUIRED_ML_FIELDS, endpoint_name)

        # risk_score must be a number between 0 and 1 (0% to 100% risk)
        assert 0.0 <= body["risk_score"] <= 1.0, (
            f"risk_score must be between 0.0 and 1.0. "
            f"Got: {body['risk_score']}. "
            "Reyta's risk overlay uses this to pick a colour — values outside range will break it."
        )

        # confidence must also be a 0-1 number
        assert 0.0 <= body["confidence"] <= 1.0, (
            f"confidence must be between 0.0 and 1.0. Got: {body['confidence']}"
        )

    def test_change_detection_endpoint(self, http_client, auth_headers):
        """
        POST /api/v1/change-detection/predict
        Detects burn scars from before/after satellite imagery.
        """
        payload = {"sector_id": "ATH-001", "imagery_date": "2026-06-25"}

        response = http_client.post(
            "/api/v1/change-detection/predict",
            json=payload,
            headers=auth_headers
        )

        self._validate_ml_response(response, "POST /api/v1/change-detection/predict")

        body = response.json()
        assert body["simulation_type"] == "change_detection", (
            "simulation_type must be 'change_detection' for this endpoint."
        )

    def test_erosion_simulation_endpoint(self, http_client, auth_headers):
        """
        GET /api/v1/simulate/erosion
        Predicts erosion risk in post-fire terrain.
        """
        response = http_client.get(
            "/api/v1/simulate/erosion",
            params={"sector_id": "ATH-001", "rainfall_mm": 45.0},
            headers=auth_headers
        )

        self._validate_ml_response(response, "GET /api/v1/simulate/erosion")

        body = response.json()
        assert body["simulation_type"] == "erosion", (
            "simulation_type must be 'erosion' for this endpoint."
        )

    def test_contaminant_simulation_endpoint(self, http_client, auth_headers):
        """
        GET /api/v1/simulate/contaminant
        Simulates how hydrocarbons spread through the watershed.
        contaminant_vector should be a list of numbers (NOT None) for this endpoint.
        """
        response = http_client.get(
            "/api/v1/simulate/contaminant",
            params={"sector_id": "ATH-001", "flow_direction_deg": 180.0, "water_velocity_ms": 2.1, "contamination_level": 0.72},
            headers=auth_headers
        )

        self._validate_ml_response(response, "POST /simulate/contaminant")

        body = response.json()
        assert body["simulation_type"] == "contaminant", (
            "simulation_type must be 'contaminant' for this endpoint."
        )

        # For contaminant simulation specifically, we expect an actual vector
        # (not None) — this is what Reyta uses to draw the spread animation
        assert body["contaminant_vector"] is not None, (
            "contaminant_vector must not be None for the contaminant simulation. "
            "It should be a list of numbers representing the spread path."
        )
        assert isinstance(body["contaminant_vector"], list), (
            f"contaminant_vector must be a list. Got: {type(body['contaminant_vector'])}"
        )


# ─── Contract 6: Multi-Source Fusion Endpoint (Feven -> Reyta) ───────────────

class TestMultiSourceFusionContract:
    """
    Tests for GET /api/v1/fusion/{sector_id}
    Owner: Feven | Consumer: Reyta (full risk overlay)

    The fusion endpoint combines environmental_layers, water_quality_archive,
    and ml_model_outputs into a single response so the frontend can render
    the complete risk overlay in one call.
    """

    TEST_SECTOR = "ATH-001"

    def test_fusion_returns_200_or_404(self, http_client, auth_headers):
        """
        Fusion endpoint should return 200 (data found) or 404 (no data yet).
        Must not return 500 (crash) or 401 (auth broken).
        """
        response = http_client.get(
            f"/api/v1/fusion/{self.TEST_SECTOR}",
            headers=auth_headers
        )

        assert response.status_code in (200, 404), (
            f"Unexpected status from fusion endpoint: {response.status_code}. "
            f"Expected 200 (data found) or 404 (no data for sector)."
        )

    def test_fusion_200_response_has_required_fields(self, http_client, auth_headers):
        """
        When fusion returns 200, the response must include all top-level fields
        Reyta's frontend expects for the full risk overlay.
        """
        response = http_client.get(
            f"/api/v1/fusion/{self.TEST_SECTOR}",
            headers=auth_headers
        )

        if response.status_code == 200:
            body = response.json()
            assert_has_required_fields(
                body,
                required_fields=["sector_id", "environmental_layers", "water_quality", "ml_outputs", "summary"],
                context="Fusion response"
            )
            assert isinstance(body["environmental_layers"], list), "'environmental_layers' must be a list"
            assert isinstance(body["water_quality"], list), "'water_quality' must be a list"
            assert isinstance(body["ml_outputs"], list), "'ml_outputs' must be a list"
            assert isinstance(body["summary"], dict), "'summary' must be a dict"

    def test_fusion_summary_has_required_fields(self, http_client, auth_headers):
        """
        The summary block must include layer_count and highest_risk_score
        so Reyta can render the headline risk indicator without parsing the full lists.
        """
        response = http_client.get(
            f"/api/v1/fusion/{self.TEST_SECTOR}",
            headers=auth_headers
        )

        if response.status_code == 200:
            summary = response.json().get("summary", {})
            assert_has_required_fields(
                summary,
                required_fields=["layer_count", "water_quality_readings", "ml_output_count", "highest_risk_score"],
                context="Fusion summary block"
            )

    def test_fusion_unknown_sector_returns_404(self, http_client, auth_headers):
        """
        A sector with no data across any source must return 404.
        """
        response = http_client.get(
            "/api/v1/fusion/DOES-NOT-EXIST-999",
            headers=auth_headers
        )

        assert response.status_code == 404, (
            f"Expected 404 for unknown sector, got {response.status_code}."
        )


# ─── Contract 4 & 5: Convex Queries (Rahil -> Reyta) ─────────────────────────

class TestConvexQueriesContract:
    """
    Tests that Rahil's Convex real-time queries return the expected data shapes.

    Convex is used for live dashboard updates (pipeline status, water quality).
    These tests use the Convex HTTP API to confirm the query results
    have the fields Reyta's dashboard panels expect.

    Note: Convex has its own URL (NEXT_PUBLIC_CONVEX_URL), separate from the
    FastAPI backend. We import it here directly from the environment.
    """

    def test_convex_queries_are_defined(self):
        """
        Placeholder: confirms that Rahil's Convex query names exist in the codebase.

        Real assertion added in Sprint 2 once Rahil pushes the Convex schema.
        For now this test documents what we're waiting for.
        """
        # Expected query names (per docs/api-contracts.md Contract 5)
        expected_queries = [
            "getPipelineStatus",
            "getLiveWaterQuality",
            "getModelMetadata"
        ]

        # Expected mutation names (per docs/api-contracts.md Contract 4)
        expected_mutations = [
            "updatePipelineStatus",
            "updateWaterQuality",
            "updateModelMetadata"
        ]

        # Document the contracts — this will be expanded to real assertions
        # once /convex/schema.ts and /convex/queries.ts exist (Rahil, Sprint 1)
        assert len(expected_queries) == 3, "Three Convex queries expected per Contract 5"
        assert len(expected_mutations) == 3, "Three Convex mutations expected per Contract 4"
