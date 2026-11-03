-- 0003_membership_fk: every users row in a cohort schema must belong to that cohort.
--   * users.cohort_id (defaults to this cohort, CHECKed to equal it)
--   * composite FK (id, cohort_id) -> core.cohort_memberships(account_id, cohort_id)
--   * students.program_id -> core.programs
-- Requires scripts/backfill-identity.mjs to have created a membership for every existing users row; the
-- guard below fails the migration (rolling it back) otherwise.

DO $$
DECLARE v_missing bigint;
BEGIN
  IF to_regclass('core.cohort_memberships') IS NULL THEN
    RAISE EXCEPTION '0003 needs core/0002_identity to be applied first';
  END IF;
  EXECUTE format(
    'SELECT count(*) FROM %I.users u WHERE NOT EXISTS (
       SELECT 1 FROM core.cohort_memberships m WHERE m.account_id = u.id AND m.cohort_id = %s)',
    {{schema_literal}}, {{cohort_id}}) INTO v_missing;
  IF v_missing > 0 THEN
    RAISE EXCEPTION '% users row(s) in % have no membership: run scripts/backfill-identity.mjs --apply first',
      v_missing, {{schema_literal}};
  END IF;
END $$;

ALTER TABLE users ADD COLUMN IF NOT EXISTS cohort_id smallint;
UPDATE users SET cohort_id = {{cohort_id}} WHERE cohort_id IS DISTINCT FROM {{cohort_id}};
ALTER TABLE users ALTER COLUMN cohort_id SET DEFAULT {{cohort_id}};
ALTER TABLE users ALTER COLUMN cohort_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_cohort_is_this' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_cohort_is_this CHECK (cohort_id = {{cohort_id}});
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_membership_fk' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_membership_fk FOREIGN KEY (id, cohort_id)
      REFERENCES core.cohort_memberships (account_id, cohort_id) ON DELETE RESTRICT;
  END IF;
END $$;

ALTER TABLE students ADD COLUMN IF NOT EXISTS program_id smallint REFERENCES core.programs(id);
