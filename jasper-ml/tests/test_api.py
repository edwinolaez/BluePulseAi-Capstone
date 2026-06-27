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


# ============================================================================
# Change Detection Endpoint Tests
# ============================================================================

def test_change_detection_endpoint_valid_request():
    """Test change detection endpoint with valid input."""
    payload = {"sector_id": "ATH-001-A"}
    response = client.post("/api/v1/predict/change-detection", json=payload)
    
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
    response = client.post("/api/v1/predict/change-detection", json=payload)
    
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
        response = client.post("/api/v1/predict/change-detection", json=payload)
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
    response = client.post("/api/v1/predict/change-detection", json=payload)
    
    # Should return 422 validation error
    assert response.status_code == 422


def test_change_detection_output_is_serializable():
    """Test that change detection output is JSON serializable."""
    payload = {"sector_id": "ATH-001-A"}
    response = client.post("/api/v1/predict/change-detection", json=payload)
    
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
        "slope_deg": 45.0,
        "rainfall_mm": 100.0
    }
    response = client.get("/api/v1/simulate/erosion", params=params)
    
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
        "slope_deg": 45.0,
        "rainfall_mm": 100.0
    }
    response = client.get("/api/v1/simulate/erosion", params=params)
    
    assert response.status_code == 200
    data = response.json()
    
    # Validate ranges
    assert 0.0 <= data["risk_score"] <= 1.0, "Risk score must be [0, 1]"
    assert 0.0 <= data["confidence"] <= 1.0, "Confidence must be [0, 1]"
    assert data["risk_label"] in ["High", "Medium", "Low"]
    
    # Validate input constraints
    assert data["simulation_type"] == "erosion"


def test_erosion_slope_constraint():
    """Test that erosion endpoint enforces slope constraints."""
    # Valid: slope within range
    params = {
        "sector_id": "ATH-001-B",
        "slope_deg": 45.0,
        "rainfall_mm": 100.0
    }
    response = client.get("/api/v1/simulate/erosion", params=params)
    assert response.status_code == 200
    
    # Invalid: slope > 90
    params["slope_deg"] = 95.0
    response = client.get("/api/v1/simulate/erosion", params=params)
    assert response.status_code == 422
    
    # Invalid: slope < 0
    params["slope_deg"] = -1.0
    response = client.get("/api/v1/simulate/erosion", params=params)
    assert response.status_code == 422


def test_erosion_rainfall_constraint():
    """Test that erosion endpoint enforces rainfall constraints."""
    # Valid: rainfall within range
    params = {
        "sector_id": "ATH-001-B",
        "slope_deg": 45.0,
        "rainfall_mm": 100.0
    }
    response = client.get("/api/v1/simulate/erosion", params=params)
    assert response.status_code == 200
    
    # Invalid: rainfall > 500
    params["rainfall_mm"] = 600.0
    response = client.get("/api/v1/simulate/erosion", params=params)
    assert response.status_code == 422
    
    # Invalid: rainfall < 0
    params["rainfall_mm"] = -1.0
    response = client.get("/api/v1/simulate/erosion", params=params)
    assert response.status_code == 422


def test_erosion_extreme_values():
    """Test erosion model with extreme but valid values."""
    # Minimum values
    params = {
        "sector_id": "ATH-001-B",
        "slope_deg": 0.0,
        "rainfall_mm": 0.0
    }
    response = client.get("/api/v1/simulate/erosion", params=params)
    assert response.status_code == 200
    data = response.json()
    assert data["risk_score"] >= 0.0
    assert data["risk_score"] <= 1.0
    
    # Maximum values
    params["slope_deg"] = 90.0
    params["rainfall_mm"] = 500.0
    response = client.get("/api/v1/simulate/erosion", params=params)
    assert response.status_code == 200
    data = response.json()
    assert 0.0 <= data["risk_score"] <= 1.0


# ============================================================================
# Contaminant Simulation Endpoint Tests
# ============================================================================

