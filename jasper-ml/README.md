# Project Jasper — ML Module

## AI/ML & Simulation for Post-Wildfire Environmental Monitoring

**Project Lead:** Richard (AI/ML Specialist)  
**Demo Day:** August 3, 2026  
**Status:** Sprint 3 API Integration In Progress 🚀

---

## Overview

The `jasper-ml` module contains all machine learning models, simulations, and inference APIs for Project Jasper. It detects post-fire landscape changes, predicts erosion risk, and tracks contaminant movement in the Athabasca watershed.

### What This Module Builds

1. **Change Detection Model** — Identifies burn scars in satellite imagery (Random Forest)
2. **Erosion Simulation** — Predicts erosion risk from slope + rainfall (RUSLE-inspired)
3. **Contaminant Tracking** — Models hydrocarbon plume movement (flow + concentration)

All outputs follow a unified [ML Output Schema](ML_OUTPUT_SCHEMA.md) for seamless integration with the database (Rahil) and frontend (Reyta).

---

## Quick Start

### 1. Activate Virtual Environment

```bash
cd jasper-ml
source ml-env/bin/activate  # macOS/Linux
# ml-env\Scripts\activate    # Windows
```

### 2. Run Spike Notebook (Sprint 1 Complete)

```bash
jupyter notebook notebooks/change_detection_spike.ipynb
```

This notebook demonstrates:

- ✅ Loading and preprocessing satellite imagery
- ✅ Training baseline Random Forest model
- ✅ Evaluating F1 score, precision, recall (baseline: F1=0.80)
- ✅ Building erosion and contaminant simulations
- ✅ Validating output schema

### 3. Run Tests

```bash
pytest tests/test_models.py -v
```

### 4. Start API Server (Sprint 3+)

```bash
python -m uvicorn api.model_endpoint:app --reload --port 8001
```

Then visit: `http://localhost:8001/docs` for interactive API documentation.

---

## Folder Structure

```
jasper-ml/
├── models/
│   ├── change_detection/
│   │   ├── train.py              ← Training script (Sprint 2)
│   │   ├── predict.py            ← Inference script
│   │   ├── model_v1.pkl          ← Trained model (Sprint 2)
│   │   └── model_card.md         ← Model documentation
│   └── simulations/
│       ├── erosion_model.py      ← RUSLE erosion calculation
│       └── contaminant_model.py  ← Plume tracking
├── api/
│   └── model_endpoint.py         ← FastAPI server (production)
├── tests/
│   └── test_models.py            ← Unit & integration tests
├── notebooks/
│   └── change_detection_spike.ipynb  ← Spike analysis (DONE ✅)
├── data/
│   └── sample/                   ← Sample imagery
├── requirements.txt              ← Dependencies (already installed)
├── ML_OUTPUT_SCHEMA.md           ← Standardized output format
└── README.md                     ← This file
```

---

## Sprint Timeline & Status

| Sprint             | Dates        | Status    | Deliverables                                                 |
| ------------------ | ------------ | --------- | ------------------------------------------------------------ |
| **1 — Foundation** | Jun 10-20    | ✅ DONE   | Spike notebook, ML schema, test suite (20+ tests)            |
| **2 — Pipeline**   | Jun 23-Jul 4 | ✅ DONE   | Trained model v1, accuracy tests (F1 >= 0.75), data pipeline |
| **3 — API Live**   | Jul 7-18     | 🚀 ACTIVE | API endpoints, erosion + contaminant sims, integration tests |
| **4 — Hardening**  | Jul 21-Aug 1 | ⏳ TODO   | Final validation, CERCUTS report                             |
| **5 — Demo**       | Aug 3        | 🎯 TARGET | Demonstration to SAIT Faculty & CERCUTS                      |

### Sprint 3 (Current) — API Integration ✅

**Completed:**

- ✅ FastAPI endpoints fully integrated with production models
- ✅ Erosion simulation (RUSLE-inspired) integrated and tested
- ✅ Contaminant tracking model integrated and tested
- ✅ Change detection model loading mechanism (ready for trained model)
- ✅ Comprehensive API test suite: 23 endpoint tests, all passing
- ✅ Full schema validation and error handling
- ✅ Per-request rate limiting headers ready for Kong Gateway
- ✅ 45/45 total tests passing (22 model + 23 API)

**Status:** Ready for staging deployment

---

## ML Output Schema

All model outputs follow this standardized structure (delivered to Edwin):

