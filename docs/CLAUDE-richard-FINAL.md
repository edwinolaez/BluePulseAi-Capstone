# CLAUDE.md — Richard
## Project Jasper | AI/ML & Simulation Specialist
**Deadline: August 3, 2026**

---

## Who You Are in This Project

You are the **AI/ML & Simulation Specialist**. Your job is to build the brain of the system — the machine learning model that detects post-fire landscape changes, and the mathematical simulations that predict how erosion, rainfall, and contaminants move through the watershed. Your outputs feed directly into the map overlays that SAIT Faculty and CERCUTS will see on demo day. Think of your role like the head cook who determines what the finished dish will taste like — the data pipeline brings in the ingredients, but you turn them into something meaningful.

---

## Your Branch

```
feature/richard-ml
```

- Pull from `develop` before every session
- Open PRs from `feature/richard-ml` → `develop`
- Never push directly to `develop` or `main`

---

## Your Folder

```
/jasper-ml/
├── models/
│   ├── change_detection/
│   │   ├── train.py             ← Model training script
│   │   ├── predict.py           ← Inference / prediction script
│   │   └── model_card.md        ← Accuracy metrics, training details
│   └── simulations/
│       ├── erosion_model.py     ← Rainfall + slope erosion simulation
│       └── contaminant_model.py ← Hydrocarbon plume vector model
├── data/
│   └── sample/                  ← Sample imagery for local dev (not committed if large)
├── api/
│   └── model_endpoint.py        ← FastAPI route exposing model predictions
├── tests/
│   └── test_models.py           ← Your ML accuracy and simulation tests
├── notebooks/
│   └── change_detection_spike.ipynb  ← Exploratory work (Sprint 1)
├── requirements.txt
└── README.md                    ← How to train and run models locally
```

---

## Your Tasks by Sprint

### Sprint 1 — Foundation (June 10–20) | Milestone: M1

- [ ] Set up Python ML environment in `/jasper-ml/`
  - Python 3.11+, scikit-learn, TensorFlow (or PyTorch), NumPy, SciPy, rasterio (for GeoTIFF reading)
  - Pin all versions in `requirements.txt`
- [ ] Create change-detection spike notebook in `/jasper-ml/notebooks/`
  - Load a sample pre/post-fire GeoTIFF image pair
  - Run a basic pixel-difference or ML-based change detection
  - Document what you tried and what worked
- [ ] Deliver ML output schema to Edwin for `/docs/api-contracts.md` by **June 20**:
  - Fields: `risk_score`, `contaminant_vector`, `simulation_type`, `timestamp`, `sector_id`, `model_version`

### Sprint 2 — Core Pipeline (June 23–July 4) | Milestone: M2

