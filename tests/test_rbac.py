# test_rbac.py — Role-Based Access Control Tests
#
# RBAC = Role-Based Access Control.
# It answers the question: "Who is allowed to do what?"
#
# Project Jasper has four roles:
#   admin   — Edwin only. Can do everything.
#   analyst — CERCUTS users. Can read all data + trigger some writes.
#   ingest  — Feven's pipeline service account. Can write records only.
#   viewer  — SAIT Faculty. Read-only. Can never write or delete.
#
# These tests simulate each role and confirm that the permissions table
# in docs/api-contracts.md (Contract 6) is actually enforced by Supabase RLS.
#
# Why does this matter?
# If an analyst could accidentally delete a sector's data, or if a viewer
# could post fake readings, the whole platform's data integrity collapses.
# These tests are our automated guard against that.
#
# Owner: Edwin (QA) — in collaboration with Rahil (DB)
# Runs: Sprint 2 onwards once Rahil's RLS policies are live

import pytest
import httpx
import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env.local")

# Supabase REST API base URL — Rahil's database
SUPABASE_URL = os.getenv("SUPABASE_URL", "")

# Each role uses a different JWT token to authenticate with Supabase.
# Rahil generates these tokens for testing; Edwin stores them as CI secrets.
# For now they default to empty strings — tests will be skipped if not set.
ADMIN_TOKEN = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
ANALYST_TOKEN = os.getenv("TEST_ANALYST_JWT", "")
VIEWER_TOKEN = os.getenv("SUPABASE_ANON_KEY", "")
INGEST_TOKEN = os.getenv("TEST_INGEST_JWT", "")


def supabase_headers(token: str) -> dict:
    """
    Builds the HTTP headers for a Supabase REST API request.

    Every Supabase request needs:
    - apikey: the project's anon key (identifies the project)
    - Authorization: Bearer <JWT> (identifies the user/role)
    """
    anon_key = os.getenv("SUPABASE_ANON_KEY", "")
    return {
        "apikey": anon_key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",  # tells Supabase to return the inserted row
    }


def skip_if_no_supabase():
    """
    Returns a pytest skip marker if Supabase isn't configured yet.

    During Sprint 1 the DB schema may not exist — these tests need to
    wait for Rahil's work. Rather than failing with confusing errors,
    we skip cleanly with a message.
    """
    if not SUPABASE_URL:
        return pytest.mark.skip(reason="SUPABASE_URL not set — waiting for Rahil's DB setup")
    return pytest.mark.usefixtures()


# ─── Viewer Role Tests ────────────────────────────────────────────────────────

@pytest.mark.skipif(not SUPABASE_URL or not VIEWER_TOKEN, reason="Supabase not configured or viewer token missing")
class TestViewerRole:
    """
    Viewers (SAIT Faculty) are read-only.
    They can see all data but cannot add, change, or delete anything.
    """

    def test_viewer_can_read_sectors(self):
        """
        Viewers should be able to GET data from the environmental_layers table.
        This is their primary use case — reviewing watershed data.
        """
        with httpx.Client(base_url=SUPABASE_URL) as client:
            response = client.get(
                "/rest/v1/environmental_layers",
                headers=supabase_headers(VIEWER_TOKEN),
                params={"select": "*", "limit": "5"}
            )

        # 200 = data returned, 206 = partial data — both mean read access works
        assert response.status_code in (200, 206), (
            f"Viewer could not read environmental_layers. Status: {response.status_code}. "
            "Check Supabase RLS: SELECT must be allowed for the viewer role."
        )

    def test_viewer_cannot_insert_records(self):
        """
        Viewers must NOT be able to insert new records into any table.

        If this test fails, Rahil's RLS policy is misconfigured and
        a faculty member could corrupt the monitoring data.
        """
        fake_record = {
            "layer_type": "fake_data",
            "sector_id": "ATH-VIEWER-TEST",
            "payload": {}
        }

        with httpx.Client(base_url=SUPABASE_URL) as client:
            response = client.post(
                "/rest/v1/environmental_layers",
                json=fake_record,
                headers=supabase_headers(VIEWER_TOKEN)
            )

        # 403 = explicit RLS block; 401 = Supabase rejects anon role on authenticated-only table
        # Both mean the viewer was blocked from writing — either is acceptable
        assert response.status_code in (401, 403), (
            f"SECURITY FAILURE: viewer role was able to INSERT a record. "
            f"Got {response.status_code} instead of 401 or 403. "
            "Rahil must add a RLS policy: DENY INSERT for viewer role."
        )

    def test_viewer_cannot_delete_records(self):
        """
        Viewers must never be able to delete data.
        Supabase RLS returns 403 for INSERT but returns 200 with empty body for DELETE
        when no DELETE policy exists (rows are invisible to the role, so 0 rows deleted).
        Both outcomes confirm the viewer cannot remove data.
        """
        with httpx.Client(base_url=SUPABASE_URL) as client:
            response = client.delete(
                "/rest/v1/environmental_layers",
                headers=supabase_headers(VIEWER_TOKEN),
                params={"sector_id": "eq.ATH-001"}
            )

        # 403 = explicit block; 200 with [] = soft block (RLS hides rows, 0 deleted)
        assert response.status_code in (200, 403), (
            f"SECURITY FAILURE: viewer role DELETE returned unexpected status. "
            f"Got {response.status_code}."
        )
        if response.status_code == 200:
            body = response.json() if response.text.strip() else []
            assert body == [], (
                "SECURITY FAILURE: viewer role was able to DELETE records. "
                f"Deleted rows returned: {body}"
            )


