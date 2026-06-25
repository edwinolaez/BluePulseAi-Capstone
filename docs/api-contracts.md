# Project Jasper — API Contracts
## All contracts must be finalized by M1: June 20, 2026

---

> **Rule:** No Sprint 2 coding begins until every row below is marked CONFIRMED.
> Owner = the person who produces the contract. Consumer = the person who depends on it.
> Edwin signs off each contract when both Owner and Consumer agree.

---

## Contract Status

| Contract | Owner | Consumer | Due | Status |
|---|---|---|---|---|
| Ingest record JSON schema | Feven | Rahil | June 20 | PENDING |
| Map query endpoint spec | Feven | Reyta | June 20 | PENDING |
| ML output schema | Richard | Rahil + Reyta | June 20 | PENDING |
| Convex mutation names | Rahil | Feven + Richard | June 20 | PENDING |
| Convex query names + Supabase widget shapes | Rahil | Reyta | June 20 | PENDING |
| RBAC roles and permissions | Rahil | Edwin (tests) | June 20 | PENDING |

---

## Contract 1: Ingest Record JSON Schema

**Owner:** Feven | **Consumer:** Rahil | **Status:** PENDING

The ingest endpoint accepts records with the following shape. Rahil's PostGIS schema must accept exactly these fields.

```json
{
  "layer_type": "string",
  "sector_id": "string",
  "coordinates": {
    "lat": "number",
    "lon": "number"
  },
  "timestamp": "string (ISO 8601)",
  "payload": "object (layer-type-specific data)"
}
```

**Notes:** *(Feven to fill in — field constraints, required vs. optional, validation rules)*

---

## Contract 2: Map Query Endpoint

**Owner:** Feven | **Consumer:** Reyta | **Status:** PENDING

```
GET /api/v1/layers/{sector_id}
Authorization: X-API-Key: <kong-api-key>
```

**Response shape:**

```json
{
  "sector_id": "string",
  "layers": [
    {
      "layer_type": "string",
      "coordinates": { "lat": "number", "lon": "number" },
      "timestamp": "string",
      "data": "object"
    }
  ]
}
```

**Notes:** *(Feven to fill in — pagination, error codes, rate limit behaviour)*

---

## Contract 3: ML Output Schema

**Owner:** Richard | **Consumer:** Rahil + Reyta | **Status:** PENDING

All ML model endpoints return:

```json
{
  "simulation_type": "change_detection | erosion | contaminant",
  "sector_id": "string",
  "risk_score": "number (0.0–1.0)",
  "contaminant_vector": "array<number> | null",
  "confidence": "number (0.0–1.0)",
  "timestamp": "string (ISO 8601)",
  "model_version": "string"
}
```

**Endpoints:**
- `POST /predict/change-detection`
- `POST /simulate/erosion`
- `POST /simulate/contaminant`

**Notes:** *(Richard to fill in — request body shape, auth requirements, response time SLA)*

---

## Contract 4: Convex Mutation Names

**Owner:** Rahil | **Consumer:** Feven + Richard | **Status:** PENDING

| Mutation Name | Purpose | Arguments |
|---|---|---|
| `updatePipelineStatus` | Update ingest pipeline run status | `{ sector_id, status, timestamp }` |
| `updateWaterQuality` | Push new water quality reading | `{ sector_id, readings, timestamp }` |
| `updateModelMetadata` | Record ML model run metadata | `{ model_version, run_id, metrics }` |

**Notes:** *(Rahil to fill in — full argument types, return values, error behaviour)*

---

## Contract 5: Convex Query Names + Supabase Widget Shapes

**Owner:** Rahil | **Consumer:** Reyta | **Status:** PENDING

| Query Name | Returns | Used In |
|---|---|---|
| `getPipelineStatus` | Latest pipeline run status | Dashboard status panel |
| `getLiveWaterQuality` | Latest water quality readings | Water quality widget |
| `getModelMetadata` | Latest ML model run info | Risk overlay panel |

**Supabase real-time subscription shapes:** *(Rahil to fill in)*

---

## Contract 6: RBAC Roles and Permissions

**Owner:** Rahil | **Consumer:** Edwin (tests) | **Status:** PENDING

| Role | Can Read | Can Write | Can Delete | Notes |
|---|---|---|---|---|
| `admin` | All | All | All | Edwin only |
| `analyst` | All | Water quality + pipeline triggers | None | CERCUTS users |
| `ingest` | None | Ingest records only | None | Service account for Feven's pipeline |
| `viewer` | All | None | None | SAIT Faculty, read-only |

**Row-Level Security policy details:** *(Rahil to fill in — Supabase RLS policy definitions)*

---

## Change Log

| Date | Contract | Change | Author |
|---|---|---|---|
| June 25, 2026 | All | Initial framework document created | Edwin |
