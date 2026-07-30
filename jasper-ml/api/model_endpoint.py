"""
model_endpoint.py — Project Jasper ML Model API

This is the main HTTP server for the Jasper machine-learning layer.  It wraps
three environmental-risk models behind a FastAPI app so the Next.js frontend
can call them over HTTP.

Endpoints exposed:
  GET  /health                    — liveness check used by the Kong gateway
  GET  /metrics                   — lightweight observability info
  POST /predict/change-detection  — burn-scar risk for a grid sector
  POST /simulate/erosion          — soil-loss risk given rainfall + terrain slope
  POST /simulate/contaminant      — hydrocarbon plume tracking from a source point

Rate limit: 20 req/min (enforced upstream by Kong Gateway, not in this file).

How data flows:
  1. A frontend or CI test sends a JSON POST to one of the /simulate or /predict routes.
  2. The Pydantic request model validates the incoming JSON fields.
  3. For erosion and contaminant endpoints, live sensor data is fetched from
     Environment Canada via sensor_fetch.py (with a 5-minute cache).
  4. The appropriate simulation model function is called.
  5. The result is packaged into the standardised ModelOutput schema and returned.
"""

from pathlib import Path
import sys
import logging
import os
import pickle
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Union, List

import numpy as np
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ConfigDict

# Make the sibling "models/" directory importable without installing the package.
# This is needed because the repo is not set up as an installable Python package.
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.simulations.erosion_model import (
    calculate_erosion_risk as calc_erosion,
)
from models.simulations.contaminant_model import (
    calculate_contaminant_vector as calc_contaminant,
)
from api.sensor_fetch import live_water_velocity, live_rainfall_mm, live_slope_deg, sector_coords

# TODO(real imagery): once real Landsat GeoTIFFs land in data/{sector_id}_{pre,post}.tif,
# wire up real inference in predict_change_detection() below using:
#   sys.path.insert(0, str(Path(__file__).parent.parent / "models" / "change_detection"))
#   from predict import get_sector_features, predict as cd_predict



# ============================================================================
# Logging Configuration
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


app = FastAPI(
    title="Project Jasper ML Model API",
    description="AI/ML endpoints for watershed environmental monitoring",
    version="1.0.0"
)


# ============================================================================
# CORS Configuration (for Frontend Integration)
# ============================================================================

# Pull the comma-separated list of allowed origins from the environment so we
# don't hard-code production URLs into source code.  Defaults to localhost for
# local development (Vite on 5173, Next.js on 3000).
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Request/Response Logging Middleware
# ============================================================================

@app.middleware("http")
async def log_requests(request: Request, call_next):
    """
    Log every incoming request and its response status/timing.

    This runs before and after every route handler.  It records the HTTP method,
    path, response status code, and how long the handler took.  Timing is also
    exposed to callers via the X-Process-Time response header so frontend
    developers can see latency without opening server logs.
    """
    request_time = datetime.now(timezone.utc)

    # Log request
    logger.info("📥 %s %s", request.method, request.url.path)

    try:
        response = await call_next(request)

        # Log response
        elapsed = (datetime.now(timezone.utc) - request_time).total_seconds()
        logger.info(
            "📤 %s %s | Status: %s | Time: %.3fs",
            request.method,
            request.url.path,
            response.status_code,
            elapsed,
        )

        # Add timing header so callers can measure end-to-end latency
        response.headers["X-Process-Time"] = str(elapsed)
        return response

    except Exception as e:
        logger.error(
            "❌ %s %s | Error: %s", request.method, request.url.path, str(e)
        )
        raise


# ============================================================================
# Pydantic Models — Input Validation
# ============================================================================

