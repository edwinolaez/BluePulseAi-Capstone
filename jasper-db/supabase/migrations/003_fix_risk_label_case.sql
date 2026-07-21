-- Project Jasper - Sprint 2: Fix ml_predictions risk_label to Title Case
-- Owner: Rahil Khan
-- Reason: Richard's ML models output 'High', 'Medium', 'Low' (Title Case).
--         Original CHECK used lowercase which caused constraint violations on insert.

ALTER TABLE ml_predictions
  DROP CONSTRAINT IF EXISTS ml_predictions_risk_label_check;

ALTER TABLE ml_predictions
  ADD CONSTRAINT ml_predictions_risk_label_check
  CHECK (risk_label IN ('Low', 'Medium', 'High', 'Critical'));
