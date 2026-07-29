-- =============================================================================
-- Migration 007 — Core Tables and Row-Level Security (RLS) Policies
-- Project: Jasper  |  Owner: Rahil Khan  |  Sprint: 2
--
-- What this migration does:
--   Part A — Creates three operational tables that the dashboard and ML API
--   write to at runtime:
--     environmental_layers  : sensor readings, ML layer outputs, imagery metadata
--     water_quality_archive : archived water sensor readings
--     ml_model_outputs      : predictions stored by the ML API
--
--   Part B — Enables Row-Level Security on all three tables and defines nine
--   RLS policies (3 tables × up to 3 roles each) that control which rows
--   each role can access.
--
-- How RLS works in Supabase:
--   Once ENABLE ROW LEVEL SECURITY is run on a table, every query (even for
--   superusers) must pass at least one policy or it returns no rows.
--   Each policy has a USING clause (for SELECT/UPDATE/DELETE) and/or a
--   WITH CHECK clause (for INSERT/UPDATE).
--
--   The policies here look up the caller's email from auth.jwt() ->> 'email'
--   and JOIN it against the profiles table to verify the role.
--   This ties every database action to a verified Supabase Auth identity.
--
-- Policy summary:
--   viewer  → SELECT on environmental_layers only
--   ingest  → INSERT on environmental_layers + water_quality_archive
--   analyst → SELECT on all three tables
--   admin   → ALL operations on all three tables
-- =============================================================================

SET search_path = public, extensions;

-- Ensure PostGIS and pgcrypto are available (idempotent)
CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- Table: environmental_layers
-- The central fact table for the dashboard.  Stores one row per data layer
-- (e.g. one erosion simulation result, one sensor reading batch).
-- geometry and coordinates are kept as separate columns because some layers
-- have a point location (coordinates) while others cover a polygon area (geometry).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS environmental_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  layer_type TEXT NOT NULL,              -- e.g. "erosion", "contaminant", "water_quality"
  risk_score FLOAT,                      -- 0–1 normalised risk level
  risk_label TEXT,                       -- "High", "Medium", "Low"
  coordinates geometry(Point, 4326),     -- single-point location
  geometry geometry,                     -- arbitrary geometry (polygon, line, etc.)
  data_source TEXT,                      -- e.g. "ML API", "EC Water Office"
  user_id TEXT,                          -- audit: who created this row
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB DEFAULT '{}'::jsonb      -- flexible extra fields
);

-- ---------------------------------------------------------------------------
-- Table: water_quality_archive
-- Long-term storage for water sensor readings, separate from the live
-- water_quality_readings table to keep the live table small and fast.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS water_quality_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  turbidity FLOAT,                       -- NTU — increases after erosion events
  ph FLOAT,                              -- acidity 0–14
  hydrocarbon_level FLOAT,               -- proxy for contamination level 0–1
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Table: ml_model_outputs
-- Permanent record of every prediction made by the ML API endpoints.
-- Mirrors the ModelOutput schema returned by /predict and /simulate routes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ml_model_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  model_version TEXT,                    -- e.g. "v1.0"
  simulation_type TEXT,                  -- "change_detection", "erosion", "contaminant"
  risk_score FLOAT,
  risk_label TEXT,
  contaminant_vector JSONB,              -- {direction_deg, velocity} or [[lat, lon]]
  confidence FLOAT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS — from this point, no row is accessible without a matching policy
ALTER TABLE environmental_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_quality_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_model_outputs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating them so the migration is idempotent.
-- Supabase does not support CREATE POLICY IF NOT EXISTS, so we drop first.
DROP POLICY IF EXISTS viewer_select_environmental_layers ON environmental_layers;
DROP POLICY IF EXISTS ingest_insert_environmental_layers ON environmental_layers;
DROP POLICY IF EXISTS ingest_insert_water_quality_archive ON water_quality_archive;
DROP POLICY IF EXISTS analyst_select_environmental_layers ON environmental_layers;
DROP POLICY IF EXISTS analyst_select_water_quality_archive ON water_quality_archive;
DROP POLICY IF EXISTS analyst_select_ml_model_outputs ON ml_model_outputs;
DROP POLICY IF EXISTS admin_all_environmental_layers ON environmental_layers;
DROP POLICY IF EXISTS admin_all_water_quality_archive ON water_quality_archive;
DROP POLICY IF EXISTS admin_all_ml_model_outputs ON ml_model_outputs;

-- ---------------------------------------------------------------------------
-- viewer policies
-- Viewers can only SELECT from environmental_layers (the primary read path
-- for public dashboards).  They cannot see archived water data or raw ML
-- outputs — those are analyst-only for data quality reasons.
-- ---------------------------------------------------------------------------
CREATE POLICY viewer_select_environmental_layers
ON environmental_layers
FOR SELECT
TO authenticated
USING (
  -- Check that the requesting user's email maps to a 'viewer' profile row
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'viewer'
  )
);

-- ---------------------------------------------------------------------------
-- ingest policies
-- The ingest role is used by automated pipelines.  It can INSERT new rows
-- but cannot read or modify existing data — principle of least privilege.
-- ---------------------------------------------------------------------------
CREATE POLICY ingest_insert_environmental_layers
ON environmental_layers
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'ingest'
  )
);

CREATE POLICY ingest_insert_water_quality_archive
ON water_quality_archive
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'ingest'
  )
);

-- ---------------------------------------------------------------------------
-- analyst policies
-- Analysts get full read access to all three tables for research and reporting.
-- They cannot INSERT/UPDATE/DELETE — that requires the ingest or admin role.
-- Migration 009 later adds INSERT on water_quality_archive for analysts.
-- ---------------------------------------------------------------------------
CREATE POLICY analyst_select_environmental_layers
ON environmental_layers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'analyst'
  )
);

CREATE POLICY analyst_select_water_quality_archive
ON water_quality_archive
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'analyst'
  )
);

CREATE POLICY analyst_select_ml_model_outputs
ON ml_model_outputs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'analyst'
  )
);

-- ---------------------------------------------------------------------------
-- admin policies
-- Admins bypass all restrictions — they can SELECT, INSERT, UPDATE, and DELETE
-- any row in any of the three tables.
-- FOR ALL = covers SELECT, INSERT, UPDATE, and DELETE.
-- WITH CHECK (true) means no row-level restriction on writes.
-- ---------------------------------------------------------------------------
CREATE POLICY admin_all_environmental_layers
ON environmental_layers
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'admin'
  )
)
WITH CHECK (true);  -- admins can write any value without restriction

CREATE POLICY admin_all_water_quality_archive
ON water_quality_archive
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'admin'
  )
)
WITH CHECK (true);

CREATE POLICY admin_all_ml_model_outputs
ON ml_model_outputs
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'admin'
  )
)
WITH CHECK (true);
