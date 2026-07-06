# Project Jasper — Sprint 2 Integration Test Report
## M2 Sign-Off | Due: July 4, 2026
**Tester:** Edwin Olaez (PM + QA/Security)
**Sprint:** Sprint 2 — Core Pipeline (June 23–July 4, 2026)

---

> **Instructions:** Fill in this report after running the full test suite on the develop branch.
> All four M2 sign-off criteria must be met before Edwin merges develop → main.
>
> Run the suite: `cd tests && pytest --tb=short -v > sprint2-results.txt 2>&1`

---

## Test Run Details

| Field | Value |
|---|---|
| Run Date | _______________ |
| Git Commit (develop) | _______________ |
| Backend URL Tested | _______________ |
| Test Runner | `pytest 8.3.5 + httpx 0.28.1` |
| Environment | `[ ] local  [ ] CI (GitHub Actions)` |

---

## M2 Sign-Off Criteria

### 1. Integration Tests Passing

| Test File | Tests Run | Passed | Failed | Skipped | Status |
|---|---|---|---|---|---|
| test_health.py | | | | | `[ ] PASS  [ ] FAIL` |
| test_api_contracts.py | | | | | `[ ] PASS  [ ] FAIL` |
| test_rbac.py | | | | | `[ ] PASS  [ ] FAIL` |
| test_e2e_pipeline.py | | | | | `[ ] PASS  [ ] FAIL` |
| test_convex_integration.py | | | | | `[ ] PASS  [ ] FAIL` |
| benchmark_api.py | | | | | `[ ] PASS  [ ] SKIP` |

**Notes on skipped tests** (e.g. which env vars are not yet set):

```
_________________________________________________________________
_________________________________________________________________
```

**Overall integration test result:** `[ ] ALL GREEN  [ ] FAILURES (see below)`

---

### 2. Staging Auto-Deploy Working

| Check | Result |
|---|---|
| Push to develop triggers CI | `[ ] YES  [ ] NO` |
| CI passes all 5 active stages (Stage 6 not yet active) | `[ ] YES  [ ] NO` |
| deploy-staging.yml triggers after CI success | `[ ] YES  [ ] NO` |
| Staging URL is live and /health returns 200 | `[ ] YES  [ ] NO` |
| Staging URL: | _______________ |

---

### 3. RBAC Initial Tests Passing

| Role | Read Sectors | Write (allowed ops) | Delete | Test Status |
|---|---|---|---|---|
| admin (service role) | ✓ | ✓ | ✓ | `[ ] PASS  [ ] FAIL  [ ] SKIP` |
| analyst | ✓ | water_quality only | ✗ | `[ ] PASS  [ ] FAIL  [ ] SKIP` |
| ingest | ✗ | ingest_records only | ✗ | `[ ] PASS  [ ] FAIL  [ ] SKIP` |
| viewer | ✓ | ✗ | ✗ | `[ ] PASS  [ ] FAIL  [ ] SKIP` |

**Supabase RLS confirmed live:** `[ ] YES  [ ] NO — waiting on Rahil`

**Required secrets for RBAC tests (confirm with Rahil):**
- `[ ] TEST_ANALYST_JWT` added to GitHub Actions secrets
- `[ ] TEST_INGEST_JWT` added to GitHub Actions secrets
- `[ ] SUPABASE_URL` added to GitHub Actions secrets

---

### 4. Convex Queries Working

| Query/Mutation | Status |
|---|---|
| updatePipelineStatus mutation | `[ ] PASS  [ ] FAIL  [ ] SKIP (CONVEX_URL not set)` |
| updateWaterQuality mutation | `[ ] PASS  [ ] FAIL  [ ] SKIP` |
| updateModelMetadata mutation | `[ ] PASS  [ ] FAIL  [ ] SKIP` |
| getPipelineStatus query | `[ ] PASS  [ ] FAIL  [ ] SKIP` |
| getLiveWaterQuality query | `[ ] PASS  [ ] FAIL  [ ] SKIP` |
| getModelMetadata query | `[ ] PASS  [ ] FAIL  [ ] SKIP` |

**NEXT_PUBLIC_CONVEX_URL confirmed:** `[ ] YES  [ ] NO — waiting on Rahil`

---

## API Contract Status

> All contracts must be CONFIRMED before Edwin gives M2 sign-off.
> Currently all are PENDING — Edwin to follow up with team.

| Contract | Owner | Consumer | Status | Notes |
|---|---|---|---|---|
| 1 — Ingest JSON schema | Feven | Rahil | `[ ] CONFIRMED  [ ] PENDING` | |
| 2 — Map query endpoint | Feven | Reyta | `[ ] CONFIRMED  [ ] PENDING` | |
| 3 — ML output schema | Richard | Rahil + Reyta | `[ ] CONFIRMED  [ ] PENDING` | |
| 4 — Convex mutation names | Rahil | Feven + Richard | `[ ] CONFIRMED  [ ] PENDING` | |
| 5 — Convex query names | Rahil | Reyta | `[ ] CONFIRMED  [ ] PENDING` | |
| 6 — RBAC roles + permissions | Rahil | Edwin | `[ ] CONFIRMED  [ ] PENDING` | |

---

## Blockers

List anything that prevented tests from running or caused failures:

| Blocker | Owner | Resolution | Due |
|---|---|---|---|
| | | | |
| | | | |
| | | | |

---

## E2E Pipeline Test Results (test_e2e_pipeline.py)

| Stage | Test | Result | Notes |
|---|---|---|---|
| Ingest | test_ingested_record_appears_in_map_query | `[ ] PASS  [ ] FAIL  [ ] SKIP` | |
| Data integrity | test_ingested_layer_type_is_preserved | `[ ] PASS  [ ] FAIL  [ ] SKIP` | |
| Data integrity | test_ingested_coordinates_are_preserved | `[ ] PASS  [ ] FAIL  [ ] SKIP` | |
| Data integrity | test_ingested_timestamp_is_preserved | `[ ] PASS  [ ] FAIL  [ ] SKIP` | |
| Shape | test_map_query_response_shape_is_frontend_ready | `[ ] PASS  [ ] FAIL  [ ] SKIP` | |
| Rejection | test_rejected_record_does_not_appear_in_map_query | `[ ] PASS  [ ] FAIL  [ ] SKIP` | |
| Rejection | test_unauthenticated_ingest_does_not_store_data | `[ ] PASS  [ ] FAIL  [ ] SKIP` | |
| Multi-record | test_two_records_same_sector_both_appear | `[ ] PASS  [ ] FAIL  [ ] SKIP` | |
| Timing | test_ingest_then_query_completes_within_2_seconds | `[ ] PASS  [ ] FAIL  [ ] SKIP` | |

---

## M2 Sign-Off

All four criteria must be checked before Edwin merges develop → main and tags M2.

- `[ ]` Integration tests passing (all non-skipped tests green in CI)
- `[ ]` Staging auto-deploy working (deploy-staging.yml triggers on CI success)
- `[ ]` RBAC initial tests passing (or documented as pending Rahil's RLS deploy)
- `[ ]` Convex queries working (or documented as pending Rahil's Convex deploy)

**M2 Sign-Off Date:** _______________

**Edwin's Signature:** Edwin Olaez, PM + QA/Security

**Notes:**

```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```
