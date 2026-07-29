-- =============================================================================
-- Migration 001 — Initial Schema
-- Project: Jasper  |  Owner: Rahil Khan  |  Sprint: 1
-- Database: Supabase + PostGIS
--
-- What this migration does:
--   Creates every core table for the Jasper platform in one shot.  This is
--   the foundation everything else builds on.  It covers:
--     - profiles          : user accounts and their role (admin/analyst/ingest/viewer)
--     - satellite_imagery : catalogue of Landsat/Sentinel scenes ingested
--     - wildfire_perimeters : fire boundary polygons from CWFIS / FIRMS
--     - burn_severity_layers : per-sector burn intensity derived from imagery
--     - vegetation_indices   : NDVI and other spectral health metrics over time
--     - dem_layers            : Digital Elevation Model metadata (SRTM etc.)
--     - land_cover_layers     : land-use classification polygons
--     - hydrology_layers      : rivers, lakes, and drainage features
--     - water_quality_readings: sensor readings (pH, turbidity, dissolved O2…)
--     - weather_data          : precipitation, temperature, wind from EC stations
--     - change_detection_results : outputs from the ML change-detection pipeline
--     - field_observations    : notes recorded by field crews on-site
--     - sampling_locations    : named GPS points where samples are collected
--     - ml_predictions        : risk scores and labels from all ML models
--     - alerts                : triggered notifications for high-risk events
--
--   After each table a set of B-tree indexes on sector_id enables fast
--   sector-based lookups.  A second set of GIST spatial indexes (at the bottom)
--   enables efficient geographic queries (ST_DWithin, ST_Intersects, etc.)
--   using PostGIS.
-- =============================================================================

-- Make sure PostGIS and pgcrypto are available.
-- PostGIS provides geometry types and spatial functions.
-- pgcrypto provides gen_random_uuid() used as the default primary key.
SET search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- ---------------------------------------------------------------------------
-- profiles
-- One row per registered user.  The role column drives the RBAC policies
-- defined in later migrations (002 and 007).
-- auth_user_id links to Supabase Auth so we can join JWT identity to profile.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,              -- foreign key to auth.users (Supabase managed)
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'analyst', 'ingest', 'viewer')),
  organization TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- satellite_imagery
-- Catalogue entry for every satellite scene that has been ingested.
-- The footprint geometry stores the bounding polygon of the scene so we can
-- do spatial queries like "find all scenes that cover this sector".
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS satellite_imagery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id TEXT NOT NULL,                -- platform-specific ID (e.g. Landsat scene path/row)
  source_platform TEXT NOT NULL,         -- e.g. "Landsat-8", "Sentinel-2"
  acquisition_date DATE NOT NULL,
  cloud_coverage DOUBLE PRECISION,       -- 0–100%
  image_url TEXT,                        -- URL to the stored GeoTIFF
  footprint geometry(Polygon, 4326),     -- bounding polygon in WGS84 (EPSG:4326)
  payload JSONB DEFAULT '{}'::jsonb,     -- catch-all for extra metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- wildfire_perimeters
-- Burned area boundaries sourced from CWFIS, NASA FIRMS, or field GPS.
-- MultiPolygon because a single named fire can have multiple disjoint patches.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wildfire_perimeters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fire_name TEXT NOT NULL,
  source_platform TEXT,
  perimeter_date DATE,
  area_sq_km DOUBLE PRECISION,
  perimeter_geometry geometry(MultiPolygon, 4326),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- burn_severity_layers
-- Per-sector burn intensity classification derived from pre/post-fire imagery.
-- Linked to the source satellite_imagery row for traceability.
-- severity_label is lowercase here; migration 003 updates the CHECK to allow
-- Title Case (to match ML model output).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS burn_severity_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  severity_score DOUBLE PRECISION,
  severity_label TEXT CHECK (severity_label IN ('low', 'moderate', 'high', 'extreme')),
  source_imagery_id UUID REFERENCES satellite_imagery(id),  -- which scene this came from
  layer_geometry geometry(MultiPolygon, 4326),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- vegetation_indices