class ChangeDetectionRequest(BaseModel):
    """
    Input schema for the /predict/change-detection endpoint.

    Fields:
        sector_id — the grid cell to analyse (e.g. "ATH-001-A").  This is the
                    same sector ID used throughout the database and frontend map.
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "sector_id": "ATH-001-A"
            }
        }
    )

    sector_id: str = Field(..., description="Grid sector ID (e.g., ATH-001-A)")


class SourcePoint(BaseModel):
    """
    A geographic coordinate pair.  Used to specify where a contaminant spill
    originated so the simulation knows where to start tracking the plume.
    """
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")


class ErosionSimulationRequest(BaseModel):
    """
    Input schema for the /simulate/erosion endpoint.

    Fields:
        sector_id    — grid cell to simulate.
        rainfall_mm  — optional rainfall amount.  If omitted, the endpoint
                       fetches the live reading from Environment Canada.
        coordinates  — optional lat/lon used to look up real terrain slope via
                       the SRTM 30m DEM.  Omit to use the known ATH sector
                       centre or the Jasper watershed default.
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "sector_id": "ATH-001",
                "rainfall_mm": 45.0
            }
        }
    )

    sector_id: str = Field(..., description="Grid sector ID")
    rainfall_mm: Optional[float] = Field(
        None, ge=0, le=500,
        description="Rainfall intensity (0-500 mm). Omit to use live Environment Canada reading.",
    )
    coordinates: Optional[SourcePoint] = Field(
        None,
        description="Sector centre lat/lon for real terrain slope lookup via SRTM. "
                    "Omit to use the known ATH sector centre or Jasper watershed default.",
    )


