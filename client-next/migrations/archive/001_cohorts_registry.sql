-- Cohort registry: replaces COHORT_SCHEMAS / COHORT_LABELS env vars.
-- Run once:  psql "$DATABASE_URL" -f migrations/001_cohorts_registry.sql

CREATE TABLE IF NOT EXISTS public.cohorts (
  schema_name text PRIMARY KEY CHECK (schema_name ~ '^[a-z][a-z0-9_]{2,40}$'),
  label       text NOT NULL,
  is_active   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid
);

-- Exactly one active cohort at a time.
CREATE UNIQUE INDEX IF NOT EXISTS cohorts_single_active
  ON public.cohorts ((true)) WHERE is_active;

-- Seed the existing cohort as the active one.
INSERT INTO public.cohorts (schema_name, label, is_active)
VALUES ('july', 'July', true)
ON CONFLICT (schema_name) DO NOTHING;
