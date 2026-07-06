-- Project Jasper - Sprint 2 RLS Policies
-- Owner: Rahil Khan

SET search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS environmental_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  layer_type TEXT NOT NULL,
  risk_score FLOAT,
  risk_label TEXT,
  coordinates geometry(Point, 4326),
  geometry geometry,
  data_source TEXT,
  user_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS water_quality_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  turbidity FLOAT,
  ph FLOAT,
  hydrocarbon_level FLOAT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ml_model_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  model_version TEXT,
  simulation_type TEXT,
  risk_score FLOAT,
  risk_label TEXT,
  contaminant_vector JSONB,
  confidence FLOAT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE environmental_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE water_quality_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_model_outputs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS viewer_select_environmental_layers ON environmental_layers;
DROP POLICY IF EXISTS ingest_insert_environmental_layers ON environmental_layers;
DROP POLICY IF EXISTS ingest_insert_water_quality_archive ON water_quality_archive;
DROP POLICY IF EXISTS analyst_select_environmental_layers ON environmental_layers;
DROP POLICY IF EXISTS analyst_select_water_quality_archive ON water_quality_archive;
DROP POLICY IF EXISTS analyst_select_ml_model_outputs ON ml_model_outputs;
DROP POLICY IF EXISTS admin_all_environmental_layers ON environmental_layers;
DROP POLICY IF EXISTS admin_all_water_quality_archive ON water_quality_archive;
DROP POLICY IF EXISTS admin_all_ml_model_outputs ON ml_model_outputs;

CREATE POLICY viewer_select_environmental_layers
ON environmental_layers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role = 'viewer'
  )
);

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
WITH CHECK (true);

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