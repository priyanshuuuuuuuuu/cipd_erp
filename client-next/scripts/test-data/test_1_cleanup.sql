-- Removes everything scripts/test-data/test_1_seed.sql created in cohort Test#1 (schema test_1, database cipd_test),
-- plus rows the app created that point at the seeded classes (e.g. feedback rolled out while testing).
--   psql "postgresql://postgres:***@192.168.3.190:5432/cipd_test" -v ON_ERROR_STOP=1 -f scripts/test-data/test_1_cleanup.sql

BEGIN;

DO $$ BEGIN
  IF current_database() <> 'cipd_test' THEN
    RAISE EXCEPTION 'Refusing to run: connected to %, expected cipd_test', current_database();
  END IF;
END $$;

SET LOCAL search_path = test_1, core, public;

CREATE TEMP TABLE seed_old_sessions ON COMMIT DROP AS SELECT id FROM sessions WHERE id::text LIKE '5eed5eed%';
CREATE TEMP TABLE seed_old_assign   ON COMMIT DROP AS SELECT id FROM assignments WHERE id::text LIKE '5eed5eed%';

DELETE FROM notification_stream    WHERE id::text LIKE '5eed5eed%' OR session_id IN (SELECT id FROM seed_old_sessions);
DELETE FROM notifications          WHERE id::text LIKE '5eed5eed%' OR session_id IN (SELECT id FROM seed_old_sessions);
DELETE FROM feedback_responses     WHERE id::text LIKE '5eed5eed%' OR session_id IN (SELECT id FROM seed_old_sessions)
                                      OR question_id::text LIKE '5eed5eed%';
DELETE FROM attendance_records     WHERE id::text LIKE '5eed5eed%' OR session_id IN (SELECT id FROM seed_old_sessions);
DELETE FROM session_materials      WHERE session_id IN (SELECT id FROM seed_old_sessions);
DELETE FROM student_attendance_marks WHERE session_id IN (SELECT id FROM seed_old_sessions);
DELETE FROM leave_requests         WHERE id::text LIKE '5eed5eed%' OR session_id IN (SELECT id FROM seed_old_sessions);
DELETE FROM session_change_requests WHERE id::text LIKE '5eed5eed%';
DELETE FROM faculty_leave          WHERE id::text LIKE '5eed5eed%';
DELETE FROM course_posts           WHERE id::text LIKE '5eed5eed%';
DELETE FROM assignment_submissions WHERE id::text LIKE '5eed5eed%' OR assignment_id IN (SELECT id FROM seed_old_assign);
DELETE FROM assignments            WHERE id::text LIKE '5eed5eed%';
DELETE FROM sessions               WHERE id::text LIKE '5eed5eed%';
DELETE FROM feedback_questions     WHERE id::text LIKE '5eed5eed%';

COMMIT;
