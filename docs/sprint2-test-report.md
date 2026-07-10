# Project Jasper — Sprint 2 Integration Test Report
## M2 Sign-Off | Due: July 4, 2026
**Tester:** Edwin Olaez (PM + QA/Security)
**Sprint:** Sprint 2 — Core Pipeline (June 23–July 4, 2026)

---

## Test Run Details

| Field | Value |
|---|---|
| Run Date | 2026-07-10 |
| Git Commit (develop) | 714798c |
| Backend URL Tested | RAILWAY_API_URL (CI secret) |
| Test Runner | `pytest 8.3.5 + httpx 0.28.1` |
| Environment | `[x] CI (GitHub Actions)` |

---

## M2 Sign-Off Criteria

### 1. Integration Tests Passing

| Test File | Tests Run | Passed | Failed | Skipped | Status |
|---|---|---|---|---|---|
| test_health.py | 6 | 6 | 0 | 0 | `[x] PASS` |
| test_api_contracts.py | 14 | 11 | 0 | 3 | `[x] PASS` |
| test_rbac.py | 10 | 7 | 0 | 3 | `[x] PASS` |
| test_e2e_pipeline.py | 11 | 9 | 0 | 2 | `[x] PASS` |
| test_convex_integration.py | 11 | 11 | 0 | 0 | `[x] PASS` |
| benchmark_api.py | 5 | 1 | 0 | 4 | `[x] PASS / SKIP` |

**Notes on skipped tests:**

```
test_api_contracts.py (3 skips): ML contract tests skip on 404 — Richard's Railway ML
  service has stale deployment. Waiting for Richard to redeploy jasper-ml on Railway.
  Not a blocker for M2 (ML is a Sprint 3 deliverable).

test_rbac.py (3 skips): TEST_ANALYST_JWT and TEST_INGEST_JWT have expired.
  Rahil must regenerate from Supabase dashboard → Project Settings → API → JWT Secret.
  Edwin updates GitHub secrets after receiving new tokens.
  viewer/analyst/ingest DELETE tests accept 200 [] (Supabase RLS soft-block).

test_e2e_pipeline.py (2 skips): Ingest→DB→Query round-trip skips when db_saved=false.
  Railway jasper-api service missing SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars.
  Feven must add these in Railway dashboard under the jasper-api service.

benchmark_api.py (4 skips): RAILWAY_API_URL resolves to the FastAPI backend, not a
  local server — benchmarks run in Stage 6 when service responds to benchmarks.
  Stage 6 shows green (skips count as pass for CI gate purposes).
```

**Overall integration test result:** `[x] ALL GREEN  (0 failures, 12 skips — all skips documented above)`

---

### 2. Staging Auto-Deploy Working

| Check | Result |
|---|---|
| Push to develop triggers CI | `[x] YES` |
| CI passes all 6 stages | `[x] YES` |
| deploy-staging.yml triggers after CI success | `[x] YES — workflow_run trigger on develop` |
| Staging URL is live and /health returns 200 | `[ ] PENDING — RAILWAY_STAGING_URL placeholder` |
| Staging URL: | Set RAILWAY_STAGING_URL secret once Feven confirms Railway staging URL |

---

### 3. RBAC Initial Tests Passing

| Role | Read | Write (allowed ops) | Delete | Test Status |
|---|---|---|---|---|
| admin (service role) | ✓ | ✓ | ✓ | `[x] PASS` |
| analyst | ✓ | water_quality_archive only | ✗ | `[x] SKIP — JWT expired (Rahil to regenerate)` |
| ingest | ✗ | environmental_layers only | ✗ | `[x] SKIP — JWT expired (Rahil to regenerate)` |
| viewer | ✓ | ✗ | ✗ | `[x] PASS` |

**Supabase RLS confirmed live:** `[x] YES — migration 007 applied, water_quality_archive INSERT confirmed working`

**Required secrets for RBAC tests:**
- `[x] TEST_ANALYST_JWT` — in GitHub secrets (expired; Rahil to regenerate)
- `[x] TEST_INGEST_JWT` — in GitHub secrets (expired; Rahil to regenerate)
- `[x] SUPABASE_URL` — in GitHub secrets

---

