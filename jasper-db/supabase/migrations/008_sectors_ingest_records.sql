-- =============================================================================
-- Migration 008 — Sectors and Ingest Records Tables
-- Project: Jasper  |  Sprint: 2/3
--
-- What this migration does:
--   Creates two supporting tables and their RLS policies:
--
--   sectors
--     A registry of every named grid sector in the Athabasca watershed.
--     Each row gives a sector a permanent UUID, a human-readable name,
--     a region label, and its polygon boundary.  The frontend map uses this
--     table to know which sectors exist and where to draw their borders.
--     sector_id is UNIQUE so it can be used as a reliable join key across
--     all other tables (environmental_layers, ml_model_outputs, etc.).
--
--   ingest_records
--     A lightweight log of every data ingest event.  When the pipeline
--     writes a new environmental layer it also writes a row here so admins
--     can audit what was ingested, when, and by whom.
--     Unlike environmental_layers (which stores the actual data), this table
--     only records metadata about the ingest action.
--
--   RLS policies:
--     sectors        — any authenticated user can SELECT (all roles need to
--                      know what sectors exist).
--     ingest_records — INSERT is restricted to ingest, analyst, and admin
--                      roles (viewers cannot log ingest events).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Table: sectors
-- Master list of grid sectors.  Populated once during platform setup.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL UNIQUE,        -- e.g. "ATH-001-A" — must be unique for joins
  name TEXT,                             -- human-readable name, e.g. "Athabasca North Block A"
  region TEXT,                           -- e.g. "Athabasca Watershed"
  geometry geometry(Polygon, 4326),      -- sector boundary polygon
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Table: ingest_records
-- One row per ingest event.  Lightweight audit log for the data pipeline.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingest_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,               -- which sector was ingested
  layer_type TEXT,                       -- what kind of data was written
  coordinates geometry(Point, 4326),     -- optional centroid of the ingested data
  payload JSONB DEFAULT '{}'::jsonb,     -- extra metadata (file name, source URL, etc.)
  user_id TEXT,                          -- which user/service account triggered the ingest
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on both tables
ALTER TABLE sectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingest_records ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- sectors_read policy
-- Any authenticated user (regardless of role) can read the sectors list.
-- USING (true) means "allow all rows" — the only gate is being authenticated.
-- This is intentional: sectors are reference data, not sensitive.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sectors_read ON sectors;
CREATE POLICY sectors_read ON sectors
FOR SELECT TO authenticated
USING (true);  -- all authenticated users can see all sectors

-- ---------------------------------------------------------------------------
-- ingest_records_insert policy
-- Only ingest, analyst, and admin users can log ingest events.
-- Viewers are excluded because they are passive consumers of data.
-- The role IN (...) pattern is more concise than three separate EXISTS subqueries.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS ingest_records_insert ON ingest_records;
CREATE POLICY ingest_records_insert ON ingest_records
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.email = auth.jwt() ->> 'email'
    AND profiles.role IN ('ingest', 'analyst', 'admin')
  )
);
