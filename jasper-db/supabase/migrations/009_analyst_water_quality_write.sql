-- =============================================================================
-- Migration 009 — Grant Analysts INSERT on water_quality_archive
-- Project: Jasper  |  Sprint: 2 patch
--
-- What this migration does:
--   Adds a new RLS policy that allows users with the 'analyst' (or 'admin')
--   role to INSERT rows into the water_quality_archive table.
--
-- Why this was needed:
--   Migration 007 only gave the 'ingest' role INSERT access to
--   water_quality_archive.  However, analysts working in the field need to
--   record water quality measurements they collect personally — they can't
--   log in as the ingest service account to do this.
--
--   The CI test test_rbac.py::TestAnalystRole::test_analyst_can_write_water_quality
--   was failing with a 403 because the policy didn't exist.  This migration
--   unblocks that test and reflects the real workflow: analysts are trusted
--   to enter field measurements.
--
-- How to apply (Supabase Dashboard):
--   SQL Editor → paste this file → Run
--
-- Note: This policy is deliberately separate from migration 007 rather than
-- being a retroactive edit, so the migration history remains auditable.
-- =============================================================================

-- Drop first so the migration is idempotent (re-runnable without error)
DROP POLICY IF EXISTS analyst_insert_water_quality_archive ON water_quality_archive;

-- Allow analysts (and admins) to INSERT water quality readings.
-- role IN ('analyst', 'admin') means one policy covers both roles rather than
-- creating two separate policies.
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
