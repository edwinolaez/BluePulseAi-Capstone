-- Project Jasper - Sprint 1 RBAC Roles
-- Owner: Rahil Khan

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'admin') THEN CREATE ROLE admin; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'analyst') THEN CREATE ROLE analyst; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ingest') THEN CREATE ROLE ingest; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'viewer') THEN CREATE ROLE viewer; END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO admin, analyst, ingest, viewer;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO admin;

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