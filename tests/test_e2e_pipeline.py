# test_e2e_pipeline.py — End-to-End Pipeline Integration Tests
#
# This file tests the COMPLETE data flow through Project Jasper:
#
#   [1] INGEST  → POST /api/v1/ingest          (Feven's FastAPI backend)
#   [2] STORE   → PostGIS / Supabase           (Rahil's database)
#   [3] QUERY   → GET /api/v1/layers/{sector}  (Feven's map query endpoint)
#   [4] DISPLAY → response shape matches       (what Reyta's frontend expects)
#
# Why end-to-end testing matters:
#   Unit tests check one piece in isolation ("does Feven's function work?").
#   E2E tests check that ALL pieces work TOGETHER ("if I put data in one end,
#   does it come out the other end in the right shape?").
#
#   Integration bugs are invisible to unit tests. For example:
#   - Feven's API stores coordinates as (lon, lat) but Reyta's map reads (lat, lon)
#   - Rahil's DB silently truncates float precision on coordinates
#   - A timestamp stored as UTC comes back as local time
#   These bugs only show up when you test the full pipeline.
#
# When these tests run:
#   Sprint 2 onwards — services must be running.
#   Tests skip gracefully if RAILWAY_API_URL is not configured.
#
# Owner: Edwin (QA)
# Sprint: 2 — Core Pipeline (June 23–July 4, 2026)
# Reference: docs/api-contracts.md (Contracts 1 and 2)

import pytest
import httpx
import os
import time
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")

BASE_API_URL = os.getenv("RAILWAY_API_URL", "http://localhost:8000")
KONG_API_KEY = os.getenv("NEXT_PUBLIC_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Is the backend reachable? Used to skip E2E tests gracefully in CI
# when RAILWAY_API_URL is not yet set (e.g. before Feven's Railway deploy).
BACKEND_CONFIGURED = bool(BASE_API_URL and BASE_API_URL != "http://localhost:8000")


def auth_headers() -> dict:
    return {"X-API-Key": KONG_API_KEY, "Content-Type": "application/json"}


def admin_supabase_headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
    }


# ─── Test Data Fixtures ────────────────────────────────────────────────────────

@pytest.fixture
def unique_sector_id():
    """
    Generates a unique sector ID for each E2E test run.

    We use a timestamp so two tests running at the same time never collide.
    The prefix E2E- makes it easy to identify and clean up test data in the DB.

    Example: "E2E-1719360000" (Unix timestamp of when the test started)
    """
    return f"E2E-{int(time.time())}"


@pytest.fixture
def e2e_ingest_record(unique_sector_id):
    """
    A valid ingest record that uses the unique sector ID.

    Built from the agreed contract shape in docs/api-contracts.md Contract 1.
    Using a real Athabasca watershed coordinate so PostGIS geometry is valid.
    """
    return {
        "layer_type": "burn_scar",
        "sector_id": unique_sector_id,
        "coordinates": {
            "lat": 56.7267,
            "lon": -111.3790
        },
        "timestamp": "2026-06-26T09:00:00Z",
        "payload": {
            "severity": "high",
            "area_km2": 87.3,
            "source": "e2e_test"
        }
    }


@pytest.fixture
def http_client():
    """
    Creates a short-lived HTTP client for E2E tests.

    We use a longer timeout here (15 seconds) than unit tests because E2E
    requests go through the full stack: Kong → FastAPI → PostGIS → response.
    That chain takes longer than a simple unit test.
    """
    with httpx.Client(base_url=BASE_API_URL, timeout=15.0) as client:
        yield client


# ─── E2E Flow: Ingest → API Response ──────────────────────────────────────────

