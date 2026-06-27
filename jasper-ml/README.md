# Project Jasper — ML Module

## AI/ML & Simulation for Post-Wildfire Environmental Monitoring

**Project Lead:** Richard (AI/ML Specialist)  
**Demo Day:** August 3, 2026  
**Status:** Sprint 1 Foundation Complete ✅

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

| Sprint             | Dates        | Status    | Deliverables                                   |
| ------------------ | ------------ | --------- | ---------------------------------------------- |
| **1 — Foundation** | Jun 10-20    | ✅ DONE   | Spike notebook, ML schema, model card template |
| **2 — Pipeline**   | Jun 23-Jul 4 | ⏳ TODO   | Train v1 model, accuracy tests, PostGIS schema |
| **3 — AI Live**    | Jul 7-18     | ⏳ TODO   | Erosion + contaminant sims, API endpoints      |
| **4 — Hardening**  | Jul 21-Aug 1 | ⏳ TODO   | Final validation, CERCUTS report               |
| **5 — Demo**       | Aug 3        | 🎯 TARGET | Demonstration to SAIT Faculty & CERCUTS        |

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

## API Endpoints (Sprint 3+)

### Change Detection

```bash
curl -X POST http://localhost:8001/api/v1/predict/change-detection \
  -H "Content-Type: application/json" \
  -d '{"sector_id": "ATH-001-A"}'
```

### Erosion Risk

```bash
curl "http://localhost:8001/api/v1/simulate/erosion?sector_id=ATH-001-B&slope_deg=45&rainfall_mm=100"
```

### Contaminant Tracking

```bash
curl "http://localhost:8001/api/v1/simulate/contaminant?sector_id=ATH-001-C&flow_direction_deg=180&water_velocity_ms=2.5&contamination_level=0.7"
```

---

## Testing

```bash
# Run all tests
pytest tests/test_models.py -v

# Test specific category
pytest tests/test_models.py::test_risk_score_range -v

# With coverage
pytest tests/test_models.py --cov=models --cov=api
```

**Key test categories:**

- ✅ Schema validation (outputs match ML_OUTPUT_SCHEMA.md)
- ✅ Range constraints (risk_score ∈ [0,1], direction ∈ [0,360))
- ✅ Edge cases (NaN handling, boundary values)
- ✅ Integration (end-to-end prediction to JSON)

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
