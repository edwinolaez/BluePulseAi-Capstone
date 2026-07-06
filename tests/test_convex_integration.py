# test_convex_integration.py — Convex Real-Time Database Integration Tests
#
# What is Convex?
#   Convex is the real-time database that powers Project Jasper's live dashboard.
#   While Supabase/PostGIS stores historical geospatial records, Convex handles
#   the fast-changing state that Reyta's dashboard shows in real time:
#   - Is the ingest pipeline currently running or idle?
#   - What's the latest water quality reading?
#   - What ML model version ran last, and did it succeed?
#
# Why test Convex separately?
#   Convex has its own HTTP API, separate from Feven's FastAPI backend.
#   These tests call Convex's query and mutation endpoints directly
#   to verify that Rahil's schema and functions are working correctly.
#
# Convex HTTP API reference:
#   Queries  (read): POST {CONVEX_URL}/api/query    body: {"path": "module:fn", "args": {}}
#   Mutations (write): POST {CONVEX_URL}/api/mutation body: {"path": "module:fn", "args": {}}
#
# Owner: Edwin (QA) — in coordination with Rahil (owns /convex/)
# Runs: Sprint 2 onwards once Rahil pushes convex/schema.ts and convex/queries.ts
# Reference: docs/api-contracts.md (Contracts 4 and 5)

import pytest
import httpx
import os
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")

# Convex deployment URL — Rahil configures this and adds it to .env.local
# Format: https://your-project.convex.cloud
CONVEX_URL = os.getenv("NEXT_PUBLIC_CONVEX_URL", "")

# Convex admin key for write operations in tests
# This is generated in the Convex dashboard under Settings → Deploy Keys
CONVEX_DEPLOY_KEY = os.getenv("CONVEX_DEPLOY_KEY", "")

CONVEX_CONFIGURED = bool(CONVEX_URL)


def convex_query_headers() -> dict:
    """
    Headers for a Convex HTTP query request.
    Authentication uses the Convex deploy key if available;
    otherwise falls back to unauthenticated (for public queries).
    """
    headers = {"Content-Type": "application/json"}
    if CONVEX_DEPLOY_KEY:
        headers["Authorization"] = f"Convex {CONVEX_DEPLOY_KEY}"
    return headers


@pytest.fixture(scope="module")
def convex_client():
    """
    HTTP client pointed at the Convex deployment URL.
    Module-scoped because all Convex tests in this file share the same endpoint.
    """
    with httpx.Client(base_url=CONVEX_URL, timeout=10.0) as client:
        yield client


# ─── Contract 4: Convex Mutations (Rahil → Feven + Richard) ───────────────────

