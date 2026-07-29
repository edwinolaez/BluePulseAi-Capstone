-- =============================================================================
-- Migration 004 — Spatial Indexes on environmental_layers
-- Project: Jasper  |  Owner: Rahil Khan  |  Sprint: 2
--
-- What this migration does:
--   Adds GIST spatial indexes to the two geometry columns of the
--   environmental_layers table (created in migration 007).
--
--   Without spatial indexes, every call to ST_DWithin (find rows within N
--   metres of a point) requires a full table scan — O(n).  With a GIST index
--   PostGIS can answer the same query in O(log n) using R-tree bounding-box
--   filtering before the exact distance check.
--
--   Two geometry columns need separate indexes:
--     coordinates — Point geometry; used for proximity queries (ST_DWithin)
--     geometry    — Generic geometry (polygon/line); used for overlap queries
--                   (ST_Intersects, ST_Contains)
--
-- Note: migration 007 creates the environmental_layers table, but Supabase
-- runs migrations in order so 004 must be applied before 007.  Because both
-- use CREATE INDEX IF NOT EXISTS the order only matters for the first run.
-- =============================================================================

-- Spatial index on the point-coordinate column.
-- Enables fast "find all layers within X metres of this GPS point" queries.
CREATE INDEX IF NOT EXISTS idx_environmental_layers_coordinates_gist
ON environmental_layers USING GIST (coordinates);

-- Spatial index on the generic geometry column.
-- Enables fast polygon-based queries such as "which layers intersect
-- this sector boundary polygon?"
CREATE INDEX IF NOT EXISTS idx_environmental_layers_geometry_gist
ON environmental_layers USING GIST (geometry);