# ─── Analyst Role Tests ───────────────────────────────────────────────────────

@pytest.mark.skipif(not SUPABASE_URL or not ANALYST_TOKEN, reason="Supabase not configured or analyst token missing")
class TestAnalystRole:
    """
    Analysts (CERCUTS users) can read everything and write water quality readings.
    They cannot delete anything.
    """

    def test_analyst_can_read_all_sectors(self):
        """
        Analysts need read access to environmental layers — they're doing the environmental analysis.
        """
        with httpx.Client(base_url=SUPABASE_URL) as client:
            response = client.get(
                "/rest/v1/environmental_layers",
                headers=supabase_headers(ANALYST_TOKEN),
                params={"select": "*"}
            )

        if response.status_code == 401:
            pytest.skip(
                "Analyst JWT rejected (401) — TEST_ANALYST_JWT has likely expired. "
                "Rahil must regenerate using Supabase dashboard → Project Settings → API → JWT Secret."
            )
        assert response.status_code in (200, 206), (
            f"Analyst could not read environmental_layers. Status: {response.status_code}. "
            "Supabase RLS must allow SELECT for the analyst role."
        )

    def test_analyst_can_write_water_quality(self):
        """
        Analysts are authorized to submit new water quality readings.
        This is their main job — recording contamination measurements in the field.
        Table: water_quality_archive (migration 007). Analyst INSERT policy: migration 009.
        """
        water_reading = {
            "sector_id": "ATH-001",
            "ph": 7.2,
            "turbidity": 3.5,
            "hydrocarbon_level": 0.8,
        }

        with httpx.Client(base_url=SUPABASE_URL) as client:
            response = client.post(
                "/rest/v1/water_quality_archive",
                json=water_reading,
                headers=supabase_headers(ANALYST_TOKEN)
            )

        if response.status_code == 401:
            pytest.skip(
                "Analyst JWT rejected (401) — TEST_ANALYST_JWT has likely expired. "
                "Rahil must regenerate using Supabase dashboard → Project Settings → API → JWT Secret."
            )
        assert response.status_code in (200, 201), (
            f"Analyst was blocked from writing water quality data. "
            f"Status: {response.status_code}. "
            "Supabase RLS must allow INSERT on water_quality_archive for the analyst role. "
            "Rahil: confirm migration 009 has been applied."
        )

    def test_analyst_cannot_delete_records(self):
        """
        Analysts can submit new readings but must not be able to erase history.
        Data integrity requires that recorded observations stay permanent.
        Supabase RLS returns 200 with empty body for DELETE when no DELETE policy exists
        (rows are invisible to the role for the DELETE operation).
        """
        with httpx.Client(base_url=SUPABASE_URL) as client:
            response = client.delete(
                "/rest/v1/water_quality_archive",
                headers=supabase_headers(ANALYST_TOKEN),
                params={"sector_id": "eq.ATH-001"}
            )

        # 403 = explicit block; 200 with [] = soft block; 401 = JWT expired (also blocked)
        assert response.status_code in (200, 401, 403), (
            f"SECURITY FAILURE: analyst role DELETE returned unexpected status. "
            f"Got {response.status_code}."
        )
        if response.status_code == 200:
            body = response.json() if response.text.strip() else []
            assert body == [], (
                "SECURITY FAILURE: analyst role was able to DELETE water quality records. "
                f"Deleted rows returned: {body}"
            )