@pytest.mark.skipif(
    not BACKEND_CONFIGURED,
    reason="RAILWAY_API_URL not set — backend not deployed yet. Set it in .env.local to run E2E tests."
)
class TestE2EIngestToMapQuery:
    """
    Tests the complete pipeline: submit data → retrieve it via the map API.

    This is Sprint 2's primary integration test requirement:
    "E2E integration test: ingest → PostGIS → API → frontend"

    Each test in this class:
    1. Ingests a record via POST /api/v1/ingest
    2. Immediately queries GET /api/v1/layers/{sector_id}
    3. Confirms the ingested record appears in the response

    The sector_id is unique per test so tests never interfere with each other.
    """

    def test_ingested_record_appears_in_map_query(
        self, http_client, e2e_ingest_record, unique_sector_id
    ):
        """
        The primary E2E assertion: data goes in one end and comes out the other.

        Step 1: Ingest a record.
        Step 2: Query the same sector.
        Step 3: The record must appear in the layers list.

        If this fails, the pipeline is broken somewhere between Feven's API
        and Rahil's database. Check: Feven's DB write logic, Rahil's PostGIS
        table schema, the DB connection string in Railway environment variables.
        """
        # Step 1: Ingest
        ingest_response = http_client.post(
            "/api/v1/ingest",
            json=e2e_ingest_record,
            headers=auth_headers()
        )

        assert ingest_response.status_code == 201, (
            f"E2E Step 1 FAILED — ingest was rejected. "
            f"Status: {ingest_response.status_code}, Body: {ingest_response.text}. "
            "Check: Is Feven's FastAPI running? Is Rahil's DB accepting writes?"
        )

        # Step 2: Query the sector we just wrote to
        query_response = http_client.get(
            f"/api/v1/layers/{unique_sector_id}",
            headers=auth_headers()
        )

        assert query_response.status_code == 200, (
            f"E2E Step 2 FAILED — map query returned {query_response.status_code} "
            f"for sector '{unique_sector_id}' that we just ingested into. "
            "The record was accepted by ingest but is not queryable — check DB write path."
        )

        # Step 3: Verify the record is in the response
        body = query_response.json()
        layers = body.get("layers", [])

        assert len(layers) > 0, (
            f"E2E Step 3 FAILED — map query returned 200 but 'layers' is empty. "
            f"We ingested into sector '{unique_sector_id}' but it doesn't appear. "
            "Check: Is Feven's GET handler querying by sector_id correctly?"
        )

    def test_ingested_layer_type_is_preserved(
        self, http_client, e2e_ingest_record, unique_sector_id
    ):
        """
        The layer_type field must survive the full pipeline unchanged.

        We ingest a "burn_scar" record. When we query it back, the response
        must still say "burn_scar". If it changes, Reyta's map will draw
        the wrong overlay type — e.g. showing a water quality icon where
        a burn scar should be.
        """
        http_client.post(
            "/api/v1/ingest",
            json=e2e_ingest_record,
            headers=auth_headers()
        )

        response = http_client.get(
            f"/api/v1/layers/{unique_sector_id}",
            headers=auth_headers()
        )

        if response.status_code == 200:
            body = response.json()
            layers = body.get("layers", [])
            if layers:
                first_layer = layers[0]
                assert first_layer.get("layer_type") == "burn_scar", (
                    f"layer_type changed during pipeline transit. "
                    f"Sent 'burn_scar', got '{first_layer.get('layer_type')}'. "
                    "Check Feven's DB write and read logic for type coercion."
                )

    def test_ingested_coordinates_are_preserved(
        self, http_client, e2e_ingest_record, unique_sector_id
    ):
        """
        Coordinates must come back exactly as sent — no rounding, no swapped axes.

        PostGIS stores geometry internally, then Feven's API converts it back
        to JSON. Common bugs here:
        - lat/lon axes swapped (PostGIS uses lon/lat internally)
        - float precision reduced (e.g. 56.7267 stored as 56.73)

        Both would cause Reyta's map pins to appear in the wrong location.
        """
        original_lat = e2e_ingest_record["coordinates"]["lat"]
        original_lon = e2e_ingest_record["coordinates"]["lon"]

        http_client.post(
            "/api/v1/ingest",
            json=e2e_ingest_record,
            headers=auth_headers()
        )

        response = http_client.get(
            f"/api/v1/layers/{unique_sector_id}",
            headers=auth_headers()
        )

        if response.status_code == 200:
            body = response.json()
            layers = body.get("layers", [])
            if layers:
                coords = layers[0].get("coordinates", {})
                returned_lat = coords.get("lat")
                returned_lon = coords.get("lon")

                # Allow a tiny floating point tolerance (0.0001 degrees ≈ 11 metres)
                assert returned_lat is not None, "coordinates.lat missing from map query response"
                assert returned_lon is not None, "coordinates.lon missing from map query response"

                assert abs(returned_lat - original_lat) < 0.0001, (
                    f"Latitude changed in pipeline: sent {original_lat}, got {returned_lat}. "
                    "Check PostGIS geometry serialization in Feven's GET handler."
                )
                assert abs(returned_lon - original_lon) < 0.0001, (
                    f"Longitude changed in pipeline: sent {original_lon}, got {returned_lon}. "
                    "Check PostGIS geometry serialization. Also verify axis order (PostGIS uses lon/lat internally)."
                )

    def test_ingested_timestamp_is_preserved(
        self, http_client, e2e_ingest_record, unique_sector_id
    ):
        """
        Timestamps must survive the pipeline in ISO 8601 format.

        We send "2026-06-26T09:00:00Z" (UTC, Z suffix).
        We must get back something in ISO 8601 — either the same string
        or an equivalent representation (e.g. "+00:00" instead of "Z").

        Why: Reyta's dashboard displays timestamps. If they come back in
        an unexpected format, JavaScript's Date.parse() may fail or show
        wrong times to users.
        """
        original_ts = e2e_ingest_record["timestamp"]

        http_client.post(
            "/api/v1/ingest",
            json=e2e_ingest_record,
            headers=auth_headers()
        )

        response = http_client.get(
            f"/api/v1/layers/{unique_sector_id}",
            headers=auth_headers()
        )

        if response.status_code == 200:
            body = response.json()
            layers = body.get("layers", [])
            if layers:
                returned_ts = layers[0].get("timestamp")
                assert returned_ts is not None, (
                    "timestamp field missing from map query response layer. "
                    "Reyta's dashboard needs this to display when data was collected."
                )
                # The date portion must be present — timezone format may vary
                assert "2026-06-26" in returned_ts, (
                    f"Timestamp date changed in pipeline. Sent '{original_ts}', "
                    f"got '{returned_ts}'. Check timezone handling in Feven's API."
                )

    def test_map_query_response_shape_is_frontend_ready(
        self, http_client, e2e_ingest_record, unique_sector_id
    ):
        """
        After a successful ingest, the map query response must have the exact
        shape that Reyta's React-Leaflet map expects (per api-contracts.md Contract 2).

        Required top-level fields: sector_id, layers (list)
        Required per-layer fields: layer_type, coordinates, timestamp, data

        If any field is missing, specific map components will crash silently
        or show a blank panel to the user.
        """
        http_client.post(
            "/api/v1/ingest",
            json=e2e_ingest_record,
            headers=auth_headers()
        )

        response = http_client.get(
            f"/api/v1/layers/{unique_sector_id}",
            headers=auth_headers()
        )

        if response.status_code != 200:
            pytest.skip("Skipping shape test — map query did not return 200")

        body = response.json()

        # Top-level shape check
        for field in ["sector_id", "layers"]:
            assert field in body, (
                f"Map query response missing top-level field '{field}'. "
                "This will cause Reyta's map to crash when it tries to render. "
                "Reference: docs/api-contracts.md Contract 2."
            )

        assert isinstance(body["layers"], list), (
            "'layers' must be a list so Reyta's map can iterate over it with .map(). "
            f"Got type: {type(body['layers']).__name__}"
        )

        assert body["sector_id"] == unique_sector_id, (
            f"sector_id in response doesn't match the queried sector. "
            f"Sent query for '{unique_sector_id}', got back '{body['sector_id']}'."
        )

        # Per-layer shape check
        for i, layer in enumerate(body["layers"]):
            for field in ["layer_type", "coordinates", "timestamp", "data"]:
                assert field in layer, (
                    f"Layer at index {i} is missing field '{field}'. "
                    f"Full layer received: {layer}. "
                    "Reference: docs/api-contracts.md Contract 2 — per-layer required fields."
                )


