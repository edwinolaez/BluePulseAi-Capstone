# CI Feedback — Feven (jasper-backend)

**From:** Edwin (QA)
**Last updated:** July 7, 2026 — post Sprint 2 merge CI run on `main`
**Branch reviewed:** `feature/feven-ingest` → merged into `main`

---

## July 7 CI Run — Stage 4 Results

**Every backend call is returning `401 Invalid or missing API key`** — Kong is rejecting all requests including ones that send the correct `NEXT_PUBLIC_API_KEY` from GitHub Secrets.

Affected tests: all of `test_api_contracts.py` (ingest + map query), `test_e2e_pipeline.py`, and `test_health.py::TestKongGateway`.

**Root cause:** The API key registered in Kong's key-auth plugin does not match the value stored in the `NEXT_PUBLIC_API_KEY` GitHub Secret. CI sends that secret as the `X-API-Key` header — if Kong doesn't have that exact value registered, it returns 401.

**Fix:**
1. Log into your Railway deployment → open the Kong service config
2. Find the key-auth plugin consumer key that's registered
3. Either update the Kong key to match what's in the GitHub Secret, or send Edwin the correct key value so he can update the secret

Once Kong accepts the key, the 401s will clear and the underlying ingest/map-query logic can be tested.

---

---

## Summary

Good progress since the last CI run — the route now exists, empty-sector 404 is fixed,
and Pylint is at 9.69. The remaining failures come down to one root issue: the ingest
endpoint uses `Form(...)` fields but the tests (and the agreed contract) send JSON. Once
that's fixed, the response shape needs a small adjustment too.

---

## What's Already Fixed

- `POST /api/v1/ingest` route exists and is reachable ✓
- `GET /api/v1/layers/{sector_id}` returns 404 when sector has no data ✓
- Unauthenticated requests now get 401 (FastAPI-level auth added) ✓
- Pylint score: **9.69/10** ✓

---

## 1. Ingest Endpoint — JSON Body vs Form Data Mismatch

**This is the main blocker. It affects every ingest test.**

Your handler is currently defined like this:

```python
@router.post("/api/v1/ingest")
async def ingest_base(
    sector_id: str = Form(...),
    data_source: str = Form(...),
    user_id: str = Form(...),
):
```

`Form(...)` tells FastAPI to expect `multipart/form-data` or
`application/x-www-form-urlencoded`. But every test sends a JSON body:

```python
http_client.post("/api/v1/ingest", json=SAMPLE_INGEST_RECORD, headers=auth_headers)
```

When FastAPI gets a `Content-Type: application/json` request against a `Form(...)` endpoint,
it returns **422** because the form fields are missing. The tests expect **201**.

**Fix — replace `Form(...)` with a Pydantic model:**

```python
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

class Coordinates(BaseModel):
    lat: float = Field(..., ge=-90, le=90)
    lon: float = Field(..., ge=-180, le=180)

class IngestRecord(BaseModel):
    sector_id: str
    layer_type: str
    coordinates: Coordinates
    timestamp: str
    payload: Optional[Dict[str, Any]] = {}

@router.post("/api/v1/ingest", status_code=201, dependencies=[Depends(require_api_key)])
async def ingest_base(record: IngestRecord):
    ...
```

This also gives you the coordinate range validation for free (the `ge`/`le` bounds on
`lat` and `lon`) — which fixes Issue 2 below at the same time.

---

## 2. Ingest Response — Missing `id` Field

The tests check that a successful 201 response contains `id`, `sector_id`, and `timestamp`:

```python
assert_has_required_fields(body, required_fields=["id", "sector_id", "timestamp"])
```

Your current response returns `status`, `message`, `user_id` — there's no `id` field.

**Fix — return `id` in the response:**

The `id` should be the UUID that Supabase generates when the row is inserted. After your
DB write, read it back and include it:

```python
result = supabase.table("ingest_records").insert({...}).execute()
record_id = result.data[0]["id"]  # Supabase returns the generated UUID

return JSONResponse(status_code=201, content={
    "id": record_id,
    "sector_id": record.sector_id,
    "timestamp": datetime.now(timezone.utc).isoformat(),
})
```

If Supabase isn't wired up yet for this endpoint, you can generate a UUID locally as a
temporary measure:

```python
import uuid
return JSONResponse(status_code=201, content={
    "id": str(uuid.uuid4()),
    "sector_id": record.sector_id,
    "timestamp": datetime.now(timezone.utc).isoformat(),
})
```

---

## 3. Coordinate Validation — Missing (Fixed by Issue 1 fix)

The test sends `lat=999, lon=999` and expects a 422. Right now those invalid coordinates
are accepted silently because there's no validation.

If you add the Pydantic model from Issue 1 with `ge`/`le` bounds on `lat` and `lon`,
this test will pass automatically — no extra work needed.

---

## Full Expected Contract for Reference

Here is exactly what the tests send and expect — use this as the spec:

### `POST /api/v1/ingest`

```json
// Request body (Content-Type: application/json)
{
  "layer_type": "burn_scar",
  "sector_id": "ATH-001",
  "coordinates": {
    "lat": 56.7267,
    "lon": -111.3790
  },
  "timestamp": "2026-06-25T12:00:00Z",
  "payload": {
    "severity": "high",
    "area_km2": 142.5
  }
}

// Expected response (201 Created)
{
  "id": "<uuid>",
  "sector_id": "ATH-001",
  "timestamp": "<ISO timestamp>"
}
```

### Validation rules the tests enforce
| Scenario | Expected status |
|---|---|
| Valid record | 201 |
| Missing `sector_id` | 422 |
| `lat=999` or `lon=999` | 422 |
| No `X-API-Key` header | 401 |

---

## Next Steps

1. Replace `Form(...)` with a Pydantic JSON model (fixes Issues 1 + 3 together)
2. Add `id` to the 201 response
3. Redeploy to Railway and ping Edwin — he'll re-run CI to confirm

The Pylint and pip-audit items from before are no longer urgent given the score is 9.69.
Focus on the two items above first.
