-- Project Jasper - Client-Aligned Sprint 1 Schema
-- Owner: Rahil Khan
-- Database: Supabase + PostGIS

SET search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'analyst', 'ingest', 'viewer')),
  organization TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS satellite_imagery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id TEXT NOT NULL,
  source_platform TEXT NOT NULL,
  acquisition_date DATE NOT NULL,
  cloud_coverage DOUBLE PRECISION,
  image_url TEXT,
  footprint geometry(Polygon, 4326),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS burn_severity_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  severity_score DOUBLE PRECISION,
  severity_label TEXT CHECK (severity_label IN ('low', 'moderate', 'high', 'extreme')),
  source_imagery_id UUID REFERENCES satellite_imagery(id),
  layer_geometry geometry(MultiPolygon, 4326),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vegetation_indices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  index_type TEXT NOT NULL,
  index_value DOUBLE PRECISION,
  baseline_value DOUBLE PRECISION,
  change_value DOUBLE PRECISION,
  source_imagery_id UUID REFERENCES satellite_imagery(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  location geometry(Point, 4326),
  payload JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS dem_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_name TEXT NOT NULL,
  source_platform TEXT,
  resolution_meters DOUBLE PRECISION,
  raster_url TEXT,
  boundary geometry(MultiPolygon, 4326),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS land_cover_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_name TEXT NOT NULL,
  source_platform TEXT,
  land_cover_class TEXT,
  layer_geometry geometry(MultiPolygon, 4326),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hydrology_layers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  feature_type TEXT NOT NULL,
  source_platform TEXT,
  feature_geometry geometry(Geometry, 4326),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS water_quality_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id TEXT,
  sector_id TEXT,
  ph DOUBLE PRECISION,
  turbidity DOUBLE PRECISION,
  dissolved_oxygen DOUBLE PRECISION,
  conductivity DOUBLE PRECISION,
  water_temperature_c DOUBLE PRECISION,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  location geometry(Point, 4326),
  payload JSONB DEFAULT '{}'::jsonb
);

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

CREATE TABLE IF NOT EXISTS change_detection_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  baseline_date DATE NOT NULL,
  comparison_date DATE NOT NULL,
  change_type TEXT NOT NULL,
  change_score DOUBLE PRECISION,
  source_before_id UUID REFERENCES satellite_imagery(id),
  source_after_id UUID REFERENCES satellite_imagery(id),
  change_geometry geometry(MultiPolygon, 4326),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS field_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  observer_name TEXT,
  sector_id TEXT,
  observation_type TEXT NOT NULL,
  notes TEXT,
  observed_at TIMESTAMPTZ DEFAULT NOW(),
  location geometry(Point, 4326),
  payload JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS sampling_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sample_code TEXT UNIQUE,
  sector_id TEXT,
  sample_type TEXT,
  description TEXT,
  location geometry(Point, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ml_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT,
  prediction_type TEXT NOT NULL,
  confidence DOUBLE PRECISION,
  risk_score DOUBLE PRECISION,
  risk_label TEXT CHECK (risk_label IN ('low', 'medium', 'high', 'critical')),
  prediction_geometry geometry(MultiPolygon, 4326),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  message TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  payload JSONB DEFAULT '{}'::jsonb
);

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