-- ============================================================
-- CIPD ERP — Auto-Enroll ALL Students in ALL Courses
-- Run this in Supabase Dashboard → SQL Editor
-- ============================================================

-- STEP 1: Enroll every existing student in every existing course
-- ON CONFLICT DO NOTHING ensures no errors if some are already enrolled
INSERT INTO course_enrollments (student_id, course_id, enrolled_at)
SELECT
  s.id   AS student_id,
  c.id   AS course_id,
  NOW()  AS enrolled_at
FROM students s
CROSS JOIN courses c
ON CONFLICT (course_id, student_id) DO NOTHING;

-- ============================================================
-- STEP 2: Create a trigger so every NEW student who signs up
-- is automatically enrolled in ALL courses immediately
-- ============================================================

CREATE OR REPLACE FUNCTION auto_enroll_new_student()
RETURNS TRIGGER AS $$
BEGIN
  -- When a new row is inserted into students, enroll them in all courses
  INSERT INTO course_enrollments (student_id, course_id, enrolled_at)
  SELECT NEW.id, c.id, NOW()
  FROM courses c
  ON CONFLICT (course_id, student_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if it already exists to allow re-running safely
DROP TRIGGER IF EXISTS trg_auto_enroll_student ON students;

CREATE TRIGGER trg_auto_enroll_student
AFTER INSERT ON students
FOR EACH ROW
EXECUTE FUNCTION auto_enroll_new_student();

-- ============================================================
-- STEP 3: Create a trigger so when a NEW course is added,
-- all existing students are automatically enrolled in it
-- ============================================================

CREATE OR REPLACE FUNCTION auto_enroll_all_in_new_course()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO course_enrollments (student_id, course_id, enrolled_at)
  SELECT s.id, NEW.id, NOW()
  FROM students s
  ON CONFLICT (course_id, student_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_enroll_course ON courses;

CREATE TRIGGER trg_auto_enroll_course
AFTER INSERT ON courses
FOR EACH ROW
EXECUTE FUNCTION auto_enroll_all_in_new_course();

-- ============================================================
-- STEP 4: Verify — should show all students × all courses
-- ============================================================
SELECT
  u.first_name || ' ' || u.last_name AS student_name,
  u.email,
  COUNT(ce.course_id) AS courses_enrolled
FROM users u
JOIN students s ON s.id = u.id
LEFT JOIN course_enrollments ce ON ce.student_id = s.id
GROUP BY u.id, u.first_name, u.last_name, u.email
ORDER BY student_name;