def test_contaminant_endpoint_valid_request():
    """Test contaminant simulation endpoint with valid inputs."""
    params = {
        "sector_id": "ATH-001-C",
        "flow_direction_deg": 180.0,
        "water_velocity_ms": 2.5,
        "contamination_level": 0.7
    }
    response = client.get("/api/v1/simulate/contaminant", params=params)
    
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
        "flow_direction_deg": 180.0,
        "water_velocity_ms": 2.5,
        "contamination_level": 0.7
    }
    response = client.get("/api/v1/simulate/contaminant", params=params)
    
    assert response.status_code == 200
    data = response.json()
    
    # Validate vector ranges
    assert 0.0 <= data["contaminant_vector"]["direction_deg"] < 360.0
    assert 0.0 <= data["contaminant_vector"]["velocity"] <= 1.0
    assert 0.0 <= data["confidence"] <= 1.0
    assert 0.0 <= data["risk_score"] <= 1.0
    assert data["risk_label"] in ["High", "Medium", "Low"]


def test_contaminant_direction_constraint():
    """Test that contaminant endpoint enforces direction constraints."""
    # Valid: direction within range
    params = {
        "sector_id": "ATH-001-C",
        "flow_direction_deg": 180.0,
        "water_velocity_ms": 2.5,
        "contamination_level": 0.7
    }
    response = client.get("/api/v1/simulate/contaminant", params=params)
    assert response.status_code == 200
    
    # Invalid: direction > 360
    params["flow_direction_deg"] = 400.0
    response = client.get("/api/v1/simulate/contaminant", params=params)
    assert response.status_code == 422
    
    # Invalid: direction < 0
    params["flow_direction_deg"] = -1.0
    response = client.get("/api/v1/simulate/contaminant", params=params)
    assert response.status_code == 422


def test_contaminant_velocity_constraint():
    """Test that contaminant endpoint enforces velocity constraints."""
    params = {
        "sector_id": "ATH-001-C",
        "flow_direction_deg": 180.0,
        "water_velocity_ms": 2.5,
        "contamination_level": 0.7
    }
    
    # Valid: velocity within range
    response = client.get("/api/v1/simulate/contaminant", params=params)
    assert response.status_code == 200
    
    # Invalid: velocity > 5
    params["water_velocity_ms"] = 6.0
    response = client.get("/api/v1/simulate/contaminant", params=params)
    assert response.status_code == 422
    
    # Invalid: velocity < 0
    params["water_velocity_ms"] = -1.0
    response = client.get("/api/v1/simulate/contaminant", params=params)
    assert response.status_code == 422


def test_contaminant_contamination_constraint():
    """Test that contaminant endpoint enforces contamination level constraints."""
    params = {
        "sector_id": "ATH-001-C",
        "flow_direction_deg": 180.0,
        "water_velocity_ms": 2.5,
        "contamination_level": 0.7
    }
    
    # Valid: contamination within range
    response = client.get("/api/v1/simulate/contaminant", params=params)
    assert response.status_code == 200
    
    # Invalid: contamination > 1
    params["contamination_level"] = 1.5
    response = client.get("/api/v1/simulate/contaminant", params=params)
    assert response.status_code == 422
    
    # Invalid: contamination < 0
    params["contamination_level"] = -0.1
    response = client.get("/api/v1/simulate/contaminant", params=params)
    assert response.status_code == 422


def test_contaminant_direction_wrapping():
    """Test that flow direction properly wraps around 360 degrees."""
    params = {
        "sector_id": "ATH-001-C",
        "flow_direction_deg": 350.0,
        "water_velocity_ms": 2.5,
        "contamination_level": 0.7
    }
    response = client.get("/api/v1/simulate/contaminant", params=params)
    
    data = response.json()
    # Direction should be normalized to 0-360
    assert 0.0 <= data["contaminant_vector"]["direction_deg"] < 360.0


# ============================================================================
# Schema Compliance Tests
# ============================================================================