-- Time-series of spectral indices (NDVI, NBR, etc.) for each sector.
-- index_value is the current measurement; baseline_value is the pre-fire
-- reference; change_value = index_value - baseline_value.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vegetation_indices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  index_type TEXT NOT NULL,              -- e.g. "NDVI", "NBR", "EVI"
  index_value DOUBLE PRECISION,
  baseline_value DOUBLE PRECISION,       -- pre-fire reference
  change_value DOUBLE PRECISION,         -- delta from baseline (negative = vegetation loss)
  source_imagery_id UUID REFERENCES satellite_imagery(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  location geometry(Point, 4326),        -- centroid of the measurement
  payload JSONB DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- dem_layers
-- Metadata for Digital Elevation Model datasets (SRTM, ArcticDEM, etc.).
-- The actual raster data is stored externally; raster_url links to it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dem_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_name TEXT NOT NULL,
  source_platform TEXT,                  -- e.g. "SRTM 30m", "ArcticDEM"
  resolution_meters DOUBLE PRECISION,    -- ground sampling distance
  raster_url TEXT,                       -- URL to the hosted raster file
  boundary geometry(MultiPolygon, 4326), -- area covered by this DEM tile
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- land_cover_layers
-- Land-use classification polygons (forest, urban, wetland, etc.).
-- Used to contextualise burn severity and erosion risk.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS land_cover_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_name TEXT NOT NULL,
  source_platform TEXT,
  land_cover_class TEXT,                 -- e.g. "Coniferous Forest", "Wetland"
  layer_geometry geometry(MultiPolygon, 4326),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- hydrology_layers
-- Rivers, lakes, streams, and drainage divides.
-- feature_geometry uses generic Geometry (not MultiPolygon) because rivers
-- are linestrings and lakes are polygons — we store both in the same table.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS hydrology_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  feature_type TEXT NOT NULL,            -- e.g. "river", "lake", "watershed_divide"
  source_platform TEXT,
  feature_geometry geometry(Geometry, 4326),  -- accepts any geometry type
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- water_quality_readings
-- Sensor readings from in-river instruments and field sampling.
-- Each row is a single point-in-time measurement at a geographic location.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS water_quality_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id TEXT,                       -- physical sensor station ID
  sector_id TEXT,
  ph DOUBLE PRECISION,                   -- acidity, typically 6.5–8.5 for healthy water
  turbidity DOUBLE PRECISION,            -- cloudiness in NTU; high after erosion events
  dissolved_oxygen DOUBLE PRECISION,     -- mg/L; low values harm aquatic life
  conductivity DOUBLE PRECISION,         -- µS/cm; indicates dissolved ion load
  water_temperature_c DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  location geometry(Point, 4326),
  payload JSONB DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- weather_data
-- Meteorological observations from Environment Canada stations and IoT sensors.
-- Used as inputs to erosion simulations and alerts.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weather_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id TEXT,
  sector_id TEXT,
  precipitation_mm DOUBLE PRECISION,
  temperature_c DOUBLE PRECISION,
  wind_speed_kmh DOUBLE PRECISION,
  humidity_percent DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  location geometry(Point, 4326),
  payload JSONB DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- change_detection_results
-- Output rows from the ML change-detection pipeline (change_detection/predict.py).
-- Links back to the before/after satellite imagery that drove the result.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS change_detection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  baseline_date DATE NOT NULL,           -- date of the pre-fire reference image
  comparison_date DATE NOT NULL,         -- date of the post-fire image
  change_type TEXT NOT NULL,             -- e.g. "burn_scar", "vegetation_loss"
  change_score DOUBLE PRECISION,         -- 0–1 magnitude of detected change
  source_before_id UUID REFERENCES satellite_imagery(id),
  source_after_id UUID REFERENCES satellite_imagery(id),
  change_geometry geometry(MultiPolygon, 4326),  -- area where change was detected
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- field_observations
-- Unstructured notes and photos from field crews on the ground.
-- observer_name is free text rather than a foreign key so that observations
-- can be logged even for non-system users (e.g. contracted field workers).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observer_name TEXT,
  sector_id TEXT,
  observation_type TEXT NOT NULL,        -- e.g. "erosion", "water_discoloration", "debris"
  notes TEXT,
  observed_at TIMESTAMPTZ DEFAULT NOW(),
  location geometry(Point, 4326),
  payload JSONB DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- sampling_locations
-- Named, permanent GPS waypoints used for repeated water and soil sampling.
-- sample_code is unique so field crews can reference them by code on paper forms.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sampling_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_code TEXT UNIQUE,               -- short code printed on sample bottles
  sector_id TEXT,
  sample_type TEXT,                      -- e.g. "water", "soil", "sediment"
  description TEXT,
  location geometry(Point, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB DEFAULT '{}'::jsonb
);

-- ---------------------------------------------------------------------------
-- ml_predictions
-- Stores every risk prediction returned by the three ML API endpoints.
-- risk_label originally used lowercase (see migration 003 for the fix to
-- Title Case, which matches what the ML models actually output).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ml_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  model_name TEXT NOT NULL,              -- e.g. "change_detection", "erosion", "contaminant"
  model_version TEXT,                    -- e.g. "v1.0"
  prediction_type TEXT NOT NULL,
  confidence DOUBLE PRECISION,           -- 0–1 model confidence
  risk_score DOUBLE PRECISION,           -- 0–1 continuous risk level
  risk_label TEXT CHECK (risk_label IN ('low', 'medium', 'high', 'critical')),
  prediction_geometry geometry(MultiPolygon, 4326),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- alerts
-- System-generated notifications triggered when risk thresholds are crossed.
-- is_resolved / resolved_at track the alert lifecycle.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,              -- e.g. "high_erosion_risk", "contaminant_detected"
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,              -- NULL until the alert is cleared
  payload JSONB DEFAULT '{}'::jsonb
);

