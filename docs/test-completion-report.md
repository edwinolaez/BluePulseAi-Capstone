# Project Jasper — Test Completion Report
## Formal SAIT Faculty Deliverable | M5: August 1, 2026
**Submitted by:** Edwin Olaez, PM + Lead QA/Security Engineer
**Project:** Project Jasper — Post-Wildfire Environmental Monitoring Platform
**Team:** Edwin Olaez, Feven [Last], Richard [Last], Reyta [Last], Rahil [Last]
**Institution:** SAIT (Southern Alberta Institute of Technology)
**Demo Date:** August 3, 2026

---

> **Purpose:** This report is a formal deliverable to SAIT Faculty documenting the complete
> testing performed on Project Jasper. It covers test coverage, security validation,
> performance benchmarks, and the go-live verification checklist.
> All items must be signed off by Edwin before the M5 production deploy.

---

## 1. Executive Summary

| Metric | Target | Actual | Status |
|---|---|---|---|
| Backend test coverage | ≥ 80% | ____% | `[ ] MET  [ ] NOT MET` |
| Frontend test coverage | ≥ 75% | ____% | `[ ] MET  [ ] NOT MET` |
| API endpoints contract-tested | 100% | ____% | `[ ] MET  [ ] NOT MET` |
| Semgrep HIGH findings | 0 | ____ | `[ ] MET  [ ] NOT MET` |
| Unpatched HIGH CVEs | 0 | ____ | `[ ] MET  [ ] NOT MET` |
| Integration tests passing | 100% | ____% | `[ ] MET  [ ] NOT MET` |
| Lighthouse Performance (staging) | ≥ 85 | ____ | `[ ] MET  [ ] NOT MET` |
| Lighthouse Accessibility (staging) | ≥ 90 | ____ | `[ ] MET  [ ] NOT MET` |
| API P95 response time | < 500ms | ____ms | `[ ] MET  [ ] NOT MET` |
| ML model F1 score | ≥ 0.75 | ____ | `[ ] MET  [ ] NOT MET` |

---

## 2. Test Suite Overview

### 2.1 Test Files and Scope

| File | Sprint | Scope | Tests Written | Tests Passing |
|---|---|---|---|---|
| `tests/test_health.py` | Sprint 1 | Backend liveness + Kong auth | 5 | ___ |
| `tests/test_api_contracts.py` | Sprint 1 | API contract shape validation (6 contracts) | 14 | ___ |
| `tests/test_rbac.py` | Sprint 1 | Role-based access control (4 roles) | 10 | ___ |
| `tests/test_e2e_pipeline.py` | Sprint 2 | E2E ingest → DB → API → frontend | 12 | ___ |
| `tests/test_convex_integration.py` | Sprint 2 | Convex queries + mutations (Contracts 4+5) | 11 | ___ |
| `tests/test_ml_integration.py` | Sprint 3 | ML model integration + performance | 16 | ___ |
| `tests/benchmark_api.py` | Sprint 3 | P95 performance benchmarks | 5 | ___ |
| **TOTAL** | | | **73** | ___ |

### 2.2 Test Run Command

```bash
cd tests
pytest --tb=short -v --cov=../jasper-backend --cov-report=html > test-run-output.txt 2>&1
```

### 2.3 Final CI Run

| Field | Value |
|---|---|
| Branch tested | `main` |
| Git SHA | _______________ |
| Run date | _______________ |
| GitHub Actions run URL | _______________ |
| CI stages passed | `[ ] Stage 1 Lint  [ ] Stage 2 Security  [ ] Stage 3 Unit  [ ] Stage 4 Integration  [ ] Stage 5 Build  [ ] Stage 6 Performance` |

---

## 3. Code Coverage

### 3.1 Backend Coverage (jasper-backend)

**Tool:** pytest-cov | **Target:** ≥ 80%

| Module | Lines | Covered | Coverage% |
|---|---|---|---|
| `main.py` (FastAPI app) | | | |
| `routes/ingest.py` | | | |
| `routes/layers.py` | | | |
| `models/ingest_record.py` | | | |
| `services/db_client.py` | | | |
| **Total** | | | |

**Coverage report:** Attach `htmlcov/index.html` or paste summary below.

```
_________________________________________________________________
```

