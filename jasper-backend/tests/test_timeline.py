"""Unit tests for the timeline endpoint — GET /api/v1/sectors/{sector_id}/timeline.

Owner: Edwin (QA)
Scope: Sprint 4 — Gradual Timeline Interpolation feature
"""
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import app

client = TestClient(app)
API_HEADERS = {"X-API-Key": "jasper-dev-api-key-2026"}


def _mock_supabase_empty():
    """Returns a Supabase mock where all table queries return zero rows."""
    mock = MagicMock()
    mock.table.return_value.select.return_value.eq.return_value.gte.return_value.lte.return_value.execute.return_value = MagicMock(data=[])
    mock.table.return_value.select.return_value.eq.return_value.gte.return_value.execute.return_value = MagicMock(data=[])
    mock.table.return_value.select.return_value.eq.return_value.lte.return_value.execute.return_value = MagicMock(data=[])
    mock.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    return mock


def _mock_supabase_with_records():
    """Returns a Supabase mock pre-loaded with two ingest_records scan rows."""
    scan_rows = [
        {
            "id": "aaa-111",
            "sector_id": "ATH-001",
            "layer_type": "burn_scar",
            "timestamp": "2024-06-15T00:00:00Z",
            "payload": {"severity": "high", "area_km2": 142.5},
        },
        {
            "id": "bbb-222",
            "sector_id": "ATH-001",
            "layer_type": "burn_scar",
            "timestamp": "2024-08-01T00:00:00Z",
            "payload": {"severity": "medium", "vegetation_pct": 38.0},
        },
    ]
    mock = MagicMock()

    def table_side_effect(name: str):
        tbl = MagicMock()
        rows = scan_rows if name == "ingest_records" else []
        # Chain: .select().eq().execute() and .select().eq().gte().execute() etc.
        chain = MagicMock()
        chain.execute.return_value = MagicMock(data=rows)
        chain.gte.return_value = chain
        chain.lte.return_value = chain
        chain.eq.return_value = chain
        chain.select.return_value = chain
        tbl.select.return_value = chain
        return tbl

    mock.table.side_effect = table_side_effect
    return mock


# ── Auth ───────────────────────────────────────────────────────────────────────

def test_timeline_requires_api_key():
    """Timeline endpoint must reject requests with no API key."""
    response = client.get("/api/v1/sectors/ATH-001/timeline")
    assert response.status_code == 401


def test_timeline_rejects_wrong_api_key():
    """Timeline endpoint must reject wrong API keys."""
    response = client.get(
        "/api/v1/sectors/ATH-001/timeline",
        headers={"X-API-Key": "wrong-key"}
    )
    assert response.status_code == 401


# ── Response shape ─────────────────────────────────────────────────────────────

def test_timeline_returns_correct_shape():
    """Timeline response must include sector_id, scan_count, and scans list."""
    with patch("routers.timeline.get_supabase", return_value=_mock_supabase_empty()):
        response = client.get("/api/v1/sectors/ATH-001/timeline", headers=API_HEADERS)
    assert response.status_code == 200
    body = response.json()
    assert body["sector_id"] == "ATH-001"
    assert "scan_count" in body
    assert "scans" in body
    assert isinstance(body["scans"], list)


def test_timeline_scans_have_interpolation_fields():
    """Each scan record must have the three numeric fields used for blending."""
    with patch("routers.timeline.get_supabase", return_value=_mock_supabase_with_records()):
        response = client.get("/api/v1/sectors/ATH-001/timeline", headers=API_HEADERS)
    assert response.status_code == 200
    scans = response.json()["scans"]
    assert len(scans) == 2
    for scan in scans:
        assert "timestamp" in scan
        assert "vegetation_pct" in scan
        assert "erosion_risk_score" in scan
        assert "water_turbidity" in scan


def test_timeline_scans_sorted_by_timestamp():
    """Scans must be returned oldest-first so frontend binary-search works."""
    with patch("routers.timeline.get_supabase", return_value=_mock_supabase_with_records()):
        response = client.get("/api/v1/sectors/ATH-001/timeline", headers=API_HEADERS)
    scans = response.json()["scans"]
    timestamps = [s["timestamp"] for s in scans]
    assert timestamps == sorted(timestamps)


def test_timeline_scan_count_matches_scans_length():
    """scan_count field must equal the length of the scans array."""
    with patch("routers.timeline.get_supabase", return_value=_mock_supabase_with_records()):
        response = client.get("/api/v1/sectors/ATH-001/timeline", headers=API_HEADERS)
    body = response.json()
    assert body["scan_count"] == len(body["scans"])


# ── Date filters ───────────────────────────────────────────────────────────────

def test_timeline_accepts_date_filters():
    """Timeline endpoint should accept valid ISO date_from / date_to filters."""
    with patch("routers.timeline.get_supabase", return_value=_mock_supabase_empty()):
        response = client.get(
            "/api/v1/sectors/ATH-001/timeline?date_from=2024-06-01&date_to=2024-09-30",
            headers=API_HEADERS,
        )
    assert response.status_code == 200


def test_timeline_rejects_invalid_date_from():
    """Invalid date_from format must return 422."""
    with patch("routers.timeline.get_supabase", return_value=_mock_supabase_empty()):
        response = client.get(
            "/api/v1/sectors/ATH-001/timeline?date_from=not-a-date",
            headers=API_HEADERS,
        )
    assert response.status_code == 422


def test_timeline_rejects_invalid_date_to():
    """Invalid date_to format must return 422."""
    with patch("routers.timeline.get_supabase", return_value=_mock_supabase_empty()):
        response = client.get(
            "/api/v1/sectors/ATH-001/timeline?date_to=99-99-99",
            headers=API_HEADERS,
        )
    assert response.status_code == 422


# ── DB failure handling ────────────────────────────────────────────────────────

def test_timeline_returns_503_on_db_failure():
    """If Supabase is unreachable, the endpoint must return 503 not 500."""
    broken = MagicMock()
    broken.table.side_effect = Exception("connection refused")
    with patch("routers.timeline.get_supabase", return_value=broken):
        response = client.get("/api/v1/sectors/ATH-001/timeline", headers=API_HEADERS)
    assert response.status_code == 503
