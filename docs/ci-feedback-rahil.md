# CI Feedback — Rahil (jasper-db / Convex)

**From:** Edwin (QA)
**Date:** July 6, 2026
**Branch reviewed:** `feature/rahil-db`

---

## Summary

Good progress — you added the `modelMetadata` Convex table and RLS policies this sprint.
But there are 3 issues still causing integration test failures: a Convex file naming mismatch,
and two missing Supabase tables that the RBAC tests depend on.

---

## 1. Convex — Wrong File Name for `getModelMetadata`

**The problem:**
You created `convex/modelMetadata.ts` with `getModelMetadata` exported. That's the right
logic, but the wrong file name.

Convex derives the API path from the filename. Your file `modelMetadata.ts` registers the
function at path `modelMetadata:getModelMetadata`. Our integration tests call:

```
"path": "models:getModelMetadata"
```

That path requires a file named `convex/models.ts`. There is no `convex/models.ts` on your
branch, so the query returns a 404/error and the test fails.

**Fix:**
Rename `convex/modelMetadata.ts` → `convex/models.ts`. No logic changes needed — just the
filename.

```bash
# In your branch
git mv convex/modelMetadata.ts convex/models.ts
```

**Expected response shape** (the test also checks for these fields):
```json
{
  "model_version": "v1.2",
  "run_id": "run-abc123",
  "metrics": { "f1": 0.87 }
}
```

Your current schema has `modelVersion` and `f1Score` — you'll need to either rename those
fields in the schema/handler or map them in the query response so the keys match what the
test expects (`model_version`, `run_id`, `metrics`).

---

## 2. Supabase — `sectors` Table Does Not Exist

**The problem:**
The RBAC tests call `/rest/v1/sectors` to verify that viewers and analysts can read sector
data. Your schema (`001_initial_schema.sql`) does not create a `sectors` table — so
Supabase returns a 404 (relation does not exist).

**Tables the tests query:**
- `/rest/v1/sectors` — viewer read, analyst read
- `/rest/v1/ingest_records` — viewer blocked, ingest can INSERT, analyst can INSERT

**Fix:**
Add a migration (e.g. `008_sectors_ingest_records.sql`) with at minimum:

```sql
CREATE TABLE IF NOT EXISTS sectors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id    TEXT NOT NULL UNIQUE,
  name         TEXT,
  region       TEXT,
  geometry     geometry(Polygon, 4326),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ingest_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id    TEXT NOT NULL,
  layer_type   TEXT,
  coordinates  geometry(Point, 4326),
  payload      JSONB DEFAULT '{}'::jsonb,
  user_id      TEXT,
  timestamp    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Supabase — RLS Policies Missing for `sectors` and `ingest_records`

**The problem:**
Your `007_rls_policies.sql` adds RLS for `environmental_layers`, `water_quality_archive`,
and `ml_model_outputs` — but the tests target `sectors` and `ingest_records`. Those tables
need their own RLS policies or the JWT tokens will get 401/403 in the wrong places.

**Required RLS rules:**

| Table | Role | Operation | Expected result |
|---|---|---|---|
| `sectors` | viewer | SELECT | 200 ✓ |
| `sectors` | analyst | SELECT | 200 ✓ |
| `sectors` | ingest | SELECT | 200 ✓ |
| `ingest_records` | viewer | INSERT | 403 blocked |
| `ingest_records` | viewer | DELETE | 403 blocked |
| `ingest_records` | ingest | INSERT | 201 ✓ |
| `ingest_records` | analyst | INSERT | 201 ✓ |

**Fix:**
Add RLS on both tables using the same `profiles.role` pattern you already have in `007_rls_policies.sql`:

```sql
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_records ENABLE ROW LEVEL SECURITY;

-- sectors: all authenticated roles can read
CREATE POLICY sectors_read ON sectors
FOR SELECT TO authenticated
USING (true);

-- ingest_records: viewer cannot write
CREATE POLICY ingest_records_insert ON ingest_records
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role IN ('ingest', 'analyst', 'admin')
  )
);
```

---

## What's Already Working

- `modelMetadata` table is in the Convex schema ✓
- `updateModelMetadata` mutation logic is correct ✓
- RLS pattern in `007_rls_policies.sql` is solid — just needs to cover the right tables
- Composite indexes and audit logging migrations are in good shape

---

## Next Steps

1. Rename `convex/modelMetadata.ts` → `convex/models.ts`
2. Update the `getModelMetadata` handler to return `model_version`, `run_id`, `metrics` keys
3. Add `sectors` and `ingest_records` tables in a new migration file
4. Add RLS policies for those two tables
5. Push to `feature/rahil-db` and ping Edwin — he'll re-run CI to confirm
