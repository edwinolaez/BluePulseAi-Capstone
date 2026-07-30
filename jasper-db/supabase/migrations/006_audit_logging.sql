-- =============================================================================
-- Migration 006 — Audit Logging Columns
-- Project: Jasper  |  Sprint: 3
--
-- What this migration does:
--   Adds two audit columns — user_id and updated_at — to the three main
--   operational tables:
--     - environmental_layers   (sensor/ML layer data)
--     - water_quality_archive  (historical water readings)
--     - ml_model_outputs       (ML prediction results)
--
--   user_id   records which user or service account last wrote to the row.
--             This is the email or UUID from the caller's JWT, captured by
--             the application layer before INSERT/UPDATE.
--   updated_at records when the row was last modified.
--             Defaults to NOW() so it's populated automatically on INSERT.
--             Application code should also set it on UPDATE.
--
-- Why these columns?
--   The SAIT instructor review flagged the absence of audit trails as a
--   security gap.  These columns are the minimal fix: they let admins answer
--   "who wrote this row and when?" without adding a separate audit log table.
--   Full audit logging (capturing old/new values on every change) would
--   require triggers and is tracked as a future sprint item.
--
-- IF NOT EXISTS makes each ADD COLUMN idempotent — safe to re-run.
-- =============================================================================

-- Add audit columns to environmental_layers
ALTER TABLE environmental_layers
ADD COLUMN IF NOT EXISTS user_id TEXT,           -- who last wrote this row
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(); -- when it was last changed

-- Add audit columns to water_quality_archive
ALTER TABLE water_quality_archive
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add audit columns to ml_model_outputs
ALTER TABLE ml_model_outputs
ADD COLUMN IF NOT EXISTS user_id TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
