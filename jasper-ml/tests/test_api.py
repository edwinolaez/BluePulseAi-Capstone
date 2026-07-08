"""
test_api.py — Project Jasper ML API Endpoint Tests

Sprint 3 (M3 - July 18) Tests:
- Endpoint functionality
- Output schema compliance
- Range validation
- Error handling
"""

import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path
import json

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.model_endpoint import app, ModelOutput


client = TestClient(app)


# ============================================================================
# Health Check Tests
# ============================================================================

def test_health_check():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "Project Jasper ML API"
    assert "components" in data
    assert "model" in data["components"]
    assert "erosion_model" in data["components"]
    assert "contaminant_model" in data["components"]


def test_metrics_endpoint():
    """Test metrics endpoint for monitoring."""
    response = client.get("/metrics")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "info" in data
    assert data["info"]["model_version"] == "v1.0"
    assert data["info"]["endpoints"] == 3


# ============================================================================
# Change Detection Endpoint Tests
# ============================================================================

def test_change_detection_endpoint_valid_request():
    """Test change detection endpoint with valid input."""
    payload = {"sector_id": "ATH-001-A"}
    response = client.post("/predict/change-detection", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    
    # Validate response structure
    assert "sector_id" in data
    assert "model_version" in data
    assert "simulation_type" in data
    assert "risk_score" in data
    assert "risk_label" in data
    assert "contaminant_vector" in data
    assert "timestamp" in data
    assert "confidence" in data


def test_change_detection_output_ranges():
    """Test that change detection output is within valid ranges."""
    payload = {"sector_id": "ATH-001-A"}
    response = client.post("/predict/change-detection", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    
    # Validate ranges
    assert 0.0 <= data["risk_score"] <= 1.0, "Risk score must be [0, 1]"
    assert 0.0 <= data["confidence"] <= 1.0, "Confidence must be [0, 1]"
    assert data["risk_label"] in ["High", "Medium", "Low"], "Invalid risk label"
    assert data["simulation_type"] == "change_detection"
    
    # Validate contaminant vector
    assert "direction_deg" in data["contaminant_vector"]
    assert "velocity" in data["contaminant_vector"]


def test_change_detection_risk_label_matches_score():
    """Test that risk label matches score correctly."""
    payload = {"sector_id": "ATH-001-A"}
    
    # Run multiple times to test label matching logic
    for _ in range(10):
        response = client.post("/predict/change-detection", json=payload)
        data = response.json()
        
        score = data["risk_score"]
        label = data["risk_label"]
        
        if score >= 0.7:
            assert label == "High", f"Score {score} should be High"
        elif score >= 0.4:
            assert label == "Medium", f"Score {score} should be Medium"
        else:
            assert label == "Low", f"Score {score} should be Low"


def test_change_detection_missing_sector_id():
    """Test change detection endpoint with missing required field."""
    payload = {}  # Missing sector_id
    response = client.post("/predict/change-detection", json=payload)
    
    # Should return 422 validation error
    assert response.status_code == 422


def test_change_detection_output_is_serializable():
    """Test that change detection output is JSON serializable."""
    payload = {"sector_id": "ATH-001-A"}
    response = client.post("/predict/change-detection", json=payload)
    
    assert response.status_code == 200
    data = response.json()
    
    # Should be able to serialize to JSON string
    json_str = json.dumps(data)
    assert isinstance(json_str, str)
    assert len(json_str) > 0


# ============================================================================
# Erosion Simulation Endpoint Tests
# ============================================================================

def test_erosion_endpoint_valid_request():
    """Test erosion simulation endpoint with valid inputs."""
    params = {
        "sector_id": "ATH-001-B",
        "rainfall_mm": 100.0
    }
    response = client.post("/simulate/erosion", json=params)
    
    assert response.status_code == 200
    data = response.json()
    
    # Validate response structure
    assert data["sector_id"] == "ATH-001-B"
    assert data["simulation_type"] == "erosion"
    assert "risk_score" in data
    assert "risk_label" in data


def test_erosion_output_ranges():
    """Test that erosion output is within valid ranges."""
    params = {
        "sector_id": "ATH-001-B",
        "rainfall_mm": 100.0
    }
    response = client.post("/simulate/erosion", json=params)
    
    assert response.status_code == 200
    data = response.json()
    
    # Validate ranges
    assert 0.0 <= data["risk_score"] <= 1.0, "Risk score must be [0, 1]"
    assert 0.0 <= data["confidence"] <= 1.0, "Confidence must be [0, 1]"
    assert data["risk_label"] in ["High", "Medium", "Low"]
    
    # Validate input constraints
    assert data["simulation_type"] == "erosion"



def test_erosion_rainfall_constraint():
    """Test that erosion endpoint enforces rainfall constraints."""
    # Valid: rainfall within range
    params = {
        "sector_id": "ATH-001-B",
        "rainfall_mm": 100.0
    }
    response = client.post("/simulate/erosion", json=params)
    assert response.status_code == 200
    
    # Invalid: rainfall > 500
    params["rainfall_mm"] = 600.0
    response = client.post("/simulate/erosion", json=params)
    assert response.status_code == 422
    
    # Invalid: rainfall < 0
    params["rainfall_mm"] = -1.0
    response = client.post("/simulate/erosion", json=params)
    assert response.status_code == 422



def test_contaminant_endpoint_valid_request():
    """Test contaminant simulation endpoint with valid inputs."""
    params = {
        "sector_id": "ATH-001-C",
        "source_point": {"lat": 55.123, "lon": -114.456}
    }
    response = client.post("/simulate/contaminant", json=params)
    
    assert response.status_code == 200
    data = response.json()
    
    # Validate response structure
    assert data["sector_id"] == "ATH-001-C"
    assert data["simulation_type"] == "contaminant"
    assert "risk_score" in data
    assert "contaminant_vector" in data


def test_contaminant_vector_output_ranges():
    """Test that contaminant vector output is within valid ranges."""
    params = {
        "sector_id": "ATH-001-C",
        "source_point": {"lat": 55.123, "lon": -114.456}
    }
    response = client.post("/simulate/contaminant", json=params)
    
    assert response.status_code == 200
    data = response.json()
    
    # Validate vector ranges
    assert 0.0 <= data["contaminant_vector"]["direction_deg"] < 360.0
    assert 0.0 <= data["contaminant_vector"]["velocity"] <= 1.0
    assert 0.0 <= data["confidence"] <= 1.0
    assert 0.0 <= data["risk_score"] <= 1.0
    assert data["risk_label"] in ["High", "Medium", "Low"]






def test_all_endpoints_return_model_output_schema():
    """Test that all endpoints return valid ModelOutput schema."""
    # Change detection
    response = client.post(
        "/predict/change-detection",
        json={"sector_id": "ATH-001-A"}
    )
    assert response.status_code == 200
    data = response.json()
    
    # Should be parseable as ModelOutput
    output = ModelOutput(**data)
    assert output.sector_id == "ATH-001-A"
    
    # Erosion
    response = client.post(
        "/simulate/erosion",
        json={
            "sector_id": "ATH-001-B",
            "rainfall_mm": 100.0
        }
    )
    assert response.status_code == 200
    data = response.json()
    output = ModelOutput(**data)
    assert output.sector_id == "ATH-001-B"
    
    # Contaminant
    response = client.post(
        "/simulate/contaminant",
        json={
                "sector_id": "ATH-001-C",
                "source_point": {"lat": 55.123, "lon": -114.456}
            }
    )
    assert response.status_code == 200
    data = response.json()
    output = ModelOutput(**data)
    assert output.sector_id == "ATH-001-C"


def test_timestamp_is_valid_iso8601():
    """Test that all endpoints return valid ISO 8601 timestamps."""
    from datetime import datetime as dt
    
    response = client.post(
        "/predict/change-detection",
        json={"sector_id": "ATH-001-A"}
    )
    data = response.json()
    
    # Should be parseable as ISO 8601
    try:
        timestamp = dt.fromisoformat(data["timestamp"].replace("Z", "+00:00"))
        assert timestamp is not None
    except ValueError:
        pytest.fail(f"Invalid ISO 8601 timestamp: {data['timestamp']}")


# ============================================================================
# Integration Tests
# ============================================================================

def test_multiple_sectors_change_detection():
    """Test change detection with multiple sector IDs."""
    sector_ids = ["ATH-001-A", "ATH-001-B", "ATH-002-A", "ATH-002-B"]
    
    for sector_id in sector_ids:
        response = client.post(
            "/predict/change-detection",
            json={"sector_id": sector_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sector_id"] == sector_id


def test_erosion_simulation_progression():
    """Test that erosion risk increases with slope and rainfall."""
    base_params = {
        "sector_id": "ATH-001-B",
        "rainfall_mm": 10.0
    }
    
    response = client.post("/simulate/erosion", json=base_params)
    low_risk = response.json()["risk_score"]
    
    # Increase slope
    high_params = base_params.copy()
    high_params["rainfall_mm"] = 400.0
    
    response = client.post("/simulate/erosion", json=high_params)
    high_risk = response.json()["risk_score"]
    
    # Higher slope and rainfall should generally increase risk
    assert high_risk > low_risk, "Erosion risk should increase with slope/rainfall"



def test_endpoint_response_time():
    """Test that endpoints respond within reasonable time."""
    import time
    
    # Change detection should respond quickly
    start = time.time()
    response = client.post(
        "/predict/change-detection",
        json={"sector_id": "ATH-001-A"}
    )
    elapsed = time.time() - start
    assert response.status_code == 200
    assert elapsed < 1.0, f"Change detection took {elapsed}s, should be < 1.0s"
    
    # Erosion simulation should respond quickly
    start = time.time()
    response = client.post(
        "/simulate/erosion",
        json={
            "sector_id": "ATH-001-B",
            "rainfall_mm": 100.0
        }
    )
    elapsed = time.time() - start
    assert response.status_code == 200
    assert elapsed < 1.0, f"Erosion simulation took {elapsed}s, should be < 1.0s"
    
    # Contaminant simulation should respond quickly
    start = time.time()
    response = client.post(
        "/simulate/contaminant",
        json={
                "sector_id": "ATH-001-C",
                "source_point": {"lat": 55.123, "lon": -114.456}
            }
    )
    elapsed = time.time() - start
    assert response.status_code == 200
    assert elapsed < 1.0, f"Contaminant simulation took {elapsed}s, should be < 1.0s"
