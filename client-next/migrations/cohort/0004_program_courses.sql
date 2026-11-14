-- 0004_program_courses: assign cohort-local courses to global programs.
-- Existing courses stay nullable and are treated as shared courses so legacy
-- enrollments keep their current behaviour. New application-created courses
-- always supply program_id.

ALTER TABLE courses ADD COLUMN IF NOT EXISTS program_id smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'courses_program_id_fkey'
       AND conrelid = 'courses'::regclass
  ) THEN
    ALTER TABLE courses
      ADD CONSTRAINT courses_program_id_fkey
      FOREIGN KEY (program_id) REFERENCES core.programs(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS courses_program_id_idx ON courses (program_id);

-- A program-specific course enrolls only matching students. A NULL program_id
-- is a legacy/shared course and therefore still enrolls everybody.
CREATE OR REPLACE FUNCTION {{schema}}.auto_enroll_all_in_new_course()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO {{schema}}.course_enrollments (student_id, course_id, enrolled_at)
  SELECT s.id, NEW.id, now()
    FROM {{schema}}.students s
   WHERE NEW.program_id IS NULL OR s.program_id = NEW.program_id
  ON CONFLICT (course_id, student_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- A new student receives shared courses plus courses assigned to their program.
CREATE OR REPLACE FUNCTION {{schema}}.auto_enroll_student_in_courses()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO {{schema}}.course_enrollments (student_id, course_id, enrolled_at)
  SELECT NEW.id, c.id, now()
    FROM {{schema}}.courses c
   WHERE c.program_id IS NULL OR c.program_id = NEW.program_id
  ON CONFLICT (course_id, student_id) DO NOTHING;
  RETURN NEW;
END;
$$;
