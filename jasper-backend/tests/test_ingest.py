from fastapi.testclient import TestClient
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from main import app
import io

client = TestClient(app)

# Health check test
def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

# GeoTIFF tests
def test_geotiff_ingest_valid_file():
    fake_file = io.BytesIO(b"fake geotiff content")
    response = client.post(
        "/api/v1/ingest/geotiff",
        data={"sector_id": "S1", "data_source": "sentinel", "user_id": "user1"},
        files={"file": ("test.tif", fake_file, "image/tiff")}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"

def test_geotiff_ingest_wrong_format():
    fake_file = io.BytesIO(b"not a geotiff")
    response = client.post(
        "/api/v1/ingest/geotiff",
        data={"sector_id": "S1", "data_source": "sentinel", "user_id": "user1"},
        files={"file": ("test.txt", fake_file, "text/plain")}
    )
    assert response.status_code == 422

# DEM tests
def test_dem_ingest_valid_file():
    fake_file = io.BytesIO(b"fake dem content")
    response = client.post(
        "/api/v1/ingest/dem",
        data={"sector_id": "S1", "data_source": "altalis", "user_id": "user1"},
        files={"file": ("dem.tif", fake_file, "image/tiff")}
    )
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"

def test_dem_ingest_wrong_format():
    fake_file = io.BytesIO(b"not a dem")
    response = client.post(
        "/api/v1/ingest/dem",
        data={"sector_id": "S1", "data_source": "altalis", "user_id": "user1"},
        files={"file": ("dem.csv", fake_file, "text/csv")}
    )
    assert response.status_code == 422

# Telemetry tests
def test_telemetry_ingest_valid():
    response = client.post(
        "/api/v1/ingest/telemetry",
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
    response = client.post(
        "/api/v1/ingest/telemetry",
        data={
            "sector_id": "S1",
            "data_source": "wateroffice",
            "user_id": "user1"
        }
    )
    assert response.status_code == 422