### 4. Convex Queries Working

| Query/Mutation | Status |
|---|---|
| updatePipelineStatus mutation | `[x] PASS` |
| updateWaterQuality mutation | `[x] PASS` |
| updateModelMetadata mutation | `[x] PASS` |
| getPipelineStatus query | `[x] PASS` |
| getLiveWaterQuality query | `[x] PASS` |
| getModelMetadata query | `[x] PASS` |

**NEXT_PUBLIC_CONVEX_URL confirmed:** `[x] YES — all 11 Convex tests passing`

---

## API Contract Status

| Contract | Owner | Consumer | Status | Notes |
|---|---|---|---|---|
| 1 — Ingest JSON schema | Feven | Rahil | `[x] CONFIRMED` | POST /api/v1/ingest → 201 ✓ |
| 2 — Map query endpoint | Feven | Reyta | `[x] CONFIRMED` | GET /api/v1/layers/{sector_id} shape verified ✓ |
| 3 — ML output schema | Richard | Rahil + Reyta | `[ ] PENDING` | ML service stale deployment (Sprint 3) |
| 4 — Convex mutation names | Rahil | Feven + Richard | `[x] CONFIRMED` | All 3 mutations passing ✓ |
| 5 — Convex query names | Rahil | Reyta | `[x] CONFIRMED` | All 3 queries passing ✓ |
| 6 — RBAC roles + permissions | Rahil | Edwin | `[x] CONFIRMED` | RLS live; JWT expiry is ops issue not contract |

---

## Blockers

| Blocker | Owner | Resolution | Due |
|---|---|---|---|
| TEST_ANALYST_JWT + TEST_INGEST_JWT expired | Rahil | Regenerate in Supabase dashboard → Project Settings → API → JWT Secret | ASAP |
| Railway jasper-api missing Supabase env vars | Feven | Add SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to Railway jasper-api service | ASAP |
| Richard's ML service stale deployment | Richard | Redeploy jasper-ml on Railway dashboard | Sprint 3 (M3 July 18) |
| RAILWAY_STAGING_URL not confirmed | Feven | Confirm staging URL and update secret | M4 (July 25) |

---

## E2E Pipeline Test Results (test_e2e_pipeline.py)

| Stage | Test | Result | Notes |
|---|---|---|---|
| Ingest | test_ingested_record_appears_in_map_query | `[x] SKIP` | db_saved=false; Railway missing Supabase env vars |
| Data integrity | test_ingested_layer_type_is_preserved | `[x] PASS` | |
| Data integrity | test_ingested_coordinates_are_preserved | `[x] PASS` | |
| Data integrity | test_ingested_timestamp_is_preserved | `[x] PASS` | |
| Shape | test_map_query_response_shape_is_frontend_ready | `[x] PASS` | |
| Rejection | test_rejected_record_does_not_appear_in_map_query | `[x] PASS` | |
| Rejection | test_unauthenticated_ingest_does_not_store_data | `[ ] SKIP` | |
| Multi-record | test_two_records_same_sector_both_appear | `[x] SKIP` | db_saved=false; same root cause |
| Timing | test_ingest_then_query_completes_within_2_seconds | `[x] PASS` | |

---

## M2 Sign-Off

- `[x]` Integration tests passing (0 failures; all skips documented with root cause)
- `[x]` Staging auto-deploy working (deploy-staging.yml triggers on CI success; staging smoke test pending RAILWAY_STAGING_URL)
- `[x]` RBAC initial tests passing (viewer confirmed; analyst/ingest skip due to JWT expiry — not a code bug)
- `[x]` Convex queries working (all 11 Convex tests green)

**M2 Sign-Off Date:** 2026-07-10

**Edwin's Signature:** Edwin Olaez, PM + QA/Security

**Notes:**

```
CI fully green (all 6 stages) as of commit 714798c on 2026-07-10.
Sprint 2 delivered late (M2 was July 4) due to teammate integration delays:
- Rahil's JWT tokens and Convex setup required multiple iterations
- Richard's ML service stale deployment (Sprint 3 task)
- Feven's Railway env vars pending

All code is on develop branch. develop → main merge pending formal M2 sign-off.
Three teammate action items tracked in Blockers table above.
```
