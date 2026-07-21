-- Sprint 4 fix: allow ingest service-account JWTs to INSERT without a profiles row
--
-- Root cause: the ingest role is a machine/pipeline account (not a real Supabase
-- auth user) so there is no matching row in the profiles table for its JWT email.
-- All ingest INSERT policies were returning 403 because the profiles-table lookup
-- always fails for service accounts.
--
-- Fix: update every ingest INSERT policy to accept EITHER:
--   a) a profiles row with role='ingest'  (real auth users — keep working)
--   b) app_metadata.role = 'ingest' in the JWT (service accounts — new path)
--
-- How to regenerate TEST_INGEST_JWT with the correct claim:
--   Supabase Dashboard → SQL Editor → run:
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
--   Copy the result → update TEST_INGEST_JWT in GitHub Secrets.

-- environmental_layers ingest INSERT
DROP POLICY IF EXISTS ingest_insert_environmental_layers ON environmental_layers;
CREATE POLICY ingest_insert_environmental_layers
ON environmental_layers
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

-- water_quality_archive ingest INSERT
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

-- ingest_records INSERT (covers ingest + analyst + admin)
DROP POLICY IF EXISTS ingest_records_insert ON ingest_records;
CREATE POLICY ingest_records_insert ON ingest_records
FOR INSERT TO authenticated
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('ingest', 'analyst', 'admin')
  OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role IN ('ingest', 'analyst', 'admin')
  )
);
