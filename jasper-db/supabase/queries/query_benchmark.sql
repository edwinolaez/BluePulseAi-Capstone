-- Project Jasper - Sprint 3 Spatial Query Benchmark
-- Target: under 500ms

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
WHERE ST_DWithin(
  coordinates::geography,
  ST_SetSRID(ST_MakePoint(-118.0814, 52.8737), 4326)::geography,
  5000
)
ORDER BY timestamp DESC
LIMIT 100;