-- 0003_cohort_provision_request: remember how a cohort was requested so a failed provisioning can be retried.
-- Cleared once the cohort is running.
ALTER TABLE core.cohorts ADD COLUMN IF NOT EXISTS provision_request jsonb;
