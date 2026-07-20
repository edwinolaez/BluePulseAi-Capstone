"""Unit tests for Project Jasper ingest and data endpoints."""
from fastapi.testclient import TestClient
from unittest.mock import MagicMock, patch
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import app
import io

client = TestClient(app)

# Every protected request needs this header
API_HEADERS = {"X-API-Key": "jasper-dev-api-key-2026"}

# Health check test — no API key needed
def test_health():
    """Health endpoint should be publicly accessible."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

# GeoTIFF tests
def test_geotiff_ingest_valid_file():
    """Valid GeoTIFF file should be accepted."""
    fake_file = io.BytesIO(b"fake geotiff content")
    response = client.post(
        "/api/v1/ingest/geotiff",
        headers=API_HEADERS,
        data={"sector_id": "S1", "data_source": "sentinel", "user_id": "user1"},
        files={"file": ("test.tif", fake_file, "image/tiff")}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"

def test_geotiff_ingest_wrong_format():
    """Non-GeoTIFF file should be rejected with 422."""
    fake_file = io.BytesIO(b"not a geotiff")
    response = client.post(
        "/api/v1/ingest/geotiff",
        headers=API_HEADERS,
        data={"sector_id": "S1", "data_source": "sentinel", "user_id": "user1"},
        files={"file": ("test.txt", fake_file, "text/plain")}
    )
    assert response.status_code == 422

# DEM tests
def test_dem_ingest_valid_file():
    """Valid DEM GeoTIFF file should be accepted."""
    fake_file = io.BytesIO(b"fake dem content")
    response = client.post(
        "/api/v1/ingest/dem",
        headers=API_HEADERS,
        data={"sector_id": "S1", "data_source": "altalis", "user_id": "user1"},
        files={"file": ("dem.tif", fake_file, "image/tiff")}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"

def test_dem_ingest_wrong_format():
    """Non-GeoTIFF DEM file should be rejected with 422."""
    fake_file = io.BytesIO(b"not a dem")
    response = client.post(
        "/api/v1/ingest/dem",
        headers=API_HEADERS,
        data={"sector_id": "S1", "data_source": "altalis", "user_id": "user1"},
        files={"file": ("dem.csv", fake_file, "text/csv")}
    )
    assert response.status_code == 422

# Telemetry tests
def test_telemetry_ingest_valid():
    """Valid telemetry data should be accepted.
    Mocks get_supabase so this unit test doesn't need a live DB — E2E tests cover real persistence."""
    mock_supabase = MagicMock()
    mock_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(data=[])
    with patch("routers.ingest.get_supabase", return_value=mock_supabase):
        response = client.post(
            "/api/v1/ingest/telemetry",
            headers=API_HEADERS,
            data={
                "sector_id": "S1",
                "data_source": "wateroffice",
                "user_id": "user1",
                "turbidity": "12.5",
                "flow_rate": "3.2"
            }
        )
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"

def test_telemetry_ingest_missing_field():
    """Telemetry request missing required fields should return 422."""
    response = client.post(
        "/api/v1/ingest/telemetry",
        headers=API_HEADERS,
        data={
            "sector_id": "S1",
            "data_source": "wateroffice",
            "user_id": "user1"
        }
    )
    assert response.status_code == 422

# Auth tests
def test_protected_route_requires_api_key():
    """Protected endpoint without API key should return 401."""
    fake_file = io.BytesIO(b"fake geotiff content")
    response = client.post(
        "/api/v1/ingest/geotiff",
        data={"sector_id": "S1", "data_source": "sentinel", "user_id": "user1"},
        files={"file": ("test.tif", fake_file, "image/tiff")}
    )
    assert response.status_code == 401

# Fusion endpoint tests
def test_get_layers_valid():
    """Layers endpoint should return data or 404 for sector S1."""
    response = client.get("/api/v1/layers/S1", headers=API_HEADERS)
    assert response.status_code in [200, 404]

def test_get_layers_with_filters():
    """Layers endpoint with date filters should return 200 or 404."""
    response = client.get(
        "/api/v1/layers/S1?date_from=2026-01-01&date_to=2027-01-01",
        headers=API_HEADERS
    )
    assert response.status_code in [200, 404]

def test_get_layers_invalid_layer_type():
    """Invalid layer_type should return 422."""
    response = client.get("/api/v1/layers/S1?layer_type=invalid", headers=API_HEADERS)
    assert response.status_code == 422

def test_get_layers_invalid_date():
    """Invalid date format should return 422."""
    response = client.get("/api/v1/layers/S1?date_from=not-a-date", headers=API_HEADERS)
    assert response.status_code == 422