-- Project Jasper - Sprint 3 Spatial Query Benchmark
-- Target: under 500ms
-- I used this query to benchmark spatial performance and verify that our geographic searches met the project's performance requirements.

/** Measures execution time. */
EXPLAIN ANALYZE
SELECT
  id,
  sector_id,
  layer_type,
  risk_score,
  risk_label,
  data_source,
  timestamp
FROM environmental_layers
/** ST_DWithin finds records within a given distance. */
WHERE ST_DWithin(
  coordinates::geography,
  ST_SetSRID(ST_MakePoint(-118.0814, 52.8737), 4326)::geography,
  5000
)
ORDER BY timestamp DESC
LIMIT 100;