-- Project Jasper - Sprint 2 patch: analyst INSERT on water_quality_archive
-- Rahil: apply this migration in Supabase dashboard (SQL Editor → run)
-- Required for test_rbac.py::TestAnalystRole::test_analyst_can_write_water_quality to pass.
-- Analysts record contamination measurements in the field — they need INSERT on this table.

DROP POLICY IF EXISTS analyst_insert_water_quality_archive ON water_quality_archive;

CREATE POLICY analyst_insert_water_quality_archive
ON water_quality_archive
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role IN ('analyst', 'admin')
  )
);
