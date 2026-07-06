# CI Feedback — Feven (jasper-backend)

**From:** Edwin (QA)
**Date:** July 6, 2026
**CI Run:** #65 / #66 on `develop`

---

## Summary

CI is now reaching Stage 4 (Integration Tests) for the first time. Your backend is
reachable on Railway — that's great. But the tests are finding 3 issues with endpoint
behavior, plus code quality issues in Stage 1 and Stage 2.

---

## 1. Endpoint Issues (Stage 4 — Integration Tests)

### `POST /api/v1/ingest` is returning 404

Every test that tries to post a new sensor record to Railway gets:
```
{"detail": "Not Found"}
```

**What to check:**
- Is the route registered in your FastAPI app as `/api/v1/ingest`?
- Is the Railway deployment up to date with your latest code?
- Run: `curl -X POST https://bluepulseai-capstone-production.up.railway.app/api/v1/ingest` and confirm you get something other than 404.

### Kong is not blocking unauthenticated requests

The test `test_protected_route_requires_api_key` calls a protected endpoint with **no API key** and expects a `401`. It's getting `200` instead.

**What to check:**
- Is the Kong `key-auth` plugin enabled on the protected routes?
- The route should reject any request that doesn't include `X-API-Key: jasper-dev-api-key-202`.

### `GET /api/v1/layers/{sector_id}` returns 200 for unknown sectors

When the test queries a sector ID that doesn't exist in the DB, it expects `404`. It's getting `200` with an empty or default response.

**What to check:**
- In your handler, after the DB query, check if the result is empty.
- If no rows returned, explicitly `raise HTTPException(status_code=404, detail="Sector not found")`.

---

## 2. Pydantic Validation Issues (Stage 4)

Two tests expose missing validation in your ingest model:

| Test | Expected | Got | Fix |
|---|---|---|---|
| POST with no `sector_id` | 422 | 404 | Mark `sector_id` as required (no default) in your Pydantic model |
| POST with `lat=999, lon=999` | 422 | 404 | Add coordinate range validator: lat must be -90 to 90, lon -180 to 180 |

These are returning 404 instead of 422 because the route itself isn't found — fix the 404 first and these may resolve automatically once the route exists.

---

## 3. Code Quality — Pylint (Stage 1)

Your Python files in `jasper-backend` scored below 7.0/10 on Pylint.

**How to check locally:**
```bash
cd jasper-backend
pip install pylint
pylint $(find . -name '*.py' | head -20) --fail-under=7.0
```

Common quick fixes: add docstrings, remove unused imports, fix line length (max 100 chars), rename single-letter variables.

**Target:** Score ≥ 7.0 before M4 (July 25).

---

## 4. Dependency Vulnerabilities — pip-audit (Stage 2)

`pip-audit` found vulnerable packages in `jasper-backend/requirements.txt`.

**How to check locally:**
```bash
cd jasper-backend
pip install pip-audit
pip-audit -r requirements.txt
```

Update any flagged packages to their patched versions. If a package can't be updated, document why.

**Target:** Zero high-severity findings before M5 (Production Live, August 1).

---

## 5. Security Findings — Semgrep (Stage 2)

Semgrep found security issues in your Python code. Edwin will share the
`semgrep-report.json` artifact from the CI run — look for entries where
`path` starts with `jasper-backend/`.

Common findings to look for:
- Hardcoded credentials or tokens
- SQL injection risks (use parameterized queries)
- Insecure use of `subprocess` or `eval`
- Unvalidated user input passed to file paths

**Target:** Zero `ERROR`-severity findings before M4.

---

## What Passes Already

- `GET /api/v1/layers/{sector_id}` with a **valid** sector returns data ✓ (Feven mentioned this was fixed)
- Health endpoint is reachable ✓

---

## Next Steps

1. Fix the `/api/v1/ingest` 404 first — it unblocks 8+ failing tests
2. Enable Kong key-auth plugin on protected routes
3. Add empty-result 404 to the layers handler
4. Run Pylint and pip-audit locally, fix what you can
5. Ping Edwin when Railway is redeployed so he can re-run CI
