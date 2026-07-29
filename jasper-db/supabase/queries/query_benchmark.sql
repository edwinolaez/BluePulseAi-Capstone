-- =============================================================================
-- Query: Spatial Proximity Benchmark
-- Project: Jasper  |  Sprint: 3
-- Target performance: under 500 ms on the production Supabase instance
--
-- What this query does:
--   Retrieves the 100 most-recent environmental layers located within 5 km
--   of the Jasper townsite (lon -118.0814, lat 52.8737) and returns their
--   key fields ordered newest-first.
--
-- Why it exists:
--   This is the "hot path" query that the dashboard's sector panel fires every
--   time a user clicks a sector on the map.  If it runs slowly, the whole UI
--   feels sluggish.  We use EXPLAIN ANALYZE to capture the actual query plan
--   and execution time so we can confirm the spatial index (migration 004)
--   is being used and the < 500 ms SLA is met.
--
-- How to interpret EXPLAIN ANALYZE output:
--   - Look for "Index Scan using idx_environmental_layers_coordinates_gist"
--     to confirm the GIST index is being used.
--   - The "actual time" on the topmost node is the total execution time.
--     If it's > 500 ms, check that the GIST and composite indexes both exist.
--   - "rows=..." shows how many rows were processed at each step.
--
-- ST_DWithin explanation:
--   ST_DWithin(a::geography, b::geography, distance_metres)
--   returns true when the great-circle distance between a and b is ≤ distance_metres.
--   Casting to ::geography (vs ::geometry) makes the distance calculation use
--   metres on the Earth's surface rather than degrees — critical for accuracy
--   at the 5 km scale.
--   ST_SetSRID(ST_MakePoint(lon, lat), 4326) constructs a WGS84 point from
--   the hard-coded Jasper coordinates.
-- =============================================================================

EXPLAIN ANALYZE          -- show the query plan AND run it to get real timings
SELECT
  id,
  sector_id,
  layer_type,
  risk_score,
  risk_label,
  data_source,
  timestamp
FROM environmental_layers
WHERE ST_DWithin(
  coordinates::geography,          -- cast Point geometry to geography for metre-based distance
  ST_SetSRID(
    ST_MakePoint(-118.0814, 52.8737),  -- Jasper townsite: lon first, then lat (PostGIS convention)
    4326                               -- WGS84 coordinate system
  )::geography,
  5000                               -- 5000 metres = 5 km search radius
)
ORDER BY timestamp DESC              -- newest layers first (matches composite index direction)
LIMIT 100;                           -- cap at 100 rows to keep response size bounded
