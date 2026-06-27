"""
model_endpoint.py — Project Jasper ML Model API

FastAPI endpoints for change detection, erosion simulation, and contaminant tracking.

Endpoints:
- POST /api/v1/predict/change-detection
- GET /api/v1/simulate/erosion
- GET /api/v1/simulate/contaminant

Rate limit: 20 req/min (configured by Kong Gateway)
"""

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
import numpy as np
from datetime import datetime, timezone
import os


app = FastAPI(
    title="Project Jasper ML Model API",
    description="AI/ML endpoints for watershed environmental monitoring",
    version="1.0.0"
)


# ============================================================================
# Pydantic Models — Input Validation
# ============================================================================

class ChangeDetectionRequest(BaseModel):
    """Validate change detection prediction request."""
    sector_id: str = Field(..., description="Grid sector ID (e.g., ATH-001-A)")
    
    class Config:
        example = {
            "sector_id": "ATH-001-A"
        }


class ErosionSimulationRequest(BaseModel):
    """Validate erosion risk simulation request."""
    sector_id: str = Field(..., description="Grid sector ID")
    slope_deg: float = Field(..., ge=0, le=90, description="Terrain slope (0-90 degrees)")
    rainfall_mm: float = Field(..., ge=0, le=500, description="Rainfall intensity (0-500 mm)")
    
    class Config:
        example = {
            "sector_id": "ATH-001-B",
            "slope_deg": 45.0,
            "rainfall_mm": 100.0
        }


class ContaminantSimulationRequest(BaseModel):
    """Validate contaminant tracking simulation request."""
    sector_id: str = Field(..., description="Grid sector ID")
    flow_direction_deg: float = Field(..., ge=0, le=360, description="Water flow direction (0-360°)")
    water_velocity_ms: float = Field(..., ge=0, le=5, description="Water velocity (0-5 m/s)")
    contamination_level: float = Field(..., ge=0, le=1, description="Contamination level (0-1)")
    
    class Config:
        example = {
            "sector_id": "ATH-001-C",
            "flow_direction_deg": 180.0,
            "water_velocity_ms": 2.5,
            "contamination_level": 0.7
        }


class ModelOutput(BaseModel):
    """Standardized ML output schema."""
    sector_id: str
    model_version: str
    simulation_type: str
    risk_score: float
    risk_label: str
    contaminant_vector: Dict[str, float]
    timestamp: str
    confidence: float
    
    class Config:
        example = {
            "sector_id": "ATH-001-A",
            "model_version": "v1.0",
            "simulation_type": "change_detection",
            "risk_score": 0.85,
            "risk_label": "High",
            "contaminant_vector": {"direction_deg": 0.0, "velocity": 0.0},
            "timestamp": "2026-06-26T14:30:00Z",
            "confidence": 0.92
        }


# ============================================================================
# Model Functions (placeholders for actual ML models)
# ============================================================================

def calculate_change_detection_risk(sector_id: str) -> Dict[str, Any]:
    """
    Placeholder: In production, this loads pre/post imagery and runs ML model.
    
    TODO (Sprint 2):
    - Load trained model from /models/change_detection/model_v1.pkl
    - Fetch pre/post imagery from Feven's ingest pipeline
    - Run inference
    - Return standardized output
    """
    # Mock output for development
    return {
        "sector_id": sector_id,
        "model_version": "v1.0",
        "simulation_type": "change_detection",
        "risk_score": 0.82,
        "risk_label": "High",
        "contaminant_vector": {"direction_deg": 0.0, "velocity": 0.0},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "confidence": 0.88
    }


def calculate_erosion_risk(sector_id: str, slope_deg: float, rainfall_mm: float) -> Dict[str, Any]:
    """Calculate erosion risk using RUSLE-inspired formula."""
    
    # Normalized slope factor
    slope_factor = min(slope_deg / 90.0, 1.0)
    
    # Normalized rainfall factor
    rainfall_factor = min(rainfall_mm / 100.0, 1.0)
    
    # Erosion risk = combined slope and rainfall effects
    risk_score = np.sqrt(slope_factor * rainfall_factor)
    risk_score = float(np.clip(risk_score, 0.0, 1.0))
    
    # Classify into risk labels
    if risk_score >= 0.7:
        risk_label = "High"
    elif risk_score >= 0.4:
        risk_label = "Medium"
    else:
        risk_label = "Low"
    
    return {
        "sector_id": sector_id,
        "model_version": "v1.0",
        "simulation_type": "erosion",
        "risk_score": risk_score,
        "risk_label": risk_label,
        "contaminant_vector": {"direction_deg": 0.0, "velocity": 0.0},
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "confidence": 0.8
    }


