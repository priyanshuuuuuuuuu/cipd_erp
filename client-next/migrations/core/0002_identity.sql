-- 0002_identity: one global account per person, cohort memberships, review queue for merged accounts, programs.
-- Per-cohort `users` rows stay (they are the FK targets of every cohort table) but are tied to an account and to a
-- membership in THAT cohort (see migrations/cohort/0003_membership_fk.sql).
-- Data is loaded by scripts/backfill-identity.mjs (needs judgement + a dry run), not by this file.

CREATE TABLE IF NOT EXISTS core.accounts (
  id            uuid PRIMARY KEY,                          -- = users.id in the cohort schemas
  merged_into   uuid REFERENCES core.accounts(id),         -- NULL = canonical; otherwise an alias of that account
  email         text NOT NULL,
  password_hash text NOT NULL,
  role          core.user_role NOT NULL,
  first_name    text,
  last_name     text,
  enrollment_no text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CHECK (merged_into IS NULL OR merged_into <> id)
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_canonical_uq
  ON core.accounts (lower(email)) WHERE merged_into IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_enrollment_canonical_uq
  ON core.accounts (enrollment_no) WHERE merged_into IS NULL AND enrollment_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS accounts_merged_into_idx ON core.accounts (merged_into) WHERE merged_into IS NOT NULL;

DO $$ BEGIN
  CREATE TYPE core.membership_status AS ENUM ('active','completed','transferred_out','withdrawn');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS core.cohort_memberships (
  account_id uuid     NOT NULL REFERENCES core.accounts(id) ON DELETE RESTRICT,
  cohort_id  smallint NOT NULL REFERENCES core.cohorts(id)  ON DELETE RESTRICT,
  status     core.membership_status NOT NULL DEFAULT 'active',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  left_at    timestamptz,
  note       text,
  PRIMARY KEY (account_id, cohort_id)
);
CREATE INDEX IF NOT EXISTS cohort_memberships_cohort_idx ON core.cohort_memberships (cohort_id, status);

-- Cases the backfill could not (or should not) decide alone. An admin reviews these.
CREATE TABLE IF NOT EXISTS core.account_conflicts (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  kind       text NOT NULL,
  details    jsonb NOT NULL,
  resolved   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS core.programs (
  id   smallint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL UNIQUE
);
