-- 0005_student_roll_no: generated roll number (cohort prefix + sequence). Unique within the cohort; NULL when the
-- cohort has no prefix configured or the student predates the feature.
ALTER TABLE students ADD COLUMN IF NOT EXISTS roll_no text;
CREATE UNIQUE INDEX IF NOT EXISTS students_roll_no_key ON students (roll_no) WHERE roll_no IS NOT NULL;
