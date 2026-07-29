-- =============================================================================
-- Migration 005 — Composite Index for Sector Queries
-- Project: Jasper  |  Sprint: 3
--
-- What this migration does:
--   Adds a single composite B-tree index on (sector_id, layer_type, timestamp DESC)
--   to the environmental_layers table.
--
-- Why a composite index?
--   The most common dashboard query pattern is:
--     "Give me the latest N layers of type X for sector Y, ordered by time."
--   A single-column index on sector_id helps filter to the right sector, but
--   the database still has to scan every row in that sector, sort by layer_type,
--   and then sort by timestamp.
--
--   A composite index on all three columns lets PostgreSQL satisfy this entire
--   WHERE + ORDER BY in a single index scan with no sort step.  This is the
--   primary reason the query_benchmark.sql target is < 500 ms.
--
-- Index column order matters:
--   1. sector_id  — most selective filter (reduces rows drastically)
--   2. layer_type — secondary filter (further narrows the result set)
--   3. timestamp DESC — matches the ORDER BY direction so no sort is needed
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_environmental_layers_sector_type_timestamp
ON environmental_layers (
    sector_id,
    layer_type,
    timestamp DESC   -- DESC matches the "ORDER BY timestamp DESC" in typical queries
);
