-- 0004_cohort_roll_numbers: per-cohort roll-number prefix and the counter used to hand out sequence numbers.
-- roll_no_prefix NULL = roll numbers are not generated for this cohort.
-- roll_no_next is the next sequence number to hand out. It is only advanced by a single
-- UPDATE ... RETURNING inside the transaction that inserts the student, so the row lock serialises concurrent
-- creations and a rolled-back student never consumes a number.
ALTER TABLE core.cohorts ADD COLUMN IF NOT EXISTS roll_no_prefix text;
ALTER TABLE core.cohorts ADD COLUMN IF NOT EXISTS roll_no_next integer NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cohorts_roll_no_prefix_check' AND conrelid = 'core.cohorts'::regclass) THEN
    ALTER TABLE core.cohorts ADD CONSTRAINT cohorts_roll_no_prefix_check
      CHECK (roll_no_prefix IS NULL OR roll_no_prefix ~ '^[A-Za-z0-9._/-]{1,20}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'cohorts_roll_no_next_check' AND conrelid = 'core.cohorts'::regclass) THEN
    ALTER TABLE core.cohorts ADD CONSTRAINT cohorts_roll_no_next_check CHECK (roll_no_next >= 1);
  END IF;
END $$;
