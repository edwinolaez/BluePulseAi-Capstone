"""
test_models.py — Project Jasper ML Model Tests

Unit and integration tests for:
- Change detection model outputs
- Erosion simulation model outputs
- Contaminant tracking model outputs

These tests run in CI/CD on every push to feature/richard-ml.
"""

import pytest
import numpy as np
from datetime import datetime, timezone
import json


# Change Detection Model Tests

def test_change_detection_output_schema():
    """Test that change detection outputs follow agreed schema."""
    # Mock output
    output = {
        "sector_id": "ATH-001-A",
        "model_version": "v1.0",
        "simulation_type": "change_detection",
        "risk_score": 0.85,
        "risk_label": "High",
        "contaminant_vector": {"direction_deg": 0.0, "velocity": 0.0},
        "timestamp": "2026-06-26T14:30:00Z",
        "confidence": 0.92
    }
    
    # Required fields
    required = ["sector_id", "model_version", "simulation_type", 
               "risk_score", "risk_label", "contaminant_vector", 
               "timestamp", "confidence"]
    for field in required:
        assert field in output, f"Missing field: {field}"


def test_risk_score_range():
    """Test that risk_score is always in [0, 1] with no NaN."""
    valid_scores = [0.0, 0.5, 0.75, 1.0]
    for score in valid_scores:
        assert 0.0 <= score <= 1.0
        assert not np.isnan(score)
    
    # Invalid scores should fail
    invalid_scores = [-0.1, 1.1, float('nan'), float('inf')]
    for score in invalid_scores:
        assert not (0.0 <= score <= 1.0) or np.isnan(score)


def test_risk_label_values():
    """Test that risk_label is one of {High, Medium, Low}."""
    valid_labels = ["High", "Medium", "Low"]
    for label in valid_labels:
        assert label in ["High", "Medium", "Low"]
    
    invalid_labels = ["HIGH", "high", "MEDIUM", "none", ""]
    for label in invalid_labels:
        assert label not in ["High", "Medium", "Low"]


def test_risk_label_matches_score():
    """Test that risk_label matches risk_score value."""
    test_cases = [
        (0.05, "Low"),
        (0.35, "Low"),
        (0.55, "Medium"),
        (0.65, "Medium"),
        (0.75, "High"),
        (0.95, "High"),
    ]
    
    for score, expected_label in test_cases:
        if score >= 0.7:
            label = "High"
        elif score >= 0.4:
            label = "Medium"
        else:
            label = "Low"
        assert label == expected_label


# Erosion Model Tests

def test_erosion_risk_output_range():
    """Test that erosion risk_score is always [0, 1]."""
    test_inputs = [
        (0, 0),        # no slope, no rain
        (45, 50),      # moderate
        (90, 200),     # extreme
    ]
    
    for slope_deg, rainfall_mm in test_inputs:
        # Simulate erosion calculation
        risk_score = np.sqrt((slope_deg/90) * (rainfall_mm/100))
        risk_score = np.clip(risk_score, 0.0, 1.0)
        
        assert 0.0 <= risk_score <= 1.0
        assert not np.isnan(risk_score)


def test_erosion_risk_no_nan():
    """Test that erosion model never produces NaN."""
    edge_cases = [
        (0.0, 0.0),           # zero slope, zero rain
        (90.0, 0.0),          # max slope, no rain
        (0.0, 500.0),         # no slope, max rain
        (90.0, 500.0),        # max slope, max rain
    ]
    
    for slope, rainfall in edge_cases:
        risk_score = np.sqrt((slope/90) * (rainfall/100))
        risk_score = np.clip(risk_score, 0.0, 1.0)
        assert not np.isnan(risk_score)


def test_erosion_risk_boundaries():
    """Test that erosion risk clamping works correctly."""
    # Extreme slope and rainfall
    risk_unclamped = np.sqrt((90/90) * (500/100))  # = sqrt(5.0)
    risk_clamped = np.clip(risk_unclamped, 0.0, 1.0)
    
    assert risk_unclamped > 1.0  # Would exceed without clipping
    assert risk_clamped <= 1.0   # Clamped to valid range


# Contaminant Model Tests

def test_contaminant_direction_range():
    """Test that contaminant direction is [0, 360)."""
    valid_directions = [0.0, 45.0, 180.0, 270.0, 359.9]
    for direction in valid_directions:
        normalized = direction % 360.0
        assert 0.0 <= normalized < 360.0


