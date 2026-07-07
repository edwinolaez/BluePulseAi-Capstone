-- Sector radius lookup using PostGIS ST_DWithin
-- Params:
--   :longitude
--   :latitude
--   :radius_meters

SELECT
  id,
  sector_id,
  layer_type,
  risk_score,
  risk_label,
  data_source,
  timestamp,
  payload
FROM environmental_layers
WHERE ST_DWithin(
  coordinates::geography,
  ST_SetSRID(ST_MakePoint(:longitude, :latitude), 4326)::geography,
  :radius_meters
)
ORDER BY timestamp DESC
LIMIT 100;