- [ ] Train change-detection ML model v1
  - Uses pre/post-fire satellite imagery pairs (GeoTIFF format from Feven's ingest)
  - Model: scikit-learn Random Forest or CNN-based approach
  - Output: burn scar probability score per pixel or per sector
- [ ] Document baseline F1 score in `/jasper-ml/models/change_detection/model_card.md`
  - Include: training dataset description, F1 score, precision, recall, training date
  - This is shown to CERCUTS on demo day — make it readable
- [ ] Write ML accuracy tests in `tests/test_models.py`
  - Test that F1 score meets minimum threshold
  - Test that prediction output matches agreed schema
- [ ] Coordinate with Rahil: confirm how model outputs are stored in PostGIS (sector_id, risk_score, timestamp)

### Sprint 3 — AI & Simulation (July 7–18) | Milestone: M3

- [ ] Build rainfall + erosion simulation model
  - Inputs: DEM terrain data (slope, elevation from Rahil's DB), rainfall intensity parameter
  - Output: erosion risk score (High/Medium/Low) per sector, stored to PostGIS
  - Formula reference: RUSLE or simplified slope-runoff model
- [ ] Build hydrocarbon / contaminant vector tracking model
  - Inputs: water quality telemetry, river flow direction from DEM hydrology
  - Output: contaminant plume movement vectors stored as PostGIS geometry
- [ ] Expose model predictions via FastAPI endpoint in `/jasper-ml/api/model_endpoint.py`
  - `POST /api/v1/predict/change-detection` — takes sector_id, returns risk_score
  - `GET /api/v1/simulate/erosion` — takes sector_id, returns erosion risk zones
  - `GET /api/v1/simulate/contaminant` — takes sector_id, returns plume vectors
  - Coordinate endpoint spec with Reyta (she needs to call these for map overlays)
- [ ] Write tests for all simulation outputs — verify outputs are within expected mathematical range
- [ ] Fix any Semgrep HIGH findings in your code (Edwin runs the sweep)

### Sprint 4 — Hardening & Delivery (July 21–August 1) | Milestones: M4, M5

- [ ] Run final model validation on full dataset
  - Document final F1 score (must be higher than Sprint 2 baseline)
  - Update model card with final metrics
- [ ] Produce accuracy report for CERCUTS:
  - What the model does, how it was trained, what the accuracy numbers mean
  - Write it for a non-technical audience (CERCUTS researchers, not ML engineers)
- [ ] Submit final `model_card.md` to Edwin for inclusion in documentation package
- [ ] Support Edwin during regression test run

---

## Your Daily Routine

```bash
# Start of every session — always do this first
git checkout develop
git pull origin develop
git checkout feature/richard-ml
git merge develop

# Work in small chunks — commit often
git add .
git commit -m "feat: train change-detection model v1, F1=0.82 on test set"

# Push at least once a day
git push origin feature/richard-ml

# When a task is done — open a Pull Request
# Go to GitHub → New Pull Request → feature/richard-ml → develop
# Write: what you built, what accuracy it achieves, how to run it
# Wait for CI to pass before tagging Edwin for review
```

**Commit message format:**
- `feat:` — new model, simulation, or endpoint
- `fix:` — bug fix in model logic or tests
- `test:` — new or updated accuracy tests
- `docs:` — model card updates, README
- `chore:` — environment setup, requirements.txt changes

---

## ML Output Schema (deliver to Edwin by June 20)

This is what your model outputs. Rahil stores it. Reyta displays it. Edwin tests it.

```json
{
  "sector_id": "string",
  "model_version": "string",
  "simulation_type": "change_detection | erosion | contaminant",
  "risk_score": 0.0,
  "risk_label": "High | Medium | Low",
  "contaminant_vector": { "direction_deg": 0.0, "velocity": 0.0 },
  "timestamp": "ISO 8601",
  "confidence": 0.0
}
```

---

## Accuracy Targets

| Model | Metric | Minimum Target | Sprint |
|---|---|---|---|
| Change detection | F1 score | Baseline documented | M2 (July 4) |
| Change detection | F1 score | Improved over baseline | M5 (August 1) |
| Erosion simulation | Output range check | Risk score 0.0–1.0, no NaN | M3 (July 18) |
| Contaminant model | Vector validity | Direction 0–360°, no null vectors | M3 (July 18) |

---

## Testing & Security — How It Works While You Code

Testing and security are not things you do when a model is finished. They run **every single time you push to GitHub**, automatically.

### What happens the moment you push

```
You push your branch
        ↓
GitHub Actions CI pipeline starts automatically
        ↓
Stage 1 — Pylint checks your Python code for errors and bad patterns
Stage 2 — Semgrep scans for security vulnerabilities in your code
        pip-audit checks your requirements.txt for known CVEs
Stage 3 — pytest runs all your tests in /jasper-ml/tests/
Stage 4 — Edwin's integration tests run against your model endpoints
Stage 5 — Build verification
        ↓
All green → Edwin can review your PR
Any red  → You fix it before asking Edwin for review
```

### Your job while vibe coding

Every time you build a model function or simulation, you do two things in the same sitting:

**1. Write the model/simulation code**
**2. Write the test for it immediately after**

```python
# You build this in erosion_model.py:
def calculate_erosion_risk(slope_deg: float, rainfall_mm: float) -> dict:
    risk_score = (slope_deg / 90) * (rainfall_mm / 100)
    risk_score = max(0.0, min(1.0, risk_score))  # clamp to 0–1
    return {"risk_score": risk_score, "risk_label": label(risk_score)}

# You write this in tests/test_models.py in the same session:
def test_erosion_risk_output_range():
    result = calculate_erosion_risk(slope_deg=45.0, rainfall_mm=80.0)
    assert 0.0 <= result["risk_score"] <= 1.0   # never outside range
    assert result["risk_label"] in ["High", "Medium", "Low"]

def test_erosion_risk_no_nan():
    result = calculate_erosion_risk(slope_deg=0.0, rainfall_mm=0.0)
    assert result["risk_score"] == result["risk_score"]  # NaN check

def test_erosion_risk_extreme_inputs():
    result = calculate_erosion_risk(slope_deg=90.0, rainfall_mm=500.0)
    assert result["risk_score"] <= 1.0  # must still clamp correctly
```

Your accuracy tests (F1 score threshold, output range checks) are also tests that run in CI. If a model change breaks the F1 floor, CI catches it before it reaches Edwin.

### What Semgrep catches in your code (automatically)

You don't run Semgrep yourself — Edwin's CI pipeline runs it on every push. But you should know what it looks for:

| What Semgrep flags | What to do instead |
|---|---|
| Hardcoded strings that look like API keys | Use `os.getenv("KEY_NAME")` |
| Returning raw exception messages in API responses | Return `{"error": "Prediction failed"}` — never the stack trace |
| `eval()` or `exec()` calls | Never use these |
| Raw SQL string building | Use Supabase client only |

If Semgrep blocks your PR with a HIGH finding, fix it before tagging Edwin.

---

## Security Rules for Your Code

| Rule | What to do |
|---|---|
| No hardcoded secrets | API keys and DB connection strings go in `.env.local` only |
| No raw SQL | Use Supabase client for all DB writes |
| Pydantic on API endpoint | Your FastAPI model endpoint must validate input with a Pydantic schema |
| Generic error messages | No stack traces in API responses |
| Model endpoint rate-limited | Edwin/Feven configure Kong to rate-limit your endpoints at 20 req/min |

---

## Milestones You Contribute To

| Milestone | Date | Your Exit Criteria |
|---|---|---|
| M1 — Foundation | June 20 | Python environment set up, spike notebook complete, ML output schema delivered |
| M2 — Pipeline Live | July 4 | Change-detection model trained, baseline F1 documented in model card |
| M3 — AI Live | July 18 | Erosion + contaminant simulations producing outputs, model endpoint live, 0 HIGH Semgrep findings |
| M4 — Staging Verified | July 25 | All model endpoints responding on staging URL |
| M5 — Production Live | August 1 | Final model card submitted, accuracy report for CERCUTS complete |

---

## Team Contacts & Branches

| Person | Role | Branch | Folder |
|---|---|---|---|
| Edwin | PM + QA/Security | `feature/edwin-qa` | `/tests`, `/docs` |
| Feven | Data Pipeline & API | `feature/feven-ingest` | `/jasper-backend` |
| Richard (you) | AI/ML & Simulation | `feature/richard-ml` | `/jasper-ml` |
| Reyta | Frontend GIS | `feature/reyta-frontend` | `/jasper-frontend` |
| Rahil | DB & Analytics | `feature/rahil-db` | `/jasper-db` |

---

## Non-Negotiables

- Never commit `.env` or large dataset files — add them to `.gitignore`
- Pull from `develop` before every single coding session
- CI must be green before you ask Edwin to review your PR
- Write tests at the same time as your model code — not after
- If F1 score is not meeting expectations by Sprint 2, tell Edwin immediately — do not wait
- If stuck for 30+ minutes, message Edwin
- Deliver ML output schema to Edwin by **June 20** — Rahil and Reyta are blocked without it