def calculate_contaminant_vector(sector_id: str, flow_direction_deg: float, 
                                water_velocity_ms: float, contamination_level: float) -> Dict[str, Any]:
    """Calculate contaminant plume movement vector."""
    
    # Validate flow direction
    direction_deg = flow_direction_deg % 360.0
    
    # Normalize water velocity to [0, 1]
    velocity_normalized = min(water_velocity_ms / 5.0, 1.0)
    
    # Plume velocity influenced by water velocity and contamination level
    plume_velocity = velocity_normalized * (0.5 + 0.5 * contamination_level)
    plume_velocity = float(np.clip(plume_velocity, 0.0, 1.0))
    
    # Confidence based on contamination level
    confidence = float(np.clip(contamination_level, 0.1, 1.0))
    
    return {
        "sector_id": sector_id,
        "model_version": "v1.0",
        "simulation_type": "contaminant",
        "risk_score": contamination_level,
        "risk_label": "High" if contamination_level >= 0.7 else ("Medium" if contamination_level >= 0.4 else "Low"),
        "contaminant_vector": {
            "direction_deg": float(direction_deg),
            "velocity": plume_velocity
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "confidence": confidence
    }


# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "ok", "service": "Project Jasper ML API"}


@app.post("/api/v1/predict/change-detection", response_model=ModelOutput)
async def predict_change_detection(request: ChangeDetectionRequest):
    """
    Predict post-fire burn scar risk for a given sector.
    
    **Endpoint:** `POST /api/v1/predict/change-detection`
    
    **Input:**
    - sector_id: Grid cell identifier from ingest pipeline
    
    **Output:**
    - Standardized ML output (see schema in ML_OUTPUT_SCHEMA.md)
    - risk_score: [0, 1] burn intensity
    - risk_label: High/Medium/Low
    - confidence: Model confidence in prediction
    
    **Rate Limit:** 20 requests/minute (Kong Gateway)
    
    **Example:**
    ```
    curl -X POST http://localhost:8000/api/v1/predict/change-detection \\
      -H "Content-Type: application/json" \\
      -d '{"sector_id": "ATH-001-A"}'
    ```
    """
    try:
        result = calculate_change_detection_risk(request.sector_id)
        return ModelOutput(**result)
    except Exception as e:
        # Never return stack trace (security)
        raise HTTPException(
            status_code=500,
            detail="Change detection prediction failed"
        )


@app.get("/api/v1/simulate/erosion", response_model=ModelOutput)
async def simulate_erosion(
    sector_id: str = Query(..., description="Grid sector ID"),
    slope_deg: float = Query(..., ge=0, le=90, description="Slope in degrees"),
    rainfall_mm: float = Query(..., ge=0, le=500, description="Rainfall in mm")
):
    """
    Simulate erosion risk for given terrain and rainfall conditions.
    
    **Endpoint:** `GET /api/v1/simulate/erosion`
    
    **Parameters:**
    - sector_id: Grid cell identifier
    - slope_deg: Terrain slope (0-90°)
    - rainfall_mm: Rainfall intensity (0-500mm)
    
    **Output:**
    - risk_score: Erosion risk [0, 1]
    - risk_label: High/Medium/Low
    
    **Example:**
    ```
    curl "http://localhost:8000/api/v1/simulate/erosion?sector_id=ATH-001-B&slope_deg=45&rainfall_mm=100"
    ```
    """
    try:
        result = calculate_erosion_risk(sector_id, slope_deg, rainfall_mm)
        return ModelOutput(**result)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Erosion simulation failed"
        )


@app.get("/api/v1/simulate/contaminant", response_model=ModelOutput)
async def simulate_contaminant(
    sector_id: str = Query(..., description="Grid sector ID"),
    flow_direction_deg: float = Query(..., ge=0, le=360, description="Flow direction (0-360°)"),
    water_velocity_ms: float = Query(..., ge=0, le=5, description="Water velocity (m/s)"),
    contamination_level: float = Query(..., ge=0, le=1, description="Contamination level (0-1)")
):
    """
    Simulate contaminant plume tracking based on water flow and contamination level.
    
    **Endpoint:** `GET /api/v1/simulate/contaminant`
    
    **Parameters:**
    - sector_id: Grid cell identifier
    - flow_direction_deg: Water flow direction (0-360°)
    - water_velocity_ms: Flow velocity (0-5 m/s)
    - contamination_level: Hydrocarbon concentration (0-1)
    
    **Output:**
    - contaminant_vector: Direction and velocity of plume movement
    - risk_score: Contamination risk level
    
    **Example:**
    ```
    curl "http://localhost:8000/api/v1/simulate/contaminant?sector_id=ATH-001-C&flow_direction_deg=180&water_velocity_ms=2.5&contamination_level=0.7"
    ```
    """
    try:
        result = calculate_contaminant_vector(
            sector_id, 
            flow_direction_deg, 
            water_velocity_ms, 
            contamination_level
        )
        return ModelOutput(**result)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail="Contaminant simulation failed"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, log_level="info")