```json
{
  "sector_id": "ATH-001-A",
  "model_version": "v1.0",
  "simulation_type": "change_detection | erosion | contaminant",
  "risk_score": 0.85,
  "risk_label": "High | Medium | Low",
  "contaminant_vector": {
    "direction_deg": 0.0,
    "velocity": 0.65
  },
  "timestamp": "2026-06-26T14:30:00Z",
  "confidence": 0.92
}
```

📖 **Full documentation:** [ML_OUTPUT_SCHEMA.md](ML_OUTPUT_SCHEMA.md)

---

## API Endpoints (Sprint 3 ✅)

All endpoints return standardized [ML_OUTPUT_SCHEMA.md](ML_OUTPUT_SCHEMA.md) format. Rate limited to 20 req/min by Kong Gateway.

### Health Check

```bash
curl http://localhost:8001/health
```

Response: `{"status": "ok", "service": "Project Jasper ML API"}`

### 1. Change Detection Prediction

**Endpoint:** `POST /api/v1/predict/change-detection`

Predict post-fire burn scar risk for a given sector.

```bash
curl -X POST http://localhost:8001/api/v1/predict/change-detection \
  -H "Content-Type: application/json" \
  -d '{"sector_id": "ATH-001-A"}'
```

**Response:**

```json
{
  "sector_id": "ATH-001-A",
  "model_version": "v1.0",
  "simulation_type": "change_detection",
  "risk_score": 0.82,
  "risk_label": "High",
  "contaminant_vector": { "direction_deg": 0.0, "velocity": 0.0 },
  "timestamp": "2026-06-26T14:30:00Z",
  "confidence": 0.88
}
```

### 2. Erosion Risk Simulation

**Endpoint:** `GET /api/v1/simulate/erosion`

Simulate erosion risk based on terrain and rainfall.

**Parameters:**

- `sector_id` (string): Grid sector ID (e.g., ATH-001-B)
- `slope_deg` (float): Terrain slope [0-90]°
- `rainfall_mm` (float): Rainfall intensity [0-500]mm

```bash
curl "http://localhost:8001/api/v1/simulate/erosion?sector_id=ATH-001-B&slope_deg=45&rainfall_mm=100"
```

**Response:**

```json
{
  "sector_id": "ATH-001-B",
  "model_version": "v1.0",
  "simulation_type": "erosion",
  "risk_score": 0.67,
  "risk_label": "Medium",
  "contaminant_vector": { "direction_deg": 0.0, "velocity": 0.0 },
  "timestamp": "2026-06-26T14:30:00Z",
  "confidence": 0.85
}
```

### 3. Contaminant Plume Tracking

**Endpoint:** `GET /api/v1/simulate/contaminant`

Model hydrocarbon plume movement through watersheds.

**Parameters:**

- `sector_id` (string): Grid sector ID
- `flow_direction_deg` (float): Water flow direction [0-360]°
- `water_velocity_ms` (float): Flow velocity [0-5]m/s
- `contamination_level` (float): Hydrocarbon concentration [0-1]

```bash
curl "http://localhost:8001/api/v1/simulate/contaminant?sector_id=ATH-001-C&flow_direction_deg=180&water_velocity_ms=2.5&contamination_level=0.7"
```

**Response:**

```json
{
  "sector_id": "ATH-001-C",
  "model_version": "v1.0",
  "simulation_type": "contaminant",
  "risk_score": 0.7,
  "risk_label": "High",
  "contaminant_vector": {
    "direction_deg": 180.0,
    "velocity": 0.65
  },
  "timestamp": "2026-06-26T14:30:00Z",
  "confidence": 0.7
}
```

### API Documentation

Interactive API docs available at:

```
http://localhost:8001/docs           # Swagger UI
http://localhost:8001/redoc          # ReDoc
```

---

## Running the API Server

### Start Development Server

```bash
# Terminal 1: Start the API
python -m uvicorn api.model_endpoint:app --reload --port 8001

# Terminal 2: Make requests
curl http://localhost:8001/health
```

### Test API Endpoints

```bash
# Run API integration tests
pytest tests/test_api.py -v

# Test specific endpoint
pytest tests/test_api.py::test_change_detection_endpoint_valid_request -v

# Test with coverage
pytest tests/test_api.py --cov=api
```

**API Test Coverage:**

- ✅ 23 endpoint tests (health check, all 3 simulation endpoints)
- ✅ Input validation (Pydantic constraints enforced)
- ✅ Output ranges (risk_score ∈ [0,1], angles ∈ [0,360))
- ✅ Error handling (missing fields, invalid values)
- ✅ Schema compliance (all outputs match ML_OUTPUT_SCHEMA.md)
- ✅ Response times (all < 1 second)