-- =============================================================================
-- B-tree indexes on sector_id
-- Most queries filter or join on sector_id, so an index on this column is
-- essential for performance.  IF NOT EXISTS prevents errors on re-runs.
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_satellite_scene ON satellite_imagery(scene_id);
CREATE INDEX IF NOT EXISTS idx_burn_sector ON burn_severity_layers(sector_id);
CREATE INDEX IF NOT EXISTS idx_vegetation_sector ON vegetation_indices(sector_id);
CREATE INDEX IF NOT EXISTS idx_water_sector ON water_quality_readings(sector_id);
CREATE INDEX IF NOT EXISTS idx_weather_sector ON weather_data(sector_id);
CREATE INDEX IF NOT EXISTS idx_change_sector ON change_detection_results(sector_id);
CREATE INDEX IF NOT EXISTS idx_field_sector ON field_observations(sector_id);
CREATE INDEX IF NOT EXISTS idx_sampling_sector ON sampling_locations(sector_id);
CREATE INDEX IF NOT EXISTS idx_ml_sector ON ml_predictions(sector_id);
CREATE INDEX IF NOT EXISTS idx_alert_sector ON alerts(sector_id);

-- =============================================================================
-- GIST spatial indexes
-- GIST (Generalized Search Tree) is the index type required by PostGIS for
-- geometry columns.  It enables fast bounding-box and proximity queries such
-- as ST_DWithin (find rows within N metres) and ST_Intersects.
-- Without these, every spatial query requires a full table scan.
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_satellite_footprint ON satellite_imagery USING GIST(footprint);
CREATE INDEX IF NOT EXISTS idx_wildfire_perimeter_geom ON wildfire_perimeters USING GIST(perimeter_geometry);
CREATE INDEX IF NOT EXISTS idx_burn_geom ON burn_severity_layers USING GIST(layer_geometry);
CREATE INDEX IF NOT EXISTS idx_vegetation_location ON vegetation_indices USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_dem_boundary ON dem_layers USING GIST(boundary);
CREATE INDEX IF NOT EXISTS idx_land_cover_geom ON land_cover_layers USING GIST(layer_geometry);
CREATE INDEX IF NOT EXISTS idx_hydrology_geom ON hydrology_layers USING GIST(feature_geometry);
CREATE INDEX IF NOT EXISTS idx_water_location ON water_quality_readings USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_weather_location ON weather_data USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_change_geom ON change_detection_results USING GIST(change_geometry);
CREATE INDEX IF NOT EXISTS idx_field_location ON field_observations USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_sampling_location ON sampling_locations USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_prediction_geom ON ml_predictions USING GIST(prediction_geometry);
