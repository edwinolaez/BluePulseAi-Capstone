# CI Feedback — Richard (jasper-ml)

**From:** Edwin (QA)
**Date:** July 6, 2026
**CI Run:** #65 / #66 on `develop`

---

## Summary

CI is now reaching Stage 4 (Integration Tests) for the first time. The Railway backend
is reachable, but all three of your ML endpoints are returning 404. The tests can't
find them at the expected paths. There are also code quality issues in Stage 1 and
Stage 2 to clean up before M4.

---

## 1. ML Endpoints Not Found (Stage 4 — Integration Tests)

All three ML endpoints return `{"detail": "Not Found"}` on Railway:

| Endpoint | Expected | Got |
|---|---|---|
| `POST /predict/change-detection` | 200 + prediction JSON | 404 |
| `POST /simulate/erosion` | 200 + simulation JSON | 404 |
| `POST /simulate/contaminant` | 200 + simulation JSON | 404 |

**What to check:**

1. **Are the ML routes registered?** Confirm these exact paths exist in your FastAPI router:
   - `/predict/change-detection`
   - `/simulate/erosion`
   - `/simulate/contaminant`

2. **Is the ML service deployed to Railway?** The tests hit `RAILWAY_API_URL` which is Feven's backend. Are your routes mounted there, or is your ML service a separate deployment?
   - If separate: tell Edwin the URL so he can add `ML_API_URL` as a secret.
   - If same app: confirm the routes are registered and the Railway deploy is current.

3. **Quick check:**
   ```bash
   curl -X POST https://bluepulseai-capstone-production.up.railway.app/predict/change-detection \
     -H "Content-Type: application/json" \
     -H "X-API-Key: jasper-dev-api-key-202" \
     -d '{"sector_id": "ATH-001"}'
   ```
   If that returns 404, the route is either not deployed or at a different path.

---

## 2. Expected Request/Response Format

Here's exactly what the tests send and expect — make sure your endpoints match:

### `POST /predict/change-detection`
```json
// Request body
{
  "sector_id": "ATH-001"
}

// Expected response (200)
{
  "sector_id": "ATH-001",
  "risk_label": "High" | "Medium" | "Low",   // Title Case
  "confidence": 0.0–1.0,
  "predicted_at": "<ISO timestamp>"
}
```

### `POST /simulate/erosion`
```json
// Request body
{
  "sector_id": "ATH-001",
  "rainfall_mm": 45.0
}

// Expected response (200)
{
  "sector_id": "ATH-001",
  "soil_loss_t_ha": <float>,
  "risk_level": "High" | "Medium" | "Low"
}
```

### `POST /simulate/contaminant`
```json
// Request body
{
  "sector_id": "ATH-001",
  "source_point": [55.123, -114.456]
}

// Expected response (200)
{
  "sector_id": "ATH-001",
  "spread_radius_km": <float>,
  "peak_concentration": <float>
}
```

---

## 3. Code Quality — Pylint (Stage 1)

Your Python files in `jasper-ml` scored below 7.0/10 on Pylint.

**How to check locally:**
```bash
cd jasper-ml
pip install pylint
pylint $(find . -name '*.py' | head -20) --fail-under=7.0
```

Common quick fixes: add docstrings, remove unused imports, fix line length (max 100 chars), rename single-letter variables.

**Target:** Score ≥ 7.0 before M4 (July 25).

---

## 4. Dependency Vulnerabilities — pip-audit (Stage 2)

`pip-audit` found vulnerable packages in `jasper-ml/requirements.txt`.

**How to check locally:**
```bash
cd jasper-ml
pip install pip-audit
pip-audit -r requirements.txt
```

Update flagged packages to patched versions. For ML libraries (numpy, scipy, scikit-learn) check if a patched version exists before upgrading — some ML libs have breaking changes between minor versions.

**Target:** Zero high-severity findings before M5 (Production Live, August 1).

---

## 5. Security Findings — Semgrep (Stage 2)

Semgrep found security issues in your Python code. Edwin will share the
`semgrep-report.json` artifact from the CI run — look for entries where
`path` starts with `jasper-ml/`.

Common findings to look for:
- Hardcoded file paths or model paths that should be env vars
- Use of `pickle.load` without signature verification (common in ML code)
- Unvalidated input passed to numpy/pandas operations

**Target:** Zero `ERROR`-severity findings before M4.

---

## Next Steps

1. Confirm whether ML routes are in Feven's Railway app or a separate service
2. If separate service: share the URL with Edwin → he'll add `ML_API_URL` as a CI secret
3. Fix the route paths to match the expected endpoints above
4. Redeploy and ping Edwin — he'll re-run CI to confirm
5. Run Pylint and pip-audit locally when you get a chance (not urgent, but before M4)