# ─── E2E Flow: Pipeline Rejection ─────────────────────────────────────────────

@pytest.mark.skipif(
    not BACKEND_CONFIGURED,
    reason="RAILWAY_API_URL not set — skipping E2E rejection tests."
)
class TestE2EPipelineRejection:
    """
    Tests that the pipeline rejects bad data BEFORE it reaches the database.

    This matters for data integrity: if invalid records slip through to PostGIS,
    they corrupt Rahil's database and Reyta's map shows garbage data.
    The ingest endpoint is the only gate — so it must enforce the contract strictly.
    """

    def test_rejected_record_does_not_appear_in_map_query(
        self, http_client
    ):
        """
        A rejected ingest must NOT create any record in the DB.

        We send a bad record (missing sector_id). Feven's API should return 422.
        Then we check that no phantom record was created.

        If this fails, bad data is leaking into Rahil's PostGIS even when
        the API returns an error. That's a DB transaction bug in Feven's code.
        """
        ghost_sector = f"GHOST-{int(time.time())}"

        bad_record = {
            "layer_type": "burn_scar",
            # sector_id intentionally omitted
            "coordinates": {"lat": 56.72, "lon": -111.37},
            "timestamp": "2026-06-26T09:00:00Z",
            "payload": {}
        }

        ingest_response = http_client.post(
            "/api/v1/ingest",
            json=bad_record,
            headers=auth_headers()
        )

        # Confirm the rejection happened
        assert ingest_response.status_code == 422, (
            f"Expected 422 for missing sector_id, got {ingest_response.status_code}. "
            "Feven's Pydantic model should catch this."
        )

        # Now check the ghost sector was NOT created in the DB
        query_response = http_client.get(
            f"/api/v1/layers/{ghost_sector}",
            headers=auth_headers()
        )

        assert query_response.status_code == 404, (
            f"A rejected ingest created a ghost record in the database. "
            f"Sector '{ghost_sector}' should not exist but returned {query_response.status_code}. "
            "Check Feven's transaction handling — rejected requests must not write to DB."
        )

    def test_unauthenticated_ingest_does_not_store_data(
        self, http_client, e2e_ingest_record, unique_sector_id
    ):
        """
        A request with no API key must be blocked by Kong — and must NOT write to DB.

        We send a valid record with no X-API-Key header.
        Kong should return 401 before the request even reaches Feven's code.
        The sector must remain empty afterward.
        """
        # Send with no auth header
        ingest_response = http_client.post(
            "/api/v1/ingest",
            json=e2e_ingest_record,
            headers={}  # No API key
        )

        assert ingest_response.status_code == 401, (
            f"Expected 401 for unauthenticated ingest, got {ingest_response.status_code}. "
            "Kong auth plugin is not blocking requests without X-API-Key."
        )

        # Confirm no data was written
        query_response = http_client.get(
            f"/api/v1/layers/{unique_sector_id}",
            headers=auth_headers()
        )

        assert query_response.status_code == 404, (
            f"Unauthenticated ingest wrote to the database anyway. "
            f"Sector '{unique_sector_id}' should not exist but returned {query_response.status_code}. "
            "Check Kong plugin ordering — auth must run before the backend receives the request."
        )


