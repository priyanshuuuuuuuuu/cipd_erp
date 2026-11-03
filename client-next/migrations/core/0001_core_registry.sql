-- 0001_core_registry: central `core` schema (cohort registry, migration ledger, shared enum types).
-- Idempotent. Applied by `npm run migrate` (scripts/migrate.mjs) inside a transaction.
-- Legacy `public.cohorts` is intentionally left in place until Phase 5 is deployed.

CREATE SCHEMA IF NOT EXISTS core;

DO $$ BEGIN
  CREATE TYPE core.cohort_status AS ENUM ('provisioning','running','archived','failed','deleting');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS core.cohorts (
  id             smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schema_name    text NOT NULL UNIQUE CHECK (schema_name ~ '^[a-z][a-z0-9_]{2,40}$'),
  label          text NOT NULL CHECK (length(trim(label)) > 0),
  program        text,
  starts_on      date,
  ends_on        date,
  status         core.cohort_status NOT NULL DEFAULT 'provisioning',
  is_default     boolean NOT NULL DEFAULT false,
  is_legacy      boolean NOT NULL DEFAULT false,
  schema_version text,
  last_error     text,
  created_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on),
  CHECK (NOT is_default OR status = 'running')
);
CREATE UNIQUE INDEX IF NOT EXISTS cohorts_single_default ON core.cohorts ((true)) WHERE is_default;

CREATE TABLE IF NOT EXISTS core.schema_migrations (
  scope      text NOT NULL,                 -- 'core' or a cohort schema_name
  version    text NOT NULL,
  checksum   text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  executed   boolean NOT NULL DEFAULT true, -- false = marked as applied without running (baseline)
  PRIMARY KEY (scope, version)
);

-- Seed from the existing cohorts. `public` and `july` are archived legacy cohorts;
-- `junedecember2026` is the running default. Dates come from the session ranges on the VM.
INSERT INTO core.cohorts (schema_name, label, starts_on, ends_on, status, is_default, is_legacy)
VALUES ('public',           'Winter 2026',        '2026-01-05', '2026-07-01', 'archived', false, true),
       ('july',             'July 2026',          '2026-06-29', '2026-10-09', 'archived', false, true),
       ('junedecember2026', 'June-December 2026', '2026-10-19', NULL,         'running',  true,  false)
ON CONFLICT (schema_name) DO NOTHING;

-- Shared enum types move out of the legacy cohort schema. Columns reference types by OID, so this is safe.
DO $$ BEGIN
  IF to_regtype('public.user_role') IS NOT NULL THEN ALTER TYPE public.user_role SET SCHEMA core; END IF;
  IF to_regtype('public.session_status') IS NOT NULL THEN ALTER TYPE public.session_status SET SCHEMA core; END IF;
  IF to_regtype('public.attendance_status') IS NOT NULL THEN ALTER TYPE public.attendance_status SET SCHEMA core; END IF;
  IF to_regtype('public.feedback_question_type') IS NOT NULL THEN ALTER TYPE public.feedback_question_type SET SCHEMA core; END IF;
END $$;