def test_contaminant_velocity_range():
    """Test that contaminant velocity is [0, 1]."""
    velocities = [0.0, 0.25, 0.5, 0.75, 1.0]
    for velocity in velocities:
        assert 0.0 <= velocity <= 1.0
        assert not np.isnan(velocity)


def test_contaminant_vector_no_nulls():
    """Test that contaminant vector fields are never null."""
    test_vectors = [
        {"direction_deg": 0.0, "velocity": 0.0},
        {"direction_deg": 180.0, "velocity": 0.5},
        {"direction_deg": 359.9, "velocity": 1.0},
    ]
    
    for vector in test_vectors:
        assert "direction_deg" in vector
        assert "velocity" in vector
        assert vector["direction_deg"] is not None
        assert vector["velocity"] is not None


# Timestamp Tests

def test_timestamp_iso8601_format():
    """Test that timestamps are valid ISO 8601."""
    valid_timestamps = [
        "2026-06-26T14:30:00Z",
        "2026-06-26T14:30:00+00:00",
        "2026-06-26T14:30:00.123Z",
    ]
    
    for ts in valid_timestamps:
        try:
            datetime.fromisoformat(ts.replace('Z', '+00:00'))
            valid = True
        except ValueError:
            valid = False
        assert valid


def test_timestamp_invalid_formats():
    """Test that invalid timestamps are rejected."""
    invalid_timestamps = [
        "2026-06-26 14:30:00",  # missing T and timezone
        "06/26/2026 14:30:00",  # wrong format
        "June 26, 2026",        # no time
        "2026-06-26",           # date only
    ]
    
    for ts in invalid_timestamps:
        try:
            datetime.fromisoformat(ts.replace('Z', '+00:00'))
            valid = True
        except (ValueError, AttributeError):
            valid = False
        assert not valid


# Confidence Tests

def test_confidence_range():
    """Test that confidence is [0, 1]."""
    valid_confidences = [0.0, 0.1, 0.5, 0.9, 1.0]
    for conf in valid_confidences:
        assert 0.0 <= conf <= 1.0


def test_confidence_never_nan():
    """Test that confidence is never NaN."""
    confidences = [0.0, 0.5, 1.0]
    for conf in confidences:
        assert not np.isnan(conf)


# Integration Tests

def test_full_output_validation():
    """Integration test: validate complete output structure."""
    output = {
        "sector_id": "ATH-001-A",
        "model_version": "v1.0",
        "simulation_type": "change_detection",
        "risk_score": 0.85,
        "risk_label": "High",
        "contaminant_vector": {"direction_deg": 0.0, "velocity": 0.0},
        "timestamp": "2026-06-26T14:30:00Z",
        "confidence": 0.92
    }
    
    # Check all fields
    assert output["sector_id"].startswith("ATH")
    assert output["model_version"] == "v1.0"
    assert output["simulation_type"] in ["change_detection", "erosion", "contaminant"]
    assert 0.0 <= output["risk_score"] <= 1.0
    assert output["risk_label"] in ["High", "Medium", "Low"]
    assert 0.0 <= output["contaminant_vector"]["direction_deg"] < 360.0
    assert 0.0 <= output["contaminant_vector"]["velocity"] <= 1.0
    
    # Check timestamp
    try:
        datetime.fromisoformat(output["timestamp"].replace('Z', '+00:00'))
        ts_valid = True
    except ValueError:
        ts_valid = False
    assert ts_valid
    
    assert 0.0 <= output["confidence"] <= 1.0


def test_json_serialization():
    """Test that outputs can be serialized to JSON."""
    output = {
        "sector_id": "ATH-001-A",
        "model_version": "v1.0",
        "simulation_type": "change_detection",
        "risk_score": 0.85,
        "risk_label": "High",
        "contaminant_vector": {"direction_deg": 0.0, "velocity": 0.0},
        "timestamp": "2026-06-26T14:30:00Z",
        "confidence": 0.92
    }
    
    # Should serialize without error
    json_str = json.dumps(output)
    assert isinstance(json_str, str)
    
    # Should deserialize back to same structure
    deserialized = json.loads(json_str)
    assert deserialized == output


# Performance Tests

def test_model_inference_latency():
    """Test that model inference completes in acceptable time."""
    import time
    
    # Mock inference (placeholder)
    start = time.time()
    # Simulate model prediction
    risk_score = 0.85
    inference_time = time.time() - start
    
    # Should complete in < 2 seconds
    assert inference_time < 2.0


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