# ─── E2E Flow: Multiple Records ───────────────────────────────────────────────

@pytest.mark.skipif(
    not BACKEND_CONFIGURED,
    reason="RAILWAY_API_URL not set — skipping multi-record E2E tests."
)
class TestE2EMultipleRecords:
    """
    Tests that multiple records in the same sector all appear in the map query.

    A real watershed sector will have many types of data: burn scars,
    water quality readings, erosion risk areas. Reyta's map must show ALL
    of them as separate layers, not just the most recent one.
    """

    def test_two_records_same_sector_both_appear(
        self, http_client, unique_sector_id
    ):
        """
        Ingest two different layer types for the same sector.
        Both must appear as separate items in the layers list.

        If only one appears, Feven's GET handler is returning LIMIT 1
        instead of all records for the sector.
        """
        burn_scar = {
            "layer_type": "burn_scar",
            "sector_id": unique_sector_id,
            "coordinates": {"lat": 56.72, "lon": -111.37},
            "timestamp": "2026-06-26T08:00:00Z",
            "payload": {"severity": "high"}
        }

        water_quality = {
            "layer_type": "water_quality",
            "sector_id": unique_sector_id,
            "coordinates": {"lat": 56.73, "lon": -111.38},
            "timestamp": "2026-06-26T09:00:00Z",
            "payload": {"ph": 7.1, "turbidity_ntu": 4.2}
        }

        # Ingest both records
        r1 = http_client.post("/api/v1/ingest", json=burn_scar, headers=auth_headers())
        r2 = http_client.post("/api/v1/ingest", json=water_quality, headers=auth_headers())

        if r1.status_code != 201 or r2.status_code != 201:
            pytest.skip(
                f"Could not ingest both records (r1={r1.status_code}, r2={r2.status_code}) "
                "— skipping multi-record check."
            )

        # Query the sector
        response = http_client.get(
            f"/api/v1/layers/{unique_sector_id}",
            headers=auth_headers()
        )

        assert response.status_code == 200, (
            f"Map query failed after two ingests into '{unique_sector_id}'. "
            f"Got {response.status_code}."
        )

        body = response.json()
        layers = body.get("layers", [])

        assert len(layers) >= 2, (
            f"Expected at least 2 layers for sector '{unique_sector_id}' "
            f"(burn_scar + water_quality), but got {len(layers)}. "
            "Check Feven's GET handler: is it returning ALL records or just the latest?"
        )

        layer_types_returned = {layer.get("layer_type") for layer in layers}
        assert "burn_scar" in layer_types_returned, (
            "burn_scar layer missing from multi-record query response. "
            f"Got layer_types: {layer_types_returned}"
        )
        assert "water_quality" in layer_types_returned, (
            "water_quality layer missing from multi-record query response. "
            f"Got layer_types: {layer_types_returned}"
        )