**Result:** `[ ] ≥ 80% — TARGET MET  [ ] < 80% — DOES NOT MEET TARGET`

### 3.2 Frontend Coverage (jasper-frontend)

**Tool:** Jest + `--coverage` | **Target:** ≥ 75%

| Component | Lines | Covered | Coverage% |
|---|---|---|---|
| `components/MapView.tsx` | | | |
| `components/RiskOverlay.tsx` | | | |
| `components/WaterQualityWidget.tsx` | | | |
| `components/PipelineStatus.tsx` | | | |
| `hooks/useConvexQuery.ts` | | | |
| **Total** | | | |

**Result:** `[ ] ≥ 75% — TARGET MET  [ ] < 75% — DOES NOT MEET TARGET`

---

## 4. API Contract Test Results

All 6 contracts from `docs/api-contracts.md` must have 100% endpoint coverage.

| Contract | Endpoint(s) | Contract Status | Tests Passing |
|---|---|---|---|
| 1 — Ingest JSON schema | POST /api/v1/ingest | `[ ] CONFIRMED` | `[ ] ALL PASS` |
| 2 — Map query endpoint | GET /api/v1/layers/{sector_id} | `[ ] CONFIRMED` | `[ ] ALL PASS` |
| 3 — ML output schema | POST /predict/change-detection, /simulate/erosion, /simulate/contaminant | `[ ] CONFIRMED` | `[ ] ALL PASS` |
| 4 — Convex mutation names | updatePipelineStatus, updateWaterQuality, updateModelMetadata | `[ ] CONFIRMED` | `[ ] ALL PASS` |
| 5 — Convex query names | getPipelineStatus, getLiveWaterQuality, getModelMetadata | `[ ] CONFIRMED` | `[ ] ALL PASS` |
| 6 — RBAC roles + permissions | Supabase RLS — all 4 roles | `[ ] CONFIRMED` | `[ ] ALL PASS` |

**API contract coverage: ____% (target: 100%)**

---

## 5. Security Test Results

### 5.1 Semgrep SAST

| Severity | Count | Acceptable |
|---|---|---|
| HIGH | ___ | Must be **0** |
| MEDIUM | ___ | Document and accept or fix |
| LOW | ___ | Document and accept |
| INFO | ___ | Informational only |

**Semgrep report artifact:** `semgrep-report-{sha}.json` (attached to Sprint 4 CI run)

**Result:** `[ ] 0 HIGH findings — GATE PASSED  [ ] HIGH findings present — MILESTONE BLOCKED`

### 5.2 Dependency CVE Scan

| Package Manager | HIGH CVEs | MEDIUM CVEs | Last Scan |
|---|---|---|---|
| npm (jasper-frontend) | ___ | ___ | _______________ |
| pip (jasper-backend) | ___ | ___ | _______________ |
| pip (jasper-ml) | ___ | ___ | _______________ |

**Result:** `[ ] 0 HIGH CVEs — GATE PASSED  [ ] HIGH CVEs unpatched — MILESTONE BLOCKED`

### 5.3 RBAC Security Tests

| Role | Read | Write | Delete | Result |
|---|---|---|---|---|
| admin | ✓ | ✓ | ✓ | `[ ] PASS  [ ] FAIL` |
| analyst | ✓ | water_quality only | ✗ | `[ ] PASS  [ ] FAIL` |
| ingest | ✗ | ingest_records only | ✗ | `[ ] PASS  [ ] FAIL` |
| viewer | ✓ | ✗ | ✗ | `[ ] PASS  [ ] FAIL` |

**OWASP Top 10 mapping:** See `docs/owasp-mapping.md` — all 10 rows addressed.

---

## 6. Performance Benchmarks

**Run:** `pytest tests/benchmark_api.py -v -s > benchmark-output.txt`

### 6.1 API Response Time (P95)

| Endpoint | Avg (ms) | P95 (ms) | Budget | Status |
|---|---|---|---|---|
| GET /health | | | < 200ms | `[ ] PASS  [ ] FAIL` |
| GET /api/v1/layers/{sector_id} | | | < 500ms | `[ ] PASS  [ ] FAIL` |
| POST /predict/change-detection | | | < 500ms | `[ ] PASS  [ ] FAIL` |
| POST /simulate/erosion | | | < 500ms | `[ ] PASS  [ ] FAIL` |
| POST /simulate/contaminant | | | < 500ms | `[ ] PASS  [ ] FAIL` |

