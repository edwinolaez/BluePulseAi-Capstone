-- =============================================================================
-- Migration 003 — Fix ml_predictions.risk_label CHECK to Title Case
-- Project: Jasper  |  Owner: Rahil Khan  |  Sprint: 2
--
-- What this migration does:
--   Updates the CHECK constraint on the risk_label column of ml_predictions
--   from lowercase values ('low', 'medium', 'high', 'critical') to Title Case
--   ('Low', 'Medium', 'High', 'Critical').
--
-- Why it was needed:
--   The original schema (migration 001) assumed lowercase risk labels.
--   However, the ML model code (model_endpoint.py, erosion_model.py,
--   contaminant_model.py) outputs Title Case labels ('High', 'Medium', 'Low').
--   Every INSERT from the ML API was failing with a constraint violation
--   because 'High' != 'high'.
--
--   Rather than changing the Python code (which would break the frontend
--   TypeScript types), we update the database constraint to match reality.
-- =============================================================================

-- Step 1: Drop the old lowercase constraint.
-- IF NOT EXISTS is not available on DROP CONSTRAINT, so we use DROP ... IF EXISTS
-- to make this migration safe to re-run.
ALTER TABLE ml_predictions
  DROP CONSTRAINT IF EXISTS ml_predictions_risk_label_check;

-- Step 2: Add the corrected Title Case constraint.
-- 'Critical' is included even though the ML models currently only output
-- High/Medium/Low, so the constraint won't need another migration if a
-- 'Critical' tier is added in the future.
ALTER TABLE ml_predictions
  ADD CONSTRAINT ml_predictions_risk_label_check
  CHECK (risk_label IN ('Low', 'Medium', 'High', 'Critical'));
