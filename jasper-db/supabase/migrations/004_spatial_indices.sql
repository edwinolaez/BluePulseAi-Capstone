-- Project Jasper - Sprint 2 Spatial Indexes
-- Owner: Rahil Khan

CREATE INDEX IF NOT EXISTS idx_environmental_layers_coordinates_gist
ON environmental_layers USING GIST (coordinates);

CREATE INDEX IF NOT EXISTS idx_environmental_layers_geometry_gist
ON environmental_layers USING GIST (geometry);