### 6.2 Lighthouse Scores (Staging)

**Staging URL tested:** _______________
**Run date:** _______________

| Category | Score | Target | Status |
|---|---|---|---|
| Performance | | ≥ 85 | `[ ] PASS  [ ] FAIL` |
| Accessibility | | ≥ 90 | `[ ] PASS  [ ] FAIL` |
| Best Practices | | ≥ 80 | `[ ] WARN  [ ] PASS` |
| SEO | | ≥ 80 | `[ ] WARN  [ ] PASS` |

### 6.3 DB Spatial Query Performance

**Collected from:** Rahil's DB benchmark report (attached separately)

| Query | P95 (ms) | Budget | Status |
|---|---|---|---|
| SELECT * FROM ingest_records WHERE sector_id = ? | | < 500ms | `[ ] PASS  [ ] FAIL` |
| SELECT * FROM ingest_records WHERE ST_Within(geom, bbox) | | < 500ms | `[ ] PASS  [ ] FAIL` |

---

## 7. ML Model Accuracy

**Collected from:** Richard's model_card.md (attached separately)

| Model | Metric | Sprint 3 Target | Final Score | Status |
|---|---|---|---|---|
| Change Detection | F1 Score | ≥ 0.75 | ___ | `[ ] MET  [ ] NOT MET` |
| Erosion Simulation | F1 Score | ≥ 0.75 | ___ | `[ ] MET  [ ] NOT MET` |
| Contaminant Spread | RMSE | TBD by Richard | ___ | `[ ] MET  [ ] NOT MET` |

---

## 8. Go-Live Checklist (12 Binary Items)

All 12 must be checked before Edwin approves production deploy.

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | All Sprint 4 tasks Done; no open blockers | `[ ] PASS  [ ] FAIL` | |
| 2 | Semgrep: zero HIGH findings on production build | `[ ] PASS  [ ] FAIL` | |
| 3 | Dependabot: zero unpatched HIGH CVEs | `[ ] PASS  [ ] FAIL` | |
| 4 | All tests passing on main | `[ ] PASS  [ ] FAIL` | |
| 5 | Staging URL approved by all 5 team members | `[ ] PASS  [ ] FAIL` | |
| 6 | All env vars confirmed in Vercel + Railway production settings | `[ ] PASS  [ ] FAIL` | |
| 7 | Kong rate limits (20 req/min) and CORS whitelist verified in staging | `[ ] PASS  [ ] FAIL` | |
| 8 | Supabase RBAC: analyst and viewer roles verified by Rahil | `[ ] PASS  [ ] FAIL` | |
| 9 | ML model F1 meets Sprint 4 threshold — signed by Richard in model_card.md | `[ ] PASS  [ ] FAIL` | |
| 10 | Lighthouse ≥ 85 Performance in staging | `[ ] PASS  [ ] FAIL` | |
| 11 | README + AGENTS.md + API docs + deployment runbook complete | `[ ] PASS  [ ] FAIL` | |
| 12 | Rollback procedure tested in staging | `[ ] PASS  [ ] FAIL` | |

**Go-live authorization:** All 12 `[ ] PASS  [ ] 1+ FAIL — PRODUCTION DEPLOY BLOCKED`

---

## 9. Attachments

- `[ ]` pytest output (`test-run-output.txt`)
- `[ ]` Coverage HTML report (`htmlcov/index.html`)
- `[ ]` Semgrep JSON report (`semgrep-report-{sha}.json`)
- `[ ]` Benchmark output (`benchmark-output.txt`)
- `[ ]` Lighthouse report (URL from lhci autorun)
- `[ ]` Richard's `model_card.md`
- `[ ]` Rahil's DB query benchmark report

---

## 10. Sign-Off

**Test Completion Report approved by:**

| Name | Role | Signature | Date |
|---|---|---|---|
| Edwin Olaez | PM + QA/Security | | _______________ |
| Feven [Last] | Data Pipeline + API | | _______________ |
| Richard [Last] | AI/ML + Simulation | | _______________ |
| Reyta [Last] | Frontend GIS | | _______________ |
| Rahil [Last] | DB + Analytics | | _______________ |

**Submitted to SAIT Faculty:** _______________