def test_all_endpoints_return_model_output_schema():
    """Test that all endpoints return valid ModelOutput schema."""
    # Change detection
    response = client.post(
        "/api/v1/predict/change-detection",
        json={"sector_id": "ATH-001-A"}
    )
    assert response.status_code == 200
    data = response.json()
    
    # Should be parseable as ModelOutput
    output = ModelOutput(**data)
    assert output.sector_id == "ATH-001-A"
    
    # Erosion
    response = client.get(
        "/api/v1/simulate/erosion",
        params={
            "sector_id": "ATH-001-B",
            "slope_deg": 45.0,
            "rainfall_mm": 100.0
        }
    )
    assert response.status_code == 200
    data = response.json()
    output = ModelOutput(**data)
    assert output.sector_id == "ATH-001-B"
    
    # Contaminant
    response = client.get(
        "/api/v1/simulate/contaminant",
        params={
            "sector_id": "ATH-001-C",
            "flow_direction_deg": 180.0,
            "water_velocity_ms": 2.5,
            "contamination_level": 0.7
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
        "/api/v1/predict/change-detection",
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
            "/api/v1/predict/change-detection",
            json={"sector_id": sector_id}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["sector_id"] == sector_id


def test_erosion_simulation_progression():
    """Test that erosion risk increases with slope and rainfall."""
    base_params = {
        "sector_id": "ATH-001-B",
        "slope_deg": 10.0,
        "rainfall_mm": 10.0
    }
    
    response = client.get("/api/v1/simulate/erosion", params=base_params)
    low_risk = response.json()["risk_score"]
    
    # Increase slope
    high_params = base_params.copy()
    high_params["slope_deg"] = 80.0
    high_params["rainfall_mm"] = 400.0
    
    response = client.get("/api/v1/simulate/erosion", params=high_params)
    high_risk = response.json()["risk_score"]
    
    # Higher slope and rainfall should generally increase risk
    assert high_risk > low_risk, "Erosion risk should increase with slope/rainfall"


def test_contaminant_velocity_scales_with_flow():
    """Test that contaminant velocity scales appropriately with water flow."""
    slow_params = {
        "sector_id": "ATH-001-C",
        "flow_direction_deg": 180.0,
        "water_velocity_ms": 0.5,
        "contamination_level": 0.5
    }
    
    response = client.get("/api/v1/simulate/contaminant", params=slow_params)
    slow_velocity = response.json()["contaminant_vector"]["velocity"]
    
    fast_params = slow_params.copy()
    fast_params["water_velocity_ms"] = 4.5
    
    response = client.get("/api/v1/simulate/contaminant", params=fast_params)
    fast_velocity = response.json()["contaminant_vector"]["velocity"]
    
    # Faster water should produce faster plume movement
    assert fast_velocity > slow_velocity, "Plume velocity should increase with water velocity"


# ============================================================================
# Performance Tests
# ============================================================================

def test_endpoint_response_time():
    """Test that endpoints respond within reasonable time."""
    import time
    
    # Change detection should respond quickly
    start = time.time()
    response = client.post(
        "/api/v1/predict/change-detection",
        json={"sector_id": "ATH-001-A"}
    )
    elapsed = time.time() - start
    assert response.status_code == 200
    assert elapsed < 1.0, f"Change detection took {elapsed}s, should be < 1.0s"
    
    # Erosion simulation should respond quickly
    start = time.time()
    response = client.get(
        "/api/v1/simulate/erosion",
        params={
            "sector_id": "ATH-001-B",
            "slope_deg": 45.0,
            "rainfall_mm": 100.0
        }
    )
    elapsed = time.time() - start
    assert response.status_code == 200
    assert elapsed < 1.0, f"Erosion simulation took {elapsed}s, should be < 1.0s"
    
    # Contaminant simulation should respond quickly
    start = time.time()
    response = client.get(
        "/api/v1/simulate/contaminant",
        params={
            "sector_id": "ATH-001-C",
            "flow_direction_deg": 180.0,
            "water_velocity_ms": 2.5,
            "contamination_level": 0.7
        }
    )
    elapsed = time.time() - start
    assert response.status_code == 200
    assert elapsed < 1.0, f"Contaminant simulation took {elapsed}s, should be < 1.0s"
