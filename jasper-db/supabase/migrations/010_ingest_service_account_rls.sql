-- =============================================================================
-- Migration 010 — Fix Ingest RLS for Service-Account JWTs
-- Project: Jasper  |  Sprint: 4
--
-- What this migration does:
--   Updates the three ingest INSERT policies to accept service-account JWTs
--   that carry the ingest role in app_metadata rather than in the profiles table.
--
-- Root cause:
--   The ingest role in production is a machine/pipeline account — it is NOT
--   a real Supabase Auth user, so there is no row in the profiles table with
--   its email address.  All previous ingest INSERT policies did a JOIN against
--   profiles, which always returned zero rows for service accounts, causing
--   every pipeline INSERT to fail with HTTP 403.
--
-- The fix — two-path role check:
--   Each updated policy accepts a caller as 'ingest' if EITHER condition is true:
--     Path A: auth.jwt() -> 'app_metadata' ->> 'role' = 'ingest'
--             (service accounts embed their role in the JWT's app_metadata claim)
--     Path B: EXISTS (SELECT 1 FROM profiles WHERE ... role = 'ingest')
--             (real auth users keep working via the profiles table lookup)
--
--   The OR between the two paths means both real users and service accounts
--   are handled without changing any application code.
--
-- How to generate a valid TEST_INGEST_JWT for CI:
--   Run this in the Supabase SQL Editor:
--
--     SELECT extensions.sign(
--       json_build_object(
--         'role', 'authenticated',
--         'email', 'ingest@jasper.ca',
--         'sub', gen_random_uuid()::text,
--         'iat', extract(epoch from now())::int,
--         'exp', extract(epoch from now() + interval '1 year')::int,
--         'app_metadata', json_build_object('role', 'ingest')
--       ),
--       current_setting('app.jwt_secret')
--     );
--
--   Copy the resulting JWT string → paste it as the TEST_INGEST_JWT
--   secret in GitHub Repository Settings → Secrets and variables → Actions.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- environmental_layers — ingest INSERT
-- Replaces the policy from migration 007 that only supported profiles-based auth.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS ingest_insert_environmental_layers ON environmental_layers;
CREATE POLICY ingest_insert_environmental_layers
ON environmental_layers
FOR INSERT
TO authenticated
WITH CHECK (
  -- Path A: service account has app_metadata.role = 'ingest' in its JWT
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'ingest'
  OR
  -- Path B: real auth user has a profiles row with role = 'ingest'
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'ingest'
  )
);

-- ---------------------------------------------------------------------------
-- water_quality_archive — ingest INSERT
-- Same dual-path fix.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS ingest_insert_water_quality_archive ON water_quality_archive;
CREATE POLICY ingest_insert_water_quality_archive
ON water_quality_archive
FOR INSERT
TO authenticated
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'ingest'
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'ingest'
  )
);

-- ---------------------------------------------------------------------------
-- ingest_records — insert (ingest + analyst + admin)
-- Replaces the policy from migration 008.
-- This table accepts writes from ingest, analyst, AND admin roles,
-- so the app_metadata check uses IN (...) for all three.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS ingest_records_insert ON ingest_records;
CREATE POLICY ingest_records_insert ON ingest_records
FOR INSERT TO authenticated
WITH CHECK (
  -- Path A: JWT app_metadata role is one of the allowed roles
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ingest', 'analyst', 'admin')
  OR
  -- Path B: profiles table confirms one of the allowed roles
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role IN ('ingest', 'analyst', 'admin')
  )
);