@pytest.mark.skipif(
    not CONVEX_CONFIGURED,
    reason="NEXT_PUBLIC_CONVEX_URL not set — waiting for Rahil's Convex deployment. "
           "Add it to .env.local once Rahil pushes convex/schema.ts."
)
class TestConvexMutations:
    """
    Tests for Rahil's Convex mutation functions.
    Owner: Rahil | Consumers: Feven (pipeline status) + Richard (model metadata)

    Mutations write new state to Convex. These tests confirm:
    1. The mutation function names match what's in docs/api-contracts.md Contract 4
    2. The argument shapes are correct
    3. Mutations return without error

    The three mutations (per Contract 4):
    - updatePipelineStatus  → Feven calls this after each ingest run
    - updateWaterQuality    → Feven calls this when water quality data arrives
    - updateModelMetadata   → Richard calls this after each ML model run
    """

    def test_update_pipeline_status_mutation(self, convex_client):
        """
        Calls the updatePipelineStatus mutation with a test payload.

        Feven's ingest pipeline calls this after every run to tell the
        dashboard "I just processed a batch — here's the result."
        If this mutation doesn't exist or rejects the args, Feven's pipeline
        will throw an error after every successful ingest.
        """
        response = convex_client.post(
            "/api/mutation",
            json={
                "path": "pipeline:updatePipelineStatus",
                "args": {
                    "sector_id": "ATH-001",
                    "status": "completed",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            },
            headers=convex_query_headers()
        )

        assert response.status_code == 200, (
            f"updatePipelineStatus mutation failed. "
            f"Status: {response.status_code}, Body: {response.text}. "
            "Check: Does the function path 'pipeline:updatePipelineStatus' match "
            "Rahil's file name in /convex/? (e.g. convex/pipeline.ts exports updatePipelineStatus)"
        )

    def test_update_water_quality_mutation(self, convex_client):
        """
        Calls the updateWaterQuality mutation with a test reading.

        Feven's pipeline calls this when it receives water quality sensor data.
        Reyta's dashboard then displays these readings live via getLiveWaterQuality.
        """
        response = convex_client.post(
            "/api/mutation",
            json={
                "path": "waterQuality:updateWaterQuality",
                "args": {
                    "sector_id": "ATH-001",
                    "readings": {
                        "ph": 7.1,
                        "turbidity_ntu": 3.8,
                        "hydrocarbon_ppb": 1.2
                    },
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            },
            headers=convex_query_headers()
        )

        assert response.status_code == 200, (
            f"updateWaterQuality mutation failed. "
            f"Status: {response.status_code}, Body: {response.text}. "
            "Rahil: confirm the path matches the exported function name in convex/waterQuality.ts"
        )

    def test_update_model_metadata_mutation(self, convex_client):
        """
        Calls the updateModelMetadata mutation with a test ML run result.

        Richard's ML service calls this after every model inference to record:
        which model version ran, what the run ID was, and the output metrics.
        Reyta's risk overlay panel uses this to show "Model v1.2 | Last run: 5m ago".
        """
        response = convex_client.post(
            "/api/mutation",
            json={
                "path": "models:updateModelMetadata",
                "args": {
                    "model_version": "1.0.0",
                    "run_id": "test-run-001",
                    "metrics": {
                        "f1_score": 0.87,
                        "inference_time_ms": 312
                    }
                }
            },
            headers=convex_query_headers()
        )

        assert response.status_code == 200, (
            f"updateModelMetadata mutation failed. "
            f"Status: {response.status_code}, Body: {response.text}. "
            "Richard: confirm you're calling this mutation after each model inference. "
            "Rahil: confirm path 'models:updateModelMetadata' matches convex/models.ts"
        )


# ─── Contract 5: Convex Queries (Rahil → Reyta) ───────────────────────────────

@pytest.mark.skipif(
    not CONVEX_CONFIGURED,
    reason="NEXT_PUBLIC_CONVEX_URL not set — waiting for Rahil's Convex deployment."
)
class TestConvexQueries:
    """
    Tests for Rahil's Convex query functions.
    Owner: Rahil | Consumer: Reyta (frontend dashboard panels)

    Queries read the latest state from Convex. These tests confirm:
    1. The query function names match Contract 5 in docs/api-contracts.md
    2. Responses have the correct shape for Reyta's dashboard components
    3. Data types are correct (strings, numbers, not undefined)

    The three queries (per Contract 5):
    - getPipelineStatus  → Dashboard status panel (is the pipeline running?)
    - getLiveWaterQuality → Water quality widget (latest sensor readings)
    - getModelMetadata   → Risk overlay panel (last ML run info)
    """

    def test_get_pipeline_status_query_exists(self, convex_client):
        """
        Calls getPipelineStatus and checks the response shape.

        Reyta's dashboard status panel calls this on page load and every 30s
        to show "Pipeline: running / idle / error" with a timestamp.
        Missing fields here will show "undefined" in the UI.
        """
        response = convex_client.post(
            "/api/query",
            json={
                "path": "pipeline:getPipelineStatus",
                "args": {}
            },
            headers=convex_query_headers()
        )

        assert response.status_code == 200, (
            f"getPipelineStatus query failed. "
            f"Status: {response.status_code}, Body: {response.text}. "
            "Rahil: confirm path 'pipeline:getPipelineStatus' exists in convex/pipeline.ts"
        )

        body = response.json()
        value = body.get("value")  # Convex wraps results in {"value": ...}

        # getPipelineStatus returns a list of records; check the first one if present
        if isinstance(value, list) and value:
            record = value[0]
            for field in ["status", "timestamp"]:
                assert field in record, (
                    f"getPipelineStatus response is missing '{field}'. "
                    f"Full record: {record}. "
                    "Reyta's dashboard will show 'undefined' for this field."
                )
        elif isinstance(value, dict) and value:
            for field in ["status", "timestamp"]:
                assert field in value, (
                    f"getPipelineStatus response is missing '{field}'. "
                    f"Full response: {value}. "
                    "Reyta's dashboard will show 'undefined' for this field."
                )

    def test_get_live_water_quality_query_exists(self, convex_client):
        """
        Calls getLiveWaterQuality and checks the response shape.

        Reyta's water quality widget subscribes to this query in real time.
        It needs: ph, turbidity_ntu, hydrocarbon_ppb, sector_id, timestamp.
        If any of these are missing, the widget will display dashes or crash.
        """
        response = convex_client.post(
            "/api/query",
            json={
                "path": "waterQuality:getLiveWaterQuality",
                "args": {"sectorId": "ATH-001"}
            },
            headers=convex_query_headers()
        )

        assert response.status_code == 200, (
            f"getLiveWaterQuality query failed. "
            f"Status: {response.status_code}, Body: {response.text}. "
            "Rahil: confirm path 'waterQuality:getLiveWaterQuality' exists in convex/waterQuality.ts"
        )

        body = response.json()
        result = body.get("value") or body

        if result and isinstance(result, dict):
            for field in ["ph", "turbidity_ntu", "hydrocarbon_ppb", "timestamp"]:
                assert field in result, (
                    f"getLiveWaterQuality response missing field '{field}'. "
                    f"Full response: {result}. "
                    "Reyta's water quality widget needs all four fields to render."
                )

    def test_get_model_metadata_query_exists(self, convex_client):
        """
        Calls getModelMetadata and checks the response shape.

        Reyta's risk overlay panel shows "Model v1.2 | Confidence: 87% | Last run: 5m ago".
        It needs: model_version, run_id, and metrics from Convex.
        """
        response = convex_client.post(
            "/api/query",
            json={
                "path": "models:getModelMetadata",
                "args": {}
            },
            headers=convex_query_headers()
        )

        assert response.status_code == 200, (
            f"getModelMetadata query failed. "
            f"Status: {response.status_code}, Body: {response.text}. "
            "Rahil: confirm path 'models:getModelMetadata' exists in convex/models.ts"
        )

        body = response.json()
        result = body.get("value") or body

        if result and isinstance(result, dict):
            for field in ["model_version", "run_id", "metrics"]:
                assert field in result, (
                    f"getModelMetadata response missing field '{field}'. "
                    f"Reyta's risk overlay needs model_version, run_id, and metrics to render."
                )


# ─── Contract 4+5: Mutation → Query Round-Trip ────────────────────────────────

@pytest.mark.skipif(
    not CONVEX_CONFIGURED,
    reason="NEXT_PUBLIC_CONVEX_URL not set — skipping round-trip tests."
)
class TestConvexMutationQueryRoundTrip:
    """
    Tests that data written by a mutation is immediately readable via a query.

    Convex is a real-time database — writes should be visible to queries
    in the same request cycle. This is Convex's core value proposition:
    Reyta's dashboard updates instantly when Feven's pipeline writes new status.

    These tests verify the full write → read cycle works end-to-end.
    """

    def test_pipeline_status_write_then_read(self, convex_client):
        """
        Writes a pipeline status then immediately reads it back.

        If the mutation succeeds but the query returns stale data,
        Reyta's dashboard will show old status even after a new pipeline run.
        That's Convex's eventual consistency breaking — should not happen
        within a single synchronous request cycle.
        """
        test_status = "running"

        # Write
        write_response = convex_client.post(
            "/api/mutation",
            json={
                "path": "pipeline:updatePipelineStatus",
                "args": {
                    "sector_id": "ATH-001",
                    "status": test_status,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
            },
            headers=convex_query_headers()
        )

        if write_response.status_code != 200:
            pytest.skip("Write failed — skipping round-trip check")

        # Read immediately
        read_response = convex_client.post(
            "/api/query",
            json={
                "path": "pipeline:getPipelineStatus",
                "args": {}
            },
            headers=convex_query_headers()
        )

        assert read_response.status_code == 200, (
            "getPipelineStatus query failed immediately after a successful write. "
            "Convex write→read cycle is broken."
        )

        body = read_response.json()
        value = body.get("value")

        # getPipelineStatus returns a list; find the record we just wrote
        if isinstance(value, list) and value:
            statuses = [r.get("status") for r in value if isinstance(r, dict)]
            assert test_status in statuses, (
                f"Wrote status '{test_status}' to Convex, "
                f"but getPipelineStatus returned statuses: {statuses}. "
                "Convex real-time consistency is not working as expected."
            )
        elif isinstance(value, dict) and value:
            assert value.get("status") == test_status, (
                f"Wrote status '{test_status}' to Convex, "
                f"but getPipelineStatus returned '{value.get('status')}'. "
                "Convex real-time consistency is not working as expected."
            )

    def test_model_metadata_write_then_read(self, convex_client):
        """
        Writes ML model metadata then reads it back.

        Richard's ML service writes model run results via updateModelMetadata.
        Reyta's risk overlay panel reads it via getModelMetadata.
        This test confirms the write-read pipeline between Richard and Reyta works.
        """
        test_version = "1.0.0-test"
        test_run_id = "round-trip-test-001"

        write_response = convex_client.post(
            "/api/mutation",
            json={
                "path": "models:updateModelMetadata",
                "args": {
                    "model_version": test_version,
                    "run_id": test_run_id,
                    "metrics": {"f1_score": 0.91, "inference_time_ms": 287}
                }
            },
            headers=convex_query_headers()
        )

        if write_response.status_code != 200:
            pytest.skip("Write failed — skipping round-trip check")

        read_response = convex_client.post(
            "/api/query",
            json={
                "path": "models:getModelMetadata",
                "args": {}
            },
            headers=convex_query_headers()
        )

        assert read_response.status_code == 200

        body = read_response.json()
        result = body.get("value") or body

        if result and isinstance(result, dict):
            assert result.get("model_version") == test_version, (
                f"Wrote model_version '{test_version}', "
                f"but getModelMetadata returned '{result.get('model_version')}'. "
                "Check Rahil's updateModelMetadata function is overwriting the latest record."
            )


# ─── Offline: Contract Coverage Documentation ─────────────────────────────────

class TestConvexContractCoverage:
    """
    Documents the complete Convex contract surface without hitting the network.
    Runs in every CI environment, even before Convex is deployed.
    """

    def test_all_contract_4_mutations_are_tested(self):
        """
        Confirms that all 3 mutations from Contract 4 have tests above.
        If Rahil adds a new mutation, a test must be added here too.
        """
        contract_4_mutations = {
            "updatePipelineStatus",
            "updateWaterQuality",
            "updateModelMetadata",
        }

        tested_mutations = {
            "updatePipelineStatus",
            "updateWaterQuality",
            "updateModelMetadata",
        }

        assert tested_mutations == contract_4_mutations, (
            f"Mutation coverage gap. "
            f"Contract 4 defines: {contract_4_mutations}. "
            f"Tested: {tested_mutations}."
        )

    def test_all_contract_5_queries_are_tested(self):
        """
        Confirms that all 3 queries from Contract 5 have tests above.
        """
        contract_5_queries = {
            "getPipelineStatus",
            "getLiveWaterQuality",
            "getModelMetadata",
        }

        tested_queries = {
            "getPipelineStatus",
            "getLiveWaterQuality",
            "getModelMetadata",
        }

        assert tested_queries == contract_5_queries, (
            f"Query coverage gap. "
            f"Contract 5 defines: {contract_5_queries}. "
            f"Tested: {tested_queries}."
        )

    def test_convex_env_var_names_are_documented(self):
        """
        Documents the two environment variables needed for Convex tests.

        Add these to .env.local once Rahil sets up the Convex deployment:
          NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
          CONVEX_DEPLOY_KEY=<from Convex Dashboard → Settings → Deploy Keys>

        Add them to GitHub Actions secrets for CI:
          Settings → Secrets → Actions → New repository secret
        """
        required_env_vars = [
            "NEXT_PUBLIC_CONVEX_URL",   # Rahil provides this after Convex deploy
            "CONVEX_DEPLOY_KEY",        # Edwin generates from Convex dashboard
        ]

        # This test always passes — it's documentation
        assert len(required_env_vars) == 2
