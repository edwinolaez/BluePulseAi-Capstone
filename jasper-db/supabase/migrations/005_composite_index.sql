-- Project Jasper - Sprint 3 Composite Index
-- Improves sector queries

CREATE INDEX IF NOT EXISTS idx_environmental_layers_sector_type_timestamp
ON environmental_layers (
    sector_id,
    layer_type,
    timestamp DESC
);