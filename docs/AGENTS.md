# Project Jasper — AI Agent Architecture
## AGENTS.md | Owner: Edwin Olaez (PM/QA)

---

## What This Document Covers

Project Jasper uses three AI/ML models, each built by Richard.
This document explains what each model does, what data it needs,
what it produces, and how it connects to the rest of the system.

Think of this as the "AI section" of the technical manual — written so
that SAIT Faculty and CERCUTS reviewers can understand the system
without needing a machine learning background.

---

## System Overview

Here is how a single data point flows through the entire Jasper system:

```
Satellite / Sensor Data
        |
        v
[1] Feven's Ingest Pipeline (FastAPI)
    - Receives the raw data
    - Validates it matches the schema
    - Stores it in Supabase PostGIS (Rahil's DB)
        |
        v
[2] Richard's ML Models (Python / scikit-learn / TensorFlow)
    - Change Detection Model: detects burn scars
    - Erosion Simulation: predicts soil loss risk
    - Contaminant Simulation: models hydrocarbon spread
        |
        v
[3] Rahil's Convex Real-Time DB
    - Receives model results instantly
    - Pushes live updates to the frontend
        |
        v
[4] Reyta's Frontend Dashboard (Next.js + React-Leaflet)
    - Displays risk overlays on the watershed map
    - Shows live water quality readings
    - Colour-codes sectors by risk level
```

---

## Agent 1: Change Detection Model

**Owner:** Richard
**File location:** `jasper-ml/models/change_detection.py`
**API endpoint:** `POST /predict/change-detection`

### What it does

Compares two satellite images of the same area taken at different times.
It detects what has changed — specifically looking for burn scars left
by wildfires in the Athabasca watershed.

Imagine holding two aerial photos of the same forest side by side:
one from before a wildfire, one from after. This model automatically
highlights all the areas that turned from green to black.

### Input (what it needs)

```json
{
  "sector_id": "ATH-001",
  "imagery_date": "2026-06-25"
}
```

The model pulls the before/after GeoTIFF satellite images from Supabase.

### Output (what it returns)

```json
{
  "simulation_type": "change_detection",
  "sector_id": "ATH-001",
  "risk_score": 0.87,
  "contaminant_vector": null,
  "confidence": 0.92,
  "timestamp": "2026-06-25T12:00:00Z",
  "model_version": "1.0.0"
}
```

- `risk_score`: 0.0 = no change detected, 1.0 = severe burn scar
- `confidence`: how certain the model is (1.0 = 100% certain)
- `contaminant_vector`: null for this model (only used in contaminant simulation)

### How it works (simplified)

1. Loads two raster images using `rasterio`
2. Subtracts the before image from the after image pixel by pixel
3. Classifies the difference using a Random Forest classifier (`scikit-learn`)
4. Returns the fraction of the sector that has changed as the risk score

### Training data

- USGS Landsat 8 imagery of the Athabasca region (2020–2025)
- Manual burn scar labels provided by CERCUTS

### Performance target

- P95 response time < 500ms
- F1 score > 0.75 on the validation set (Sprint 4 target)

---

## Agent 2: Erosion Risk Simulation

**Owner:** Richard
**File location:** `jasper-ml/models/erosion_simulation.py`
**API endpoint:** `POST /simulate/erosion`

### What it does

After a wildfire burns away ground cover (grass, roots, leaf litter),
the bare soil becomes vulnerable to washing away in rain.
This model predicts how much soil will erode from each sector
given a rainfall event.

Think of it like predicting which hills will become mudslides
after the fire removes all the plant roots holding the soil together.

### Input

```json
{
  "sector_id": "ATH-001",
  "rainfall_mm": 45.0
}
```

### Output

```json
{
  "simulation_type": "erosion",
  "sector_id": "ATH-001",
  "risk_score": 0.73,
  "contaminant_vector": null,
  "confidence": 0.88,
  "timestamp": "2026-06-25T12:00:00Z",
  "model_version": "1.0.0"
}
```

