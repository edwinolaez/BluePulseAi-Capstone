-- =============================================================================
-- Query: Sector Radius Lookup
-- Project: Jasper
--
-- What this query does:
--   Returns the 100 most-recent environmental layers whose GPS coordinates
--   fall within a caller-specified radius of a given map point.  It is the
--   parameterised version of the benchmark query (query_benchmark.sql) —
--   same logic, but with bind parameters instead of hard-coded values so the
--   same SQL can be reused for any map click.
--
-- Parameters (pass as named bind variables from the application):
--   :longitude     — longitude of the centre point (e.g. -118.0814)
--   :latitude      — latitude  of the centre point (e.g.  52.8737)
--   :radius_meters — search radius in metres       (e.g.  5000)
--
-- Expected caller:
--   The Next.js API route (or a Supabase Edge Function) that handles map
--   click events.  It extracts the clicked coordinates and desired radius
--   from the frontend request, then runs this query against Supabase.
--
-- How ST_DWithin works here:
--   ST_DWithin(coordinates::geography, reference_point::geography, radius)
--   - coordinates is cast to ::geography so distances are in metres on the
--     Earth's surface (rather than degrees, which would vary by latitude).
--   - ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326) builds a WGS84
--     point from the caller's coordinates.  Note: ST_MakePoint takes
--     longitude FIRST, then latitude — the opposite of the usual (lat, lon)
--     convention used in most APIs.
--   - :radius_meters is the maximum allowed distance in metres.
--
-- Result set:
--   Up to 100 rows, newest first, including all fields the dashboard card
--   needs to render: id, sector_id, layer_type, risk_score, risk_label,
--   data_source, timestamp, and the raw payload blob.
-- =============================================================================

SELECT
  id,
  sector_id,
  layer_type,
  risk_score,
  risk_label,
  data_source,
  timestamp,
  payload                               -- full JSON metadata blob for detail views
FROM environmental_layers
WHERE ST_DWithin(
  coordinates::geography,               -- cast to geography for metre-based distance
  ST_SetSRID(
    ST_MakePoint(:longitude, :latitude),-- note: longitude comes BEFORE latitude in PostGIS
    4326                                -- WGS84 — standard GPS coordinate system
  )::geography,
  :radius_meters                        -- search radius in metres supplied by the caller
)
ORDER BY timestamp DESC                 -- newest data first — matches composite index in migration 005
LIMIT 100;                              -- prevent unbounded result sets