---

## Testing

```bash
# Run all tests (model + API)
pytest tests/ -v

# Run only model tests
pytest tests/test_models.py -v

# Run only API tests
pytest tests/test_api.py -v

# Run specific test
pytest tests/test_models.py::test_risk_score_range -v

# With coverage report
pytest tests/ --cov=models --cov=api --cov-report=html
```

**Test Suite Status:**

- ✅ 22 model tests (Sprint 1-2): All passing
- ✅ 23 API tests (Sprint 3): All passing
- ✅ **Total: 45/45 passing** ✅

**Key test categories:**

- ✅ Schema validation (outputs match ML_OUTPUT_SCHEMA.md)
- ✅ Range constraints (risk_score ∈ [0,1], direction ∈ [0,360))
- ✅ Edge cases (NaN handling, boundary values, extreme inputs)
- ✅ Integration tests (end-to-end workflows)
- ✅ Performance (all API responses < 1 second)
- ✅ Error handling (invalid inputs properly rejected)

---

## Daily Workflow

```bash
# Before every session
git checkout develop && git pull origin develop
git checkout feature/richard-ml && git merge develop
source ml-env/bin/activate

# Do your work
# ... edit models, run tests ...

# Commit often
git add models/ tests/
git commit -m "feat: train erosion model, F1=0.85"

# Run tests before pushing
pytest tests/test_models.py -v

# Push
git push origin feature/richard-ml

# When done: open PR on GitHub (feature/richard-ml → develop)
```

---

## Key Files

| File                                                                               | Purpose                  | Status      |
| ---------------------------------------------------------------------------------- | ------------------------ | ----------- |
| [ML_OUTPUT_SCHEMA.md](ML_OUTPUT_SCHEMA.md)                                         | Standardized JSON schema | ✅ Done     |
| [models/change_detection/model_card.md](models/change_detection/model_card.md)     | Model documentation      | ✅ Template |
| [notebooks/change_detection_spike.ipynb](notebooks/change_detection_spike.ipynb)   | Spike analysis           | ✅ Complete |
| [tests/test_models.py](tests/test_models.py)                                       | Test suite               | ✅ Ready    |
| [api/model_endpoint.py](api/model_endpoint.py)                                     | FastAPI server           | ✅ Skeleton |
| [models/simulations/erosion_model.py](models/simulations/erosion_model.py)         | Erosion sim              | ✅ Ready    |
| [models/simulations/contaminant_model.py](models/simulations/contaminant_model.py) | Contaminant sim          | ✅ Ready    |

---

## Environment

**Python:** 3.13.7 (minimum 3.11)  
**Virtual Env:** `ml-env/` (already created)  
**Dependencies:** Listed in `requirements.txt`

### Key Packages

- **scikit-learn 1.9.0** — ML models
- **TensorFlow 2.21.0** — Deep learning
- **rasterio 1.5.0** — GeoTIFF handling
- **FastAPI 0.138.1** — API framework
- **NumPy 2.5.0** — Numerical computing
- **pytest 9.1.1** — Testing

All packages already installed during initial setup.

---

## Documentation

- 📖 [ML Output Schema](ML_OUTPUT_SCHEMA.md) — Read this first
- 📖 [Model Card](models/change_detection/model_card.md) — Understanding model performance
- 📖 [Spike Notebook](notebooks/change_detection_spike.ipynb) — Full worked example
- 📖 [Test Suite](tests/test_models.py) — Testing patterns

---

## Team Integration

**Feven (Data Pipeline):** Provides pre/post-fire imagery  
**Rahil (Database):** Stores outputs in PostGIS  
**Reyta (Frontend):** Displays on map overlay  
**Edwin (QA):** Validates in CI pipeline

---

## Next Steps

✅ **Sprint 1:** Spike complete, schema defined, foundation ready  
⏳ **Sprint 2:** Train on real imagery, document F1 score  
⏳ **Sprint 3:** API endpoints live, integrations tested  
⏳ **Sprint 4:** Production hardening, demo prep  
🎯 **August 3:** Demo day!

---

## Questions?

- **ML questions?** Check spike notebook or model_card.md
- **API questions?** Run FastAPI server, visit /docs endpoint
- **Schema questions?** Read ML_OUTPUT_SCHEMA.md
- **Issues?** Create GitHub issue on feature/richard-ml branch

---

_Last Updated: 2026-06-26_  
_Next Review: 2026-07-04 (M2 Milestone)_