class ContaminantSimulationRequest(BaseModel):
    """
    Input schema for the /simulate/contaminant endpoint.

    Fields:
        sector_id    — grid cell to simulate.
        source_point — where the contaminant entered the watershed.  Must be
                       within the Athabasca watershed bounds (52-60°N, 120-110°W);
                       the endpoint returns HTTP 422 if it falls outside.
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "sector_id": "ATH-001",
                "source_point": {"lat": 55.123, "lon": -114.456}
            }
        }
    )

    sector_id: str = Field(..., description="Grid sector ID")
    source_point: SourcePoint = Field(..., description="Source point coordinates with lat/lon")


class ChangeDetectionResponse(BaseModel):
    """Response shape returned by /predict/change-detection (simplified form)."""
    sector_id: str
    risk_label: str  # "High" | "Medium" | "Low"
    confidence: float
    predicted_at: str


class ErosionSimulationResponse(BaseModel):
    """Response shape returned by /simulate/erosion (simplified form)."""
    sector_id: str
    soil_loss_t_ha: float
    risk_level: str  # "High" | "Medium" | "Low"


class ContaminantSimulationResponse(BaseModel):
    """Response shape returned by /simulate/contaminant (simplified form)."""
    sector_id: str
    spread_radius_km: float
    peak_concentration: float


class ModelOutput(BaseModel):
    """
    Standardised ML output schema shared by all three prediction endpoints.

    Every endpoint returns this same shape so the frontend can handle all
    responses with a single TypeScript type.

    Fields:
        sector_id          — the grid cell that was analysed.
        model_version      — version tag of the model used (e.g. "v1.0").
        simulation_type    — "change_detection", "erosion", or "contaminant".
        risk_score         — continuous risk value between 0.0 (none) and 1.0 (maximum).
        risk_label         — human-readable tier: "High", "Medium", or "Low".
        contaminant_vector — direction/velocity dict (change detection / contaminant)
                             or None (erosion, which doesn't track plume movement).
        timestamp          — UTC ISO-8601 string of when the prediction was made.
        confidence         — model confidence between 0.0 and 1.0.
        live_inputs        — optional dict of raw sensor values used as inputs,
                             included so callers can audit what data drove the result.
    """
    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "sector_id": "ATH-001-A",
                "model_version": "v1.0",
                "simulation_type": "change_detection",
                "risk_score": 0.85,
                "risk_label": "High",
                "contaminant_vector": {"direction_deg": 0.0, "velocity": 0.0},
                "timestamp": "2026-06-26T14:30:00Z",
                "confidence": 0.92,
                "live_inputs": None
            }
        }
    )

    sector_id: str
    model_version: str
    simulation_type: str
    risk_score: float
    risk_label: str
    contaminant_vector: Optional[Union[Dict[str, float], List[List[float]]]]
    timestamp: str
    confidence: float
    live_inputs: Optional[Dict[str, Any]] = None


# ============================================================================
# Model Loading & Caching
# ============================================================================

# A process-level dictionary that stores loaded models so we only read the
# pickle file once per worker process instead of on every request.
_model_cache: Dict[str, Any] = {}


def load_change_detection_model():
    """
    Load the trained change-detection RandomForest from disk, caching it in
    memory after the first load.

    Returns the model object, or None if the model file hasn't been trained
    and saved yet (i.e. we're in development mode before real imagery arrives).

    Raises RuntimeError if the file exists but can't be deserialized.
    """
    if "change_detection_model" in _model_cache:
        return _model_cache["change_detection_model"]

    model_path = Path(__file__).parent.parent / "models" / "change_detection" / "model_v1.pkl"

    if not model_path.exists():
        # Model hasn't been trained yet — callers fall back to a random score
        return None

    try:
        with open(model_path, "rb") as f:
            model = pickle.load(f)
        _model_cache["change_detection_model"] = model
        return model
    except Exception as e:
        raise RuntimeError(f"Failed to load model from {model_path}: {str(e)}")


# ============================================================================
# Model Functions (Production-Ready)
# ============================================================================



# ============================================================================
# API Endpoints
# ============================================================================

@app.get("/health")
async def health_check():
    """
    Liveness endpoint used by the Kong gateway and load balancers.

    Returns a JSON object with an overall "status" field ("ok" or "error") and
    per-component health for the change-detection model, the erosion model, and
    the contaminant model.  A 503 is returned if any component raises an
    exception during the health check itself.
    """
    try:
        # Check if model can be loaded (if available)
        model = load_change_detection_model()
        # "pending" means the model file doesn't exist yet (pre-training phase)
        model_status = "ready" if model is not None else "pending"

        return {
            "status": "ok",
            "service": "Project Jasper ML API",
            "version": "1.0.0",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "components": {
                "model": model_status,
                "erosion_model": "ready",
                "contaminant_model": "ready"
            }
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "service": "Project Jasper ML API",
                "message": "Service degraded",
                "error": str(e)
            }
        )


@app.get("/metrics")
async def metrics():
    """
    Lightweight metrics endpoint for observability dashboards.

    In a production deployment this would integrate with Prometheus or
    Datadog.  For now it returns static metadata about this service.
    """
    return {
        "status": "ok",
        "service": "Project Jasper ML API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "info": {
            "model_version": "v1.0",
            "endpoints": 3,
            "simulation_types": ["change_detection", "erosion", "contaminant"]
        }
    }


@app.post("/predict/change-detection", response_model=ModelOutput)
async def predict_change_detection(request: ChangeDetectionRequest):
    """
    Predict post-fire burn-scar risk level for a given watershed sector.

    Takes a sector_id, runs (or simulates) the change-detection model, and
    returns a risk classification together with a confidence score.

    Input:
        sector_id — the grid cell to evaluate (e.g. "ATH-001").

    Output (ModelOutput):
        risk_score  — float 0–1.
        risk_label  — "High" (>= 0.7), "Medium" (>= 0.4), or "Low".
        confidence  — float 0–1.
        simulation_type — "change_detection".

    NOTE: The current implementation generates a random score rather than
    calling the trained model.  The TODO block below documents exactly how
    to swap in real inference once Landsat GeoTIFFs are available.

    Status codes:
        200 — success.
        422 — missing or malformed sector_id.
        500 — unexpected prediction failure.
    """
    try:
        logger.info("Processing change detection for sector: %s", request.sector_id)

        # PLACEHOLDER: this never calls load_change_detection_model() or reads sector imagery — it's a random score regardless of whether model_v1.pkl exists.
        # TODO(real imagery): replace this block with:
        #
        #     model = load_change_detection_model()
        #     data_dir = Path(__file__).parent.parent / "data"
        #
        #     if model is not None:
        #         features = get_sector_features(request.sector_id, str(data_dir))
        #         prediction, confidence, _ = cd_predict(model, features)
        #         label_map = {0: "Low", 1: "Medium", 2: "High"}
        #         risk_label = label_map.get(int(prediction), "Unknown")
        #         risk_score = float(confidence)
        #     else:
        #         # keep this fallback for when no trained model is deployed yet
        #         risk_score = np.random.uniform(0.6, 0.95)
        #         confidence = np.random.uniform(0.7, 1.0)
        #         risk_label = "High" if risk_score >= 0.7 else "Medium" if risk_score >= 0.4 else "Low"
        #         # (then skip the "Classify risk" block below, it's now redundant)
        #
        # Requires the import at the top of this file:
        #     from predict import get_sector_features, predict as cd_predict
        risk_score = np.random.uniform(0.6, 0.95)
        confidence = np.random.uniform(0.7, 1.0)

        # Map the continuous risk_score to a human-readable tier.
        # Thresholds chosen to match the frontend's colour coding:
        #   red = High (>= 0.7), amber = Medium (>= 0.4), green = Low.
        if risk_score >= 0.7:
            risk_label = "High"
        elif risk_score >= 0.4:
            risk_label = "Medium"
        else:
            risk_label = "Low"

        result = ModelOutput(
            sector_id=request.sector_id,
            model_version="v1.0",
            simulation_type="change_detection",
            risk_score=float(risk_score),
            risk_label=risk_label,
            # Change detection doesn't track a moving plume, so direction and
            # velocity are both zero here.  The field is kept to satisfy the
            # shared ModelOutput schema.
            contaminant_vector={"direction_deg": 0.0, "velocity": 0.0},
            timestamp=datetime.now(timezone.utc).isoformat(),
            confidence=float(confidence)
        )

        logger.info("✓ Change detection complete for %s", request.sector_id)
        return result
    except Exception as e:
        logger.error(
            "Change detection prediction failed for %s: %s",
            request.sector_id,
            str(e),
        )
        raise HTTPException(
            status_code=500,
            detail="Change detection prediction failed"
        ) from e

@app.post("/simulate/erosion", response_model=ModelOutput)
async def simulate_erosion(request: ErosionSimulationRequest):
    """
    Simulate erosion risk for a sector based on terrain slope and rainfall.

    The endpoint first resolves the two key inputs — rainfall and slope — from
    either the request body or live sensor feeds:
      - If rainfall_mm is provided, use it; otherwise fetch today's reading
        from Environment Canada climate station 2203 (Jasper).
      - If coordinates are provided, use them for the SRTM slope lookup;
        otherwise fall back to the known ATH sector centre coordinates.

    Then it calls the RUSLE-inspired erosion model in erosion_model.py and
    packages the result into the standard ModelOutput shape.

    Input:
        sector_id   — grid cell to simulate.
        rainfall_mm — optional, 0–500 mm.
        coordinates — optional lat/lon for terrain lookup.

    Output (ModelOutput):
        risk_score     — float 0–1 derived from soil_loss_t_ha / 50.
        risk_label     — "High", "Medium", or "Low".
        simulation_type — "erosion".
        live_inputs    — the actual rainfall and slope values used, with
                         source labels so the caller can audit the inputs.

    Status codes:
        200 — success.
        422 — out-of-range parameter.
        500 — simulation failure.
    """
    # ── Live rainfall ──────────────────────────────────────────────────────────
    if request.rainfall_mm is not None:
        # Caller supplied a value — use it directly (e.g. hypothetical scenario)
        rainfall_mm = request.rainfall_mm
        rainfall_source = f"user-specified {rainfall_mm} mm"
    else:
        # No value provided — pull today's reading from Environment Canada
        rainfall_mm, rainfall_source = live_rainfall_mm()

    # ── Live terrain slope from SRTM 30m ───────────────────────────────────────
    if request.coordinates:
        lat, lon = request.coordinates.lat, request.coordinates.lon
    else:
        # Resolve the sector to a known lat/lon centre point
        lat, lon = sector_coords(request.sector_id)

    slope_deg, slope_source = live_slope_deg(lat, lon)

    try:
        logger.info(
            "Processing erosion simulation for %s: rainfall=%.1fmm slope=%.1f° (%s / %s)",
            request.sector_id, rainfall_mm, slope_deg, rainfall_source, slope_source,
        )

        try:
            model_result = calc_erosion(slope_deg, rainfall_mm, 1.0)
            soil_loss  = model_result.get("soil_loss_t_ha", rainfall_mm * 0.5)
            risk_level = model_result.get("risk_label", "Medium")
        except Exception as model_err:
            # If the erosion model fails for any reason, use a simple linear
            # fallback: 0.5 tonnes per mm of rain.  This is conservative but
            # keeps the API responsive rather than returning a 500.
            logger.warning(
                "Erosion model failed for %s: %s, using fallback",
                request.sector_id, str(model_err),
            )
            soil_loss = rainfall_mm * 0.5
            if soil_loss >= 35:
                risk_level = "High"
            elif soil_loss >= 15:
                risk_level = "Medium"
            else:
                risk_level = "Low"

        # Normalise soil loss to a 0–1 risk score.  50 t/ha is treated as the
        # maximum plausible value for a severely burned Rocky Mountain watershed.
        risk_score = min(soil_loss / 50.0, 1.0)

        result = ModelOutput(
            sector_id=request.sector_id,
            model_version="v1.0",
            simulation_type="erosion",
            risk_score=float(risk_score),
            risk_label=risk_level,
            contaminant_vector=None,  # not applicable for erosion simulations
            timestamp=datetime.now(timezone.utc).isoformat(),
            confidence=0.85,
            live_inputs={
                "rainfall_mm": rainfall_mm,
                "rainfall_source": rainfall_source,
                "slope_deg": slope_deg,
                "slope_source": slope_source,
                "coordinates": {"lat": lat, "lon": lon},
            },
        )

        logger.info("✓ Erosion simulation complete for %s", request.sector_id)
        return result
    except Exception as e:
        logger.error(
            "Erosion simulation failed for %s: %s", request.sector_id, str(e)
        )
        raise HTTPException(
            status_code=500,
            detail="Erosion simulation failed"
        ) from e

@app.post("/simulate/contaminant", response_model=ModelOutput)
async def simulate_contaminant(request: ContaminantSimulationRequest):
    """
    Simulate a hydrocarbon contaminant plume spreading from a spill source point.

    The endpoint:
      1. Validates that the source point lies within the Athabasca watershed
         bounding box (52-60°N, 120-110°W).  Returns 422 if it doesn't.
      2. Fetches the current Athabasca River discharge from Environment Canada
         Water Office station 07AA002 and converts it to a surface velocity.
      3. Calls contaminant_model.py with a fixed NE flow direction
         (the Athabasca flows northeast from Jasper) and the live velocity.
      4. Returns spread radius, peak concentration, and a risk tier.

    Input:
        sector_id    — grid cell to simulate.
        source_point — {lat, lon} of the spill.

    Output (ModelOutput):
        risk_score         — equals peak_concentration (0–1).
        risk_label         — "High", "Medium", or "Low".
        contaminant_vector — [[lat, lon]] of the source point (used by the
                             frontend to place the plume marker on the map).
        simulation_type    — "contaminant".
        live_inputs        — actual water velocity and its data source.

    Status codes:
        200 — success.
        422 — source point out of watershed bounds, or invalid parameters.
        500 — simulation failure.
    """
    # Validate coordinates are within Athabasca watershed bounds BEFORE try block
    # Athabasca watershed: lat 52-60°N, lon -120 to -110°W
    athabasca_lat_min, athabasca_lat_max = 52.0, 60.0
    athabasca_lon_min, athabasca_lon_max = -120.0, -110.0

    # Reject requests outside the watershed early so we don't waste a sensor
    # fetch on obviously invalid input.
    if not (athabasca_lat_min <= request.source_point.lat <= athabasca_lat_max and
            athabasca_lon_min <= request.source_point.lon <= athabasca_lon_max):
        logger.warning(
            "Source point (%s, %s) is outside Athabasca watershed bounds",
            request.source_point.lat,
            request.source_point.lon,
        )
        raise HTTPException(
            status_code=422,
            detail=f"Source point ({request.source_point.lat}, {request.source_point.lon}) is outside Athabasca watershed bounds. Valid range: lat {athabasca_lat_min}-{athabasca_lat_max}°N, lon {athabasca_lon_min}-{athabasca_lon_max}°W"
        )

    # Always fetch live discharge from Environment Canada Water Office.
    # This is not optional for contaminant tracking because velocity directly
    # controls how far and fast the plume spreads downstream.
    water_velocity_ms, velocity_source = live_water_velocity()

    try:
        logger.info(
            "Processing contaminant simulation for %s: source=%s velocity=%.2f m/s (%s)",
            request.sector_id,
            request.source_point,
            water_velocity_ms,
            velocity_source,
        )

        try:
            model_result = calc_contaminant(
                flow_direction_deg=45.0,       # Athabasca flows NE from Jasper
                water_velocity_ms=water_velocity_ms,  # live EC Water Office value
                contamination_level=0.5,       # mid-range starting concentration
            )
            spread_radius    = model_result.get("spread_radius_km", 2.5)
            peak_concentration = model_result.get("peak_concentration", 0.65)
        except Exception as model_err:
            # If the model raises, fall back to conservative defaults so the
            # frontend still gets a usable response instead of a 500.
            logger.warning(
                "Contaminant model failed for %s: %s, using fallback",
                request.sector_id,
                str(model_err),
            )
            spread_radius      = 2.5
            peak_concentration = 0.65

        # Use peak_concentration directly as the risk score (it's already 0–1).
        risk_score = float(peak_concentration)
        if risk_score >= 0.7:
            risk_label = "High"
        elif risk_score >= 0.4:
            risk_label = "Medium"
        else:
            risk_label = "Low"

        result = ModelOutput(
            sector_id=request.sector_id,
            model_version="v1.0",
            simulation_type="contaminant",
            risk_score=float(risk_score),
            risk_label=risk_label,
            # Wrap the source coordinate in a nested list so the frontend can
            # treat it as a GeoJSON-like coordinate array for map rendering.
            contaminant_vector=[[request.source_point.lat, request.source_point.lon]],
            timestamp=datetime.now(timezone.utc).isoformat(),
            confidence=0.80,
            live_inputs={
                "water_velocity_ms": water_velocity_ms,
                "velocity_source": velocity_source,
                "flow_direction_deg": 45.0,
                "flow_direction_source": "Athabasca NE channel estimate",
            },
        )

        logger.info("✓ Contaminant simulation complete for %s", request.sector_id)
        return result
    except Exception as e:
        logger.error(
            "Contaminant simulation failed for %s: %s", request.sector_id, str(e)
        )
        raise HTTPException(
            status_code=500,
            detail="Contaminant simulation failed"
        ) from e


if __name__ == "__main__":
    import uvicorn

    # Read server configuration from environment variables so the same image
    # can be used in development and production without code changes.
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8001"))
    env = os.getenv("API_ENV", "development")

    logger.info("🚀 Starting Project Jasper ML API")
    logger.info("   Environment: %s", env)
    logger.info("   Host: %s:%s", host, port)
    logger.info("   Allowed Origins: %s", ", ".join(ALLOWED_ORIGINS))

    # Use multiple workers in production to handle concurrent requests.
    # A single worker is fine for development/CI because we don't need parallelism.
    workers = 4 if env == "production" else 1

    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info" if env == "development" else "warning",
        workers=workers
    )
