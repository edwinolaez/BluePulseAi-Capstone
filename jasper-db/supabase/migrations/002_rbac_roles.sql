-- =============================================================================
-- Migration 002 — Role-Based Access Control (RBAC) Roles
-- Project: Jasper  |  Owner: Rahil Khan  |  Sprint: 1
--
-- What this migration does:
--   Creates the four PostgreSQL roles used across the platform and assigns
--   table-level privileges to each one.  These roles map directly to the
--   role column in the profiles table defined in migration 001.
--
--   Role definitions:
--     admin   — full CRUD on every table (platform administrators)
--     analyst — read-only access to all tables (researchers, field teams)
--     ingest  — write-only access to all tables (data pipeline service accounts)
--     viewer  — read-only access identical to analyst (public-facing dashboards)
--
--   Note: these are PostgreSQL-level roles, not Supabase Auth roles.
--   Row-Level Security (RLS) policies in migration 007 provide a second,
--   finer-grained access layer that checks the caller's JWT claims at runtime.
--   Both layers are needed: GRANT controls which SQL operations are allowed,
--   while RLS controls which *rows* each operation can touch.
-- =============================================================================

-- Create the four roles if they don't already exist.
-- Using a DO block with IF NOT EXISTS guards makes this migration idempotent
-- (safe to run multiple times without error).
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN CREATE ROLE admin; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analyst') THEN CREATE ROLE analyst; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ingest') THEN CREATE ROLE ingest; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'viewer') THEN CREATE ROLE viewer; END IF;
END
$$;

-- All four roles need USAGE on the public schema to see tables at all.
-- Without this, even SELECT would fail with "permission denied for schema public".
GRANT USAGE ON SCHEMA public TO admin, analyst, ingest, viewer;

-- ---------------------------------------------------------------------------
-- admin: unrestricted access to all tables
-- Admins can do anything — create, read, update, and delete rows.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO admin;

-- ---------------------------------------------------------------------------
-- analyst: read-only access to all tables
-- Analysts run queries, export data, and produce reports but never modify data.
-- The explicit table list (rather than ALL TABLES) means new tables added in
-- future migrations are NOT automatically visible to analysts — a deliberate
-- default-deny stance.
-- ---------------------------------------------------------------------------
GRANT SELECT ON
  satellite_imagery,
  wildfire_perimeters,
  burn_severity_layers,
  vegetation_indices,
  dem_layers,
  land_cover_layers,
  hydrology_layers,
  water_quality_readings,
  weather_data,
  change_detection_results,
  field_observations,
  sampling_locations,
  ml_predictions,
  alerts
TO analyst;

-- ---------------------------------------------------------------------------
-- ingest: insert-only access to all tables
-- The ingest role is used by automated data pipelines (ML API, sensor feeds).
-- It can write new rows but cannot read or modify existing ones — limiting
-- the blast radius if a pipeline service account is ever compromised.
-- Migration 009 later grants INSERT on water_quality_archive to analyst as well.
-- ---------------------------------------------------------------------------
GRANT INSERT ON
  satellite_imagery,
  wildfire_perimeters,
  burn_severity_layers,
  vegetation_indices,
  dem_layers,
  land_cover_layers,
  hydrology_layers,
  water_quality_readings,
  weather_data,
  change_detection_results,
  field_observations,
  sampling_locations,
  ml_predictions,
  alerts
TO ingest;

-- ---------------------------------------------------------------------------
-- viewer: read-only access (same as analyst)
-- Viewers are used by public-facing dashboards that should never modify data.
-- Keeping viewer separate from analyst allows future permission divergence
-- (e.g. restricting viewers from certain sensitive tables).
-- ---------------------------------------------------------------------------
GRANT SELECT ON
  satellite_imagery,
  wildfire_perimeters,
  burn_severity_layers,
  vegetation_indices,
  dem_layers,
  land_cover_layers,
  hydrology_layers,
  water_quality_readings,
  weather_data,
  change_detection_results,
  field_observations,
  sampling_locations,
  ml_predictions,
  alerts
TO viewer;
