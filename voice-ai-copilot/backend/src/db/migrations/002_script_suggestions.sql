-- Add script suggestions output column to analysis_results
ALTER TABLE analysis_results
  ADD COLUMN IF NOT EXISTS script_suggestions JSONB NOT NULL DEFAULT '[]';