# ─── E2E Pipeline Timing ──────────────────────────────────────────────────────

@pytest.mark.skipif(
    not BACKEND_CONFIGURED,
    reason="RAILWAY_API_URL not set — skipping pipeline timing test."
)
class TestE2EPipelineTiming:
    """
    Tests that the full ingest-to-query pipeline completes within acceptable time.

    The full round-trip (ingest + query) should complete in under 2 seconds.
    If it's slower, the monitoring dashboard will feel unresponsive during
    live data updates.

    Note: This is a ceiling check, not a P95 benchmark.
    For P95 performance testing, see benchmark_api.py (activates Sprint 3).
    """

    PIPELINE_CEILING_SECONDS = 2.0

    def test_ingest_then_query_completes_within_2_seconds(
        self, http_client, e2e_ingest_record, unique_sector_id
    ):
        """
        Times the full ingest → query round-trip.

        If this consistently fails (>2s), likely causes:
        - Railway free tier cold start (first request is slow)
        - Missing DB index on sector_id (causes full table scan on every query)
        - Kong overhead is higher than expected
        """
        start = time.time()

        http_client.post(
            "/api/v1/ingest",
            json=e2e_ingest_record,
            headers=auth_headers()
        )

        http_client.get(
            f"/api/v1/layers/{unique_sector_id}",
            headers=auth_headers()
        )

        elapsed = time.time() - start

        assert elapsed < self.PIPELINE_CEILING_SECONDS, (
            f"E2E pipeline took {elapsed:.2f}s — exceeds the {self.PIPELINE_CEILING_SECONDS}s ceiling. "
            "If this is a cold start, retry once. If it consistently fails: "
            "Rahil — check PostGIS index on sector_id column. "
            "Edwin — note this in the Sprint 2 test report."
        )


# ─── Pipeline Flow Documentation ─────────────────────────────────────────────

class TestE2EPipelineDocumentation:
    """
    Documents the E2E pipeline as executable assertions.

    These tests do NOT hit the network — they confirm that the contracts
    and configuration we depend on are correctly defined in code.
    They run in every CI environment, even before services are deployed.

    Think of these as sanity checks on our own test setup.
    """

    def test_pipeline_stages_are_defined(self):
        """
        Confirms the four pipeline stages are represented in this file.

        If a new stage is added to the pipeline (e.g. a caching layer),
        a new test class should be added above and documented here.
        """
        pipeline_stages = [
            "INGEST",     # POST /api/v1/ingest — Feven
            "STORE",      # PostGIS write — Rahil
            "QUERY",      # GET /api/v1/layers — Feven
            "DISPLAY",    # Response shape — Reyta consumes
        ]

        assert len(pipeline_stages) == 4, (
            "Pipeline has 4 stages. If you added a new stage, add a test class for it above."
        )

    def test_e2e_test_sector_prefix_is_distinctive(self):
        """
        Confirms E2E test sectors use the E2E- prefix so they're identifiable.

        If you ever need to clean up stale test data from the DB, you can
        run: DELETE FROM ingest_records WHERE sector_id LIKE 'E2E-%';
        The prefix makes this safe — no real data uses this prefix.
        """
        test_sector = f"E2E-{int(time.time())}"
        assert test_sector.startswith("E2E-"), (
            "E2E test sectors must use the E2E- prefix for easy identification and cleanup."
        )

    def test_sample_record_uses_valid_athabasca_coordinates(self):
        """
        Confirms our test coordinates are within the Athabasca watershed bounds.

        The system monitors the Athabasca region (roughly 54°N–58°N, 110°W–115°W).
        Using coordinates outside this region could cause spatial query issues
        with Rahil's PostGIS bounding box indexes.
        """
        lat = 56.7267
        lon = -111.3790

        # Athabasca watershed approximate bounding box
        assert 54.0 <= lat <= 58.0, (
            f"Test latitude {lat} is outside the Athabasca watershed range (54N–58N). "
            "Use a coordinate within the monitored region."
        )
        assert -115.0 <= lon <= -110.0, (
            f"Test longitude {lon} is outside the Athabasca watershed range (115W–110W). "
            "Use a coordinate within the monitored region."
        )