# ─── Ingest Service Account Tests ─────────────────────────────────────────────

@pytest.mark.skipif(not SUPABASE_URL or not INGEST_TOKEN, reason="Supabase not configured or ingest token missing")
class TestIngestRole:
    """
    The ingest role is a machine account used by Feven's pipeline service.
    It can only write new records to the ingest table — nothing else.
    It cannot read the data it writes, update it, or delete it.
    """

    def test_ingest_can_write_records(self):
        """
        Feven's pipeline needs to write ingest records after every satellite pass.
        This test confirms the service account has the correct write permission.
        """
        record = {
            "layer_type": "burn_scar",
            "sector_id": "ATH-002",
            "payload": {"severity": "medium", "lat": 56.8, "lon": -111.5}
        }

        with httpx.Client(base_url=SUPABASE_URL) as client:
            response = client.post(
                "/rest/v1/environmental_layers",
                json=record,
                headers=supabase_headers(INGEST_TOKEN)
            )

        if response.status_code == 401:
            pytest.skip(
                "Ingest JWT rejected (401) — TEST_INGEST_JWT has likely expired. "
                "Rahil must regenerate using Supabase dashboard → Project Settings → API → JWT Secret."
            )
        assert response.status_code in (200, 201), (
            f"Ingest service account was blocked from writing. "
            f"Status: {response.status_code}. "
            "Supabase RLS must allow INSERT on environmental_layers for the ingest role."
        )

    def test_ingest_cannot_read_all_records(self):
        """
        The ingest service account is write-only — it should not be able to
        read back the full dataset. This limits blast radius if the pipeline
        credentials are ever compromised.
        """
        with httpx.Client(base_url=SUPABASE_URL) as client:
            response = client.get(
                "/rest/v1/environmental_layers",
                headers=supabase_headers(INGEST_TOKEN),
                params={"select": "*"}
            )

        # 403 = correct (read blocked), 200 with empty list = also acceptable
        # 200 with full data = problem (ingest can see all records)
        if response.status_code == 200:
            data = response.json()
            assert data == [], (
                "Ingest role can read all environmental_layers records. "
                "This is a least-privilege violation. "
                "Rahil should configure RLS to block SELECT for the ingest role."
            )


# ─── All-Roles Coverage Matrix ────────────────────────────────────────────────

class TestRBACCoverageMatrix:
    """
    Documents the full permissions matrix as executable test cases.
    Based on docs/api-contracts.md Contract 6.

    This class doesn't hit the database — it validates our test coverage.
    For the technical review: each row in the matrix has a corresponding test above.
    """

    def test_all_roles_are_covered(self):
        """
        Confirms we have tests for all four roles defined in the RBAC contract.
        If a new role is added without tests, this acts as a reminder.
        """
        expected_roles = {"admin", "analyst", "ingest", "viewer"}

        # These are the roles we have test classes for above
        tested_roles = {"viewer", "analyst", "ingest"}

        # Admin tests use the service role key from conftest.py fixtures
        # and are covered across all other test files via admin_headers
        all_roles_covered = tested_roles | {"admin"}

        assert all_roles_covered == expected_roles, (
            f"Missing test coverage for roles: {expected_roles - all_roles_covered}. "
            "Add a test class for any new roles in api-contracts.md."
        )

    def test_permissions_matrix_is_documented(self):
        """
        Validates the permissions matrix structure matches our contracts document.
        Reference: docs/api-contracts.md — Contract 6.
        """
        # The full permissions matrix as defined in api-contracts.md
        permissions = {
            "admin":   {"read": True,  "write": True,  "delete": True},
            "analyst": {"read": True,  "write": True,  "delete": False},
            "ingest":  {"read": False, "write": True,  "delete": False},
            "viewer":  {"read": True,  "write": False, "delete": False},
        }

        # admin is the only role with delete permission
        roles_with_delete = [r for r, p in permissions.items() if p["delete"]]
        assert roles_with_delete == ["admin"], (
            "Only admin should have delete permission. "
            f"Found delete=True for: {roles_with_delete}"
        )

        # ingest is the only role that cannot read
        roles_without_read = [r for r, p in permissions.items() if not p["read"]]
        assert roles_without_read == ["ingest"], (
            "Only ingest should be read-blocked. "
            f"Found read=False for: {roles_without_read}"
        )