- `risk_score`: 0.0 = stable terrain, 1.0 = high erosion risk
- Sectors scoring above 0.6 are flagged on Reyta's map as orange/red

### How it works (simplified)

Uses the **RUSLE formula** (Revised Universal Soil Loss Equation),
a standard environmental engineering model:

```
soil_loss = R × K × LS × C × P
```

Where each factor accounts for: rainfall intensity, soil type,
slope steepness, vegetation cover, and erosion control measures.

The model gets terrain data from Supabase PostGIS (elevation rasters)
and fire severity from the Change Detection model's output.

### Performance target

- P95 response time < 500ms

---

## Agent 3: Contaminant Spread Simulation

**Owner:** Richard
**File location:** `jasper-ml/models/contaminant_simulation.py`
**API endpoint:** `POST /simulate/contaminant`

### What it does

When a wildfire burns through an area with historical oil and gas
infrastructure, it can release hydrocarbons into the soil and water.
This model simulates how those contaminants spread through the
Athabasca watershed over time.

Think of it like a time-lapse animation of an ink drop spreading
through water — except the "ink" is petroleum and the "water"
is the watershed's river network.

### Input

```json
{
  "sector_id": "ATH-001",
  "source_point": {
    "lat": 56.7267,
    "lon": -111.3790
  }
}
```

### Output

```json
{
  "simulation_type": "contaminant",
  "sector_id": "ATH-001",
  "risk_score": 0.65,
  "contaminant_vector": [0.12, 0.34, 0.56, 0.48, 0.29],
  "confidence": 0.81,
  "timestamp": "2026-06-25T12:00:00Z",
  "model_version": "1.0.0"
}
```

- `contaminant_vector`: a list of concentrations at downstream monitoring points
  (used by Reyta's map to draw the spread animation)
- `risk_score`: overall contamination severity for the sector

### How it works (simplified)

Uses SciPy's ODE (Ordinary Differential Equation) solver to model
contaminant transport through the watershed network.
The river network topology is stored in Supabase PostGIS.

### Performance target

- P95 response time < 500ms (this is the hardest target due to ODE solving)

---

## Data Flow Between Agents

The three models are designed to work in sequence:

```
Step 1: Change Detection
  → Identifies which sectors are burned
  → risk_score passed to Step 2

Step 2: Erosion Simulation
  → Uses burn severity from Step 1
  → High burn + high rainfall = high erosion risk

Step 3: Contaminant Simulation
  → Uses erosion risk from Step 2 to weight spread velocity
  → High erosion = faster contaminant transport
```

This chain is triggered automatically after each satellite imagery ingest.

---

## Model Versioning

Richard's `model_version` field in every response allows us to:
1. Track which model produced which prediction
2. Roll back to an older model if a new one has lower accuracy
3. Compare predictions from different model versions in the dashboard

Model versions follow **semantic versioning**: `1.0.0`, `1.1.0`, etc.
Richard documents each version in `jasper-ml/model_card.md`.

---

## Security Notes (Edwin)

- Model endpoints are behind Kong Gateway — require API key
- Kong rate limit on model endpoints: 20 requests/minute (prevents DoS)
- No user data is stored in model files — only weights and config
- Model inputs are validated by Pydantic before reaching the model

---

## Glossary

| Term | Plain English |
|---|---|
| GeoTIFF | A satellite image format that includes location coordinates |
| Raster | An image made of pixels, where each pixel has a value (e.g. elevation) |
| PostGIS | An extension to PostgreSQL that understands geographic shapes and locations |
| RUSLE | A standard formula used by environmental engineers to predict soil erosion |
| ODE | A math equation describing how something changes over time (used for spread simulation) |
| P95 | 95th percentile — "95% of requests are faster than this" |
| F1 Score | A measure of model accuracy (1.0 = perfect, 0.0 = random guessing) |
| Risk Score | A number from 0.0 to 1.0 representing the severity of a detected risk |

---

*Owner: Edwin Olaez | Last updated: June 25, 2026*
